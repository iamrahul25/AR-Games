package com.margelo.nitro.arpose

import android.graphics.Bitmap
import android.graphics.Matrix
import android.os.SystemClock
import android.util.Log
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.Delegate
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import com.margelo.nitro.NitroModules
import com.margelo.nitro.camera.HybridFrameSpec
import com.margelo.nitro.camera.public.NativeFrame
import kotlin.math.max

class HybridPoseDetector(
  private val options: PoseDetectorOptions,
) : HybridPoseDetectorSpec() {
  private val lock = Any()
  private var landmarker: PoseLandmarker? = null
  private var creationError: Throwable? = null
  private var gpuFailed = false
  private var delegateInUse: PoseDelegate = options.delegate
  private var lastTimestampMs = 0L
  private var isDisposed = false

  override val activeDelegate: PoseDelegate
    get() = delegateInUse

  private val modelAssetPath: String
    get() =
      when (options.model) {
        PoseModel.LITE -> "pose_landmarker_lite.task"
        PoseModel.FULL -> "pose_landmarker_full.task"
      }

  private fun createLandmarker(delegate: Delegate): PoseLandmarker {
    val context =
      NitroModules.applicationContext
        ?: throw Error("ARPoseLandmarker: React application context is not available yet!")
    val baseOptions =
      BaseOptions
        .builder()
        .setModelAssetPath(modelAssetPath)
        .setDelegate(delegate)
        .build()
    val landmarkerOptions =
      PoseLandmarker.PoseLandmarkerOptions
        .builder()
        .setBaseOptions(baseOptions)
        .setRunningMode(RunningMode.VIDEO)
        .setNumPoses(1)
        .setMinPoseDetectionConfidence(options.minPoseDetectionConfidence.toFloat())
        .setMinPosePresenceConfidence(options.minPosePresenceConfidence.toFloat())
        .setMinTrackingConfidence(options.minTrackingConfidence.toFloat())
        .setOutputSegmentationMasks(false)
        .build()
    return PoseLandmarker.createFromOptions(context, landmarkerOptions)
  }

  // Created lazily on the first detect() call so that the model is loaded
  // (and the GPU context is bound) on the Frame Output's thread, not on the JS thread.
  private fun requireLandmarker(): PoseLandmarker {
    landmarker?.let { return it }
    // Loading the model is expensive; don't retry it on every frame once it has failed.
    creationError?.let { throw it }
    val created =
      try {
        if (options.delegate == PoseDelegate.GPU && !gpuFailed) {
          try {
            createLandmarker(Delegate.GPU).also { delegateInUse = PoseDelegate.GPU }
          } catch (e: Throwable) {
            Log.w(TAG, "GPU delegate unavailable, falling back to CPU.", e)
            createLandmarker(Delegate.CPU).also { delegateInUse = PoseDelegate.CPU }
          }
        } else {
          createLandmarker(Delegate.CPU).also { delegateInUse = PoseDelegate.CPU }
        }
      } catch (e: Throwable) {
        Log.e(TAG, "Failed to create the pose landmarker.", e)
        creationError = e
        throw e
      }
    landmarker = created
    return created
  }

  override fun detect(frame: HybridFrameSpec): PoseDetectionResult? {
    val nativeFrame =
      frame as? NativeFrame
        ?: throw Error("Frame is not of type `NativeFrame`!")

    synchronized(lock) {
      if (isDisposed) return null

      val imageProxy = nativeFrame.image
      val source = imageProxy.toBitmap()
      val upright =
        toPreviewSpaceBitmap(
          source,
          imageProxy.imageInfo.rotationDegrees,
          frame.isMirrored,
          options.maxInputSize.toInt(),
        )
      if (upright !== source) source.recycle()

      val mpImage = BitmapImageBuilder(upright).build()
      try {
        var timestampMs = SystemClock.uptimeMillis()
        if (timestampMs <= lastTimestampMs) timestampMs = lastTimestampMs + 1
        lastTimestampMs = timestampMs

        val start = SystemClock.elapsedRealtimeNanos()
        val result =
          try {
            requireLandmarker().detectForVideo(mpImage, timestampMs)
          } catch (e: Throwable) {
            // Some GPU drivers (e.g. the Android emulator's) create the GPU graph fine
            // but fail on the first inference with unsupported GL calls.
            if (delegateInUse != PoseDelegate.GPU) throw e
            Log.w(TAG, "GPU inference failed, falling back to CPU.", e)
            gpuFailed = true
            runCatching { landmarker?.close() }
            landmarker = null
            requireLandmarker().detectForVideo(mpImage, timestampMs)
          }
        val inferenceMs = (SystemClock.elapsedRealtimeNanos() - start) / 1_000_000.0

        val pose = result.landmarks().firstOrNull() ?: return null
        if (pose.isEmpty()) return null
        val world = result.worldLandmarks().firstOrNull() ?: emptyList()

        val landmarks = DoubleArray(pose.size * 4)
        pose.forEachIndexed { i, lm ->
          landmarks[i * 4] = lm.x().toDouble()
          landmarks[i * 4 + 1] = lm.y().toDouble()
          landmarks[i * 4 + 2] = lm.z().toDouble()
          landmarks[i * 4 + 3] = lm.visibility().orElse(0f).toDouble()
        }
        val worldLandmarks = DoubleArray(world.size * 3)
        world.forEachIndexed { i, lm ->
          worldLandmarks[i * 3] = lm.x().toDouble()
          worldLandmarks[i * 3 + 1] = lm.y().toDouble()
          worldLandmarks[i * 3 + 2] = lm.z().toDouble()
        }

        return PoseDetectionResult(
          landmarks = landmarks,
          worldLandmarks = worldLandmarks,
          imageWidth = upright.width.toDouble(),
          imageHeight = upright.height.toDouble(),
          inferenceMs = inferenceMs,
          timestampMs = timestampMs.toDouble(),
        )
      } finally {
        mpImage.close()
        upright.recycle()
      }
    }
  }

  override fun dispose() {
    synchronized(lock) {
      isDisposed = true
      // close() rethrows any error the graph hit earlier (e.g. a failed GPU inference).
      // dispose() is called from C++ via JNI, where an uncaught Java exception aborts the app.
      runCatching { landmarker?.close() }
        .onFailure { Log.w(TAG, "Error while closing the pose landmarker.", it) }
      landmarker = null
    }
    super.dispose()
  }

  companion object {
    private const val TAG = "ARPoseLandmarker"

    /**
     * Rotates (and mirrors) the camera buffer so it looks exactly like the preview,
     * and downscales it so its longest side is at most [maxSize].
     */
    fun toPreviewSpaceBitmap(
      source: Bitmap,
      rotationDegrees: Int,
      mirrored: Boolean,
      maxSize: Int,
    ): Bitmap {
      val longest = max(source.width, source.height)
      val scale = if (maxSize > 0 && longest > maxSize) maxSize.toFloat() / longest else 1f
      if (rotationDegrees == 0 && !mirrored && scale == 1f) return source

      val matrix = Matrix()
      matrix.postScale(scale, scale)
      matrix.postRotate(rotationDegrees.toFloat())
      if (mirrored) matrix.postScale(-1f, 1f)
      return Bitmap.createBitmap(source, 0, 0, source.width, source.height, matrix, scale < 1f)
    }
  }
}

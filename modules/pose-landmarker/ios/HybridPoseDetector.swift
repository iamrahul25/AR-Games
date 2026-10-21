//
//  HybridPoseDetector.swift
//  ARPoseLandmarker
//

import AVFoundation
import CoreImage
import MediaPipeTasksVision
import NitroModules
import UIKit
import VisionCamera

class HybridPoseDetector: HybridPoseDetectorSpec {
  private let options: PoseDetectorOptions
  private let lock = NSLock()
  private let ciContext = CIContext(options: [.useSoftwareRenderer: false, .cacheIntermediates: false])
  private var landmarker: PoseLandmarker?
  private var delegateInUse: PoseDelegate
  private var lastTimestampMs: Int = 0
  private var isDisposed = false

  var activeDelegate: PoseDelegate { delegateInUse }

  init(options: PoseDetectorOptions) {
    self.options = options
    self.delegateInUse = options.delegate
    super.init()
  }

  // MARK: - Model loading

  private var modelName: String {
    switch options.model {
    case .lite: return "pose_landmarker_lite"
    case .full: return "pose_landmarker_full"
    }
  }

  private static func findModelPath(_ name: String) -> String? {
    let bundles = [Bundle.main, Bundle(for: HybridPoseDetector.self)]
    for bundle in bundles {
      if let url = bundle.url(forResource: "ARPoseLandmarkerModels", withExtension: "bundle"),
         let resourceBundle = Bundle(url: url),
         let path = resourceBundle.path(forResource: name, ofType: "task") {
        return path
      }
      if let path = bundle.path(forResource: name, ofType: "task") {
        return path
      }
    }
    return nil
  }

  private func createLandmarker(delegate: Delegate) throws -> PoseLandmarker {
    guard let modelPath = HybridPoseDetector.findModelPath(modelName) else {
      throw RuntimeError.error(withMessage: "ARPoseLandmarker: Could not find \(modelName).task in the app bundle!")
    }
    let landmarkerOptions = PoseLandmarkerOptions()
    landmarkerOptions.baseOptions.modelAssetPath = modelPath
    landmarkerOptions.baseOptions.delegate = delegate
    landmarkerOptions.runningMode = .video
    landmarkerOptions.numPoses = 1
    landmarkerOptions.minPoseDetectionConfidence = Float(options.minPoseDetectionConfidence)
    landmarkerOptions.minPosePresenceConfidence = Float(options.minPosePresenceConfidence)
    landmarkerOptions.minTrackingConfidence = Float(options.minTrackingConfidence)
    landmarkerOptions.shouldOutputSegmentationMasks = false
    return try PoseLandmarker(options: landmarkerOptions)
  }

  // Created lazily on the first detect() call so the model loads on the
  // Frame Output's thread instead of blocking the JS thread.
  private func requireLandmarker() throws -> PoseLandmarker {
    if let landmarker { return landmarker }
    let created: PoseLandmarker
    if options.delegate == .gpu {
      do {
        created = try createLandmarker(delegate: .GPU)
        delegateInUse = .gpu
      } catch {
        print("[ARPoseLandmarker] GPU delegate unavailable, falling back to CPU: \(error)")
        created = try createLandmarker(delegate: .CPU)
        delegateInUse = .cpu
      }
    } else {
      created = try createLandmarker(delegate: .CPU)
      delegateInUse = .cpu
    }
    landmarker = created
    return created
  }

  // MARK: - Detection

  func detect(frame: any HybridFrameSpec) throws -> PoseDetectionResult? {
    guard let nativeFrame = frame as? any NativeFrame else {
      throw RuntimeError.error(withMessage: "Frame is not of type `NativeFrame`!")
    }
    guard let sampleBuffer = nativeFrame.sampleBuffer,
          let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else {
      throw RuntimeError.error(withMessage: "Frame doesn't have a pixel buffer - it's invalid!")
    }

    lock.lock()
    defer { lock.unlock() }
    if isDisposed { return nil }

    guard let previewImage = makePreviewSpaceImage(
      pixelBuffer: pixelBuffer,
      orientation: frame.orientation,
      isMirrored: frame.isMirrored
    ) else {
      throw RuntimeError.error(withMessage: "Failed to convert Frame to an image!")
    }
    let mpImage = try MPImage(uiImage: UIImage(cgImage: previewImage))

    var timestampMs = Int(CACurrentMediaTime() * 1000)
    if timestampMs <= lastTimestampMs { timestampMs = lastTimestampMs + 1 }
    lastTimestampMs = timestampMs

    let start = CACurrentMediaTime()
    let result = try requireLandmarker().detect(videoFrame: mpImage, timestampInMilliseconds: timestampMs)
    let inferenceMs = (CACurrentMediaTime() - start) * 1000

    guard let pose = result.landmarks.first, !pose.isEmpty else { return nil }
    let world = result.worldLandmarks.first ?? []

    var landmarks = [Double]()
    landmarks.reserveCapacity(pose.count * 4)
    for lm in pose {
      landmarks.append(Double(lm.x))
      landmarks.append(Double(lm.y))
      landmarks.append(Double(lm.z))
      landmarks.append(lm.visibility?.doubleValue ?? 0)
    }
    var worldLandmarks = [Double]()
    worldLandmarks.reserveCapacity(world.count * 3)
    for lm in world {
      worldLandmarks.append(Double(lm.x))
      worldLandmarks.append(Double(lm.y))
      worldLandmarks.append(Double(lm.z))
    }

    return PoseDetectionResult(
      landmarks: landmarks,
      worldLandmarks: worldLandmarks,
      imageWidth: Double(previewImage.width),
      imageHeight: Double(previewImage.height),
      inferenceMs: inferenceMs,
      timestampMs: Double(timestampMs)
    )
  }

  /// Rotates (and mirrors) the camera buffer so it looks exactly like the preview,
  /// downscaled so its longest side is at most `maxInputSize`.
  private func makePreviewSpaceImage(
    pixelBuffer: CVPixelBuffer,
    orientation: CameraOrientation,
    isMirrored: Bool
  ) -> CGImage? {
    var image = CIImage(cvPixelBuffer: pixelBuffer)
      .oriented(orientation.toCGImagePropertyOrientation(isMirrored: isMirrored))
    let longest = max(image.extent.width, image.extent.height)
    let maxSize = CGFloat(options.maxInputSize)
    if maxSize > 0 && longest > maxSize {
      let scale = maxSize / longest
      image = image.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
    }
    image = image.transformed(by: CGAffineTransform(translationX: -image.extent.origin.x, y: -image.extent.origin.y))
    return ciContext.createCGImage(image, from: image.extent)
  }

  func dispose() {
    lock.lock()
    isDisposed = true
    landmarker = nil
    lock.unlock()
  }
}

extension CameraOrientation {
  func toCGImagePropertyOrientation(isMirrored: Bool) -> CGImagePropertyOrientation {
    switch self {
    case .up: return isMirrored ? .upMirrored : .up
    case .down: return isMirrored ? .downMirrored : .down
    case .left: return isMirrored ? .leftMirrored : .left
    case .right: return isMirrored ? .rightMirrored : .right
    }
  }
}

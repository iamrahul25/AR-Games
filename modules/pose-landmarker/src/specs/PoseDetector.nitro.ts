import type { HybridObject } from 'react-native-nitro-modules'
import type { Frame } from 'react-native-vision-camera'

export type PoseModel = 'lite' | 'full'
export type PoseDelegate = 'gpu' | 'cpu'

export interface PoseDetectorOptions {
  model: PoseModel
  delegate: PoseDelegate
  minPoseDetectionConfidence: number
  minPosePresenceConfidence: number
  minTrackingConfidence: number
  /**
   * Longest side (px) the frame is downscaled to before inference.
   * MediaPipe resizes to 256px internally, so anything above ~480 is wasted work.
   */
  maxInputSize: number
}

export interface PoseDetectionResult {
  /**
   * 33 landmarks flattened as `[x, y, z, visibility] * 33`.
   * `x`/`y` are normalized [0..1] in the *preview's* coordinate space
   * (upright, and mirrored if the preview is mirrored).
   * Left/right labels are MediaPipe's raw labels for the image it saw;
   * consumers must swap L/R pairs when the preview is mirrored.
   */
  landmarks: number[]
  /** 33 world landmarks flattened as `[x, y, z] * 33`, meters, hip-centered. */
  worldLandmarks: number[]
  imageWidth: number
  imageHeight: number
  inferenceMs: number
  timestampMs: number
}

export interface PoseDetector
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  /**
   * Synchronously detects a single pose in the given Frame.
   * Call from inside a `useFrameOutput` `onFrame` worklet.
   * Returns `undefined` if no person was detected.
   */
  detect(frame: Frame): PoseDetectionResult | undefined
  /** The delegate actually in use (`'cpu'` if GPU init failed). */
  readonly activeDelegate: PoseDelegate
}

export interface PoseDetectorFactory
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  createPoseDetector(options: PoseDetectorOptions): PoseDetector
}

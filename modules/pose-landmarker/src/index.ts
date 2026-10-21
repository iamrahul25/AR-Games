import { useEffect, useMemo } from 'react'
import { NitroModules } from 'react-native-nitro-modules'
import type {
  PoseDetector,
  PoseDetectorFactory,
  PoseDetectorOptions,
} from './specs/PoseDetector.nitro'

export type {
  PoseDetectionResult,
  PoseDelegate,
  PoseDetector,
  PoseDetectorOptions,
  PoseModel,
} from './specs/PoseDetector.nitro'

let factory: PoseDetectorFactory | undefined

function getFactory(): PoseDetectorFactory {
  factory ??= NitroModules.createHybridObject<PoseDetectorFactory>(
    'PoseDetectorFactory',
  )
  return factory
}

export const DEFAULT_POSE_DETECTOR_OPTIONS: PoseDetectorOptions = {
  model: 'lite',
  delegate: 'gpu',
  minPoseDetectionConfidence: 0.5,
  minPosePresenceConfidence: 0.5,
  minTrackingConfidence: 0.5,
  maxInputSize: 480,
}

export function createPoseDetector(
  options: Partial<PoseDetectorOptions> = {},
): PoseDetector {
  return getFactory().createPoseDetector({
    ...DEFAULT_POSE_DETECTOR_OPTIONS,
    ...options,
  })
}

/**
 * Creates a {@linkcode PoseDetector} that can be called from a
 * VisionCamera v5 `useFrameOutput({ onFrame })` worklet.
 */
export function usePoseDetector(
  options: Partial<PoseDetectorOptions> = {},
): PoseDetector {
  const {
    model,
    delegate,
    minPoseDetectionConfidence,
    minPosePresenceConfidence,
    minTrackingConfidence,
    maxInputSize,
  } = { ...DEFAULT_POSE_DETECTOR_OPTIONS, ...options }

  const detector = useMemo(
    () =>
      createPoseDetector({
        model,
        delegate,
        minPoseDetectionConfidence,
        minPosePresenceConfidence,
        minTrackingConfidence,
        maxInputSize,
      }),
    [
      model,
      delegate,
      minPoseDetectionConfidence,
      minPosePresenceConfidence,
      minTrackingConfidence,
      maxInputSize,
    ],
  )

  useEffect(() => () => detector.dispose(), [detector])

  return detector
}

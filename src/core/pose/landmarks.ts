import type { BodyPart } from './types'

/** MediaPipe Pose Landmarker (BlazePose) 33-landmark topology. */
export const LM = {
  nose: 0,
  leftEyeInner: 1,
  leftEye: 2,
  leftEyeOuter: 3,
  rightEyeInner: 4,
  rightEye: 5,
  rightEyeOuter: 6,
  leftEar: 7,
  rightEar: 8,
  mouthLeft: 9,
  mouthRight: 10,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftPinky: 17,
  rightPinky: 18,
  leftIndex: 19,
  rightIndex: 20,
  leftThumb: 21,
  rightThumb: 22,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftHeel: 29,
  rightHeel: 30,
  leftFootIndex: 31,
  rightFootIndex: 32,
} as const

export type LandmarkName = keyof typeof LM

export const LANDMARK_COUNT = 33

/** Pairs of (left, right) landmark indices, used to swap labels for mirrored images. */
export const LEFT_RIGHT_PAIRS: readonly (readonly [number, number])[] = [
  [1, 4],
  [2, 5],
  [3, 6],
  [7, 8],
  [9, 10],
  [11, 12],
  [13, 14],
  [15, 16],
  [17, 18],
  [19, 20],
  [21, 22],
  [23, 24],
  [25, 26],
  [27, 28],
  [29, 30],
  [31, 32],
]

/** Index of the opposite-side landmark for every index (self for center landmarks). */
export const MIRROR_INDEX: readonly number[] = (() => {
  const map = Array.from({ length: LANDMARK_COUNT }, (_, i) => i)
  for (const [l, r] of LEFT_RIGHT_PAIRS) {
    map[l] = r
    map[r] = l
  }
  return map
})()

export interface Bone {
  from: number
  to: number
  part: BodyPart
}

/** Bones drawn on the skeleton overlay, grouped by body part for coloring. */
export const BONES: readonly Bone[] = [
  { from: LM.leftShoulder, to: LM.rightShoulder, part: 'torso' },
  { from: LM.leftShoulder, to: LM.leftHip, part: 'torso' },
  { from: LM.rightShoulder, to: LM.rightHip, part: 'torso' },
  { from: LM.leftHip, to: LM.rightHip, part: 'torso' },
  { from: LM.leftShoulder, to: LM.leftElbow, part: 'leftArm' },
  { from: LM.leftElbow, to: LM.leftWrist, part: 'leftArm' },
  { from: LM.rightShoulder, to: LM.rightElbow, part: 'rightArm' },
  { from: LM.rightElbow, to: LM.rightWrist, part: 'rightArm' },
  { from: LM.leftHip, to: LM.leftKnee, part: 'leftLeg' },
  { from: LM.leftKnee, to: LM.leftAnkle, part: 'leftLeg' },
  { from: LM.leftAnkle, to: LM.leftFootIndex, part: 'leftLeg' },
  { from: LM.rightHip, to: LM.rightKnee, part: 'rightLeg' },
  { from: LM.rightKnee, to: LM.rightAnkle, part: 'rightLeg' },
  { from: LM.rightAnkle, to: LM.rightFootIndex, part: 'rightLeg' },
]

/** Joints drawn as dots on the skeleton overlay. */
export const JOINTS: readonly { index: number; part: BodyPart }[] = [
  { index: LM.nose, part: 'head' },
  { index: LM.leftShoulder, part: 'leftArm' },
  { index: LM.rightShoulder, part: 'rightArm' },
  { index: LM.leftElbow, part: 'leftArm' },
  { index: LM.rightElbow, part: 'rightArm' },
  { index: LM.leftWrist, part: 'leftArm' },
  { index: LM.rightWrist, part: 'rightArm' },
  { index: LM.leftHip, part: 'leftLeg' },
  { index: LM.rightHip, part: 'rightLeg' },
  { index: LM.leftKnee, part: 'leftLeg' },
  { index: LM.rightKnee, part: 'rightLeg' },
  { index: LM.leftAnkle, part: 'leftLeg' },
  { index: LM.rightAnkle, part: 'rightLeg' },
]

/** Landmarks that must be visible for a "full body in frame" check. */
export const FULL_BODY_LANDMARKS: readonly number[] = [
  LM.leftShoulder,
  LM.rightShoulder,
  LM.leftHip,
  LM.rightHip,
  LM.leftKnee,
  LM.rightKnee,
  LM.leftAnkle,
  LM.rightAnkle,
]

export interface Landmark {
  x: number
  y: number
  z: number
  visibility: number
}

export interface WorldLandmark {
  x: number
  y: number
  z: number
}

/**
 * One detected pose, in **canonical space**:
 * - `x`/`y` normalized [0..1] as seen in a mirror (the user's own left side is on the left of the image),
 * - left/right landmark labels always refer to the user's own body.
 */
export interface PoseFrame {
  landmarks: Landmark[]
  worldLandmarks?: WorldLandmark[]
  timestamp: number
  imageWidth: number
  imageHeight: number
  inferenceMs?: number
}

export type BodyPart = 'head' | 'torso' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg'

export const BODY_PARTS: BodyPart[] = ['head', 'leftArm', 'rightArm', 'torso', 'leftLeg', 'rightLeg']

export const BODY_PART_LABELS: Record<BodyPart, string> = {
  head: 'Head',
  torso: 'Torso',
  leftArm: 'Left Arm',
  rightArm: 'Right Arm',
  leftLeg: 'Left Leg',
  rightLeg: 'Right Leg',
}

export type PartStatus = 'good' | 'close' | 'bad' | 'unknown'

export type CameraFacing = 'front' | 'back'
export type PoseModelQuality = 'lite' | 'full'

export type PoseCameraStatus =
  | 'requesting-permission'
  | 'permission-denied'
  | 'loading-model'
  | 'running'
  | 'error'

import { LM, type LandmarkName } from './landmarks'
import type { BodyPart, Landmark, PoseFrame } from './types'

export type PointName = LandmarkName | 'midShoulder' | 'midHip'

export type SegmentName =
  | 'torso'
  | 'head'
  | 'leftUpperArm'
  | 'leftForearm'
  | 'rightUpperArm'
  | 'rightForearm'
  | 'leftThigh'
  | 'leftShin'
  | 'rightThigh'
  | 'rightShin'

export interface SegmentInfo {
  from: PointName
  to: PointName
  part: BodyPart
  label: string
  mirror: SegmentName
}

export const SEGMENTS: Record<SegmentName, SegmentInfo> = {
  torso: { from: 'midHip', to: 'midShoulder', part: 'torso', label: 'body', mirror: 'torso' },
  head: { from: 'midShoulder', to: 'nose', part: 'head', label: 'head', mirror: 'head' },
  leftUpperArm: { from: 'leftShoulder', to: 'leftElbow', part: 'leftArm', label: 'left upper arm', mirror: 'rightUpperArm' },
  leftForearm: { from: 'leftElbow', to: 'leftWrist', part: 'leftArm', label: 'left forearm', mirror: 'rightForearm' },
  rightUpperArm: { from: 'rightShoulder', to: 'rightElbow', part: 'rightArm', label: 'right upper arm', mirror: 'leftUpperArm' },
  rightForearm: { from: 'rightElbow', to: 'rightWrist', part: 'rightArm', label: 'right forearm', mirror: 'leftForearm' },
  leftThigh: { from: 'leftHip', to: 'leftKnee', part: 'leftLeg', label: 'left thigh', mirror: 'rightThigh' },
  leftShin: { from: 'leftKnee', to: 'leftAnkle', part: 'leftLeg', label: 'left shin', mirror: 'rightShin' },
  rightThigh: { from: 'rightHip', to: 'rightKnee', part: 'rightLeg', label: 'right thigh', mirror: 'leftThigh' },
  rightShin: { from: 'rightKnee', to: 'rightAnkle', part: 'rightLeg', label: 'right shin', mirror: 'leftShin' },
}

export const SEGMENT_NAMES = Object.keys(SEGMENTS) as SegmentName[]

export function getPoint(landmarks: Landmark[], name: PointName): Landmark {
  if (name === 'midShoulder') return midpoint(landmarks[LM.leftShoulder], landmarks[LM.rightShoulder])
  if (name === 'midHip') return midpoint(landmarks[LM.leftHip], landmarks[LM.rightHip])
  return landmarks[LM[name]]
}

function midpoint(a: Landmark, b: Landmark): Landmark {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
    visibility: Math.min(a.visibility, b.visibility),
  }
}

/**
 * Direction of a body segment in degrees, measured in screen space:
 * 0 = pointing up, 90 = pointing to the right of the image, ±180 = down, -90 = left.
 * Corrects for non-square images so angles are true on-screen angles.
 */
export function segmentAngle(frame: PoseFrame, segment: SegmentName): number {
  const info = SEGMENTS[segment]
  const a = getPoint(frame.landmarks, info.from)
  const b = getPoint(frame.landmarks, info.to)
  return directionAngle((b.x - a.x) * frame.imageWidth, (b.y - a.y) * frame.imageHeight)
}

export function segmentLength(frame: PoseFrame, segment: SegmentName): number {
  const info = SEGMENTS[segment]
  const a = getPoint(frame.landmarks, info.from)
  const b = getPoint(frame.landmarks, info.to)
  return Math.hypot((b.x - a.x) * frame.imageWidth, (b.y - a.y) * frame.imageHeight)
}

export function segmentVisibility(frame: PoseFrame, segment: SegmentName): number {
  const info = SEGMENTS[segment]
  return Math.min(getPoint(frame.landmarks, info.from).visibility, getPoint(frame.landmarks, info.to).visibility)
}

export function directionAngle(dx: number, dy: number): number {
  return (Math.atan2(dx, -dy) * 180) / Math.PI
}

/** Unit vector (screen space, y down) for a direction angle in degrees. */
export function directionVector(angleDeg: number): { x: number; y: number } {
  const r = (angleDeg * Math.PI) / 180
  return { x: Math.sin(r), y: -Math.cos(r) }
}

/** Smallest absolute difference between two angles, in [0, 180]. */
export function angleDelta(a: number, b: number): number {
  const d = Math.abs(normalizeAngle(a - b))
  return d
}

/** Normalizes an angle into (-180, 180]. */
export function normalizeAngle(a: number): number {
  let r = a % 360
  if (r > 180) r -= 360
  if (r <= -180) r += 360
  return r
}

/** Interior angle at vertex `b` of the triangle a-b-c, in degrees [0, 180]. */
export function jointAngle(
  frame: PoseFrame,
  a: PointName,
  b: PointName,
  c: PointName,
): number {
  const pa = getPoint(frame.landmarks, a)
  const pb = getPoint(frame.landmarks, b)
  const pc = getPoint(frame.landmarks, c)
  const v1x = (pa.x - pb.x) * frame.imageWidth
  const v1y = (pa.y - pb.y) * frame.imageHeight
  const v2x = (pc.x - pb.x) * frame.imageWidth
  const v2y = (pc.y - pb.y) * frame.imageHeight
  const dot = v1x * v2x + v1y * v2y
  const len = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y)
  if (len === 0) return 180
  return (Math.acos(Math.max(-1, Math.min(1, dot / len))) * 180) / Math.PI
}

/** Bending angle between two consecutive segments (0 = straight, 180 = fully folded). */
export function bendAngle(upperAngle: number, lowerAngle: number): number {
  return angleDelta(upperAngle, lowerAngle)
}

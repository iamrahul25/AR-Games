import { directionVector, SEGMENT_NAMES, segmentAngle, segmentLength, type SegmentName } from './geometry'
import { LANDMARK_COUNT, LM, type LandmarkName } from './landmarks'
import type { Landmark, PoseFrame } from './types'

export type PoseView = 'front' | 'side'

export interface SegmentSpec {
  /** Direction in degrees: 0 = up, 90 = image right, ±180 = down, -90 = image left (mirror view). */
  angle: number
  /** Projected length factor (1 = full length; < 1 when the limb points toward the camera). */
  length?: number
}

export type SkeletonSpec = Record<SegmentName, SegmentSpec>

/** Average adult proportions, in torso lengths. */
export const BODY_PROPORTIONS = {
  torso: 1,
  head: 0.42,
  shoulderHalfWidth: 0.24,
  hipHalfWidth: 0.14,
  upperArm: 0.58,
  forearm: 0.52,
  thigh: 0.86,
  shin: 0.82,
  foot: 0.2,
} as const

export const NEUTRAL_SKELETON: SkeletonSpec = {
  torso: { angle: 0 },
  head: { angle: 0 },
  leftUpperArm: { angle: -172 },
  leftForearm: { angle: -175 },
  rightUpperArm: { angle: 172 },
  rightForearm: { angle: 175 },
  leftThigh: { angle: -176 },
  leftShin: { angle: -178 },
  rightThigh: { angle: 176 },
  rightShin: { angle: 178 },
}

const SEGMENT_LENGTH: Record<SegmentName, number> = {
  torso: BODY_PROPORTIONS.torso,
  head: BODY_PROPORTIONS.head,
  leftUpperArm: BODY_PROPORTIONS.upperArm,
  rightUpperArm: BODY_PROPORTIONS.upperArm,
  leftForearm: BODY_PROPORTIONS.forearm,
  rightForearm: BODY_PROPORTIONS.forearm,
  leftThigh: BODY_PROPORTIONS.thigh,
  rightThigh: BODY_PROPORTIONS.thigh,
  leftShin: BODY_PROPORTIONS.shin,
  rightShin: BODY_PROPORTIONS.shin,
}

export function fullSkeleton(partial: Partial<Record<SegmentName, SegmentSpec | number>>): SkeletonSpec {
  const out = { ...NEUTRAL_SKELETON }
  for (const name of SEGMENT_NAMES) {
    const v = partial[name]
    if (v === undefined) continue
    out[name] = typeof v === 'number' ? { angle: v } : v
  }
  return out
}

type Vec = { x: number; y: number }

const add = (a: Vec, b: Vec, s = 1): Vec => ({ x: a.x + b.x * s, y: a.y + b.y * s })

/**
 * Forward kinematics: builds 33 landmark positions (in body units, y down) from segment directions.
 */
export function buildBodyPoints(spec: SkeletonSpec, view: PoseView = 'front'): Vec[] {
  const widthFactor = view === 'side' ? 0.15 : 1
  const pts: Vec[] = Array.from({ length: LANDMARK_COUNT }, () => ({ x: 0, y: 0 }))
  const seg = (name: SegmentName) => {
    const s = spec[name]
    return { dir: directionVector(s.angle), len: SEGMENT_LENGTH[name] * (s.length ?? 1), angle: s.angle }
  }

  const midHip: Vec = { x: 0, y: 0 }
  const torso = seg('torso')
  const midShoulder = add(midHip, torso.dir, torso.len)
  const bodyRight = directionVector(spec.torso.angle + 90)

  pts[LM.leftShoulder] = add(midShoulder, bodyRight, -BODY_PROPORTIONS.shoulderHalfWidth * widthFactor)
  pts[LM.rightShoulder] = add(midShoulder, bodyRight, BODY_PROPORTIONS.shoulderHalfWidth * widthFactor)
  pts[LM.leftHip] = add(midHip, bodyRight, -BODY_PROPORTIONS.hipHalfWidth * widthFactor)
  pts[LM.rightHip] = add(midHip, bodyRight, BODY_PROPORTIONS.hipHalfWidth * widthFactor)

  const at = (name: string) => LM[name as LandmarkName]

  for (const side of ['left', 'right'] as const) {
    const sign = side === 'left' ? -1 : 1
    const upper = seg(`${side}UpperArm`)
    const fore = seg(`${side}Forearm`)
    const shoulder = pts[at(`${side}Shoulder`)]
    const elbow = add(shoulder, upper.dir, upper.len)
    const wrist = add(elbow, fore.dir, fore.len)
    pts[at(`${side}Elbow`)] = elbow
    pts[at(`${side}Wrist`)] = wrist
    const handSpread = directionVector(fore.angle + 90 * sign)
    pts[at(`${side}Index`)] = add(add(wrist, fore.dir, 0.1), handSpread, 0.01)
    pts[at(`${side}Pinky`)] = add(add(wrist, fore.dir, 0.08), handSpread, -0.03)
    pts[at(`${side}Thumb`)] = add(add(wrist, fore.dir, 0.05), handSpread, 0.04)

    const thigh = seg(`${side}Thigh`)
    const shin = seg(`${side}Shin`)
    const hip = pts[at(`${side}Hip`)]
    const knee = add(hip, thigh.dir, thigh.len)
    const ankle = add(knee, shin.dir, shin.len)
    pts[at(`${side}Knee`)] = knee
    pts[at(`${side}Ankle`)] = ankle
    const footAngle = view === 'side' ? shin.angle - 90 : shin.angle - 40 * sign
    const footDir = directionVector(footAngle)
    pts[at(`${side}FootIndex`)] = add(ankle, footDir, BODY_PROPORTIONS.foot)
    pts[at(`${side}Heel`)] = add(ankle, footDir, -0.05)
  }

  const head = seg('head')
  const nose = add(midShoulder, head.dir, head.len)
  const faceRight = directionVector(spec.head.angle + 90)
  const faceUp = head.dir
  pts[LM.nose] = nose
  const eyeBase = add(nose, faceUp, 0.04)
  pts[LM.leftEyeInner] = add(eyeBase, faceRight, -0.02 * widthFactor)
  pts[LM.leftEye] = add(eyeBase, faceRight, -0.04 * widthFactor)
  pts[LM.leftEyeOuter] = add(eyeBase, faceRight, -0.06 * widthFactor)
  pts[LM.rightEyeInner] = add(eyeBase, faceRight, 0.02 * widthFactor)
  pts[LM.rightEye] = add(eyeBase, faceRight, 0.04 * widthFactor)
  pts[LM.rightEyeOuter] = add(eyeBase, faceRight, 0.06 * widthFactor)
  pts[LM.leftEar] = add(eyeBase, faceRight, -0.1 * widthFactor)
  pts[LM.rightEar] = add(eyeBase, faceRight, 0.1 * widthFactor)
  const mouth = add(nose, faceUp, -0.05)
  pts[LM.mouthLeft] = add(mouth, faceRight, -0.03 * widthFactor)
  pts[LM.mouthRight] = add(mouth, faceRight, 0.03 * widthFactor)

  return pts
}

export interface FitOptions {
  imageWidth: number
  imageHeight: number
  /** Fraction of the image the body's bounding box may fill. */
  fill?: number
  /** Normalized center of the body in the image. */
  centerX?: number
  centerY?: number
  /**
   * Fixed size in image pixels per body unit (torso length), instead of fitting the
   * bounding box. With `scale`, `centerX` is the hip midpoint's x.
   */
  scale?: number
  /** With `scale`: normalized y of the lowest ankle (feet stay on this line). */
  groundY?: number
}

function bounds(pts: Vec[]) {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const p of pts) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  return { minX, maxX, minY: minY - 0.12, maxY }
}

/**
 * Where {@linkcode skeletonToFrame} puts a skeleton when fitting it: the scale (image px per
 * body unit) and the normalized y of the feet. Used to keep a moving body at a fixed size.
 */
export function skeletonFit(
  spec: SkeletonSpec,
  view: PoseView,
  { imageWidth, imageHeight, fill = 0.78, centerY = 0.52 }: FitOptions,
): { scale: number; groundY: number } {
  const pts = buildBodyPoints(spec, view)
  const b = bounds(pts)
  const scale = Math.min(
    (imageWidth * fill) / Math.max(b.maxX - b.minX, 1e-3),
    (imageHeight * fill) / Math.max(b.maxY - b.minY, 1e-3),
  )
  const ankle = Math.max(pts[LM.leftAnkle].y, pts[LM.rightAnkle].y)
  return { scale, groundY: ((ankle - (b.minY + b.maxY) / 2) * scale) / imageHeight + centerY }
}

/** Builds a {@linkcode PoseFrame} (normalized landmarks) that fits the skeleton into an image. */
export function skeletonToFrame(
  spec: SkeletonSpec,
  view: PoseView,
  { imageWidth, imageHeight, fill = 0.78, centerX = 0.5, centerY = 0.52, scale: fixedScale, groundY }: FitOptions,
  timestamp = 0,
): PoseFrame {
  const pts = buildBodyPoints(spec, view)
  let scale: number
  let ox: number
  let oy: number
  let anchorX: number
  let anchorY: number
  if (fixedScale !== undefined) {
    scale = fixedScale
    ox = 0
    anchorX = centerX
    if (groundY !== undefined) {
      oy = Math.max(pts[LM.leftAnkle].y, pts[LM.rightAnkle].y)
      anchorY = groundY
    } else {
      oy = 0
      anchorY = centerY
    }
  } else {
    const b = bounds(pts)
    scale = Math.min(
      (imageWidth * fill) / Math.max(b.maxX - b.minX, 1e-3),
      (imageHeight * fill) / Math.max(b.maxY - b.minY, 1e-3),
    )
    ox = (b.minX + b.maxX) / 2
    oy = (b.minY + b.maxY) / 2
    anchorX = centerX
    anchorY = centerY
  }

  const landmarks: Landmark[] = pts.map((p) => ({
    x: ((p.x - ox) * scale) / imageWidth + anchorX,
    y: ((p.y - oy) * scale) / imageHeight + anchorY,
    z: 0,
    visibility: 0.99,
  }))
  return { landmarks, timestamp, imageWidth, imageHeight }
}

/**
 * Inverse of {@linkcode buildBodyPoints}: reads segment directions (and foreshortening,
 * relative to the torso) from a detected frame. Used by the pose recorder.
 */
export function frameToSkeleton(frames: PoseFrame[]): SkeletonSpec {
  if (frames.length === 0) return { ...NEUTRAL_SKELETON }
  const out = {} as SkeletonSpec
  for (const name of SEGMENT_NAMES) {
    let sx = 0
    let sy = 0
    let lengthSum = 0
    for (const frame of frames) {
      const a = (segmentAngle(frame, name) * Math.PI) / 180
      sx += Math.sin(a)
      sy += Math.cos(a)
      const torso = Math.max(segmentLength(frame, 'torso'), 1e-6)
      lengthSum += segmentLength(frame, name) / torso / SEGMENT_LENGTH[name]
    }
    const angle = Math.round((Math.atan2(sx, sy) * 180) / Math.PI)
    const length = Math.round(Math.min(1, lengthSum / frames.length) * 100) / 100
    out[name] = name === 'torso' || length >= 0.9 ? { angle } : { angle, length }
  }
  return out
}

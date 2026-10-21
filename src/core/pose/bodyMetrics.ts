import { LM } from './landmarks'
import type { Landmark, PoseFrame } from './types'

export interface Point {
  x: number
  y: number
}

export const METRIC_VISIBILITY = 0.5

const HEAD_LANDMARKS = [LM.nose, LM.leftEye, LM.rightEye, LM.leftEar, LM.rightEar]

const visible = (lm: Landmark) => lm.visibility >= METRIC_VISIBILITY

/**
 * Mean of the visible face landmarks (nose, eyes, ears). More stable than the nose
 * alone, which jumps around when the head turns.
 */
export function headPoint(frame: PoseFrame): Point | null {
  let x = 0
  let y = 0
  let n = 0
  for (const i of HEAD_LANDMARKS) {
    const lm = frame.landmarks[i]
    if (!visible(lm)) continue
    x += lm.x
    y += lm.y
    n++
  }
  return n === 0 ? null : { x: x / n, y: y / n }
}

function midpoint(frame: PoseFrame, a: number, b: number): Point | null {
  const la = frame.landmarks[a]
  const lb = frame.landmarks[b]
  if (!visible(la) || !visible(lb)) return null
  return { x: (la.x + lb.x) / 2, y: (la.y + lb.y) / 2 }
}

export function hipMid(frame: PoseFrame): Point | null {
  return midpoint(frame, LM.leftHip, LM.rightHip)
}

export function shoulderMid(frame: PoseFrame): Point | null {
  return midpoint(frame, LM.leftShoulder, LM.rightShoulder)
}

/** Shoulder-to-hip distance in image-height units (x is corrected for the image aspect). */
export function torsoLength(frame: PoseFrame): number | null {
  const s = shoulderMid(frame)
  const h = hipMid(frame)
  if (!s || !h) return null
  const aspect = frame.imageHeight > 0 ? frame.imageWidth / frame.imageHeight : 1
  return Math.hypot((s.x - h.x) * aspect, s.y - h.y)
}

/** Horizontal shoulder span in normalized (canonical) x units. */
export function shoulderWidth(frame: PoseFrame): number | null {
  const l = frame.landmarks[LM.leftShoulder]
  const r = frame.landmarks[LM.rightShoulder]
  if (!visible(l) || !visible(r)) return null
  return Math.abs(l.x - r.x)
}

/** Both wrists, or null if either is not visible. */
export function wrists(frame: PoseFrame): [Point, Point] | null {
  const l = frame.landmarks[LM.leftWrist]
  const r = frame.landmarks[LM.rightWrist]
  if (!visible(l) || !visible(r)) return null
  return [
    { x: l.x, y: l.y },
    { x: r.x, y: r.y },
  ]
}

export function landmarksVisible(frame: PoseFrame, indices: readonly number[]): boolean {
  return indices.every((i) => visible(frame.landmarks[i]))
}

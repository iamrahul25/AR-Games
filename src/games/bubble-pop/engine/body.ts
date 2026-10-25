import { checkFraming, VISIBILITY_THRESHOLD, type FramingResult } from '@/core/pose/framing'
import { LM } from '@/core/pose/landmarks'
import type { Landmark, PoseFrame } from '@/core/pose/types'

export type PopperKind = 'hand' | 'foot'

/** A body point that pops bubbles, in canonical normalized coordinates. */
export interface Popper {
  id: 'leftHand' | 'rightHand' | 'leftFoot' | 'rightFoot'
  kind: PopperKind
  x: number
  y: number
}

/** Popper radius in normalized image-height units. */
export const POPPER_RADIUS: Record<PopperKind, number> = { hand: 0.035, foot: 0.04 }

/** Where the player is: everything bubble placement needs, in normalized coordinates. */
export interface BodyAnchor {
  shoulderX: number
  shoulderY: number
  hipX: number
  hipY: number
  /** Lowest ankle. */
  groundY: number
  /** Shoulder-to-hip distance in image-height units. */
  torso: number
  /** Image width / height. */
  aspect: number
}

const visible = (l: Landmark | undefined) => !!l && l.visibility >= VISIBILITY_THRESHOLD

function average(points: Landmark[]): { x: number; y: number } {
  let x = 0
  let y = 0
  for (const p of points) {
    x += p.x
    y += p.y
  }
  return { x: x / points.length, y: y / points.length }
}

export function readPoppers(frame: PoseFrame | null, withFeet: boolean): Popper[] {
  if (!frame) return []
  const l = frame.landmarks
  const out: Popper[] = []
  const hand = (id: Popper['id'], wrist: number, index: number, pinky: number) => {
    if (!visible(l[wrist])) return
    const palm = average([l[wrist], l[index], l[pinky]].filter(visible))
    out.push({ id, kind: 'hand', ...palm })
  }
  hand('leftHand', LM.leftWrist, LM.leftIndex, LM.leftPinky)
  hand('rightHand', LM.rightWrist, LM.rightIndex, LM.rightPinky)
  if (withFeet) {
    const foot = (id: Popper['id'], ankle: number, toe: number) => {
      if (!visible(l[ankle])) return
      out.push({ id, kind: 'foot', ...average([l[ankle], l[toe]].filter(visible)) })
    }
    foot('leftFoot', LM.leftAnkle, LM.leftFootIndex)
    foot('rightFoot', LM.rightAnkle, LM.rightFootIndex)
  }
  return out
}

export function readAnchor(frame: PoseFrame | null): BodyAnchor | null {
  if (!frame || frame.imageHeight <= 0) return null
  const l = frame.landmarks
  const core = [l[LM.leftShoulder], l[LM.rightShoulder], l[LM.leftHip], l[LM.rightHip]]
  if (!core.every(visible)) return null
  const aspect = frame.imageWidth / frame.imageHeight
  const shoulder = average([core[0], core[1]])
  const hip = average([core[2], core[3]])
  const torso = Math.hypot((shoulder.x - hip.x) * aspect, shoulder.y - hip.y)
  if (torso < 0.03) return null
  const ankles = [l[LM.leftAnkle], l[LM.rightAnkle]].filter(visible)
  // Without visible ankles, assume average proportions (legs ≈ 1.7 torso lengths).
  const groundY = ankles.length ? Math.max(...ankles.map((a) => a.y)) : hip.y + torso * 1.7
  return { shoulderX: shoulder.x, shoulderY: shoulder.y, hipX: hip.x, hipY: hip.y, groundY, torso, aspect }
}

/**
 * Hands-only modes just need the upper body and both hands in view, so players can stand
 * closer than the full-body check allows. Modes with feet use the full-body check.
 */
export function checkReadiness(frame: PoseFrame | null, needsFeet: boolean): FramingResult {
  const full = checkFraming(frame)
  if (needsFeet || full.ok || !frame) return full
  if (full.issue !== 'step-back' && full.issue !== 'too-close') return full

  const l = frame.landmarks
  const needed = [LM.nose, LM.leftShoulder, LM.rightShoulder, LM.leftWrist, LM.rightWrist, LM.leftHip, LM.rightHip]
  const inView = needed.every((i) => visible(l[i]) && l[i].x > 0.01 && l[i].x < 0.99 && l[i].y > 0.01 && l[i].y < 0.99)
  if (!inView) return { ok: false, issue: 'step-back', message: 'Step back so your head and both hands are in view' }

  const centerX = (l[LM.leftHip].x + l[LM.rightHip].x) / 2
  if (centerX < 0.25) return { ok: false, issue: 'move-right', message: 'Move a little to your right' }
  if (centerX > 0.75) return { ok: false, issue: 'move-left', message: 'Move a little to your left' }
  return { ok: true, message: 'Great! Hold still…' }
}

/** Distance from point p to segment a→b (all in the same units). */
export function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax
  const vy = by - ay
  const len2 = vx * vx + vy * vy
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / len2)) : 0
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t))
}

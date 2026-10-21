import { FULL_BODY_LANDMARKS, LM } from './landmarks'
import type { PoseFrame } from './types'

export type FramingIssue =
  | 'no-person'
  | 'step-back'
  | 'too-close'
  | 'move-left'
  | 'move-right'

export interface FramingResult {
  ok: boolean
  issue?: FramingIssue
  message: string
}

export const VISIBILITY_THRESHOLD = 0.5

const MESSAGES: Record<FramingIssue | 'ok', string> = {
  ok: 'Great! Hold still…',
  'no-person': 'Step into view of the camera',
  'step-back': 'Step back so your whole body is visible',
  'too-close': "You're too close — step back a little",
  'move-left': 'Move a little to your left',
  'move-right': 'Move a little to your right',
}

/**
 * Checks that the whole body is inside the frame and roughly centered.
 * Expects a canonical (mirror-view) frame: the user's right is the image's right.
 */
export function checkFraming(frame: PoseFrame | null): FramingResult {
  if (!frame) return issue('no-person')
  const lms = frame.landmarks
  const upperVisible = [LM.leftShoulder, LM.rightShoulder, LM.leftHip, LM.rightHip].every(
    (i) => lms[i].visibility >= VISIBILITY_THRESHOLD,
  )
  if (!upperVisible) return issue('no-person')

  const allVisible = FULL_BODY_LANDMARKS.every(
    (i) => lms[i].visibility >= VISIBILITY_THRESHOLD && inside(lms[i].x, lms[i].y),
  )
  if (!allVisible) return issue('step-back')

  const ys = [LM.nose, LM.leftAnkle, LM.rightAnkle].map((i) => lms[i].y)
  const height = Math.max(...ys) - Math.min(...ys)
  if (height > 0.92) return issue('too-close')

  const centerX = (lms[LM.leftHip].x + lms[LM.rightHip].x) / 2
  if (centerX < 0.25) return issue('move-right')
  if (centerX > 0.75) return issue('move-left')

  return { ok: true, message: MESSAGES.ok }
}

function inside(x: number, y: number) {
  return x >= 0.01 && x <= 0.99 && y >= 0.01 && y <= 0.99
}

function issue(kind: FramingIssue): FramingResult {
  return { ok: false, issue: kind, message: MESSAGES[kind] }
}

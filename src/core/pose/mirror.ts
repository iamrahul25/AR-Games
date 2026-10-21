import { MIRROR_INDEX } from './landmarks'
import type { Landmark, PoseFrame } from './types'

/** Swaps left/right landmark labels (positions are unchanged). */
export function swapLeftRight(landmarks: Landmark[]): Landmark[] {
  return landmarks.map((_, i) => landmarks[MIRROR_INDEX[i]])
}

/** Flips the image horizontally (labels are unchanged). */
export function flipX(landmarks: Landmark[]): Landmark[] {
  return landmarks.map((lm) => ({ ...lm, x: 1 - lm.x }))
}

/**
 * Converts a pose detected on a non-mirrored (back camera) preview into canonical
 * mirror-view space, so pose definitions work the same for both cameras.
 */
export function toCanonical(frame: PoseFrame, previewMirrored: boolean): PoseFrame {
  if (previewMirrored) return frame
  return { ...frame, landmarks: flipX(frame.landmarks) }
}

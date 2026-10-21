import { angleDelta, normalizeAngle, type SegmentName } from '@/core/pose/geometry'
import type { ConstraintResult, MatchResult } from '../types'

const UPPER_OF: Partial<Record<SegmentName, SegmentName>> = {
  leftForearm: 'leftUpperArm',
  rightForearm: 'rightUpperArm',
  leftShin: 'leftThigh',
  rightShin: 'rightThigh',
}

/** 180 = pointing straight up, 0 = straight down. */
function upness(angle: number): number {
  return 180 - Math.abs(normalizeAngle(angle))
}

/** How far a limb points away from the body's midline (positive = outward). */
function outwardness(segment: SegmentName, angle: number): number {
  const s = Math.sin((angle * Math.PI) / 180)
  return segment.startsWith('left') ? -s : s
}

function side(segment: SegmentName): 'left' | 'right' {
  return segment.startsWith('left') ? 'left' : 'right'
}

function isArm(segment: SegmentName) {
  return segment.includes('Arm') || segment.includes('Forearm')
}

/** Turns the worst mismatch into a short, spoken-friendly coaching cue. */
export function coachingCue(result: MatchResult): string | null {
  const worst = result.worst
  if (!worst) return null
  if (worst.kind === 'length') return lengthCue(worst)

  const { segment, measured, target } = worst
  if (segment === 'torso') return torsoCue(measured, target)
  if (segment === 'head') return 'Keep your head in line with your body'

  const s = side(segment)
  const arm = isArm(segment)
  const limb = arm ? `${s} arm` : `${s} leg`
  const upperSegment = UPPER_OF[segment]

  if (upperSegment) {
    const upper = result.constraints.find((c) => c.kind === 'direction' && c.segment === upperSegment)
    if (upper && upper.score !== null) {
      const bendMeasured = angleDelta(upper.measured, measured)
      const bendTarget = angleDelta(upper.target, target)
      if (bendTarget > bendMeasured + 20) return arm ? `Bend your ${s} elbow more` : `Bend your ${s} knee more`
      if (bendTarget < bendMeasured - 20) return `Straighten your ${limb}`
    }
    const up = upness(target) - upness(measured)
    if (up > 20) return arm ? `Raise your ${s} hand higher` : `Lift your ${s} foot higher`
    if (up < -20) return arm ? `Lower your ${s} hand` : `Lower your ${s} foot`
    return arm ? `Adjust your ${s} hand` : `Adjust your ${s} foot`
  }

  const up = upness(target) - upness(measured)
  if (up > 20) return arm ? `Raise your ${limb} higher` : `Lift your ${limb} higher`
  if (up < -20) return `Lower your ${limb}`
  const out = outwardness(segment, target) - outwardness(segment, measured)
  if (out > 0.25) return arm ? `Move your ${limb} further out to the side` : `Step your ${s} foot wider`
  if (out < -0.25) return arm ? `Bring your ${limb} closer to your body` : `Bring your ${limb} in`
  return `Adjust your ${limb}`
}

function torsoCue(measured: number, target: number): string {
  const targetUp = upness(target)
  const measuredUp = upness(measured)
  if (targetUp < 40) return 'Get your hips up over your shoulders'
  if (targetUp > 150) {
    return measuredUp < targetUp - 10 ? 'Stand up straight' : 'Keep your body upright'
  }
  if (measuredUp > targetUp + 20) return 'Lean your body forward more'
  if (measuredUp < targetUp - 20) return 'Lift your chest up a little'
  return normalizeAngle(target) < 0 ? 'Lean further to your left' : 'Lean further to your right'
}

function lengthCue(c: ConstraintResult): string {
  return c.measured > c.target ? 'Bend your knees and sink lower' : 'Rise up a little'
}

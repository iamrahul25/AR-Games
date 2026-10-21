import {
  angleDelta,
  normalizeAngle,
  SEGMENT_NAMES,
  SEGMENTS,
  segmentAngle,
  segmentLength,
  segmentVisibility,
  type SegmentName,
} from '@/core/pose/geometry'
import { BODY_PROPORTIONS, NEUTRAL_SKELETON } from '@/core/pose/skeleton'
import { BODY_PARTS, type BodyPart, type PartStatus, type PoseFrame } from '@/core/pose/types'
import type { ConstraintKind, ConstraintResult, MatchResult, PartResult, PoseDefinition } from '../types'

export interface CompiledConstraint {
  kind: ConstraintKind
  segment: SegmentName
  part: BodyPart
  /** Degrees for `direction`, segment/torso length ratio for `length`. */
  target: number
  /** Degrees for `direction`, relative error for `length`. */
  tol: number
  weight: number
  /** Defines the pose (differs from standing); a badly-missed key segment caps the score. */
  key: boolean
}

export interface CompiledPose {
  id: string
  /** Alternative constraint sets; the best-matching one wins. */
  variants: CompiledConstraint[][]
}

const DEFAULT_TOL: Record<SegmentName, number> = {
  torso: 18,
  head: 40,
  leftUpperArm: 25,
  rightUpperArm: 25,
  leftForearm: 30,
  rightForearm: 30,
  leftThigh: 22,
  rightThigh: 22,
  leftShin: 25,
  rightShin: 25,
}

const DEFAULT_WEIGHT: Record<SegmentName, number> = {
  torso: 1.5,
  head: 0.3,
  leftUpperArm: 1,
  rightUpperArm: 1,
  leftForearm: 0.8,
  rightForearm: 0.8,
  leftThigh: 1.2,
  rightThigh: 1.2,
  leftShin: 1,
  rightShin: 1,
}

const FULL_LENGTH: Record<SegmentName, number> = {
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

/** Below this projected length factor a segment points at the camera and its 2D direction is unreliable. */
const FORESHORTENED = 0.6
const LENGTH_TOL = 0.3
const VISIBILITY = 0.5
/**
 * Segments that differ from just standing define the pose, so they weigh more.
 * Without this, a pose that only moves one arm would be "matched" by standing still.
 */
const KEY_SEGMENT_DEG = 30
const KEY_WEIGHT = 2.5
/** Score ceiling when the weakest key segment scores 0 (rises linearly to 1). */
const KEY_CAP_BASE = 0.4

export function compilePose(def: PoseDefinition): CompiledPose {
  const base: CompiledConstraint[] = []
  for (const segment of SEGMENT_NAMES) {
    const override = def.checks?.[segment]
    if (override === false) continue
    const spec = def.skeleton[segment]
    const lengthFactor = spec.length ?? 1
    const foreshortened = lengthFactor < FORESHORTENED
    const isKeyDirection = angleDelta(spec.angle, NEUTRAL_SKELETON[segment].angle) > KEY_SEGMENT_DEG
    base.push({
      kind: 'direction',
      segment,
      part: SEGMENTS[segment].part,
      target: spec.angle,
      tol: override?.tol ?? (foreshortened ? 45 : DEFAULT_TOL[segment]),
      weight:
        (override?.weight ?? DEFAULT_WEIGHT[segment]) *
        (foreshortened ? 0.3 : 1) *
        (isKeyDirection && !foreshortened ? KEY_WEIGHT : 1),
      key: isKeyDirection && !foreshortened,
    })
    if (lengthFactor < 0.9 && segment !== 'torso') {
      base.push({
        kind: 'length',
        segment,
        part: SEGMENTS[segment].part,
        target: (FULL_LENGTH[segment] * lengthFactor) / BODY_PROPORTIONS.torso,
        tol: LENGTH_TOL,
        weight: 1.2 * KEY_WEIGHT,
        key: true,
      })
    }
  }

  const variants = [base]
  if (def.orientationFree) {
    variants.push(base.map(flipConstraint))
    variants.push(base.map(swapConstraint))
    variants.push(base.map((c) => flipConstraint(swapConstraint(c))))
  }
  return { id: def.id, variants }
}

function flipConstraint(c: CompiledConstraint): CompiledConstraint {
  return c.kind === 'direction' ? { ...c, target: normalizeAngle(-c.target) } : c
}

function swapConstraint(c: CompiledConstraint): CompiledConstraint {
  const segment = SEGMENTS[c.segment].mirror
  return { ...c, segment, part: SEGMENTS[segment].part }
}

/** Linear falloff: 1 inside the tolerance, 0 at twice the tolerance. */
export function scoreDeviation(deviation: number, tol: number): number {
  if (deviation <= tol) return 1
  if (deviation >= tol * 2) return 0
  return 1 - (deviation - tol) / tol
}

export function partStatusFromScore(score: number | null): PartStatus {
  if (score === null) return 'unknown'
  if (score >= 0.85) return 'good'
  if (score >= 0.4) return 'close'
  return 'bad'
}

function evaluate(
  constraints: CompiledConstraint[],
  frame: PoseFrame,
  toleranceScale: number,
): MatchResult {
  const torsoLength = segmentLength(frame, 'torso')
  const torsoVisible = segmentVisibility(frame, 'torso') >= VISIBILITY && torsoLength > 0

  const results: ConstraintResult[] = constraints.map((c) => {
    const visible =
      segmentVisibility(frame, c.segment) >= VISIBILITY && (c.kind === 'direction' || torsoVisible)
    if (!visible) {
      return { kind: c.kind, segment: c.segment, part: c.part, weight: c.weight, score: null, measured: 0, target: c.target }
    }
    if (c.kind === 'direction') {
      const measured = segmentAngle(frame, c.segment)
      const score = scoreDeviation(angleDelta(measured, c.target), c.tol * toleranceScale)
      return { kind: c.kind, segment: c.segment, part: c.part, weight: c.weight, score, measured, target: c.target }
    }
    const measured = segmentLength(frame, c.segment) / torsoLength
    const deviation = Math.abs(measured / c.target - 1)
    const score = scoreDeviation(deviation, c.tol * toleranceScale)
    return { kind: c.kind, segment: c.segment, part: c.part, weight: c.weight, score, measured, target: c.target }
  })

  let totalWeight = 0
  let knownWeight = 0
  let weighted = 0
  let weakestKey = 1
  results.forEach((r, i) => {
    totalWeight += r.weight
    if (r.score === null) return
    knownWeight += r.weight
    weighted += r.weight * r.score
    if (constraints[i].key) weakestKey = Math.min(weakestKey, r.score)
  })
  const coverage = totalWeight > 0 ? knownWeight / totalWeight : 0
  const mean = knownWeight > 0 ? weighted / knownWeight : 0
  const covered = coverage >= 0.7 ? mean : mean * (coverage / 0.7)
  const score = Math.min(covered, KEY_CAP_BASE + (1 - KEY_CAP_BASE) * weakestKey)

  const parts = {} as Record<BodyPart, PartResult>
  for (const part of BODY_PARTS) {
    const scores = results.filter((r) => r.part === part && r.score !== null).map((r) => r.score as number)
    const partScore = scores.length > 0 ? Math.min(...scores) : null
    parts[part] = { status: partStatusFromScore(partScore), score: partScore ?? 0 }
  }

  let worst: ConstraintResult | null = null
  for (const r of results) {
    if (r.score === null || r.score >= 0.85) continue
    if (!worst || r.score < (worst.score ?? 1) || (r.score === worst.score && r.weight > worst.weight)) {
      worst = r
    }
  }

  return { score, coverage, parts, constraints: results, worst }
}

/** Scores how well a canonical-space pose frame matches the target pose. */
export function matchPose(pose: CompiledPose, frame: PoseFrame, toleranceScale = 1): MatchResult {
  let best: MatchResult | null = null
  for (const variant of pose.variants) {
    const result = evaluate(variant, frame, toleranceScale)
    if (!best || result.score > best.score) best = result
  }
  return best!
}

export function emptyMatchResult(): MatchResult {
  const parts = {} as Record<BodyPart, PartResult>
  for (const part of BODY_PARTS) parts[part] = { status: 'unknown', score: 0 }
  return { score: 0, coverage: 0, parts, constraints: [], worst: null }
}

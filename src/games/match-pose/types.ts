import type { SegmentName } from '@/core/pose/geometry'
import type { PoseView, SegmentSpec, SkeletonSpec } from '@/core/pose/skeleton'
import type { BodyPart, PartStatus } from '@/core/pose/types'

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert'

export interface SegmentCheckOverride {
  /** Allowed deviation in degrees before the score starts dropping. */
  tol?: number
  weight?: number
}

/**
 * A pose is described by the direction of each body segment (see {@linkcode SkeletonSpec}).
 * The same data drives the matcher, the stick-figure illustration and the simulated player.
 */
export interface PoseDefinition {
  id: string
  name: string
  difficulty: Difficulty
  /** Which way the player faces the camera. */
  view: PoseView
  /** Short instruction shown under the pose name. */
  instruction: string
  skeleton: SkeletonSpec
  /**
   * Accept the pose facing either direction and with either side leading
   * (for side-view and floor poses where left/right is ambiguous).
   */
  orientationFree?: boolean
  /** Per-segment overrides; `false` disables checking that segment. */
  checks?: Partial<Record<SegmentName, SegmentCheckOverride | false>>
  /** Show the safety screen before levels containing this pose. */
  safety?: boolean
}

export interface PoseTemplate extends Omit<PoseDefinition, 'skeleton' | 'id' | 'name'> {
  id: string
  name: string
  skeleton: Partial<Record<SegmentName, SegmentSpec | number>>
  /** Generate `-left` and `-right` variants (the template describes the LEFT one). */
  sided?: boolean
}

export interface LevelDefinition {
  id: number
  tier: Difficulty
  title: string
  poses: string[]
  holdSeconds: number
  timeLimitSeconds: number
  matchThreshold: number
  toleranceScale: number
  holdBreakBehavior: 'pause' | 'reset'
  /** Fraction of poses that must be matched to pass (earn 1 star). */
  passRatio: number
  /** Attempt level: the single pose may be tried this many times; the level ends on the first success. */
  attempts?: number
  isBoss?: boolean
  safetyWarning?: boolean
}

export interface PartResult {
  status: PartStatus
  score: number
}

export type ConstraintKind = 'direction' | 'length'

export interface ConstraintResult {
  kind: ConstraintKind
  segment: SegmentName
  part: BodyPart
  weight: number
  /** null when the segment is not visible. */
  score: number | null
  measured: number
  target: number
}

export interface MatchResult {
  /** Overall match 0..1. */
  score: number
  /** Fraction (by weight) of the pose that was visible. */
  coverage: number
  parts: Record<BodyPart, PartResult>
  constraints: ConstraintResult[]
  /** Worst visible constraint, used for coaching cues. */
  worst: ConstraintResult | null
}

export type PoseRating = 'perfect' | 'great' | 'good' | 'miss'

export interface PoseOutcome {
  poseId: string
  matched: boolean
  accuracy: number
  points: number
  rating: PoseRating
  timeUsedMs: number
}

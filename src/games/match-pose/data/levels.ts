import type { Difficulty, LevelDefinition } from '../types'
import { getPose, posesByDifficulty } from './poses'

/** Deterministic shuffle so "random" levels are the same every time a player opens them. */
function seededPick(ids: string[], count: number, seed: number): string[] {
  const arr = [...ids]
  let s = seed * 9301 + 49297
  const rand = () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.slice(0, count)
}

const pool = (tier: Difficulty) => posesByDifficulty(tier).map((p) => p.id)

type LevelInput = Omit<LevelDefinition, 'passRatio' | 'title'> & { title?: string; passRatio?: number }

const TIER_TITLES: Record<Difficulty, string> = {
  easy: 'Warm Up',
  medium: 'Balance',
  hard: 'Strength',
  expert: 'Master',
}

function level(input: LevelInput): LevelDefinition {
  return {
    passRatio: 0.6,
    title: input.isBoss ? `${TIER_TITLES[input.tier]} Boss` : TIER_TITLES[input.tier],
    ...input,
  }
}

export const LEVELS: LevelDefinition[] = [
  // ───────────── Easy ─────────────
  level({ id: 1, tier: 'easy', poses: ['arms-up', 't-pose', 'hands-on-hips'], holdSeconds: 2, timeLimitSeconds: 12, matchThreshold: 0.75, toleranceScale: 1.3, holdBreakBehavior: 'pause' }),
  level({ id: 2, tier: 'easy', poses: ['t-pose', 'star', 'arms-up', 'goal-post'], holdSeconds: 2, timeLimitSeconds: 12, matchThreshold: 0.75, toleranceScale: 1.3, holdBreakBehavior: 'pause' }),
  level({ id: 3, tier: 'easy', poses: ['side-stretch-left', 'side-stretch-right', 'reach-up-left', 'star'], holdSeconds: 3, timeLimitSeconds: 12, matchThreshold: 0.75, toleranceScale: 1.25, holdBreakBehavior: 'pause' }),
  level({ id: 4, tier: 'easy', poses: ['half-squat', 'arms-up', 't-pose', 'hands-on-hips'], holdSeconds: 3, timeLimitSeconds: 10, matchThreshold: 0.76, toleranceScale: 1.25, holdBreakBehavior: 'pause' }),
  level({ id: 5, tier: 'easy', poses: ['knee-lift-left', 'knee-lift-right', 'star', 'goal-post'], holdSeconds: 3, timeLimitSeconds: 10, matchThreshold: 0.77, toleranceScale: 1.2, holdBreakBehavior: 'pause' }),
  level({ id: 6, tier: 'easy', poses: seededPick(pool('easy'), 5, 6), holdSeconds: 3, timeLimitSeconds: 10, matchThreshold: 0.78, toleranceScale: 1.2, holdBreakBehavior: 'pause' }),
  level({ id: 7, tier: 'easy', poses: ['half-squat', 'knee-lift-left', 'knee-lift-right', 'side-stretch-left', 'side-stretch-right'], holdSeconds: 4, timeLimitSeconds: 10, matchThreshold: 0.78, toleranceScale: 1.15, holdBreakBehavior: 'pause' }),
  level({ id: 8, tier: 'easy', poses: seededPick(pool('easy'), 6, 8), holdSeconds: 4, timeLimitSeconds: 9, matchThreshold: 0.78, toleranceScale: 1.1, holdBreakBehavior: 'pause' }),
  level({ id: 9, tier: 'easy', poses: seededPick(pool('easy'), 6, 9), holdSeconds: 4, timeLimitSeconds: 8, matchThreshold: 0.8, toleranceScale: 1.1, holdBreakBehavior: 'pause' }),
  level({ id: 10, tier: 'easy', isBoss: true, poses: seededPick(pool('easy'), 10, 10), holdSeconds: 3, timeLimitSeconds: 8, matchThreshold: 0.8, toleranceScale: 1.0, holdBreakBehavior: 'pause' }),

  // ───────────── Medium ─────────────
  level({ id: 11, tier: 'medium', poses: ['full-squat', 'chair', 'half-squat', 'arms-up'], holdSeconds: 4, timeLimitSeconds: 12, matchThreshold: 0.8, toleranceScale: 1.1, holdBreakBehavior: 'pause' }),
  level({ id: 12, tier: 'medium', poses: ['forward-lunge', 'star', 't-pose', 'forward-lunge'], holdSeconds: 4, timeLimitSeconds: 12, matchThreshold: 0.8, toleranceScale: 1.1, holdBreakBehavior: 'pause' }),
  level({ id: 13, tier: 'medium', poses: ['warrior-2-left', 'warrior-2-right', 'goddess', 'chair'], holdSeconds: 5, timeLimitSeconds: 12, matchThreshold: 0.8, toleranceScale: 1.05, holdBreakBehavior: 'pause' }),
  level({ id: 14, tier: 'medium', poses: ['tree-left', 'tree-right', 'knee-lift-left', 'knee-lift-right'], holdSeconds: 5, timeLimitSeconds: 12, matchThreshold: 0.8, toleranceScale: 1.05, holdBreakBehavior: 'pause' }),
  level({ id: 15, tier: 'medium', poses: ['warrior-1-left', 'warrior-1-right', 'forward-lunge', 'warrior-2-left'], holdSeconds: 5, timeLimitSeconds: 11, matchThreshold: 0.82, toleranceScale: 1.0, holdBreakBehavior: 'reset' }),
  level({ id: 16, tier: 'medium', poses: seededPick(pool('medium'), 5, 16), holdSeconds: 5, timeLimitSeconds: 11, matchThreshold: 0.82, toleranceScale: 1.0, holdBreakBehavior: 'reset' }),
  level({ id: 17, tier: 'medium', poses: ['high-plank', 'full-squat', 'chair', 'goddess'], holdSeconds: 6, timeLimitSeconds: 12, matchThreshold: 0.82, toleranceScale: 1.0, holdBreakBehavior: 'reset' }),
  level({ id: 18, tier: 'medium', poses: ['tree-left', 'tree-right', 'warrior-2-left', 'warrior-2-right', 'chair'], holdSeconds: 6, timeLimitSeconds: 10, matchThreshold: 0.83, toleranceScale: 0.95, holdBreakBehavior: 'reset' }),
  level({ id: 19, tier: 'medium', poses: seededPick(pool('medium'), 6, 19), holdSeconds: 6, timeLimitSeconds: 10, matchThreshold: 0.84, toleranceScale: 0.95, holdBreakBehavior: 'reset' }),
  level({ id: 20, tier: 'medium', isBoss: true, poses: ['full-squat', 'chair', 'warrior-2-left', 'tree-left', 'warrior-2-right', 'tree-right', 'high-plank'], holdSeconds: 5, timeLimitSeconds: 10, matchThreshold: 0.84, toleranceScale: 0.95, holdBreakBehavior: 'reset' }),

  // ───────────── Hard ─────────────
  level({ id: 21, tier: 'hard', poses: ['warrior-3', 'tree-left', 'warrior-3', 'tree-right'], holdSeconds: 5, timeLimitSeconds: 14, matchThreshold: 0.84, toleranceScale: 0.95, holdBreakBehavior: 'reset', safetyWarning: true }),
  level({ id: 22, tier: 'hard', poses: ['side-plank', 'high-plank', 'side-plank'], holdSeconds: 6, timeLimitSeconds: 14, matchThreshold: 0.84, toleranceScale: 0.95, holdBreakBehavior: 'reset', safetyWarning: true }),
  level({ id: 23, tier: 'hard', poses: ['dancer', 'warrior-3', 'dancer', 'warrior-3'], holdSeconds: 6, timeLimitSeconds: 14, matchThreshold: 0.85, toleranceScale: 0.9, holdBreakBehavior: 'reset', safetyWarning: true }),
  level({ id: 24, tier: 'hard', poses: ['boat', 'downward-dog', 'high-plank'], holdSeconds: 8, timeLimitSeconds: 14, matchThreshold: 0.85, toleranceScale: 0.9, holdBreakBehavior: 'reset', safetyWarning: true }),
  level({ id: 25, tier: 'hard', poses: ['crescent-lunge', 'half-moon-left', 'half-moon-right', 'warrior-1-left'], holdSeconds: 8, timeLimitSeconds: 12, matchThreshold: 0.86, toleranceScale: 0.9, holdBreakBehavior: 'reset', safetyWarning: true }),
  level({ id: 26, tier: 'hard', poses: seededPick(pool('hard'), 5, 26), holdSeconds: 8, timeLimitSeconds: 12, matchThreshold: 0.86, toleranceScale: 0.85, holdBreakBehavior: 'reset', safetyWarning: true }),
  level({ id: 27, tier: 'hard', isBoss: true, poses: ['tree-left', 'warrior-3', 'dancer', 'half-moon-left', 'tree-right', 'warrior-3', 'dancer', 'half-moon-right'], holdSeconds: 6, timeLimitSeconds: 12, matchThreshold: 0.86, toleranceScale: 0.85, holdBreakBehavior: 'reset', safetyWarning: true }),

  // ───────────── Expert (single-pose levels give 3 attempts) ─────────────
  level({ id: 28, tier: 'expert', poses: ['crow'], attempts: 3, holdSeconds: 3, timeLimitSeconds: 20, matchThreshold: 0.82, toleranceScale: 0.9, holdBreakBehavior: 'reset', safetyWarning: true }),
  level({ id: 29, tier: 'expert', poses: ['handstand'], attempts: 3, holdSeconds: 5, timeLimitSeconds: 25, matchThreshold: 0.8, toleranceScale: 1.0, holdBreakBehavior: 'reset', safetyWarning: true }),
  level({ id: 30, tier: 'expert', isBoss: true, title: 'Grand Finale', poses: ['full-squat', 'warrior-3', 'side-plank', 'crow', 'handstand'], holdSeconds: 5, timeLimitSeconds: 20, matchThreshold: 0.85, toleranceScale: 0.85, holdBreakBehavior: 'reset', safetyWarning: true }),
]

export const LEVELS_BY_ID: Record<number, LevelDefinition> = Object.fromEntries(LEVELS.map((l) => [l.id, l]))

export function getLevel(id: number): LevelDefinition | undefined {
  return LEVELS_BY_ID[id]
}

export function levelPoses(level: LevelDefinition) {
  return level.poses.map(getPose)
}

export function levelNeedsSafetyScreen(level: LevelDefinition): boolean {
  return !!level.safetyWarning || levelPoses(level).some((p) => p.safety)
}

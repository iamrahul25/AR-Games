import type { Difficulty, PoseOutcome, PoseRating } from '../types'

const DIFFICULTY_MULTIPLIER: Record<Difficulty, number> = {
  easy: 1,
  medium: 1.5,
  hard: 2,
  expert: 3,
}

export function ratingForAccuracy(accuracy: number): Exclude<PoseRating, 'miss'> {
  if (accuracy >= 0.95) return 'perfect'
  if (accuracy >= 0.88) return 'great'
  return 'good'
}

export const RATING_LABELS: Record<PoseRating, string> = {
  perfect: 'Perfect!',
  great: 'Great!',
  good: 'Good!',
  miss: 'Missed',
}

export function posePoints(accuracy: number, difficulty: Difficulty, timeLeftMs: number, timeLimitMs: number): number {
  const base = 100 * accuracy * DIFFICULTY_MULTIPLIER[difficulty]
  const timeBonus = 50 * Math.max(0, Math.min(1, timeLeftMs / timeLimitMs))
  return Math.round(base + timeBonus)
}

export interface LevelSummary {
  score: number
  stars: 0 | 1 | 2 | 3
  matched: number
  total: number
  averageAccuracy: number
  passed: boolean
}

export function summarizeLevel(outcomes: PoseOutcome[], passRatio: number): LevelSummary {
  const total = outcomes.length
  const matchedOutcomes = outcomes.filter((o) => o.matched)
  const matched = matchedOutcomes.length
  const score = outcomes.reduce((sum, o) => sum + o.points, 0)
  const averageAccuracy =
    matched > 0 ? matchedOutcomes.reduce((sum, o) => sum + o.accuracy, 0) / matched : 0
  const passed = total > 0 && matched / total >= passRatio - 1e-9
  let stars: LevelSummary['stars'] = 0
  if (passed) stars = 1
  if (passed && matched === total) stars = 2
  if (passed && matched === total && averageAccuracy >= 0.9) stars = 3
  return { score, stars, matched, total, averageAccuracy, passed }
}

/**
 * Attempt levels (one hard pose, several tries): pass on the first success.
 * Stars depend on how many tries it took.
 */
export function summarizeAttempts(outcomes: PoseOutcome[]): LevelSummary {
  const successIndex = outcomes.findIndex((o) => o.matched)
  const passed = successIndex >= 0
  const score = outcomes.reduce((sum, o) => sum + o.points, 0)
  const stars = (passed ? Math.max(1, 3 - successIndex) : 0) as LevelSummary['stars']
  return {
    score,
    stars,
    matched: passed ? 1 : 0,
    total: 1,
    averageAccuracy: passed ? outcomes[successIndex].accuracy : 0,
    passed,
  }
}

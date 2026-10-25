import { COMBO_STEPS, type BubbleModeConfig, type BubbleModeId } from '../config/modes'

export function comboMultiplier(combo: number): number {
  if (combo >= COMBO_STEPS[1]) return 3
  if (combo >= COMBO_STEPS[0]) return 2
  return 1
}

export function starsForScore(score: number, mode: BubbleModeConfig): number {
  return mode.stars.filter((t) => score >= t).length
}

export interface RoundStats {
  popped: number
  golden: number
  missed: number
  bombs: number
  bestCombo: number
}

export interface RoundSummary extends RoundStats {
  mode: BubbleModeId
  score: number
  stars: number
  /** Popped / (popped + missed), 0..1. */
  accuracy: number
}

export function summarize(mode: BubbleModeConfig, score: number, stats: RoundStats): RoundSummary {
  const attempts = stats.popped + stats.missed
  return {
    ...stats,
    mode: mode.id,
    score,
    stars: starsForScore(score, mode),
    accuracy: attempts > 0 ? stats.popped / attempts : 0,
  }
}

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { kvStorage } from '@/core/storage/kv'
import { LEVELS } from '../data/levels'
import type { LevelSummary } from '../engine/scoring'
import type { PoseOutcome } from '../types'

export interface LevelProgress {
  stars: number
  bestScore: number
  attempts: number
  completed: boolean
  /** Expert levels can be skipped (they unlock the next level without being passed). */
  skipped?: boolean
}

export interface LastResult {
  levelId: number
  summary: LevelSummary
  outcomes: PoseOutcome[]
  isNewBest: boolean
  previousStars: number
}

interface ProgressState {
  levels: Record<number, LevelProgress>
  /** Result of the most recent run (not persisted). */
  lastResult: LastResult | null
  recordResult: (levelId: number, summary: LevelSummary, outcomes: PoseOutcome[]) => LastResult
  skipLevel: (levelId: number) => void
  resetProgress: () => void
}

export const useMatchPoseProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      levels: {},
      lastResult: null,
      recordResult: (levelId, summary, outcomes) => {
        const prev = get().levels[levelId]
        const next: LevelProgress = {
          stars: Math.max(prev?.stars ?? 0, summary.stars),
          bestScore: Math.max(prev?.bestScore ?? 0, summary.score),
          attempts: (prev?.attempts ?? 0) + 1,
          completed: (prev?.completed ?? false) || summary.passed,
          skipped: prev?.skipped,
        }
        const lastResult: LastResult = {
          levelId,
          summary,
          outcomes,
          isNewBest: summary.score > (prev?.bestScore ?? 0),
          previousStars: prev?.stars ?? 0,
        }
        set({ levels: { ...get().levels, [levelId]: next }, lastResult })
        return lastResult
      },
      skipLevel: (levelId) => {
        const prev = get().levels[levelId]
        set({
          levels: {
            ...get().levels,
            [levelId]: { ...(prev ?? { stars: 0, bestScore: 0, attempts: 0, completed: false }), skipped: true },
          },
        })
      },
      resetProgress: () => set({ levels: {}, lastResult: null }),
    }),
    {
      name: 'match-pose-progress',
      version: 1,
      storage: createJSONStorage(() => kvStorage),
      partialize: ({ levels }) => ({ levels }),
    },
  ),
)

export function isLevelUnlocked(levels: Record<number, LevelProgress>, levelId: number): boolean {
  if (levelId <= 1) return true
  const prev = levels[levelId - 1]
  return !!prev && (prev.completed || !!prev.skipped)
}

export function totalStars(levels: Record<number, LevelProgress>): number {
  return Object.values(levels).reduce((sum, l) => sum + l.stars, 0)
}

export function totalTrophies(levels: Record<number, LevelProgress>): number {
  return Object.values(levels).reduce((sum, l) => sum + l.bestScore, 0)
}

export const MAX_STARS = LEVELS.length * 3

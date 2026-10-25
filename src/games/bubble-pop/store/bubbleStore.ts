import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { kvStorage } from '@/core/storage/kv'
import type { BubbleModeId } from '../config/modes'
import type { RoundSummary } from '../engine/scoring'

export interface ModeBest {
  score: number
  stars: number
}

export interface LastRound {
  summary: RoundSummary
  isNewBest: boolean
}

interface BubbleState {
  mode: BubbleModeId
  best: Partial<Record<BubbleModeId, ModeBest>>
  totals: { rounds: number; popped: number }
  /** Result of the most recent round (not persisted). */
  lastRound: LastRound | null
  setMode: (mode: BubbleModeId) => void
  recordRound: (summary: RoundSummary) => LastRound
}

export const useBubbleStore = create<BubbleState>()(
  persist(
    (set, get) => ({
      mode: 'kids',
      best: {},
      totals: { rounds: 0, popped: 0 },
      lastRound: null,
      setMode: (mode) => set({ mode }),
      recordRound: (summary) => {
        const { best, totals } = get()
        const prev = best[summary.mode]
        const lastRound: LastRound = { summary, isNewBest: summary.score > (prev?.score ?? 0) }
        set({
          best: {
            ...best,
            [summary.mode]: {
              score: Math.max(prev?.score ?? 0, summary.score),
              stars: Math.max(prev?.stars ?? 0, summary.stars),
            },
          },
          totals: { rounds: totals.rounds + 1, popped: totals.popped + summary.popped },
          lastRound,
        })
        return lastRound
      },
    }),
    {
      name: 'bubble-pop',
      version: 1,
      storage: createJSONStorage(() => kvStorage),
      partialize: ({ mode, best, totals }) => ({ mode, best, totals }),
    },
  ),
)

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { kvStorage } from '@/core/storage/kv'
import { DEFAULT_SETTINGS } from '../config/difficulty'
import type { RunStats } from '../engine/sim'
import type { DifficultySettings, PresetId } from '../types'

export type GuidesMode = 'always' | 'setup' | 'off'
export type CameraPanelSize = 'small' | 'medium' | 'large'

export const CAMERA_PANEL_FRACTION: Record<CameraPanelSize, number> = { small: 0.35, medium: 0.42, large: 0.5 }

export interface BestRun {
  score: number
  distance: number
  at: number
}

export interface RunTotals {
  runs: number
  distance: number
  jumps: number
  ducks: number
  laneChanges: number
  activeSeconds: number
}

export interface LastRun {
  stats: RunStats
  preset: PresetId | 'custom'
  settings: DifficultySettings
  isNewBest: boolean
  previousBest: BestRun | null
  endedAt: number
}

interface RunnerState {
  settings: DifficultySettings
  tutorialDone: boolean
  showSetupTips: boolean
  alwaysTrainingRun: boolean
  guidesMode: GuidesMode
  cameraPanelSize: CameraPanelSize
  /** Web: arrow keys / space as an alternative to body controls. */
  keyboardControls: boolean
  /** Kids preset "Parents: please supervise" note seen. */
  kidsNoteSeen: boolean
  best: Partial<Record<PresetId | 'custom', BestRun>>
  totals: RunTotals
  /** Most recent run (not persisted). */
  lastRun: LastRun | null
  setSettings: (settings: DifficultySettings) => void
  set: (patch: Partial<Pick<RunnerState, 'tutorialDone' | 'showSetupTips' | 'alwaysTrainingRun' | 'guidesMode' | 'cameraPanelSize' | 'keyboardControls' | 'kidsNoteSeen'>>) => void
  recordRun: (stats: RunStats, settings: DifficultySettings) => LastRun
  resetProgress: () => void
}

const EMPTY_TOTALS: RunTotals = { runs: 0, distance: 0, jumps: 0, ducks: 0, laneChanges: 0, activeSeconds: 0 }

/** Runs shorter than this don't count toward bests or totals (an accidental start). */
const MIN_COUNTED_S = 5

export const useRunnerStore = create<RunnerState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      tutorialDone: false,
      showSetupTips: true,
      alwaysTrainingRun: false,
      guidesMode: 'always',
      cameraPanelSize: 'medium',
      keyboardControls: false,
      kidsNoteSeen: false,
      best: {},
      totals: EMPTY_TOTALS,
      lastRun: null,
      setSettings: (settings) => set({ settings }),
      set: (patch) => set(patch),
      recordRun: (stats, settings) => {
        const { best, totals } = get()
        const key = settings.preset
        const previousBest = best[key] ?? null
        const counted = stats.timeS >= MIN_COUNTED_S
        const isNewBest = counted && stats.score > 0 && stats.score > (previousBest?.score ?? 0)
        const lastRun: LastRun = { stats, preset: key, settings, isNewBest, previousBest, endedAt: Date.now() }
        if (!counted) {
          set({ lastRun })
          return lastRun
        }
        set({
          lastRun,
          best: isNewBest ? { ...best, [key]: { score: stats.score, distance: stats.distance, at: Date.now() } } : best,
          totals: {
            runs: totals.runs + 1,
            distance: totals.distance + stats.distance,
            jumps: totals.jumps + stats.jumps,
            ducks: totals.ducks + stats.ducks,
            laneChanges: totals.laneChanges + stats.laneChanges,
            activeSeconds: totals.activeSeconds + stats.timeS,
          },
        })
        return lastRun
      },
      resetProgress: () => set({ best: {}, totals: EMPTY_TOTALS, lastRun: null, tutorialDone: false }),
    }),
    {
      name: 'endless-runner',
      version: 1,
      storage: createJSONStorage(() => kvStorage),
      partialize: ({ lastRun: _l, setSettings: _s, set: _set, recordRun: _r, resetProgress: _p, ...rest }) => rest,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<RunnerState>
        return { ...current, ...p, settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) }, totals: { ...EMPTY_TOTALS, ...(p.totals ?? {}) } }
      },
    },
  ),
)

export function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} km` : `${Math.round(m)} m`
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

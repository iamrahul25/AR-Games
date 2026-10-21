import type { DifficultySettings, MoveKind, PresetId, RunConfig } from '../types'

export interface SpeedStep {
  dial: number
  label: string
  /** World speed in m/s. */
  speed: number
}

export const SPEED_TABLE: readonly SpeedStep[] = [
  { dial: 1, label: 'Stroll', speed: 4.0 },
  { dial: 2, label: 'Walk', speed: 5.0 },
  { dial: 3, label: 'Brisk', speed: 6.0 },
  { dial: 4, label: 'Jog', speed: 7.5 },
  { dial: 5, label: 'Run', speed: 9.0 },
  { dial: 6, label: 'Fast', speed: 10.5 },
  { dial: 7, label: 'Sprint', speed: 12.0 },
  { dial: 8, label: 'Dash', speed: 14.0 },
  { dial: 9, label: 'Turbo', speed: 16.0 },
  { dial: 10, label: 'Max', speed: 18.0 },
]

export const MIN_DIAL = 1
export const MAX_DIAL = 10

export const clampDial = (d: number) => Math.min(MAX_DIAL, Math.max(MIN_DIAL, d))

/** World speed (m/s) for a dial value; fractional dials (speed ramps) interpolate. */
export function dialToSpeed(dial: number): number {
  const d = clampDial(dial)
  const i = Math.min(SPEED_TABLE.length - 2, Math.floor(d) - 1)
  const a = SPEED_TABLE[i]
  const b = SPEED_TABLE[i + 1]
  return a.speed + (b.speed - a.speed) * (d - a.dial)
}

/** Inverse of {@linkcode dialToSpeed}: the dial-equivalent number shown in the HUD. */
export function speedToDial(speed: number): number {
  if (speed <= SPEED_TABLE[0].speed) return MIN_DIAL
  for (let i = 0; i < SPEED_TABLE.length - 1; i++) {
    const a = SPEED_TABLE[i]
    const b = SPEED_TABLE[i + 1]
    if (speed <= b.speed) return a.dial + (speed - a.speed) / (b.speed - a.speed)
  }
  return MAX_DIAL
}

export function dialLabel(dial: number): string {
  return SPEED_TABLE[Math.round(clampDial(dial)) - 1].label
}

/** Timings that come with a preset and can't be lowered by any option. */
export const PRESET_TIMINGS: Record<PresetId, { recoveryS: number; jumpAirS: number; minSlideS: number }> = {
  kids: { recoveryS: 2.0, jumpAirS: 1.0, minSlideS: 1.0 },
  gentle: { recoveryS: 2.0, jumpAirS: 1.0, minSlideS: 1.0 },
  beginner: { recoveryS: 1.4, jumpAirS: 0.85, minSlideS: 0.8 },
  normal: { recoveryS: 1.0, jumpAirS: 0.75, minSlideS: 0.6 },
  athlete: { recoveryS: 1.0, jumpAirS: 0.65, minSlideS: 0.6 },
}

export const PRESET_ORDER: readonly PresetId[] = ['kids', 'gentle', 'beginner', 'normal', 'athlete']

export const PRESET_META: Record<PresetId | 'custom', { label: string; icon: string }> = {
  kids: { label: 'Kids', icon: '🧒' },
  gentle: { label: 'Gentle', icon: '🧓' },
  beginner: { label: 'Beginner', icon: '🙂' },
  normal: { label: 'Normal', icon: '🏃' },
  athlete: { label: 'Athlete', icon: '🔥' },
  custom: { label: 'Custom', icon: '🎛' },
}

const ALL_MOVES: Record<MoveKind, boolean> = { lane: true, jump: true, duck: true }

export const PRESETS: Record<PresetId, DifficultySettings> = {
  kids: {
    preset: 'kids',
    basePreset: 'kids',
    speedDial: 2,
    speedMode: 'constant',
    ramp: 'gentle',
    maxSpeedDial: 2,
    moves: ALL_MOVES,
    jumpStyle: 'jump',
    duckStyle: 'head',
    jumpLine: 'low',
    duckLine: 'low',
    laneWidth: 'narrow',
    density: 'sparse',
    patterns: 'simple',
    lives: 'unlimited',
    grace: 'generous',
    session: { kind: 'timed', minutes: 3 },
    restBreakEveryMin: 0,
    moveHints: 'voice',
    coinsShowSafeLane: true,
    seatedMode: false,
  },
  gentle: {
    preset: 'gentle',
    basePreset: 'gentle',
    speedDial: 1,
    speedMode: 'constant',
    ramp: 'gentle',
    maxSpeedDial: 1,
    moves: { lane: true, jump: false, duck: true },
    jumpStyle: 'hands-up',
    duckStyle: 'head',
    jumpLine: 'low',
    duckLine: 'low',
    laneWidth: 'narrow',
    density: 'sparse',
    patterns: 'simple',
    lives: 'unlimited',
    grace: 'generous',
    session: { kind: 'timed', minutes: 5 },
    restBreakEveryMin: 2,
    moveHints: 'voice',
    coinsShowSafeLane: true,
    seatedMode: false,
  },
  beginner: {
    preset: 'beginner',
    basePreset: 'beginner',
    speedDial: 3,
    speedMode: 'increasing',
    ramp: 'gentle',
    maxSpeedDial: 6,
    moves: ALL_MOVES,
    jumpStyle: 'jump',
    duckStyle: 'head',
    jumpLine: 'normal',
    duckLine: 'normal',
    laneWidth: 'normal',
    density: 'sparse',
    patterns: 'simple',
    lives: 5,
    grace: 'generous',
    session: { kind: 'endless' },
    restBreakEveryMin: 0,
    moveHints: 'icons',
    coinsShowSafeLane: true,
    seatedMode: false,
  },
  normal: {
    preset: 'normal',
    basePreset: 'normal',
    speedDial: 5,
    speedMode: 'increasing',
    ramp: 'normal',
    maxSpeedDial: 9,
    moves: ALL_MOVES,
    jumpStyle: 'jump',
    duckStyle: 'head',
    jumpLine: 'normal',
    duckLine: 'normal',
    laneWidth: 'normal',
    density: 'normal',
    patterns: 'mixed',
    lives: 3,
    grace: 'normal',
    session: { kind: 'endless' },
    restBreakEveryMin: 0,
    moveHints: 'off',
    coinsShowSafeLane: false,
    seatedMode: false,
  },
  athlete: {
    preset: 'athlete',
    basePreset: 'athlete',
    speedDial: 7,
    speedMode: 'increasing',
    ramp: 'steep',
    maxSpeedDial: 10,
    moves: ALL_MOVES,
    jumpStyle: 'jump',
    duckStyle: 'squat',
    jumpLine: 'high',
    duckLine: 'high',
    laneWidth: 'wide',
    density: 'dense',
    patterns: 'mixed',
    lives: 1,
    grace: 'strict',
    session: { kind: 'endless' },
    restBreakEveryMin: 0,
    moveHints: 'off',
    coinsShowSafeLane: false,
    seatedMode: false,
  },
}

export const DEFAULT_SETTINGS: DifficultySettings = PRESETS.normal

export const JUMP_FACTOR = { low: 0.12, normal: 0.2, high: 0.3 } as const
export const DUCK_FACTOR = { low: 0.25, normal: 0.4, high: 0.6 } as const
export const LANE_WIDTH_FACTOR = { narrow: 0.6, normal: 0.85, wide: 1.1 } as const
export const DENSITY_GAP_S = { sparse: 3.0, normal: 2.0, dense: 1.4 } as const
export const GRACE_MS = { generous: 250, normal: 150, strict: 60 } as const
export const RAMPS = {
  gentle: { stepDial: 0.5, everyS: 45 },
  normal: { stepDial: 0.5, everyS: 30 },
  steep: { stepDial: 1.0, everyS: 30 },
} as const
export const REST_BREAK_S = 20

export function defaultMaxDial(startDial: number) {
  return Math.min(startDial + 4, MAX_DIAL)
}

export function enabledMoves(settings: DifficultySettings): MoveKind[] {
  const list = (Object.keys(settings.moves) as MoveKind[]).filter((m) => settings.moves[m])
  return list.length ? list : ['lane']
}

/** Score multiplier for a set of options, clamped to [0.3, 2.0]. */
export function difficultyMultiplier(s: DifficultySettings): number {
  let m = 1
  m *= s.lives === 1 ? 1.3 : s.lives === 3 ? 1.0 : s.lives === 5 ? 0.8 : 0.5
  m *= s.density === 'dense' ? 1.2 : s.density === 'sparse' ? 0.8 : 1
  m *= s.grace === 'strict' ? 1.1 : s.grace === 'generous' ? 0.9 : 1
  m *= s.moveHints !== 'off' ? 0.9 : 1
  m *= 0.8 + 0.04 * s.speedDial
  m *= s.speedMode === 'increasing' ? 1.1 : 1
  m *= s.patterns === 'mixed' ? 1.05 : 1
  m *= enabledMoves(s).length < 3 ? 0.85 : 1
  return Math.round(Math.min(2, Math.max(0.3, m)) * 10) / 10
}

/** 1..5 stars, shown next to the difficulty summary. */
export function difficultyRating(s: DifficultySettings): number {
  const effectiveDial = s.speedDial + (s.speedMode === 'increasing' ? (s.maxSpeedDial - s.speedDial) / 2 : 0)
  let x = effectiveDial / 2.3
  x += s.density === 'dense' ? 0.3 : s.density === 'sparse' ? -0.2 : 0
  x += s.lives === 'unlimited' ? -0.5 : s.lives === 5 ? -0.2 : s.lives === 1 ? 0.4 : 0
  x += s.grace === 'generous' ? -0.1 : s.grace === 'strict' ? 0.2 : 0
  x += s.patterns === 'mixed' ? 0.2 : 0
  x += enabledMoves(s).length < 3 ? -0.3 : 0
  return Math.min(5, Math.max(1, Math.round(x + 0.1)))
}

export function ratingStars(rating: number): string {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating)
}

export function sessionLabel(s: DifficultySettings['session']): string {
  if (s.kind === 'timed') return `${s.minutes} min`
  if (s.kind === 'distance') return s.meters >= 1000 ? `${s.meters / 1000} km` : `${s.meters} m`
  return 'Endless'
}

/** e.g. "Normal · Speed 5 → 9 · Increasing · 3 lives · All moves" */
export function summarizeDifficulty(s: DifficultySettings): string {
  const parts: string[] = [PRESET_META[s.preset].label]
  parts.push(s.speedMode === 'increasing' ? `Speed ${s.speedDial} → ${s.maxSpeedDial}` : `Speed ${s.speedDial}`)
  parts.push(s.speedMode === 'increasing' ? 'Increasing' : 'Constant')
  parts.push(s.lives === 'unlimited' ? 'Unlimited lives' : `${s.lives} ${s.lives === 1 ? 'life' : 'lives'}`)
  const moves = enabledMoves(s)
  parts.push(moves.length === 3 ? 'All moves' : moves.map((m) => (m === 'lane' ? 'Lanes' : m === 'jump' ? 'Jump' : 'Duck')).join(' + '))
  if (s.session.kind !== 'endless') parts.push(sessionLabel(s.session))
  return parts.join(' · ')
}

const COMPARED_KEYS = (Object.keys(PRESETS.normal) as (keyof DifficultySettings)[]).filter(
  (k) => k !== 'preset' && k !== 'basePreset',
)

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** The preset whose values exactly match, or null for custom settings. */
export function detectPreset(s: DifficultySettings): PresetId | null {
  for (const id of PRESET_ORDER) {
    const p = PRESETS[id]
    if (COMPARED_KEYS.every((k) => sameValue(p[k], s[k]))) return id
  }
  return null
}

/** Applies an edit. Any change that no longer matches a preset switches to Custom (keeping the values). */
export function applySettingsChange(s: DifficultySettings, patch: Partial<DifficultySettings>): DifficultySettings {
  const next = { ...s, ...patch }
  if (next.speedMode === 'increasing' && next.maxSpeedDial < next.speedDial) next.maxSpeedDial = next.speedDial
  if (patch.speedDial !== undefined && patch.maxSpeedDial === undefined && next.speedMode === 'increasing') {
    next.maxSpeedDial = Math.max(next.maxSpeedDial, next.speedDial)
  }
  if (next.speedMode === 'constant') next.maxSpeedDial = next.speedDial
  if (!next.moves.lane && !next.moves.jump && !next.moves.duck) next.moves = { ...next.moves, lane: true }
  const match = detectPreset(next)
  return { ...next, preset: match ?? 'custom', basePreset: match ?? next.basePreset }
}

export function applyPreset(id: PresetId): DifficultySettings {
  return { ...PRESETS[id] }
}

/** Resolves user settings into the numbers the motion detector and engine use. */
export function resolveRunConfig(s: DifficultySettings): RunConfig {
  const timings = PRESET_TIMINGS[s.basePreset]
  const increasing = s.speedMode === 'increasing'
  const ramp = RAMPS[s.ramp]
  const moves = enabledMoves(s)
  const limit: RunConfig['sessionLimit'] =
    s.session.kind === 'timed'
      ? { seconds: s.session.minutes * 60 }
      : s.session.kind === 'distance'
        ? { meters: s.session.meters }
        : {}
  return {
    startDial: s.speedDial,
    maxDial: increasing ? Math.max(s.speedDial, s.maxSpeedDial) : s.speedDial,
    rampStepDial: increasing ? ramp.stepDial : 0,
    rampEveryS: increasing ? ramp.everyS : 0,
    recoveryS: timings.recoveryS,
    densityGapS: DENSITY_GAP_S[s.density],
    jumpAirS: timings.jumpAirS,
    minSlideS: timings.minSlideS,
    graceMs: GRACE_MS[s.grace],
    livesMax: s.lives === 'unlimited' ? null : s.lives,
    jumpFactor: JUMP_FACTOR[s.jumpLine],
    duckFactor: DUCK_FACTOR[s.duckLine],
    laneWidthFactor: LANE_WIDTH_FACTOR[s.laneWidth],
    jumpStyle: s.jumpStyle,
    duckStyle: s.duckStyle,
    seatedMode: s.seatedMode,
    enabledMoves: moves,
    patternTags: s.patterns === 'mixed' ? ['simple', 'combo'] : ['simple'],
    maxPatternLevel: s.density === 'sparse' ? 2 : 3,
    sessionLimit: limit,
    restBreak:
      s.session.kind === 'timed' && s.restBreakEveryMin > 0
        ? { everyS: s.restBreakEveryMin * 60, durationS: REST_BREAK_S }
        : null,
    moveHints: s.moveHints,
    coinsShowSafeLane: s.coinsShowSafeLane,
    scoreMultiplier: difficultyMultiplier(s),
  }
}

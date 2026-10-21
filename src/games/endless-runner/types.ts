export type Lane = -1 | 0 | 1
export const LANES: readonly Lane[] = [-1, 0, 1]

export type MoveKind = 'lane' | 'jump' | 'duck'
export const MOVE_KINDS: readonly MoveKind[] = ['lane', 'jump', 'duck']

export type ObstacleType = 'hurdle' | 'bar' | 'wall'

export type PresetId = 'kids' | 'gentle' | 'beginner' | 'normal' | 'athlete'
export type Level3 = 'low' | 'normal' | 'high'

export type SessionLength =
  | { kind: 'endless' }
  | { kind: 'timed'; minutes: 1 | 3 | 5 | 10 | 15 }
  | { kind: 'distance'; meters: 500 | 1000 | 2000 }

export type MoveHints = 'off' | 'icons' | 'voice'

/** What the user edits on the Difficulty screen. */
export interface DifficultySettings {
  preset: PresetId | 'custom'
  /** Preset the values came from; supplies timings that are not user options (recovery floor, air time). */
  basePreset: PresetId
  /** 1..10 */
  speedDial: number
  speedMode: 'constant' | 'increasing'
  ramp: 'gentle' | 'normal' | 'steep'
  /** ≥ speedDial */
  maxSpeedDial: number
  moves: Record<MoveKind, boolean>
  jumpStyle: 'jump' | 'hands-up'
  duckStyle: 'head' | 'squat'
  /** Jump line height: low / normal / high. */
  jumpLine: Level3
  /** Duck line depth: shallow (low) / normal / deep (high). */
  duckLine: Level3
  laneWidth: 'narrow' | 'normal' | 'wide'
  density: 'sparse' | 'normal' | 'dense'
  patterns: 'simple' | 'mixed'
  lives: 1 | 3 | 5 | 'unlimited'
  grace: 'generous' | 'normal' | 'strict'
  session: SessionLength
  /** Minutes between 20 s rest breaks (timed runs only); 0 = off. */
  restBreakEveryMin: 0 | 2 | 3 | 5
  moveHints: MoveHints
  coinsShowSafeLane: boolean
  seatedMode: boolean
}

/** Resolved numbers the engine runs on. */
export interface RunConfig {
  startDial: number
  maxDial: number
  /** Dial levels added every `rampEveryS` (0 = constant speed). */
  rampStepDial: number
  rampEveryS: number
  recoveryS: number
  densityGapS: number
  jumpAirS: number
  minSlideS: number
  graceMs: number
  /** null = unlimited (practice). */
  livesMax: number | null
  jumpFactor: number
  duckFactor: number
  laneWidthFactor: number
  jumpStyle: DifficultySettings['jumpStyle']
  duckStyle: DifficultySettings['duckStyle']
  seatedMode: boolean
  enabledMoves: MoveKind[]
  patternTags: PatternTag[]
  /** Highest pattern level the generator may use. */
  maxPatternLevel: 1 | 2 | 3
  sessionLimit: { seconds?: number; meters?: number }
  restBreak: { everyS: number; durationS: number } | null
  moveHints: MoveHints
  coinsShowSafeLane: boolean
  scoreMultiplier: number
}

export type PatternTag = 'simple' | 'combo'

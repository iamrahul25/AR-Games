export type BubbleModeId = 'kids' | 'classic' | 'challenge'

export interface BubbleModeConfig {
  id: BubbleModeId
  title: string
  icon: string
  description: string
  durationMs: number
  /** Bubbles on screen at once. */
  maxBubbles: number
  /** Time between spawns at the start and at the end of the round (ramps linearly). */
  spawnIntervalMs: readonly [number, number]
  /** How long a bubble floats before it bursts on its own, start → end of the round. */
  lifetimeMs: readonly [number, number]
  /** Bubble radius in normalized image-height units. */
  radius: number
  goldenChance: number
  bombChance: number
  /** Feet pop bubbles too, and some bubbles spawn low enough to need a kick. */
  feet: boolean
  lowChance: number
  /** Score needed for 1, 2 and 3 stars. */
  stars: readonly [number, number, number]
}

export const MODES: Record<BubbleModeId, BubbleModeConfig> = {
  kids: {
    id: 'kids',
    title: 'Kids',
    icon: '🧸',
    description: 'Big, slow bubbles. No bombs. Just pop!',
    durationMs: 60_000,
    maxBubbles: 3,
    spawnIntervalMs: [1400, 1000],
    lifetimeMs: [7000, 5000],
    radius: 0.085,
    goldenChance: 0.1,
    bombChance: 0,
    feet: false,
    lowChance: 0,
    stars: [300, 800, 1500],
  },
  classic: {
    id: 'classic',
    title: 'Classic',
    icon: '🫧',
    description: 'Faster bubbles, and watch out for bombs.',
    durationMs: 60_000,
    maxBubbles: 4,
    spawnIntervalMs: [1000, 650],
    lifetimeMs: [4000, 2600],
    radius: 0.065,
    goldenChance: 0.08,
    bombChance: 0.1,
    feet: false,
    lowChance: 0,
    stars: [300, 900, 1700],
  },
  challenge: {
    id: 'challenge',
    title: 'Challenge',
    icon: '🔥',
    description: 'Small, quick bubbles. Kick the low ones with your feet!',
    durationMs: 60_000,
    maxBubbles: 5,
    spawnIntervalMs: [800, 500],
    lifetimeMs: [3200, 2000],
    radius: 0.055,
    goldenChance: 0.08,
    bombChance: 0.15,
    feet: true,
    lowChance: 0.3,
    stars: [400, 1000, 1900],
  },
}

export const MODE_IDS: BubbleModeId[] = ['kids', 'classic', 'challenge']

export const POINTS = { normal: 10, golden: 30, bomb: -25 } as const

/** Combo length at which the score multiplier steps up (×2, ×3). */
export const COMBO_STEPS = [5, 15] as const

import type { Lane, MoveKind, ObstacleType, PatternTag } from '../types'

export interface PatternItem {
  /** Position in beats (1 beat = the minimum gap between required moves). */
  beat: number
  type: ObstacleType
  lanes: Lane[]
}

export interface ObstaclePattern {
  id: string
  /** Unlocks with speed stage / time. */
  minLevel: 1 | 2 | 3
  /** `player`: pattern lane 0 is placed in the player's expected lane; otherwise lanes are shuffled. */
  anchor?: 'player'
  items: PatternItem[]
}

export const OBSTACLE_MOVE: Record<ObstacleType, MoveKind> = { hurdle: 'jump', bar: 'duck', wall: 'lane' }

export function patternRequires(p: ObstaclePattern): MoveKind[] {
  return [...new Set(p.items.map((i) => OBSTACLE_MOVE[i.type]))]
}

/** `simple` = one kind of move; `combo` = needs a mix (e.g. change lane + jump). */
export function patternTag(p: ObstaclePattern): PatternTag {
  return patternRequires(p).length <= 1 ? 'simple' : 'combo'
}

export function patternBeats(p: ObstaclePattern): number {
  return p.items.reduce((m, i) => Math.max(m, i.beat), 0)
}

const ALL: Lane[] = [-1, 0, 1]
const wall = (beat: number, lanes: Lane[]): PatternItem => ({ beat, type: 'wall', lanes })
const hurdle = (beat: number, lanes: Lane[] = ALL): PatternItem => ({ beat, type: 'hurdle', lanes })
const bar = (beat: number, lanes: Lane[] = ALL): PatternItem => ({ beat, type: 'bar', lanes })

export const PATTERNS: readonly ObstaclePattern[] = [
  // Lane changes
  { id: 'single-wall', minLevel: 1, anchor: 'player', items: [wall(0, [0])] },
  { id: 'side-wall', minLevel: 1, items: [wall(0, [-1])] },
  { id: 'double-wall', minLevel: 1, items: [wall(0, [-1, 0])] },
  { id: 'double-wall-shift', minLevel: 2, items: [wall(0, [-1, 0]), wall(1, [-1, 1])] },
  { id: 'zigzag', minLevel: 2, items: [wall(0, [-1]), wall(1, [1]), wall(2, [0])] },
  { id: 'wall-corridor', minLevel: 3, items: [wall(0, [-1, 0]), wall(2, [0, 1])] },
  { id: 'wall-slalom', minLevel: 3, anchor: 'player', items: [wall(0, [0, 1]), wall(1, [-1, 0]), wall(2, [0, 1])] },
  // Jumps
  { id: 'single-hurdle', minLevel: 1, anchor: 'player', items: [hurdle(0, [0])] },
  { id: 'wide-hurdle', minLevel: 1, items: [hurdle(0)] },
  { id: 'pair-hurdle', minLevel: 1, items: [hurdle(0, [-1, 0])] },
  { id: 'double-hurdle', minLevel: 2, items: [hurdle(0), hurdle(1)] },
  { id: 'triple-hurdle', minLevel: 3, items: [hurdle(0), hurdle(1), hurdle(2)] },
  // Ducks
  { id: 'single-bar', minLevel: 1, anchor: 'player', items: [bar(0, [0])] },
  { id: 'wide-bar', minLevel: 1, items: [bar(0)] },
  { id: 'pair-bar', minLevel: 1, items: [bar(0, [0, 1])] },
  { id: 'double-bar', minLevel: 2, items: [bar(0), bar(1)] },
  // Combos
  { id: 'hurdle-bar', minLevel: 1, items: [hurdle(0), bar(1)] },
  { id: 'bar-hurdle', minLevel: 2, items: [bar(0), hurdle(1)] },
  { id: 'gate-jump', minLevel: 1, items: [wall(0, [-1, 1]), hurdle(0, [0])] },
  { id: 'gate-duck', minLevel: 1, items: [wall(0, [-1, 1]), bar(0, [0])] },
  { id: 'side-gate-jump', minLevel: 2, items: [wall(0, [0, 1]), hurdle(0, [-1])] },
  { id: 'side-gate-duck', minLevel: 2, items: [wall(0, [-1, 0]), bar(0, [1])] },
  { id: 'wall-then-hurdle', minLevel: 2, anchor: 'player', items: [wall(0, [0]), hurdle(1)] },
  { id: 'wall-then-bar', minLevel: 2, anchor: 'player', items: [wall(0, [0]), bar(1)] },
  { id: 'hurdle-then-gate', minLevel: 2, items: [hurdle(0), wall(1, [0, 1])] },
  { id: 'triple-mix', minLevel: 3, items: [hurdle(0), wall(1, [-1, 0]), bar(2)] },
  { id: 'jump-or-dodge', minLevel: 3, items: [wall(0, [-1]), hurdle(0, [0, 1]), bar(1)] },
]

/** Coins-only stretch (a breather, and the fallback when nothing else fits). */
export const COIN_BREAK_ID = 'coin-break'

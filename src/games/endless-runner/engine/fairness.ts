import type { Lane, MoveKind, ObstacleType } from '../types'
import { LANES } from '../types'

export type LaneNeed = 'open' | 'jump' | 'duck' | 'blocked'

/** One row of obstacles reached at time `t` (s): what each lane (index lane + 1) requires. */
export interface Row {
  t: number
  needs: [LaneNeed, LaneNeed, LaneNeed]
}

/** Reachable lanes → earliest time (s) the player is free to start the next move. */
export type Reach = Map<Lane, number>

export interface FairnessParams {
  recoveryS: number
  enabledMoves: readonly MoveKind[]
}

const EPS = 1e-6

export function rowNeeds(obstacles: { type: ObstacleType; lanes: readonly Lane[] }[]): Row['needs'] {
  const needs: Row['needs'] = ['open', 'open', 'open']
  for (const o of obstacles) {
    const need: LaneNeed = o.type === 'wall' ? 'blocked' : o.type === 'hurdle' ? 'jump' : 'duck'
    for (const lane of o.lanes) {
      const cur = needs[lane + 1]
      needs[lane + 1] = cur === 'open' ? need : cur === need ? need : 'blocked'
    }
  }
  return needs
}

/**
 * Advances the reachable set through one row. Each lane change takes `recoveryS` per lane and
 * must be finished before the row; each jump/duck needs `recoveryS` before the next move.
 * Returns an empty map if the row cannot be passed.
 */
export function advance(reach: Reach, row: Row, p: FairnessParams): Reach {
  const laneMoves = p.enabledMoves.includes('lane')
  const next: Reach = new Map()
  for (const [from, free] of reach) {
    for (const to of LANES) {
      const dl = Math.abs(to - from)
      if (dl > 0 && !laneMoves) continue
      const ready = free + dl * p.recoveryS
      if (dl > 0 && ready > row.t + EPS) continue
      const need = row.needs[to + 1]
      let nextFree: number
      if (need === 'blocked') continue
      // Passing a row pins the player to `to` at row.t, so the next lane change starts no earlier.
      if (need === 'open') nextFree = Math.max(ready, row.t)
      else {
        if (!p.enabledMoves.includes(need === 'jump' ? 'jump' : 'duck')) continue
        if (ready > row.t + EPS) continue
        nextFree = row.t + p.recoveryS
      }
      const prev = next.get(to)
      if (prev === undefined || nextFree < prev) next.set(to, nextFree)
    }
  }
  return next
}

/** Checks every row is passable in order. `end` is the reachable set after the last row. */
export function checkRows(rows: Row[], start: Reach, p: FairnessParams): { ok: boolean; end: Reach } {
  let reach = start
  for (const row of [...rows].sort((a, b) => a.t - b.t)) {
    reach = advance(reach, row, p)
    if (reach.size === 0) return { ok: false, end: reach }
  }
  return { ok: true, end: reach }
}

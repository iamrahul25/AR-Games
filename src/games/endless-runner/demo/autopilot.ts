import { OBSTACLE_SHAPES, PLAYER_DEPTH } from '../config/world'
import { rowNeeds, type LaneNeed } from '../engine/fairness'
import type { SimObstacle, WorldSnapshot } from '../engine/sim'
import type { Lane, RunConfig } from '../types'
import { LANES } from '../types'

export interface AutopilotDecision {
  lane: Lane
  jump: boolean
  duck: boolean
}

export interface AutopilotOptions {
  /** Extra seconds to act early (body-tracking latency for the demo bot). */
  latencyS?: number
  /** Start changing lanes when the next row is this close (s). */
  laneLeadS?: number
  /** 0..1 chance of ignoring a row (human-like mistakes). */
  mistakeRate?: number
  random?: () => number
}

interface UpcomingRow {
  row: number
  /** Near face z of the row (m ahead). */
  z: number
  /** Far end (m ahead). */
  zEnd: number
  needs: LaneNeed[]
}

function upcomingRows(obstacles: readonly SimObstacle[], distance: number): UpcomingRow[] {
  const byRow = new Map<number, SimObstacle[]>()
  for (const o of obstacles) {
    if (o.state === 'done' || o.state === 'hit') continue
    const zEnd = o.at - distance + OBSTACLE_SHAPES[o.type].depth
    if (zEnd < -PLAYER_DEPTH / 2) continue
    const list = byRow.get(o.row)
    if (list) list.push(o)
    else byRow.set(o.row, [o])
  }
  const rows: UpcomingRow[] = []
  for (const [row, list] of byRow) {
    const z = Math.min(...list.map((o) => o.at - distance))
    const zEnd = Math.max(...list.map((o) => o.at - distance + OBSTACLE_SHAPES[o.type].depth))
    rows.push({ row, z, zEnd, needs: rowNeeds(list) })
  }
  return rows.sort((a, b) => a.z - b.z)
}

function bestLane(needs: LaneNeed[], from: Lane, laneMoves: boolean, next?: LaneNeed[]): Lane {
  if (!laneMoves) return 0
  const score = (l: Lane) => {
    const need = needs[l + 1]
    let s = need === 'open' ? 0 : need === 'blocked' ? 100 : 3
    s += Math.abs(l - from) * 1.5
    if (next) s += next[l + 1] === 'blocked' ? 2 : next[l + 1] === 'open' ? 0 : 0.5
    return s
  }
  return [...LANES].sort((a, b) => score(a) - score(b))[0]
}

/**
 * Plays the game from the world state: picks the safest lane for the next row and times
 * jumps and ducks. Used by tests (direct sim input) and the demo bot (body targets).
 */
export class Autopilot {
  private lane: Lane = 0
  private jumpedRows = new Set<number>()
  private skipRows = new Set<number>()
  private decidedRows = new Set<number>()

  constructor(
    private config: RunConfig,
    private opts: AutopilotOptions = {},
  ) {}

  reset(lane: Lane = 0) {
    this.lane = lane
    this.jumpedRows.clear()
    this.skipRows.clear()
    this.decidedRows.clear()
  }

  decide(w: WorldSnapshot): AutopilotDecision {
    const latency = this.opts.latencyS ?? 0
    const laneLead = this.opts.laneLeadS ?? 1.4
    const laneMoves = this.config.enabledMoves.includes('lane')
    const rows = upcomingRows(w.obstacles, w.distance)
    const speed = Math.max(w.speed, 0.1)
    const playerLane = this.lane

    const next = rows[0]
    if (next && !this.decidedRows.has(next.row)) {
      this.decidedRows.add(next.row)
      const rand = this.opts.random ?? Math.random
      if ((this.opts.mistakeRate ?? 0) > 0 && rand() < (this.opts.mistakeRate ?? 0)) this.skipRows.add(next.row)
    }

    if (next && !this.skipRows.has(next.row) && next.z / speed <= laneLead + latency) {
      this.lane = bestLane(next.needs, playerLane, laneMoves, rows[1]?.needs)
    }

    let jump = false
    let duck = false
    for (const r of rows) {
      if (this.skipRows.has(r.row)) continue
      const need = r.needs[this.lane + 1]
      const tti = (r.z - PLAYER_DEPTH / 2) / speed
      if (need === 'jump' && !this.jumpedRows.has(r.row) && tti <= 0.2 * this.config.jumpAirS + latency && r.zEnd > -PLAYER_DEPTH / 2) {
        this.jumpedRows.add(r.row)
        jump = true
      }
      if (need === 'duck' && tti <= 0.3 + latency && r.zEnd > -PLAYER_DEPTH / 2 - 0.2) duck = true
    }
    return { lane: this.lane, jump, duck }
  }
}

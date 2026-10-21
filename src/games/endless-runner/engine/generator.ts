import { COIN_SPACING_M, COIN_Y, JUMP_HEIGHT } from '../config/world'
import type { Lane, MoveKind, ObstacleType, PatternTag } from '../types'
import { LANES } from '../types'
import { checkRows, rowNeeds, type FairnessParams, type Row } from './fairness'
import { OBSTACLE_MOVE, PATTERNS, patternRequires, patternTag, type ObstaclePattern } from './patterns'
import type { Rng } from './rng'

export interface GeneratedObstacle {
  type: ObstacleType
  lanes: Lane[]
  /** Track distance (m) of the obstacle's near face. */
  at: number
  /** Obstacles placed together share a row id. */
  row: number
  hint: MoveKind
}

export interface GeneratedCoin {
  lane: Lane
  at: number
  y: number
  kind: 'coin' | 'star'
}

export interface GeneratorConfig {
  enabledMoves: readonly MoveKind[]
  patternTags: readonly PatternTag[]
  recoveryS: number
  densityGapS: number
  maxPatternLevel: 1 | 2 | 3
  coinsShowSafeLane: boolean
}

export interface FillContext {
  /** Speed (m/s) used to turn the time-based spacing into meters. */
  speed: number
  /** 1..3, unlocks harder patterns. */
  level: number
  /** < 1 tightens the density gap at higher speed stages (never below the recovery floor). */
  densityScale?: number
}

const MAX_TRIES = 10
const PATTERN_GAP_BEATS = 1.5

function permutations(): Lane[][] {
  return [
    [-1, 0, 1],
    [-1, 1, 0],
    [0, -1, 1],
    [0, 1, -1],
    [1, -1, 0],
    [1, 0, -1],
  ]
}
const PERMS = permutations()

/**
 * Builds the track ahead from hand-authored patterns. Every pattern is checked by the
 * fairness validator before it is committed; if nothing fits, a coins-only breather is used.
 */
export class TrackGenerator {
  /** Track distance where the next pattern may start. */
  nextAt: number
  /** Lane the player will most likely be in at `nextAt` (used for player-anchored patterns). */
  expectedLane: Lane = 0
  private rowId = 0
  /** Reachable lanes after the last committed row → track distance where the player is free. */
  private reachM = new Map<Lane, number>()
  private patternsUntilBreather: number
  readonly pool: ObstaclePattern[]

  constructor(
    private config: GeneratorConfig,
    private rng: Rng,
    startAt: number,
    playerLane: Lane = 0,
  ) {
    this.nextAt = startAt
    this.expectedLane = config.enabledMoves.includes('lane') ? playerLane : 0
    this.reachM.set(this.expectedLane, 0)
    if (config.enabledMoves.includes('lane')) for (const l of LANES) if (!this.reachM.has(l)) this.reachM.set(l, 0)
    this.patternsUntilBreather = rng.int(6, 10)
    this.pool = PATTERNS.filter(
      (p) =>
        config.patternTags.includes(patternTag(p)) &&
        patternRequires(p).every((m) => config.enabledMoves.includes(m)) &&
        p.minLevel <= config.maxPatternLevel,
    )
  }

  get laneMoves() {
    return this.config.enabledMoves.includes('lane')
  }

  private fairness(): FairnessParams {
    return { recoveryS: this.config.recoveryS, enabledMoves: this.config.enabledMoves }
  }

  /** Everything is reachable again (e.g. after a resume or rest break cleared the track). */
  resetReach(playerLane: Lane, freeAt: number) {
    this.reachM = new Map()
    if (this.laneMoves) for (const l of LANES) this.reachM.set(l, freeAt)
    else this.reachM.set(0, freeAt)
    this.expectedLane = this.laneMoves ? playerLane : 0
  }

  /** Generates patterns until `untilAt` is covered. */
  fill(untilAt: number, ctx: FillContext): { obstacles: GeneratedObstacle[]; coins: GeneratedCoin[] } {
    const obstacles: GeneratedObstacle[] = []
    const coins: GeneratedCoin[] = []
    while (this.nextAt < untilAt) this.placeNext(ctx, obstacles, coins)
    return { obstacles, coins }
  }

  /** Coins-only stretch of `seconds`. */
  placeCoinBreak(seconds: number, ctx: FillContext, coins: GeneratedCoin[]) {
    const length = seconds * ctx.speed
    const start = this.nextAt
    const lanes = this.laneMoves ? LANES : ([0] as Lane[])
    let lane: Lane = this.expectedLane
    let at = start
    const half = start + length / 2
    while (at < start + length) {
      const count = this.rng.int(6, 8)
      for (let i = 0; i < count && at < start + length; i++) {
        const star = this.rng.chance(0.015)
        coins.push({ lane, at, y: COIN_Y, kind: star ? 'star' : 'coin' })
        at += COIN_SPACING_M
      }
      at += COIN_SPACING_M * 2
      if (at > half && this.laneMoves) {
        const options = lanes.filter((l) => Math.abs(l - lane) === 1)
        lane = this.rng.pick(options)
      }
    }
    this.nextAt = start + length
    this.expectedLane = lane
    const free = start + length - ctx.speed * this.config.recoveryS
    this.resetReach(lane, free)
  }

  private placeNext(ctx: FillContext, obstacles: GeneratedObstacle[], coins: GeneratedCoin[]) {
    this.patternsUntilBreather--
    if (this.patternsUntilBreather <= 0 || this.pool.length === 0) {
      this.patternsUntilBreather = this.rng.int(6, 10)
      this.placeCoinBreak(this.rng.range(3, 4), ctx, coins)
      return
    }
    const gapS = Math.max(this.config.recoveryS, this.config.densityGapS * (ctx.densityScale ?? 1))
    const beatM = gapS * ctx.speed
    const level = Math.max(1, Math.min(3, Math.floor(ctx.level)))
    const candidates = this.pool.filter((p) => p.minLevel <= level)
    if (candidates.length === 0) {
      this.placeCoinBreak(2, ctx, coins)
      return
    }

    for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
      const pattern = this.rng.pick(candidates)
      const perm = this.permutationFor(pattern)
      const items = pattern.items.map((i) => ({
        beat: i.beat,
        type: i.type,
        lanes: i.lanes.map((l) => perm[l + 1]).sort((a, b) => a - b) as Lane[],
      }))
      const base = this.nextAt
      const beats = [...new Set(items.map((i) => i.beat))].sort((a, b) => a - b)
      const rows: Row[] = beats.map((b) => ({
        t: (b * beatM) / ctx.speed,
        needs: rowNeeds(items.filter((i) => i.beat === b)),
      }))
      const result = this.checkFromEveryLane(rows, base, ctx.speed)
      if (!result.ok) continue

      const rowIds = new Map<number, number>()
      for (const b of beats) rowIds.set(b, ++this.rowId)
      for (const item of items) {
        obstacles.push({
          type: item.type,
          lanes: item.lanes,
          at: base + item.beat * beatM,
          row: rowIds.get(item.beat)!,
          hint: OBSTACLE_MOVE[item.type],
        })
      }
      this.reachM = new Map()
      for (const [lane, t] of result.end) this.reachM.set(lane, base + t * ctx.speed)
      this.placeCoins(rows, base, ctx.speed, beatM, coins)
      const lastBeat = beats[beats.length - 1]
      this.nextAt = base + lastBeat * beatM + beatM * PATTERN_GAP_BEATS
      this.expectedLane = this.pickExpected(result.end)
      return
    }
    this.placeCoinBreak(2, ctx, coins)
  }

  /**
   * The player doesn't know what comes next, so the pattern must be passable from every lane
   * they could be in, not just the best one.
   */
  private checkFromEveryLane(rows: Row[], base: number, speed: number): { ok: boolean; end: Map<Lane, number> } {
    const end = new Map<Lane, number>()
    for (const [lane, freeAt] of this.reachM) {
      const r = checkRows(rows, new Map([[lane, (freeAt - base) / speed]]), this.fairness())
      if (!r.ok) return { ok: false, end }
      for (const [l, t] of r.end) {
        const prev = end.get(l)
        if (prev === undefined || t > prev) end.set(l, t)
      }
    }
    return { ok: true, end }
  }

  private permutationFor(pattern: ObstaclePattern): Lane[] {
    if (pattern.anchor === 'player' || !this.laneMoves) {
      const others = LANES.filter((l) => l !== this.expectedLane)
      const [a, b] = this.rng.chance(0.5) ? others : [others[1], others[0]]
      // perm[patternLane + 1] = track lane
      return [a, this.expectedLane, b]
    }
    return this.rng.pick(PERMS)
  }

  private pickExpected(end: Map<Lane, number>): Lane {
    if (!this.laneMoves) return 0
    const lanes = [...end.keys()]
    if (lanes.includes(this.expectedLane)) return this.expectedLane
    lanes.sort((a, b) => Math.abs(a - this.expectedLane) - Math.abs(b - this.expectedLane))
    return lanes[0] ?? 0
  }

  private placeCoins(rows: Row[], base: number, speed: number, beatM: number, coins: GeneratedCoin[]) {
    let lane = this.expectedLane
    for (const row of rows) {
      const at = base + row.t * speed
      const open = LANES.filter((l) => row.needs[l + 1] === 'open')
      const blocked = LANES.some((l) => row.needs[l + 1] === 'blocked')
      const jumpLanes = LANES.filter((l) => row.needs[l + 1] === 'jump')
      const duckLanes = LANES.filter((l) => row.needs[l + 1] === 'duck')
      const maxCount = Math.max(0, Math.floor((beatM * 0.8) / COIN_SPACING_M))

      if (blocked && open.length && this.laneMoves && (this.config.coinsShowSafeLane || this.rng.chance(0.35))) {
        const safe = [...open].sort((a, b) => Math.abs(a - lane) - Math.abs(b - lane))[0]
        const count = Math.min(5, maxCount)
        for (let i = count; i >= 1; i--) coins.push({ lane: safe, at: at - i * COIN_SPACING_M + 0.6, y: COIN_Y, kind: 'coin' })
        lane = safe
      } else if (jumpLanes.length && this.rng.chance(0.7)) {
        const l = jumpLanes.includes(lane) ? lane : this.rng.pick(jumpLanes)
        for (let k = -2; k <= 2; k++) {
          const f = k / 2.6
          coins.push({ lane: l, at: at + k * COIN_SPACING_M * 0.8, y: COIN_Y + JUMP_HEIGHT * 0.85 * (1 - f * f), kind: 'coin' })
        }
        lane = l
      } else if (duckLanes.length && this.rng.chance(0.4)) {
        const l = duckLanes.includes(lane) ? lane : this.rng.pick(duckLanes)
        for (let k = -1; k <= 1; k++) coins.push({ lane: l, at: at + k * COIN_SPACING_M, y: 0.35, kind: 'coin' })
        lane = l
      }
    }
    if (this.rng.chance(0.03) && coins.length) {
      const c = coins[coins.length - 1 - this.rng.int(0, Math.min(2, coins.length - 1))]
      c.kind = 'star'
    }
  }
}

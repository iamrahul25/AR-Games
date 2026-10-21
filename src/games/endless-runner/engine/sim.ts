import { dialToSpeed } from '../config/difficulty'
import {
  COIN_SPACING_M,
  COIN_Y,
  CULL_BEHIND,
  HINT_LEAD_S,
  HIT_STUMBLE_S,
  INVULNERABLE_S,
  JUMP_HEIGHT,
  LANE_EASE_S,
  LANE_SPACING,
  laneX,
  MILESTONE_EVERY_M,
  OBSTACLE_SHAPES,
  PLAYER_DEPTH,
  SPAWN_DISTANCE,
  START_SAFE_S,
  WATER_BREAK_EVERY_S,
} from '../config/world'
import type { Lane, MoveKind, ObstacleType, RunConfig } from '../types'
import { LANES } from '../types'
import { avoidingMove, laneFromX, overlapsPlayer, playerTop, wouldHit } from './collision'
import { TrackGenerator } from './generator'
import { Rng } from './rng'
import { clearedPoints, distancePoints, finalScore, POINTS } from './scoring'
import { SpeedController } from './speed'

export interface SimInput {
  /** Lane the body is in. */
  lane: Lane
  ducking: boolean
  /** Jump requests since the last step. */
  jumps: number
}

export type FinishReason = 'lives' | 'time' | 'distance'

export type SimEvent =
  | { type: 'jump' }
  | { type: 'slide' }
  | { type: 'lane'; lane: Lane }
  | { type: 'coin'; kind: 'coin' | 'star'; combo: number }
  | { type: 'close-call' }
  | { type: 'cleared'; row: number; streak: number }
  | { type: 'hit'; livesLeft: number | null; obstacle: ObstacleType; row: number }
  | { type: 'speed-up'; dial: number }
  | { type: 'milestone'; meters: number }
  | { type: 'hint'; move: MoveKind; text: string }
  | { type: 'rest-start' }
  | { type: 'water-break' }
  | { type: 'finished'; reason: FinishReason }

export type ObstacleState = 'active' | 'pending' | 'passed' | 'hit' | 'done'

export interface SimObstacle {
  id: number
  type: ObstacleType
  lanes: Lane[]
  /** Track distance of the near face (m); z relative to the player = at − distance. */
  at: number
  row: number
  hint: MoveKind
  state: ObstacleState
  pendingUntil: number
}

export interface SimCoin {
  id: number
  lane: Lane
  at: number
  y: number
  kind: 'coin' | 'star'
  taken: boolean
}

export interface Particle {
  x: number
  y: number
  at: number
  vx: number
  vy: number
  vat: number
  life: number
  maxLife: number
  kind: 'shard' | 'sparkle'
  color: string
}

export type PlayerState = 'run' | 'jump' | 'slide' | 'hit'

export interface WorldSnapshot {
  distance: number
  speed: number
  speedDial: number
  player: {
    x: number
    lane: Lane
    y: number
    state: PlayerState
    invulnerable: boolean
    /** 0..1 jump progress (for the tuck pose). */
    jumpProgress: number
    /** Run cycle in cycles (use sin(2π·runPhase)). */
    runPhase: number
  }
  obstacles: readonly SimObstacle[]
  coins: readonly SimCoin[]
  particles: readonly Particle[]
  showHints: boolean
  score: number
  coinsCollected: number
  lives: number | null
  livesMax: number | null
  streak: number
  elapsedS: number
  /** Seconds left in a timed run, or meters left in a distance run. */
  remaining: { seconds?: number; meters?: number }
  shake: number
}

export interface RunStats {
  score: number
  distance: number
  timeS: number
  coins: number
  stars: number
  cleared: number
  hits: number
  closeCalls: number
  longestStreak: number
  topDial: number
  jumps: number
  ducks: number
  laneChanges: number
  finished: FinishReason | null
}

export interface SimOptions {
  seed: number
  /** Training: no generator, rows come from {@linkcode RunnerSim.spawnRow}. */
  scripted?: boolean
  startLane?: Lane
}

const MAX_PARTICLES = 60
const SHAKE_S = 0.15

/**
 * The endless-runner world. Pure TS, fixed time step, no clocks inside: time only advances
 * through {@linkcode step}. Same input + seed → same run.
 */
export class RunnerSim {
  readonly config: RunConfig
  private rng: Rng
  private generator: TrackGenerator | null
  private speedCtl: SpeedController

  time = 0
  distance = 0
  private speed: number
  private dial: number
  private raw = 0

  private targetLane: Lane
  private x: number
  private jumpT: number | null = null
  private slideUntil = 0
  private sliding = false
  private prevDucking = false
  private invulnerableUntil = 0
  private hitUntil = 0
  private shakeUntil = 0
  private runPhase = 0

  readonly obstacles: SimObstacle[] = []
  readonly coins: SimCoin[] = []
  readonly particles: Particle[] = Array.from({ length: MAX_PARTICLES }, () => ({
    x: 0, y: 0, at: 0, vx: 0, vy: 0, vat: 0, life: 0, maxLife: 1, kind: 'sparkle' as const, color: '#fff',
  }))
  private nextId = 1
  private rowRemaining = new Map<number, number>()
  private rowsHit = new Set<number>()
  private rowsHinted = new Set<number>()
  private nextRestAt: number
  private nextWaterAt = WATER_BREAK_EVERY_S
  private lastMilestone = 0
  private coinCombo = 0
  private lastCoinAt = -Infinity

  lives: number | null
  finished: FinishReason | null = null
  private s = {
    coins: 0,
    stars: 0,
    cleared: 0,
    hits: 0,
    closeCalls: 0,
    streak: 0,
    longestStreak: 0,
    topDial: 0,
    jumps: 0,
    ducks: 0,
    laneChanges: 0,
  }

  constructor(config: RunConfig, opts: SimOptions) {
    this.config = config
    this.rng = new Rng(opts.seed)
    this.speedCtl = new SpeedController(config)
    this.dial = config.startDial
    this.speed = dialToSpeed(this.dial)
    this.s.topDial = this.dial
    this.targetLane = this.laneMoves ? (opts.startLane ?? 0) : 0
    this.x = laneX(this.targetLane)
    this.lives = config.livesMax
    this.nextRestAt = config.restBreak?.everyS ?? Infinity
    const startAt = START_SAFE_S * this.speed
    this.generator = opts.scripted
      ? null
      : new TrackGenerator(config, new Rng(this.rng.int(1, 2 ** 31)), startAt, this.targetLane)
    if (!opts.scripted) {
      for (let at = 14; at < startAt - 4; at += COIN_SPACING_M) this.addCoin(this.targetLane, at, COIN_Y, 'coin')
    }
  }

  get laneMoves() {
    return this.config.enabledMoves.includes('lane')
  }

  private enabled(m: MoveKind) {
    return this.config.enabledMoves.includes(m)
  }

  step(dt: number, input: SimInput): SimEvent[] {
    const ev: SimEvent[] = []
    if (this.finished) return ev
    this.time += dt
    const t = this.time

    const stage = this.speedCtl.update(t)
    if (stage !== null) ev.push({ type: 'speed-up', dial: stage })
    this.dial = this.speedCtl.dial(t)
    this.speed = dialToSpeed(this.dial)
    if (this.dial > this.s.topDial) this.s.topDial = this.dial

    // Input
    const wantLane: Lane = this.laneMoves ? input.lane : 0
    const laneChanged = wantLane !== this.targetLane
    if (laneChanged) {
      this.targetLane = wantLane
      this.s.laneChanges++
      ev.push({ type: 'lane', lane: wantLane })
    }
    let jumped = false
    if (input.jumps > 0 && this.enabled('jump') && this.jumpT === null) {
      this.jumpT = 0
      this.slideUntil = 0
      this.s.jumps++
      jumped = true
      ev.push({ type: 'jump' })
    }
    const ducking = input.ducking && this.enabled('duck')
    const duckStart = ducking && !this.prevDucking
    this.prevDucking = ducking
    let slideStarted = false
    if (duckStart && this.jumpT === null) {
      this.slideUntil = t + this.config.minSlideS
      this.s.ducks++
      slideStarted = true
      ev.push({ type: 'slide' })
    }

    // A correct move that arrives within the grace window still counts ("Close call!").
    for (const o of this.obstacles) {
      if (o.state !== 'pending') continue
      const move = avoidingMove(o.type)
      const saved =
        (move === 'jump' && jumped) ||
        (move === 'duck' && slideStarted) ||
        (move === 'lane' && laneChanged && !o.lanes.includes(wantLane))
      if (!saved) continue
      if (move === 'jump') this.jumpT = this.config.jumpAirS * 0.2
      if (move === 'lane') this.x = laneX(wantLane)
      o.state = 'passed'
      this.s.closeCalls++
      this.raw += POINTS.closeCall
      ev.push({ type: 'close-call' })
    }

    // Advance
    const dm = this.speed * dt
    this.distance += dm
    this.raw += distancePoints(dm, this.speed)
    this.runPhase += (dt * this.speed) / 2.4
    const tx = laneX(this.targetLane)
    const maxStep = (LANE_SPACING / LANE_EASE_S) * dt
    this.x += Math.max(-maxStep, Math.min(maxStep, tx - this.x))
    if (this.jumpT !== null) {
      this.jumpT += dt
      if (this.jumpT >= this.config.jumpAirS) this.jumpT = null
    }
    this.sliding = this.jumpT === null && (ducking || t < this.slideUntil)
    const p = this.jumpT === null ? 0 : this.jumpT / this.config.jumpAirS
    const y = this.jumpT === null ? 0 : 4 * JUMP_HEIGHT * p * (1 - p)
    const body = { x: this.x, y, sliding: this.sliding }
    const invulnerable = t < this.invulnerableUntil

    this.fillTrack()

    // Collisions
    for (const o of this.obstacles) {
      if (o.state === 'done' || o.state === 'hit') continue
      const z = o.at - this.distance
      const overlap = overlapsPlayer(z, o.type)
      if (o.state === 'active' && overlap && wouldHit(o.type, o.lanes, body)) {
        if (invulnerable) o.state = 'passed'
        else if (this.config.graceMs > 0) {
          o.state = 'pending'
          o.pendingUntil = t + this.config.graceMs / 1000
        } else this.hit(o, ev)
      } else if (o.state === 'pending') {
        if (overlap && !wouldHit(o.type, o.lanes, body)) o.state = 'passed'
        else if (t >= o.pendingUntil) {
          if (t < this.invulnerableUntil) o.state = 'passed'
          else this.hit(o, ev)
        }
      }
      if (z + OBSTACLE_SHAPES[o.type].depth < -PLAYER_DEPTH / 2 && (o.state === 'active' || o.state === 'passed')) {
        o.state = 'done'
        this.rowDone(o.row, ev)
      }
    }
    if (this.finished) return ev

    // Coins
    const top = playerTop(body)
    const lane = laneFromX(this.x)
    for (const c of this.coins) {
      if (c.taken) continue
      const z = c.at - this.distance
      if (Math.abs(z) > 0.5 || c.lane !== lane || c.y < y - 0.3 || c.y > top + 0.3) continue
      c.taken = true
      this.coinCombo = t - this.lastCoinAt < 0.6 ? this.coinCombo + 1 : 0
      this.lastCoinAt = t
      if (c.kind === 'star') {
        this.s.stars++
        this.raw += POINTS.star
      } else {
        this.s.coins++
        this.raw += POINTS.coin
      }
      this.burst(laneX(c.lane), c.y, c.at, 'sparkle', c.kind === 'star' ? 12 : 5, c.kind === 'star' ? '#FFFFFF' : '#FFD34D')
      ev.push({ type: 'coin', kind: c.kind, combo: this.coinCombo })
    }

    this.hints(ev)

    const milestone = Math.floor(this.distance / MILESTONE_EVERY_M)
    if (milestone > this.lastMilestone) {
      this.lastMilestone = milestone
      ev.push({ type: 'milestone', meters: milestone * MILESTONE_EVERY_M })
    }
    if (t >= this.nextWaterAt) {
      this.nextWaterAt += WATER_BREAK_EVERY_S
      ev.push({ type: 'water-break' })
    }

    const limit = this.config.sessionLimit
    if (limit.seconds !== undefined && t >= limit.seconds) this.finish('time', ev)
    else if (limit.meters !== undefined && this.distance >= limit.meters) this.finish('distance', ev)
    else if (t >= this.nextRestAt) {
      this.nextRestAt += this.config.restBreak!.everyS
      ev.push({ type: 'rest-start' })
    }

    this.updateParticles(dt)
    this.cull()
    return ev
  }

  private fillTrack() {
    if (!this.generator) return
    const until = this.distance + SPAWN_DISTANCE
    if (this.generator.nextAt >= until) return
    const stagesUp = Math.floor((this.speedCtl.baseDial - this.config.startDial) / 2)
    const level = 1 + Math.floor(this.time / 60) + stagesUp
    const { obstacles, coins } = this.generator.fill(until, {
      speed: Math.max(this.speed, this.speedCtl.lookaheadSpeed()),
      level: Math.min(this.config.maxPatternLevel, level),
      densityScale: Math.max(0.75, 1 - 0.1 * stagesUp),
    })
    for (const o of obstacles) this.addObstacle(o.type, o.lanes, o.at, o.row, o.hint)
    for (const c of coins) this.addCoin(c.lane, c.at, c.y, c.kind)
  }

  private addObstacle(type: ObstacleType, lanes: Lane[], at: number, row: number, hint: MoveKind) {
    this.obstacles.push({ id: this.nextId++, type, lanes, at, row, hint, state: 'active', pendingUntil: 0 })
    this.rowRemaining.set(row, (this.rowRemaining.get(row) ?? 0) + 1)
  }

  private addCoin(lane: Lane, at: number, y: number, kind: 'coin' | 'star') {
    this.coins.push({ id: this.nextId++, lane, at, y, kind, taken: false })
  }

  private rowSeq = 1_000_000

  /** Training: places one row of obstacles `aheadM` meters ahead. Returns its row id. */
  spawnRow(type: ObstacleType, lanes: Lane[], aheadM: number): number {
    const row = this.rowSeq++
    this.addObstacle(type, lanes, this.distance + aheadM, row, avoidingMove(type))
    return row
  }

  private rowDone(row: number, ev: SimEvent[]) {
    const left = (this.rowRemaining.get(row) ?? 1) - 1
    if (left > 0) {
      this.rowRemaining.set(row, left)
      return
    }
    this.rowRemaining.delete(row)
    if (this.rowsHit.has(row)) {
      this.rowsHit.delete(row)
      return
    }
    this.s.cleared++
    this.s.streak++
    if (this.s.streak > this.s.longestStreak) this.s.longestStreak = this.s.streak
    this.raw += clearedPoints(this.s.streak)
    ev.push({ type: 'cleared', row, streak: this.s.streak })
  }

  private hit(o: SimObstacle, ev: SimEvent[]) {
    o.state = 'hit'
    this.rowsHit.add(o.row)
    this.rowDone(o.row, ev)
    this.s.hits++
    this.s.streak = 0
    this.invulnerableUntil = this.time + INVULNERABLE_S
    this.hitUntil = this.time + HIT_STUMBLE_S
    this.shakeUntil = this.time + SHAKE_S
    this.speedCtl.hit(this.time)
    const shape = OBSTACLE_SHAPES[o.type]
    this.burst(this.x, (shape.bottom + shape.top) / 2, o.at, 'shard', 14, shape.color)
    if (this.lives !== null) this.lives = Math.max(0, this.lives - 1)
    ev.push({ type: 'hit', livesLeft: this.lives, obstacle: o.type, row: o.row })
    if (this.lives === 0) this.finish('lives', ev)
  }

  private finish(reason: FinishReason, ev: SimEvent[]) {
    if (this.finished) return
    this.finished = reason
    ev.push({ type: 'finished', reason })
  }

  private hints(ev: SimEvent[]) {
    const showHints = this.config.moveHints !== 'off'
    if (!showHints) return
    for (const o of this.obstacles) {
      if (o.state !== 'active' || this.rowsHinted.has(o.row)) continue
      const z = o.at - this.distance
      if (z <= 0 || z / this.speed > HINT_LEAD_S) continue
      if (!o.lanes.includes(this.targetLane)) continue
      this.rowsHinted.add(o.row)
      if (o.type === 'hurdle') ev.push({ type: 'hint', move: 'jump', text: 'Jump!' })
      else if (o.type === 'bar') ev.push({ type: 'hint', move: 'duck', text: 'Duck!' })
      else {
        const blocked = new Set(this.obstacles.filter((k) => k.row === o.row && k.type === 'wall').flatMap((k) => k.lanes))
        const open = LANES.filter((l) => !blocked.has(l)).sort((a, b) => Math.abs(a - this.targetLane) - Math.abs(b - this.targetLane))
        const target = open[0]
        if (target === undefined) continue
        ev.push({ type: 'hint', move: 'lane', text: target < this.targetLane ? 'Go left!' : 'Go right!' })
      }
    }
  }

  private burst(x: number, y: number, at: number, kind: Particle['kind'], count: number, color: string) {
    let made = 0
    for (const p of this.particles) {
      if (made >= count) break
      if (p.life > 0) continue
      p.x = x
      p.y = y
      p.at = at
      p.vx = this.rng.range(-3, 3)
      p.vy = this.rng.range(1, kind === 'shard' ? 6 : 3)
      p.vat = this.rng.range(-2, 4)
      p.maxLife = kind === 'shard' ? 0.7 : 0.45
      p.life = p.maxLife
      p.kind = kind
      p.color = color
      made++
    }
  }

  private updateParticles(dt: number) {
    for (const p of this.particles) {
      if (p.life <= 0) continue
      p.life -= dt
      p.x += p.vx * dt
      p.y = Math.max(0, p.y + p.vy * dt)
      p.vy -= 12 * dt
      p.at += p.vat * dt
    }
  }

  private cull() {
    const minAt = this.distance + CULL_BEHIND
    if (this.obstacles.length && this.obstacles[0].at < minAt) {
      let i = 0
      while (i < this.obstacles.length && this.obstacles[i].at < minAt) {
        const o = this.obstacles[i]
        if (o.state !== 'done' && o.state !== 'hit') this.rowRemaining.delete(o.row)
        i++
      }
      this.obstacles.splice(0, i)
    }
    if (this.coins.length && this.coins[0].at < minAt) {
      let i = 0
      while (i < this.coins.length && this.coins[i].at < minAt) i++
      this.coins.splice(0, i)
    }
  }

  /**
   * Removes obstacles in the next `seconds` of track (after a resume or rest break), so the
   * player always gets an obstacle-free start.
   */
  clearAhead(seconds = START_SAFE_S) {
    const until = this.distance + seconds * this.speed
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i]
      if (o.at < until && o.at - this.distance > -2) {
        this.rowRemaining.delete(o.row)
        this.obstacles.splice(i, 1)
      } else if (o.state === 'pending') o.state = 'passed'
    }
    if (this.generator && this.generator.nextAt < until) {
      this.generator.nextAt = until
      this.generator.resetReach(this.targetLane, until - this.config.recoveryS * this.speed)
    }
    this.jumpT = null
    this.slideUntil = 0
  }

  /** Removes everything ahead (rest break: the track empties). */
  clearTrack() {
    this.clearAhead(SPAWN_DISTANCE / Math.max(1, this.speed) + 1)
    for (const c of this.coins) if (c.at > this.distance) c.taken = true
  }

  get score() {
    return finalScore(this.raw, this.config.scoreMultiplier)
  }

  snapshot(): WorldSnapshot {
    const t = this.time
    const state: PlayerState =
      t < this.hitUntil ? 'hit' : this.jumpT !== null ? 'jump' : this.sliding ? 'slide' : 'run'
    const limit = this.config.sessionLimit
    return {
      distance: this.distance,
      speed: this.speed,
      speedDial: this.dial,
      player: {
        x: this.x,
        lane: laneFromX(this.x),
        y: this.jumpT === null ? 0 : 4 * JUMP_HEIGHT * (this.jumpT / this.config.jumpAirS) * (1 - this.jumpT / this.config.jumpAirS),
        state,
        invulnerable: t < this.invulnerableUntil,
        jumpProgress: this.jumpT === null ? 0 : this.jumpT / this.config.jumpAirS,
        runPhase: this.runPhase,
      },
      obstacles: this.obstacles,
      coins: this.coins,
      particles: this.particles,
      showHints: this.config.moveHints !== 'off',
      score: this.score,
      coinsCollected: this.s.coins,
      lives: this.lives,
      livesMax: this.config.livesMax,
      streak: this.s.streak,
      elapsedS: t,
      remaining: {
        seconds: limit.seconds !== undefined ? Math.max(0, limit.seconds - t) : undefined,
        meters: limit.meters !== undefined ? Math.max(0, limit.meters - this.distance) : undefined,
      },
      shake: t < this.shakeUntil ? (this.shakeUntil - t) / SHAKE_S : 0,
    }
  }

  stats(): RunStats {
    return {
      score: this.score,
      distance: this.distance,
      timeS: this.time,
      coins: this.s.coins,
      stars: this.s.stars,
      cleared: this.s.cleared,
      hits: this.s.hits,
      closeCalls: this.s.closeCalls,
      longestStreak: this.s.longestStreak,
      topDial: this.s.topDial,
      jumps: this.s.jumps,
      ducks: this.s.ducks,
      laneChanges: this.s.laneChanges,
      finished: this.finished,
    }
  }
}

import type { FramingResult } from '@/core/pose/framing'
import type { PoseFrame } from '@/core/pose/types'
import { POINTS, type BubbleModeConfig } from '../config/modes'
import { checkReadiness, distanceToSegment, POPPER_RADIUS, readAnchor, readPoppers, type BodyAnchor, type Popper } from './body'
import { comboMultiplier, summarize, type RoundStats, type RoundSummary } from './scoring'

export type BubblePhase = 'get-ready' | 'countdown' | 'playing' | 'finished'
export type BubbleKind = 'normal' | 'golden' | 'bomb'

/** A bubble as drawn, in canonical normalized coordinates (radius in image-height units). */
export interface Bubble {
  id: number
  kind: BubbleKind
  /** Spawned near the floor: meant to be kicked. */
  low: boolean
  x: number
  y: number
  r: number
  /** 1 when it appears → 0 when it bursts on its own. */
  life: number
}

interface LiveBubble extends Bubble {
  x0: number
  y0: number
  bornAt: number
  expiresAt: number
  wobble: number
}

export interface PopEffect {
  id: number
  kind: BubbleKind
  x: number
  y: number
  r: number
  text: string
  ageMs: number
}

export interface VisibleArea {
  left: number
  right: number
  top: number
  bottom: number
}

export type BubbleEvent =
  | { type: 'countdown-tick'; value: number }
  | { type: 'go' }
  | { type: 'pop'; kind: 'normal' | 'golden'; points: number; combo: number }
  | { type: 'combo-up'; multiplier: number }
  | { type: 'bomb'; points: number }
  | { type: 'miss' }
  | { type: 'tracking-lost' }
  | { type: 'tracking-back' }
  | { type: 'finished'; summary: RoundSummary }

export interface BubbleSnapshot {
  phase: BubblePhase
  readiness: FramingResult
  /** 3, 2, 1 during the countdown. */
  countdown: number
  /** False while the player is out of view (the round clock is frozen). */
  tracking: boolean
  timeLeftMs: number
  durationMs: number
  score: number
  combo: number
  multiplier: number
  bubbles: Bubble[]
  effects: PopEffect[]
  poppers: Popper[]
  summary: RoundSummary | null
}

const READY_HOLD_MS = 1200
const COUNTDOWN_FROM = 3
const FIRST_SPAWN_MS = 400
/** Clearing the screen brings the next bubble sooner, so quick players get more bubbles. */
const EMPTY_SPAWN_MS = 300
/** Brief tracking dropouts don't freeze the round. */
const TRACKING_GRACE_MS = 400
const EFFECT_MS = 650
const MAX_DT_MS = 100
/** Hand positions further apart in time than this aren't joined into a swipe. */
const SWEEP_MAX_GAP_MS = 250
const EDGE_MARGIN = 0.02
const SPAWN_ATTEMPTS = 12

const lerp = (range: readonly [number, number], t: number) => range[0] + (range[1] - range[0]) * Math.min(1, Math.max(0, t))
const clamp = (v: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)))

/**
 * One round of Bubble Pop. Bubbles appear within arm's reach of the player (and near the feet
 * in modes with kicking), and pop when a hand or foot passes through them. Pure logic: feed it
 * pose frames with `update` and render `snapshot()`.
 */
export class BubbleGame {
  phase: BubblePhase = 'get-ready'
  /** The pose most recently passed to `update`. */
  lastFrame: PoseFrame | null = null
  private readonly random: () => number
  private lastNow: number | null = null
  private paused = false
  private readyMs = 0
  private countdownMs = 0
  private countdownValue = COUNTDOWN_FROM
  /** Round clock: only runs while playing and the player is in view. */
  private elapsed = 0
  private nextSpawnAt = FIRST_SPAWN_MS
  private nextId = 1
  private bubbles: LiveBubble[] = []
  private effects: PopEffect[] = []
  private poppers: Popper[] = []
  private prevPoppers = new Map<Popper['id'], { x: number; y: number; at: number }>()
  private anchor: BodyAnchor | null = null
  private aspect = 3 / 4
  private lostMs = 0
  private tracking = true
  private readiness: FramingResult = { ok: false, issue: 'no-person', message: 'Step into view of the camera' }
  private score = 0
  private combo = 0
  private stats: RoundStats = { popped: 0, golden: 0, missed: 0, bombs: 0, bestCombo: 0 }
  private visible: VisibleArea = { left: 0, right: 1, top: 0, bottom: 1 }
  private summary: RoundSummary | null = null

  constructor(
    readonly mode: BubbleModeConfig,
    opts: { random?: () => number } = {},
  ) {
    this.random = opts.random ?? Math.random
  }

  /** The part of the camera image that is on screen; bubbles only spawn inside it. */
  setVisibleArea(area: VisibleArea) {
    this.visible = area
  }

  pause() {
    this.paused = true
  }

  resume() {
    this.paused = false
    this.lastNow = null
    this.prevPoppers.clear()
  }

  update(now: number, frame: PoseFrame | null): BubbleEvent[] {
    const events: BubbleEvent[] = []
    if (this.paused || this.phase === 'finished') return events
    const dt = this.lastNow === null ? 0 : Math.min(MAX_DT_MS, Math.max(0, now - this.lastNow))
    this.lastNow = now
    this.lastFrame = frame

    if (frame && frame.imageHeight > 0) this.aspect = frame.imageWidth / frame.imageHeight
    this.anchor = readAnchor(frame)
    const poppers = readPoppers(frame, this.mode.feet)

    if (this.phase === 'get-ready') {
      this.readiness = checkReadiness(frame, this.mode.feet)
      this.readyMs = this.readiness.ok ? this.readyMs + dt : 0
      if (this.readyMs >= READY_HOLD_MS) {
        this.phase = 'countdown'
        this.countdownMs = 0
        this.countdownValue = COUNTDOWN_FROM
        events.push({ type: 'countdown-tick', value: COUNTDOWN_FROM })
      }
    } else if (this.phase === 'countdown') {
      this.countdownMs += dt
      const value = COUNTDOWN_FROM - Math.floor(this.countdownMs / 1000)
      if (value <= 0) {
        this.phase = 'playing'
        events.push({ type: 'go' })
      } else if (value !== this.countdownValue) {
        this.countdownValue = value
        events.push({ type: 'countdown-tick', value })
      }
    } else {
      this.play(dt, now, poppers, events)
    }

    for (const e of this.effects) e.ageMs += dt
    this.effects = this.effects.filter((e) => e.ageMs < EFFECT_MS)
    this.poppers = poppers
    this.prevPoppers = new Map(poppers.map((p) => [p.id, { x: p.x, y: p.y, at: now }]))
    return events
  }

  snapshot(): BubbleSnapshot {
    return {
      phase: this.phase,
      readiness: this.readiness,
      countdown: this.countdownValue,
      tracking: this.tracking,
      timeLeftMs: Math.max(0, this.mode.durationMs - this.elapsed),
      durationMs: this.mode.durationMs,
      score: this.score,
      combo: this.combo,
      multiplier: comboMultiplier(this.combo),
      bubbles: this.bubbles.map(({ id, kind, low, x, y, r, life }) => ({ id, kind, low, x, y, r, life })),
      effects: this.effects.map((e) => ({ ...e })),
      poppers: this.poppers,
      summary: this.summary,
    }
  }

  private play(dt: number, now: number, poppers: Popper[], events: BubbleEvent[]) {
    if (this.anchor) {
      this.lostMs = 0
      if (!this.tracking) {
        this.tracking = true
        events.push({ type: 'tracking-back' })
      }
    } else {
      this.lostMs += dt
      if (this.tracking && this.lostMs > TRACKING_GRACE_MS) {
        this.tracking = false
        events.push({ type: 'tracking-lost' })
      }
    }
    if (!this.tracking) return

    this.elapsed += dt
    this.moveAndExpire(events)
    this.checkHits(now, poppers, events)

    if (this.elapsed >= this.nextSpawnAt && this.bubbles.length < this.mode.maxBubbles && this.anchor) {
      const progress = this.elapsed / this.mode.durationMs
      if (this.spawn(this.anchor, poppers, progress)) this.nextSpawnAt = this.elapsed + lerp(this.mode.spawnIntervalMs, progress)
    }

    if (this.elapsed >= this.mode.durationMs) {
      this.phase = 'finished'
      this.bubbles = []
      this.summary = summarize(this.mode, this.score, this.stats)
      events.push({ type: 'finished', summary: this.summary })
    }
  }

  private moveAndExpire(events: BubbleEvent[]) {
    const alive: LiveBubble[] = []
    for (const b of this.bubbles) {
      if (this.elapsed >= b.expiresAt) {
        if (b.kind !== 'bomb') {
          this.stats.missed++
          this.combo = 0
          events.push({ type: 'miss' })
        }
        continue
      }
      const age = this.elapsed - b.bornAt
      b.x = b.x0 + (Math.sin(age / 650 + b.wobble) * 0.006) / this.aspect
      b.y = b.y0 + Math.sin(age / 900 + b.wobble * 2) * 0.008
      b.life = 1 - age / (b.expiresAt - b.bornAt)
      alive.push(b)
    }
    this.bubbles = alive
  }

  private checkHits(now: number, poppers: Popper[], events: BubbleEvent[]) {
    const a = this.aspect
    for (const p of poppers) {
      const prev = this.prevPoppers.get(p.id)
      const from = prev && now - prev.at <= SWEEP_MAX_GAP_MS ? prev : p
      const reach = POPPER_RADIUS[p.kind]
      for (const b of [...this.bubbles]) {
        const d = distanceToSegment(b.x * a, b.y, from.x * a, from.y, p.x * a, p.y)
        if (d <= b.r + reach) this.pop(b, events)
      }
    }
  }

  private pop(b: LiveBubble, events: BubbleEvent[]) {
    this.bubbles = this.bubbles.filter((o) => o !== b)
    let text: string
    if (b.kind === 'bomb') {
      this.score = Math.max(0, this.score + POINTS.bomb)
      this.combo = 0
      this.stats.bombs++
      text = `${POINTS.bomb}`
      events.push({ type: 'bomb', points: POINTS.bomb })
    } else {
      const before = comboMultiplier(this.combo)
      this.combo++
      this.stats.bestCombo = Math.max(this.stats.bestCombo, this.combo)
      const multiplier = comboMultiplier(this.combo)
      const points = POINTS[b.kind] * multiplier
      this.score += points
      this.stats.popped++
      if (b.kind === 'golden') this.stats.golden++
      text = `+${points}`
      events.push({ type: 'pop', kind: b.kind, points, combo: this.combo })
      if (multiplier > before) events.push({ type: 'combo-up', multiplier })
    }
    this.effects.push({ id: b.id, kind: b.kind, x: b.x, y: b.y, r: b.r, text, ageMs: 0 })
    if (this.bubbles.length === 0) this.nextSpawnAt = Math.min(this.nextSpawnAt, this.elapsed + EMPTY_SPAWN_MS)
  }

  private spawn(anchor: BodyAnchor, poppers: Popper[], progress: number): boolean {
    const m = this.mode
    const a = this.aspect
    const r = m.radius
    const rand = (lo: number, hi: number) => lo + this.random() * (hi - lo)
    const kind: BubbleKind = this.random() < m.bombChance ? 'bomb' : this.random() < m.goldenChance ? 'golden' : 'normal'
    const low = m.feet && this.random() < m.lowChance
    const v = this.visible
    const minX = v.left * a + r + EDGE_MARGIN
    const maxX = v.right * a - r - EDGE_MARGIN
    const minY = v.top + r + EDGE_MARGIN
    const maxY = v.bottom - r - EDGE_MARGIN

    for (let attempt = 0; attempt < SPAWN_ATTEMPTS; attempt++) {
      let X: number
      let Y: number
      if (low) {
        const side = this.random() < 0.5 ? -1 : 1
        X = anchor.hipX * a + side * anchor.torso * rand(0.55, 0.95)
        Y = anchor.groundY - anchor.torso * rand(0.05, 0.35)
      } else {
        // Around the shoulders, anywhere from out to the side to overhead, never where
        // resting hands hang. Overhead bubbles sit higher so they clear the head.
        const deg = rand(-125, 125)
        const angle = (deg * Math.PI) / 180
        const dist = anchor.torso * rand(Math.abs(deg) < 35 ? 1.0 : 0.75, 1.2)
        X = anchor.shoulderX * a + Math.sin(angle) * dist
        Y = anchor.shoulderY - Math.cos(angle) * dist
      }
      X = clamp(X, minX, maxX)
      Y = clamp(Y, minY, maxY)
      const overlaps = this.bubbles.some((b) => Math.hypot(b.x * a - X, b.y - Y) < (b.r + r) * 1.15)
      const onAHand = poppers.some((p) => Math.hypot(p.x * a - X, p.y - Y) < r + POPPER_RADIUS[p.kind] + 0.05)
      if (overlaps || onAHand) continue

      const x = X / a
      this.bubbles.push({
        id: this.nextId++,
        kind,
        low,
        x,
        y: Y,
        x0: x,
        y0: Y,
        r,
        life: 1,
        bornAt: this.elapsed,
        expiresAt: this.elapsed + lerp(m.lifetimeMs, progress),
        wobble: this.random() * Math.PI * 2,
      })
      return true
    }
    return false
  }
}

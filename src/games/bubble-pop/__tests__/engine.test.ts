import { LM } from '@/core/pose/landmarks'
import { NEUTRAL_SKELETON, skeletonToFrame } from '@/core/pose/skeleton'
import type { PoseFrame } from '@/core/pose/types'
import { MODES, type BubbleModeConfig } from '../config/modes'
import { readAnchor } from '../engine/body'
import { BubbleGame, type Bubble, type BubbleEvent } from '../engine/bubbleGame'
import { createRng } from '../engine/rng'

const W = 480
const H = 640
const STEP = 33

function standing(): PoseFrame {
  return skeletonToFrame(NEUTRAL_SKELETON, 'front', { imageWidth: W, imageHeight: H })
}

/** Standing pose with the right hand's palm moved to (x, y). */
function handAt(x: number, y: number): PoseFrame {
  const f = standing()
  for (const i of [LM.rightWrist, LM.rightIndex, LM.rightPinky]) f.landmarks[i] = { ...f.landmarks[i], x, y }
  return f
}

function mode(overrides: Partial<BubbleModeConfig> = {}): BubbleModeConfig {
  return { ...MODES.classic, ...overrides }
}

class Harness {
  now = 0
  events: BubbleEvent[] = []
  constructor(readonly game: BubbleGame) {}

  step(frame: PoseFrame | null, ms = STEP) {
    this.now += ms
    this.events.push(...this.game.update(this.now, frame))
  }

  run(ms: number, frame: () => PoseFrame | null = standing) {
    const end = this.now + ms
    while (this.now < end) this.step(frame())
  }

  /** Stands still through get-ready and the countdown. */
  start() {
    this.run(1300)
    expect(this.game.phase).toBe('countdown')
    this.run(3100)
    expect(this.game.phase).toBe('playing')
    return this
  }

  waitForBubble(): Bubble {
    for (let i = 0; i < 200 && this.game.snapshot().bubbles.length === 0; i++) this.step(standing())
    const b = this.game.snapshot().bubbles[0]
    expect(b).toBeDefined()
    return b
  }
}

const harness = (m: BubbleModeConfig = mode(), seed = 7) => new Harness(new BubbleGame(m, { random: createRng(seed) }))

describe('BubbleGame', () => {
  it('waits for the player, counts down 3-2-1, then starts', () => {
    const h = harness()
    h.run(2000, () => null)
    expect(h.game.phase).toBe('get-ready')
    h.start()
    expect(h.events.filter((e) => e.type === 'countdown-tick').map((e) => (e as { value: number }).value)).toEqual([3, 2, 1])
    expect(h.events.some((e) => e.type === 'go')).toBe(true)
  })

  it('spawns bubbles within reach and inside the visible area', () => {
    const h = harness(mode({ bombChance: 0, maxBubbles: 5 }))
    h.game.setVisibleArea({ left: 0.2, right: 0.8, top: 0, bottom: 1 })
    h.start()
    const anchor = readAnchor(standing())!
    const seen = new Map<number, Bubble>()
    for (let i = 0; i < 300; i++) {
      h.step(standing())
      for (const b of h.game.snapshot().bubbles) if (!seen.has(b.id)) seen.set(b.id, b)
    }
    expect(seen.size).toBeGreaterThanOrEqual(8)
    const aspect = W / H
    for (const b of seen.values()) {
      expect(b.x - b.r / aspect).toBeGreaterThanOrEqual(0.2)
      expect(b.x + b.r / aspect).toBeLessThanOrEqual(0.8)
      const dist = Math.hypot((b.x - anchor.shoulderX) * aspect, b.y - anchor.shoulderY)
      expect(dist).toBeLessThan(anchor.torso * 1.3)
    }
  })

  it('pops a bubble the hand touches and builds a combo multiplier', () => {
    const h = harness(mode({ bombChance: 0, goldenChance: 0 }))
    h.start()
    const points: number[] = []
    for (let i = 0; i < 6; i++) {
      const b = h.waitForBubble()
      h.step(handAt(b.x, b.y))
      const pop = h.events.filter((e) => e.type === 'pop').at(-1) as Extract<BubbleEvent, { type: 'pop' }>
      points.push(pop.points)
      h.step(standing())
    }
    expect(points).toEqual([10, 10, 10, 10, 20, 20])
    expect(h.events.some((e) => e.type === 'combo-up')).toBe(true)
    expect(h.game.snapshot().score).toBe(80)
  })

  it('pops a bubble a fast swipe passes through between frames', () => {
    const h = harness(mode({ bombChance: 0 }))
    h.start()
    const b = h.waitForBubble()
    const gap = (b.r + 0.1) / (W / H)
    h.step(handAt(b.x - gap, b.y))
    expect(h.game.snapshot().bubbles.some((o) => o.id === b.id)).toBe(true)
    h.step(handAt(b.x + gap, b.y))
    expect(h.game.snapshot().bubbles.some((o) => o.id === b.id)).toBe(false)
  })

  it('bombs cost points (never below zero) and break the combo', () => {
    const h = harness(mode({ bombChance: 1 }))
    h.start()
    const b = h.waitForBubble()
    expect(b.kind).toBe('bomb')
    h.step(handAt(b.x, b.y))
    const s = h.game.snapshot()
    expect(s.score).toBe(0)
    expect(s.combo).toBe(0)
    expect(h.events.some((e) => e.type === 'bomb')).toBe(true)
  })

  it('counts a bubble that bursts on its own as a miss', () => {
    const h = harness(mode({ bombChance: 0, maxBubbles: 1, lifetimeMs: [1000, 1000] }))
    h.start()
    h.waitForBubble()
    h.run(1200)
    expect(h.events.some((e) => e.type === 'miss')).toBe(true)
  })

  it('freezes the round clock while the player is out of view', () => {
    const h = harness()
    h.start()
    h.run(1000)
    h.run(600, () => null)
    const frozen = h.game.snapshot()
    expect(frozen.tracking).toBe(false)
    h.run(3000, () => null)
    expect(h.game.snapshot().timeLeftMs).toBe(frozen.timeLeftMs)
    h.run(200)
    expect(h.game.snapshot().tracking).toBe(true)
  })

  it('does not advance while paused', () => {
    const h = harness()
    h.start()
    h.run(500)
    const before = h.game.snapshot().timeLeftMs
    h.game.pause()
    h.run(5000)
    h.game.resume()
    h.step(standing())
    expect(h.game.snapshot().timeLeftMs).toBe(before)
  })

  it('finishes after the round time with a summary', () => {
    const h = harness(mode({ durationMs: 5000 }))
    h.start()
    h.run(5200)
    expect(h.game.phase).toBe('finished')
    const done = h.events.find((e) => e.type === 'finished') as Extract<BubbleEvent, { type: 'finished' }>
    expect(done.summary.mode).toBe('classic')
    expect(h.game.snapshot().bubbles).toHaveLength(0)
  })
})

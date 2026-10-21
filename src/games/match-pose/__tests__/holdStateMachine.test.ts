import { HoldTracker, type HoldConfig } from '../engine/holdStateMachine'

const config = (overrides: Partial<HoldConfig> = {}): HoldConfig => ({
  holdMs: 1000,
  enterThreshold: 0.8,
  exitThreshold: 0.72,
  graceMs: 300,
  breakBehavior: 'reset',
  ...overrides,
})

function feed(tracker: HoldTracker, from: number, to: number, score: number, step = 50) {
  const events = []
  for (let t = from; t <= to; t += step) {
    const e = tracker.update(t, score)
    if (e) events.push({ t, e })
  }
  return events
}

describe('HoldTracker', () => {
  it('starts holding above the enter threshold and completes after holdMs', () => {
    const tracker = new HoldTracker(config())
    const events = feed(tracker, 0, 1100, 0.9)
    expect(events[0]).toEqual({ t: 0, e: 'hold-start' })
    expect(events.at(-1)).toEqual({ t: 1000, e: 'hold-complete' })
    expect(tracker.state).toBe('complete')
    expect(tracker.accuracy).toBeCloseTo(0.9)
  })

  it('does not start below the enter threshold', () => {
    const tracker = new HoldTracker(config())
    expect(feed(tracker, 0, 2000, 0.78)).toEqual([])
    expect(tracker.state).toBe('idle')
  })

  it('keeps holding through scores between exit and enter thresholds (hysteresis)', () => {
    const tracker = new HoldTracker(config())
    feed(tracker, 0, 400, 0.85)
    expect(feed(tracker, 450, 800, 0.75)).toEqual([])
    expect(tracker.state).toBe('holding')
  })

  it('ignores short dips within the grace window', () => {
    const tracker = new HoldTracker(config())
    feed(tracker, 0, 400, 0.9)
    expect(feed(tracker, 450, 650, 0.3)).toEqual([])
    expect(tracker.state).toBe('holding')
  })

  it('resets progress on a real break in reset mode', () => {
    const tracker = new HoldTracker(config())
    feed(tracker, 0, 600, 0.9)
    const events = feed(tracker, 650, 1100, 0.3)
    expect(events.map((e) => e.e)).toEqual(['hold-break'])
    expect(tracker.heldMs).toBe(0)
  })

  it('keeps progress on a break in pause mode', () => {
    const tracker = new HoldTracker(config({ breakBehavior: 'pause' }))
    feed(tracker, 0, 600, 0.9)
    feed(tracker, 650, 1100, 0.3)
    expect(tracker.heldMs).toBeGreaterThan(500)
    const events = feed(tracker, 1150, 1700, 0.9)
    expect(events.map((e) => e.e)).toEqual(['hold-start', 'hold-complete'])
  })

  it('does not count paused time after resetClock', () => {
    const tracker = new HoldTracker(config())
    feed(tracker, 0, 500, 0.9)
    tracker.resetClock()
    tracker.update(10_000, 0.9)
    expect(tracker.heldMs).toBe(500)
  })
})

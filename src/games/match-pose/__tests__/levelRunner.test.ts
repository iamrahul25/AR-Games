import { PoseSimulator } from '@/core/pose/simulator'
import { NEUTRAL_SKELETON, skeletonToFrame } from '@/core/pose/skeleton'
import { getLevel, levelPoses } from '../data/levels'
import { LevelRunner, type RunnerEvent } from '../engine/levelRunner'
import type { LevelDefinition } from '../types'

const STEP = 66

function run(level: LevelDefinition, framer: (runner: LevelRunner, t: number) => ReturnType<PoseSimulator['step']> | null, maxMs = 300_000) {
  const runner = new LevelRunner(level, levelPoses(level))
  const events: RunnerEvent[] = []
  for (let t = 0; t < maxMs && runner.snapshot().phase !== 'finished'; t += STEP) {
    events.push(...runner.update(t, framer(runner, t)))
  }
  return { runner, events }
}

/** A simulated player who copies whatever pose the runner currently asks for. */
function simulatedPlayer() {
  const sim = new PoseSimulator()
  return (runner: LevelRunner, t: number) => {
    const snap = runner.snapshot()
    const posing = snap.phase === 'posing' || snap.phase === 'pose-result'
    sim.setTarget(posing ? { skeleton: snap.pose.skeleton, view: snap.pose.view } : null, t)
    return sim.step(t)
  }
}

describe('LevelRunner', () => {
  it('waits in get-ready until the player is in frame', () => {
    const level = getLevel(1)!
    const { runner } = run(level, () => null, 10_000)
    const snap = runner.snapshot()
    expect(snap.phase).toBe('get-ready')
    expect(snap.framing.issue).toBe('no-person')
  })

  it('counts down 3-2-1 then starts the first pose', () => {
    const level = getLevel(1)!
    const standing = skeletonToFrame(NEUTRAL_SKELETON, 'front', { imageWidth: 480, imageHeight: 640 })
    const { events } = run(level, () => standing, 5_500)
    const types = events.map((e) => (e.type === 'countdown-tick' ? `tick${e.value}` : e.type))
    expect(types.slice(0, 5)).toEqual(['tick3', 'tick2', 'tick1', 'go', 'pose-start'])
  })

  it('misses every pose if the player just stands there', () => {
    const level = getLevel(1)!
    const standing = skeletonToFrame(NEUTRAL_SKELETON, 'front', { imageWidth: 480, imageHeight: 640 })
    const { runner, events } = run(level, () => standing)
    const summary = runner.snapshot().summary!
    expect(summary.passed).toBe(false)
    expect(summary.matched).toBe(0)
    expect(events.filter((e) => e.type === 'pose-miss')).toHaveLength(level.poses.length)
    expect(events.some((e) => e.type === 'cue')).toBe(true)
  })

  it.each([1, 5, 10, 13, 20, 22, 27, 30])('a simulated player can clear level %i', (id) => {
    const level = getLevel(id)!
    const { runner } = run(level, simulatedPlayer())
    const snap = runner.snapshot()
    expect(snap.phase).toBe('finished')
    expect(snap.summary!.passed).toBe(true)
    expect(snap.summary!.matched).toBe(snap.summary!.total)
    expect(snap.score).toBeGreaterThan(0)
  })

  it('ends an attempt level on the first success', () => {
    const level = getLevel(28)!
    const { runner } = run(level, simulatedPlayer())
    const snap = runner.snapshot()
    expect(snap.outcomes).toHaveLength(1)
    expect(snap.summary!.stars).toBe(3)
  })

  it('does not advance while paused', () => {
    const level = getLevel(1)!
    const standing = skeletonToFrame(NEUTRAL_SKELETON, 'front', { imageWidth: 480, imageHeight: 640 })
    const runner = new LevelRunner(level, levelPoses(level))
    for (let t = 0; t < 5_500; t += STEP) runner.update(t, standing)
    expect(runner.snapshot().phase).toBe('posing')
    const before = runner.snapshot().timeLeftMs
    runner.pause(5_500)
    for (let t = 5_500; t < 60_000; t += STEP) runner.update(t, standing)
    runner.resume(60_000)
    runner.update(60_066, standing)
    expect(runner.snapshot().phase).toBe('posing')
    expect(before - runner.snapshot().timeLeftMs).toBeLessThan(500)
  })
})

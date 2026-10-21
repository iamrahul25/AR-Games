import { PRESET_ORDER, PRESETS, resolveRunConfig } from '../config/difficulty'
import { STEP_S } from '../config/world'
import { Autopilot } from '../demo/autopilot'
import { RunnerSim, type SimEvent, type SimInput } from '../engine/sim'
import type { RunConfig } from '../types'

function play(config: RunConfig, seconds: number, seed: number, pilot: ((sim: RunnerSim) => SimInput) | null) {
  const sim = new RunnerSim(config, { seed })
  const events: SimEvent[] = []
  const steps = Math.round(seconds / STEP_S)
  for (let i = 0; i < steps && !sim.finished; i++) {
    const input = pilot ? pilot(sim) : { lane: 0 as const, ducking: false, jumps: 0 }
    events.push(...sim.step(STEP_S, input))
  }
  return { sim, events }
}

function autopilot(config: RunConfig) {
  const ap = new Autopilot(config)
  return (sim: RunnerSim): SimInput => {
    const d = ap.decide(sim.snapshot())
    return { lane: d.lane, ducking: d.duck, jumps: d.jump ? 1 : 0 }
  }
}

describe('RunnerSim', () => {
  it.each(PRESET_ORDER)('a perfect player clears a %s run without being hit', (preset) => {
    const config = { ...resolveRunConfig(PRESETS[preset]), sessionLimit: { seconds: 180 }, restBreak: null }
    for (const seed of [1, 2, 3]) {
      const { sim } = play(config, 200, seed, autopilot(config))
      const stats = sim.stats()
      expect(stats.hits).toBe(0)
      expect(stats.finished).toBe('time')
      expect(stats.cleared).toBeGreaterThan(10)
    }
  })

  it('finishes a 2 minute timed run with a scripted perfect player', () => {
    const config = { ...resolveRunConfig(PRESETS.normal), sessionLimit: { seconds: 120 } }
    const { sim, events } = play(config, 130, 42, autopilot(config))
    expect(sim.stats().hits).toBe(0)
    expect(events.at(-1)).toEqual({ type: 'finished', reason: 'time' })
    expect(sim.stats().timeS).toBeCloseTo(120, 1)
  })

  it('a player who does nothing loses all 3 lives', () => {
    const config = resolveRunConfig(PRESETS.normal)
    const { sim, events } = play(config, 300, 7, null)
    const hits = events.filter((e) => e.type === 'hit')
    expect(hits).toHaveLength(3)
    expect(sim.finished).toBe('lives')
    expect(hits.map((h) => (h.type === 'hit' ? h.livesLeft : -1))).toEqual([2, 1, 0])
  })

  it('has no obstacles in the first 5 seconds', () => {
    const config = resolveRunConfig(PRESETS.athlete)
    const sim = new RunnerSim(config, { seed: 3 })
    sim.step(STEP_S, { lane: 0, ducking: false, jumps: 0 })
    const firstAt = Math.min(...sim.obstacles.map((o) => o.at))
    expect(firstAt / sim.snapshot().speed).toBeGreaterThanOrEqual(5 - 1e-6)
  })

  it('is deterministic for a seed', () => {
    const config = resolveRunConfig(PRESETS.normal)
    const a = play(config, 60, 99, autopilot(config)).sim.stats()
    const b = play(config, 60, 99, autopilot(config)).sim.stats()
    expect(a).toEqual(b)
  })
})

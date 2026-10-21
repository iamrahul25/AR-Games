import { PoseSmoother, SMOOTHING_PRESETS } from '@/core/pose/oneEuroFilter'
import { PoseSimulator } from '@/core/pose/simulator'
import { PRESETS, resolveRunConfig } from '../config/difficulty'
import { DemoBot, type DemoContext } from '../demo/demoBot'
import { RunnerGame, type GameEvent } from '../game/runnerGame'
import type { PresetId, RunConfig } from '../types'

const FRAME_MS = 33
const TICK_MS = 1000 / 60

function runPipeline(config: RunConfig, opts: { training: boolean; seconds: number; seed?: number }) {
  const game = new RunnerGame({ config, showTips: false, training: opts.training, seed: opts.seed ?? 11 })
  const ctx = (): DemoContext => {
    const phase = game.phase
    return {
      world: phase === 'running' || phase === 'training' ? game.world() : null,
      calibration: game.calibration,
      lines: game.motion.lines,
      mode: phase === 'running' || phase === 'countdown' ? 'running' : phase === 'training' ? 'training' : 'stand',
      trainingStep: game.training?.current.id,
    }
  }
  const bot = new DemoBot(config, ctx, { mistakeRate: 0 })
  const sim = new PoseSimulator(480, 640, { reactionSeconds: 0, speedDegPerSec: 900, sloppinessDeg: 2 })
  const smoother = new PoseSmoother(SMOOTHING_PRESETS.responsive)
  const events: GameEvent[] = []
  let nextFrame = 0
  const end = opts.seconds * 1000
  for (let now = 0; now < end && game.phase !== 'over'; now += TICK_MS) {
    if (now >= nextFrame) {
      nextFrame += FRAME_MS
      sim.setTarget(bot.target(now), now)
      events.push(...game.onPose(smoother.smooth(sim.step(now)), now))
    }
    events.push(...game.tick(now))
  }
  return { game, events }
}

const phases = (events: GameEvent[]) =>
  events.flatMap((e) => (e.type === 'session' && e.event.type === 'phase' ? [e.event.phase] : []))

describe('demo bot end-to-end (simulated body → motion → sim)', () => {
  it('calibrates, counts down and runs 60 s on Normal without losing a life', () => {
    const config = { ...resolveRunConfig(PRESETS.normal), sessionLimit: { seconds: 60 }, restBreak: null }
    const { game, events } = runPipeline(config, { training: false, seconds: 75 })
    expect(phases(events)).toEqual(['countdown', 'running', 'over'])
    const stats = game.stats()
    expect(stats.finished).toBe('time')
    expect(stats.hits).toBe(0)
    expect(stats.laneChanges + stats.jumps + stats.ducks).toBeGreaterThan(10)
  })

  it.each<PresetId>(['kids', 'gentle', 'beginner', 'athlete'])('plays a 45 s %s run with at most one hit', (preset) => {
    const config = { ...resolveRunConfig(PRESETS[preset]), sessionLimit: { seconds: 45 }, restBreak: null }
    const { game } = runPipeline(config, { training: false, seconds: 60, seed: 5 })
    expect(game.stats().finished).toBe('time')
    expect(game.stats().hits).toBeLessThanOrEqual(1)
  })

  it('completes the training run, then starts the real run', () => {
    const config = { ...resolveRunConfig(PRESETS.normal), sessionLimit: { seconds: 10 }, restBreak: null }
    const { events } = runPipeline(config, { training: true, seconds: 90 })
    const steps = events.flatMap((e) => (e.type === 'training' && e.event.type === 'success' ? [e.event.step.id] : []))
    expect(steps).toEqual(['left', 'center1', 'right', 'center2', 'jump', 'duck', 'practice'])
    expect(phases(events)).toEqual(['training', 'countdown', 'running', 'over'])
  })

  it('hands-up jumping works through the pipeline', () => {
    const base = resolveRunConfig(PRESETS.beginner)
    const config = { ...base, jumpStyle: 'hands-up' as const, sessionLimit: { seconds: 40 }, restBreak: null }
    const { game } = runPipeline(config, { training: false, seconds: 55, seed: 3 })
    expect(game.stats().jumps).toBeGreaterThan(0)
    expect(game.stats().hits).toBeLessThanOrEqual(1)
  })
})

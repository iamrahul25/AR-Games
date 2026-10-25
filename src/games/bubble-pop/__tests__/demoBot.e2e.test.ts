import { PoseSmoother, SMOOTHING_PRESETS } from '@/core/pose/oneEuroFilter'
import { PoseSimulator } from '@/core/pose/simulator'
import { MODE_IDS, MODES, type BubbleModeId } from '../config/modes'
import { BubbleDemoBot } from '../demo/demoBot'
import { BubbleGame } from '../engine/bubbleGame'
import { createRng } from '../engine/rng'
import type { RoundSummary } from '../engine/scoring'

const FRAME_MS = 33

/** The full pipeline the play screen uses in demo mode: bot → simulator → smoother → game. */
function playRound(modeId: BubbleModeId, seed: number, reactionMs = 350): RoundSummary {
  const game = new BubbleGame(MODES[modeId], { random: createRng(seed) })
  // A portrait phone crops the sides of a 3:4 camera image.
  game.setVisibleArea({ left: 0.15, right: 0.85, top: 0, bottom: 1 })
  const bot = new BubbleDemoBot(() => ({ snapshot: game.snapshot(), frame: game.lastFrame }), { reactionMs })
  const sim = new PoseSimulator(480, 640, { reactionSeconds: 0, speedDegPerSec: 900, sloppinessDeg: 2 })
  const smoother = new PoseSmoother(SMOOTHING_PRESETS.responsive)
  for (let now = 0; now < 80_000 && game.phase !== 'finished'; now += FRAME_MS) {
    sim.setTarget(bot.target(now), now)
    game.update(now, smoother.smooth(sim.step(now)))
  }
  expect(game.phase).toBe('finished')
  return game.snapshot().summary!
}

describe('Bubble Pop demo bot (end to end)', () => {
  it.each(MODE_IDS)('plays a full %s round and earns stars', (modeId) => {
    const results = [1, 2, 3].map((seed) => playRound(modeId, seed))
    for (const r of results) {
      expect(r.popped).toBeGreaterThan(15)
      expect(r.accuracy).toBeGreaterThan(0.6)
      expect(r.stars).toBeGreaterThanOrEqual(2)
    }
  })

  it('kids mode is forgiving: a slow player still earns stars', () => {
    const r = playRound('kids', 4, 2500)
    expect(r.missed).toBeLessThan(5)
    expect(r.stars).toBeGreaterThanOrEqual(1)
  })

  it('challenge mode punishes slow reactions with missed bubbles', () => {
    const r = playRound('challenge', 4, 2500)
    expect(r.missed).toBeGreaterThan(10)
    expect(r.stars).toBeLessThan(3)
  })
})

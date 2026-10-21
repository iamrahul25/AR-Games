import { PRESET_ORDER, PRESETS, dialToSpeed, resolveRunConfig } from '../config/difficulty'
import { OBSTACLE_SHAPES, PLAYER_DEPTH } from '../config/world'
import { laneFromX, overlapsPlayer, wouldHit } from '../engine/collision'
import { checkRows, rowNeeds, type Row } from '../engine/fairness'
import { TrackGenerator, type GeneratedObstacle } from '../engine/generator'
import { Rng } from '../engine/rng'
import { POINTS, clearedPoints, distancePoints, finalScore, streakMultiplier } from '../engine/scoring'
import { COUNTDOWN_MS, RESUME_STILL_MS, RunnerSession, type SessionPhase } from '../engine/session'
import { SpeedController, hitDip, stagedDial } from '../engine/speed'
import type { Lane, RunConfig } from '../types'

function rowsFrom(obstacles: GeneratedObstacle[], speed: number): Row[] {
  const byRow = new Map<number, GeneratedObstacle[]>()
  for (const o of obstacles) byRow.set(o.row, [...(byRow.get(o.row) ?? []), o])
  return [...byRow.values()].map((list) => ({ t: Math.min(...list.map((o) => o.at)) / speed, needs: rowNeeds(list) }))
}

describe('track generator + fairness', () => {
  const PATTERNS_PER_PRESET = 2000

  it.each(PRESET_ORDER)('every generated track is solvable (%s, 2000 patterns × seeds)', (preset) => {
    const config: RunConfig = resolveRunConfig(PRESETS[preset])
    const speed = dialToSpeed(config.maxDial)
    for (const seed of [1, 2, 3, 4]) {
      const gen = new TrackGenerator(config, new Rng(seed), 40, 0)
      const obstacles: GeneratedObstacle[] = []
      let patterns = 0
      while (patterns < PATTERNS_PER_PRESET / 4) {
        const before = gen.nextAt
        obstacles.push(...gen.fill(before + 1, { speed, level: 3 }).obstacles)
        patterns++
      }
      const start = new Map<Lane, number>([[0, 0]])
      const res = checkRows(rowsFrom(obstacles, speed), start, { recoveryS: config.recoveryS, enabledMoves: config.enabledMoves })
      expect(res.ok).toBe(true)
      // Obstacles only ask for enabled moves.
      for (const o of obstacles) {
        if (o.type === 'hurdle') expect(config.enabledMoves).toContain('jump')
        if (o.type === 'bar') expect(config.enabledMoves).toContain('duck')
        if (o.type === 'wall') expect(config.enabledMoves).toContain('lane')
      }
      expect(obstacles.length).toBeGreaterThan(100)
    }
  })

  it('respects "lanes only" and "no lanes" move sets', () => {
    for (const moves of [['lane'], ['jump', 'duck'], ['duck']] as RunConfig['enabledMoves'][]) {
      const config: RunConfig = { ...resolveRunConfig(PRESETS.normal), enabledMoves: moves }
      const speed = dialToSpeed(config.startDial)
      const gen = new TrackGenerator(config, new Rng(9), 40, 0)
      const { obstacles } = gen.fill(4000, { speed, level: 3 })
      const types = new Set(obstacles.map((o) => o.type))
      if (!moves.includes('lane')) {
        expect(types.has('wall')).toBe(false)
        expect(obstacles.every((o) => o.lanes.includes(0) || o.type !== 'wall')).toBe(true)
      }
      if (!moves.includes('jump')) expect(types.has('hurdle')).toBe(false)
      if (!moves.includes('duck')) expect(types.has('bar')).toBe(false)
      const res = checkRows(rowsFrom(obstacles, speed), new Map([[0 as Lane, 0]]), { recoveryS: config.recoveryS, enabledMoves: moves })
      expect(res.ok).toBe(true)
    }
  })

  it('is deterministic per seed', () => {
    const config = resolveRunConfig(PRESETS.normal)
    const a = new TrackGenerator(config, new Rng(5), 40).fill(2000, { speed: 9, level: 3 })
    const b = new TrackGenerator(config, new Rng(5), 40).fill(2000, { speed: 9, level: 3 })
    expect(a).toEqual(b)
  })

  it('fairness rejects impossible rows', () => {
    const p = { recoveryS: 1, enabledMoves: ['lane', 'jump', 'duck'] as RunConfig['enabledMoves'] }
    const wall: Row = { t: 1, needs: ['blocked', 'blocked', 'blocked'] }
    expect(checkRows([wall], new Map([[0 as Lane, 0]]), p).ok).toBe(false)
    // Left → right takes 2 × recovery; a gap of 1.5 s is not enough.
    const rows: Row[] = [
      { t: 1, needs: ['open', 'blocked', 'blocked'] },
      { t: 2.5, needs: ['blocked', 'blocked', 'open'] },
    ]
    expect(checkRows(rows, new Map([[-1 as Lane, 0]]), p).ok).toBe(false)
    expect(checkRows([rows[0], { ...rows[1], t: 3.1 }], new Map([[-1 as Lane, 0]]), p).ok).toBe(true)
  })
})

describe('speed', () => {
  const cfg = { startDial: 5, maxDial: 9, rampStepDial: 0.5, rampEveryS: 30 }

  it('constant mode never changes speed', () => {
    expect(stagedDial({ ...cfg, rampStepDial: 0 }, 600)).toBe(5)
  })

  it('increases in stages up to the max', () => {
    expect(stagedDial(cfg, 29)).toBe(5)
    expect(stagedDial(cfg, 30)).toBe(5.5)
    expect(stagedDial(cfg, 10_000)).toBe(9)
  })

  it('reports each speed-up stage once', () => {
    const s = new SpeedController(cfg)
    expect(s.update(10)).toBeNull()
    expect(s.update(30)).toBe(5.5)
    expect(s.update(31)).toBeNull()
  })

  it('dips one level after a hit and recovers over 3 s', () => {
    const s = new SpeedController(cfg)
    s.hit(10)
    expect(s.dial(10)).toBeCloseTo(4)
    expect(s.dial(11.5)).toBeCloseTo(4.5)
    expect(s.dial(13)).toBe(5)
    expect(hitDip(-1)).toBe(0)
  })

  it('dial → speed follows the table', () => {
    expect(dialToSpeed(1)).toBe(4)
    expect(dialToSpeed(5)).toBe(9)
    expect(dialToSpeed(10)).toBe(18)
    expect(dialToSpeed(5.5)).toBeCloseTo(9.75)
  })
})

describe('collision', () => {
  const base = { x: 0, y: 0, sliding: false }

  it('lane is decided past halfway', () => {
    expect(laneFromX(0.9)).toBe(0)
    expect(laneFromX(1.1)).toBe(1)
    expect(laneFromX(-5)).toBe(-1)
  })

  it('walls hit in their lanes only', () => {
    expect(wouldHit('wall', [0], base)).toBe(true)
    expect(wouldHit('wall', [1], base)).toBe(false)
  })

  it('hurdles are cleared by jumping high enough', () => {
    expect(wouldHit('hurdle', [0], base)).toBe(true)
    expect(wouldHit('hurdle', [0], { ...base, y: OBSTACLE_SHAPES.hurdle.top + 0.01 })).toBe(false)
  })

  it('bars are cleared by sliding, and hit when jumping into them', () => {
    expect(wouldHit('bar', [0], base)).toBe(true)
    expect(wouldHit('bar', [0], { ...base, sliding: true })).toBe(false)
    expect(wouldHit('bar', [0], { ...base, y: 0.6 })).toBe(true)
  })

  it('overlap uses the obstacle depth and player depth', () => {
    expect(overlapsPlayer(0, 'hurdle')).toBe(true)
    expect(overlapsPlayer(PLAYER_DEPTH / 2 + 0.01, 'hurdle')).toBe(false)
    expect(overlapsPlayer(-OBSTACLE_SHAPES.wall.depth - PLAYER_DEPTH / 2 + 0.01, 'wall')).toBe(true)
  })
})

describe('scoring', () => {
  it('streak multiplier steps at 10 / 25 / 50', () => {
    expect([0, 9, 10, 24, 25, 49, 50].map(streakMultiplier)).toEqual([1, 1, 2, 2, 3, 3, 4])
  })

  it('points', () => {
    expect(distancePoints(9, 9)).toBe(9)
    expect(distancePoints(9, 18)).toBe(18)
    expect(clearedPoints(30)).toBe(POINTS.cleared * 3)
    expect(finalScore(1000.4, 1.3)).toBe(1301)
  })
})

describe('session phases', () => {
  const ctx = { tracked: true, inCenter: true, stillMs: 0, skipBodyChecks: false }
  const phases = (events: { type: string; phase?: SessionPhase }[]) => events.filter((e) => e.type === 'phase').map((e) => e.phase)

  it('tips → calibrating → training → countdown → running', () => {
    const s = new RunnerSession({ showTips: true, training: true })
    expect(s.phase).toBe('setup-tips')
    expect(phases(s.tipsDone())).toEqual(['calibrating'])
    expect(phases(s.calibrated(0))).toEqual(['training'])
    expect(phases(s.trainingDone(100))).toEqual(['countdown'])
    expect(s.update(100 + COUNTDOWN_MS - 1, ctx).filter((e) => e.type === 'go')).toHaveLength(0)
    const ev = s.update(100 + COUNTDOWN_MS, ctx)
    expect(phases(ev)).toEqual(['running'])
    expect(s.hasStarted).toBe(true)
  })

  it('counts down 3, 2, 1', () => {
    const s = new RunnerSession({ showTips: false, training: false })
    const first = s.calibrated(0)
    expect(first).toContainEqual({ type: 'countdown', value: 3 })
    expect(s.update(1000, ctx)).toContainEqual({ type: 'countdown', value: 2 })
    expect(s.update(2000, ctx)).toContainEqual({ type: 'countdown', value: 1 })
  })

  it('pause → resume waits for the player to stand still in the middle', () => {
    const s = new RunnerSession({ showTips: false, training: false })
    s.calibrated(0)
    s.update(COUNTDOWN_MS, ctx)
    s.pause()
    expect(s.phase).toBe('paused')
    s.resume(5000)
    expect(s.phase).toBe('waiting')
    expect(s.waitReason).toBe('resume')
    s.update(5100, { ...ctx, inCenter: false, stillMs: 5000 })
    expect(s.phase).toBe('waiting')
    s.update(5200, { ...ctx, stillMs: RESUME_STILL_MS })
    expect(s.phase).toBe('countdown')
  })

  it('keyboard play skips the body check', () => {
    const s = new RunnerSession({ showTips: false, training: false })
    s.calibrated(0)
    s.update(COUNTDOWN_MS, ctx)
    s.trackingLost()
    expect(s.waitReason).toBe('lost')
    s.update(4000, { tracked: false, inCenter: false, stillMs: 0, skipBodyChecks: true })
    expect(s.phase).toBe('countdown')
  })

  it('rest break → waiting when it ends', () => {
    const s = new RunnerSession({ showTips: false, training: false })
    s.calibrated(0)
    s.update(COUNTDOWN_MS, ctx)
    s.rest(10_000, 20)
    expect(s.phase).toBe('resting')
    s.update(29_999, ctx)
    expect(s.phase).toBe('resting')
    s.update(30_000, ctx)
    expect(s.phase).toBe('waiting')
    expect(s.waitReason).toBe('rest')
  })

  it('recalibrating mid-run comes back through waiting', () => {
    const s = new RunnerSession({ showTips: false, training: false })
    s.calibrated(0)
    s.update(COUNTDOWN_MS, ctx)
    s.recalibrate()
    expect(s.phase).toBe('calibrating')
    s.calibrated(9000)
    expect(s.phase).toBe('waiting')
    expect(s.waitReason).toBe('recalibrated')
  })
})

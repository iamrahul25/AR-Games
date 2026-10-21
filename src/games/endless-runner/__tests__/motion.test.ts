import { NEUTRAL_SKELETON } from '@/core/pose/skeleton'
import { PoseSimulator, type SimulatorTarget } from '@/core/pose/simulator'
import { PRESETS, resolveRunConfig } from '../config/difficulty'
import { calibrationParams, motionConfig } from '../game/runnerGame'
import { buildCalibration, Calibrator, median, type BodySample, type Calibration } from '../motion/calibration'
import { DuckDetector, LANDING_SUPPRESS_MS } from '../motion/duckDetector'
import { JumpDetector } from '../motion/jumpDetector'
import { LaneTracker } from '../motion/laneTracker'
import { MotionController, type MotionEvent } from '../motion/motionController'
import type { RunConfig } from '../types'

const FRAME_MS = 33

/** Calibrates a simulated player, then lets tests move its body and collect motion events. */
function rig(config: RunConfig = resolveRunConfig(PRESETS.normal)) {
  const sim = new PoseSimulator(480, 640, { reactionSeconds: 0, speedDegPerSec: 900, sloppinessDeg: 0 })
  let t = 0
  let target: SimulatorTarget = { skeleton: NEUTRAL_SKELETON, view: 'front', centerX: 0.5, liftY: 0, crouch: 0 }
  const frame = () => {
    t += FRAME_MS
    sim.setTarget(target, t)
    return sim.step(t)
  }
  const calibrator = new Calibrator(calibrationParams(config))
  let cal: Calibration | undefined
  while (!cal && t < 10_000) cal = calibrator.update(frame(), t).calibration
  if (!cal) throw new Error('calibration failed')
  const calibratedAt = t
  const motion = new MotionController(motionConfig(config))
  motion.setCalibration(cal)
  const c = cal
  const lift = c.headY0 - c.jumpY + 0.12 * c.torso
  return {
    cal: c,
    calibratedAt,
    motion,
    laneX: (lane: number) => c.hipX0 + lane * 2 * c.halfLane,
    lift,
    run(patch: Partial<SimulatorTarget>, ms: number, drop = false): MotionEvent[] {
      target = { ...target, ...patch }
      const events: MotionEvent[] = []
      for (let e = 0; e < ms; e += FRAME_MS) {
        const f = frame()
        events.push(...motion.update(drop ? null : f, t).events)
      }
      return events
    },
  }
}

const types = (events: MotionEvent[]) => events.map((e) => e.type)

describe('calibration', () => {
  it('calibrates a standing player in about 3 seconds', () => {
    const r = rig()
    expect(r.calibratedAt).toBeLessThan(4500)
    expect(r.cal.hipX0).toBeCloseTo(0.5, 1)
    expect(r.cal.laneBounds[0]).toBeLessThan(r.cal.hipX0)
    expect(r.cal.laneBounds[1]).toBeGreaterThan(r.cal.hipX0)
    expect(r.cal.jumpY).toBeLessThan(r.cal.headY0)
    expect(r.cal.duckY).toBeGreaterThan(r.cal.headY0)
  })

  const sample = (x: number, y = 0.16, W = 0.15): BodySample => ({ head: { x, y }, hip: { x, y: 0.45 }, torso: 0.24, shoulderWidth: W })
  const params = { jumpFactor: 0.2, duckFactor: 0.4, laneWidthFactor: 0.85 }

  it('uses medians, so a few glitchy samples do not matter', () => {
    const samples = [...Array.from({ length: 20 }, (_, i) => sample(0.5 + (i % 2 ? 0.004 : -0.004))), sample(0.95), sample(0.05, 0.6)]
    const res = buildCalibration(samples, params, 0.75)
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.calibration.hipX0).toBeCloseTo(0.5, 2)
    expect(median([3, 1, 2])).toBe(2)
  })

  it('asks off-center players to move toward the middle', () => {
    const left = buildCalibration(Array.from({ length: 10 }, () => sample(0.2)), params, 0.75)
    expect(left).toEqual({ ok: false, issue: 'move-right' })
    const right = buildCalibration(Array.from({ length: 10 }, () => sample(0.8)), params, 0.75)
    expect(right).toEqual({ ok: false, issue: 'move-left' })
  })

  it('asks players who are too close to step back', () => {
    expect(buildCalibration(Array.from({ length: 10 }, () => sample(0.5, 0.16, 0.4)), params, 0.75)).toEqual({ ok: false, issue: 'step-back' })
    expect(buildCalibration(Array.from({ length: 10 }, () => sample(0.5, 0.02)), params, 0.75)).toEqual({ ok: false, issue: 'step-back' })
  })

  it('narrows the lanes when the frame is tight instead of failing', () => {
    const res = buildCalibration(Array.from({ length: 10 }, () => sample(0.5, 0.16, 0.2)), params, 0.75)
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.calibration.laneWidthFactor).toBeLessThan(0.85)
  })
})

describe('LaneTracker', () => {
  const opts = { bounds: [0.4, 0.6] as [number, number], margin: 0.02 }

  it('changes lane after the hips cross a boundary for 2 samples', () => {
    const t = new LaneTracker(opts)
    expect(t.update(0.3)).toBeNull()
    expect(t.update(0.3)).toEqual([-1])
    expect(t.lane).toBe(-1)
  })

  it('ignores a single-frame glitch and flicker inside the margin', () => {
    const t = new LaneTracker(opts)
    expect(t.update(0.2)).toBeNull()
    expect(t.update(0.5)).toBeNull()
    for (const x of [0.39, 0.41, 0.39, 0.385, 0.41]) expect(t.update(x)).toBeNull()
    expect(t.lane).toBe(0)
  })

  it('reports both lanes for a big left → right hop', () => {
    const t = new LaneTracker(opts)
    t.reset(-1)
    t.update(0.75)
    expect(t.update(0.75)).toEqual([0, 1])
  })
})

describe('JumpDetector', () => {
  const th = { jumpY: 0.1, hipJumpY: 0.42, exitMargin: 0.01, halfLane: 0.1 }
  const s = (t: number, headY: number, hipY = headY + 0.3, hipX = 0.5) => ({ t, head: { x: 0.5, y: headY }, hip: { x: hipX, y: hipY }, wrists: null })

  it('emits one jump per hop and lands after 100 ms back below the line', () => {
    const d = new JumpDetector()
    expect(d.update(s(0, 0.16), th).jumped).toBe(false)
    expect(d.update(s(33, 0.08), th).jumped).toBe(true)
    expect(d.update(s(66, 0.07), th).jumped).toBe(false)
    expect(d.update(s(100, 0.16), th).landed).toBe(false)
    expect(d.update(s(210, 0.16), th).landed).toBe(true)
  })

  it('does not count a neck stretch (head up, hips not)', () => {
    const d = new JumpDetector()
    expect(d.update(s(0, 0.08, 0.45), th).jumped).toBe(false)
  })

  it('treats a sideways hop with a head rise as lateral, not a jump', () => {
    const d = new JumpDetector()
    d.update(s(0, 0.16, 0.45, 0.5), th)
    const r = d.update(s(100, 0.08, 0.38, 0.62), th)
    expect(r.jumped).toBe(false)
    expect(r.lateral).toBe(true)
  })

  it('hands-up style needs both wrists above the line', () => {
    const d = new JumpDetector('hands-up')
    const w = (t: number, l: number, r: number) => ({ ...s(t, 0.16), wrists: [{ x: 0.4, y: l }, { x: 0.6, y: r }] as [{ x: number; y: number }, { x: number; y: number }] })
    expect(d.update(w(0, 0.05, 0.3), th).jumped).toBe(false)
    expect(d.update(w(33, 0.05, 0.05), th).jumped).toBe(true)
  })
})

describe('DuckDetector', () => {
  const th = { duckY: 0.25, hipDuckY: 0.5, exitMargin: 0.01 }
  const ground = { airborne: false, lastLandT: -Infinity }

  it('ducks while the head is below the line and ends after 2 samples back up', () => {
    const d = new DuckDetector('head')
    expect(d.update({ t: 0, head: { x: 0.5, y: 0.3 }, hip: { x: 0.5, y: 0.45 } }, th, ground)).toBe('start')
    expect(d.update({ t: 33, head: { x: 0.5, y: 0.2 }, hip: { x: 0.5, y: 0.45 } }, th, ground)).toBeNull()
    expect(d.update({ t: 66, head: { x: 0.5, y: 0.2 }, hip: { x: 0.5, y: 0.45 } }, th, ground)).toBe('end')
  })

  it('squat style also needs the hips to drop', () => {
    const d = new DuckDetector('squat')
    expect(d.update({ t: 0, head: { x: 0.5, y: 0.3 }, hip: { x: 0.5, y: 0.45 } }, th, ground)).toBeNull()
    expect(d.update({ t: 33, head: { x: 0.5, y: 0.3 }, hip: { x: 0.5, y: 0.55 } }, th, ground)).toBe('start')
  })

  it('ignores the landing dip right after a jump', () => {
    const d = new DuckDetector('head')
    const dip = { t: 1000, head: { x: 0.5, y: 0.3 }, hip: { x: 0.5, y: 0.45 } }
    expect(d.update(dip, th, { airborne: false, lastLandT: 1000 - LANDING_SUPPRESS_MS + 50 })).toBeNull()
    expect(d.update(dip, th, { airborne: true, lastLandT: -Infinity })).toBeNull()
  })
})

describe('MotionController (simulated body)', () => {
  it('hops left and right between lanes', () => {
    const r = rig()
    const left = r.run({ centerX: r.laneX(-1) }, 600)
    expect(left).toEqual([expect.objectContaining({ type: 'lane-change', from: 0, to: -1 })])
    const right = r.run({ centerX: r.laneX(1) }, 800)
    expect(right.map((e) => (e.type === 'lane-change' ? e.to : null))).toEqual([0, 1])
    expect(r.motion.state.lane).toBe(1)
  })

  it('detects one jump, with no duck from the landing', () => {
    const r = rig()
    r.run({}, 300)
    const ev = [...r.run({ liftY: r.lift }, 400), ...r.run({ liftY: 0 }, 800)]
    expect(types(ev)).toEqual(['jump'])
  })

  it('does not count a small bounce as a jump', () => {
    const r = rig()
    const ev = [...r.run({ liftY: r.lift * 0.4 }, 400), ...r.run({ liftY: 0 }, 600)]
    expect(types(ev)).toEqual([])
  })

  it('detects a duck and when it ends', () => {
    const r = rig()
    const down = r.run({ crouch: 1 }, 800)
    expect(types(down)).toEqual(['duck-start'])
    expect(r.motion.state.ducking).toBe(true)
    expect(types(r.run({ crouch: 0 }, 800))).toEqual(['duck-end'])
  })

  it('a sideways hop with a head rise changes lane but is not a jump', () => {
    const r = rig()
    r.run({}, 400)
    const ev = [...r.run({ centerX: r.laneX(1), liftY: r.lift }, 350), ...r.run({ liftY: 0 }, 800)]
    expect(types(ev)).toContain('lane-change')
    expect(types(ev)).not.toContain('jump')
  })

  it('reports lost tracking after 0.7 s without a body', () => {
    const r = rig()
    const ev = r.run({}, 1000, true)
    expect(types(ev)).toContain('tracking-lost')
    expect(types(r.run({}, 300))).toContain('tracking-restored')
  })

  it('works with low-impact (hands up) jumping', () => {
    const config = { ...resolveRunConfig(PRESETS.gentle), jumpStyle: 'hands-up' as const, enabledMoves: ['lane', 'jump', 'duck'] as RunConfig['enabledMoves'] }
    const r = rig(config)
    const armsUp = {
      ...NEUTRAL_SKELETON,
      leftUpperArm: { angle: -15 },
      leftForearm: { angle: -8 },
      rightUpperArm: { angle: 15 },
      rightForearm: { angle: 8 },
    }
    const ev = [...r.run({ skeleton: armsUp }, 500), ...r.run({ skeleton: NEUTRAL_SKELETON }, 600)]
    expect(types(ev)).toEqual(['jump'])
  })
})

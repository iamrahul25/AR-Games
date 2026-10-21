import { NEUTRAL_SKELETON, type SkeletonSpec } from '@/core/pose/skeleton'
import type { SimulatorTarget } from '@/core/pose/simulator'
import type { WorldSnapshot } from '../engine/sim'
import type { TrainingStepId } from '../engine/training'
import type { Calibration } from '../motion/calibration'
import type { MotionLines } from '../motion/motionController'
import type { Lane, RunConfig } from '../types'
import { Autopilot } from './autopilot'

const ARMS_UP: SkeletonSpec = {
  ...NEUTRAL_SKELETON,
  leftUpperArm: { angle: -15 },
  leftForearm: { angle: -8 },
  rightUpperArm: { angle: 15 },
  rightForearm: { angle: 8 },
}

const JUMP_HOLD_S = 0.4
const DUCK_MIN_S = 0.3
/** Body-tracking pipeline delay the bot compensates for (camera rate + smoothing + easing). */
const PIPELINE_LATENCY_S = 0.15

export interface DemoContext {
  world: WorldSnapshot | null
  calibration: Calibration | null
  lines: MotionLines | null
  /** What the bot should be doing right now. */
  mode: 'stand' | 'training' | 'running'
  trainingStep?: TrainingStepId
}

export interface DemoBotOptions {
  mistakeRate?: number
  random?: () => number
}

/**
 * "Demo mode" player: decides like the autopilot, then acts with its *body* (a simulated
 * skeleton) so lane tracking, jump and duck detection run exactly as with a real player.
 */
export class DemoBot {
  private pilot: Autopilot
  private jumpUntil = 0
  private duckUntil = 0
  private nextPracticeMove = 0
  private lane: Lane = 0

  constructor(
    private config: RunConfig,
    private getContext: () => DemoContext,
    private opts: DemoBotOptions = {},
  ) {
    this.pilot = this.makePilot()
  }

  private makePilot() {
    return new Autopilot(this.config, { latencyS: PIPELINE_LATENCY_S, mistakeRate: this.opts.mistakeRate ?? 0.03, random: this.opts.random })
  }

  setConfig(config: RunConfig) {
    this.config = config
    this.pilot = this.makePilot()
  }

  reset() {
    this.pilot.reset(0)
    this.lane = 0
    this.jumpUntil = 0
    this.duckUntil = 0
  }

  /** The simulated camera's target pose at `now` (ms). */
  target(now: number): SimulatorTarget {
    const ctx = this.getContext()
    const cal = ctx.calibration
    const t = now / 1000
    if (!cal || ctx.mode === 'stand') {
      this.reset()
      return { skeleton: NEUTRAL_SKELETON, view: 'front', centerX: cal?.hipX0 ?? 0.5, liftY: 0, crouch: 0 }
    }

    let wantJump = false
    let wantDuck = false
    if (ctx.mode === 'training' && ctx.trainingStep && ctx.trainingStep !== 'practice') {
      switch (ctx.trainingStep) {
        case 'left':
          this.lane = -1
          break
        case 'right':
          this.lane = 1
          break
        case 'center1':
        case 'center2':
          this.lane = 0
          break
        case 'jump':
        case 'duck':
          this.lane = 0
          if (t >= this.nextPracticeMove) {
            this.nextPracticeMove = t + 1.6
            if (ctx.trainingStep === 'jump') wantJump = true
            else wantDuck = true
          }
          break
      }
    } else if (ctx.world) {
      const d = this.pilot.decide(ctx.world)
      this.lane = d.lane
      wantJump = d.jump
      wantDuck = d.duck
    }

    if (wantJump && t >= this.jumpUntil) this.jumpUntil = t + JUMP_HOLD_S
    if (wantDuck) this.duckUntil = Math.max(this.duckUntil, t + DUCK_MIN_S)
    const jumping = t < this.jumpUntil
    const ducking = !jumping && t < this.duckUntil

    const lines = ctx.lines
    const T = lines?.torso ?? cal.torso
    const lift = lines ? lines.headY0 - lines.jumpY + 0.15 * T : 0.45 * T
    const handsUp = this.config.jumpStyle === 'hands-up'
    return {
      skeleton: jumping && handsUp ? ARMS_UP : NEUTRAL_SKELETON,
      view: 'front',
      centerX: cal.hipX0 + this.lane * 2 * cal.halfLane,
      liftY: jumping && !handsUp ? lift : 0,
      crouch: ducking ? 1 : 0,
    }
  }
}

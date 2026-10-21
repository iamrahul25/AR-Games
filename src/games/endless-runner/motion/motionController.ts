import { headPoint, hipMid, shoulderMid, torsoLength, wrists, type Point } from '@/core/pose/bodyMetrics'
import type { PoseFrame } from '@/core/pose/types'
import type { Lane } from '../types'
import { BaselineAdapter } from './baselineAdapter'
import { lineYs, type Calibration } from './calibration'
import { DuckDetector } from './duckDetector'
import { JumpDetector } from './jumpDetector'
import { LaneTracker } from './laneTracker'
import { TrackingMonitor, type TrackingQuality } from './trackingMonitor'

export interface MotionConfig {
  jumpFactor: number
  duckFactor: number
  jumpStyle: 'jump' | 'hands-up'
  duckStyle: 'head' | 'squat'
  seatedMode: boolean
}

export interface MotionState {
  lane: Lane
  ducking: boolean
  /** Physically above the jump line (for UI feedback). */
  airborne: boolean
  /** Head just below the jump line ("almost"). */
  nearJump: boolean
  tracking: TrackingQuality
  head: Point | null
  hip: Point | null
  /** How long the hips have stayed put (resume check). */
  stillMs: number
  /** Canonical frame edge the hips are close to. */
  edge: 'left' | 'right' | null
  /** The tracked body jumped across the frame several times (another person?). */
  recalibrateSuggested: boolean
}

export type MotionEvent =
  | { type: 'lane-change'; from: Lane; to: Lane; t: number }
  | { type: 'jump'; t: number }
  | { type: 'duck-start'; t: number }
  | { type: 'duck-end'; t: number }
  | { type: 'tracking-lost'; t: number }
  | { type: 'tracking-restored'; t: number }

export interface MotionLines {
  headY0: number
  hipY0: number
  torso: number
  jumpY: number
  duckY: number
}

const EDGE_ZONE = 0.08
const STILL_TOLERANCE = 0.12
const OUTLIERS_BEFORE_ACCEPT = 3

const INITIAL_STATE: MotionState = {
  lane: 0,
  ducking: false,
  airborne: false,
  nearJump: false,
  tracking: 'ok',
  head: null,
  hip: null,
  stillMs: 0,
  edge: null,
  recalibrateSuggested: false,
}

/** The point whose x decides the lane: hips, or shoulders when seated (leaning). */
export function laneAnchor(frame: PoseFrame, seated: boolean): Point | null {
  return seated ? shoulderMid(frame) : hipMid(frame)
}

/**
 * Body → controls. Combines the lane tracker, jump and duck detectors, tracking monitor and
 * baseline drift compensation into one {@linkcode MotionState} plus discrete events.
 */
export class MotionController {
  calibration: Calibration | null = null
  state: MotionState = { ...INITIAL_STATE }
  private lanes = new LaneTracker({ bounds: [0.4, 0.6], margin: 0.02 })
  private jump: JumpDetector
  private duck: DuckDetector
  private tracking: TrackingMonitor
  private baseline: BaselineAdapter | null = null
  private lastHipX: number | null = null
  private outliers = 0
  private stillAnchor: { x: number; t: number } | null = null

  constructor(private config: MotionConfig) {
    this.jump = new JumpDetector(config.jumpStyle)
    this.duck = new DuckDetector(config.duckStyle)
    this.tracking = new TrackingMonitor(config.seatedMode)
  }

  setConfig(config: MotionConfig) {
    this.config = config
    this.jump = new JumpDetector(config.jumpStyle)
    this.duck = new DuckDetector(config.duckStyle)
    this.tracking = new TrackingMonitor(config.seatedMode)
  }

  setCalibration(cal: Calibration | null) {
    this.calibration = cal
    this.jump.reset()
    this.duck.reset()
    this.outliers = 0
    this.lastHipX = null
    this.state = { ...this.state, lane: 0, ducking: false, airborne: false, recalibrateSuggested: false }
    if (!cal) {
      this.baseline = null
      return
    }
    this.lanes.setBounds(cal.laneBounds, 0.15 * cal.shoulderWidth)
    this.lanes.reset(0)
    this.baseline = new BaselineAdapter({ headY0: cal.headY0, hipY0: cal.hipY0, torso: cal.torso })
  }

  /** Current jump / duck lines (they follow the baseline drift). */
  get lines(): MotionLines | null {
    const cal = this.calibration
    if (!cal) return null
    const b = this.baseline?.baseline ?? { headY0: cal.headY0, hipY0: cal.hipY0, torso: cal.torso }
    return { ...b, ...lineYs(b.headY0, b.torso, this.config.jumpFactor, this.config.duckFactor) }
  }

  update(frame: PoseFrame | null, t: number): { state: MotionState; events: MotionEvent[] } {
    const events: MotionEvent[] = []
    const tr = this.tracking.update(frame, t)
    if (tr.changed === 'lost') events.push({ type: 'tracking-lost', t })
    if (tr.changed === 'restored') {
      events.push({ type: 'tracking-restored', t })
      this.jump.reset()
      this.duck.reset()
    }

    const usable = TrackingMonitor.usable(frame)
    const head = usable && frame ? headPoint(frame) : null
    const anchor = usable && frame ? laneAnchor(frame, this.config.seatedMode) : null
    const hip = usable && frame ? hipMid(frame) : null
    const torso = usable && frame ? torsoLength(frame) : null

    if (!head || !anchor || !hip || !torso) {
      this.state = { ...this.state, tracking: tr.quality, head: null, hip: null, airborne: false, nearJump: false, stillMs: 0 }
      this.stillAnchor = null
      return { state: this.state, events }
    }

    const cal = this.calibration
    const lines = this.lines
    if (!cal || !lines || !this.baseline) {
      this.trackStill(anchor.x, t, 0.03)
      this.state = {
        ...this.state,
        tracking: tr.quality,
        head,
        hip: { x: anchor.x, y: hip.y },
        edge: edgeOf(anchor.x),
        stillMs: this.stillAnchor ? t - this.stillAnchor.t : 0,
      }
      return { state: this.state, events }
    }

    // A sudden jump across the frame (> 2 lanes in one sample) is usually another person.
    if (this.lastHipX !== null && Math.abs(anchor.x - this.lastHipX) > 2 * cal.halfLane) {
      this.outliers++
      if (this.outliers <= OUTLIERS_BEFORE_ACCEPT) return { state: this.state, events }
      this.state = { ...this.state, recalibrateSuggested: true }
    }
    this.outliers = 0
    this.lastHipX = anchor.x

    const T = lines.torso
    const exitMargin = 0.05 * T
    const prevLane = this.lanes.lane
    const passed = this.lanes.update(anchor.x)
    if (passed) {
      let from = prevLane
      for (const to of passed) {
        events.push({ type: 'lane-change', from, to, t })
        from = to
      }
    }

    const jr = this.jump.update(
      { t, head, hip, wrists: frame ? wrists(frame) : null },
      { jumpY: lines.jumpY, hipJumpY: lines.hipY0 - 0.5 * this.config.jumpFactor * T, exitMargin, halfLane: cal.halfLane },
    )
    if (jr.jumped) events.push({ type: 'jump', t })

    const dr = this.duck.update(
      { t, head, hip },
      { duckY: lines.duckY, hipDuckY: lines.hipY0 + 0.5 * this.config.duckFactor * T, exitMargin },
      { airborne: this.jump.airborne, lastLandT: this.jump.lastLandT },
    )
    if (dr === 'start') events.push({ type: 'duck-start', t })
    if (dr === 'end') events.push({ type: 'duck-end', t })

    this.baseline.update(
      { t, headY: head.y, hipY: hip.y, torso },
      this.jump.airborne || this.duck.ducking || t - this.jump.lastLandT < 500,
    )
    this.trackStill(anchor.x, t, STILL_TOLERANCE * cal.shoulderWidth * 2)

    this.state = {
      lane: this.lanes.lane,
      ducking: this.duck.ducking,
      airborne: this.jump.airborne,
      nearJump: !this.jump.airborne && head.y > lines.jumpY && head.y < lines.jumpY + 0.08 * T,
      tracking: tr.quality,
      head,
      hip: { x: anchor.x, y: hip.y },
      stillMs: this.stillAnchor ? t - this.stillAnchor.t : 0,
      edge: edgeOf(anchor.x),
      recalibrateSuggested: this.state.recalibrateSuggested,
    }
    return { state: this.state, events }
  }

  private trackStill(x: number, t: number, tolerance: number) {
    if (!this.stillAnchor || Math.abs(x - this.stillAnchor.x) > tolerance) this.stillAnchor = { x, t }
  }
}

function edgeOf(x: number): 'left' | 'right' | null {
  if (x < EDGE_ZONE) return 'left'
  if (x > 1 - EDGE_ZONE) return 'right'
  return null
}

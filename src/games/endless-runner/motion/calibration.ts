import { headPoint, hipMid, shoulderMid, shoulderWidth, torsoLength, type Point } from '@/core/pose/bodyMetrics'
import { checkFraming, type FramingResult } from '@/core/pose/framing'
import { LM } from '@/core/pose/landmarks'
import type { PoseFrame } from '@/core/pose/types'

export interface Calibration {
  headY0: number
  hipX0: number
  hipY0: number
  /** Torso length in image-height units. */
  torso: number
  /** Shoulder width in canonical x units. */
  shoulderWidth: number
  /** Half the center lane's width, canonical x. */
  halfLane: number
  laneWidthFactor: number
  /** Inner lane boundaries [bL, bR], canonical x. */
  laneBounds: [number, number]
  /** Outer edges of the left and right lanes, canonical x. */
  outer: [number, number]
  jumpY: number
  duckY: number
  imageAspect: number
}

export interface CalibrationParams {
  jumpFactor: number
  duckFactor: number
  laneWidthFactor: number
  seatedMode?: boolean
}

export interface BodySample {
  head: Point
  hip: Point
  torso: number
  shoulderWidth: number
}

export type FitIssue = 'step-back' | 'move-left' | 'move-right' | 'not-enough-samples'

export const MIN_LANE_WIDTH_FACTOR = 0.5
const EDGE = 0.02
const TOP_EDGE = 0.03

/** `hip.x` is the lane anchor: the hips, or the shoulders in seated mode (lanes by leaning). */
export function bodySample(frame: PoseFrame, seated = false): BodySample | null {
  const head = headPoint(frame)
  const hip = hipMid(frame)
  const torso = torsoLength(frame)
  const width = shoulderWidth(frame)
  const shoulders = seated ? shoulderMid(frame) : null
  if (!head || !hip || !torso || !width || (seated && !shoulders)) return null
  return { head, hip: shoulders ? { x: shoulders.x, y: hip.y } : hip, torso, shoulderWidth: width }
}

export function median(values: number[]): number {
  if (values.length === 0) return NaN
  const s = [...values].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export function lineYs(headY0: number, torso: number, jumpFactor: number, duckFactor: number) {
  return { jumpY: headY0 - jumpFactor * torso, duckY: headY0 + duckFactor * torso }
}

export function laneGeometry(hipX0: number, shoulderW: number, laneWidthFactor: number) {
  const halfLane = laneWidthFactor * shoulderW
  const laneBounds: [number, number] = [hipX0 - halfLane, hipX0 + halfLane]
  const outer: [number, number] = [hipX0 - 3 * halfLane, hipX0 + 3 * halfLane]
  return { halfLane, laneBounds, outer }
}

/**
 * Builds a calibration from standing-still samples (medians), then checks that the user can
 * reach the left and right lane centers without leaving the frame. Shrinks the lanes down to
 * {@linkcode MIN_LANE_WIDTH_FACTOR} if needed.
 */
export function buildCalibration(
  samples: BodySample[],
  params: CalibrationParams,
  imageAspect: number,
): { ok: true; calibration: Calibration } | { ok: false; issue: FitIssue } {
  if (samples.length < 5) return { ok: false, issue: 'not-enough-samples' }
  const headY0 = median(samples.map((s) => s.head.y))
  const hipX0 = median(samples.map((s) => s.hip.x))
  const hipY0 = median(samples.map((s) => s.hip.y))
  const torso = median(samples.map((s) => s.torso))
  const W = median(samples.map((s) => s.shoulderWidth))
  const { jumpY, duckY } = lineYs(headY0, torso, params.jumpFactor, params.duckFactor)
  if (jumpY < TOP_EDGE) return { ok: false, issue: 'step-back' }

  for (let f = params.laneWidthFactor; f >= MIN_LANE_WIDTH_FACTOR - 1e-9; f -= 0.05) {
    const reach = 2 * f * W + 0.75 * W
    const leftOk = hipX0 - reach >= EDGE
    const rightOk = hipX0 + reach <= 1 - EDGE
    if (leftOk && rightOk) {
      const geo = laneGeometry(hipX0, W, f)
      return {
        ok: true,
        calibration: {
          headY0,
          hipX0,
          hipY0,
          torso,
          shoulderWidth: W,
          laneWidthFactor: Math.round(f * 100) / 100,
          ...geo,
          jumpY,
          duckY,
          imageAspect,
        },
      }
    }
  }
  const reach = 2 * MIN_LANE_WIDTH_FACTOR * W + 0.75 * W
  const leftOut = hipX0 - reach < EDGE
  const rightOut = hipX0 + reach > 1 - EDGE
  if (leftOut && rightOut) return { ok: false, issue: 'step-back' }
  // Canonical x grows to the user's right: too close to the left edge → move right.
  return { ok: false, issue: leftOut ? 'move-right' : 'move-left' }
}

const FIT_MESSAGES: Record<FitIssue, string> = {
  'step-back': 'Step back a little so there is room to hop left and right',
  'move-left': 'Move toward the middle — a step to your left',
  'move-right': 'Move toward the middle — a step to your right',
  'not-enough-samples': 'Hold still a moment longer',
}

/** Upper-body-only framing check for seated mode. */
export function checkSeatedFraming(frame: PoseFrame | null): FramingResult {
  if (!frame) return { ok: false, issue: 'no-person', message: 'Step into view of the camera' }
  const need = [LM.nose, LM.leftShoulder, LM.rightShoulder, LM.leftHip, LM.rightHip]
  if (!need.every((i) => frame.landmarks[i].visibility >= 0.5)) {
    return { ok: false, issue: 'step-back', message: 'Move back so your head, shoulders and hips are visible' }
  }
  const head = headPoint(frame)
  if (head && head.y < 0.05) return { ok: false, issue: 'step-back', message: 'Move back so your head is fully visible' }
  return { ok: true, message: 'Great! Hold still…' }
}

export type CalibrationStep = 'framing' | 'hold' | 'adjust' | 'done'

export interface CalibratorState {
  step: CalibrationStep
  /** 0..1 progress of the current step. */
  progress: number
  message: string
  calibration?: Calibration
}

const FRAMING_MS = 1000
const HOLD_MS = 2000
const ADJUST_MS = 1800
const MEASURE_MS = 1500

/**
 * Calibration flow: whole body in frame for 1 s → stand still in the middle for 2 s
 * (the last 1.5 s of samples are measured) → fit check → done.
 */
export class Calibrator {
  private step: CalibrationStep = 'framing'
  private stepStart: number | null = null
  private window: { t: number; s: BodySample }[] = []
  private message = 'Step into view of the camera'
  private calibration: Calibration | undefined

  constructor(private params: CalibrationParams) {}

  setParams(params: CalibrationParams) {
    this.params = params
  }

  reset() {
    this.step = 'framing'
    this.stepStart = null
    this.window = []
    this.calibration = undefined
    this.message = 'Step into view of the camera'
  }

  get state(): CalibratorState {
    return { step: this.step, progress: 0, message: this.message, calibration: this.calibration }
  }

  update(frame: PoseFrame | null, t: number): CalibratorState {
    if (this.step === 'done') return { ...this.state, progress: 1 }

    if (this.step === 'adjust') {
      const elapsed = t - (this.stepStart ?? t)
      if (elapsed < ADJUST_MS) return { step: 'adjust', progress: elapsed / ADJUST_MS, message: this.message }
      this.goto('framing', t)
    }

    const framing = this.params.seatedMode ? checkSeatedFraming(frame) : checkFraming(frame)
    const sample = frame ? bodySample(frame, this.params.seatedMode) : null
    if (!framing.ok || !sample || !frame) {
      this.message = framing.ok ? 'Step into view of the camera' : framing.message
      this.goto('framing', null)
      this.window = []
      return { step: 'framing', progress: 0, message: this.message }
    }

    if (this.step === 'framing') {
      if (this.stepStart === null) this.stepStart = t
      const p = (t - this.stepStart) / FRAMING_MS
      this.message = 'Great! Now stand in the middle'
      if (p < 1) return { step: 'framing', progress: p, message: this.message }
      this.goto('hold', t)
      this.window = []
    }

    // hold
    this.window.push({ t, s: sample })
    while (this.window.length && t - this.window[0].t > HOLD_MS) this.window.shift()
    if (!this.isStill(sample)) {
      this.message = 'Stand in the middle and hold still'
      this.stepStart = t
      this.window = [{ t, s: sample }]
      return { step: 'hold', progress: 0, message: this.message }
    }
    const elapsed = t - (this.stepStart ?? t)
    this.message = 'Hold still…'
    if (elapsed < HOLD_MS) return { step: 'hold', progress: elapsed / HOLD_MS, message: this.message }

    const measured = this.window.filter((w) => t - w.t <= MEASURE_MS).map((w) => w.s)
    const aspect = frame.imageHeight > 0 ? frame.imageWidth / frame.imageHeight : 0.75
    const result = buildCalibration(measured, this.params, aspect)
    if (!result.ok) {
      this.message = FIT_MESSAGES[result.issue]
      this.goto('adjust', t)
      return { step: 'adjust', progress: 0, message: this.message }
    }
    this.calibration = result.calibration
    this.step = 'done'
    this.message = 'Calibrated!'
    return { step: 'done', progress: 1, message: this.message, calibration: this.calibration }
  }

  private isStill(latest: BodySample): boolean {
    let minX = latest.hip.x
    let maxX = latest.hip.x
    let minY = latest.head.y
    let maxY = latest.head.y
    for (const { s } of this.window) {
      minX = Math.min(minX, s.hip.x)
      maxX = Math.max(maxX, s.hip.x)
      minY = Math.min(minY, s.head.y)
      maxY = Math.max(maxY, s.head.y)
    }
    const xTol = Math.max(0.015, 0.15 * latest.shoulderWidth)
    const yTol = Math.max(0.02, 0.1 * latest.torso)
    const centered = latest.hip.x > 0.25 && latest.hip.x < 0.75
    return centered && maxX - minX < xTol && maxY - minY < yTol
  }

  private goto(step: CalibrationStep, t: number | null) {
    if (this.step !== step) this.stepStart = t
    else if (t === null) this.stepStart = null
    this.step = step
  }
}

/** A calibration for keyboard play / tests when no body has been measured. */
export function defaultCalibration(params: CalibrationParams): Calibration {
  const headY0 = 0.16
  const torso = 0.24
  const W = 0.15
  const hipX0 = 0.5
  return {
    headY0,
    hipX0,
    hipY0: 0.45,
    torso,
    shoulderWidth: W,
    laneWidthFactor: params.laneWidthFactor,
    ...laneGeometry(hipX0, W, params.laneWidthFactor),
    ...lineYs(headY0, torso, params.jumpFactor, params.duckFactor),
    imageAspect: 0.75,
  }
}

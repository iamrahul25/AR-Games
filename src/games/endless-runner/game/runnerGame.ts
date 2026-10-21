import type { PoseFrame } from '@/core/pose/types'
import { REST_BREAK_S } from '../config/difficulty'
import { MAX_STEPS_PER_FRAME, STEP_S } from '../config/world'
import type { KeyboardInput } from '../demo/keyboardControls'
import { RunnerSession, type SessionEvent, type SessionPhase } from '../engine/session'
import { randomSeed } from '../engine/rng'
import { RunnerSim, type RunStats, type SimEvent, type WorldSnapshot } from '../engine/sim'
import { PracticeCourse, TrainingFlow, practiceConfig, type AutoTune, type TrainingEvent } from '../engine/training'
import {
  Calibrator,
  defaultCalibration,
  laneGeometry,
  lineYs,
  type Calibration,
  type CalibrationParams,
  type CalibratorState,
} from '../motion/calibration'
import { MotionController, type MotionConfig, type MotionEvent, type MotionState } from '../motion/motionController'
import type { RunConfig } from '../types'

/** Seconds of empty track after resuming. */
const RESUME_CLEAR_S = 3

export type GameEvent =
  | { type: 'sim'; event: SimEvent }
  | { type: 'motion'; event: MotionEvent }
  | { type: 'session'; event: SessionEvent }
  | { type: 'training'; event: TrainingEvent }
  | { type: 'calibration'; state: CalibratorState }

export interface RunnerGameOptions {
  config: RunConfig
  showTips: boolean
  training: boolean
  /** Keyboard-only play: no calibration or body checks. */
  keyboardOnly?: boolean
  keyboard?: KeyboardInput | null
  seed?: number
}

export function motionConfig(c: RunConfig): MotionConfig {
  return { jumpFactor: c.jumpFactor, duckFactor: c.duckFactor, jumpStyle: c.jumpStyle, duckStyle: c.duckStyle, seatedMode: c.seatedMode }
}

export function calibrationParams(c: RunConfig): CalibrationParams {
  return { jumpFactor: c.jumpFactor, duckFactor: c.duckFactor, laneWidthFactor: c.laneWidthFactor, seatedMode: c.seatedMode }
}

/**
 * One play session: setup tips → calibration → training run → countdown → run, with pause,
 * tracking loss, rest breaks and recalibration. Pure TS, clock passed in (ms), so the play
 * screen and the end-to-end tests drive exactly the same logic.
 */
export class RunnerGame {
  config: RunConfig
  readonly session: RunnerSession
  readonly motion: MotionController
  readonly calibrator: Calibrator
  sim: RunnerSim
  training: TrainingFlow | null = null
  practiceSim: RunnerSim | null = null
  practice: PracticeCourse | null = null
  calibratorState: CalibratorState
  private keyboard: KeyboardInput | null
  private keyboardOnly: boolean
  private pendingJumps = 0
  private lastTick: number | null = null
  private acc = 0
  private seed: number

  constructor(opts: RunnerGameOptions) {
    this.config = opts.config
    this.keyboard = opts.keyboard ?? null
    this.keyboardOnly = !!opts.keyboardOnly
    this.seed = opts.seed ?? randomSeed()
    this.session = new RunnerSession({ showTips: opts.showTips && !this.keyboardOnly, training: opts.training && !this.keyboardOnly })
    this.motion = new MotionController(motionConfig(opts.config))
    this.calibrator = new Calibrator(calibrationParams(opts.config))
    this.calibratorState = this.calibrator.state
    this.sim = new RunnerSim(opts.config, { seed: this.seed })
  }

  get phase(): SessionPhase {
    return this.session.phase
  }

  get calibration(): Calibration | null {
    return this.motion.calibration
  }

  get motionState(): MotionState {
    return this.motion.state
  }

  /** The sim on screen: the practice track during training, else the run. */
  get activeSim(): RunnerSim {
    return this.session.phase === 'training' && this.practiceSim ? this.practiceSim : this.sim
  }

  world(): WorldSnapshot {
    return this.activeSim.snapshot()
  }

  stats(): RunStats {
    return this.sim.stats()
  }

  /** Call once at start (and handles keyboard-only setup). */
  start(now: number): GameEvent[] {
    const ev: GameEvent[] = []
    if (this.keyboardOnly && this.session.phase === 'calibrating') this.finishCalibration(defaultCalibration(calibrationParams(this.config)), now, ev)
    return ev
  }

  tipsDone(now: number): GameEvent[] {
    const ev = wrapSession(this.session.tipsDone())
    if (this.keyboardOnly) this.finishCalibration(defaultCalibration(calibrationParams(this.config)), now, ev)
    return ev
  }

  get isKeyboardOnly() {
    return this.keyboardOnly
  }

  /** Switch to keyboard-only play (web): skips calibration and the training run. */
  switchToKeyboard(now: number): GameEvent[] {
    if (this.keyboardOnly) return []
    this.keyboardOnly = true
    const ev: GameEvent[] = []
    if (this.session.phase === 'setup-tips') ev.push(...wrapSession(this.session.tipsDone()))
    if (this.session.phase === 'training') ev.push(...this.skipTraining(now))
    if (this.session.phase === 'calibrating') {
      const started = this.session.hasStarted
      this.finishCalibration(defaultCalibration(calibrationParams(this.config)), now, ev)
      if (!started && (this.session.phase as SessionPhase) === 'training') ev.push(...this.skipTraining(now))
    }
    return ev
  }

  /** Feed a smoothed pose frame (canonical space). */
  onPose(frame: PoseFrame | null, now: number): GameEvent[] {
    const ev: GameEvent[] = []
    const phase = this.session.phase
    if (phase === 'over') return ev

    if (phase === 'calibrating' && !this.keyboardOnly) {
      const prev = this.calibratorState
      const st = this.calibrator.update(frame, now)
      this.calibratorState = st
      if (st.step !== prev.step || st.message !== prev.message || Math.abs(st.progress - prev.progress) > 0.04) {
        ev.push({ type: 'calibration', state: st })
      }
      // Keep motion updated for head/hip markers while calibrating.
      this.motion.update(frame, now)
      if (st.step === 'done' && st.calibration) this.finishCalibration(st.calibration, now, ev)
      return ev
    }

    if (this.keyboardOnly) return ev
    const { state, events } = this.motion.update(frame, now)
    for (const e of events) {
      ev.push({ type: 'motion', event: e })
      if (e.type === 'jump') this.pendingJumps++
      if (e.type === 'tracking-lost') ev.push(...wrapSession(this.session.trackingLost()))
    }
    if (this.session.phase === 'training' && this.training) {
      for (const t of this.training.onMotion(events, state, now)) this.onTrainingEvent(t, ev)
    }
    return ev
  }

  private finishCalibration(cal: Calibration, now: number, ev: GameEvent[]) {
    this.motion.setCalibration(cal)
    const before = this.session.phase
    ev.push(...wrapSession(this.session.calibrated(now)))
    if (before === 'calibrating' && this.session.phase === 'training') this.startTraining(now, ev)
  }

  private startTraining(now: number, ev: GameEvent[]) {
    this.training = new TrainingFlow(this.config.enabledMoves, this.config.jumpStyle)
    this.practiceSim = new RunnerSim(practiceConfig(this.config), { seed: this.seed, scripted: true })
    this.practice = null
    for (const t of this.training.start(now)) this.onTrainingEvent(t, ev)
  }

  private onTrainingEvent(t: TrainingEvent, ev: GameEvent[]) {
    ev.push({ type: 'training', event: t })
    if (t.type === 'step' && t.step.id === 'practice' && this.practiceSim) {
      this.practice = new PracticeCourse(this.practiceSim, this.config.enabledMoves)
      this.practice.start()
    }
  }

  skipTraining(now: number): GameEvent[] {
    const ev: GameEvent[] = []
    if (this.training) for (const t of this.training.skip(now)) this.onTrainingEvent(t, ev)
    this.endTraining(now, ev)
    return ev
  }

  private endTraining(now: number, ev: GameEvent[]) {
    this.practiceSim = null
    this.practice = null
    this.training = null
    this.lastTick = null
    ev.push(...wrapSession(this.session.trainingDone(now)))
  }

  /** Per animation frame: session timers, training, fixed-step simulation. */
  tick(now: number): GameEvent[] {
    const ev: GameEvent[] = []
    const ms = this.motion.state
    const kb = this.keyboard
    const skipBodyChecks = this.keyboardOnly || !!kb?.active
    const wasStarted = this.session.hasStarted
    for (const e of this.session.update(now, {
      tracked: ms.tracking !== 'lost' && !!ms.hip,
      inCenter: ms.lane === 0,
      stillMs: ms.stillMs,
      skipBodyChecks,
    })) {
      ev.push({ type: 'session', event: e })
      if (e.type === 'go') {
        this.lastTick = null
        this.acc = 0
        this.pendingJumps = 0
        if (wasStarted) this.sim.clearAhead(RESUME_CLEAR_S)
      }
    }

    const phase = this.session.phase
    if (phase === 'training' && this.training) {
      for (const t of this.training.update(now)) this.onTrainingEvent(t, ev)
    }
    const sim = phase === 'running' ? this.sim : phase === 'training' ? this.practiceSim : null
    if (!sim) {
      this.lastTick = null
      return ev
    }

    const dt = this.lastTick === null ? 0 : Math.min((now - this.lastTick) / 1000, MAX_STEPS_PER_FRAME * STEP_S)
    this.lastTick = now
    this.acc += dt
    const useKb = this.keyboardOnly || !!kb?.active
    let steps = 0
    while (this.acc >= STEP_S && steps < MAX_STEPS_PER_FRAME) {
      this.acc -= STEP_S
      steps++
      const jumps = useKb ? (kb?.takeJumps() ?? 0) : this.pendingJumps
      this.pendingJumps = 0
      const events = sim.step(STEP_S, {
        lane: useKb && kb ? kb.lane : ms.lane,
        ducking: useKb && kb ? kb.ducking : ms.ducking,
        jumps,
      })
      for (const e of events) {
        ev.push({ type: 'sim', event: e })
        if (sim === this.sim) {
          if (e.type === 'finished') ev.push(...wrapSession(this.session.finish()))
          if (e.type === 'rest-start' && this.config.restBreak) {
            this.sim.clearTrack()
            ev.push(...wrapSession(this.session.rest(now, REST_BREAK_S)))
          }
        }
      }
      if (sim === this.practiceSim && this.practice && this.training) {
        if (this.practice.onSimEvents(events)) {
          for (const t of this.training.practiceDone(now)) this.onTrainingEvent(t, ev)
        }
        if (this.training.done) {
          this.endTraining(now, ev)
          break
        }
      }
      if (this.session.phase !== phase) break
    }
    if (steps === MAX_STEPS_PER_FRAME) this.acc = 0
    return ev
  }

  pause(): GameEvent[] {
    return wrapSession(this.session.pause())
  }

  resume(now: number): GameEvent[] {
    return wrapSession(this.session.resume(now))
  }

  recalibrate(): GameEvent[] {
    if (this.keyboardOnly) return []
    this.calibrator.reset()
    this.calibratorState = this.calibrator.state
    this.motion.setCalibration(null)
    return [...wrapSession(this.session.recalibrate()), { type: 'calibration', state: this.calibratorState }]
  }

  /** New run with the same calibration. */
  restart(now: number): GameEvent[] {
    this.seed = randomSeed()
    this.sim = new RunnerSim(this.config, { seed: this.seed })
    this.lastTick = null
    this.acc = 0
    this.pendingJumps = 0
    this.keyboard?.reset()
    if (!this.motion.calibration) return this.recalibrate()
    return wrapSession(this.session.restart(now))
  }

  finishEarly(): GameEvent[] {
    return wrapSession(this.session.finish())
  }

  /**
   * Change settings mid-session (training auto-tune). Rebuilds lines/lanes from the measured
   * body and, if the run hasn't started yet, the run itself.
   */
  updateConfig(config: RunConfig) {
    this.config = config
    this.motion.setConfig(motionConfig(config))
    this.calibrator.setParams(calibrationParams(config))
    const cal = this.motion.calibration
    if (cal) {
      this.motion.setCalibration({
        ...cal,
        laneWidthFactor: config.laneWidthFactor,
        ...laneGeometry(cal.hipX0, cal.shoulderWidth, config.laneWidthFactor),
        ...lineYs(cal.headY0, cal.torso, config.jumpFactor, config.duckFactor),
      })
    }
    if (!this.session.hasStarted) this.sim = new RunnerSim(config, { seed: this.seed })
  }
}

function wrapSession(events: SessionEvent[]): GameEvent[] {
  return events.map((event) => ({ type: 'session' as const, event }))
}

/** Settings tweak behind each training auto-tune offer. */
export function autoTuneLabel(fix: AutoTune): { title: string; body: string } {
  switch (fix) {
    case 'jump-line-low':
      return { title: 'Lower the jump line?', body: 'Your jumps will count with a smaller hop.' }
    case 'duck-line-shallow':
      return { title: 'Make ducking easier?', body: 'A smaller bend will count as a duck.' }
    case 'lane-narrow':
      return { title: 'Narrower lanes?', body: 'Smaller steps will change lanes.' }
  }
}

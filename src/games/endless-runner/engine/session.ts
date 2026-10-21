export type SessionPhase =
  | 'setup-tips'
  | 'calibrating'
  | 'training'
  | 'countdown'
  | 'running'
  | 'paused'
  | 'waiting'
  | 'resting'
  | 'over'

/** Why we're waiting for the player to stand in the middle before the countdown. */
export type WaitReason = 'resume' | 'lost' | 'rest' | 'recalibrated'

export interface SessionContext {
  /** Body tracked (head, shoulders, hips visible). */
  tracked: boolean
  /** Standing in the center lane. */
  inCenter: boolean
  /** How long the hips have stayed put (ms). */
  stillMs: number
  /** Keyboard play: no body checks before resuming. */
  skipBodyChecks: boolean
}

export type SessionEvent =
  | { type: 'phase'; phase: SessionPhase }
  | { type: 'countdown'; value: number }
  | { type: 'go' }

export const COUNTDOWN_MS = 3000
export const RESUME_STILL_MS = 1000

/**
 * Phase machine (§16.2):
 * setup-tips → calibrating → training? → countdown → running
 * running ⇄ paused / waiting (lost tracking, resume check) / resting → countdown → running
 * running → over. Pure TS; time is passed in.
 */
export class RunnerSession {
  phase: SessionPhase
  waitReason: WaitReason | null = null
  countdownValue = 3
  restEndsAt = 0
  private countdownStart = 0
  private pausedFrom: SessionPhase | null = null
  private needsTraining: boolean
  /** True once the run has started (calibrating again later is a recalibration). */
  private started = false

  constructor(opts: { showTips: boolean; training: boolean }) {
    this.phase = opts.showTips ? 'setup-tips' : 'calibrating'
    this.needsTraining = opts.training
  }

  get hasStarted() {
    return this.started
  }

  private set(phase: SessionPhase, ev: SessionEvent[]) {
    if (this.phase === phase) return
    this.phase = phase
    ev.push({ type: 'phase', phase })
  }

  private beginCountdown(now: number, ev: SessionEvent[]) {
    this.countdownStart = now
    this.countdownValue = 3
    this.waitReason = null
    this.set('countdown', ev)
    ev.push({ type: 'countdown', value: 3 })
  }

  tipsDone(): SessionEvent[] {
    const ev: SessionEvent[] = []
    if (this.phase === 'setup-tips') this.set('calibrating', ev)
    return ev
  }

  calibrated(now: number): SessionEvent[] {
    const ev: SessionEvent[] = []
    if (this.phase !== 'calibrating') return ev
    if (this.started) {
      this.waitReason = 'recalibrated'
      this.set('waiting', ev)
    } else if (this.needsTraining) this.set('training', ev)
    else this.beginCountdown(now, ev)
    return ev
  }

  trainingDone(now: number): SessionEvent[] {
    const ev: SessionEvent[] = []
    if (this.phase !== 'training') return ev
    this.needsTraining = false
    this.beginCountdown(now, ev)
    return ev
  }

  update(now: number, ctx: SessionContext): SessionEvent[] {
    const ev: SessionEvent[] = []
    switch (this.phase) {
      case 'countdown': {
        const elapsed = now - this.countdownStart
        if (elapsed >= COUNTDOWN_MS) {
          this.started = true
          this.set('running', ev)
          ev.push({ type: 'go' })
        } else {
          const value = 3 - Math.floor(elapsed / 1000)
          if (value !== this.countdownValue) {
            this.countdownValue = value
            ev.push({ type: 'countdown', value })
          }
        }
        break
      }
      case 'waiting':
        if (ctx.skipBodyChecks || (ctx.tracked && ctx.inCenter && ctx.stillMs >= RESUME_STILL_MS)) {
          this.beginCountdown(now, ev)
        }
        break
      case 'resting':
        if (now >= this.restEndsAt) {
          this.waitReason = 'rest'
          this.set('waiting', ev)
        }
        break
    }
    return ev
  }

  pause(): SessionEvent[] {
    const ev: SessionEvent[] = []
    if (this.phase === 'paused' || this.phase === 'over') return ev
    this.pausedFrom = this.phase
    this.set('paused', ev)
    return ev
  }

  resume(now: number): SessionEvent[] {
    const ev: SessionEvent[] = []
    if (this.phase !== 'paused') return ev
    const from = this.pausedFrom
    this.pausedFrom = null
    if (from === 'setup-tips' || from === 'calibrating' || from === 'training') this.set(from, ev)
    else if (from === 'resting' && now < this.restEndsAt) this.set('resting', ev)
    else if (!this.started && from === 'countdown') this.beginCountdown(now, ev)
    else {
      this.waitReason = 'resume'
      this.set('waiting', ev)
    }
    return ev
  }

  trackingLost(): SessionEvent[] {
    const ev: SessionEvent[] = []
    if (this.phase === 'running' || this.phase === 'countdown') {
      this.waitReason = 'lost'
      this.set('waiting', ev)
    }
    return ev
  }

  rest(now: number, durationS: number): SessionEvent[] {
    const ev: SessionEvent[] = []
    if (this.phase !== 'running') return ev
    this.restEndsAt = now + durationS * 1000
    this.set('resting', ev)
    return ev
  }

  recalibrate(): SessionEvent[] {
    const ev: SessionEvent[] = []
    if (this.phase === 'over') return ev
    this.pausedFrom = null
    this.set('calibrating', ev)
    return ev
  }

  /** Restart the run from the countdown (calibration is kept). */
  restart(now: number): SessionEvent[] {
    const ev: SessionEvent[] = []
    this.pausedFrom = null
    this.started = false
    this.beginCountdown(now, ev)
    return ev
  }

  finish(): SessionEvent[] {
    const ev: SessionEvent[] = []
    this.set('over', ev)
    return ev
  }
}

export interface HoldConfig {
  holdMs: number
  /** Score needed to start holding. */
  enterThreshold: number
  /** Score below which the hold breaks (hysteresis: lower than `enterThreshold`). */
  exitThreshold: number
  /** How long the score may dip below `exitThreshold` before the hold breaks. */
  graceMs: number
  /** `pause` keeps progress when the hold breaks, `reset` starts over. */
  breakBehavior: 'pause' | 'reset'
}

export type HoldState = 'idle' | 'holding' | 'complete'

export type HoldEvent = 'hold-start' | 'hold-break' | 'hold-complete'

/**
 * Tracks whether the player has held a pose long enough:
 *
 *   idle ──score ≥ enter──▶ holding ──held ≥ holdMs──▶ complete
 *     ▲                       │ score < exit for > graceMs
 *     └───────────────────────┘
 */
export class HoldTracker {
  state: HoldState = 'idle'
  heldMs = 0
  private lastTime: number | undefined
  private belowSince: number | null = null
  private accuracySum = 0
  private accuracySamples = 0

  constructor(private readonly config: HoldConfig) {}

  get progress(): number {
    return Math.min(1, this.heldMs / this.config.holdMs)
  }

  /** Average match score while the pose was being held. */
  get accuracy(): number {
    return this.accuracySamples > 0 ? this.accuracySum / this.accuracySamples : 0
  }

  /** Forget the last update time (call after a pause so paused time isn't counted). */
  resetClock() {
    this.lastTime = undefined
    this.belowSince = null
  }

  update(now: number, score: number): HoldEvent | null {
    const dt = this.lastTime === undefined ? 0 : Math.max(0, now - this.lastTime)
    this.lastTime = now
    if (this.state === 'complete') return null

    const { enterThreshold, exitThreshold, graceMs, holdMs, breakBehavior } = this.config
    const aboveThreshold = this.state === 'holding' ? score >= exitThreshold : score >= enterThreshold

    if (aboveThreshold) {
      let event: HoldEvent | null = null
      if (this.state === 'idle') {
        this.state = 'holding'
        event = 'hold-start'
      } else {
        this.heldMs += dt
      }
      this.belowSince = null
      this.accuracySum += score
      this.accuracySamples += 1
      if (this.heldMs >= holdMs) {
        this.state = 'complete'
        return 'hold-complete'
      }
      return event
    }

    if (this.state === 'holding') {
      if (this.belowSince === null) this.belowSince = now
      if (now - this.belowSince > graceMs) {
        this.state = 'idle'
        this.belowSince = null
        if (breakBehavior === 'reset') {
          this.heldMs = 0
          this.accuracySum = 0
          this.accuracySamples = 0
        }
        return 'hold-break'
      }
    }
    return null
  }
}

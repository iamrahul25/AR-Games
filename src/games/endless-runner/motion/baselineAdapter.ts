export interface Baseline {
  headY0: number
  hipY0: number
  torso: number
}

const NEUTRAL_HOLD_MS = 1500
const TAU_S = 4
/** Max baseline change per second, in torso lengths. */
const MAX_RATE = 0.1
/** Max head speed (torso lengths / s) still counted as standing. */
const STILL_SPEED = 0.6

/**
 * Users drift forward/back during a run. While standing neutral for > 1.5 s, the standing
 * head/hip height and torso length follow slowly (EMA τ ≈ 4 s, ≤ 0.1 T/s), so the jump and
 * duck lines stay in the right place. Lane boundaries are tied to the room and never move.
 */
export class BaselineAdapter {
  baseline: Baseline
  private neutralSince: number | null = null
  private lastT: number | null = null
  private lastHeadY: number | null = null

  constructor(initial: Baseline) {
    this.baseline = { ...initial }
  }

  reset(initial: Baseline) {
    this.baseline = { ...initial }
    this.neutralSince = null
    this.lastT = null
    this.lastHeadY = null
  }

  update(sample: { t: number; headY: number; hipY: number; torso: number }, moving: boolean): Baseline {
    const dt = this.lastT === null ? 0 : Math.max(0, (sample.t - this.lastT) / 1000)
    const speed = this.lastHeadY !== null && dt > 0 ? Math.abs(sample.headY - this.lastHeadY) / dt / this.baseline.torso : 0
    this.lastT = sample.t
    this.lastHeadY = sample.headY

    if (moving || speed > STILL_SPEED) {
      this.neutralSince = null
      return this.baseline
    }
    if (this.neutralSince === null) this.neutralSince = sample.t
    if (sample.t - this.neutralSince < NEUTRAL_HOLD_MS || dt === 0) return this.baseline

    const alpha = 1 - Math.exp(-dt / TAU_S)
    const maxStep = MAX_RATE * this.baseline.torso * dt
    const follow = (cur: number, target: number) => cur + Math.max(-maxStep, Math.min(maxStep, (target - cur) * alpha))
    this.baseline = {
      headY0: follow(this.baseline.headY0, sample.headY),
      hipY0: follow(this.baseline.hipY0, sample.hipY),
      torso: follow(this.baseline.torso, sample.torso),
    }
    return this.baseline
  }
}

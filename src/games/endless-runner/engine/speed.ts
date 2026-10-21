import { clampDial, dialToSpeed } from '../config/difficulty'
import { HIT_DIP_DIAL, HIT_DIP_RECOVER_S } from '../config/world'

export interface SpeedConfig {
  startDial: number
  maxDial: number
  /** 0 = constant speed. */
  rampStepDial: number
  rampEveryS: number
}

/** Dial level after `runningS` seconds of running: staged steps, capped at the max. */
export function stagedDial(cfg: SpeedConfig, runningS: number): number {
  if (cfg.rampStepDial <= 0 || cfg.rampEveryS <= 0) return cfg.startDial
  const stages = Math.floor(runningS / cfg.rampEveryS)
  return Math.min(cfg.maxDial, cfg.startDial + stages * cfg.rampStepDial)
}

/** How much a hit slows you down `sinceHitS` seconds later (recovers linearly over 3 s). */
export function hitDip(sinceHitS: number): number {
  if (sinceHitS < 0 || sinceHitS >= HIT_DIP_RECOVER_S) return 0
  return HIT_DIP_DIAL * (1 - sinceHitS / HIT_DIP_RECOVER_S)
}

/**
 * Constant or staged-increasing speed. After a hit (increasing mode only), speed dips by one
 * dial level and recovers over 3 s; the ramp schedule itself is not reset.
 */
export class SpeedController {
  baseDial: number
  private lastHitS = -Infinity

  constructor(private cfg: SpeedConfig) {
    this.baseDial = cfg.startDial
  }

  get increasing() {
    return this.cfg.rampStepDial > 0
  }

  /** Advances to `runningS`; returns the new base dial if a "Speed up!" stage was reached. */
  update(runningS: number): number | null {
    const next = stagedDial(this.cfg, runningS)
    if (next > this.baseDial + 1e-9) {
      this.baseDial = next
      return next
    }
    return null
  }

  hit(runningS: number) {
    if (this.increasing) this.lastHitS = runningS
  }

  dial(runningS: number): number {
    return clampDial(this.baseDial - hitDip(runningS - this.lastHitS))
  }

  speed(runningS: number): number {
    return dialToSpeed(this.dial(runningS))
  }

  /** Speed one stage ahead, for spacing obstacles generated a few seconds early. */
  lookaheadSpeed(): number {
    return dialToSpeed(Math.min(this.cfg.maxDial, this.baseDial + this.cfg.rampStepDial))
  }
}

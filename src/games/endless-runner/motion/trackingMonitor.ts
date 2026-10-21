import { headPoint, landmarksVisible } from '@/core/pose/bodyMetrics'
import { LM } from '@/core/pose/landmarks'
import type { PoseFrame } from '@/core/pose/types'

export type TrackingQuality = 'ok' | 'weak' | 'lost'

export const LOST_AFTER_MS = 700

const CORE = [LM.leftShoulder, LM.rightShoulder, LM.leftHip, LM.rightHip]
const LEGS = [LM.leftKnee, LM.rightKnee, LM.leftAnkle, LM.rightAnkle]

/**
 * `lost` when head, shoulders or hips are missing for > 700 ms (the run auto-pauses).
 * `weak` when knees or ankles are out of view (jump and duck still work).
 */
export class TrackingMonitor {
  quality: TrackingQuality = 'ok'
  private badSince: number | null = null

  constructor(private seatedMode = false) {}

  reset() {
    this.quality = 'ok'
    this.badSince = null
  }

  update(frame: PoseFrame | null, t: number): { quality: TrackingQuality; changed: 'lost' | 'restored' | null } {
    const coreOk = !!frame && !!headPoint(frame) && landmarksVisible(frame, CORE)
    const prev = this.quality
    if (!coreOk) {
      if (this.badSince === null) this.badSince = t
      if (t - this.badSince > LOST_AFTER_MS) this.quality = 'lost'
    } else {
      this.badSince = null
      this.quality = this.seatedMode || landmarksVisible(frame, LEGS) ? 'ok' : 'weak'
    }
    const changed = prev !== 'lost' && this.quality === 'lost' ? 'lost' : prev === 'lost' && this.quality !== 'lost' ? 'restored' : null
    return { quality: this.quality, changed }
  }

  /** True when the last sample had a usable body (even if not yet declared lost). */
  static usable(frame: PoseFrame | null): boolean {
    return !!frame && !!headPoint(frame) && landmarksVisible(frame, CORE)
  }
}

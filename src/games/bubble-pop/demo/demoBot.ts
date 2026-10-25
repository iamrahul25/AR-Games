import { directionAngle, type SegmentName } from '@/core/pose/geometry'
import { LM } from '@/core/pose/landmarks'
import { BODY_PROPORTIONS, fullSkeleton, NEUTRAL_SKELETON, type SegmentSpec, type SkeletonSpec } from '@/core/pose/skeleton'
import type { SimulatorTarget } from '@/core/pose/simulator'
import type { PoseFrame } from '@/core/pose/types'
import type { Bubble, BubbleSnapshot } from '../engine/bubbleGame'

export interface DemoContext {
  snapshot: BubbleSnapshot
  frame: PoseFrame | null
}

export interface DemoBotOptions {
  /** How long a bubble must be on screen before the bot goes for it. */
  reactionMs?: number
}

const ARM = BODY_PROPORTIONS.upperArm + BODY_PROPORTIONS.forearm
const LEG = BODY_PROPORTIONS.thigh + BODY_PROPORTIONS.shin

/**
 * Demo-mode player: reaches for the bubble that will burst soonest (kicks the low ones)
 * and ignores bombs. Drives the pose simulator through `SimulatorTarget`s.
 */
export class BubbleDemoBot {
  private firstSeen = new Map<number, number>()
  private targetId: number | null = null

  constructor(
    private readonly ctx: () => DemoContext,
    private readonly opts: DemoBotOptions = {},
  ) {}

  target(now: number): SimulatorTarget {
    const { snapshot, frame } = this.ctx()
    const idle: SimulatorTarget = { skeleton: NEUTRAL_SKELETON, view: 'front', centerX: 0.5 }
    if (snapshot.phase !== 'playing' || !frame) return idle

    const alive = new Set(snapshot.bubbles.map((b) => b.id))
    for (const id of this.firstSeen.keys()) if (!alive.has(id)) this.firstSeen.delete(id)
    for (const b of snapshot.bubbles) if (!this.firstSeen.has(b.id)) this.firstSeen.set(b.id, now)

    const reaction = this.opts.reactionMs ?? 350
    const ready = snapshot.bubbles.filter((b) => b.kind !== 'bomb' && now - (this.firstSeen.get(b.id) ?? now) >= reaction)
    const goal = ready.find((b) => b.id === this.targetId) ?? [...ready].sort((a, b) => a.life - b.life)[0]
    if (!goal) {
      this.targetId = null
      return idle
    }
    this.targetId = goal.id
    return { skeleton: reachFor(goal, frame), view: 'front', centerX: 0.5 }
  }
}

function reachFor(b: Bubble, frame: PoseFrame): SkeletonSpec {
  const l = frame.landmarks
  const W = frame.imageWidth
  const H = frame.imageHeight
  const mid = (i: number, j: number) => ({ x: (l[i].x + l[j].x) / 2, y: (l[i].y + l[j].y) / 2 })
  const shoulders = mid(LM.leftShoulder, LM.rightShoulder)
  const hips = mid(LM.leftHip, LM.rightHip)
  const torsoPx = Math.hypot((shoulders.x - hips.x) * W, (shoulders.y - hips.y) * H)
  const side = b.x < (b.low ? hips.x : shoulders.x) ? 'left' : 'right'

  const aim = (origin: { x: number; y: number }, limbUnits: number): SegmentSpec => {
    const dx = (b.x - origin.x) * W
    const dy = (b.y - origin.y) * H
    const length = Math.min(1, Math.max(0.35, Math.hypot(dx, dy) / (torsoPx * limbUnits)))
    return { angle: directionAngle(dx, dy), length }
  }

  const spec: Partial<Record<SegmentName, SegmentSpec>> = {}
  if (b.low) {
    const leg = aim(l[side === 'left' ? LM.leftHip : LM.rightHip], LEG)
    spec[`${side}Thigh`] = leg
    spec[`${side}Shin`] = leg
  } else {
    const arm = aim(l[side === 'left' ? LM.leftShoulder : LM.rightShoulder], ARM)
    spec[`${side}UpperArm`] = arm
    spec[`${side}Forearm`] = arm
  }
  return fullSkeleton(spec)
}

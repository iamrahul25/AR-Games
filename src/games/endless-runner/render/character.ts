import type { WorldSnapshot } from '../engine/sim'
import type { DrawList } from './drawList'
import type { RunnerPalette } from './palette'
import { project, type Camera } from './projection'

type Player = WorldSnapshot['player']

/** Body points in meters relative to the feet (x right, y up), seen from behind. */
interface Pose {
  hip: [number, number]
  neck: [number, number]
  head: [number, number]
  lKnee: [number, number]
  lFoot: [number, number]
  rKnee: [number, number]
  rFoot: [number, number]
  lElbow: [number, number]
  lHand: [number, number]
  rElbow: [number, number]
  rHand: [number, number]
}

function poseFor(p: Player, time: number): Pose {
  const phi = p.runPhase * Math.PI * 2
  if (p.state === 'slide') {
    return {
      hip: [0, 0.3],
      neck: [0, 0.62],
      head: [0, 0.78],
      lKnee: [-0.16, 0.22],
      lFoot: [-0.2, 0.05],
      rKnee: [0.16, 0.22],
      rFoot: [0.2, 0.05],
      lElbow: [-0.3, 0.45],
      lHand: [-0.42, 0.25],
      rElbow: [0.3, 0.45],
      rHand: [0.42, 0.25],
    }
  }
  if (p.state === 'jump') {
    const tuck = Math.sin(Math.min(1, p.jumpProgress) * Math.PI)
    return {
      hip: [0, 0.95 - 0.15 * tuck],
      neck: [0, 1.45 - 0.12 * tuck],
      head: [0, 1.65 - 0.12 * tuck],
      lKnee: [-0.14, 0.55 + 0.1 * tuck],
      lFoot: [-0.12, 0.1 + 0.3 * tuck],
      rKnee: [0.14, 0.55 + 0.1 * tuck],
      rFoot: [0.12, 0.1 + 0.3 * tuck],
      lElbow: [-0.32, 1.45],
      lHand: [-0.38, 1.75],
      rElbow: [0.32, 1.45],
      rHand: [0.38, 1.75],
    }
  }
  const bob = Math.abs(Math.sin(phi)) * 0.05
  const l = Math.max(0, Math.sin(phi))
  const r = Math.max(0, -Math.sin(phi))
  const arm = Math.sin(phi) * 0.14
  const stumble = p.state === 'hit' ? Math.sin(time * 40) * 0.06 : 0
  return {
    hip: [stumble, 0.95 + bob],
    neck: [stumble * 2, 1.45 + bob],
    head: [stumble * 2.4, 1.65 + bob],
    lKnee: [-0.13, 0.5 + l * 0.25],
    lFoot: [-0.12, 0.04 + l * 0.32],
    rKnee: [0.13, 0.5 + r * 0.25],
    rFoot: [0.12, 0.04 + r * 0.32],
    lElbow: [-0.3, 1.18 - arm],
    lHand: [-0.26, 0.98 - arm * 1.6],
    rElbow: [0.3, 1.18 + arm],
    rHand: [0.26, 0.98 + arm * 1.6],
  }
}

/** Draws the runner and its shadow (procedural limbs from state + run-cycle phase). */
export function drawRunner(list: DrawList, cam: Camera, p: Player, pal: RunnerPalette, time: number) {
  const ground = project(cam, p.x, 0, 0)
  if (!ground) return
  const gx = ground.x
  const gy = ground.y
  const s = ground.s
  const shadowScale = Math.max(0.35, 1 - p.y / 2)
  list.ellipse(pal.shadow, 0.35 * shadowScale, gx, gy, 0.45 * s * shadowScale, 0.12 * s * shadowScale)

  const feet = project(cam, p.x, p.y, 0)
  if (!feet) return
  const fx = feet.x
  const fy = feet.y
  const blink = p.invulnerable && Math.floor(time * 10) % 2 === 0
  const a = blink ? 0.35 : 1
  const hitFlash = p.state === 'hit'
  const pose = poseFor(p, time)
  const X = (pt: [number, number]) => fx + pt[0] * s
  const Y = (pt: [number, number]) => fy - pt[1] * s
  const limb = 0.12 * s
  const hipL: [number, number] = [pose.hip[0] - 0.1, pose.hip[1]]
  const hipR: [number, number] = [pose.hip[0] + 0.1, pose.hip[1]]
  const shL: [number, number] = [pose.neck[0] - 0.2, pose.neck[1] - 0.04]
  const shR: [number, number] = [pose.neck[0] + 0.2, pose.neck[1] - 0.04]

  // Legs
  for (const [hip, knee, foot] of [
    [hipL, pose.lKnee, pose.lFoot],
    [hipR, pose.rKnee, pose.rFoot],
  ] as const) {
    list.line(pal.skin, a, X(hip), Y(hip), X(knee), Y(knee), limb)
    list.line(pal.skin, a, X(knee), Y(knee), X(foot), Y(foot), limb * 0.9)
    list.circle(pal.shoe, a, X(foot), Y(foot), limb * 0.75)
  }
  // Shorts
  list.quad(
    pal.shorts,
    a,
    X([hipL[0] - 0.06, hipL[1] + 0.12]),
    Y([hipL[0] - 0.06, hipL[1] + 0.12]),
    X([hipR[0] + 0.06, hipR[1] + 0.12]),
    Y([hipR[0] + 0.06, hipR[1] + 0.12]),
    X([hipR[0] + 0.07, hipR[1] - 0.12]),
    Y([hipR[0] + 0.07, hipR[1] - 0.12]),
    X([hipL[0] - 0.07, hipL[1] - 0.12]),
    Y([hipL[0] - 0.07, hipL[1] - 0.12]),
  )
  // Torso (shirt)
  const shirt = hitFlash ? '#FF5D6C' : pal.shirt
  list.quad(
    shirt,
    a,
    X(shL),
    Y(shL),
    X(shR),
    Y(shR),
    X([hipR[0] + 0.05, hipR[1] + 0.1]),
    Y([hipR[0] + 0.05, hipR[1] + 0.1]),
    X([hipL[0] - 0.05, hipL[1] + 0.1]),
    Y([hipL[0] - 0.05, hipL[1] + 0.1]),
  )
  // Arms
  for (const [sh, elbow, hand] of [
    [shL, pose.lElbow, pose.lHand],
    [shR, pose.rElbow, pose.rHand],
  ] as const) {
    list.line(shirt, a, X(sh), Y(sh), X(elbow), Y(elbow), limb)
    list.line(pal.skin, a, X(elbow), Y(elbow), X(hand), Y(hand), limb * 0.85)
  }
  // Head (back of the head: hair)
  list.circle(pal.skin, a, X(pose.head), Y(pose.head), 0.15 * s)
  list.circle(pal.hair, a, X(pose.head), Y([pose.head[0], pose.head[1] + 0.02]), 0.14 * s)
}

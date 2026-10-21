import { LANE_SPACING, OBSTACLE_SHAPES, VIEW_DISTANCE, COIN_RADIUS, HINT_LEAD_S, laneX } from '../config/world'
import type { SimObstacle, WorldSnapshot } from '../engine/sim'
import type { Lane, MoveKind } from '../types'
import { drawRunner } from './character'
import type { DrawList } from './drawList'
import { CITY_PALETTE, shade, type RunnerPalette } from './palette'
import { NEAR, fogAlpha, makeCamera, scaleAt, screenX, screenY, type Camera } from './projection'

const TRACK_HALF = LANE_SPACING * 1.5 + 0.5
const STRIPE_M = 2
const DASH_M = 1.5
const DASH_GAP_M = 3
const TRACK_NEAR_Z = -5
const BOX_HALF = LANE_SPACING * 0.44

/** Deterministic skyline: [relative x, width, height] in fractions of the screen. */
function skyline(seed: number, count: number, minH: number, maxH: number): [number, number, number][] {
  let s = seed
  const rand = () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
  const out: [number, number, number][] = []
  let x = 0
  for (let i = 0; i < count; i++) {
    const w = 0.05 + rand() * 0.08
    out.push([x, w, minH + rand() * (maxH - minH)])
    x += w + rand() * 0.015
  }
  return out
}
const FAR_SKYLINE = skyline(7, 30, 0.05, 0.16)
const NEAR_SKYLINE = skyline(31, 26, 0.08, 0.22)
const skylineWidth = (b: [number, number, number][]) => b[b.length - 1][0] + b[b.length - 1][1] + 0.01

export interface SceneOptions {
  palette?: RunnerPalette
  /** Wall-clock seconds, for idle animation (coin spin, blink). */
  time: number
}

/** Builds the full frame's draw list from a world snapshot. */
export function buildScene(list: DrawList, world: WorldSnapshot, width: number, height: number, opts: SceneOptions) {
  const pal = opts.palette ?? CITY_PALETTE
  const t = opts.time
  list.reset()
  const shake = world.shake > 0 ? Math.sin(t * 70) * 0.18 * world.shake : 0
  const cam = makeCamera(width, height, world.player.x, shake)
  if (world.shake > 0) cam.horizonY += Math.cos(t * 55) * 4 * world.shake

  drawSky(list, cam, world, pal)
  drawTrack(list, cam, world, pal)

  const obstacles = world.obstacles
  // Far → near; the player (z = 0) is drawn between obstacles ahead and those already passed.
  const order = sortedIndices(obstacles, world.distance)
  let playerDrawn = false
  for (const i of order) {
    const o = obstacles[i]
    const z = o.at - world.distance
    if (!playerDrawn && z + OBSTACLE_SHAPES[o.type].depth < 0.3) {
      drawCoinsAndPlayer(list, cam, world, pal, t)
      playerDrawn = true
    }
    drawObstacle(list, cam, o, z, pal)
  }
  if (!playerDrawn) drawCoinsAndPlayer(list, cam, world, pal, t)
  if (world.showHints) drawHints(list, cam, world)
  drawParticles(list, cam, world)
}

const orderScratch: number[] = []
function sortedIndices(obstacles: readonly SimObstacle[], distance: number): number[] {
  orderScratch.length = 0
  for (let i = 0; i < obstacles.length; i++) {
    const o = obstacles[i]
    if (o.state === 'hit' || o.state === 'done') continue
    const z = o.at - distance
    if (z > VIEW_DISTANCE + 3) continue
    orderScratch.push(i)
  }
  orderScratch.sort((a, b) => obstacles[b].at - obstacles[a].at)
  return orderScratch
}

function drawSky(list: DrawList, cam: Camera, world: WorldSnapshot, pal: RunnerPalette) {
  const W = cam.width
  const H = cam.horizonY
  list.grad(pal.skyTop, pal.skyBottom, 0, 0, W, H + 1)
  const camShift = cam.x * 6
  for (const [layer, color, speed, top] of [
    [FAR_SKYLINE, pal.skylineFar, 0.6, 1],
    [NEAR_SKYLINE, pal.skylineNear, 1.4, 0],
  ] as const) {
    const span = skylineWidth(layer) * W
    const offset = (((world.distance * speed + camShift * (top ? 0.5 : 1)) % span) + span) % span
    for (let rep = 0; rep < 3; rep++) {
      for (const [bx, bw, bh] of layer) {
        const x = bx * W + rep * span - offset
        const w = bw * W
        if (x + w < 0 || x > W) continue
        const h = bh * cam.height
        list.rect(color, 1, x, H - h, w, h + 1)
        if (!top) {
          // A few lit windows per building
          const cols = Math.max(1, Math.floor(w / 14))
          const rows = Math.max(1, Math.floor(h / 18))
          for (let r = 0; r < rows; r++)
            for (let c = 0; c < cols; c++) {
              if (((bx * 997 + r * 13 + c * 7) | 0) % 5 !== 0) continue
              list.rect(pal.windows, 0.45, x + 4 + c * 14, H - h + 5 + r * 18, 5, 7)
            }
        }
      }
    }
  }
}

function drawTrack(list: DrawList, cam: Camera, world: WorldSnapshot, pal: RunnerPalette) {
  list.rect(pal.ground, 1, 0, cam.horizonY, cam.width, cam.height - cam.horizonY)
  const zFar = VIEW_DISTANCE
  const zNear = Math.max(TRACK_NEAR_Z, cam.z + NEAR + 0.1)
  // Track surface
  list.quad(
    pal.track,
    1,
    screenX(cam, -TRACK_HALF, zFar),
    screenY(cam, 0, zFar),
    screenX(cam, TRACK_HALF, zFar),
    screenY(cam, 0, zFar),
    screenX(cam, TRACK_HALF, zNear),
    screenY(cam, 0, zNear),
    screenX(cam, -TRACK_HALF, zNear),
    screenY(cam, 0, zNear),
  )
  // Moving cross stripes (motion cue)
  const phase = world.distance % (STRIPE_M * 2)
  for (let z = zNear - phase + STRIPE_M * 2; z < zFar; z += STRIPE_M * 2) {
    const z0 = Math.max(zNear, z)
    const z1 = Math.min(zFar, z + STRIPE_M)
    if (z1 <= z0) continue
    list.quad(
      pal.trackStripe,
      fogAlpha(z0),
      screenX(cam, -TRACK_HALF, z1),
      screenY(cam, 0, z1),
      screenX(cam, TRACK_HALF, z1),
      screenY(cam, 0, z1),
      screenX(cam, TRACK_HALF, z0),
      screenY(cam, 0, z0),
      screenX(cam, -TRACK_HALF, z0),
      screenY(cam, 0, z0),
    )
  }
  // Dashed lane lines
  const dashPhase = world.distance % DASH_GAP_M
  for (const lx of [-LANE_SPACING / 2, LANE_SPACING / 2]) {
    for (let z = zNear - dashPhase + DASH_GAP_M; z < zFar; z += DASH_GAP_M) {
      const z0 = Math.max(zNear, z)
      const z1 = Math.min(zFar, z + DASH_M)
      if (z1 <= z0) continue
      const w0 = 0.07 * scaleAt(cam, z0)
      const w1 = 0.07 * scaleAt(cam, z1)
      const x0 = screenX(cam, lx, z0)
      const x1 = screenX(cam, lx, z1)
      list.quad(
        pal.laneLine,
        0.55 * fogAlpha(z0),
        x1 - w1,
        screenY(cam, 0, z1),
        x1 + w1,
        screenY(cam, 0, z1),
        x0 + w0,
        screenY(cam, 0, z0),
        x0 - w0,
        screenY(cam, 0, z0),
      )
    }
  }
  // Glowing side rails
  for (const side of [-1, 1]) {
    const x = side * TRACK_HALF
    list.quad(
      pal.rail,
      0.9,
      screenX(cam, x, zFar),
      screenY(cam, 0.18, zFar),
      screenX(cam, x, zFar),
      screenY(cam, 0, zFar),
      screenX(cam, x, zNear),
      screenY(cam, 0, zNear),
      screenX(cam, x, zNear),
      screenY(cam, 0.18, zNear),
    )
    list.line(pal.rail, 0.35, screenX(cam, x, zFar), screenY(cam, 0.18, zFar), screenX(cam, x, zNear), screenY(cam, 0.18, zNear), 6)
  }
}

/** Contiguous lane runs, e.g. [-1, 0, 1] → [[-1, 1]], [-1, 1] → [[-1, -1], [1, 1]]. */
function laneRuns(lanes: readonly Lane[]): [Lane, Lane][] {
  const sorted = [...lanes].sort((a, b) => a - b)
  const runs: [Lane, Lane][] = []
  for (const l of sorted) {
    const last = runs[runs.length - 1]
    if (last && l === last[1] + 1) last[1] = l
    else runs.push([l, l])
  }
  return runs
}

/** An extruded box (front, top and the visible side), with fog. */
function drawBox(
  list: DrawList,
  cam: Camera,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  color: string,
  alpha: number,
) {
  const zMin = cam.z + NEAR + 0.05
  if (z1 <= zMin) return
  const zn = Math.max(z0, zMin)
  const X = (x: number, z: number) => screenX(cam, x, z)
  const Y = (y: number, z: number) => screenY(cam, y, z)
  // Top (seen from above when the camera is higher)
  if (cam.y > y1)
    list.quad(shade(color, 0.3), alpha, X(x0, z1), Y(y1, z1), X(x1, z1), Y(y1, z1), X(x1, zn), Y(y1, zn), X(x0, zn), Y(y1, zn))
  else list.quad(shade(color, -0.45), alpha, X(x0, z1), Y(y0, z1), X(x1, z1), Y(y0, z1), X(x1, zn), Y(y0, zn), X(x0, zn), Y(y0, zn))
  // Side facing the camera
  if (x1 < cam.x)
    list.quad(shade(color, -0.3), alpha, X(x1, zn), Y(y1, zn), X(x1, z1), Y(y1, z1), X(x1, z1), Y(y0, z1), X(x1, zn), Y(y0, zn))
  else if (x0 > cam.x)
    list.quad(shade(color, -0.3), alpha, X(x0, zn), Y(y1, zn), X(x0, z1), Y(y1, z1), X(x0, z1), Y(y0, z1), X(x0, zn), Y(y0, zn))
  // Front
  list.quad(color, alpha, X(x0, zn), Y(y1, zn), X(x1, zn), Y(y1, zn), X(x1, zn), Y(y0, zn), X(x0, zn), Y(y0, zn))
}

function drawObstacle(list: DrawList, cam: Camera, o: SimObstacle, z: number, pal: RunnerPalette) {
  if (z > VIEW_DISTANCE) return
  const shape = OBSTACLE_SHAPES[o.type]
  const alpha = fogAlpha(z)
  const color = o.type === 'hurdle' ? pal.hurdle : o.type === 'bar' ? pal.bar : pal.wall
  const z1 = z + shape.depth
  for (const [from, to] of laneRuns(o.lanes)) {
    const x0 = laneX(from) - BOX_HALF
    const x1 = laneX(to) + BOX_HALF
    if (o.type === 'bar') {
      // Posts at each end, then the bar
      const post = 0.12
      drawBox(list, cam, x0, x0 + post, 0, shape.top, z, z + post, shade(color, -0.35), alpha)
      drawBox(list, cam, x1 - post, x1, 0, shape.top, z, z + post, shade(color, -0.35), alpha)
      drawBox(list, cam, x0, x1, shape.bottom, shape.top, z, z1, color, alpha)
    } else if (o.type === 'hurdle') {
      drawBox(list, cam, x0, x1, shape.bottom, shape.top, z, z1, color, alpha)
      // Dark stripes on the front face
      const zMin = cam.z + NEAR + 0.05
      if (z > zMin) {
        const s = scaleAt(cam, z)
        const yTop = screenY(cam, shape.top * 0.62, z)
        const yBot = screenY(cam, shape.top * 0.38, z)
        list.rect(shade(color, -0.4), alpha, screenX(cam, x0, z), yTop, (x1 - x0) * s, yBot - yTop)
      }
    } else {
      drawBox(list, cam, x0, x1, shape.bottom, shape.top, z, z1, color, alpha)
      const zMin = cam.z + NEAR + 0.05
      if (z > zMin) {
        // Warning band near the top
        const s = scaleAt(cam, z)
        const yTop = screenY(cam, shape.top - 0.25, z)
        const yBot = screenY(cam, shape.top - 0.45, z)
        list.rect(shade(color, 0.45), alpha, screenX(cam, x0, z), yTop, (x1 - x0) * s, yBot - yTop)
      }
    }
  }
}

function drawCoinsAndPlayer(list: DrawList, cam: Camera, world: WorldSnapshot, pal: RunnerPalette, t: number) {
  // Coins ahead of the player, far → near (coins list is in spawn order: near → far).
  const coins = world.coins
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i]
    if (c.taken) continue
    const z = c.at - world.distance
    if (z < 0.2 || z > VIEW_DISTANCE) continue
    drawCoin(list, cam, laneX(c.lane), c.y, z, c.kind, c.id, pal, t)
  }
  drawRunner(list, cam, world.player, pal, t)
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i]
    if (c.taken) continue
    const z = c.at - world.distance
    if (z >= 0.2 || z < cam.z + NEAR + 0.2) continue
    drawCoin(list, cam, laneX(c.lane), c.y, z, c.kind, c.id, pal, t)
  }
}

function drawCoin(list: DrawList, cam: Camera, x: number, y: number, z: number, kind: 'coin' | 'star', id: number, pal: RunnerPalette, t: number) {
  const s = scaleAt(cam, z)
  const sx = screenX(cam, x, z)
  const sy = screenY(cam, y, z)
  const alpha = fogAlpha(z)
  const r = COIN_RADIUS * s
  if (kind === 'star') {
    const R = r * 1.5
    const rot = t * 2 + id
    const pts: number[] = []
    for (let k = 0; k < 10; k++) {
      const rad = k % 2 === 0 ? R : R * 0.45
      const a = rot + (k * Math.PI) / 5
      pts.push(sx + Math.sin(a) * rad, sy - Math.cos(a) * rad)
    }
    list.circle(pal.coin, 0.3 * alpha, sx, sy, R * 1.3)
    list.poly(pal.star, alpha, ...pts)
    return
  }
  const spin = Math.abs(Math.cos(t * 4 + id * 0.7))
  list.ellipse(shade(pal.coin, -0.3), alpha, sx, sy, Math.max(r * 0.15, r * spin), r)
  list.ellipse(pal.coin, alpha, sx, sy, Math.max(r * 0.1, r * spin * 0.8), r * 0.8)
  if (spin > 0.5) list.ellipse(pal.coinShine, 0.8 * alpha, sx - r * 0.25 * spin, sy - r * 0.3, r * 0.15 * spin, r * 0.2)
}

const HINT_COLORS: Record<MoveKind, string> = { jump: '#FFC53D', duck: '#3CC8FF', lane: '#FFFFFF' }

function drawHints(list: DrawList, cam: Camera, world: WorldSnapshot) {
  const seen = new Set<number>()
  for (const o of world.obstacles) {
    if (o.state !== 'active' || seen.has(o.row)) continue
    const z = o.at - world.distance
    if (z <= 1 || z / Math.max(1, world.speed) > HINT_LEAD_S * 1.6) continue
    seen.add(o.row)
    const move: MoveKind = o.type === 'hurdle' ? 'jump' : o.type === 'bar' ? 'duck' : 'lane'
    if (move === 'lane') {
      // Point at a free lane
      const free = ([-1, 0, 1] as Lane[]).filter((l) => !world.obstacles.some((p) => p.row === o.row && p.lanes.includes(l)))
      if (free.length === 0) continue
      const target = free.reduce((best, l) => (Math.abs(laneX(l) - world.player.x) < Math.abs(laneX(best) - world.player.x) ? l : best))
      const dir = laneX(target) < world.player.x ? -1 : 1
      if (Math.abs(laneX(target) - world.player.x) < 0.3) continue
      hintIcon(list, cam, laneX(target) - dir * LANE_SPACING, OBSTACLE_SHAPES.wall.top + 0.8, z, move, dir)
    } else {
      const lane = o.lanes.includes(world.player.lane) ? world.player.lane : o.lanes[0]
      hintIcon(list, cam, laneX(lane), OBSTACLE_SHAPES[o.type].top + 0.8, z, move, 0)
    }
  }
}

function hintIcon(list: DrawList, cam: Camera, x: number, y: number, z: number, move: MoveKind, dir: number) {
  const s = Math.min(scaleAt(cam, z), cam.f / 4)
  const cx = screenX(cam, x, z)
  const cy = screenY(cam, y, z)
  const r = 0.45 * s
  const alpha = fogAlpha(z)
  const color = HINT_COLORS[move]
  list.circle('#050A19', 0.75 * alpha, cx, cy, r)
  list.circle(color, alpha, cx, cy, r, Math.max(2, r * 0.12))
  const a = r * 0.55
  if (move === 'jump') list.poly(color, alpha, cx, cy - a, cx + a, cy + a * 0.5, cx - a, cy + a * 0.5)
  else if (move === 'duck') list.poly(color, alpha, cx, cy + a, cx + a, cy - a * 0.5, cx - a, cy - a * 0.5)
  else list.poly(color, alpha, cx + dir * a, cy, cx - dir * a * 0.5, cy - a, cx - dir * a * 0.5, cy + a)
}

function drawParticles(list: DrawList, cam: Camera, world: WorldSnapshot) {
  for (const p of world.particles) {
    if (p.life <= 0) continue
    const z = p.at - world.distance
    if (z < cam.z + NEAR + 0.2) continue
    const s = scaleAt(cam, z)
    const a = Math.min(1, p.life / p.maxLife) * fogAlpha(z)
    const sx = screenX(cam, p.x, z)
    const sy = screenY(cam, p.y, z)
    if (p.kind === 'shard') list.rect(p.color, a, sx - 0.08 * s, sy - 0.08 * s, 0.16 * s, 0.16 * s)
    else list.circle(p.color, a, sx, sy, 0.07 * s)
  }
}

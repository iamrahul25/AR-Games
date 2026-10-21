import { VIEW_DISTANCE } from '../config/world'

/** A perspective camera behind and above the runner. */
export interface Camera {
  x: number
  y: number
  z: number
  /** Focal length in px. */
  f: number
  cx: number
  horizonY: number
  width: number
  height: number
}

export const CAMERA_HEIGHT = 3.2
export const CAMERA_BACK = -6
export const NEAR = 0.5
/** Fog: alpha ramps from 0 at the horizon distance to 1 this much closer. */
const FOG_RANGE = 10

export function makeCamera(width: number, height: number, playerX: number, shakeX = 0): Camera {
  return {
    x: playerX * 0.6 + shakeX,
    y: CAMERA_HEIGHT,
    z: CAMERA_BACK,
    f: Math.min(height * 0.9, width * 1.0),
    cx: width / 2,
    horizonY: height * 0.33,
    width,
    height,
  }
}

export interface Projected {
  x: number
  y: number
  /** px per meter at this depth */
  s: number
}

const out: Projected = { x: 0, y: 0, s: 0 }

/** World → screen. Returns a shared object (copy what you need), or null behind the near plane. */
export function project(cam: Camera, wx: number, wy: number, wz: number, target: Projected = out): Projected | null {
  const d = wz - cam.z
  if (d < NEAR) return null
  const s = cam.f / d
  target.x = cam.cx + (wx - cam.x) * s
  target.y = cam.horizonY + (cam.y - wy) * s
  target.s = s
  return target
}

export function screenX(cam: Camera, wx: number, wz: number): number {
  return cam.cx + ((wx - cam.x) * cam.f) / Math.max(NEAR, wz - cam.z)
}

export function screenY(cam: Camera, wy: number, wz: number): number {
  return cam.horizonY + ((cam.y - wy) * cam.f) / Math.max(NEAR, wz - cam.z)
}

export function scaleAt(cam: Camera, wz: number): number {
  return cam.f / Math.max(NEAR, wz - cam.z)
}

/** 0 at the horizon distance → 1 when closer than horizon − 10 m. */
export function fogAlpha(z: number): number {
  return Math.max(0, Math.min(1, (VIEW_DISTANCE - z) / FOG_RANGE))
}

import type { Lane, ObstacleType } from '../types'

/** Distance between lane centers (m). Lanes are at x = −2, 0, +2. */
export const LANE_SPACING = 2
export const laneX = (lane: Lane) => lane * LANE_SPACING

/** Furthest visible distance (m); obstacles spawn a little beyond and fade in. */
export const VIEW_DISTANCE = 45
export const SPAWN_DISTANCE = 50
/** Objects this far behind the player are removed. */
export const CULL_BEHIND = -6

/** Seconds to ease one lane over. */
export const LANE_EASE_S = 0.18
export const JUMP_HEIGHT = 1.4
export const PLAYER_HEIGHT = 1.8
export const SLIDE_HEIGHT = 0.6
export const PLAYER_DEPTH = 0.6
export const PLAYER_HALF_WIDTH = 0.45

export interface ObstacleShape {
  /** Bottom and top of the solid part (m). */
  bottom: number
  top: number
  /** Length along the track (m). */
  depth: number
  color: string
}

export const OBSTACLE_SHAPES: Record<ObstacleType, ObstacleShape> = {
  hurdle: { bottom: 0, top: 0.7, depth: 0.4, color: '#FFC53D' },
  bar: { bottom: 1.1, top: 1.5, depth: 0.4, color: '#3CC8FF' },
  wall: { bottom: 0, top: 2.5, depth: 1.2, color: '#FF6B4A' },
}

export const INVULNERABLE_S = 2
export const HIT_STUMBLE_S = 0.5
export const HIT_DIP_DIAL = 1
export const HIT_DIP_RECOVER_S = 3
/** Obstacle-free start of every run and after every resume. */
export const START_SAFE_S = 5
export const MILESTONE_EVERY_M = 250
export const COIN_SPACING_M = 1.8
export const COIN_Y = 0.6
export const COIN_RADIUS = 0.32
/** Voice/icon hint lead time before impact. */
export const HINT_LEAD_S = 1.2
/** Fixed simulation step. */
export const STEP_S = 1 / 60
export const MAX_STEPS_PER_FRAME = 5
export const WATER_BREAK_EVERY_S = 600

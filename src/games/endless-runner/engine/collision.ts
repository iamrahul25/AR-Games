import { LANE_SPACING, OBSTACLE_SHAPES, PLAYER_DEPTH, PLAYER_HEIGHT, SLIDE_HEIGHT } from '../config/world'
import type { Lane, ObstacleType } from '../types'

export interface PlayerBody {
  /** Eased world x (m). */
  x: number
  /** Feet height (m). */
  y: number
  sliding: boolean
}

/** Lane whose center is closest to x — so a lane change counts once it's past halfway. */
export function laneFromX(x: number): Lane {
  const l = Math.round(x / LANE_SPACING)
  return (l < -1 ? -1 : l > 1 ? 1 : l) as Lane
}

export function playerTop(p: PlayerBody): number {
  return p.y + (p.sliding ? SLIDE_HEIGHT : PLAYER_HEIGHT)
}

/** Does an obstacle whose near face is `z` m ahead overlap the player's depth? */
export function overlapsPlayer(z: number, type: ObstacleType): boolean {
  const depth = OBSTACLE_SHAPES[type].depth
  return z < PLAYER_DEPTH / 2 && z + depth > -PLAYER_DEPTH / 2
}

/**
 * Hit rules: wall — in a covered lane; hurdle — covered lane and feet below the hurdle top;
 * bar — covered lane and body reaching the bar (standing or jumping into it).
 */
export function wouldHit(type: ObstacleType, lanes: readonly Lane[], p: PlayerBody): boolean {
  if (!lanes.includes(laneFromX(p.x))) return false
  const shape = OBSTACLE_SHAPES[type]
  switch (type) {
    case 'wall':
      return true
    case 'hurdle':
      return p.y < shape.top
    case 'bar':
      return playerTop(p) > shape.bottom
  }
}

/** The move that gets you past an obstacle type. */
export function avoidingMove(type: ObstacleType): 'jump' | 'duck' | 'lane' {
  return type === 'hurdle' ? 'jump' : type === 'bar' ? 'duck' : 'lane'
}

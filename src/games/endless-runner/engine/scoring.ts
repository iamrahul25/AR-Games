export const POINTS = {
  coin: 10,
  star: 100,
  closeCall: 25,
  cleared: 20,
} as const

/** x1, x2 at a 10 streak, x3 at 25, x4 at 50. */
export function streakMultiplier(streak: number): number {
  if (streak >= 50) return 4
  if (streak >= 25) return 3
  if (streak >= 10) return 2
  return 1
}

/** Distance points: faster running is worth more (speedFactor = speed / 9 m/s). */
export function distancePoints(meters: number, speed: number): number {
  return meters * (speed / 9)
}

export function clearedPoints(streak: number): number {
  return POINTS.cleared * streakMultiplier(streak)
}

export function finalScore(raw: number, multiplier: number): number {
  return Math.round(raw * multiplier)
}

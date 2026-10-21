import { posePoints, ratingForAccuracy, summarizeAttempts, summarizeLevel } from '../engine/scoring'
import type { PoseOutcome } from '../types'

const outcome = (matched: boolean, accuracy = 0.9, points = 100): PoseOutcome => ({
  poseId: 'x',
  matched,
  accuracy,
  points: matched ? points : 0,
  rating: matched ? ratingForAccuracy(accuracy) : 'miss',
  timeUsedMs: 1000,
})

describe('scoring', () => {
  it('rates accuracy', () => {
    expect(ratingForAccuracy(0.97)).toBe('perfect')
    expect(ratingForAccuracy(0.9)).toBe('great')
    expect(ratingForAccuracy(0.8)).toBe('good')
  })

  it('rewards difficulty and speed', () => {
    expect(posePoints(1, 'hard', 0, 10_000)).toBeGreaterThan(posePoints(1, 'easy', 0, 10_000))
    expect(posePoints(1, 'easy', 10_000, 10_000)).toBe(150)
    expect(posePoints(1, 'easy', 0, 10_000)).toBe(100)
  })

  it('gives stars for passing, matching all, and accuracy', () => {
    expect(summarizeLevel([outcome(true), outcome(false), outcome(false)], 0.6).stars).toBe(0)
    expect(summarizeLevel([outcome(true), outcome(true), outcome(false)], 0.6).stars).toBe(1)
    expect(summarizeLevel([outcome(true, 0.85), outcome(true, 0.85)], 0.6).stars).toBe(2)
    expect(summarizeLevel([outcome(true, 0.95), outcome(true, 0.92)], 0.6).stars).toBe(3)
  })

  it('scores attempt levels by how many tries it took', () => {
    expect(summarizeAttempts([outcome(true)]).stars).toBe(3)
    expect(summarizeAttempts([outcome(false), outcome(true)]).stars).toBe(2)
    expect(summarizeAttempts([outcome(false), outcome(false), outcome(true)]).stars).toBe(1)
    const failed = summarizeAttempts([outcome(false), outcome(false), outcome(false)])
    expect(failed.passed).toBe(false)
    expect(failed.stars).toBe(0)
  })
})

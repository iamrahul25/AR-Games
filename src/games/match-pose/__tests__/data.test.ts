import { SEGMENT_NAMES } from '@/core/pose/geometry'
import { LEVELS } from '../data/levels'
import { POSE_LIST, POSES } from '../data/poses'

describe('pose library', () => {
  it('has unique ids', () => {
    expect(new Set(POSE_LIST.map((p) => p.id)).size).toBe(POSE_LIST.length)
  })

  it('has a complete skeleton with sane values for every pose', () => {
    for (const pose of POSE_LIST) {
      for (const seg of SEGMENT_NAMES) {
        const spec = pose.skeleton[seg]
        expect(spec).toBeDefined()
        expect(spec.angle).toBeGreaterThanOrEqual(-180)
        expect(spec.angle).toBeLessThanOrEqual(180)
        if (spec.length !== undefined) {
          expect(spec.length).toBeGreaterThan(0)
          expect(spec.length).toBeLessThanOrEqual(1)
        }
      }
      expect(pose.instruction.length).toBeGreaterThan(5)
    }
  })

  it('has at least 26 poses', () => {
    expect(POSE_LIST.length).toBeGreaterThanOrEqual(26)
  })
})

describe('levels', () => {
  it('has 30 levels numbered 1..30', () => {
    expect(LEVELS.map((l) => l.id)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1))
  })

  it('only references existing poses', () => {
    for (const level of LEVELS) {
      for (const id of level.poses) expect(POSES[id]).toBeDefined()
    }
  })

  it('uses sensible tuning values', () => {
    for (const level of LEVELS) {
      expect(level.poses.length).toBeGreaterThan(0)
      expect(level.holdSeconds).toBeGreaterThan(0)
      expect(level.timeLimitSeconds).toBeGreaterThan(level.holdSeconds + 2)
      expect(level.matchThreshold).toBeGreaterThan(0.5)
      expect(level.matchThreshold).toBeLessThan(1)
      expect(level.passRatio).toBeGreaterThan(0)
      expect(level.passRatio).toBeLessThanOrEqual(1)
    }
  })

  it('marks expert levels with safety warnings', () => {
    for (const level of LEVELS.filter((l) => l.tier === 'expert')) expect(level.safetyWarning).toBe(true)
  })

  it('gets harder: thresholds never drop between tiers', () => {
    const tiers = ['easy', 'medium', 'hard'] as const
    for (let i = 1; i < tiers.length; i++) {
      const prevMax = Math.max(...LEVELS.filter((l) => l.tier === tiers[i - 1]).map((l) => l.matchThreshold))
      const curMin = Math.min(...LEVELS.filter((l) => l.tier === tiers[i]).map((l) => l.matchThreshold))
      expect(curMin).toBeGreaterThanOrEqual(prevMax)
    }
  })
})

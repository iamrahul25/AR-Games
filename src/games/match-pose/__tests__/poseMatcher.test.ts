import { flipX } from '@/core/pose/mirror'
import { frameToSkeleton, NEUTRAL_SKELETON, skeletonToFrame } from '@/core/pose/skeleton'
import type { PoseFrame } from '@/core/pose/types'
import { getPose, mirrorSkeleton, POSE_LIST } from '../data/poses'
import { compilePose, matchPose, scoreDeviation } from '../engine/poseMatcher'
import { coachingCue } from '../engine/feedback'

const IMAGE = { imageWidth: 480, imageHeight: 640 }

function frameFor(id: string): PoseFrame {
  const pose = getPose(id)
  return skeletonToFrame(pose.skeleton, pose.view, IMAGE)
}

function score(poseId: string, frame: PoseFrame) {
  return matchPose(compilePose(getPose(poseId)), frame).score
}

const standing = skeletonToFrame(NEUTRAL_SKELETON, 'front', IMAGE)

describe('scoreDeviation', () => {
  it('is 1 inside tolerance and falls to 0 at twice the tolerance', () => {
    expect(scoreDeviation(10, 20)).toBe(1)
    expect(scoreDeviation(30, 20)).toBeCloseTo(0.5)
    expect(scoreDeviation(45, 20)).toBe(0)
  })
})

describe('matchPose', () => {
  it.each(POSE_LIST.map((p) => p.id))('recognises its own illustration: %s', (id) => {
    expect(score(id, frameFor(id))).toBeGreaterThan(0.97)
  })

  it.each(POSE_LIST.map((p) => p.id))('still matches a non-square image: %s', (id) => {
    const pose = getPose(id)
    const wide = skeletonToFrame(pose.skeleton, pose.view, { imageWidth: 1280, imageHeight: 720 })
    expect(score(id, wide)).toBeGreaterThan(0.97)
  })

  it.each(POSE_LIST.map((p) => p.id))('forgives a slightly sloppy attempt: %s', (id) => {
    const pose = getPose(id)
    const sloppy = Object.fromEntries(
      Object.entries(pose.skeleton).map(([seg, spec], i) => [seg, { ...spec, angle: spec.angle + (i % 2 ? 12 : -12) }]),
    ) as typeof pose.skeleton
    expect(score(id, skeletonToFrame(sloppy, pose.view, IMAGE))).toBeGreaterThan(0.85)
  })

  it('does not accept just standing there for any non-trivial pose', () => {
    const failures = POSE_LIST.filter((p) => score(p.id, standing) >= 0.75).map((p) => p.id)
    expect(failures).toEqual([])
  })

  it('tells clearly different poses apart', () => {
    expect(score('t-pose', frameFor('arms-up'))).toBeLessThan(0.75)
    expect(score('arms-up', frameFor('t-pose'))).toBeLessThan(0.75)
    expect(score('full-squat', frameFor('star'))).toBeLessThan(0.75)
    expect(score('tree-left', frameFor('tree-right'))).toBeLessThan(0.75)
    expect(score('knee-lift-left', frameFor('knee-lift-right'))).toBeLessThan(0.75)
  })

  it('needs knees bent for a front-view squat (foreshortened thighs)', () => {
    const fakeSquat = skeletonToFrame(
      { ...getPose('half-squat').skeleton, leftThigh: { angle: -165 }, rightThigh: { angle: 165 } },
      'front',
      IMAGE,
    )
    expect(score('half-squat', fakeSquat)).toBeLessThan(score('half-squat', frameFor('half-squat')) - 0.1)
  })

  it('accepts orientation-free poses facing either way', () => {
    for (const pose of POSE_LIST.filter((p) => p.orientationFree)) {
      const mirrored = skeletonToFrame(mirrorSkeleton(pose.skeleton), pose.view, IMAGE)
      expect(score(pose.id, mirrored)).toBeGreaterThan(0.97)
      const original = frameFor(pose.id)
      expect(score(pose.id, { ...original, landmarks: flipX(original.landmarks) })).toBeGreaterThan(0.97)
    }
  })

  it('treats hidden limbs as unknown and lowers the score when much is hidden', () => {
    const frame = frameFor('t-pose')
    const hidden: PoseFrame = {
      ...frame,
      landmarks: frame.landmarks.map((l, i) => (i >= 23 ? { ...l, visibility: 0 } : l)),
    }
    const result = matchPose(compilePose(getPose('t-pose')), hidden)
    expect(result.parts.leftLeg.status).toBe('unknown')
    expect(result.coverage).toBeLessThan(0.7)
    expect(result.score).toBeLessThan(0.97)
  })
})

describe('coachingCue', () => {
  it('suggests raising arms when copying arms-up while standing', () => {
    const result = matchPose(compilePose(getPose('arms-up')), standing)
    expect(coachingCue(result)).toMatch(/arm/i)
  })
})

describe('frameToSkeleton', () => {
  it('recovers the skeleton a frame was built from', () => {
    for (const id of ['warrior-2-left', 'tree-right', 'star', 'full-squat']) {
      const pose = getPose(id)
      const recovered = frameToSkeleton([frameFor(id)])
      const rebuilt = skeletonToFrame(recovered, pose.view, IMAGE)
      expect(score(id, rebuilt)).toBeGreaterThan(0.95)
    }
  })
})

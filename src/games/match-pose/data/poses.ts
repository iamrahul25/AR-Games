import { normalizeAngle, SEGMENT_NAMES, SEGMENTS } from '@/core/pose/geometry'
import { fullSkeleton, type SkeletonSpec } from '@/core/pose/skeleton'
import type { Difficulty, PoseDefinition, PoseTemplate } from '../types'
import { POSE_TEMPLATES } from './poseTemplates'

/** Mirror a skeleton left↔right (as seen on screen). */
export function mirrorSkeleton(skeleton: SkeletonSpec): SkeletonSpec {
  const out = {} as SkeletonSpec
  for (const name of SEGMENT_NAMES) {
    const spec = skeleton[name]
    out[SEGMENTS[name].mirror] = { ...spec, angle: normalizeAngle(-spec.angle) }
  }
  return out
}

function expand(template: PoseTemplate): PoseDefinition[] {
  const { sided, skeleton, ...rest } = template
  const base: PoseDefinition = { ...rest, skeleton: fullSkeleton(skeleton) }
  if (!sided) return [base]
  const mirroredChecks = template.checks
    ? Object.fromEntries(
        Object.entries(template.checks).map(([seg, v]) => [SEGMENTS[seg as keyof typeof SEGMENTS].mirror, v]),
      )
    : undefined
  return [
    { ...base, id: `${template.id}-left`, name: `${template.name} (Left)` },
    {
      ...base,
      id: `${template.id}-right`,
      name: `${template.name} (Right)`,
      skeleton: mirrorSkeleton(base.skeleton),
      checks: mirroredChecks,
    },
  ]
}

export const POSE_LIST: PoseDefinition[] = POSE_TEMPLATES.flatMap(expand)

export const POSES: Record<string, PoseDefinition> = Object.fromEntries(POSE_LIST.map((p) => [p.id, p]))

export function getPose(id: string): PoseDefinition {
  const pose = POSES[id]
  if (!pose) throw new Error(`Unknown pose "${id}"`)
  return pose
}

export function posesByDifficulty(difficulty: Difficulty): PoseDefinition[] {
  return POSE_LIST.filter((p) => p.difficulty === difficulty)
}

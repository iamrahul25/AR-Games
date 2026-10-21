import type { GameManifest } from '../types'
import { LEVELS } from './data/levels'

export const matchPoseManifest: GameManifest = {
  id: 'match-pose',
  title: 'Match Pose',
  tagline: 'Copy the pose. Hold it. Level up!',
  description: 'Strike the pose shown on screen and hold it before the timer runs out. From T-poses to handstands.',
  icon: '🧘',
  accent: '#3CC8FF',
  status: 'available',
  route: '/games/match-pose',
  badges: [`${LEVELS.length} levels`, 'Easy → Expert'],
}

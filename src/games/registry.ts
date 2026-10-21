import { matchPoseManifest } from './match-pose/manifest'
import type { GameManifest } from './types'

const freeRunManifest: GameManifest = {
  id: 'free-run',
  title: 'Free Run',
  tagline: 'Run in place, jump and duck past obstacles',
  description: 'An endless runner you control with your whole body.',
  icon: '🏃',
  accent: '#FF9F43',
  status: 'coming-soon',
}

export const GAMES: GameManifest[] = [matchPoseManifest, freeRunManifest]

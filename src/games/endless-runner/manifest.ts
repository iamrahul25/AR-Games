import type { GameManifest } from '../types'

export const endlessRunnerManifest: GameManifest = {
  id: 'free-run',
  title: 'Free Run',
  tagline: 'Hop, jump and duck past obstacles',
  description: 'A 3-lane endless runner you control with your whole body. Kids to athletes: pick a preset or set the speed dial.',
  icon: '🏃',
  accent: '#FF9F43',
  status: 'available',
  route: '/games/endless-runner',
  badges: ['Speed 1–10', 'Kids → Athlete'],
}

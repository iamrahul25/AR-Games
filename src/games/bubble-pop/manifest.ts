import type { GameManifest } from '../types'
import { BUBBLE_ROUTES } from './routes'

export const bubblePopManifest: GameManifest = {
  id: 'bubble-pop',
  title: 'Bubble Pop',
  tagline: 'Pop bubbles with your hands (and feet!)',
  description: 'Bubbles float up around you. Reach, swipe and kick to pop them before they burst, but dodge the bombs!',
  icon: '🫧',
  accent: '#A78BFA',
  status: 'available',
  route: BUBBLE_ROUTES.home,
  badges: ['3 modes', 'Great for kids'],
}

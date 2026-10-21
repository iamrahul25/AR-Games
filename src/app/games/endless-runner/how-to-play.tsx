import { useLocalSearchParams } from 'expo-router'

import { HowToPlayScreen } from '@/games/endless-runner/screens/HowToPlayScreen'

export default function HowToPlayRoute() {
  const { first } = useLocalSearchParams<{ first?: string }>()
  return <HowToPlayScreen first={first === '1'} />
}

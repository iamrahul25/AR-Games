import { useLocalSearchParams } from 'expo-router'

import { PlayScreen } from '@/games/endless-runner/screens/PlayScreen'

export default function PlayRoute() {
  const { training } = useLocalSearchParams<{ training?: string }>()
  return <PlayScreen forceTraining={training === '1'} />
}

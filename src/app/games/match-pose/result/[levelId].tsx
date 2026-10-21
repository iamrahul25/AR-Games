import { useLocalSearchParams } from 'expo-router'

import { ResultScreen } from '@/games/match-pose/screens/ResultScreen'

export default function ResultRoute() {
  const { levelId } = useLocalSearchParams<{ levelId: string }>()
  return <ResultScreen levelId={Number(levelId)} />
}

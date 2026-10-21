import { Redirect, router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'

import { getLevel, levelNeedsSafetyScreen } from '@/games/match-pose/data/levels'
import { PlayScreen } from '@/games/match-pose/screens/PlayScreen'
import { SafetyScreen } from '@/games/match-pose/screens/SafetyScreen'
import { isLevelUnlocked, useMatchPoseProgress } from '@/games/match-pose/store/progressStore'

export default function PlayRoute() {
  const { levelId } = useLocalSearchParams<{ levelId: string }>()
  const level = getLevel(Number(levelId))
  const levels = useMatchPoseProgress((s) => s.levels)
  const skipLevel = useMatchPoseProgress((s) => s.skipLevel)
  const [safetyAccepted, setSafetyAccepted] = useState(false)

  if (!level || !isLevelUnlocked(levels, level.id)) return <Redirect href={'/games/match-pose' as never} />

  if (levelNeedsSafetyScreen(level) && !safetyAccepted) {
    const canSkip = level.tier === 'expert'
    return (
      <SafetyScreen
        level={level}
        onContinue={() => setSafetyAccepted(true)}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/games/match-pose' as never))}
        onSkip={
          canSkip
            ? () => {
                skipLevel(level.id)
                const next = getLevel(level.id + 1)
                router.replace((next ? `/games/match-pose/play/${next.id}` : '/games/match-pose') as never)
              }
            : undefined
        }
      />
    )
  }

  return <PlayScreen key={level.id} level={level} />
}

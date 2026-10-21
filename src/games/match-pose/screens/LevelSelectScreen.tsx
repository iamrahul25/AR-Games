import { router } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useSettings } from '@/core/settings/settingsStore'
import { Screen } from '@/core/ui/Screen'
import { ScreenHeader } from '@/core/ui/ScreenHeader'
import { theme, TIER_COLORS } from '@/core/ui/theme'
import { LEVELS } from '../data/levels'
import { isLevelUnlocked, MAX_STARS, totalStars, totalTrophies, useMatchPoseProgress, type LevelProgress } from '../store/progressStore'
import type { Difficulty, LevelDefinition } from '../types'

const TIERS: { tier: Difficulty; label: string }[] = [
  { tier: 'easy', label: 'Easy' },
  { tier: 'medium', label: 'Medium' },
  { tier: 'hard', label: 'Hard' },
  { tier: 'expert', label: 'Expert' },
]

export function LevelSelectScreen() {
  const levels = useMatchPoseProgress((s) => s.levels)
  const hideExpert = useSettings((s) => s.hideExpertLevels)
  const demoMode = useSettings((s) => s.demoMode)

  return (
    <Screen scroll>
      <ScreenHeader
        title="Match Pose"
        subtitle={`⭐ ${totalStars(levels)}/${MAX_STARS}   🏆 ${totalTrophies(levels)}`}
        onBack={() => router.replace('/')}
      />
      {demoMode && (
        <View style={styles.demoNote}>
          <Text style={styles.demoText}>Demo mode is on: a simulated player copies each pose. Turn it off in Settings to use the camera.</Text>
        </View>
      )}
      {TIERS.filter((t) => !(hideExpert && t.tier === 'expert')).map(({ tier, label }) => (
        <View key={tier} style={styles.tier}>
          <View style={styles.tierHeader}>
            <View style={[styles.tierDot, { backgroundColor: TIER_COLORS[tier] }]} />
            <Text style={styles.tierTitle}>{label}</Text>
          </View>
          <View style={styles.grid}>
            {LEVELS.filter((l) => l.tier === tier).map((level) => (
              <LevelNode
                key={level.id}
                level={level}
                progress={levels[level.id]}
                unlocked={isLevelUnlocked(levels, level.id)}
              />
            ))}
          </View>
        </View>
      ))}
    </Screen>
  )
}

function LevelNode({ level, progress, unlocked }: { level: LevelDefinition; progress?: LevelProgress; unlocked: boolean }) {
  const color = TIER_COLORS[level.tier]
  const stars = progress?.stars ?? 0
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Level ${level.id}${unlocked ? `, ${stars} stars` : ', locked'}`}
      disabled={!unlocked}
      onPress={() => router.push(`/games/match-pose/play/${level.id}` as never)}
      style={({ pressed }) => [
        styles.node,
        { borderColor: unlocked ? color : theme.colors.track },
        level.isBoss && styles.boss,
        !unlocked && styles.locked,
        pressed && { transform: [{ scale: 0.96 }] },
      ]}
    >
      {level.isBoss && <Text style={styles.crown}>👑</Text>}
      <Text style={[styles.nodeNumber, { color: unlocked ? theme.colors.text : theme.colors.textDim }]}>
        {unlocked ? level.id : '🔒'}
      </Text>
      <Text style={styles.nodeStars}>
        {[0, 1, 2].map((i) => (i < stars ? '★' : '☆')).join('')}
      </Text>
      {level.safetyWarning && level.tier === 'expert' && <Text style={styles.warn}>⚠</Text>}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  demoNote: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.warning,
    backgroundColor: 'rgba(255, 197, 61, 0.1)',
  },
  demoText: { color: theme.colors.warning, fontSize: theme.font.small, fontWeight: '600' },
  tier: { gap: theme.spacing.md },
  tierHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  tierDot: { width: 10, height: 10, borderRadius: 5 },
  tierTitle: { color: theme.colors.text, fontSize: theme.font.heading, fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
  node: {
    width: 72,
    height: 80,
    borderRadius: theme.radius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceGlass,
  },
  boss: { borderWidth: 3, backgroundColor: 'rgba(255, 211, 77, 0.1)' },
  locked: { opacity: 0.5 },
  crown: { position: 'absolute', top: -12, fontSize: 18 },
  nodeNumber: { fontSize: 24, fontWeight: '900' },
  nodeStars: { color: theme.colors.gold, fontSize: 13, letterSpacing: 1 },
  warn: { position: 'absolute', top: 2, right: 6, color: theme.colors.warning, fontSize: 12 },
})

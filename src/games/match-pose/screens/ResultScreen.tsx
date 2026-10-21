import { router } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'

import { Button } from '@/core/ui/Button'
import { GlassCard } from '@/core/ui/GlassCard'
import { Screen } from '@/core/ui/Screen'
import { theme } from '@/core/ui/theme'
import { getLevel } from '../data/levels'
import { getPose } from '../data/poses'
import { RATING_LABELS } from '../engine/scoring'
import { useMatchPoseProgress } from '../store/progressStore'

export function ResultScreen({ levelId }: { levelId: number }) {
  const lastResult = useMatchPoseProgress((s) => s.lastResult)
  const level = getLevel(levelId)
  const nextLevel = getLevel(levelId + 1)

  if (!lastResult || lastResult.levelId !== levelId || !level) {
    return (
      <Screen contentStyle={styles.center}>
        <Text style={styles.title}>No result yet</Text>
        <Button label="Back to levels" onPress={() => router.replace('/games/match-pose' as never)} />
      </Screen>
    )
  }

  const { summary, outcomes, isNewBest } = lastResult
  const passed = summary.passed

  return (
    <Screen scroll contentStyle={styles.content}>
      <GlassCard glow style={styles.hero}>
        <Text style={styles.kicker}>Level {levelId}</Text>
        <Text style={styles.title}>{passed ? 'Level complete!' : 'So close!'}</Text>
        <Text style={styles.stars}>
          {[0, 1, 2].map((i) => (i < summary.stars ? '★' : '☆')).join(' ')}
        </Text>
        <View style={styles.statsRow}>
          <Stat label="Score" value={`${summary.score}`} highlight={isNewBest} />
          <Stat label="Matched" value={`${summary.matched}/${summary.total}`} />
          <Stat label="Accuracy" value={`${Math.round(summary.averageAccuracy * 100)}%`} />
        </View>
        {isNewBest && <Text style={styles.newBest}>New best score!</Text>}
        {!passed && <Text style={styles.hint}>Match more poses to unlock the next level.</Text>}
      </GlassCard>

      <GlassCard style={styles.list}>
        {outcomes.map((o, i) => (
          <View key={`${o.poseId}-${i}`} style={styles.row}>
            <Text style={styles.rowName} numberOfLines={1}>
              {level.attempts ? `Attempt ${i + 1}: ` : ''}
              {getPose(o.poseId).name}
            </Text>
            <Text style={[styles.rowRating, { color: o.matched ? theme.colors.success : theme.colors.danger }]}>
              {o.matched ? RATING_LABELS[o.rating] : 'Missed'}
            </Text>
            <Text style={styles.rowPoints}>+{o.points}</Text>
          </View>
        ))}
      </GlassCard>

      <View style={styles.actions}>
        {passed && nextLevel && (
          <Button label={`Next: Level ${nextLevel.id}`} onPress={() => router.replace(`/games/match-pose/play/${nextLevel.id}` as never)} />
        )}
        <Button
          label="Retry"
          variant={passed ? 'secondary' : 'primary'}
          onPress={() => router.replace(`/games/match-pose/play/${levelId}` as never)}
        />
        <Button label="All levels" variant="ghost" onPress={() => router.replace('/games/match-pose' as never)} />
      </View>
    </Screen>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, highlight && { color: theme.colors.gold }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { maxWidth: 560 },
  hero: { alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.xl },
  kicker: { color: theme.colors.primary, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  title: { color: theme.colors.text, fontSize: theme.font.title, fontWeight: '900', textAlign: 'center' },
  stars: { color: theme.colors.gold, fontSize: 48, letterSpacing: 4 },
  statsRow: { flexDirection: 'row', gap: theme.spacing.xl, marginTop: theme.spacing.sm },
  stat: { alignItems: 'center' },
  statValue: { color: theme.colors.text, fontSize: theme.font.heading, fontWeight: '900' },
  statLabel: { color: theme.colors.textMuted, fontSize: theme.font.small },
  newBest: { color: theme.colors.gold, fontWeight: '900' },
  hint: { color: theme.colors.textMuted, textAlign: 'center' },
  list: { gap: theme.spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  rowName: { flex: 1, color: theme.colors.text, fontWeight: '700' },
  rowRating: { fontWeight: '800' },
  rowPoints: { color: theme.colors.gold, fontWeight: '800', width: 52, textAlign: 'right' },
  actions: { gap: theme.spacing.sm },
})

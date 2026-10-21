import { Pressable, StyleSheet, Text, View } from 'react-native'

import { theme } from '@/core/ui/theme'

interface HudBarProps {
  levelId: number
  poseIndex: number
  poseCount: number
  score: number
  onPause: () => void
}

export function HudBar({ levelId, poseIndex, poseCount, score, onPause }: HudBarProps) {
  return (
    <View style={styles.bar}>
      <Pressable accessibilityRole="button" accessibilityLabel="Pause" onPress={onPause} style={styles.pause} hitSlop={10}>
        <View style={styles.pauseIcon} />
        <View style={styles.pauseIcon} />
      </Pressable>
      <View style={styles.center}>
        <Text style={styles.level}>Level {levelId}</Text>
        <View style={styles.progressRow}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${(poseIndex / poseCount) * 100}%` }]} />
          </View>
          <Text style={styles.count}>
            {Math.min(poseIndex + 1, poseCount)}/{poseCount}
          </Text>
        </View>
      </View>
      <View style={styles.trophy}>
        <Text style={styles.trophyIcon}>🏆</Text>
        <Text style={styles.score}>{score}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceGlass,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
  },
  pause: {
    width: 40,
    height: 40,
    borderRadius: 20,
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.track,
  },
  pauseIcon: { width: 4, height: 14, borderRadius: 2, backgroundColor: theme.colors.text },
  center: { flex: 1, gap: 4 },
  level: { color: theme.colors.text, fontWeight: '900', fontSize: theme.font.body },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: theme.colors.track, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: theme.colors.success },
  count: { color: theme.colors.textMuted, fontWeight: '800', fontSize: theme.font.small },
  trophy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(255, 211, 77, 0.15)',
  },
  trophyIcon: { fontSize: 16 },
  score: { color: theme.colors.gold, fontWeight: '900', fontSize: theme.font.body },
})

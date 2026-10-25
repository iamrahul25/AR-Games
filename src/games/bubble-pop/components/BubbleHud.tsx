import { Pressable, StyleSheet, Text, View } from 'react-native'

import { theme } from '@/core/ui/theme'

interface BubbleHudProps {
  timeLeftMs: number
  durationMs: number
  score: number
  multiplier: number
  onPause: () => void
}

export function BubbleHud({ timeLeftMs, durationMs, score, multiplier, onPause }: BubbleHudProps) {
  const seconds = Math.ceil(timeLeftMs / 1000)
  const hurry = seconds <= 10
  return (
    <View style={styles.bar}>
      <Pressable accessibilityRole="button" accessibilityLabel="Pause" onPress={onPause} style={styles.pause} hitSlop={10}>
        <View style={styles.pauseIcon} />
        <View style={styles.pauseIcon} />
      </Pressable>
      <View style={styles.center}>
        <Text style={[styles.time, hurry && { color: theme.colors.warning }]}>{seconds}s</Text>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              { width: `${(timeLeftMs / durationMs) * 100}%`, backgroundColor: hurry ? theme.colors.warning : theme.colors.primary },
            ]}
          />
        </View>
      </View>
      {multiplier > 1 && (
        <View style={styles.combo}>
          <Text style={styles.comboText}>×{multiplier}</Text>
        </View>
      )}
      <View style={styles.score}>
        <Text style={styles.scoreIcon}>🫧</Text>
        <Text style={styles.scoreText}>{score}</Text>
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
  time: { color: theme.colors.text, fontWeight: '900', fontSize: theme.font.body },
  track: { height: 8, borderRadius: 4, backgroundColor: theme.colors.track, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  combo: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(244, 114, 182, 0.25)',
    borderWidth: 1,
    borderColor: '#F472B6',
  },
  comboText: { color: '#F9A8D4', fontWeight: '900', fontSize: theme.font.body },
  score: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(255, 211, 77, 0.15)',
  },
  scoreIcon: { fontSize: 16 },
  scoreText: { color: theme.colors.gold, fontWeight: '900', fontSize: theme.font.body, minWidth: 36, textAlign: 'right' },
})

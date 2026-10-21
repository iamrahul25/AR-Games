import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'

import { ProgressRing } from '@/core/ui/ProgressRing'
import { theme, TIER_COLORS } from '@/core/ui/theme'
import type { PoseDefinition } from '../types'
import { PoseFigure } from './PoseFigure'

interface TargetPoseCardProps {
  pose: PoseDefinition
  timeLeftMs: number
  timeLimitMs: number
  showTimer: boolean
  /** Larger layout for the landscape side panel. */
  large?: boolean
  style?: StyleProp<ViewStyle>
}

export function TargetPoseCard({ pose, timeLeftMs, timeLimitMs, showTimer, large = false, style }: TargetPoseCardProps) {
  const seconds = Math.ceil(timeLeftMs / 1000)
  const urgent = showTimer && timeLeftMs <= 3000
  const figureW = large ? 150 : 84
  const figureH = large ? 190 : 104
  const ringSize = large ? 84 : 64
  const timerColor = urgent ? theme.colors.danger : theme.colors.primary

  return (
    <View style={[styles.card, style]}>
      <View style={styles.textCol}>
        <Text style={styles.kicker}>Copy this pose!</Text>
        <Text style={[styles.name, large && styles.nameLarge]} numberOfLines={2}>
          {pose.name}
        </Text>
        <View style={[styles.tierPill, { borderColor: TIER_COLORS[pose.difficulty] }]}>
          <Text style={[styles.tierText, { color: TIER_COLORS[pose.difficulty] }]}>{pose.difficulty}</Text>
        </View>
        {large && <Text style={styles.instruction}>{pose.instruction}</Text>}
      </View>
      <View style={styles.figure}>
        <PoseFigure pose={pose} width={figureW} height={figureH} />
      </View>
      <ProgressRing
        progress={showTimer ? timeLeftMs / timeLimitMs : 1}
        size={ringSize}
        color={timerColor}
        segments={30}
      >
        <Text style={[styles.timer, { color: urgent ? theme.colors.danger : theme.colors.text }, large && styles.timerLarge]}>
          {showTimer ? seconds : '–'}
        </Text>
      </ProgressRing>
      {!large && (
        <Text style={styles.instructionCompact} numberOfLines={2}>
          {pose.instruction}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceGlass,
    borderWidth: 1,
    borderColor: theme.colors.glow,
  },
  textCol: { flex: 1, minWidth: 120, gap: 4 },
  kicker: { color: theme.colors.primary, fontSize: theme.font.small, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  name: { color: theme.colors.text, fontSize: theme.font.heading, fontWeight: '900' },
  nameLarge: { fontSize: 26 },
  tierPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 1,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
  },
  tierText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  instruction: { color: theme.colors.textMuted, fontSize: theme.font.body, lineHeight: 21, marginTop: theme.spacing.xs },
  instructionCompact: { width: '100%', color: theme.colors.textMuted, fontSize: theme.font.small },
  figure: {
    borderRadius: theme.radius.md,
    backgroundColor: 'rgba(60, 200, 255, 0.08)',
  },
  timer: { fontSize: 24, fontWeight: '900' },
  timerLarge: { fontSize: 32 },
})

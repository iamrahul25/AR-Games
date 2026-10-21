import { StyleSheet, Text, View } from 'react-native'

import { ProgressRing } from '@/core/ui/ProgressRing'
import { theme } from '@/core/ui/theme'

interface HoldMeterProps {
  /** Hold progress 0..1. */
  progress: number
  holding: boolean
  /** Current match score 0..1. */
  score: number
  holdSeconds: number
  size?: number
}

export function HoldMeter({ progress, holding, score, holdSeconds, size = 92 }: HoldMeterProps) {
  const remaining = Math.max(0, holdSeconds * (1 - progress))
  return (
    <View style={styles.wrap}>
      <ProgressRing
        progress={progress}
        size={size}
        color={holding ? theme.colors.success : theme.colors.warning}
        segments={32}
      >
        <Text style={styles.percent}>{Math.round(score * 100)}%</Text>
        <Text style={styles.caption}>match</Text>
      </ProgressRing>
      <Text style={[styles.status, { color: holding ? theme.colors.success : theme.colors.textMuted }]}>
        {holding ? `Hold! ${remaining.toFixed(1)}s` : `Hold ${holdSeconds}s`}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 4 },
  percent: { color: theme.colors.text, fontSize: 22, fontWeight: '900' },
  caption: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginTop: -2 },
  status: { fontWeight: '900', fontSize: theme.font.small },
})

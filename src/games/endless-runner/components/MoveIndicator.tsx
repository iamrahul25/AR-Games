import { StyleSheet, Text, View } from 'react-native'

import { theme } from '@/core/ui/theme'
import type { Lane } from '../types'

const LANE_LABELS: { lane: Lane; label: string }[] = [
  { lane: -1, label: '◀ LEFT' },
  { lane: 0, label: 'CENTER' },
  { lane: 1, label: 'RIGHT ▶' },
]

/** Strip between the game and the camera: current lane + JUMP / DUCK flashes. */
export function MoveIndicator({ lane, jumping, ducking, compact = false }: { lane: Lane | null; jumping: boolean; ducking: boolean; compact?: boolean }) {
  return (
    <View style={[styles.strip, compact && styles.compact]} accessibilityLabel={`Lane ${lane === -1 ? 'left' : lane === 1 ? 'right' : 'center'}`}>
      {LANE_LABELS.map(({ lane: l, label }) => (
        <View key={l} style={[styles.cell, lane === l && styles.active]}>
          <Text style={[styles.text, lane === l && styles.activeText]}>{label}</Text>
        </View>
      ))}
      <View style={[styles.move, jumping && { backgroundColor: theme.colors.warning }]}>
        <Text style={[styles.moveText, jumping && styles.moveOn]}>▲</Text>
      </View>
      <View style={[styles.move, ducking && { backgroundColor: theme.colors.primary }]}>
        <Text style={[styles.moveText, ducking && styles.moveOn]}>▼</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    backgroundColor: theme.colors.backgroundDeep,
  },
  compact: { paddingVertical: 4 },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: theme.radius.sm, backgroundColor: theme.colors.track },
  active: { backgroundColor: 'rgba(45, 212, 191, 0.85)' },
  text: { color: theme.colors.textDim, fontWeight: '900', fontSize: theme.font.small },
  activeText: { color: '#06122B' },
  move: { width: 36, alignItems: 'center', paddingVertical: 6, borderRadius: theme.radius.sm, backgroundColor: theme.colors.track },
  moveText: { color: theme.colors.textDim, fontWeight: '900', fontSize: theme.font.small },
  moveOn: { color: '#06122B' },
})

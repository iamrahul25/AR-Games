import { StyleSheet, Text, View } from 'react-native'

import { BODY_PART_LABELS, BODY_PARTS, type PartStatus } from '@/core/pose/types'
import { PART_STATUS_COLORS, theme } from '@/core/ui/theme'
import type { MatchResult } from '../types'

const STATUS_ICON: Record<PartStatus, string> = {
  good: '✓',
  close: '~',
  bad: '✕',
  unknown: '?',
}

export function BodyPartChecklist({ match, compact = false }: { match: MatchResult; compact?: boolean }) {
  if (compact) {
    return (
      <View style={styles.chips}>
        {BODY_PARTS.map((part) => {
          const status = match.parts[part].status
          return (
            <View key={part} style={[styles.chip, { borderColor: PART_STATUS_COLORS[status] }]}>
              <Text style={[styles.chipIcon, { color: PART_STATUS_COLORS[status] }]}>{STATUS_ICON[status]}</Text>
              <Text style={styles.chipText}>{BODY_PART_LABELS[part]}</Text>
            </View>
          )
        })}
      </View>
    )
  }
  return (
    <View style={styles.list}>
      <Text style={styles.title}>Detected pose</Text>
      {BODY_PARTS.map((part) => {
        const { status, score } = match.parts[part]
        return (
          <View key={part} style={styles.row}>
            <View style={[styles.badge, { backgroundColor: PART_STATUS_COLORS[status] }]}>
              <Text style={styles.badgeIcon}>{STATUS_ICON[status]}</Text>
            </View>
            <Text style={styles.label}>{BODY_PART_LABELS[part]}</Text>
            <View style={styles.meter}>
              <View
                style={[
                  styles.meterFill,
                  { width: `${status === 'unknown' ? 0 : score * 100}%`, backgroundColor: PART_STATUS_COLORS[status] },
                ]}
              />
            </View>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    backgroundColor: theme.colors.overlay,
  },
  chipIcon: { fontWeight: '900', fontSize: 12 },
  chipText: { color: theme.colors.text, fontSize: 11, fontWeight: '700' },
  list: { gap: theme.spacing.sm },
  title: { color: theme.colors.textMuted, fontSize: theme.font.small, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  badge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  badgeIcon: { color: '#0B1530', fontWeight: '900', fontSize: 13 },
  label: { color: theme.colors.text, fontWeight: '700', width: 84 },
  meter: { flex: 1, height: 6, borderRadius: 3, backgroundColor: theme.colors.track, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 3 },
})

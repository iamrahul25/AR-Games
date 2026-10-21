import { Pressable, StyleSheet, Text, View } from 'react-native'

import { theme } from '@/core/ui/theme'
import { PRESET_META, PRESET_ORDER } from '../config/difficulty'
import type { PresetId } from '../types'

export function PresetChips({ value, onSelect }: { value: PresetId | 'custom'; onSelect: (id: PresetId) => void }) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Difficulty preset">
      {PRESET_ORDER.map((id) => (
        <Chip key={id} selected={value === id} label={PRESET_META[id].label} icon={PRESET_META[id].icon} onPress={() => onSelect(id)} />
      ))}
      <Chip selected={value === 'custom'} label={PRESET_META.custom.label} icon={PRESET_META.custom.icon} disabled />
    </View>
  )
}

function Chip({ selected, label, icon, onPress, disabled }: { selected: boolean; label: string; icon: string; onPress?: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected, checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.selected, disabled && !selected && styles.dim, pressed && styles.pressed]}
    >
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    backgroundColor: theme.colors.surfaceGlass,
  },
  selected: { backgroundColor: theme.colors.primaryDark, borderColor: theme.colors.primary },
  dim: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
  icon: { fontSize: 18 },
  label: { color: theme.colors.textMuted, fontWeight: '800', fontSize: theme.font.body },
  labelSelected: { color: theme.colors.text },
})

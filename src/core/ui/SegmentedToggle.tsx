import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'

import { theme } from './theme'

export interface SegmentOption<T extends string> {
  value: T
  label: string
}

/** A row of mutually exclusive pill buttons. `size="large"` gives big tap targets (kids, seniors). */
export function SegmentedToggle<T extends string>({
  value,
  options,
  onChange,
  size = 'small',
  accessibilityLabel,
  style,
}: {
  value: T
  options: readonly SegmentOption<T>[]
  onChange: (v: T) => void
  size?: 'small' | 'large'
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
}) {
  const large = size === 'large'
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.segmented, large && styles.segmentedLarge, style]}
    >
      {options.map((o) => {
        const selected = o.value === value
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ selected, checked: selected }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, large && styles.segmentLarge, selected && styles.segmentActive]}
          >
            <Text style={[styles.text, large && styles.textLarge, selected && styles.textActive]}>{o.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  segmented: {
    flexDirection: 'row',
    backgroundColor: theme.colors.track,
    borderRadius: theme.radius.pill,
    padding: 3,
    alignSelf: 'flex-start',
    flexWrap: 'wrap',
  },
  segmentedLarge: { alignSelf: 'stretch', padding: 4 },
  segment: { paddingHorizontal: theme.spacing.md, paddingVertical: 6, borderRadius: theme.radius.pill },
  segmentLarge: { flex: 1, alignItems: 'center', paddingVertical: theme.spacing.md, minHeight: 48, justifyContent: 'center' },
  segmentActive: { backgroundColor: theme.colors.primaryDark },
  text: { color: theme.colors.textMuted, fontWeight: '700', fontSize: theme.font.small },
  textLarge: { fontSize: theme.font.body, fontWeight: '800' },
  textActive: { color: theme.colors.text },
})

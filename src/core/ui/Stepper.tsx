import { Pressable, StyleSheet, Text, View } from 'react-native'

import { theme } from './theme'

/** Big – value + control. Never drag-only, so it works for every age and with screen readers. */
export function Stepper({
  value,
  min,
  max,
  step = 1,
  onChange,
  format = String,
  label,
  size = 44,
}: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  format?: (v: number) => string
  label: string
  size?: number
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step))
  const dec = () => onChange(clamp(value - step))
  const inc = () => onChange(clamp(value + step))
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value, text: format(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'increment' ? inc() : dec())}
    >
      <Pressable
        accessibilityLabel={`Decrease ${label}`}
        disabled={value <= min}
        onPress={dec}
        hitSlop={8}
        style={({ pressed }) => [styles.button, { width: size, height: size, borderRadius: size / 2 }, value <= min && styles.disabled, pressed && styles.pressed]}
      >
        <Text style={styles.buttonText}>–</Text>
      </Pressable>
      <Text style={styles.value}>{format(value)}</Text>
      <Pressable
        accessibilityLabel={`Increase ${label}`}
        disabled={value >= max}
        onPress={inc}
        hitSlop={8}
        style={({ pressed }) => [styles.button, { width: size, height: size, borderRadius: size / 2 }, value >= max && styles.disabled, pressed && styles.pressed]}
      >
        <Text style={styles.buttonText}>+</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceGlass,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
  },
  buttonText: { color: theme.colors.text, fontSize: 24, fontWeight: '900', lineHeight: 28 },
  value: { color: theme.colors.text, fontSize: theme.font.heading, fontWeight: '900', minWidth: 36, textAlign: 'center' },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.95 }] },
})

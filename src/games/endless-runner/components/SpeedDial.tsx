import { Pressable, StyleSheet, Text, View } from 'react-native'

import { theme } from '@/core/ui/theme'
import { MAX_DIAL, MIN_DIAL, clampDial, dialLabel } from '../config/difficulty'

const SWEEP_DEG = 240
const TICKS = MAX_DIAL - MIN_DIAL + 1

/**
 * Speed dial 1–10: an arc of tappable ticks with the value in the middle and big –/+ buttons
 * (never drag-only, so it works for kids, seniors and screen readers).
 */
export function SpeedDial({
  value,
  onChange,
  size = 220,
  label = 'Speed',
  maxMarker,
}: {
  value: number
  onChange: (v: number) => void
  size?: number
  label?: string
  /** Shows a second marker (max speed in Increasing mode). */
  maxMarker?: number
}) {
  const r = size / 2 - 18
  const c = size / 2
  const set = (v: number) => onChange(clampDial(v))
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min: MIN_DIAL, max: MAX_DIAL, now: value, text: `${value}, ${dialLabel(value)}` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => set(value + (e.nativeEvent.actionName === 'increment' ? 1 : -1))}
    >
      <DialButton text="–" disabled={value <= MIN_DIAL} onPress={() => set(value - 1)} label={`Slower ${label}`} />
      <View style={{ width: size, height: size * 0.82 }}>
        {Array.from({ length: TICKS }, (_, i) => {
          const dial = MIN_DIAL + i
          const a = ((-SWEEP_DEG / 2 + (SWEEP_DEG * i) / (TICKS - 1)) * Math.PI) / 180
          const x = c + Math.sin(a) * r
          const y = c - Math.cos(a) * r
          const on = dial <= value
          const isMax = maxMarker !== undefined && dial === maxMarker && maxMarker > value
          const dot = dial === value ? 30 : 22
          return (
            <Pressable
              key={dial}
              accessibilityLabel={`Speed ${dial}`}
              onPress={() => set(dial)}
              hitSlop={6}
              style={[
                styles.tick,
                {
                  left: x - dot / 2,
                  top: y - dot / 2,
                  width: dot,
                  height: dot,
                  borderRadius: dot / 2,
                  backgroundColor: on ? tickColor(dial) : theme.colors.track,
                  borderColor: isMax ? theme.colors.warning : dial === value ? '#fff' : 'transparent',
                },
              ]}
            >
              <Text style={[styles.tickText, !on && { color: theme.colors.textDim }]}>{dial}</Text>
            </Pressable>
          )
        })}
        <View style={[styles.center, { top: size * 0.24, width: size }]} pointerEvents="none">
          <Text style={styles.value}>{value}</Text>
          <Text style={styles.label}>{dialLabel(value).toUpperCase()}</Text>
          {maxMarker !== undefined && maxMarker > value && <Text style={styles.max}>→ {maxMarker} max</Text>}
        </View>
      </View>
      <DialButton text="+" disabled={value >= MAX_DIAL} onPress={() => set(value + 1)} label={`Faster ${label}`} />
    </View>
  )
}

function tickColor(dial: number) {
  if (dial <= 3) return theme.colors.success
  if (dial <= 6) return theme.colors.primary
  if (dial <= 8) return '#FF9F43'
  return theme.colors.danger
}

function DialButton({ text, onPress, disabled, label }: { text: string; onPress: () => void; disabled: boolean; label: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.button, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <Text style={styles.buttonText}>{text}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm },
  tick: { position: 'absolute', alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  tickText: { color: '#06122B', fontSize: 11, fontWeight: '900' },
  center: { position: 'absolute', left: 0, alignItems: 'center' },
  value: { color: theme.colors.text, fontSize: 56, fontWeight: '900', lineHeight: 62 },
  label: { color: theme.colors.primary, fontSize: theme.font.body, fontWeight: '900', letterSpacing: 2 },
  max: { color: theme.colors.warning, fontSize: theme.font.small, fontWeight: '800', marginTop: 2 },
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceGlass,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
  },
  buttonText: { color: theme.colors.text, fontSize: 30, fontWeight: '900', lineHeight: 34 },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.95 }] },
})

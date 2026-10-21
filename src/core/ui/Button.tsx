import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native'

import { theme } from './theme'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps {
  label: string
  onPress: () => void
  variant?: Variant
  icon?: ReactNode
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  accessibilityHint?: string
}

export function Button({ label, onPress, variant = 'primary', icon, disabled, style, accessibilityHint }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {icon}
      <Text style={[styles.label, variant === 'ghost' && styles.ghostLabel]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    minHeight: 52,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radius.pill,
  },
  primary: {
    backgroundColor: theme.colors.primaryDark,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  secondary: {
    backgroundColor: theme.colors.surfaceGlass,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: 'rgba(255, 93, 108, 0.2)',
    borderWidth: 1,
    borderColor: theme.colors.danger,
  },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.4 },
  label: {
    color: theme.colors.text,
    fontSize: theme.font.body,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  ghostLabel: { color: theme.colors.textMuted },
})

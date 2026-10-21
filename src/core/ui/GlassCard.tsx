import type { ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'

import { theme } from './theme'

export function GlassCard({
  children,
  style,
  glow = false,
}: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  glow?: boolean
}) {
  return <View style={[styles.card, glow && styles.glow, style]}>{children}</View>
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surfaceGlass,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    padding: theme.spacing.lg,
  },
  glow: {
    borderColor: theme.colors.glow,
    shadowColor: theme.colors.glow,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
})

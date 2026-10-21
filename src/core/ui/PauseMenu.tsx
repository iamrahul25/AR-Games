import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { Button } from './Button'
import { GlassCard } from './GlassCard'
import { theme } from './theme'

export interface PauseAction {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
}

/** Full-screen pause card with a configurable list of actions (first is usually "Resume"). */
export function PauseMenu({
  actions,
  title = 'Paused',
  children,
  transparent = false,
}: {
  actions: PauseAction[]
  title?: string
  /** Extra content above the actions (e.g. a hint). */
  children?: ReactNode
  /** Lighter backdrop, so a live camera behind stays visible. */
  transparent?: boolean
}) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.backdrop, transparent && styles.backdropLight]}>
      <GlassCard glow style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        {children}
        {actions.map((a) => (
          <Button key={a.label} label={a.label} variant={a.variant ?? 'secondary'} onPress={a.onPress} />
        ))}
      </GlassCard>
    </View>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: theme.colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  backdropLight: { backgroundColor: 'rgba(5, 10, 25, 0.45)' },
  card: { width: '100%', maxWidth: 360, gap: theme.spacing.md },
  title: { color: theme.colors.text, fontSize: theme.font.title, fontWeight: '900', textAlign: 'center' },
})

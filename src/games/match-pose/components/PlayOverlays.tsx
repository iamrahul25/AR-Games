import { StyleSheet, Text, View } from 'react-native'

import type { FramingResult } from '@/core/pose/framing'
import { Button } from '@/core/ui/Button'
import { GlassCard } from '@/core/ui/GlassCard'
import { theme } from '@/core/ui/theme'
import { RATING_LABELS } from '../engine/scoring'
import type { PoseOutcome } from '../types'

export function GetReadyOverlay({ framing }: { framing: FramingResult }) {
  return (
    <View style={styles.center} pointerEvents="none">
      <View style={[styles.silhouette, framing.ok && styles.silhouetteOk]} />
      <GlassCard style={styles.readyCard}>
        <Text style={styles.readyTitle}>{framing.ok ? 'Great, hold still…' : 'Get ready!'}</Text>
        <Text style={[styles.readyMessage, { color: framing.ok ? theme.colors.success : theme.colors.warning }]}>
          {framing.message}
        </Text>
        <Text style={styles.readyTip}>Phone at waist height · step back 2–3 m · whole body in view</Text>
      </GlassCard>
    </View>
  )
}

export function CountdownOverlay({ value }: { value: number }) {
  return (
    <View style={styles.center} pointerEvents="none">
      <Text style={styles.countdown}>{value}</Text>
    </View>
  )
}

const RATING_COLORS = {
  perfect: theme.colors.gold,
  great: theme.colors.success,
  good: theme.colors.primary,
  miss: theme.colors.danger,
} as const

export function RatingToast({ outcome }: { outcome: PoseOutcome }) {
  return (
    <View style={styles.center} pointerEvents="none">
      <View style={[styles.toast, { borderColor: RATING_COLORS[outcome.rating] }]}>
        <Text style={[styles.toastTitle, { color: RATING_COLORS[outcome.rating] }]}>
          {outcome.matched ? `${RATING_LABELS[outcome.rating]} ✔` : "Time's up!"}
        </Text>
        <Text style={styles.toastSub}>
          {outcome.matched ? `+${outcome.points} · ${Math.round(outcome.accuracy * 100)}% accuracy` : 'On to the next one'}
        </Text>
      </View>
    </View>
  )
}

export function PauseMenu({ onResume, onRestart, onQuit }: { onResume: () => void; onRestart: () => void; onQuit: () => void }) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.pauseBackdrop]}>
      <GlassCard glow style={styles.pauseCard}>
        <Text style={styles.pauseTitle}>Paused</Text>
        <Button label="Resume" onPress={onResume} />
        <Button label="Restart level" variant="secondary" onPress={onRestart} />
        <Button label="Quit" variant="ghost" onPress={onQuit} />
      </GlassCard>
    </View>
  )
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  silhouette: {
    position: 'absolute',
    width: '46%',
    height: '72%',
    maxWidth: 260,
    borderRadius: 140,
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.45)',
  },
  silhouetteOk: { borderColor: theme.colors.success },
  readyCard: { alignItems: 'center', gap: theme.spacing.xs, maxWidth: 420 },
  readyTitle: { color: theme.colors.text, fontSize: theme.font.heading, fontWeight: '900' },
  readyMessage: { fontSize: theme.font.body, fontWeight: '800', textAlign: 'center' },
  readyTip: { color: theme.colors.textMuted, fontSize: theme.font.small, textAlign: 'center' },
  countdown: {
    color: theme.colors.text,
    fontSize: 140,
    fontWeight: '900',
    textShadowColor: theme.colors.glow,
    textShadowRadius: 24,
  },
  toast: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    borderWidth: 2,
    backgroundColor: theme.colors.overlay,
  },
  toastTitle: { fontSize: theme.font.huge, fontWeight: '900' },
  toastSub: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '700' },
  pauseBackdrop: {
    backgroundColor: theme.colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  pauseCard: { width: '100%', maxWidth: 360, gap: theme.spacing.md },
  pauseTitle: { color: theme.colors.text, fontSize: theme.font.title, fontWeight: '900', textAlign: 'center' },
})

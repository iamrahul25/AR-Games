import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { Button } from '@/core/ui/Button'
import { ProgressRing } from '@/core/ui/ProgressRing'
import { theme } from '@/core/ui/theme'
import type { WaitReason } from '../engine/session'

const WAIT_TEXT: Record<WaitReason, { title: string; body: string }> = {
  lost: { title: 'We lost you!', body: 'Step back into view, then stand in the middle lane.' },
  resume: { title: 'Ready to go on?', body: 'Stand in the middle lane and hold still.' },
  rest: { title: 'Rest is over', body: 'Stand in the middle lane when you’re ready.' },
  recalibrated: { title: 'All set!', body: 'Stand in the middle lane and hold still.' },
}

/** Auto-pause: waits for the player to stand still in the center lane before the countdown. */
export function WaitingOverlay({
  reason,
  tracked,
  inCenter,
  stillProgress,
  onPause,
}: {
  reason: WaitReason
  tracked: boolean
  inCenter: boolean
  stillProgress: number
  onPause: () => void
}) {
  const t = WAIT_TEXT[reason]
  const status = !tracked ? 'Can’t see you yet' : !inCenter ? 'Move to the middle lane' : 'Hold still…'
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.card}>
        <ProgressRing progress={tracked && inCenter ? stillProgress : 0} size={56} color={theme.colors.success}>
          <Text style={styles.ringIcon}>{!tracked ? '👀' : inCenter ? '🧍' : '↔️'}</Text>
        </ProgressRing>
        <View style={styles.texts}>
          <Text style={[styles.title, reason === 'lost' && { color: theme.colors.warning }]}>{t.title}</Text>
          <Text style={styles.body}>{t.body}</Text>
          <Text style={styles.status}>{status}</Text>
        </View>
      </View>
      <Button label="Pause" variant="ghost" onPress={onPause} />
    </View>
  )
}

/** Rest break: the track is empty; a calm countdown. */
export function RestBreakOverlay({ endsAt, now }: { endsAt: number; now: () => number }) {
  const [left, setLeft] = useState(() => Math.max(0, Math.ceil((endsAt - now()) / 1000)))
  useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, Math.ceil((endsAt - now()) / 1000))), 250)
    return () => clearInterval(id)
  }, [endsAt, now])
  return (
    <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
      <View style={styles.restCard}>
        <Text style={styles.restTitle}>Take a breath 🌿</Text>
        <Text style={styles.restCount}>{left}</Text>
        <Text style={styles.body}>Breathe in… and out. Shake out your arms and legs.</Text>
      </View>
    </View>
  )
}

export function GameOverOverlay({ finished }: { finished: boolean }) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: theme.colors.overlay }]} pointerEvents="none">
      <Text style={[styles.over, finished && { color: theme.colors.success }]}>{finished ? 'FINISHED!' : 'GAME OVER'}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: theme.spacing.md, right: theme.spacing.md, bottom: theme.spacing.lg, alignItems: 'center', gap: theme.spacing.xs },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.overlay,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    alignSelf: 'stretch',
    maxWidth: 520,
  },
  ringIcon: { fontSize: 22 },
  texts: { flex: 1, gap: 2 },
  title: { color: theme.colors.text, fontSize: theme.font.heading, fontWeight: '900' },
  body: { color: theme.colors.text, fontSize: theme.font.body, textAlign: 'left' },
  status: { color: theme.colors.primary, fontWeight: '800', fontSize: theme.font.small },
  center: { alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl },
  restCard: {
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.xl,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.overlay,
    borderWidth: 1,
    borderColor: theme.colors.success,
    maxWidth: 420,
  },
  restTitle: { color: theme.colors.success, fontSize: theme.font.title, fontWeight: '900' },
  restCount: { color: theme.colors.text, fontSize: 72, fontWeight: '900' },
  over: { color: theme.colors.danger, fontSize: 48, fontWeight: '900', letterSpacing: 2, textShadowColor: '#000', textShadowRadius: 12 },
})

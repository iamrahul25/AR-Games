import { StyleSheet, Text, View } from 'react-native'

import type { FramingResult } from '@/core/pose/framing'
import { GlassCard } from '@/core/ui/GlassCard'
import { theme } from '@/core/ui/theme'

export function GetReadyOverlay({ readiness, needsFeet }: { readiness: FramingResult; needsFeet: boolean }) {
  return (
    <View style={styles.center} pointerEvents="none">
      <GlassCard style={styles.card}>
        <Text style={styles.title}>{readiness.ok ? 'Great, hold still…' : 'Get ready to pop!'}</Text>
        <Text style={[styles.message, { color: readiness.ok ? theme.colors.success : theme.colors.warning }]}>
          {readiness.message}
        </Text>
        <Text style={styles.tip}>
          {needsFeet
            ? 'Step back 2–3 m so your whole body, feet included, is in view'
            : 'Stand back so your head and both hands are in view'}
        </Text>
      </GlassCard>
    </View>
  )
}

export function LostTrackingBanner() {
  return (
    <View style={styles.center} pointerEvents="none">
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Come back into view</Text>
        <Text style={styles.bannerSub}>The clock is paused until we can see you</Text>
      </View>
    </View>
  )
}

export function TimeUpToast({ score }: { score: number }) {
  return (
    <View style={styles.center} pointerEvents="none">
      <View style={styles.toast}>
        <Text style={styles.toastTitle}>Time&apos;s up!</Text>
        <Text style={styles.toastSub}>{score} points</Text>
      </View>
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
  card: { alignItems: 'center', gap: theme.spacing.xs, maxWidth: 420 },
  title: { color: theme.colors.text, fontSize: theme.font.heading, fontWeight: '900' },
  message: { fontSize: theme.font.body, fontWeight: '800', textAlign: 'center' },
  tip: { color: theme.colors.textMuted, fontSize: theme.font.small, textAlign: 'center' },
  banner: {
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.lg,
    backgroundColor: 'rgba(255, 93, 108, 0.85)',
  },
  bannerTitle: { color: '#fff', fontSize: theme.font.heading, fontWeight: '900' },
  bannerSub: { color: '#fff', fontSize: theme.font.small, fontWeight: '700' },
  toast: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    borderWidth: 2,
    borderColor: theme.colors.gold,
    backgroundColor: theme.colors.overlay,
  },
  toastTitle: { color: theme.colors.gold, fontSize: theme.font.huge, fontWeight: '900' },
  toastSub: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '700' },
})

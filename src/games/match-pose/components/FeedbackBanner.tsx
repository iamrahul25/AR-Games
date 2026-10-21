import { StyleSheet, Text, View } from 'react-native'

import { theme } from '@/core/ui/theme'

type Tone = 'info' | 'good' | 'warn'

const TONE_COLORS: Record<Tone, string> = {
  info: theme.colors.primary,
  good: theme.colors.success,
  warn: theme.colors.warning,
}

export function FeedbackBanner({ text, tone = 'info' }: { text: string | null; tone?: Tone }) {
  if (!text) return null
  return (
    <View style={[styles.banner, { borderColor: TONE_COLORS[tone] }]} accessibilityLiveRegion="polite">
      <Text style={[styles.icon, { color: TONE_COLORS[tone] }]}>{tone === 'good' ? '✓' : '➜'}</Text>
      <Text style={styles.text}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    backgroundColor: theme.colors.overlay,
  },
  icon: { fontSize: 18, fontWeight: '900' },
  text: { flex: 1, color: theme.colors.text, fontSize: 17, fontWeight: '800' },
})

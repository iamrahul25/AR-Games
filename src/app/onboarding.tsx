import { router } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { useSettings } from '@/core/settings/settingsStore'
import { Button } from '@/core/ui/Button'
import { GlassCard } from '@/core/ui/GlassCard'
import { Screen } from '@/core/ui/Screen'
import { theme } from '@/core/ui/theme'

const STEPS = [
  {
    icon: '🎮',
    title: 'Welcome to AR Games',
    lines: ['Your body is the controller.', 'The camera follows your movements and turns them into games.'],
  },
  {
    icon: '📱',
    title: 'Set up your space',
    lines: [
      'Stand the phone up at about waist height (lean it on something sturdy).',
      'Step back 2–3 metres so your whole body is in view.',
      'Use a bright room and clear the space around you.',
    ],
  },
  {
    icon: '🔒',
    title: 'Your camera stays private',
    lines: [
      'Pose tracking runs entirely on this device.',
      'Video is never recorded, saved or uploaded.',
      'Progress is stored only on this device.',
    ],
  },
]

export default function Onboarding() {
  const [step, setStep] = useState(0)
  const set = useSettings((s) => s.set)
  const current = STEPS[step]
  const last = step === STEPS.length - 1

  const finish = () => {
    set({ onboardingDone: true })
    router.replace('/')
  }

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.dots}>
        {STEPS.map((_, i) => (
          <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
        ))}
      </View>
      <GlassCard glow style={styles.card}>
        <Text style={styles.icon}>{current.icon}</Text>
        <Text style={styles.title}>{current.title}</Text>
        {current.lines.map((line) => (
          <Text key={line} style={styles.line}>
            {line}
          </Text>
        ))}
      </GlassCard>
      <View style={styles.actions}>
        <Button label={last ? "Let's play!" : 'Next'} onPress={() => (last ? finish() : setStep(step + 1))} />
        {!last && <Button variant="ghost" label="Skip" onPress={finish} />}
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { justifyContent: 'center', maxWidth: 520 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.track },
  dotActive: { width: 24, backgroundColor: theme.colors.primary },
  card: { alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.xxl },
  icon: { fontSize: 64 },
  title: { color: theme.colors.text, fontSize: theme.font.title, fontWeight: '900', textAlign: 'center' },
  line: { color: theme.colors.textMuted, fontSize: theme.font.body, textAlign: 'center', lineHeight: 22 },
  actions: { gap: theme.spacing.sm },
})

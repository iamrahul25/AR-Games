import { StyleSheet, Text, View } from 'react-native'

import { Button } from '@/core/ui/Button'
import { GlassCard } from '@/core/ui/GlassCard'
import { Screen } from '@/core/ui/Screen'
import { theme } from '@/core/ui/theme'
import type { LevelDefinition } from '../types'

const TIPS = [
  'Clear the space around you — no furniture or sharp edges nearby.',
  'Use a soft surface such as a yoga mat or carpet.',
  'For handstands, kick up against a wall. Never try them in open space.',
  'Warm up first and stop if anything hurts.',
  'Under 16? Ask an adult to be nearby.',
]

interface SafetyScreenProps {
  level: LevelDefinition
  onContinue: () => void
  onSkip?: () => void
  onBack: () => void
}

export function SafetyScreen({ level, onContinue, onSkip, onBack }: SafetyScreenProps) {
  return (
    <Screen scroll contentStyle={styles.content}>
      <GlassCard style={styles.card}>
        <Text style={styles.icon}>⚠️</Text>
        <Text style={styles.title}>Level {level.id} is a challenge</Text>
        <Text style={styles.subtitle}>These poses need strength and balance. Play safe:</Text>
        <View style={styles.tips}>
          {TIPS.map((tip) => (
            <View key={tip} style={styles.tipRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.tip}>{tip}</Text>
            </View>
          ))}
        </View>
      </GlassCard>
      <View style={styles.actions}>
        <Button label="I'm ready" onPress={onContinue} />
        {onSkip && <Button label="Skip this level" variant="secondary" onPress={onSkip} />}
        <Button label="Back" variant="ghost" onPress={onBack} />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { maxWidth: 560, justifyContent: 'center', flexGrow: 1 },
  card: { gap: theme.spacing.md, borderColor: theme.colors.warning },
  icon: { fontSize: 48, textAlign: 'center' },
  title: { color: theme.colors.text, fontSize: theme.font.title, fontWeight: '900', textAlign: 'center' },
  subtitle: { color: theme.colors.textMuted, fontSize: theme.font.body, textAlign: 'center' },
  tips: { gap: theme.spacing.sm },
  tipRow: { flexDirection: 'row', gap: theme.spacing.sm },
  bullet: { color: theme.colors.warning, fontSize: theme.font.body, fontWeight: '900' },
  tip: { flex: 1, color: theme.colors.text, fontSize: theme.font.body, lineHeight: 22 },
  actions: { gap: theme.spacing.sm },
})

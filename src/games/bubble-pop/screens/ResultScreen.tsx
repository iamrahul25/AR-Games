import { router } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'

import { Button } from '@/core/ui/Button'
import { GlassCard } from '@/core/ui/GlassCard'
import { Screen } from '@/core/ui/Screen'
import { theme } from '@/core/ui/theme'
import { MODES } from '../config/modes'
import { BUBBLE_ROUTES } from '../routes'
import { useBubbleStore } from '../store/bubbleStore'

const HEADLINES = ['Nice try!', 'Good popping!', 'Great popping!', 'Bubble master!']

export function ResultScreen() {
  const lastRound = useBubbleStore((s) => s.lastRound)

  if (!lastRound) {
    return (
      <Screen contentStyle={styles.center}>
        <Text style={styles.title}>No result yet</Text>
        <Button label="Back to Bubble Pop" onPress={() => router.replace(BUBBLE_ROUTES.home as never)} />
      </Screen>
    )
  }

  const { summary: s, isNewBest } = lastRound
  const mode = MODES[s.mode]
  const next = mode.stars.find((t) => s.score < t)

  return (
    <Screen scroll contentStyle={styles.content}>
      <GlassCard glow style={styles.hero}>
        <Text style={styles.kicker}>
          {mode.icon} {mode.title} mode
        </Text>
        <Text style={styles.title}>{HEADLINES[s.stars]}</Text>
        <Text style={styles.stars}>{[0, 1, 2].map((i) => (i < s.stars ? '★' : '☆')).join(' ')}</Text>
        <Text style={[styles.score, isNewBest && { color: theme.colors.gold }]}>{s.score}</Text>
        {isNewBest && <Text style={styles.newBest}>New best score!</Text>}
        {next !== undefined && <Text style={styles.hint}>{next - s.score} more points for the next star</Text>}
      </GlassCard>

      <GlassCard style={styles.statsCard}>
        <View style={styles.statsRow}>
          <Stat label="Popped" value={`${s.popped}`} />
          <Stat label="Accuracy" value={`${Math.round(s.accuracy * 100)}%`} />
          <Stat label="Best combo" value={`${s.bestCombo}`} />
        </View>
        <View style={styles.statsRow}>
          <Stat label="Golden" value={`⭐ ${s.golden}`} />
          <Stat label="Missed" value={`${s.missed}`} />
          {mode.bombChance > 0 && <Stat label="Bombs hit" value={`💣 ${s.bombs}`} />}
        </View>
      </GlassCard>

      <View style={styles.actions}>
        <Button label="Play again" onPress={() => router.replace(BUBBLE_ROUTES.play as never)} />
        <Button label="Change mode" variant="secondary" onPress={() => router.replace(BUBBLE_ROUTES.home as never)} />
        <Button label="All games" variant="ghost" onPress={() => router.replace('/')} />
      </View>
    </Screen>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { maxWidth: 560 },
  hero: { alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.xl },
  kicker: { color: theme.colors.primary, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  title: { color: theme.colors.text, fontSize: theme.font.title, fontWeight: '900', textAlign: 'center' },
  stars: { color: theme.colors.gold, fontSize: 48, letterSpacing: 4 },
  score: { color: theme.colors.text, fontSize: theme.font.huge, fontWeight: '900' },
  newBest: { color: theme.colors.gold, fontWeight: '900' },
  hint: { color: theme.colors.textMuted, textAlign: 'center' },
  statsCard: { gap: theme.spacing.lg },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center', minWidth: 90 },
  statValue: { color: theme.colors.text, fontSize: theme.font.heading, fontWeight: '900' },
  statLabel: { color: theme.colors.textMuted, fontSize: theme.font.small },
  actions: { gap: theme.spacing.sm },
})

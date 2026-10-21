import { router } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'

import { Button } from '@/core/ui/Button'
import { GlassCard } from '@/core/ui/GlassCard'
import { Screen } from '@/core/ui/Screen'
import { theme } from '@/core/ui/theme'
import { PRESET_META } from '../config/difficulty'
import { RUNNER_ROUTES } from '../routes'
import { formatDistance, formatTime, useRunnerStore } from '../store/runnerStore'

/** A game over this soon suggests the player didn't get the controls yet. */
const REFRESHER_BEFORE_S = 15

export function ResultScreen() {
  const lastRun = useRunnerStore((s) => s.lastRun)

  if (!lastRun) {
    return (
      <Screen contentStyle={styles.center}>
        <Text style={styles.title}>No run yet</Text>
        <Button label="Back to Free Run" onPress={() => router.replace(RUNNER_ROUTES.home as never)} />
      </Screen>
    )
  }

  const { stats, isNewBest, previousBest, preset } = lastRun
  const completed = stats.finished === 'time' || stats.finished === 'distance'
  const title = completed ? (stats.finished === 'time' ? 'Workout complete!' : 'Finished!') : stats.finished === 'lives' ? 'Game over' : 'Run ended'
  const quickOut = stats.finished === 'lives' && stats.timeS < REFRESHER_BEFORE_S

  return (
    <Screen scroll contentStyle={styles.content}>
      <GlassCard glow style={styles.hero}>
        <Text style={styles.kicker}>
          {PRESET_META[preset].icon} {PRESET_META[preset].label}
        </Text>
        <Text style={[styles.title, completed && { color: theme.colors.success }]}>{title}</Text>
        <Text style={styles.score}>{stats.score.toLocaleString()}</Text>
        {isNewBest ? (
          <Text style={styles.newBest}>★ NEW BEST</Text>
        ) : previousBest ? (
          <Text style={styles.best}>Best: {previousBest.score.toLocaleString()}</Text>
        ) : null}
        <Text style={styles.line}>
          {formatDistance(stats.distance)} · {formatTime(stats.timeS)} · top speed {stats.topDial.toFixed(1)}
        </Text>
      </GlassCard>

      <GlassCard style={styles.grid}>
        <Stat icon="🪙" label="Coins" value={`${stats.coins}${stats.stars ? ` + ${stats.stars}★` : ''}`} />
        <Stat icon="✅" label="Cleared" value={`${stats.cleared}`} />
        <Stat icon="⛔" label="Hits" value={`${stats.hits}`} />
        <Stat icon="🔥" label="Best streak" value={`${stats.longestStreak}`} />
        <Stat icon="⚡" label="Close calls" value={`${stats.closeCalls}`} />
        <Stat icon="⏱" label="Active" value={stats.timeS < 60 ? `${Math.round(stats.timeS)} s` : `${Math.round(stats.timeS / 60)} min`} />
      </GlassCard>

      <GlassCard style={styles.moves}>
        <Text style={styles.movesTitle}>Moves</Text>
        <Text style={styles.movesLine}>
          ▲ {plural(stats.jumps, 'jump')} · ▼ {plural(stats.ducks, 'duck')} · ◀▶ {plural(stats.laneChanges, 'lane')}
        </Text>
      </GlassCard>

      {quickOut && (
        <GlassCard style={styles.refresher}>
          <Text style={styles.refresherText}>Need a refresher on the moves?</Text>
          <Button label="How to play" variant="secondary" onPress={() => router.push(RUNNER_ROUTES.howToPlay as never)} />
        </GlassCard>
      )}

      <View style={styles.actions}>
        <Button label="Play again" onPress={() => router.replace(RUNNER_ROUTES.play as never)} />
        <View style={styles.row}>
          <Button label="Difficulty" variant="secondary" onPress={() => router.replace(RUNNER_ROUTES.difficulty as never)} style={styles.flex} />
          <Button label="Home" variant="ghost" onPress={() => router.replace(RUNNER_ROUTES.home as never)} style={styles.flex} />
        </View>
      </View>
    </Screen>
  )
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function Stat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>
        {icon} {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: theme.spacing.lg },
  content: { maxWidth: 560, gap: theme.spacing.md },
  hero: { alignItems: 'center', gap: theme.spacing.xs, paddingVertical: theme.spacing.xl },
  kicker: { color: theme.colors.primary, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  title: { color: theme.colors.text, fontSize: theme.font.title, fontWeight: '900', textAlign: 'center' },
  score: { color: theme.colors.gold, fontSize: 56, fontWeight: '900' },
  newBest: { color: theme.colors.gold, fontWeight: '900', fontSize: theme.font.heading },
  best: { color: theme.colors.textMuted, fontWeight: '800' },
  line: { color: theme.colors.text, fontWeight: '700', fontSize: theme.font.body, marginTop: theme.spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: theme.spacing.md },
  stat: { width: '33.33%', alignItems: 'center' },
  statValue: { color: theme.colors.text, fontWeight: '900', fontSize: theme.font.body },
  statLabel: { color: theme.colors.textMuted, fontSize: theme.font.small },
  moves: { gap: theme.spacing.xs, alignItems: 'center' },
  movesTitle: { color: theme.colors.primary, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, fontSize: theme.font.small },
  movesLine: { color: theme.colors.text, fontWeight: '800', fontSize: theme.font.body },
  refresher: { gap: theme.spacing.sm, alignItems: 'center' },
  refresherText: { color: theme.colors.text, fontWeight: '800' },
  actions: { gap: theme.spacing.sm, paddingBottom: theme.spacing.xl },
  row: { flexDirection: 'row', gap: theme.spacing.sm },
  flex: { flex: 1 },
})

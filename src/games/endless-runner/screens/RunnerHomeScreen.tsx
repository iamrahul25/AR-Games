import { router } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useSettings } from '@/core/settings/settingsStore'
import { Button } from '@/core/ui/Button'
import { GlassCard } from '@/core/ui/GlassCard'
import { Screen } from '@/core/ui/Screen'
import { ScreenHeader } from '@/core/ui/ScreenHeader'
import { theme } from '@/core/ui/theme'
import { PRESET_META, difficultyMultiplier, difficultyRating, ratingStars, summarizeDifficulty } from '../config/difficulty'
import { RUNNER_ROUTES } from '../routes'
import { formatDistance, useRunnerStore } from '../store/runnerStore'

export function RunnerHomeScreen() {
  const settings = useRunnerStore((s) => s.settings)
  const best = useRunnerStore((s) => s.best[s.settings.preset])
  const totals = useRunnerStore((s) => s.totals)
  const tutorialDone = useRunnerStore((s) => s.tutorialDone)
  const demoMode = useSettings((s) => s.demoMode)
  const meta = PRESET_META[settings.preset]

  const play = () => {
    // First run: the guide first, then a forced training run.
    if (!tutorialDone) router.push(`${RUNNER_ROUTES.howToPlay}?first=1` as never)
    else router.push(RUNNER_ROUTES.play as never)
  }

  return (
    <Screen scroll contentStyle={styles.content}>
      <ScreenHeader title="Free Run 🏃" subtitle="Hop, jump and duck with your whole body" onBack={() => router.replace('/')} />
      {demoMode && (
        <View style={styles.demoNote}>
          <Text style={styles.demoText}>Demo mode is on: a simulated runner plays for you. Turn it off in Settings to use the camera.</Text>
        </View>
      )}
      <Pressable accessibilityRole="button" accessibilityLabel="Change difficulty" onPress={() => router.push(RUNNER_ROUTES.difficulty as never)}>
        <GlassCard glow style={styles.summary}>
          <Text style={styles.best}>
            {best ? `Best: ${best.score.toLocaleString()} · ${formatDistance(best.distance)}` : 'No best run yet — go set one!'}
          </Text>
          <Text style={styles.preset}>
            {meta.icon} {summarizeDifficulty(settings)}
          </Text>
          <View style={styles.ratingRow}>
            <Text style={styles.stars}>{ratingStars(difficultyRating(settings))}</Text>
            <Text style={styles.mult}>Score ×{difficultyMultiplier(settings).toFixed(1)}</Text>
            <Text style={styles.edit}>Tap to change ›</Text>
          </View>
        </GlassCard>
      </Pressable>

      <Button label="▶  PLAY" onPress={play} style={styles.play} />
      <View style={styles.row}>
        <Button label="🎚 Difficulty" variant="secondary" onPress={() => router.push(RUNNER_ROUTES.difficulty as never)} style={styles.flex} />
        <Button label="❓ How to play" variant="secondary" onPress={() => router.push(RUNNER_ROUTES.howToPlay as never)} style={styles.flex} />
      </View>
      <Button label="🎯 Training run" variant="secondary" onPress={() => router.push(`${RUNNER_ROUTES.play}?training=1` as never)} />

      <Text style={styles.totals}>
        {totals.runs > 0
          ? `Totals: ${totals.runs} runs · ${formatDistance(totals.distance)} · ${totals.jumps} jumps · ${totals.ducks} ducks · ${Math.round(totals.activeSeconds / 60)} active min`
          : 'Your totals will show up here after your first run.'}
      </Text>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { maxWidth: 620, gap: theme.spacing.lg },
  demoNote: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.warning,
    backgroundColor: 'rgba(255, 197, 61, 0.1)',
  },
  demoText: { color: theme.colors.warning, fontSize: theme.font.small, fontWeight: '600' },
  summary: { gap: theme.spacing.sm },
  best: { color: theme.colors.gold, fontSize: theme.font.heading, fontWeight: '900' },
  preset: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '700', lineHeight: 22 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, flexWrap: 'wrap' },
  stars: { color: theme.colors.gold, fontSize: theme.font.body, letterSpacing: 2 },
  mult: { color: theme.colors.textMuted, fontWeight: '800' },
  edit: { marginLeft: 'auto', color: theme.colors.primary, fontWeight: '800' },
  play: { minHeight: 68 },
  row: { flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' },
  flex: { flexGrow: 1, flexBasis: 160 },
  totals: { color: theme.colors.textMuted, fontSize: theme.font.small, textAlign: 'center', lineHeight: 20 },
})

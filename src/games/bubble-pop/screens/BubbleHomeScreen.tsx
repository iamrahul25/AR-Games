import { router } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useSettings } from '@/core/settings/settingsStore'
import { Button } from '@/core/ui/Button'
import { GlassCard } from '@/core/ui/GlassCard'
import { Screen } from '@/core/ui/Screen'
import { ScreenHeader } from '@/core/ui/ScreenHeader'
import { theme } from '@/core/ui/theme'
import { MODE_IDS, MODES, type BubbleModeId } from '../config/modes'
import { BUBBLE_ROUTES } from '../routes'
import { useBubbleStore } from '../store/bubbleStore'

const TIPS = [
  'Prop the phone up at waist height and step back.',
  'Touch bubbles with your hands to pop them. Fast swipes count too!',
  '⭐ Golden bubbles are worth triple.',
  'Pop bubbles in a row to build a combo: ×2 at 5, ×3 at 15.',
  '💣 Bombs cost points and break your combo. Steer clear!',
  '🦶 In Challenge mode, kick the low bubbles with your feet.',
]

export function BubbleHomeScreen() {
  const selected = useBubbleStore((s) => s.mode)
  const best = useBubbleStore((s) => s.best)
  const totals = useBubbleStore((s) => s.totals)
  const setMode = useBubbleStore((s) => s.setMode)
  const demoMode = useSettings((s) => s.demoMode)

  return (
    <Screen scroll contentStyle={styles.content}>
      <ScreenHeader title="Bubble Pop 🫧" subtitle="Pop bubbles with your hands (and feet!)" onBack={() => router.replace('/')} />
      {demoMode && (
        <View style={styles.demoNote}>
          <Text style={styles.demoText}>Demo mode is on: a simulated player pops for you. Turn it off in Settings to use the camera.</Text>
        </View>
      )}

      <View style={styles.modes} accessibilityRole="radiogroup">
        {MODE_IDS.map((id) => (
          <ModeCard key={id} id={id} selected={id === selected} best={best[id]} onPress={() => setMode(id)} />
        ))}
      </View>

      <Button label="▶  PLAY" onPress={() => router.push(BUBBLE_ROUTES.play as never)} style={styles.play} />

      <GlassCard style={styles.tips}>
        <Text style={styles.tipsTitle}>How to play</Text>
        {TIPS.map((t) => (
          <Text key={t} style={styles.tip}>
            • {t}
          </Text>
        ))}
      </GlassCard>

      <Text style={styles.totals}>
        {totals.rounds > 0
          ? `Totals: ${totals.rounds} rounds · ${totals.popped.toLocaleString()} bubbles popped`
          : 'Your totals will show up here after your first round.'}
      </Text>
    </Screen>
  )
}

function ModeCard({
  id,
  selected,
  best,
  onPress,
}: {
  id: BubbleModeId
  selected: boolean
  best?: { score: number; stars: number }
  onPress: () => void
}) {
  const mode = MODES[id]
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${mode.title} mode. ${mode.description}`}
      onPress={onPress}
      style={({ pressed }) => [pressed && { opacity: 0.85 }]}
    >
      <GlassCard glow={selected} style={[styles.modeCard, selected && styles.modeSelected]}>
        <Text style={styles.modeIcon}>{mode.icon}</Text>
        <View style={styles.modeBody}>
          <Text style={styles.modeTitle}>{mode.title}</Text>
          <Text style={styles.modeDescription}>{mode.description}</Text>
          <Text style={styles.modeBest}>
            {best ? `Best ${best.score} · ${[0, 1, 2].map((i) => (i < best.stars ? '★' : '☆')).join('')}` : 'Not played yet'}
          </Text>
        </View>
        <View style={[styles.radio, selected && styles.radioOn]} />
      </GlassCard>
    </Pressable>
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
  modes: { gap: theme.spacing.sm },
  modeCard: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  modeSelected: { borderColor: theme.colors.primary },
  modeIcon: { fontSize: 34 },
  modeBody: { flex: 1, gap: 2 },
  modeTitle: { color: theme.colors.text, fontSize: theme.font.heading, fontWeight: '900' },
  modeDescription: { color: theme.colors.textMuted, fontSize: theme.font.small },
  modeBest: { color: theme.colors.gold, fontSize: theme.font.small, fontWeight: '800', marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: theme.colors.textDim },
  radioOn: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },
  play: { minHeight: 68 },
  tips: { gap: theme.spacing.xs },
  tipsTitle: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '900', marginBottom: theme.spacing.xs },
  tip: { color: theme.colors.textMuted, fontSize: theme.font.small, lineHeight: 20 },
  totals: { color: theme.colors.textMuted, fontSize: theme.font.small, textAlign: 'center', lineHeight: 20 },
})

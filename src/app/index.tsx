import { Redirect, router } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useSettings } from '@/core/settings/settingsStore'
import { GlassCard } from '@/core/ui/GlassCard'
import { Screen } from '@/core/ui/Screen'
import { theme } from '@/core/ui/theme'
import { GAMES } from '@/games/registry'
import type { GameManifest } from '@/games/types'

export default function GameHub() {
  const onboardingDone = useSettings((s) => s.onboardingDone)
  if (!onboardingDone) return <Redirect href="/onboarding" />

  return (
    <Screen scroll>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.brand}>AR Games</Text>
          <Text style={styles.subtitle}>Move your body to play</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          onPress={() => router.push('/settings')}
          style={styles.iconButton}
          hitSlop={8}
        >
          <Text style={styles.iconText}>⚙</Text>
        </Pressable>
      </View>

      {GAMES.map((game) => (
        <GameCard key={game.id} game={game} />
      ))}

      {__DEV__ && (
        <GlassCard style={styles.devCard}>
          <Text style={styles.devTitle}>Developer tools</Text>
          <View style={styles.devRow}>
            <Pressable onPress={() => router.push('/dev/pose-debug')} style={styles.devLink}>
              <Text style={styles.devLinkText}>Pose debug</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/dev/pose-recorder')} style={styles.devLink}>
              <Text style={styles.devLinkText}>Pose recorder</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/dev/runner-motion' as never)} style={styles.devLink}>
              <Text style={styles.devLinkText}>Runner motion</Text>
            </Pressable>
          </View>
        </GlassCard>
      )}
    </Screen>
  )
}

function GameCard({ game }: { game: GameManifest }) {
  const available = game.status === 'available' && !!game.route
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${game.title}${available ? '' : ', coming soon'}`}
      disabled={!available}
      onPress={() => game.route && router.push(game.route as never)}
      style={({ pressed }) => [pressed && { opacity: 0.85 }]}
    >
      <GlassCard glow={available} style={[styles.card, !available && styles.cardDisabled]}>
        <View style={[styles.cardIcon, { backgroundColor: `${game.accent}33`, borderColor: game.accent }]}>
          <Text style={styles.cardIconText}>{game.icon}</Text>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>{game.title}</Text>
            {!available && (
              <View style={styles.soonPill}>
                <Text style={styles.soonText}>Coming soon</Text>
              </View>
            )}
          </View>
          <Text style={styles.cardTagline}>{game.tagline}</Text>
          <Text style={styles.cardDescription}>{game.description}</Text>
          {available && game.badges && (
            <View style={styles.badges}>
              {game.badges.map((b) => (
                <View key={b} style={styles.badge}>
                  <Text style={styles.badgeText}>{b}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </GlassCard>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm },
  headerText: { flex: 1 },
  brand: { color: theme.colors.text, fontSize: 34, fontWeight: '900', letterSpacing: 0.5 },
  subtitle: { color: theme.colors.textMuted, fontSize: theme.font.body, marginTop: 2 },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceGlass,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
  },
  iconText: { color: theme.colors.text, fontSize: 22 },
  card: { flexDirection: 'row', gap: theme.spacing.lg, alignItems: 'flex-start' },
  cardDisabled: { opacity: 0.6 },
  cardIcon: {
    width: 72,
    height: 72,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  cardIconText: { fontSize: 38 },
  cardBody: { flex: 1, gap: 4 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, flexWrap: 'wrap' },
  cardTitle: { color: theme.colors.text, fontSize: theme.font.heading, fontWeight: '900' },
  cardTagline: { color: theme.colors.primary, fontSize: theme.font.body, fontWeight: '700' },
  cardDescription: { color: theme.colors.textMuted, fontSize: theme.font.small, lineHeight: 18 },
  soonPill: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.track,
  },
  soonText: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  badges: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm, flexWrap: 'wrap' },
  badge: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(60, 200, 255, 0.15)',
  },
  badgeText: { color: theme.colors.primary, fontSize: 12, fontWeight: '800' },
  devCard: { gap: theme.spacing.sm },
  devTitle: { color: theme.colors.textDim, fontSize: theme.font.small, fontWeight: '800', textTransform: 'uppercase' },
  devRow: { flexDirection: 'row', gap: theme.spacing.md, flexWrap: 'wrap' },
  devLink: { paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.md, borderRadius: theme.radius.sm, backgroundColor: theme.colors.track },
  devLinkText: { color: theme.colors.text, fontWeight: '700' },
})

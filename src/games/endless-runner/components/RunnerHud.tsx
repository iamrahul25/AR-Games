import { Pressable, StyleSheet, Text, View } from 'react-native'

import { theme } from '@/core/ui/theme'
import { formatDistance, formatTime } from '../store/runnerStore'
import { LivesBar } from './LivesBar'

export interface HudState {
  distance: number
  score: number
  coins: number
  lives: number | null
  livesMax: number | null
  /** Dial-equivalent speed. */
  speedDial: number
  /** Just sped up (shows ▲). */
  speedUp: boolean
  multiplier: number
  remaining: { seconds?: number; meters?: number }
}

export function RunnerHud({ hud, onPause }: { hud: HudState; onPause: () => void }) {
  return (
    <View style={styles.bar} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Pause"
        onPress={onPause}
        hitSlop={10}
        style={({ pressed }) => [styles.pause, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.pauseText}>❚❚</Text>
      </Pressable>
      <LivesBar lives={hud.lives} max={hud.livesMax} />
      <View style={styles.spacer} />
      <View style={styles.stats}>
        <View style={styles.statRow}>
          {hud.remaining.seconds !== undefined && <Text style={styles.timer}>⏱ {formatTime(hud.remaining.seconds)}</Text>}
          {hud.remaining.meters !== undefined && <Text style={styles.timer}>🏁 {formatDistance(hud.remaining.meters)}</Text>}
          <Text style={styles.distance}>{formatDistance(hud.distance)}</Text>
          <Text style={styles.score}>★ {hud.score.toLocaleString()}</Text>
        </View>
        <View style={styles.statRow}>
          {hud.multiplier > 1 && <Text style={styles.streak}>×{hud.multiplier}</Text>}
          <Text style={styles.coins}>🪙 {hud.coins}</Text>
          <Text style={[styles.speed, hud.speedUp && styles.speedUp]}>
            Speed {hud.speedDial.toFixed(1)}
            {hud.speedUp ? ' ▲' : ''}
          </Text>
        </View>
      </View>
    </View>
  )
}

const shadow = { textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } }

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.md },
  pause: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.overlay,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
  },
  pauseText: { color: theme.colors.text, fontSize: 16, fontWeight: '900' },
  spacer: { flex: 1 },
  stats: { alignItems: 'flex-end', gap: 2 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  distance: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '900', ...shadow },
  score: { color: theme.colors.gold, fontSize: theme.font.heading, fontWeight: '900', ...shadow },
  timer: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '800', ...shadow },
  coins: { color: theme.colors.text, fontSize: theme.font.small, fontWeight: '800', ...shadow },
  speed: { color: theme.colors.textMuted, fontSize: theme.font.small, fontWeight: '800', ...shadow },
  speedUp: { color: theme.colors.warning },
  streak: {
    color: '#06122B',
    backgroundColor: theme.colors.warning,
    fontWeight: '900',
    fontSize: theme.font.small,
    paddingHorizontal: 8,
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
  },
})

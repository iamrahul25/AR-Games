import { StyleSheet, Text, View } from 'react-native'

import { Button } from '@/core/ui/Button'
import { ProgressRing } from '@/core/ui/ProgressRing'
import { theme } from '@/core/ui/theme'
import type { CalibratorState } from '../motion/calibration'

const STEP_TITLES: Record<CalibratorState['step'], string> = {
  framing: 'Step into view',
  hold: 'Stand in the middle',
  adjust: 'Let’s adjust',
  done: 'Calibrated!',
}

/** Shown over the full-screen camera while measuring the player (≈ 3 s). */
export function CalibrationOverlay({ state, onKeyboard }: { state: CalibratorState; onKeyboard?: () => void }) {
  const color = state.step === 'adjust' ? theme.colors.warning : state.step === 'done' ? theme.colors.success : theme.colors.primary
  const overall = state.step === 'framing' ? state.progress * 0.33 : state.step === 'hold' ? 0.33 + state.progress * 0.67 : state.step === 'done' ? 1 : 0
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.card}>
        <ProgressRing progress={overall} size={64} color={color}>
          <Text style={styles.ringText}>{state.step === 'done' ? '✓' : `${Math.round(overall * 100)}%`}</Text>
        </ProgressRing>
        <View style={styles.texts}>
          <Text style={[styles.title, { color }]}>{STEP_TITLES[state.step]}</Text>
          <Text style={styles.message}>{state.message}</Text>
        </View>
      </View>
      {onKeyboard && <Button label="Play with keyboard" variant="secondary" onPress={onKeyboard} style={styles.keyboard} />}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: theme.spacing.md, right: theme.spacing.md, bottom: theme.spacing.xl, alignItems: 'center', gap: theme.spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    paddingRight: theme.spacing.xl,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.overlay,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    maxWidth: 520,
    alignSelf: 'stretch',
  },
  ringText: { color: theme.colors.text, fontWeight: '900', fontSize: theme.font.small },
  texts: { flex: 1, gap: 2 },
  title: { fontSize: theme.font.heading, fontWeight: '900' },
  message: { color: theme.colors.text, fontSize: theme.font.body },
  keyboard: { alignSelf: 'center' },
})

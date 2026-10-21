import { Fragment } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated'

import { Button } from '@/core/ui/Button'
import { theme } from '@/core/ui/theme'
import type { TrainingStep } from '../engine/training'

/** Renders "**bold**" segments highlighted. */
export function RichPrompt({ text, style }: { text: string; style?: object }) {
  const parts = text.split('**')
  return (
    <Text style={[styles.prompt, style]}>
      {parts.map((p, i) => (
        <Fragment key={i}>{i % 2 === 1 ? <Text style={styles.bold}>{p}</Text> : p}</Fragment>
      ))}
    </Text>
  )
}

export interface AutoTuneOffer {
  title: string
  body: string
  onAccept: () => void
  onDismiss: () => void
}

export function TrainingOverlay({
  step,
  index,
  total,
  hint,
  successKey,
  canSkip,
  onSkip,
  offer,
}: {
  step: TrainingStep
  index: number
  total: number
  hint: string | null
  /** Changes on each success to replay the check animation. */
  successKey: number
  canSkip: boolean
  onSkip: () => void
  offer: AutoTuneOffer | null
}) {
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.top} pointerEvents="box-none">
        <View style={styles.dots}>
          {Array.from({ length: total }, (_, i) => (
            <View key={i} style={[styles.dot, i < index && styles.dotDone, i === index && styles.dotNow]} />
          ))}
        </View>
        <Animated.View key={step.id} entering={FadeIn.duration(220)} style={styles.card}>
          <Text style={styles.kicker}>Training run · {index + 1}/{total}</Text>
          <RichPrompt text={step.prompt} />
          {hint && <Text style={styles.hint}>💡 {hint}</Text>}
        </Animated.View>
      </View>
      {successKey > 0 && (
        <Animated.View key={successKey} entering={ZoomIn.duration(250)} style={styles.check} pointerEvents="none">
          <Text style={styles.checkText}>✓</Text>
        </Animated.View>
      )}
      {offer && (
        <View style={styles.offer}>
          <Text style={styles.offerTitle}>{offer.title}</Text>
          <Text style={styles.offerBody}>{offer.body}</Text>
          <View style={styles.offerRow}>
            <Button label="Yes, make it easier" onPress={offer.onAccept} style={styles.flex} />
            <Button label="No thanks" variant="ghost" onPress={offer.onDismiss} />
          </View>
        </View>
      )}
      {canSkip && (
        <View style={styles.bottom}>
          <Button label="Skip training" variant="ghost" onPress={onSkip} />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFill, justifyContent: 'space-between', padding: theme.spacing.md },
  top: { gap: theme.spacing.sm, alignItems: 'center' },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.track },
  dotDone: { backgroundColor: theme.colors.success },
  dotNow: { backgroundColor: theme.colors.primary, transform: [{ scale: 1.3 }] },
  card: {
    alignSelf: 'stretch',
    maxWidth: 560,
    marginHorizontal: 'auto',
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.overlay,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    gap: theme.spacing.xs,
  },
  kicker: { color: theme.colors.primary, fontWeight: '800', fontSize: theme.font.small, textTransform: 'uppercase', letterSpacing: 1 },
  prompt: { color: theme.colors.text, fontSize: theme.font.heading, fontWeight: '700', lineHeight: 30 },
  bold: { color: theme.colors.warning, fontWeight: '900' },
  hint: { color: theme.colors.warning, fontSize: theme.font.body, marginTop: theme.spacing.xs },
  check: {
    position: 'absolute',
    alignSelf: 'center',
    top: '38%',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(61, 220, 132, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: { color: '#fff', fontSize: 64, fontWeight: '900' },
  offer: {
    alignSelf: 'center',
    maxWidth: 520,
    width: '100%',
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.warning,
    gap: theme.spacing.sm,
  },
  offerTitle: { color: theme.colors.text, fontSize: theme.font.heading, fontWeight: '900' },
  offerBody: { color: theme.colors.textMuted, fontSize: theme.font.body },
  offerRow: { flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' },
  flex: { flexGrow: 1 },
  bottom: { alignItems: 'flex-start' },
})

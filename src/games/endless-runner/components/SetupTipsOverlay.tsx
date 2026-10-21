import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { Button } from '@/core/ui/Button'
import { theme } from '@/core/ui/theme'

const TIPS = [
  { icon: '📱', text: 'Stand your phone up at about waist height, leaning on something stable.' },
  { icon: '🚶', text: 'Step back 2–3 big steps so your whole body — head to feet — is on screen.' },
  { icon: '↔️', text: 'Clear about 2.5 m of floor: you will hop one step left and right.' },
  { icon: '👟', text: 'Wear shoes or go barefoot on a non-slip floor. No rugs, good lighting.' },
  { icon: '🛑', text: 'Stop if you feel tired, dizzy or any pain.' },
]

export function SetupTipsOverlay({
  onContinue,
  kidsNote,
  seniorNote,
  onKeyboard,
}: {
  onContinue: (dontShowAgain: boolean) => void
  kidsNote?: boolean
  seniorNote?: boolean
  /** Web: play with the keyboard instead of the camera. */
  onKeyboard?: () => void
}) {
  const [dontShow, setDontShow] = useState(false)
  return (
    <View style={[StyleSheet.absoluteFill, styles.backdrop]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Get ready to run!</Text>
        {kidsNote && (
          <View style={styles.note}>
            <Text style={styles.noteText}>👪 Parents: please supervise. Clear the space and keep pets away.</Text>
          </View>
        )}
        {seniorNote && (
          <View style={styles.note}>
            <Text style={styles.noteText}>🪑 Have a chair or wall nearby for balance.</Text>
          </View>
        )}
        {TIPS.map((t) => (
          <View key={t.icon} style={styles.tip}>
            <Text style={styles.icon}>{t.icon}</Text>
            <Text style={styles.tipText}>{t.text}</Text>
          </View>
        ))}
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: dontShow }}
          onPress={() => setDontShow((v) => !v)}
          style={styles.check}
        >
          <View style={[styles.box, dontShow && styles.boxOn]}>{dontShow && <Text style={styles.tick}>✓</Text>}</View>
          <Text style={styles.checkText}>Don’t show these tips again</Text>
        </Pressable>
        <Button label="I’m ready" onPress={() => onContinue(dontShow)} />
        {onKeyboard && <Button label="Play with keyboard instead" variant="ghost" onPress={onKeyboard} />}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: theme.colors.overlay },
  content: { padding: theme.spacing.xl, gap: theme.spacing.md, maxWidth: 520, width: '100%', alignSelf: 'center', flexGrow: 1, justifyContent: 'center' },
  title: { color: theme.colors.text, fontSize: theme.font.title, fontWeight: '900', textAlign: 'center', marginBottom: theme.spacing.sm },
  note: { padding: theme.spacing.md, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.warning, backgroundColor: 'rgba(255,197,61,0.12)' },
  noteText: { color: theme.colors.warning, fontWeight: '800', fontSize: theme.font.body },
  tip: { flexDirection: 'row', gap: theme.spacing.md, alignItems: 'flex-start' },
  icon: { fontSize: 24, width: 32, textAlign: 'center' },
  tipText: { flex: 1, color: theme.colors.text, fontSize: theme.font.body, lineHeight: 22 },
  check: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.sm, minHeight: 44 },
  box: { width: 26, height: 26, borderRadius: 6, borderWidth: 2, borderColor: theme.colors.surfaceBorder, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: theme.colors.primaryDark, borderColor: theme.colors.primary },
  tick: { color: '#fff', fontWeight: '900' },
  checkText: { color: theme.colors.textMuted, fontSize: theme.font.body },
})

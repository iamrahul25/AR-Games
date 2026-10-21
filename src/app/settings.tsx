import type { ReactNode } from 'react'
import { Alert, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native'

import { useSettings, type ModelQualitySetting } from '@/core/settings/settingsStore'
import { GlassCard } from '@/core/ui/GlassCard'
import { Screen } from '@/core/ui/Screen'
import { ScreenHeader } from '@/core/ui/ScreenHeader'
import { theme } from '@/core/ui/theme'
import { useMatchPoseProgress } from '@/games/match-pose/store/progressStore'

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          accessibilityRole="button"
          accessibilityState={{ selected: o.value === value }}
          onPress={() => onChange(o.value)}
          style={[styles.segment, o.value === value && styles.segmentActive]}
        >
          <Text style={[styles.segmentText, o.value === value && styles.segmentTextActive]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  )
}

function ToggleRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Row label={label} hint={hint}>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: theme.colors.primaryDark, false: theme.colors.track }}
        thumbColor={value ? theme.colors.primary : '#ccc'}
      />
    </Row>
  )
}

export default function SettingsScreen() {
  const s = useSettings()
  const resetProgress = useMatchPoseProgress((p) => p.resetProgress)

  const confirmReset = () => {
    const doReset = () => resetProgress()
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.('Reset all Match Pose progress?')) doReset()
      return
    }
    Alert.alert('Reset progress?', 'This clears all stars and unlocked levels.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: doReset },
    ])
  }

  return (
    <Screen scroll>
      <ScreenHeader title="Settings" />

      <Text style={styles.section}>Camera</Text>
      <GlassCard style={styles.card}>
        <Row label="Camera" hint="Front camera lets you see yourself">
          <Segmented
            value={s.cameraFacing}
            options={[
              { value: 'front', label: 'Front' },
              { value: 'back', label: 'Back' },
            ]}
            onChange={(v) => s.set({ cameraFacing: v })}
          />
        </Row>
        <View style={styles.column}>
          <Text style={styles.rowLabel}>Tracking quality</Text>
          <Segmented<ModelQualitySetting>
            value={s.modelQuality}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'battery-saver', label: 'Battery saver' },
              { value: 'high-accuracy', label: 'High accuracy' },
            ]}
            onChange={(v) => s.set({ modelQuality: v })}
          />
        </View>
        <ToggleRow
          label="Show skeleton"
          hint="Draw tracked body points over the camera"
          value={s.showSkeleton}
          onChange={(v) => s.set({ showSkeleton: v })}
        />
        <ToggleRow
          label="Demo mode"
          hint="Play with a simulated player instead of the camera"
          value={s.demoMode}
          onChange={(v) => s.set({ demoMode: v })}
        />
      </GlassCard>

      <Text style={styles.section}>Sound & feel</Text>
      <GlassCard style={styles.card}>
        <ToggleRow label="Sound effects" value={s.soundEnabled} onChange={(v) => s.set({ soundEnabled: v })} />
        <ToggleRow
          label="Voice coaching"
          hint="Spoken tips, so you don't have to read the screen"
          value={s.voiceEnabled}
          onChange={(v) => s.set({ voiceEnabled: v })}
        />
        {Platform.OS !== 'web' && (
          <ToggleRow label="Haptics" value={s.hapticsEnabled} onChange={(v) => s.set({ hapticsEnabled: v })} />
        )}
      </GlassCard>

      <Text style={styles.section}>Match Pose</Text>
      <GlassCard style={styles.card}>
        <ToggleRow
          label="Hide expert levels"
          hint="Hides handstand and crow levels"
          value={s.hideExpertLevels}
          onChange={(v) => s.set({ hideExpertLevels: v })}
        />
        <Pressable accessibilityRole="button" onPress={confirmReset} style={styles.resetButton}>
          <Text style={styles.resetText}>Reset progress</Text>
        </Pressable>
      </GlassCard>

      <Text style={styles.footer}>
        Pose tracking runs on your device. Camera video is never recorded or uploaded.
      </Text>
    </Screen>
  )
}

const styles = StyleSheet.create({
  section: {
    color: theme.colors.textDim,
    fontSize: theme.font.small,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: -theme.spacing.sm,
  },
  card: { gap: theme.spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  column: { gap: theme.spacing.sm },
  rowText: { flex: 1 },
  rowLabel: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '700' },
  rowHint: { color: theme.colors.textMuted, fontSize: theme.font.small, marginTop: 2 },
  segmented: {
    flexDirection: 'row',
    backgroundColor: theme.colors.track,
    borderRadius: theme.radius.pill,
    padding: 3,
    alignSelf: 'flex-start',
    flexWrap: 'wrap',
  },
  segment: { paddingHorizontal: theme.spacing.md, paddingVertical: 6, borderRadius: theme.radius.pill },
  segmentActive: { backgroundColor: theme.colors.primaryDark },
  segmentText: { color: theme.colors.textMuted, fontWeight: '700', fontSize: theme.font.small },
  segmentTextActive: { color: theme.colors.text },
  resetButton: { alignSelf: 'flex-start', paddingVertical: theme.spacing.sm },
  resetText: { color: theme.colors.danger, fontWeight: '800' },
  footer: { color: theme.colors.textDim, fontSize: theme.font.small, textAlign: 'center' },
})

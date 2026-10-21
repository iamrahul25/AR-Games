import type { ReactNode } from 'react'
import { Alert, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native'

import { useSettings, type ModelQualitySetting } from '@/core/settings/settingsStore'
import { GlassCard } from '@/core/ui/GlassCard'
import { Screen } from '@/core/ui/Screen'
import { ScreenHeader } from '@/core/ui/ScreenHeader'
import { SegmentedToggle } from '@/core/ui/SegmentedToggle'
import { theme } from '@/core/ui/theme'
import { useRunnerStore, type CameraPanelSize, type GuidesMode } from '@/games/endless-runner/store/runnerStore'
import { useMatchPoseProgress } from '@/games/match-pose/store/progressStore'

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
  const runner = useRunnerStore()

  const confirmRunnerReset = () => {
    const doReset = () => runner.resetProgress()
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.('Reset all Free Run bests and totals?')) doReset()
      return
    }
    Alert.alert('Reset Free Run?', 'This clears your best runs and totals.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: doReset },
    ])
  }

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
          <SegmentedToggle
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
          <SegmentedToggle<ModelQualitySetting>
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

      <Text style={styles.section}>Free Run</Text>
      <GlassCard style={styles.card}>
        <View style={styles.column}>
          <Text style={styles.rowLabel}>Show guides</Text>
          <Text style={styles.rowHint}>Lanes and the jump / duck lines on the camera</Text>
          <SegmentedToggle<GuidesMode>
            value={runner.guidesMode}
            options={[
              { value: 'always', label: 'Always' },
              { value: 'setup', label: 'During setup only' },
              { value: 'off', label: 'Off' },
            ]}
            onChange={(v) => runner.set({ guidesMode: v })}
          />
        </View>
        <View style={styles.column}>
          <Text style={styles.rowLabel}>Camera panel size</Text>
          <SegmentedToggle<CameraPanelSize>
            value={runner.cameraPanelSize}
            options={[
              { value: 'small', label: 'Small' },
              { value: 'medium', label: 'Medium' },
              { value: 'large', label: 'Large' },
            ]}
            onChange={(v) => runner.set({ cameraPanelSize: v })}
          />
        </View>
        <ToggleRow
          label="Setup tips before each run"
          value={runner.showSetupTips}
          onChange={(v) => runner.set({ showSetupTips: v })}
        />
        <ToggleRow
          label="Always do the training run"
          hint="Practise each move before every run"
          value={runner.alwaysTrainingRun}
          onChange={(v) => runner.set({ alwaysTrainingRun: v })}
        />
        {Platform.OS === 'web' && (
          <ToggleRow
            label="Keyboard controls"
            hint="Arrow keys or WASD to change lanes and duck, Space to jump"
            value={runner.keyboardControls}
            onChange={(v) => runner.set({ keyboardControls: v })}
          />
        )}
        <Pressable accessibilityRole="button" onPress={confirmRunnerReset} style={styles.resetButton}>
          <Text style={styles.resetText}>Reset Free Run progress</Text>
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
  resetButton: { alignSelf: 'flex-start', paddingVertical: theme.spacing.sm },
  resetText: { color: theme.colors.danger, fontWeight: '800' },
  footer: { color: theme.colors.textDim, fontSize: theme.font.small, textAlign: 'center' },
})

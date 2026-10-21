import { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'

import { useSettings } from '@/core/settings/settingsStore'
import { theme } from '@/core/ui/theme'
import { useLatest } from '@/core/utils/useLatest'
import type { FitMode } from './fitTransform'
import { GuideOverlay, type GuideSpec } from './GuideOverlay'
import { PoseSmoother, SMOOTHING_PRESETS, type SmoothingPreset } from './oneEuroFilter'
import { PoseCamera } from './PoseCamera'
import type { PartColors } from './PoseCamera.types'
import { resolvePoseModel } from './resolveModel'
import { SIMULATED_IMAGE_H, SIMULATED_IMAGE_W, SimulatedPoseCamera } from './SimulatedPoseCamera'
import type { SimulatorTarget } from './simulator'
import type { PoseCameraStatus, PoseFrame } from './types'

interface PoseStageProps {
  isActive: boolean
  /** Smoothed pose in canonical space, every `emitIntervalMs` (~15 Hz by default). */
  onPose: (frame: PoseFrame | null) => void
  partColors?: PartColors
  /** Pose the demo-mode player should copy. */
  simulatorTarget?: SimulatorTarget | null
  /** Demo-mode bot: called before every simulated frame, overrides `simulatorTarget`. */
  simulatorDriver?: (now: number) => SimulatorTarget | null
  /** Default `cover`. Use `contain` when the whole frame (head to feet) must stay visible. */
  resizeMode?: FitMode
  emitIntervalMs?: number
  /** Fixed at mount. Default `stable`. */
  smoothing?: SmoothingPreset
  /** Lanes / lines / markers drawn above the skeleton. */
  guides?: GuideSpec | null
  style?: StyleProp<ViewStyle>
}

/**
 * The live "stage": camera (or demo-mode simulated player) + skeleton overlay +
 * jitter smoothing + status overlays (permission, model loading, errors).
 */
export function PoseStage({
  isActive,
  onPose,
  partColors,
  simulatorTarget = null,
  simulatorDriver,
  resizeMode = 'cover',
  emitIntervalMs,
  smoothing = 'stable',
  guides,
  style,
}: PoseStageProps) {
  const { cameraFacing, modelQuality, showSkeleton, demoMode, set } = useSettings()
  const model = useMemo(() => resolvePoseModel(modelQuality), [modelQuality])
  const [status, setStatus] = useState<{ status: PoseCameraStatus; message?: string }>({
    status: 'loading-model',
  })
  const [smoother] = useState(() => new PoseSmoother(SMOOTHING_PRESETS[smoothing]))
  const [imageAspect, setImageAspect] = useState(3 / 4)
  const onPoseRef = useLatest(onPose)

  const handlePose = useCallback(
    (frame: PoseFrame | null) => {
      if (!frame) {
        smoother.reset()
        onPoseRef.current(null)
        return
      }
      if (frame.imageHeight > 0) {
        const aspect = Math.round((frame.imageWidth / frame.imageHeight) * 1000) / 1000
        setImageAspect((prev) => (prev === aspect ? prev : aspect))
      }
      onPoseRef.current(smoother.smooth(frame))
    },
    [smoother, onPoseRef],
  )

  const handleStatus = useCallback((s: PoseCameraStatus, message?: string) => {
    setStatus((prev) => (prev.status === s && prev.message === message ? prev : { status: s, message }))
  }, [])

  return (
    <View style={[styles.container, style]}>
      {demoMode ? (
        <SimulatedPoseCamera
          isActive={isActive}
          target={simulatorTarget}
          driver={simulatorDriver}
          showSkeleton={showSkeleton}
          partColors={partColors}
          onPose={handlePose}
          onStatus={handleStatus}
          resizeMode={resizeMode}
          emitIntervalMs={emitIntervalMs}
        />
      ) : (
        <PoseCamera
          facing={cameraFacing}
          model={model}
          isActive={isActive}
          showSkeleton={showSkeleton}
          partColors={partColors}
          onPose={handlePose}
          onStatus={handleStatus}
          resizeMode={resizeMode}
          emitIntervalMs={emitIntervalMs}
        />
      )}
      {guides && (
        <GuideOverlay
          spec={guides}
          imageAspect={demoMode ? SIMULATED_IMAGE_W / SIMULATED_IMAGE_H : imageAspect}
          fit={resizeMode}
          mirrorX={!demoMode && cameraFacing === 'back'}
        />
      )}
      {!demoMode && status.status !== 'running' && (
        <StatusOverlay
          status={status.status}
          message={status.message}
          onUseDemo={() => set({ demoMode: true })}
        />
      )}
    </View>
  )
}

function StatusOverlay({
  status,
  message,
  onUseDemo,
}: {
  status: PoseCameraStatus
  message?: string
  onUseDemo: () => void
}) {
  let title = 'Starting camera…'
  let body = 'Loading the pose model. This takes a moment the first time.'
  let showSpinner = true
  let showSettings = false
  if (status === 'requesting-permission') {
    title = 'Camera permission'
    body = 'Allow camera access so we can track your body. Video never leaves your device.'
  } else if (status === 'permission-denied') {
    title = 'Camera access is off'
    body =
      Platform.OS === 'web'
        ? 'Allow camera access in your browser’s site settings, then reload the page.'
        : 'Turn on camera access for AR Games in Settings to play.'
    showSpinner = false
    showSettings = Platform.OS !== 'web'
  } else if (status === 'error') {
    title = 'Camera error'
    body = message ?? 'Something went wrong starting the camera.'
    showSpinner = false
  }

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]}>
      {showSpinner && <ActivityIndicator color={theme.colors.primary} size="large" />}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {showSettings && (
        <Pressable style={styles.button} onPress={() => Linking.openSettings()}>
          <Text style={styles.buttonText}>Open Settings</Text>
        </Pressable>
      )}
      {!showSpinner && (
        <Pressable style={[styles.button, styles.secondary]} onPress={onUseDemo}>
          <Text style={styles.buttonText}>Play in demo mode</Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  overlay: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
    backgroundColor: theme.colors.overlay,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.font.heading,
    fontWeight: '800',
    textAlign: 'center',
  },
  body: {
    color: theme.colors.textMuted,
    fontSize: theme.font.body,
    textAlign: 'center',
    maxWidth: 360,
  },
  button: {
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primaryDark,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
  },
  buttonText: {
    color: theme.colors.text,
    fontWeight: '700',
    fontSize: theme.font.body,
  },
})

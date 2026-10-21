import { Redirect } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSharedValue } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import type { GuidePoint, GuideSpec } from '@/core/pose/GuideOverlay'
import { PoseStage } from '@/core/pose/PoseStage'
import type { PoseFrame } from '@/core/pose/types'
import { ScreenHeader } from '@/core/ui/ScreenHeader'
import { theme } from '@/core/ui/theme'
import { PRESETS, resolveRunConfig } from '@/games/endless-runner/config/difficulty'
import { calibrationParams, motionConfig } from '@/games/endless-runner/game/runnerGame'
import { Calibrator, type CalibratorState } from '@/games/endless-runner/motion/calibration'
import { buildGuideSpec } from '@/games/endless-runner/motion/guides'
import { MotionController, type MotionState } from '@/games/endless-runner/motion/motionController'

const CONFIG = resolveRunConfig(PRESETS.normal)
const MAX_LOG = 14

/** Dev-only: calibrate, then watch lane / jump / duck detection and the camera guides live. */
export default function RunnerMotionDebug() {
  const [calibrator] = useState(() => new Calibrator(calibrationParams(CONFIG)))
  const [motion] = useState(() => new MotionController(motionConfig(CONFIG)))
  const [calib, setCalib] = useState<CalibratorState>(calibrator.state)
  const [state, setState] = useState<MotionState>(motion.state)
  const [log, setLog] = useState<string[]>([])
  const [guides, setGuides] = useState<GuideSpec | null>(null)
  const head = useSharedValue<GuidePoint | null>(null)
  const hip = useSharedValue<GuidePoint | null>(null)
  const lastUi = useRef(0)
  const [t0] = useState(() => Date.now())

  const onPose = useCallback(
    (frame: PoseFrame | null) => {
      const t = Date.now() - t0
      if (!motion.calibration) {
        const st = calibrator.update(frame, t)
        setCalib(st)
        if (st.calibration) motion.setCalibration(st.calibration)
      }
      const { state: s, events } = motion.update(frame, t)
      head.set(s.head ? { x: s.head.x, y: s.head.y, active: s.airborne || s.ducking } : null)
      hip.set(s.hip ? { x: s.hip.x, y: s.hip.y } : null)
      if (events.length) {
        setLog((l) => [...events.map((e) => `${(t / 1000).toFixed(2)}s  ${e.type}${'to' in e ? ` → ${e.to}` : ''}`), ...l].slice(0, MAX_LOG))
      }
      const cal = motion.calibration
      const lines = motion.lines
      if (cal && lines) {
        const { spec } = buildGuideSpec(cal, lines, s, { showJump: true, showDuck: true })
        if (t - lastUi.current > 100) setGuides({ ...spec, markers: { head, hip, headRadius: lines.torso * 0.18 } })
      } else if (!guides) {
        setGuides({ markers: { head, hip } })
      }
      if (t - lastUi.current > 100) {
        lastUi.current = t
        setState(s)
      }
    },
    [calibrator, motion, head, hip, guides, t0],
  )

  const recalibrate = () => {
    calibrator.reset()
    motion.setCalibration(null)
    setGuides(null)
    setLog([])
  }

  if (!__DEV__) return <Redirect href="/" />

  const lines = motion.lines
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <ScreenHeader title="Runner motion" subtitle={motion.calibration ? 'Calibrated' : calib.message} />
      </View>
      <View style={styles.stage}>
        <PoseStage isActive onPose={onPose} resizeMode="contain" emitIntervalMs={33} smoothing="responsive" guides={guides} style={StyleSheet.absoluteFill} />
      </View>
      <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
        <Pressable onPress={recalibrate} style={styles.button}>
          <Text style={styles.buttonText}>Recalibrate</Text>
        </Pressable>
        <Text style={styles.mono}>
          lane {state.lane} · {state.airborne ? 'AIR' : 'ground'} · {state.ducking ? 'DUCK' : 'up'} · tracking {state.tracking} · still {Math.round(state.stillMs)} ms
        </Text>
        <Text style={styles.mono}>
          head {state.head ? `${state.head.x.toFixed(3)}, ${state.head.y.toFixed(3)}` : '–'} · hip {state.hip ? `${state.hip.x.toFixed(3)}, ${state.hip.y.toFixed(3)}` : '–'}
        </Text>
        {lines && (
          <Text style={styles.mono}>
            head0 {lines.headY0.toFixed(3)} · T {lines.torso.toFixed(3)} · jump {lines.jumpY.toFixed(3)} · duck {lines.duckY.toFixed(3)}
          </Text>
        )}
        {log.map((l, i) => (
          <Text key={`${l}-${i}`} style={styles.log}>
            {l}
          </Text>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingHorizontal: theme.spacing.lg },
  stage: { flex: 1, margin: theme.spacing.md, borderRadius: theme.radius.lg, overflow: 'hidden' },
  panel: { maxHeight: 260 },
  panelContent: { padding: theme.spacing.md, gap: 4 },
  button: { alignSelf: 'flex-start', paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.md, borderRadius: theme.radius.sm, backgroundColor: theme.colors.primaryDark },
  buttonText: { color: theme.colors.text, fontWeight: '800' },
  mono: { color: theme.colors.text, fontFamily: 'monospace', fontSize: 12 },
  log: { color: theme.colors.textMuted, fontFamily: 'monospace', fontSize: 12 },
})

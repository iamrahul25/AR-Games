import { router } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppState, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { playSound } from '@/core/audio/sfx'
import { speak, stopSpeaking } from '@/core/audio/voice'
import { haptics } from '@/core/haptics/haptics'
import type { PartColors } from '@/core/pose/PoseCamera.types'
import { PoseStage } from '@/core/pose/PoseStage'
import type { SimulatorTarget } from '@/core/pose/simulator'
import type { PoseFrame } from '@/core/pose/types'
import { BODY_PARTS } from '@/core/pose/types'
import { PART_STATUS_COLORS, theme } from '@/core/ui/theme'
import { useKeepScreenOn } from '@/core/utils/useKeepScreenOn'
import { BodyPartChecklist } from '../components/BodyPartChecklist'
import { FeedbackBanner } from '../components/FeedbackBanner'
import { HoldMeter } from '../components/HoldMeter'
import { HudBar } from '../components/HudBar'
import { CountdownOverlay, GetReadyOverlay, PauseMenu, RatingToast } from '../components/PlayOverlays'
import { TargetPoseCard } from '../components/TargetPoseCard'
import { levelPoses } from '../data/levels'
import { LevelRunner, type RunnerEvent, type RunnerSnapshot } from '../engine/levelRunner'
import { RATING_LABELS } from '../engine/scoring'
import { useMatchPoseProgress } from '../store/progressStore'
import type { LevelDefinition } from '../types'

const TICK_MS = 66
const RESULT_NAV_DELAY_MS = 1200

function now() {
  return globalThis.performance?.now?.() ?? Date.now()
}

export function PlayScreen({ level }: { level: LevelDefinition }) {
  useKeepScreenOn()
  const poses = useMemo(() => levelPoses(level), [level])
  const recordResult = useMatchPoseProgress((s) => s.recordResult)
  const [runner, setRunner] = useState(() => new LevelRunner(level, poses))
  const [snap, setSnap] = useState<RunnerSnapshot>(() => runner.snapshot())
  const [paused, setPaused] = useState(false)
  const frameRef = useRef<PoseFrame | null>(null)
  const finishedRef = useRef(false)

  const { width, height } = useWindowDimensions()
  const wide = width > height && width >= 700

  const handleEvents = useCallback(
    (events: RunnerEvent[]) => {
      for (const e of events) {
        switch (e.type) {
          case 'countdown-tick':
            playSound('tick')
            speak(String(e.value), { force: true })
            break
          case 'go':
            playSound('go')
            break
          case 'pose-start':
            speak(e.pose.name, { force: true })
            break
          case 'hold-start':
            playSound('match')
            haptics.light()
            break
          case 'hold-break':
            haptics.light()
            break
          case 'pose-success':
            playSound('success')
            haptics.success()
            speak(RATING_LABELS[e.outcome.rating], { force: true })
            break
          case 'pose-miss':
            playSound('fail')
            haptics.error()
            break
          case 'cue':
            speak(e.text)
            break
          case 'level-complete': {
            if (finishedRef.current) break
            finishedRef.current = true
            playSound('levelComplete')
            recordResult(level.id, e.summary, runner.snapshot().outcomes)
            setTimeout(() => router.replace(`/games/match-pose/result/${level.id}` as never), RESULT_NAV_DELAY_MS)
            break
          }
        }
      }
    },
    [level.id, recordResult, runner],
  )

  useEffect(() => {
    const id = setInterval(() => {
      const events = runner.update(now(), frameRef.current)
      if (events.length) handleEvents(events)
      setSnap(runner.snapshot())
    }, TICK_MS)
    return () => clearInterval(id)
  }, [runner, handleEvents])

  const pause = useCallback(() => {
    runner.pause(now())
    stopSpeaking()
    setPaused(true)
  }, [runner])

  const resume = useCallback(() => {
    runner.resume(now())
    setPaused(false)
  }, [runner])

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') pause()
    })
    return () => sub.remove()
  }, [pause])

  useEffect(() => () => stopSpeaking(), [])

  const onPose = useCallback((frame: PoseFrame | null) => {
    frameRef.current = frame
  }, [])

  const inPose = snap.phase === 'posing' || snap.phase === 'pose-result'
  const simulatorTarget = useMemo<SimulatorTarget | null>(
    () => (inPose ? { skeleton: snap.pose.skeleton, view: snap.pose.view } : null),
    [inPose, snap.pose],
  )

  const partColors = useMemo<PartColors | undefined>(() => {
    if (snap.phase !== 'posing') return undefined
    return Object.fromEntries(BODY_PARTS.map((p) => [p, PART_STATUS_COLORS[snap.match.parts[p].status]])) as PartColors
  }, [snap.phase, snap.match])

  const showTimer = snap.phase === 'posing'
  const cueText =
    snap.phase === 'posing'
      ? snap.holding
        ? 'Hold it right there!'
        : snap.cue ?? (snap.match.score >= 0.6 ? 'Almost there…' : null)
      : null
  const cueTone = snap.holding ? 'good' : 'info'

  const restart = () => {
    const fresh = new LevelRunner(level, poses)
    finishedRef.current = false
    setPaused(false)
    setRunner(fresh)
    setSnap(fresh.snapshot())
  }
  const quit = () => {
    stopSpeaking()
    if (router.canGoBack()) router.back()
    else router.replace('/games/match-pose' as never)
  }

  const overlays = (
    <>
      {snap.phase === 'get-ready' && <GetReadyOverlay framing={snap.framing} />}
      {snap.phase === 'countdown' && <CountdownOverlay value={snap.countdown} />}
      {(snap.phase === 'pose-result' || snap.phase === 'finished') && snap.lastOutcome && (
        <RatingToast outcome={snap.lastOutcome} />
      )}
    </>
  )

  const hud = (
    <HudBar levelId={level.id} poseIndex={snap.poseIndex} poseCount={snap.poseCount} score={snap.score} onPause={pause} />
  )

  const stage = (
    <PoseStage
      isActive={!paused}
      onPose={onPose}
      partColors={partColors}
      simulatorTarget={simulatorTarget}
      style={StyleSheet.absoluteFill}
    />
  )

  if (wide) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.wideRow} edges={['top', 'bottom', 'left', 'right']}>
          <View style={styles.wideCamera}>
            {stage}
            <View style={styles.wideCameraTop}>{hud}</View>
            {overlays}
            <View style={styles.wideCameraBottom} pointerEvents="none">
              <FeedbackBanner text={cueText} tone={cueTone} />
            </View>
          </View>
          <ScrollView style={styles.widePanel} contentContainerStyle={styles.widePanelContent}>
            <TargetPoseCard
              pose={snap.pose}
              timeLeftMs={snap.timeLeftMs}
              timeLimitMs={snap.timeLimitMs}
              showTimer={showTimer}
              large
            />
            <View style={styles.panelCard}>
              <BodyPartChecklist match={snap.match} />
            </View>
            <View style={styles.panelCard}>
              <HoldMeter
                progress={snap.holdProgress}
                holding={snap.holding}
                score={snap.match.score}
                holdSeconds={level.holdSeconds}
              />
            </View>
          </ScrollView>
        </SafeAreaView>
        {paused && <PauseMenu onResume={resume} onRestart={restart} onQuit={quit} />}
      </View>
    )
  }

  return (
    <View style={styles.root}>
      {stage}
      {overlays}
      <SafeAreaView style={styles.portraitChrome} edges={['top', 'bottom']} pointerEvents="box-none">
        <View style={styles.portraitTop} pointerEvents="box-none">
          {hud}
          {snap.phase !== 'get-ready' && (
            <TargetPoseCard pose={snap.pose} timeLeftMs={snap.timeLeftMs} timeLimitMs={snap.timeLimitMs} showTimer={showTimer} />
          )}
        </View>
        <View style={styles.portraitBottom} pointerEvents="none">
          {snap.phase === 'posing' && (
            <View style={styles.portraitMeterRow}>
              <View style={styles.portraitBanner}>
                <FeedbackBanner text={cueText} tone={cueTone} />
              </View>
              <HoldMeter
                progress={snap.holdProgress}
                holding={snap.holding}
                score={snap.match.score}
                holdSeconds={level.holdSeconds}
                size={80}
              />
            </View>
          )}
          {snap.phase === 'posing' && <BodyPartChecklist match={snap.match} compact />}
        </View>
      </SafeAreaView>
      {paused && <PauseMenu onResume={resume} onRestart={restart} onQuit={quit} />}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  portraitChrome: { ...StyleSheet.absoluteFill, justifyContent: 'space-between' },
  portraitTop: { padding: theme.spacing.md, gap: theme.spacing.sm },
  portraitBottom: { padding: theme.spacing.md, paddingBottom: theme.spacing.xl, gap: theme.spacing.sm },
  portraitMeterRow: { flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.sm },
  portraitBanner: { flex: 1 },
  wideRow: { flex: 1, flexDirection: 'row', backgroundColor: theme.colors.background },
  wideCamera: { flex: 1, margin: theme.spacing.md, borderRadius: theme.radius.lg, overflow: 'hidden', backgroundColor: '#000' },
  wideCameraTop: { position: 'absolute', top: theme.spacing.md, left: theme.spacing.md, right: theme.spacing.md },
  wideCameraBottom: { position: 'absolute', bottom: theme.spacing.xl, left: theme.spacing.lg, right: theme.spacing.lg },
  widePanel: { width: 380, flexGrow: 0 },
  widePanelContent: { paddingVertical: theme.spacing.md, paddingRight: theme.spacing.md, gap: theme.spacing.md },
  panelCard: {
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceGlass,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
  },
})

import { router, useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppState, Platform, StyleSheet, useWindowDimensions, View } from 'react-native'
import Animated, { LinearTransition, useSharedValue } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { playSound } from '@/core/audio/sfx'
import { speak, stopSpeaking } from '@/core/audio/voice'
import { haptics } from '@/core/haptics/haptics'
import type { GuidePoint, GuideSpec } from '@/core/pose/GuideOverlay'
import { PoseStage } from '@/core/pose/PoseStage'
import type { PoseFrame } from '@/core/pose/types'
import { useSettings } from '@/core/settings/settingsStore'
import { CountdownOverlay } from '@/core/ui/CountdownOverlay'
import { PauseMenu, type PauseAction } from '@/core/ui/PauseMenu'
import { theme } from '@/core/ui/theme'
import { useKeepScreenOn } from '@/core/utils/useKeepScreenOn'
import { useLatest } from '@/core/utils/useLatest'
import { CalibrationOverlay } from '../components/CalibrationOverlay'
import { MoveIndicator } from '../components/MoveIndicator'
import { GameOverOverlay, RestBreakOverlay, WaitingOverlay } from '../components/PhaseOverlays'
import { RunBanner, type Banner, type BannerTone } from '../components/RunBanner'
import { RunnerHud, type HudState } from '../components/RunnerHud'
import { SetupTipsOverlay } from '../components/SetupTipsOverlay'
import { TrainingOverlay, type AutoTuneOffer } from '../components/TrainingOverlay'
import { applySettingsChange, resolveRunConfig } from '../config/difficulty'
import { DemoBot, type DemoContext } from '../demo/demoBot'
import { KeyboardInput, useKeyboardControls } from '../demo/keyboardControls'
import { streakMultiplier } from '../engine/scoring'
import { RESUME_STILL_MS, type SessionPhase } from '../engine/session'
import type { AutoTune, TrainingStep } from '../engine/training'
import { RunnerGame, autoTuneLabel, type GameEvent } from '../game/runnerGame'
import { buildGuideSpec } from '../motion/guides'
import type { DrawList } from '../render/drawList'
import { RunnerCanvas } from '../render/RunnerCanvas'
import { buildScene } from '../render/scene'
import { RUNNER_ROUTES } from '../routes'
import { CAMERA_PANEL_FRACTION, useRunnerStore } from '../store/runnerStore'
import type { DifficultySettings, Lane } from '../types'

const HUD_INTERVAL_MS = 100
const RESULT_NAV_DELAY_MS = 1600
/** Quitting a run longer than this still shows (and records) the result. */
const QUIT_RESULT_MIN_S = 10
const POSE_INTERVAL_MS = 33
const SETUP_PHASES: readonly SessionPhase[] = ['setup-tips', 'calibrating', 'training']

function now() {
  return globalThis.performance?.now?.() ?? Date.now()
}

function spokenDistance(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} kilometres` : `${Math.round(m)} metres`
}

const AUTO_TUNE_PATCH: Record<AutoTune, Partial<DifficultySettings>> = {
  'jump-line-low': { jumpLine: 'low' },
  'duck-line-shallow': { duckLine: 'low' },
  'lane-narrow': { laneWidth: 'narrow' },
}

interface TrainingUi {
  step: TrainingStep
  index: number
  total: number
  hint: string | null
  successKey: number
}

interface MotionUi {
  lane: Lane | null
  jumping: boolean
  ducking: boolean
  tracked: boolean
  inCenter: boolean
  stillProgress: number
}

const INITIAL_HUD: HudState = { distance: 0, score: 0, coins: 0, lives: null, livesMax: null, speedDial: 1, speedUp: false, multiplier: 1, remaining: {} }

export function PlayScreen({ forceTraining = false }: { forceTraining?: boolean }) {
  useKeepScreenOn()
  const initial = useRunnerStore.getState()
  const settings = useRunnerStore((s) => s.settings)
  const setSettings = useRunnerStore((s) => s.setSettings)
  const setRunner = useRunnerStore((s) => s.set)
  const recordRun = useRunnerStore((s) => s.recordRun)
  const guidesMode = useRunnerStore((s) => s.guidesMode)
  const panelSize = useRunnerStore((s) => s.cameraPanelSize)
  const keyboardSetting = useRunnerStore((s) => s.keyboardControls)
  const demoMode = useSettings((s) => s.demoMode)
  const safetyAcknowledged = useSettings((s) => s.safetyAcknowledged)
  const setGlobal = useSettings((s) => s.set)
  const keyboardEnabled = Platform.OS === 'web' && (__DEV__ || keyboardSetting)

  const [keyboard] = useState(() => new KeyboardInput())
  const [canSkipTraining] = useState(initial.tutorialDone)
  const [game] = useState(
    () =>
      new RunnerGame({
        config: resolveRunConfig(initial.settings),
        showTips: initial.showSetupTips || !useSettings.getState().safetyAcknowledged,
        training: forceTraining || !initial.tutorialDone || initial.alwaysTrainingRun,
        keyboard: keyboardEnabled ? keyboard : null,
      }),
  )
  const [phase, setPhase] = useState<SessionPhase>(game.phase)
  const [calib, setCalib] = useState(game.calibratorState)
  const [hud, setHud] = useState<HudState>(INITIAL_HUD)
  const [motionUi, setMotionUi] = useState<MotionUi>({ lane: null, jumping: false, ducking: false, tracked: false, inCenter: false, stillProgress: 0 })
  const [banner, setBanner] = useState<Banner | null>(null)
  const [countdown, setCountdown] = useState<number | string | null>(null)
  const [training, setTraining] = useState<TrainingUi | null>(null)
  const [offer, setOffer] = useState<AutoTune | null>(null)
  const [guides, setGuides] = useState<GuideSpec | null>(null)
  const [focused, setFocused] = useState(true)
  const head = useSharedValue<GuidePoint | null>(null)
  const hip = useSharedValue<GuidePoint | null>(null)
  const guidesKey = useRef('')
  const speedUpUntil = useRef(0)
  const bannerId = useRef(0)
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const finished = useRef(false)

  const { width, height } = useWindowDimensions()
  const wide = width > height && width >= 700
  const setup = SETUP_PHASES.includes(phase)

  useFocusEffect(
    useCallback(() => {
      setFocused(true)
      return () => setFocused(false)
    }, []),
  )

  const showBanner = useCallback((text: string, tone: BannerTone, ms = 1400) => {
    bannerId.current++
    setBanner({ id: bannerId.current, text, tone })
    if (bannerTimer.current) clearTimeout(bannerTimer.current)
    bannerTimer.current = setTimeout(() => setBanner(null), ms)
  }, [])
  useEffect(() => () => {
    if (bannerTimer.current) clearTimeout(bannerTimer.current)
  }, [])

  const finishRun = useCallback(() => {
    if (finished.current) return
    finished.current = true
    const stats = game.stats()
    const result = recordRun(stats, useRunnerStore.getState().settings)
    const completed = stats.finished === 'time' || stats.finished === 'distance'
    playSound(completed ? 'levelComplete' : 'gameOver')
    haptics.success()
    speak(completed ? `Workout complete! ${spokenDistance(stats.distance)}` : `Great run! ${spokenDistance(stats.distance)}`, { force: true })
    if (result.isNewBest) showBanner('★ NEW BEST', 'good', 1500)
    setTimeout(() => router.replace(RUNNER_ROUTES.result as never), RESULT_NAV_DELAY_MS)
  }, [game, recordRun, showBanner])

  const handleEvents = (events: GameEvent[]) => {
    const config = game.config
    for (const e of events) {
      switch (e.type) {
        case 'session': {
          const ev = e.event
          if (ev.type === 'phase') {
            setPhase(ev.phase)
            if (ev.phase === 'over') finishRun()
            if (ev.phase === 'resting') {
              playSound('success')
              speak('Take a breath. 20 seconds.', { force: true })
            }
            if (ev.phase === 'waiting' && game.session.waitReason === 'lost') {
              playSound('fail')
              speak('Step back into view', { force: true })
            }
            if (ev.phase === 'calibrating') setCalib(game.calibratorState)
          } else if (ev.type === 'countdown') {
            setCountdown(ev.value)
            playSound('tick')
            speak(String(ev.value), { force: true })
          } else if (ev.type === 'go') {
            setCountdown('GO!')
            playSound('go')
            speak('Go!', { force: true })
            setTimeout(() => setCountdown(null), 700)
          }
          break
        }
        case 'calibration':
          setCalib(e.state)
          if (e.state.step === 'done') {
            playSound('success')
            haptics.success()
            speak('Calibrated!', { force: true })
          }
          break
        case 'training': {
          const t = e.event
          if (t.type === 'step') {
            setTraining((prev) => ({ step: t.step, index: t.index, total: game.training?.steps.length ?? 1, hint: null, successKey: prev?.successKey ?? 0 }))
            speak(t.step.voice, { force: true })
          } else if (t.type === 'success') {
            playSound('success')
            haptics.success()
            setTraining((prev) => (prev ? { ...prev, successKey: prev.successKey + 1 } : prev))
          } else if (t.type === 'hint') {
            setTraining((prev) => (prev ? { ...prev, hint: t.text } : prev))
            speak(t.text, { force: true })
          } else if (t.type === 'auto-tune') {
            setOffer(t.fix)
            const label = autoTuneLabel(t.fix)
            speak(label.title, { force: true })
          } else if (t.type === 'done') {
            setTraining(null)
            setOffer(null)
            setRunner({ tutorialDone: true })
            speak('You are ready!', { force: true })
          }
          break
        }
        case 'motion':
          if (e.event.type === 'tracking-restored' && game.phase === 'waiting') playSound('match')
          break
        case 'sim': {
          const ev = e.event
          switch (ev.type) {
            case 'jump':
              playSound('jump')
              break
            case 'slide':
              playSound('slide')
              break
            case 'lane':
              playSound('lane')
              break
            case 'coin':
              playSound('coin')
              break
            case 'close-call':
              playSound('closeCall')
              showBanner('Close call!', 'warn', 900)
              break
            case 'hit':
              playSound('hit')
              haptics.error()
              showBanner(ev.livesLeft === null ? 'Bump!' : ev.livesLeft > 0 ? `Ouch! ${ev.livesLeft} ♥ left` : 'Ouch!', 'bad', 1000)
              if (useRunnerStore.getState().settings.preset === 'kids') speak('Ouch!', { force: true })
              break
            case 'speed-up':
              playSound('speedUp')
              haptics.light()
              speedUpUntil.current = now() + 2000
              showBanner('Speed up!', 'info')
              speak('Speed up!')
              break
            case 'milestone':
              playSound('milestone')
              showBanner(`${ev.meters >= 1000 ? `${ev.meters / 1000} km` : `${ev.meters} m`}!`, 'good')
              speak(`${spokenDistance(ev.meters)}!`)
              break
            case 'hint':
              if (config.moveHints === 'voice') speak(ev.text, { force: true })
              break
            case 'water-break':
              showBanner('💧 Time for a water break?', 'info', 3500)
              speak('Time for a water break?', { force: true })
              break
          }
          break
        }
      }
    }
  }
  const handleEventsRef = useLatest(handleEvents)

  useEffect(() => {
    const ev = game.start(now())
    if (ev.length) handleEventsRef.current(ev)
  }, [game, handleEventsRef])

  // Game clock: session timers, training and fixed-step simulation, plus throttled HUD updates.
  useEffect(() => {
    let raf = 0
    let lastHud = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const t = now()
      const ev = game.tick(t)
      if (ev.length) handleEventsRef.current(ev)
      if (t - lastHud < HUD_INTERVAL_MS) return
      lastHud = t
      const w = game.sim.snapshot()
      const next: HudState = {
        distance: Math.floor(w.distance),
        score: w.score,
        coins: w.coinsCollected,
        lives: w.lives,
        livesMax: w.livesMax,
        speedDial: Math.round(w.speedDial * 10) / 10,
        speedUp: t < speedUpUntil.current,
        multiplier: streakMultiplier(w.streak),
        remaining: {
          seconds: w.remaining.seconds !== undefined ? Math.ceil(w.remaining.seconds) : undefined,
          meters: w.remaining.meters !== undefined ? Math.ceil(w.remaining.meters) : undefined,
        },
      }
      setHud((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
      const ms = game.motionState
      const kb = keyboard.active || game.isKeyboardOnly
      const mNext: MotionUi = {
        lane: kb ? keyboard.lane : ms.hip ? ms.lane : null,
        jumping: kb ? w.player.state === 'jump' : ms.airborne,
        ducking: kb ? keyboard.ducking : ms.ducking,
        tracked: ms.tracking !== 'lost' && !!ms.hip,
        inCenter: ms.lane === 0,
        stillProgress: Math.min(1, ms.stillMs / RESUME_STILL_MS),
      }
      setMotionUi((prev) => (JSON.stringify(prev) === JSON.stringify(mNext) ? prev : mNext))
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [game, keyboard, handleEventsRef])

  const guidesVisible = setup || guidesMode === 'always' || (guidesMode === 'setup' && phase !== 'running' && phase !== 'countdown')
  const guidesVisibleRef = useLatest(guidesVisible)

  const onPose = useCallback(
    (frame: PoseFrame | null) => {
      const ev = game.onPose(frame, now())
      if (ev.length) handleEventsRef.current(ev)
      const st = game.motionState
      const lines = game.motion.lines
      const cal = game.calibration
      const aboveJump = !!(st.head && lines && st.head.y < lines.jumpY)
      const belowDuck = !!(st.head && lines && st.head.y > lines.duckY)
      head.set(st.head ? { x: st.head.x, y: st.head.y, active: aboveJump || belowDuck } : null)
      hip.set(st.hip ? { x: st.hip.x, y: st.hip.y } : null)
      if (!guidesVisibleRef.current) {
        if (guidesKey.current !== 'hidden') {
          guidesKey.current = 'hidden'
          setGuides(null)
        }
        return
      }
      const markers = { head, hip, headRadius: lines ? lines.torso * 0.18 : 0.04 }
      if (!cal || !lines) {
        if (guidesKey.current !== 'markers') {
          guidesKey.current = 'markers'
          setGuides({ markers })
        }
        return
      }
      const config = game.config
      const { spec, key } = buildGuideSpec(cal, lines, st, {
        showJump: config.enabledMoves.includes('jump'),
        showDuck: config.enabledMoves.includes('duck'),
        jumpLabel: config.jumpStyle === 'hands-up' ? '▲ HANDS UP' : undefined,
      })
      if (key !== guidesKey.current) {
        guidesKey.current = key
        setGuides({ ...spec, markers })
      }
    },
    [game, head, hip, handleEventsRef, guidesVisibleRef],
  )

  useEffect(() => {
    guidesKey.current = ''
  }, [guidesVisible])

  const [bot] = useState(
    () =>
      new DemoBot(game.config, (): DemoContext => {
        const p = game.phase
        return {
          world: p === 'running' || p === 'training' ? game.world() : null,
          calibration: game.calibration,
          lines: game.motion.lines,
          mode: p === 'running' || p === 'countdown' ? 'running' : p === 'training' ? 'training' : 'stand',
          trainingStep: game.training?.current.id,
        }
      }),
  )
  const simulatorDriver = useCallback((t: number) => bot.target(t), [bot])

  const drawFrame = useCallback(
    (_t: number, list: DrawList, w: number, h: number) => {
      buildScene(list, game.world(), w, h, { time: now() / 1000 })
      return true
    },
    [game],
  )

  const pause = useCallback(() => {
    stopSpeaking()
    handleEventsRef.current(game.pause())
  }, [game, handleEventsRef])
  const resume = () => handleEventsRef.current(game.resume(now()))

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && game.phase !== 'over' && game.phase !== 'paused') pause()
    })
    return () => sub.remove()
  }, [game, pause])
  useEffect(() => () => stopSpeaking(), [])

  const togglePause = useCallback(() => {
    if (game.phase === 'paused') handleEventsRef.current(game.resume(now()))
    else if (game.phase !== 'over') pause()
  }, [game, pause, handleEventsRef])
  useKeyboardControls(keyboard, keyboardEnabled && focused, togglePause)

  const playWithKeyboard = keyboardEnabled ? () => handleEventsRef.current(game.switchToKeyboard(now())) : undefined

  const quit = () => {
    stopSpeaking()
    const stats = game.stats()
    if (!finished.current && stats.timeS > QUIT_RESULT_MIN_S) {
      finished.current = true
      recordRun(stats, useRunnerStore.getState().settings)
      router.replace(RUNNER_ROUTES.result as never)
      return
    }
    if (router.canGoBack()) router.back()
    else router.replace(RUNNER_ROUTES.home as never)
  }
  const pauseActions: PauseAction[] = [
    { label: 'Resume', onPress: resume, variant: 'primary' },
    ...(game.isKeyboardOnly ? [] : [{ label: 'Recalibrate', onPress: () => handleEventsRef.current(game.recalibrate()) }]),
    { label: 'How to play', onPress: () => router.push(RUNNER_ROUTES.howToPlay as never) },
    {
      label: 'Restart',
      onPress: () => {
        finished.current = false
        bot.reset()
        handleEventsRef.current(game.restart(now()))
      },
    },
    { label: 'Quit', onPress: quit, variant: 'ghost' },
  ]

  const autoTuneOffer = useMemo<AutoTuneOffer | null>(() => {
    if (!offer) return null
    const label = autoTuneLabel(offer)
    return {
      ...label,
      onAccept: () => {
        const next = applySettingsChange(settings, AUTO_TUNE_PATCH[offer])
        setSettings(next)
        const config = resolveRunConfig(next)
        game.updateConfig(config)
        bot.setConfig(config)
        guidesKey.current = ''
        setOffer(null)
        speak('Done! Try again.', { force: true })
      },
      onDismiss: () => setOffer(null),
    }
  }, [offer, settings, setSettings, game, bot])

  const onTipsDone = (dontShowAgain: boolean) => {
    if (dontShowAgain) setRunner({ showSetupTips: false })
    if (!safetyAcknowledged) setGlobal({ safetyAcknowledged: true })
    handleEventsRef.current(game.tipsDone(now()))
  }

  const stage = (
    <PoseStage
      isActive={focused}
      onPose={onPose}
      simulatorDriver={demoMode ? simulatorDriver : undefined}
      resizeMode="contain"
      emitIntervalMs={POSE_INTERVAL_MS}
      smoothing="responsive"
      guides={guides}
      style={StyleSheet.absoluteFill}
    />
  )

  const cameraOverlays = (
    <>
      {phase === 'setup-tips' && (
        <SetupTipsOverlay
          onContinue={onTipsDone}
          kidsNote={settings.preset === 'kids'}
          seniorNote={settings.preset === 'gentle' || settings.seatedMode}
          onKeyboard={playWithKeyboard}
        />
      )}
      {phase === 'calibrating' && <CalibrationOverlay state={calib} onKeyboard={playWithKeyboard} />}
      {phase === 'training' && training && (
        <>
          <View style={[styles.inset, wide && styles.insetWide]}>
            <RunnerCanvas onFrame={drawFrame} />
          </View>
          <TrainingOverlay
            step={training.step}
            index={training.index}
            total={training.total}
            hint={training.hint}
            successKey={training.successKey}
            canSkip={canSkipTraining || forceTraining}
            onSkip={() => handleEventsRef.current(game.skipTraining(now()))}
            offer={autoTuneOffer}
          />
        </>
      )}
      {phase === 'waiting' && game.session.waitReason && (
        <WaitingOverlay
          reason={game.session.waitReason}
          tracked={motionUi.tracked}
          inCenter={motionUi.inCenter}
          stillProgress={motionUi.stillProgress}
          onPause={pause}
        />
      )}
    </>
  )

  const gameView = (
    <View style={styles.game}>
      <RunnerCanvas onFrame={drawFrame} paused={!focused} />
      <View style={styles.hud} pointerEvents="box-none">
        <RunnerHud hud={hud} onPause={pause} />
        <RunBanner banner={banner} />
      </View>
      {countdown !== null && phase !== 'paused' && <CountdownOverlay value={countdown} />}
      {phase === 'resting' && <RestBreakOverlay endsAt={game.session.restEndsAt} now={now} />}
      {phase === 'over' && <GameOverOverlay finished={game.stats().finished !== 'lives'} />}
    </View>
  )

  const indicator = <MoveIndicator lane={motionUi.lane} jumping={motionUi.jumping} ducking={motionUi.ducking} compact={wide} />
  const panelFrac = CAMERA_PANEL_FRACTION[panelSize]
  const transition = LinearTransition.duration(400)

  return (
    <View style={styles.root}>
      <SafeAreaView style={[styles.safe, wide && styles.row]} edges={['top', 'bottom', 'left', 'right']}>
        {!setup && <View style={{ flex: wide ? 0.62 : 1 - panelFrac }}>{gameView}</View>}
        {!setup && !wide && indicator}
        <Animated.View layout={transition} style={[styles.panel, { flex: setup ? 1 : wide ? 0.38 : panelFrac }]}>
          <View style={styles.camera}>
            {stage}
            {cameraOverlays}
          </View>
          {!setup && wide && indicator}
        </Animated.View>
      </SafeAreaView>
      {phase === 'paused' && <PauseMenu actions={pauseActions} transparent />}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  safe: { flex: 1 },
  row: { flexDirection: 'row' },
  game: { flex: 1, overflow: 'hidden' },
  hud: { position: 'absolute', top: theme.spacing.sm, left: theme.spacing.sm, right: theme.spacing.sm, gap: theme.spacing.sm },
  panel: { overflow: 'hidden' },
  camera: { flex: 1, overflow: 'hidden', backgroundColor: '#000' },
  inset: {
    position: 'absolute',
    right: theme.spacing.md,
    bottom: theme.spacing.md,
    width: '38%',
    aspectRatio: 4 / 3,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: theme.colors.surfaceBorder,
  },
  insetWide: { width: '28%' },
})

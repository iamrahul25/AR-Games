import { router } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppState, StyleSheet, useWindowDimensions, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { playSound } from '@/core/audio/sfx'
import { speak, stopSpeaking } from '@/core/audio/voice'
import { haptics } from '@/core/haptics/haptics'
import type { StageProjection } from '@/core/pose/fitTransform'
import { PoseStage } from '@/core/pose/PoseStage'
import type { PoseFrame } from '@/core/pose/types'
import { useSettings } from '@/core/settings/settingsStore'
import { CountdownOverlay } from '@/core/ui/CountdownOverlay'
import { PauseMenu, type PauseAction } from '@/core/ui/PauseMenu'
import { theme } from '@/core/ui/theme'
import { useKeepScreenOn } from '@/core/utils/useKeepScreenOn'
import { BubbleHud } from '../components/BubbleHud'
import { BubbleLayer } from '../components/BubbleLayer'
import { GetReadyOverlay, LostTrackingBanner, TimeUpToast } from '../components/PlayOverlays'
import { MODES } from '../config/modes'
import { BubbleDemoBot } from '../demo/demoBot'
import { BubbleGame, type BubbleEvent, type VisibleArea } from '../engine/bubbleGame'
import { BUBBLE_ROUTES } from '../routes'
import { useBubbleStore } from '../store/bubbleStore'

/** Bubbles move and hands sweep quickly, so this game ticks and tracks faster than Match Pose. */
const TICK_MS = 33
const POSE_INTERVAL_MS = 33
const RESULT_NAV_DELAY_MS = 1600

function now() {
  return globalThis.performance?.now?.() ?? Date.now()
}

export function PlayScreen() {
  useKeepScreenOn()
  const mode = MODES[useBubbleStore((s) => s.mode)]
  const recordRound = useBubbleStore((s) => s.recordRound)
  const demoMode = useSettings((s) => s.demoMode)
  const { width, height } = useWindowDimensions()
  const [game, setGame] = useState(() => new BubbleGame(mode))
  const [snap, setSnap] = useState(() => game.snapshot())
  const [paused, setPaused] = useState(false)
  const [hudBottom, setHudBottom] = useState(0)
  const frameRef = useRef<PoseFrame | null>(null)
  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bot = useMemo(() => new BubbleDemoBot(() => ({ snapshot: game.snapshot(), frame: game.lastFrame })), [game])

  const handleEvents = useCallback(
    (events: BubbleEvent[]) => {
      for (const e of events) {
        switch (e.type) {
          case 'countdown-tick':
            playSound('tick')
            speak(String(e.value), { force: true })
            break
          case 'go':
            playSound('go')
            speak('Pop!', { force: true })
            break
          case 'pop':
            playSound(e.kind === 'golden' ? 'golden' : 'pop')
            haptics.light()
            break
          case 'combo-up':
            playSound('milestone')
            speak(`Combo! Times ${e.multiplier}`, { force: true })
            break
          case 'bomb':
            playSound('hit')
            haptics.error()
            break
          case 'tracking-lost':
            speak('Come back into view', { force: true })
            break
          case 'finished':
            playSound('levelComplete')
            speak("Time's up!", { force: true })
            recordRound(e.summary)
            navTimer.current = setTimeout(() => router.replace(BUBBLE_ROUTES.result as never), RESULT_NAV_DELAY_MS)
            break
        }
      }
    },
    [recordRound],
  )

  useEffect(() => {
    const id = setInterval(() => {
      const events = game.update(now(), frameRef.current)
      if (events.length) handleEvents(events)
      setSnap(game.snapshot())
    }, TICK_MS)
    return () => clearInterval(id)
  }, [game, handleEvents])

  useEffect(
    () => () => {
      stopSpeaking()
      if (navTimer.current) clearTimeout(navTimer.current)
    },
    [],
  )

  const pause = useCallback(() => {
    if (game.phase === 'finished') return
    game.pause()
    stopSpeaking()
    setPaused(true)
  }, [game])

  const resume = useCallback(() => {
    game.resume()
    setPaused(false)
  }, [game])

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') pause()
    })
    return () => sub.remove()
  }, [pause])

  const onPose = useCallback((frame: PoseFrame | null) => {
    frameRef.current = frame
  }, [])

  const onVisibleArea = useCallback((area: VisibleArea) => game.setVisibleArea(area), [game])
  const simulatorDriver = useCallback((t: number) => bot.target(t), [bot])

  const restart = () => {
    const fresh = new BubbleGame(mode)
    setPaused(false)
    setGame(fresh)
    setSnap(fresh.snapshot())
  }
  const quit = () => {
    stopSpeaking()
    if (router.canGoBack()) router.back()
    else router.replace(BUBBLE_ROUTES.home as never)
  }
  const pauseActions: PauseAction[] = [
    { label: 'Resume', onPress: resume, variant: 'primary' },
    { label: 'Restart', onPress: restart },
    { label: 'Quit', onPress: quit, variant: 'ghost' },
  ]

  const overlay = (projection: StageProjection) => (
    <BubbleLayer
      projection={projection}
      bubbles={snap.bubbles}
      effects={snap.effects}
      poppers={snap.phase === 'playing' ? snap.poppers : []}
      topInset={hudBottom}
      onVisibleArea={onVisibleArea}
    />
  )

  return (
    <View style={styles.root}>
      <PoseStage
        isActive={!paused}
        onPose={onPose}
        simulatorDriver={demoMode ? simulatorDriver : undefined}
        emitIntervalMs={POSE_INTERVAL_MS}
        smoothing="responsive"
        // Landscape would crop off the head and feet of a portrait camera image.
        resizeMode={width > height ? 'contain' : 'cover'}
        overlay={overlay}
        style={StyleSheet.absoluteFill}
      />
      {snap.phase === 'get-ready' && <GetReadyOverlay readiness={snap.readiness} needsFeet={mode.feet} />}
      {snap.phase === 'countdown' && <CountdownOverlay value={snap.countdown} />}
      {snap.phase === 'playing' && !snap.tracking && <LostTrackingBanner />}
      {snap.phase === 'finished' && <TimeUpToast score={snap.score} />}
      <SafeAreaView
        style={styles.chrome}
        edges={['top']}
        pointerEvents="box-none"
        onLayout={(e) => setHudBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}
      >
        <BubbleHud
          timeLeftMs={snap.timeLeftMs}
          durationMs={snap.durationMs}
          score={snap.score}
          multiplier={snap.multiplier}
          onPause={pause}
        />
      </SafeAreaView>
      {paused && <PauseMenu actions={pauseActions} />}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  chrome: { position: 'absolute', top: 0, left: 0, right: 0, padding: theme.spacing.md },
})

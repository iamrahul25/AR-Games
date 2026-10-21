import { Redirect } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { PoseStage } from '@/core/pose/PoseStage'
import { frameToSkeleton } from '@/core/pose/skeleton'
import type { PoseFrame } from '@/core/pose/types'
import { Button } from '@/core/ui/Button'
import { ScreenHeader } from '@/core/ui/ScreenHeader'
import { theme } from '@/core/ui/theme'

const COUNTDOWN_S = 5
const CAPTURE_MS = 2000

type Phase = { kind: 'idle' } | { kind: 'countdown'; left: number } | { kind: 'capturing' } | { kind: 'done'; json: string }

/**
 * Dev-only: strike a pose, and this records ~2 s of frames and prints the averaged
 * segment directions as a skeleton spec ready to paste into the pose library.
 */
export default function PoseRecorder() {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const captured = useRef<PoseFrame[]>([])
  const capturing = useRef(false)

  const onPose = useCallback((frame: PoseFrame | null) => {
    if (capturing.current && frame) captured.current.push(frame)
  }, [])

  useEffect(() => {
    if (phase.kind !== 'countdown') return
    const id = setTimeout(() => {
      if (phase.left <= 1) {
        captured.current = []
        capturing.current = true
        setPhase({ kind: 'capturing' })
      } else {
        setPhase({ kind: 'countdown', left: phase.left - 1 })
      }
    }, 1000)
    return () => clearTimeout(id)
  }, [phase])

  useEffect(() => {
    if (phase.kind !== 'capturing') return
    const id = setTimeout(() => {
      capturing.current = false
      const skeleton = frameToSkeleton(captured.current)
      const json = JSON.stringify(skeleton, null, 2)
      console.log(`[pose-recorder] ${captured.current.length} frames\n${json}`)
      if (Platform.OS === 'web') globalThis.navigator?.clipboard?.writeText(json).catch(() => {})
      setPhase({ kind: 'done', json })
    }, CAPTURE_MS)
    return () => clearTimeout(id)
  }, [phase])

  if (!__DEV__) return <Redirect href="/" />

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <ScreenHeader title="Pose recorder" subtitle="Hold a pose to capture its skeleton spec" />
      </View>
      <View style={styles.stage}>
        <PoseStage isActive onPose={onPose} style={StyleSheet.absoluteFill} />
        {phase.kind === 'countdown' && <Text style={styles.big}>{phase.left}</Text>}
        {phase.kind === 'capturing' && <Text style={styles.big}>Hold…</Text>}
      </View>
      <View style={styles.footer}>
        <Button
          label={phase.kind === 'done' ? 'Record again' : 'Record'}
          disabled={phase.kind === 'countdown' || phase.kind === 'capturing'}
          onPress={() => setPhase({ kind: 'countdown', left: COUNTDOWN_S })}
        />
        {phase.kind === 'done' && (
          <ScrollView style={styles.output}>
            <Text selectable style={styles.mono}>
              {phase.json}
            </Text>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  header: { padding: theme.spacing.md },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  big: { color: theme.colors.text, fontSize: 96, fontWeight: '900' },
  footer: { padding: theme.spacing.md, gap: theme.spacing.md },
  output: { maxHeight: 220, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: theme.spacing.md },
  mono: { color: theme.colors.text, fontFamily: 'monospace', fontSize: 12 },
})

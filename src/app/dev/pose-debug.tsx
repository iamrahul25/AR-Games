import { Redirect } from 'expo-router'
import { useCallback, useMemo, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { checkFraming } from '@/core/pose/framing'
import { SEGMENT_NAMES, segmentAngle, segmentLength, segmentVisibility } from '@/core/pose/geometry'
import type { PartColors } from '@/core/pose/PoseCamera.types'
import { PoseStage } from '@/core/pose/PoseStage'
import { BODY_PARTS, type PoseFrame } from '@/core/pose/types'
import { ScreenHeader } from '@/core/ui/ScreenHeader'
import { PART_STATUS_COLORS, theme } from '@/core/ui/theme'
import { POSE_LIST } from '@/games/match-pose/data/poses'
import { compilePose, matchPose } from '@/games/match-pose/engine/poseMatcher'

/** Dev-only: live segment angles and match details against any pose in the library. */
export default function PoseDebug() {
  const [frame, setFrame] = useState<PoseFrame | null>(null)
  const [poseIndex, setPoseIndex] = useState(0)
  const lastUpdate = useRef(0)
  const pose = POSE_LIST[poseIndex]
  const compiled = useMemo(() => compilePose(pose), [pose])
  const simulatorTarget = useMemo(() => ({ skeleton: pose.skeleton, view: pose.view }), [pose])

  const onPose = useCallback((f: PoseFrame | null) => {
    const t = Date.now()
    if (t - lastUpdate.current < 150) return
    lastUpdate.current = t
    setFrame(f)
  }, [])

  const match = frame ? matchPose(compiled, frame) : null
  const partColors = match
    ? (Object.fromEntries(BODY_PARTS.map((p) => [p, PART_STATUS_COLORS[match.parts[p].status]])) as PartColors)
    : undefined
  const torso = frame ? segmentLength(frame, 'torso') : 1

  if (!__DEV__) return <Redirect href="/" />

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <ScreenHeader title="Pose debug" subtitle={frame ? `${frame.inferenceMs?.toFixed(0) ?? '–'} ms inference` : 'No pose'} />
      </View>
      <View style={styles.stage}>
        <PoseStage isActive onPose={onPose} partColors={partColors} simulatorTarget={simulatorTarget} style={StyleSheet.absoluteFill} />
      </View>
      <View style={styles.picker}>
        <Pressable style={styles.pickButton} onPress={() => setPoseIndex((i) => (i + POSE_LIST.length - 1) % POSE_LIST.length)}>
          <Text style={styles.pickText}>‹</Text>
        </Pressable>
        <Text style={styles.poseName}>
          {pose.name} · {match ? `${Math.round(match.score * 100)}%` : '–'} · cov {match ? match.coverage.toFixed(2) : '–'}
        </Text>
        <Pressable style={styles.pickButton} onPress={() => setPoseIndex((i) => (i + 1) % POSE_LIST.length)}>
          <Text style={styles.pickText}>›</Text>
        </Pressable>
      </View>
      <ScrollView style={styles.table} contentContainerStyle={styles.tableContent}>
        <Text style={styles.mono}>Framing: {checkFraming(frame).message}</Text>
        {SEGMENT_NAMES.map((name) => {
          const c = match?.constraints.find((k) => k.segment === name && k.kind === 'direction')
          return (
            <Text key={name} style={styles.mono}>
              {name.padEnd(14)}{' '}
              {frame
                ? `${segmentAngle(frame, name).toFixed(0).padStart(5)}°  len ${(segmentLength(frame, name) / torso).toFixed(2)}  vis ${segmentVisibility(frame, name).toFixed(2)}`
                : '—'}
              {c ? `  tgt ${c.target.toFixed(0)}° score ${c.score === null ? '–' : c.score.toFixed(2)}` : ''}
            </Text>
          )
        })}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  header: { padding: theme.spacing.md },
  stage: { flex: 1, minHeight: 240 },
  picker: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, padding: theme.spacing.sm },
  pickButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.track },
  pickText: { color: theme.colors.text, fontSize: 24, fontWeight: '700' },
  poseName: { flex: 1, color: theme.colors.text, textAlign: 'center', fontWeight: '800' },
  table: { maxHeight: 260 },
  tableContent: { padding: theme.spacing.md, gap: 2 },
  mono: { color: theme.colors.text, fontFamily: 'monospace', fontSize: 12 },
})

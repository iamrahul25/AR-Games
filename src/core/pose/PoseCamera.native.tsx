import { Canvas, Path, Skia, type SkPath } from '@shopify/react-native-skia'
import { useCallback, useEffect } from 'react'
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native'
import { usePoseDetector } from 'react-native-ar-pose-landmarker'
import { type SharedValue, useDerivedValue, useSharedValue } from 'react-native-reanimated'
import {
  Camera,
  CommonResolutions,
  useCameraPermission,
  useFrameOutput,
} from 'react-native-vision-camera'
import { scheduleOnRN } from 'react-native-worklets'

import { theme } from '@/core/ui/theme'
import { useLatest } from '@/core/utils/useLatest'
import { fitTransform, type FitMode } from './fitTransform'
import { BONES, JOINTS, LANDMARK_COUNT, MIRROR_INDEX } from './landmarks'
import { toCanonical } from './mirror'
import { POSE_EMIT_INTERVAL_MS, type PartColors, type PoseCameraProps } from './PoseCamera.types'
import type { BodyPart, Landmark, PoseFrame } from './types'

const VISIBILITY = 0.5
const PARTS: BodyPart[] = ['head', 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg']
const BONE_LIST = BONES.map((b) => [b.from, b.to, PARTS.indexOf(b.part)])
const JOINT_LIST = JOINTS.map((j) => [j.index, PARTS.indexOf(j.part)])
const MIRROR = [...MIRROR_INDEX]

export function PoseCamera({
  facing,
  model,
  isActive,
  showSkeleton = true,
  partColors,
  onPose,
  onStatus,
  resizeMode = 'cover',
  emitIntervalMs = POSE_EMIT_INTERVAL_MS,
  style,
}: PoseCameraProps) {
  const permission = useCameraPermission()
  const detector = usePoseDetector({ model, delegate: 'gpu' })
  const mirrored = facing === 'front'

  // [x, y, visibility] * 33, normalized, in preview (display) space with the user's own L/R labels.
  const points = useSharedValue<number[]>([])
  const imageSize = useSharedValue({ width: 480, height: 640 })
  const viewSize = useSharedValue({ width: 1, height: 1 })
  const lastEmit = useSharedValue(0)
  const reportedRunning = useSharedValue(false)
  const reportedError = useSharedValue(false)

  const onPoseRef = useLatest(onPose)
  const onStatusRef = useLatest(onStatus)

  useEffect(() => {
    if (permission.hasPermission) {
      onStatusRef.current?.('loading-model')
    } else if (permission.canRequestPermission) {
      onStatusRef.current?.('requesting-permission')
      permission.requestPermission()
    } else {
      onStatusRef.current?.('permission-denied')
    }
  }, [permission.hasPermission, permission.canRequestPermission, permission, onStatusRef])

  const emitPose = useCallback(
    (flat: number[] | null, width: number, height: number, timestamp: number, inferenceMs: number) => {
      if (!flat) {
        onPoseRef.current(null)
        return
      }
      const landmarks: Landmark[] = []
      for (let i = 0; i < LANDMARK_COUNT; i++) {
        landmarks.push({
          x: flat[i * 4],
          y: flat[i * 4 + 1],
          z: flat[i * 4 + 2],
          visibility: flat[i * 4 + 3],
        })
      }
      const frame: PoseFrame = { landmarks, imageWidth: width, imageHeight: height, timestamp, inferenceMs }
      onPoseRef.current(toCanonical(frame, mirrored))
    },
    [mirrored, onPoseRef],
  )

  const emitStatus = useCallback((status: 'running' | 'error', message?: string) => {
    onStatusRef.current?.(status, message)
  }, [onStatusRef])

  const frameOutput = useFrameOutput({
    pixelFormat: 'rgb',
    targetResolution: CommonResolutions.VGA_4_3,
    onFrame(frame) {
      'worklet'
      try {
        const result = detector.detect(frame)
        if (!reportedRunning.value) {
          reportedRunning.value = true
          scheduleOnRN(emitStatus, 'running', undefined)
        }
        let flat: number[] | null = null
        if (result && result.landmarks.length >= LANDMARK_COUNT * 4) {
          // The model saw the mirrored preview image, so its left/right labels are swapped.
          flat = mirrored
            ? MIRROR.flatMap((src) => result.landmarks.slice(src * 4, src * 4 + 4))
            : result.landmarks
          const pts: number[] = []
          for (let i = 0; i < LANDMARK_COUNT; i++) pts.push(flat[i * 4], flat[i * 4 + 1], flat[i * 4 + 3])
          points.value = pts
          imageSize.value = { width: result.imageWidth, height: result.imageHeight }
        } else {
          points.value = []
        }
        const now = Date.now()
        if (now - lastEmit.value >= emitIntervalMs) {
          lastEmit.value = now
          scheduleOnRN(
            emitPose,
            flat,
            result?.imageWidth ?? 0,
            result?.imageHeight ?? 0,
            now,
            result?.inferenceMs ?? 0,
          )
        }
      } catch (e) {
        if (!reportedError.value) {
          reportedError.value = true
          scheduleOnRN(emitStatus, 'error', String(e))
        }
      } finally {
        frame.dispose()
      }
    },
  })

  const onLayout = (e: LayoutChangeEvent) => {
    viewSize.value = { width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height }
  }

  if (!permission.hasPermission) {
    return <View style={[styles.container, style]} />
  }

  return (
    <View style={[styles.container, style]} onLayout={onLayout}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={facing}
        isActive={isActive}
        outputs={[frameOutput]}
        mirrorMode="auto"
        resizeMode={resizeMode}
        onError={(e) => onStatusRef.current?.('error', e.message)}
      />
      {showSkeleton && (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          {PARTS.map((part, partIndex) => (
            <PartSkeleton
              key={part}
              partIndex={partIndex}
              color={(partColors as PartColors | undefined)?.[part] ?? theme.colors.skeletonNeutral}
              points={points}
              imageSize={imageSize}
              viewSize={viewSize}
              fit={resizeMode}
            />
          ))}
        </Canvas>
      )}
    </View>
  )
}

interface PartSkeletonProps {
  partIndex: number
  color: string
  points: SharedValue<number[]>
  imageSize: SharedValue<{ width: number; height: number }>
  viewSize: SharedValue<{ width: number; height: number }>
  fit: FitMode
}

function PartSkeleton({ partIndex, color, points, imageSize, viewSize, fit }: PartSkeletonProps) {
  const bones = useDerivedValue<SkPath>(() => {
    const path = Skia.PathBuilder.Make()
    const p = points.value
    if (p.length === 0) return path.detach()
    const { scale, dx, dy, iw, ih } = fitTransform(imageSize.value, viewSize.value, fit)
    for (const [from, to, part] of BONE_LIST) {
      if (part !== partIndex) continue
      if (p[from * 3 + 2] < VISIBILITY || p[to * 3 + 2] < VISIBILITY) continue
      path.moveTo(p[from * 3] * iw * scale + dx, p[from * 3 + 1] * ih * scale + dy)
      path.lineTo(p[to * 3] * iw * scale + dx, p[to * 3 + 1] * ih * scale + dy)
    }
    return path.detach()
  })

  const joints = useDerivedValue<SkPath>(() => {
    const path = Skia.PathBuilder.Make()
    const p = points.value
    if (p.length === 0) return path.detach()
    const { scale, dx, dy, iw, ih } = fitTransform(imageSize.value, viewSize.value, fit)
    for (const [index, part] of JOINT_LIST) {
      if (part !== partIndex || p[index * 3 + 2] < VISIBILITY) continue
      path.addCircle(p[index * 3] * iw * scale + dx, p[index * 3 + 1] * ih * scale + dy, 7)
    }
    return path.detach()
  })

  return (
    <>
      <Path path={bones} color={color} style="stroke" strokeWidth={7} strokeCap="round" />
      <Path path={joints} color={color} />
      <Path path={joints} color="white" style="stroke" strokeWidth={2.5} />
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
})

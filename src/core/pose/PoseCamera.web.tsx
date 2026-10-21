import type * as TasksVision from '@mediapipe/tasks-vision'
import { useEffect, useRef } from 'react'
import { StyleSheet, View } from 'react-native'

import { theme } from '@/core/ui/theme'
import { useLatest } from '@/core/utils/useLatest'
import { fitTransform } from './fitTransform'
import { BONES, JOINTS } from './landmarks'
import { POSE_EMIT_INTERVAL_MS, type PoseCameraProps } from './PoseCamera.types'
import type { Landmark, PoseFrame } from './types'

const VISIBILITY = 0.5
const WASM_PATH = '/mediapipe/wasm'
const BUNDLE_URL = '/mediapipe/vision_bundle.mjs'

// Native browser import(), hidden from Metro (which can't bundle @mediapipe/tasks-vision).
const importModule = new Function('url', 'return import(url)') as (url: string) => Promise<typeof TasksVision>

let landmarkerPromise: Promise<TasksVision.PoseLandmarker> | undefined
let landmarkerModel: string | undefined

async function getLandmarker(model: 'lite' | 'full'): Promise<TasksVision.PoseLandmarker> {
  if (landmarkerPromise && landmarkerModel === model) return landmarkerPromise
  const previous = landmarkerPromise
  landmarkerModel = model
  landmarkerPromise = (async () => {
    previous?.then((l) => l.close()).catch(() => {})
    const { FilesetResolver, PoseLandmarker } = await importModule(BUNDLE_URL)
    const vision = await FilesetResolver.forVisionTasks(WASM_PATH)
    const create = (delegate: 'GPU' | 'CPU') =>
      PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `/mediapipe/models/pose_landmarker_${model}.task`,
          delegate,
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      })
    try {
      return await create('GPU')
    } catch (e) {
      console.warn('[PoseCamera] GPU delegate unavailable, using CPU', e)
      return await create('CPU')
    }
  })()
  return landmarkerPromise
}

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
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const onPoseRef = useLatest(onPose)
  const onStatusRef = useLatest(onStatus)
  const drawOptionsRef = useLatest({ showSkeleton, partColors, resizeMode, emitIntervalMs })

  const mirrored = facing === 'front'

  useEffect(() => {
    if (!isActive) return
    let cancelled = false
    let stream: MediaStream | undefined
    let rafId: number | undefined
    let lastVideoTime = -1
    let lastEmit = 0

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          onStatusRef.current?.('error', 'Camera is not available in this browser (HTTPS is required).')
          return
        }
        onStatusRef.current?.('requesting-permission')
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: facing === 'front' ? 'user' : 'environment',
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
        })
        if (cancelled) return
        const video = videoRef.current!
        video.srcObject = stream
        await video.play()

        onStatusRef.current?.('loading-model')
        const landmarker = await getLandmarker(model)
        if (cancelled) return
        onStatusRef.current?.('running')

        const loop = () => {
          if (cancelled) return
          const v = videoRef.current
          if (v && v.readyState >= 2 && v.currentTime !== lastVideoTime) {
            lastVideoTime = v.currentTime
            const now = performance.now()
            const started = performance.now()
            const result = landmarker.detectForVideo(v, now)
            const inferenceMs = performance.now() - started
            const raw = result.landmarks[0]
            // Display is mirrored with CSS; the model saw the un-mirrored image, so labels are already correct.
            const landmarks: Landmark[] | null = raw
              ? raw.map((lm) => ({
                  x: mirrored ? 1 - lm.x : lm.x,
                  y: lm.y,
                  z: lm.z,
                  visibility: lm.visibility ?? 0,
                }))
              : null
            draw(landmarks, v.videoWidth, v.videoHeight)
            if (now - lastEmit >= drawOptionsRef.current.emitIntervalMs) {
              lastEmit = now
              if (landmarks) {
                const frame: PoseFrame = {
                  landmarks: mirrored ? landmarks : landmarks.map((lm) => ({ ...lm, x: 1 - lm.x })),
                  imageWidth: v.videoWidth,
                  imageHeight: v.videoHeight,
                  timestamp: now,
                  inferenceMs,
                }
                onPoseRef.current(frame)
              } else {
                onPoseRef.current(null)
              }
            }
          }
          rafId = requestAnimationFrame(loop)
        }
        loop()
      } catch (e) {
        const err = e as DOMException
        if (err?.name === 'NotAllowedError') onStatusRef.current?.('permission-denied', err.message)
        else onStatusRef.current?.('error', String(e))
      }
    }

    const draw = (landmarks: Landmark[] | null, iw: number, ih: number) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
        canvas.width = Math.round(rect.width * dpr)
        canvas.height = Math.round(rect.height * dpr)
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, rect.width, rect.height)
      const { showSkeleton: show, partColors: colors, resizeMode: fit } = drawOptionsRef.current
      if (!landmarks || !show) return

      const { scale, dx, dy } = fitTransform({ width: iw, height: ih }, rect, fit)
      const px = (lm: Landmark) => lm.x * iw * scale + dx
      const py = (lm: Landmark) => lm.y * ih * scale + dy

      ctx.lineCap = 'round'
      ctx.lineWidth = 7
      for (const bone of BONES) {
        const a = landmarks[bone.from]
        const b = landmarks[bone.to]
        if (a.visibility < VISIBILITY || b.visibility < VISIBILITY) continue
        ctx.strokeStyle = colors?.[bone.part] ?? theme.colors.skeletonNeutral
        ctx.beginPath()
        ctx.moveTo(px(a), py(a))
        ctx.lineTo(px(b), py(b))
        ctx.stroke()
      }
      for (const joint of JOINTS) {
        const p = landmarks[joint.index]
        if (p.visibility < VISIBILITY) continue
        ctx.fillStyle = colors?.[joint.part] ?? theme.colors.skeletonNeutral
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.arc(px(p), py(p), 7, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
    }

    start()
    return () => {
      cancelled = true
      if (rafId !== undefined) cancelAnimationFrame(rafId)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [isActive, facing, model, mirrored, onPoseRef, onStatusRef, drawOptionsRef])

  return (
    <View style={[styles.container, style]}>
      <video
        ref={videoRef}
        playsInline
        muted
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: resizeMode,
          transform: mirrored ? 'scaleX(-1)' : undefined,
        }}
      />
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
})

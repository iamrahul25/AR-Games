import {
  Canvas,
  PaintStyle,
  Picture,
  Skia,
  StrokeCap,
  TileMode,
  type SkColor,
  type SkPaint,
  type SkPicture,
  type SkShader,
} from '@shopify/react-native-skia'
import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import { useSharedValue } from 'react-native-reanimated'
import { useLatest } from '@/core/utils/useLatest'
import { DrawList } from './drawList'
import type { RunnerCanvasProps } from './RunnerCanvas.types'

const colorCache = new Map<string, SkColor>()
function color(hex: string): SkColor {
  let c = colorCache.get(hex)
  if (!c) {
    c = Skia.Color(hex)
    colorCache.set(hex, c)
  }
  return c
}

const shaderCache = new Map<string, SkShader>()
function gradient(top: string, bottom: string, y: number, h: number): SkShader {
  const key = `${top}|${bottom}|${Math.round(y)}|${Math.round(h)}`
  let s = shaderCache.get(key)
  if (!s) {
    if (shaderCache.size > 16) shaderCache.clear()
    s = Skia.Shader.MakeLinearGradient({ x: 0, y }, { x: 0, y: y + h }, [color(top), color(bottom)], null, TileMode.Clamp)
    shaderCache.set(key, s)
  }
  return s
}

function emptyPicture(): SkPicture {
  const recorder = Skia.PictureRecorder()
  recorder.beginRecording(Skia.XYWHRect(0, 0, 1, 1))
  return recorder.finishRecordingAsPicture()
}

function record(list: DrawList, width: number, height: number, paint: SkPaint): SkPicture {
  const recorder = Skia.PictureRecorder()
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height))
  for (let i = 0; i < list.length; i++) {
    const c = list.cmds[i]
    paint.setShader(null)
    paint.setColor(color(c.color))
    paint.setAlphaf(c.alpha)
    paint.setStyle(c.stroke > 0 ? PaintStyle.Stroke : PaintStyle.Fill)
    if (c.stroke > 0) paint.setStrokeWidth(c.stroke)
    switch (c.k) {
      case 'poly': {
        const b = Skia.PathBuilder.Make()
        b.moveTo(c.pts[0], c.pts[1])
        for (let p = 1; p < c.npts; p++) b.lineTo(c.pts[p * 2], c.pts[p * 2 + 1])
        b.close()
        canvas.drawPath(b.detach(), paint)
        break
      }
      case 'rect':
        canvas.drawRect(Skia.XYWHRect(c.x, c.y, c.w, c.h), paint)
        break
      case 'circle':
        canvas.drawCircle(c.x, c.y, c.w, paint)
        break
      case 'ellipse':
        canvas.drawOval(Skia.XYWHRect(c.x - c.w, c.y - c.h, c.w * 2, c.h * 2), paint)
        break
      case 'line':
        paint.setStyle(PaintStyle.Stroke)
        canvas.drawLine(c.x, c.y, c.x2, c.y2, paint)
        break
      case 'grad':
        paint.setColor(color('#FFFFFF'))
        paint.setShader(gradient(c.color, c.color2, c.y, c.h))
        canvas.drawRect(Skia.XYWHRect(c.x, c.y, c.w, c.h), paint)
        break
    }
  }
  return recorder.finishRecordingAsPicture()
}

/** Skia backend: replays the draw list into an SkPicture each frame. */
export function RunnerCanvas({ style, onFrame, paused = false }: RunnerCanvasProps) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [initial] = useState(emptyPicture)
  const picture = useSharedValue<SkPicture>(initial)
  const onFrameRef = useLatest(onFrame)
  const [list] = useState(() => new DrawList())
  const paint = useRef<SkPaint | null>(null)

  useEffect(() => {
    if (paused || size.width === 0 || size.height === 0) return
    if (!paint.current) {
      const p = Skia.Paint()
      p.setAntiAlias(true)
      p.setStrokeCap(StrokeCap.Round)
      paint.current = p
    }
    let raf = 0
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (onFrameRef.current(now, list, size.width, size.height) && paint.current) {
        picture.set(record(list, size.width, size.height, paint.current))
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [paused, size.width, size.height, list, onFrameRef, picture])

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    setSize((s) => (s.width === width && s.height === height ? s : { width, height }))
  }

  return (
    <View style={[styles.container, style]} onLayout={onLayout}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Picture picture={picture} />
      </Canvas>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden', backgroundColor: '#0B1530' },
})

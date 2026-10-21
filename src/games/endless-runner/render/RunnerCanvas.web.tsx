import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useLatest } from '@/core/utils/useLatest'
import { DrawList } from './drawList'
import type { RunnerCanvasProps } from './RunnerCanvas.types'

function replay(ctx: CanvasRenderingContext2D, list: DrawList) {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (let i = 0; i < list.length; i++) {
    const c = list.cmds[i]
    ctx.globalAlpha = c.alpha
    ctx.fillStyle = c.color
    ctx.strokeStyle = c.color
    switch (c.k) {
      case 'poly':
        ctx.beginPath()
        ctx.moveTo(c.pts[0], c.pts[1])
        for (let p = 1; p < c.npts; p++) ctx.lineTo(c.pts[p * 2], c.pts[p * 2 + 1])
        ctx.closePath()
        if (c.stroke > 0) {
          ctx.lineWidth = c.stroke
          ctx.stroke()
        } else ctx.fill()
        break
      case 'rect':
        ctx.fillRect(c.x, c.y, c.w, c.h)
        break
      case 'circle':
        ctx.beginPath()
        ctx.arc(c.x, c.y, c.w, 0, Math.PI * 2)
        if (c.stroke > 0) {
          ctx.lineWidth = c.stroke
          ctx.stroke()
        } else ctx.fill()
        break
      case 'ellipse':
        ctx.beginPath()
        ctx.ellipse(c.x, c.y, c.w, c.h, 0, 0, Math.PI * 2)
        ctx.fill()
        break
      case 'line':
        ctx.lineWidth = c.stroke
        ctx.beginPath()
        ctx.moveTo(c.x, c.y)
        ctx.lineTo(c.x2, c.y2)
        ctx.stroke()
        break
      case 'grad': {
        const g = ctx.createLinearGradient(0, c.y, 0, c.y + c.h)
        g.addColorStop(0, c.color)
        g.addColorStop(1, c.color2)
        ctx.fillStyle = g
        ctx.fillRect(c.x, c.y, c.w, c.h)
        break
      }
    }
  }
  ctx.globalAlpha = 1
}

/** Web backend: replays the draw list onto a 2D canvas (devicePixelRatio aware). */
export function RunnerCanvas({ style, onFrame, paused = false }: RunnerCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const onFrameRef = useLatest(onFrame)
  const [list] = useState(() => new DrawList())

  useEffect(() => {
    if (paused) return
    let raf = 0
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = Math.round(rect.width * dpr)
      const h = Math.round(rect.height * dpr)
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      if (!onFrameRef.current(now, list, rect.width, rect.height)) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, rect.width, rect.height)
      replay(ctx, list)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [paused, list, onFrameRef])

  return (
    <View style={[styles.container, style]}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden', backgroundColor: '#0B1530' },
})

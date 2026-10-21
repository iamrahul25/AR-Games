import { memo } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'

import { theme } from '@/core/ui/theme'
import { BONES, JOINTS, LM } from './landmarks'
import type { PartColors } from './PoseCamera.types'
import type { Landmark } from './types'

interface StickFigureProps {
  landmarks: Landmark[] | null
  /** Aspect ratio (width / height) of the image the landmarks are normalized to. */
  imageAspect: number
  width: number
  height: number
  partColors?: PartColors
  color?: string
  lineWidth?: number
  jointRadius?: number
  showHead?: boolean
  /** 'cover' crops like a camera preview; 'contain' fits the whole image. */
  fit?: 'cover' | 'contain'
  style?: StyleProp<ViewStyle>
}

const VISIBILITY = 0.5

/**
 * Draws a skeleton with plain Views (rotated bars + dots) so it renders identically
 * on iOS, Android and web without a canvas library.
 */
export const StickFigure = memo(function StickFigure({
  landmarks,
  imageAspect,
  width,
  height,
  partColors,
  color = theme.colors.skeletonNeutral,
  lineWidth = 6,
  jointRadius = 5,
  showHead = true,
  fit = 'contain',
  style,
}: StickFigureProps) {
  if (!landmarks || width <= 0 || height <= 0) {
    return <View style={[{ width, height }, style]} pointerEvents="none" />
  }

  const iw = imageAspect
  const ih = 1
  const scale = fit === 'cover' ? Math.max(width / iw, height / ih) : Math.min(width / iw, height / ih)
  const dx = (width - iw * scale) / 2
  const dy = (height - ih * scale) / 2
  const px = (lm: Landmark) => lm.x * iw * scale + dx
  const py = (lm: Landmark) => lm.y * ih * scale + dy

  const nose = landmarks[LM.nose]
  const shoulderSpan = Math.hypot(
    px(landmarks[LM.leftShoulder]) - px(landmarks[LM.rightShoulder]),
    py(landmarks[LM.leftShoulder]) - py(landmarks[LM.rightShoulder]),
  )
  const torsoLen = Math.hypot(
    (px(landmarks[LM.leftShoulder]) + px(landmarks[LM.rightShoulder])) / 2 -
      (px(landmarks[LM.leftHip]) + px(landmarks[LM.rightHip])) / 2,
    (py(landmarks[LM.leftShoulder]) + py(landmarks[LM.rightShoulder])) / 2 -
      (py(landmarks[LM.leftHip]) + py(landmarks[LM.rightHip])) / 2,
  )
  const headRadius = Math.max(lineWidth * 1.6, Math.max(shoulderSpan * 0.32, torsoLen * 0.2))

  return (
    <View style={[{ width, height }, style]} pointerEvents="none">
      {BONES.map((bone, i) => {
        const a = landmarks[bone.from]
        const b = landmarks[bone.to]
        if (a.visibility < VISIBILITY || b.visibility < VISIBILITY) return null
        const x1 = px(a)
        const y1 = py(a)
        const x2 = px(b)
        const y2 = py(b)
        const len = Math.hypot(x2 - x1, y2 - y1)
        const angle = Math.atan2(y2 - y1, x2 - x1)
        return (
          <View
            key={i}
            style={[
              styles.bone,
              {
                left: (x1 + x2) / 2 - len / 2,
                top: (y1 + y2) / 2 - lineWidth / 2,
                width: len,
                height: lineWidth,
                borderRadius: lineWidth / 2,
                backgroundColor: partColors?.[bone.part] ?? color,
                transform: [{ rotate: `${angle}rad` }],
              },
            ]}
          />
        )
      })}
      {JOINTS.map((joint) => {
        if (joint.index === LM.nose) return null
        const p = landmarks[joint.index]
        if (p.visibility < VISIBILITY) return null
        return (
          <View
            key={joint.index}
            style={[
              styles.joint,
              {
                left: px(p) - jointRadius,
                top: py(p) - jointRadius,
                width: jointRadius * 2,
                height: jointRadius * 2,
                borderRadius: jointRadius,
                backgroundColor: partColors?.[joint.part] ?? color,
              },
            ]}
          />
        )
      })}
      {showHead && nose.visibility >= VISIBILITY && (
        <View
          style={[
            styles.head,
            {
              left: px(nose) - headRadius,
              top: py(nose) - headRadius,
              width: headRadius * 2,
              height: headRadius * 2,
              borderRadius: headRadius,
              borderWidth: Math.max(2, lineWidth * 0.6),
              borderColor: partColors?.head ?? color,
            },
          ]}
        />
      )}
    </View>
  )
})

const styles = StyleSheet.create({
  bone: { position: 'absolute' },
  joint: { position: 'absolute', borderWidth: 2, borderColor: '#FFFFFF' },
  head: { position: 'absolute', backgroundColor: 'transparent' },
})

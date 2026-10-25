export type FitMode = 'cover' | 'contain'

export interface Size {
  width: number
  height: number
}

export interface FitTransform {
  /** View pixels per image pixel. */
  scale: number
  /** Image size (in image pixels) the normalized coordinates refer to. */
  iw: number
  ih: number
  /** Offset of the image's top-left corner inside the view. */
  dx: number
  dy: number
}

/**
 * How an image of `image` size is placed inside a `view`:
 * `cover` fills the view and crops, `contain` shows the whole image with letterbox bars.
 * Normalized point (x, y) maps to view pixels `(x * iw * scale + dx, y * ih * scale + dy)`.
 */
export function fitTransform(image: Size, view: Size, mode: FitMode = 'cover'): FitTransform {
  'worklet'
  const iw = image.width || 1
  const ih = image.height || 1
  const scale =
    mode === 'contain' ? Math.min(view.width / iw, view.height / ih) : Math.max(view.width / iw, view.height / ih)
  return { scale, iw, ih, dx: (view.width - iw * scale) / 2, dy: (view.height - ih * scale) / 2 }
}

/** Maps canonical (mirror-view) normalized coordinates onto a camera view. */
export interface StageProjection {
  width: number
  height: number
  /** View pixels per normalized image-height unit. */
  unit: number
  /** Canonical normalized region that is actually on screen (`cover` crops the image). */
  visible: { left: number; right: number; top: number; bottom: number }
  toView: (x: number, y: number) => { x: number; y: number }
  /** Inverse of `toView`: canonical normalized point under a view pixel. */
  fromView: (x: number, y: number) => { x: number; y: number }
}

export function stageProjection(imageAspect: number, view: Size, mode: FitMode, mirrorX: boolean): StageProjection {
  const tf = fitTransform({ width: imageAspect, height: 1 }, view, mode)
  const w = tf.iw * tf.scale
  const h = tf.ih * tf.scale
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
  // A centered crop is symmetric, so the visible x range is the same with or without mirroring.
  const left = clamp01(-tf.dx / w)
  const top = clamp01(-tf.dy / h)
  return {
    width: view.width,
    height: view.height,
    unit: h,
    visible: { left, right: 1 - left, top, bottom: 1 - top },
    toView: (x, y) => ({ x: (mirrorX ? 1 - x : x) * w + tf.dx, y: y * h + tf.dy }),
    fromView: (x, y) => {
      const nx = (x - tf.dx) / w
      return { x: mirrorX ? 1 - nx : nx, y: (y - tf.dy) / h }
    },
  }
}

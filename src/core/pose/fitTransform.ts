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

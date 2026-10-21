/**
 * Platform-agnostic draw commands, replayed by the Skia (native) or canvas 2D (web) backend.
 * Commands and point arrays are pooled and reused every frame (no per-frame allocation).
 */
export type DrawKind = 'poly' | 'rect' | 'circle' | 'ellipse' | 'line' | 'grad'

export interface DrawCmd {
  k: DrawKind
  color: string
  alpha: number
  /** poly: flat [x0, y0, x1, y1, …] */
  pts: number[]
  npts: number
  x: number
  y: number
  /** rect/grad: width/height; ellipse: radii; circle: w = radius */
  w: number
  h: number
  /** line end */
  x2: number
  y2: number
  /** > 0 = stroke width (poly/circle/line), 0 = fill */
  stroke: number
  /** grad: bottom color */
  color2: string
}

function blank(): DrawCmd {
  return { k: 'rect', color: '#000', alpha: 1, pts: [], npts: 0, x: 0, y: 0, w: 0, h: 0, x2: 0, y2: 0, stroke: 0, color2: '#000' }
}

export class DrawList {
  readonly cmds: DrawCmd[] = []
  length = 0

  reset() {
    this.length = 0
  }

  private next(k: DrawKind, color: string, alpha: number): DrawCmd {
    let c = this.cmds[this.length]
    if (!c) {
      c = blank()
      this.cmds.push(c)
    }
    this.length++
    c.k = k
    c.color = color
    c.alpha = alpha
    c.stroke = 0
    c.npts = 0
    return c
  }

  /** Filled (or stroked) polygon from flat coordinates. */
  poly(color: string, alpha: number, ...xy: number[]) {
    if (alpha <= 0.01) return
    const c = this.next('poly', color, alpha)
    for (let i = 0; i < xy.length; i++) c.pts[i] = xy[i]
    c.npts = xy.length / 2
  }

  quad(color: string, alpha: number, x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) {
    if (alpha <= 0.01) return
    const c = this.next('poly', color, alpha)
    const p = c.pts
    p[0] = x0
    p[1] = y0
    p[2] = x1
    p[3] = y1
    p[4] = x2
    p[5] = y2
    p[6] = x3
    p[7] = y3
    c.npts = 4
  }

  rect(color: string, alpha: number, x: number, y: number, w: number, h: number) {
    if (alpha <= 0.01) return
    const c = this.next('rect', color, alpha)
    c.x = x
    c.y = y
    c.w = w
    c.h = h
  }

  circle(color: string, alpha: number, x: number, y: number, r: number, stroke = 0) {
    if (alpha <= 0.01 || r <= 0) return
    const c = this.next('circle', color, alpha)
    c.x = x
    c.y = y
    c.w = r
    c.stroke = stroke
  }

  ellipse(color: string, alpha: number, x: number, y: number, rx: number, ry: number) {
    if (alpha <= 0.01 || rx <= 0 || ry <= 0) return
    const c = this.next('ellipse', color, alpha)
    c.x = x
    c.y = y
    c.w = rx
    c.h = ry
  }

  line(color: string, alpha: number, x1: number, y1: number, x2: number, y2: number, width: number) {
    if (alpha <= 0.01) return
    const c = this.next('line', color, alpha)
    c.x = x1
    c.y = y1
    c.x2 = x2
    c.y2 = y2
    c.stroke = width
  }

  /** Vertical linear gradient rectangle. */
  grad(top: string, bottom: string, x: number, y: number, w: number, h: number) {
    const c = this.next('grad', top, 1)
    c.color2 = bottom
    c.x = x
    c.y = y
    c.w = w
    c.h = h
  }
}

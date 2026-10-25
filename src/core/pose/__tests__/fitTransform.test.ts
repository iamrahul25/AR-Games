import { stageProjection } from '../fitTransform'

describe('stageProjection', () => {
  it('reports the cropped region for a portrait camera image on a tall phone (cover)', () => {
    const p = stageProjection(3 / 4, { width: 390, height: 844 }, 'cover', false)
    expect(p.unit).toBeCloseTo(844)
    expect(p.visible.top).toBe(0)
    expect(p.visible.bottom).toBe(1)
    expect(p.visible.left).toBeCloseTo((844 * 0.75 - 390) / 2 / (844 * 0.75))
    expect(p.visible.right).toBeCloseTo(1 - p.visible.left)
    expect(p.toView(p.visible.left, 0).x).toBeCloseTo(0)
    expect(p.toView(p.visible.right, 1).x).toBeCloseTo(390)
  })

  it('shows the whole image when containing it', () => {
    const p = stageProjection(3 / 4, { width: 1000, height: 500 }, 'contain', false)
    expect(p.visible).toEqual({ left: 0, right: 1, top: 0, bottom: 1 })
    expect(p.toView(0.5, 0.5)).toEqual({ x: 500, y: 250 })
  })

  it('fromView inverts toView, including mirroring', () => {
    for (const mirror of [false, true]) {
      const p = stageProjection(3 / 4, { width: 390, height: 844 }, 'cover', mirror)
      const v = p.toView(0.3, 0.7)
      const back = p.fromView(v.x, v.y)
      expect(back.x).toBeCloseTo(0.3)
      expect(back.y).toBeCloseTo(0.7)
    }
  })
})

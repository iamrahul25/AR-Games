import { theme } from '@/core/ui/theme'
import { OBSTACLE_SHAPES } from '../config/world'

/** Colours for the runner world. Data-only, so more themes can be added later. */
export interface RunnerPalette {
  skyTop: string
  skyBottom: string
  skylineFar: string
  skylineNear: string
  windows: string
  ground: string
  track: string
  trackStripe: string
  laneLine: string
  rail: string
  hurdle: string
  bar: string
  wall: string
  coin: string
  coinShine: string
  star: string
  shirt: string
  shorts: string
  skin: string
  hair: string
  shoe: string
  shadow: string
  hintBg: string
}

export const CITY_PALETTE: RunnerPalette = {
  skyTop: '#0B1530',
  skyBottom: '#2B4C8C',
  skylineFar: '#1A2C5A',
  skylineNear: '#13224A',
  windows: '#FFD34D',
  ground: '#0E1B3D',
  track: '#2A3A66',
  trackStripe: '#33467A',
  laneLine: '#E8F4FF',
  rail: theme.colors.primary,
  hurdle: OBSTACLE_SHAPES.hurdle.color,
  bar: OBSTACLE_SHAPES.bar.color,
  wall: OBSTACLE_SHAPES.wall.color,
  coin: theme.colors.gold,
  coinShine: '#FFF4C2',
  star: '#FFFFFF',
  shirt: '#2DD4BF',
  shorts: '#1C3A6E',
  skin: '#F2C29B',
  hair: '#3B2A20',
  shoe: '#FFFFFF',
  shadow: '#000000',
  hintBg: '#050A19',
}

/** Lighten (amount > 0) or darken (amount < 0) a #RRGGBB colour. Cached. */
const shadeCache = new Map<string, string>()
export function shade(hex: string, amount: number): string {
  const key = `${hex}|${amount}`
  const hit = shadeCache.get(key)
  if (hit) return hit
  const n = parseInt(hex.slice(1), 16)
  const f = (c: number) => {
    const v = amount >= 0 ? c + (255 - c) * amount : c * (1 + amount)
    return Math.max(0, Math.min(255, Math.round(v)))
  }
  const r = f((n >> 16) & 255)
  const g = f((n >> 8) & 255)
  const b = f(n & 255)
  const out = `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`
  shadeCache.set(key, out)
  return out
}

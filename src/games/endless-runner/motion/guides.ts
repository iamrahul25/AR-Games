import type { GuideLineState, GuideSpec } from '@/core/pose/GuideOverlay'
import { theme } from '@/core/ui/theme'
import type { Calibration } from './calibration'
import type { MotionLines, MotionState } from './motionController'

export const JUMP_LINE_COLOR = theme.colors.warning
export const DUCK_LINE_COLOR = theme.colors.primary

export interface GuideOptions {
  showJump: boolean
  showDuck: boolean
  jumpLabel?: string
}

/**
 * The static part of the camera guides (lanes, lines, edge warning). Markers are attached by
 * the screen as SharedValues so they move at 30 Hz without re-rendering.
 * Returns a stable string key so callers can skip re-renders when nothing visible changed.
 */
export function buildGuideSpec(
  cal: Calibration,
  lines: MotionLines,
  state: MotionState,
  opts: GuideOptions,
): { spec: GuideSpec; key: string } {
  const jumpState: GuideLineState = state.airborne ? 'hit' : state.nearJump ? 'near' : 'idle'
  const duckState: GuideLineState = state.ducking ? 'hit' : 'idle'
  const hLines: NonNullable<GuideSpec['hLines']> = []
  if (opts.showJump) {
    hLines.push({ id: 'jump', y: lines.jumpY, color: JUMP_LINE_COLOR, label: opts.jumpLabel ?? '▲ JUMP', state: jumpState })
  }
  if (opts.showDuck) {
    hLines.push({ id: 'duck', y: lines.duckY, color: DUCK_LINE_COLOR, label: '▼ DUCK', state: duckState })
  }
  const active = state.tracking === 'lost' || !state.hip ? null : state.lane
  const spec: GuideSpec = {
    lanes: { bounds: cal.laneBounds, outer: cal.outer, active, labels: ['L', 'C', 'R'] },
    hLines,
    edgeWarning: state.edge,
  }
  // Lines drift slowly with the baseline; round so tiny moves don't re-render.
  const key = [
    active,
    jumpState,
    duckState,
    state.edge,
    Math.round(lines.jumpY * 200),
    Math.round(lines.duckY * 200),
    cal.laneBounds[0].toFixed(3),
    opts.showJump,
    opts.showDuck,
  ].join('|')
  return { spec, key }
}

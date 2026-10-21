import type { PartStatus } from '@/core/pose/types'

/**
 * Design tokens. All UI reads colors/spacing/radii from here so additional
 * themes can be added later by providing another object of the same shape.
 */
export const theme = {
  colors: {
    background: '#0B1530',
    backgroundDeep: '#070E22',
    surface: '#13224A',
    surfaceGlass: 'rgba(22, 40, 86, 0.78)',
    surfaceBorder: 'rgba(86, 200, 255, 0.35)',
    glow: '#3CC8FF',
    primary: '#3CC8FF',
    primaryDark: '#1C8FD6',
    success: '#3DDC84',
    successDark: '#1FA862',
    warning: '#FFC53D',
    danger: '#FF5D6C',
    text: '#FFFFFF',
    textMuted: '#A8B6D8',
    textDim: '#6B7AA3',
    gold: '#FFD34D',
    overlay: 'rgba(5, 10, 25, 0.72)',
    skeletonNeutral: '#E8F4FF',
    track: 'rgba(255, 255, 255, 0.14)',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  radius: {
    sm: 10,
    md: 16,
    lg: 22,
    xl: 28,
    pill: 999,
  },
  font: {
    title: 28,
    heading: 22,
    body: 16,
    small: 13,
    huge: 44,
  },
} as const

export type Theme = typeof theme

export const PART_STATUS_COLORS: Record<PartStatus, string> = {
  good: theme.colors.success,
  close: theme.colors.warning,
  bad: theme.colors.danger,
  unknown: theme.colors.skeletonNeutral,
}

export const TIER_COLORS = {
  easy: '#3DDC84',
  medium: '#3CC8FF',
  hard: '#FF9F43',
  expert: '#FF5D6C',
} as const

import {
  DEFAULT_SETTINGS,
  PRESET_ORDER,
  PRESETS,
  applyPreset,
  applySettingsChange,
  detectPreset,
  difficultyMultiplier,
  difficultyRating,
  resolveRunConfig,
  summarizeDifficulty,
} from '../config/difficulty'

describe('difficulty presets', () => {
  it.each(PRESET_ORDER)('%s resolves to a valid run config', (id) => {
    const c = resolveRunConfig(PRESETS[id])
    expect(c.startDial).toBeGreaterThanOrEqual(1)
    expect(c.maxDial).toBeGreaterThanOrEqual(c.startDial)
    expect(c.maxDial).toBeLessThanOrEqual(10)
    expect(c.recoveryS).toBeGreaterThanOrEqual(1)
    expect(c.densityGapS).toBeGreaterThanOrEqual(c.recoveryS)
    expect(c.enabledMoves.length).toBeGreaterThan(0)
    expect(c.scoreMultiplier).toBeGreaterThanOrEqual(0.3)
    expect(c.scoreMultiplier).toBeLessThanOrEqual(2)
    expect(detectPreset(PRESETS[id])).toBe(id)
  })

  it('matches the plan table for key values', () => {
    expect(PRESETS.kids.speedDial).toBe(2)
    expect(PRESETS.gentle.moves.jump).toBe(false)
    expect(PRESETS.gentle.jumpStyle).toBe('hands-up')
    expect(PRESETS.athlete.lives).toBe(1)
    expect(resolveRunConfig(PRESETS.gentle).restBreak).toEqual({ everyS: 120, durationS: 20 })
    expect(resolveRunConfig(PRESETS.normal).maxDial).toBe(9)
    expect(resolveRunConfig(PRESETS.kids).rampStepDial).toBe(0)
  })

  it('ratings rise from Kids to Athlete', () => {
    const ratings = PRESET_ORDER.map((id) => difficultyRating(PRESETS[id]))
    expect(ratings[ratings.length - 1]).toBeGreaterThan(ratings[0])
    for (const r of ratings) expect(r).toBeGreaterThanOrEqual(1)
    expect(Math.max(...ratings)).toBeLessThanOrEqual(5)
  })

  it('multipliers stay in range for extreme custom settings', () => {
    const easiest = { ...PRESETS.gentle, lives: 'unlimited' as const, density: 'sparse' as const, moveHints: 'voice' as const }
    const hardest = { ...PRESETS.athlete, speedDial: 10, maxSpeedDial: 10, density: 'dense' as const, grace: 'strict' as const }
    for (const s of [easiest, hardest]) {
      const m = difficultyMultiplier(s)
      expect(m).toBeGreaterThanOrEqual(0.3)
      expect(m).toBeLessThanOrEqual(2)
    }
    expect(difficultyMultiplier(hardest)).toBeGreaterThan(difficultyMultiplier(easiest))
  })
})

describe('editing settings', () => {
  it('any change switches the chip to Custom, keeping the values', () => {
    const s = applySettingsChange(PRESETS.normal, { lives: 5 })
    expect(s.preset).toBe('custom')
    expect(s.lives).toBe(5)
    expect(s.basePreset).toBe('normal')
  })

  it('changing back to preset values re-detects the preset', () => {
    const custom = applySettingsChange(PRESETS.normal, { lives: 5 })
    expect(applySettingsChange(custom, { lives: 3 }).preset).toBe('normal')
  })

  it('constant mode pins max speed to the dial; increasing keeps max ≥ start', () => {
    const constant = applySettingsChange(PRESETS.normal, { speedMode: 'constant' })
    expect(constant.maxSpeedDial).toBe(constant.speedDial)
    const faster = applySettingsChange(PRESETS.normal, { speedDial: 10 })
    expect(faster.maxSpeedDial).toBeGreaterThanOrEqual(10)
  })

  it('at least one move stays enabled', () => {
    const s = applySettingsChange(PRESETS.normal, { moves: { lane: false, jump: false, duck: false } })
    expect(s.moves.lane).toBe(true)
  })

  it('presets apply as copies', () => {
    const a = applyPreset('kids')
    a.speedDial = 9
    expect(PRESETS.kids.speedDial).toBe(2)
  })

  it('summary reads naturally', () => {
    expect(summarizeDifficulty(DEFAULT_SETTINGS)).toBe('Normal · Speed 5 → 9 · Increasing · 3 lives · All moves')
    expect(summarizeDifficulty(PRESETS.gentle)).toContain('Lanes + Duck')
  })
})

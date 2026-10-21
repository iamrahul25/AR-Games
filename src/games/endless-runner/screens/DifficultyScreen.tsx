import { router } from 'expo-router'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'

import { Button } from '@/core/ui/Button'
import { Screen } from '@/core/ui/Screen'
import { ScreenHeader } from '@/core/ui/ScreenHeader'
import { SegmentedToggle } from '@/core/ui/SegmentedToggle'
import { Stepper } from '@/core/ui/Stepper'
import { theme } from '@/core/ui/theme'
import { OptionGroup, OptionRow } from '../components/OptionGroup'
import { PresetChips } from '../components/PresetChips'
import { SpeedDial } from '../components/SpeedDial'
import {
  MAX_DIAL,
  applyPreset,
  applySettingsChange,
  defaultMaxDial,
  dialLabel,
  difficultyMultiplier,
  difficultyRating,
  ratingStars,
  summarizeDifficulty,
} from '../config/difficulty'
import { RUNNER_ROUTES } from '../routes'
import { useRunnerStore } from '../store/runnerStore'
import type { DifficultySettings, MoveKind, SessionLength } from '../types'

type SessionKey = 'endless' | 't1' | 't3' | 't5' | 't10' | 't15' | 'd500' | 'd1000' | 'd2000'

function sessionKey(s: SessionLength): SessionKey {
  if (s.kind === 'timed') return `t${s.minutes}` as SessionKey
  if (s.kind === 'distance') return `d${s.meters}` as SessionKey
  return 'endless'
}

function sessionFromKey(k: SessionKey): SessionLength {
  if (k === 'endless') return { kind: 'endless' }
  if (k.startsWith('t')) return { kind: 'timed', minutes: Number(k.slice(1)) as 1 | 3 | 5 | 10 | 15 }
  return { kind: 'distance', meters: Number(k.slice(1)) as 500 | 1000 | 2000 }
}

const MOVE_LABELS: Record<MoveKind, string> = { lane: '◀▶ Lanes', jump: '▲ Jump', duck: '▼ Duck' }

export function DifficultyScreen() {
  const s = useRunnerStore((st) => st.settings)
  const setSettings = useRunnerStore((st) => st.setSettings)
  const update = (patch: Partial<DifficultySettings>) => setSettings(applySettingsChange(s, patch))
  const increasing = s.speedMode === 'increasing'
  const timed = s.session.kind === 'timed'

  const back = () => (router.canGoBack() ? router.back() : router.replace(RUNNER_ROUTES.home as never))

  return (
    <Screen scroll contentStyle={styles.content}>
      <ScreenHeader title="Difficulty" subtitle={summarizeDifficulty(s)} onBack={back} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Presets</Text>
        <PresetChips value={s.preset} onSelect={(id) => setSettings(applyPreset(id))} />
      </View>

      <View style={styles.dial}>
        <SpeedDial
          value={s.speedDial}
          label="Start speed"
          maxMarker={increasing ? s.maxSpeedDial : undefined}
          onChange={(v) => update({ speedDial: v, ...(increasing && s.maxSpeedDial < v ? { maxSpeedDial: v } : {}) })}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Speed mode</Text>
        <SegmentedToggle
          size="large"
          accessibilityLabel="Speed mode"
          value={s.speedMode}
          options={[
            { value: 'constant', label: 'Constant' },
            { value: 'increasing', label: 'Increasing' },
          ]}
          onChange={(mode) => update({ speedMode: mode, maxSpeedDial: mode === 'increasing' ? defaultMaxDial(s.speedDial) : s.speedDial })}
        />
        <Text style={styles.help}>
          {increasing
            ? 'Increasing — starts at your speed and steps up with a “Speed up!” banner.'
            : 'Constant — same speed all run. Great for practice & fitness.'}
        </Text>
        {increasing && (
          <View style={styles.sub}>
            <OptionRow label="Ramp" help="How quickly it gets faster">
              <SegmentedToggle
                value={s.ramp}
                options={[
                  { value: 'gentle', label: 'Gentle' },
                  { value: 'normal', label: 'Normal' },
                  { value: 'steep', label: 'Steep' },
                ]}
                onChange={(ramp) => update({ ramp })}
              />
            </OptionRow>
            <OptionRow label="Max speed" help={`Stops getting faster at ${dialLabel(s.maxSpeedDial)}`}>
              <Stepper label="Max speed" value={s.maxSpeedDial} min={s.speedDial} max={MAX_DIAL} onChange={(v) => update({ maxSpeedDial: v })} />
            </OptionRow>
          </View>
        )}
      </View>

      <OptionGroup title="More options">
        <Text style={styles.groupTitle}>Moves</Text>
        <OptionRow label="Enabled moves" help="Obstacles only ask for the moves you turn on. “Lanes only” means no jumping.">
          <View style={styles.chips}>
            {(Object.keys(MOVE_LABELS) as MoveKind[]).map((m) => {
              const on = s.moves[m]
              const onlyOne = on && Object.values(s.moves).filter(Boolean).length === 1
              return (
                <Pressable
                  key={m}
                  accessibilityRole="checkbox"
                  accessibilityLabel={MOVE_LABELS[m]}
                  accessibilityState={{ checked: on, disabled: onlyOne }}
                  disabled={onlyOne}
                  onPress={() => update({ moves: { ...s.moves, [m]: !on } })}
                  style={[styles.chip, on && styles.chipOn]}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>
                    {on ? '☑' : '☐'} {MOVE_LABELS[m]}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </OptionRow>
        <OptionRow label="Jump style" help="Low impact: raise both hands above the yellow line instead of jumping.">
          <SegmentedToggle
            value={s.jumpStyle}
            options={[
              { value: 'jump', label: 'Real jump' },
              { value: 'hands-up', label: 'Low impact (hands up)' },
            ]}
            onChange={(jumpStyle) => update({ jumpStyle })}
          />
        </OptionRow>
        <OptionRow label="Duck style" help="Knees only: you must bend your knees (squat); bowing your head won’t count.">
          <SegmentedToggle
            value={s.duckStyle}
            options={[
              { value: 'head', label: 'Head (any)' },
              { value: 'squat', label: 'Knees only' },
            ]}
            onChange={(duckStyle) => update({ duckStyle })}
          />
        </OptionRow>
        <OptionRow label="Seated mode" help="Play sitting down: lean to change lanes, raise hands to jump, bow your head to duck.">
          <SegmentedToggle
            value={s.seatedMode ? 'on' : 'off'}
            options={[
              { value: 'off', label: 'Off' },
              { value: 'on', label: 'On' },
            ]}
            onChange={(v) => update(v === 'on' ? { seatedMode: true, jumpStyle: 'hands-up', duckStyle: 'head' } : { seatedMode: false })}
          />
        </OptionRow>

        <Text style={styles.groupTitle}>Sensitivity</Text>
        <OptionRow label="Jump line height" help="How high your head must go to count as a jump.">
          <SegmentedToggle
            value={s.jumpLine}
            options={[
              { value: 'low', label: 'Low' },
              { value: 'normal', label: 'Normal' },
              { value: 'high', label: 'High' },
            ]}
            onChange={(jumpLine) => update({ jumpLine })}
          />
        </OptionRow>
        <OptionRow label="Duck line depth" help="How low your head must go to count as a duck.">
          <SegmentedToggle
            value={s.duckLine}
            options={[
              { value: 'low', label: 'Shallow' },
              { value: 'normal', label: 'Normal' },
              { value: 'high', label: 'Deep' },
            ]}
            onChange={(duckLine) => update({ duckLine })}
          />
        </OptionRow>
        <OptionRow label="Lane width" help="How big a step changes lanes.">
          <SegmentedToggle
            value={s.laneWidth}
            options={[
              { value: 'narrow', label: 'Narrow' },
              { value: 'normal', label: 'Normal' },
              { value: 'wide', label: 'Wide' },
            ]}
            onChange={(laneWidth) => update({ laneWidth })}
          />
        </OptionRow>

        <Text style={styles.groupTitle}>Challenge</Text>
        <OptionRow label="Obstacle density" help="Time between obstacles: 3 s / 2 s / 1.4 s.">
          <SegmentedToggle
            value={s.density}
            options={[
              { value: 'sparse', label: 'Sparse' },
              { value: 'normal', label: 'Normal' },
              { value: 'dense', label: 'Dense' },
            ]}
            onChange={(density) => update({ density })}
          />
        </OptionRow>
        <OptionRow label="Patterns" help="Mixed adds combos like “change lane, then jump”.">
          <SegmentedToggle
            value={s.patterns}
            options={[
              { value: 'simple', label: 'Simple' },
              { value: 'mixed', label: 'Mixed' },
            ]}
            onChange={(patterns) => update({ patterns })}
          />
        </OptionRow>
        <OptionRow label="Lives" help="Unlimited is practice mode: you never get a game over.">
          <SegmentedToggle
            value={String(s.lives) as '1' | '3' | '5' | 'unlimited'}
            options={[
              { value: '1', label: '1' },
              { value: '3', label: '3' },
              { value: '5', label: '5' },
              { value: 'unlimited', label: 'Unlimited' },
            ]}
            onChange={(v) => update({ lives: v === 'unlimited' ? 'unlimited' : (Number(v) as 1 | 3 | 5) })}
          />
        </OptionRow>
        <OptionRow label="Reaction grace" help="Extra time for a move that comes just a little late.">
          <SegmentedToggle
            value={s.grace}
            options={[
              { value: 'generous', label: 'Generous' },
              { value: 'normal', label: 'Normal' },
              { value: 'strict', label: 'Strict' },
            ]}
            onChange={(grace) => update({ grace })}
          />
        </OptionRow>

        <Text style={styles.groupTitle}>Session</Text>
        <OptionRow label="Run length" help="Timed runs are workouts: “Workout complete!” at the end.">
          <SegmentedToggle
            value={sessionKey(s.session)}
            options={[
              { value: 'endless', label: 'Endless' },
              { value: 't1', label: '1 min' },
              { value: 't3', label: '3 min' },
              { value: 't5', label: '5 min' },
              { value: 't10', label: '10 min' },
              { value: 't15', label: '15 min' },
              { value: 'd500', label: '500 m' },
              { value: 'd1000', label: '1 km' },
              { value: 'd2000', label: '2 km' },
            ]}
            onChange={(k) => update({ session: sessionFromKey(k) })}
          />
        </OptionRow>
        {timed && (
          <OptionRow label="Rest breaks" help="A 20 s breather: the track empties.">
            <SegmentedToggle
              value={String(s.restBreakEveryMin) as '0' | '2' | '3' | '5'}
              options={[
                { value: '0', label: 'Off' },
                { value: '2', label: 'Every 2 min' },
                { value: '3', label: 'Every 3 min' },
                { value: '5', label: 'Every 5 min' },
              ]}
              onChange={(v) => update({ restBreakEveryMin: Number(v) as 0 | 2 | 3 | 5 })}
            />
          </OptionRow>
        )}

        <Text style={styles.groupTitle}>Assists</Text>
        <OptionRow label="Move hints" help="Icons above obstacles, optionally spoken (“Jump!”).">
          <SegmentedToggle
            value={s.moveHints}
            options={[
              { value: 'off', label: 'Off' },
              { value: 'icons', label: 'Icons' },
              { value: 'voice', label: 'Icons + voice' },
            ]}
            onChange={(moveHints) => update({ moveHints })}
          />
        </OptionRow>
        <OptionRow label="Coins show the safe lane" help="Lines of coins lead you through the gap.">
          <SegmentedToggle
            value={s.coinsShowSafeLane ? 'on' : 'off'}
            options={[
              { value: 'off', label: 'Off' },
              { value: 'on', label: 'On' },
            ]}
            onChange={(v) => update({ coinsShowSafeLane: v === 'on' })}
          />
        </OptionRow>
      </OptionGroup>

      <View style={styles.footer}>
        <Text style={styles.rating}>
          Difficulty <Text style={styles.stars}>{ratingStars(difficultyRating(s))}</Text> · Score ×{difficultyMultiplier(s).toFixed(1)}
        </Text>
        <View style={styles.row}>
          <Button label="Done" variant="secondary" onPress={back} style={styles.flex} />
          <Button label="Play ▶" onPress={() => router.replace(RUNNER_ROUTES.play as never)} style={styles.flex} />
        </View>
        {Platform.OS === 'web' && <Text style={styles.help}>Tip: on a computer you can also play with the arrow keys (turn it on in Settings).</Text>}
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { maxWidth: 680, gap: theme.spacing.lg },
  section: { gap: theme.spacing.sm },
  sectionTitle: { color: theme.colors.text, fontSize: theme.font.heading, fontWeight: '900' },
  dial: { alignItems: 'center', paddingVertical: theme.spacing.sm },
  help: { color: theme.colors.textMuted, fontSize: theme.font.small, lineHeight: 18 },
  sub: { gap: theme.spacing.md, marginTop: theme.spacing.sm, paddingLeft: theme.spacing.md, borderLeftWidth: 2, borderLeftColor: theme.colors.surfaceBorder },
  groupTitle: { color: theme.colors.primary, fontWeight: '900', fontSize: theme.font.small, textTransform: 'uppercase', letterSpacing: 1, marginTop: theme.spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
  },
  chipOn: { backgroundColor: theme.colors.primaryDark, borderColor: theme.colors.primary },
  chipText: { color: theme.colors.textMuted, fontWeight: '800' },
  chipTextOn: { color: theme.colors.text },
  footer: { gap: theme.spacing.md, paddingBottom: theme.spacing.xl },
  rating: { color: theme.colors.text, fontWeight: '800', fontSize: theme.font.body, textAlign: 'center' },
  stars: { color: theme.colors.gold, letterSpacing: 2 },
  row: { flexDirection: 'row', gap: theme.spacing.sm },
  flex: { flex: 1 },
})

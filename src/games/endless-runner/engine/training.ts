import type { MotionEvent, MotionState } from '../motion/motionController'
import type { Lane, MoveKind, ObstacleType, RunConfig } from '../types'
import type { RunnerSim, SimEvent } from './sim'

export type TrainingStepId = 'left' | 'center1' | 'right' | 'center2' | 'jump' | 'duck' | 'practice'

export type AutoTune = 'jump-line-low' | 'duck-line-shallow' | 'lane-narrow'

export interface TrainingStep {
  id: TrainingStepId
  /** On-screen prompt; **bold** parts are rendered highlighted. */
  prompt: string
  voice: string
  hint?: string
  /** Lane zone to pulse on the camera guides. */
  pulseLane?: Lane
  autoTune?: AutoTune
}

export const HINT_AFTER_MS = 8000
const AUTO_TUNE_AFTER_HINTS = 3

const STEPS: (TrainingStep & { needs: MoveKind })[] = [
  { id: 'left', needs: 'lane', prompt: 'Hop to your **LEFT** lane', voice: 'Hop to your left lane', hint: 'Take a bigger step to the left', pulseLane: -1, autoTune: 'lane-narrow' },
  { id: 'center1', needs: 'lane', prompt: 'Now hop back to the **MIDDLE**', voice: 'Now hop back to the middle', pulseLane: 0 },
  { id: 'right', needs: 'lane', prompt: 'Hop to your **RIGHT** lane', voice: 'Hop to your right lane', hint: 'Take a bigger step to the right', pulseLane: 1, autoTune: 'lane-narrow' },
  { id: 'center2', needs: 'lane', prompt: 'Back to the **MIDDLE**', voice: 'Back to the middle', pulseLane: 0 },
  { id: 'jump', needs: 'jump', prompt: '**JUMP!** Get your head above the yellow line', voice: 'Jump! Get your head above the yellow line', hint: "Jump a little higher — or choose 'Jump line: Low' in Difficulty", autoTune: 'jump-line-low' },
  { id: 'duck', needs: 'duck', prompt: '**DUCK!** Get your head below the blue line', voice: 'Duck! Get your head below the blue line', hint: 'Bend your knees more', autoTune: 'duck-line-shallow' },
]

export function trainingSteps(enabledMoves: readonly MoveKind[], jumpStyle: RunConfig['jumpStyle']): TrainingStep[] {
  const steps: TrainingStep[] = STEPS.filter((s) => enabledMoves.includes(s.needs)).map(({ needs: _needs, ...s }) =>
    s.id === 'jump' && jumpStyle === 'hands-up'
      ? { ...s, prompt: '**JUMP!** Raise both hands above the yellow line', voice: 'Raise both hands above the yellow line', hint: 'Reach both hands up high' }
      : s,
  )
  steps.push({ id: 'practice', prompt: 'Try it for real!', voice: 'Try it for real!' })
  return steps
}

export type TrainingEvent =
  | { type: 'step'; step: TrainingStep; index: number }
  | { type: 'success'; step: TrainingStep }
  | { type: 'hint'; text: string; count: number }
  | { type: 'auto-tune'; fix: AutoTune }
  | { type: 'done' }

/** The interactive tutorial (§14): try each move until it registers, then a short practice. */
export class TrainingFlow {
  readonly steps: TrainingStep[]
  index = 0
  hints = 0
  done = false
  private stepStart = 0
  private lastHintAt = 0
  private autoTuneOffered = new Set<AutoTune>()

  constructor(enabledMoves: readonly MoveKind[], jumpStyle: RunConfig['jumpStyle']) {
    this.steps = trainingSteps(enabledMoves, jumpStyle)
  }

  get current(): TrainingStep {
    return this.steps[Math.min(this.index, this.steps.length - 1)]
  }

  start(now: number): TrainingEvent[] {
    this.index = 0
    this.done = false
    this.beginStep(now)
    return [{ type: 'step', step: this.current, index: 0 }]
  }

  private beginStep(now: number) {
    this.stepStart = now
    this.lastHintAt = now
    this.hints = 0
  }

  private advance(now: number): TrainingEvent[] {
    const ev: TrainingEvent[] = [{ type: 'success', step: this.current }]
    this.index++
    if (this.index >= this.steps.length) {
      this.done = true
      ev.push({ type: 'done' })
      return ev
    }
    this.beginStep(now)
    ev.push({ type: 'step', step: this.current, index: this.index })
    return ev
  }

  onMotion(events: readonly MotionEvent[], state: MotionState, now: number): TrainingEvent[] {
    if (this.done) return []
    const step = this.current
    let ok = false
    switch (step.id) {
      case 'left':
        ok = state.lane === -1
        break
      case 'right':
        ok = state.lane === 1
        break
      case 'center1':
      case 'center2':
        ok = state.lane === 0
        break
      case 'jump':
        ok = events.some((e) => e.type === 'jump')
        break
      case 'duck':
        ok = events.some((e) => e.type === 'duck-start')
        break
    }
    return ok ? this.advance(now) : []
  }

  /** Practice finished (all practice obstacles passed). */
  practiceDone(now: number): TrainingEvent[] {
    if (this.done || this.current.id !== 'practice') return []
    return this.advance(now)
  }

  update(now: number): TrainingEvent[] {
    if (this.done) return []
    const step = this.current
    if (!step.hint || now - this.lastHintAt < HINT_AFTER_MS) return []
    this.lastHintAt = now
    this.hints++
    const ev: TrainingEvent[] = [{ type: 'hint', text: step.hint, count: this.hints }]
    if (step.autoTune && this.hints > AUTO_TUNE_AFTER_HINTS - 1 && !this.autoTuneOffered.has(step.autoTune)) {
      this.autoTuneOffered.add(step.autoTune)
      ev.push({ type: 'auto-tune', fix: step.autoTune })
    }
    return ev
  }

  skip(now: number): TrainingEvent[] {
    if (this.done) return []
    this.index = this.steps.length - 1
    return this.advance(now)
  }
}

/** Training practice: one slow obstacle of each enabled kind; a hit just re-sends the same one. */
export class PracticeCourse {
  readonly items: { type: ObstacleType; lanes: Lane[] }[]
  index = 0
  private row: number | null = null

  constructor(
    private sim: RunnerSim,
    enabledMoves: readonly MoveKind[],
    private aheadM = 28,
  ) {
    const all: { type: ObstacleType; lanes: Lane[]; needs: MoveKind }[] = [
      { type: 'wall', lanes: [0], needs: 'lane' },
      { type: 'hurdle', lanes: [-1, 0, 1], needs: 'jump' },
      { type: 'bar', lanes: [-1, 0, 1], needs: 'duck' },
    ]
    this.items = all.filter((i) => enabledMoves.includes(i.needs)).map(({ needs: _n, ...i }) => i)
  }

  get done() {
    return this.index >= this.items.length
  }

  start() {
    this.index = 0
    this.spawn()
  }

  private spawn() {
    const item = this.items[this.index]
    this.row = item ? this.sim.spawnRow(item.type, item.lanes, this.aheadM) : null
  }

  /** Feed the practice sim's events; returns true once every obstacle has been passed. */
  onSimEvents(events: readonly SimEvent[]): boolean {
    for (const e of events) {
      if (e.type === 'cleared' && e.row === this.row) {
        this.index++
        this.spawn()
      } else if (e.type === 'hit' && e.row === this.row) {
        this.spawn()
      }
    }
    return this.done
  }
}

/** Slow, forgiving engine settings for the training practice. */
export function practiceConfig(config: RunConfig): RunConfig {
  return {
    ...config,
    startDial: 1,
    maxDial: 1,
    rampStepDial: 0,
    rampEveryS: 0,
    livesMax: null,
    graceMs: 250,
    moveHints: 'voice',
    sessionLimit: {},
    restBreak: null,
  }
}

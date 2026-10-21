import { checkFraming, type FramingResult } from '@/core/pose/framing'
import type { PoseFrame } from '@/core/pose/types'
import type { LevelDefinition, MatchResult, PoseDefinition, PoseOutcome } from '../types'
import { coachingCue } from './feedback'
import { HoldTracker } from './holdStateMachine'
import { compilePose, emptyMatchResult, matchPose, type CompiledPose } from './poseMatcher'
import { posePoints, ratingForAccuracy, summarizeAttempts, summarizeLevel, type LevelSummary } from './scoring'

export type RunnerPhase = 'get-ready' | 'countdown' | 'posing' | 'pose-result' | 'finished'

export type RunnerEvent =
  | { type: 'countdown-tick'; value: number }
  | { type: 'go' }
  | { type: 'pose-start'; pose: PoseDefinition }
  | { type: 'hold-start' }
  | { type: 'hold-break' }
  | { type: 'pose-success'; outcome: PoseOutcome }
  | { type: 'pose-miss'; outcome: PoseOutcome }
  | { type: 'level-complete'; summary: LevelSummary }
  | { type: 'cue'; text: string }

export interface RunnerSnapshot {
  phase: RunnerPhase
  poseIndex: number
  poseCount: number
  pose: PoseDefinition
  nextPose: PoseDefinition | null
  timeLeftMs: number
  timeLimitMs: number
  holdProgress: number
  holding: boolean
  match: MatchResult
  cue: string | null
  framing: FramingResult
  countdown: number
  lastOutcome: PoseOutcome | null
  outcomes: PoseOutcome[]
  score: number
  summary: LevelSummary | null
  paused: boolean
}

export interface LevelRunnerOptions {
  /** How long the player must be correctly framed before the countdown starts. */
  readyHoldMs?: number
  countdownSeconds?: number
  /** How long the rating ("Great!") shows between poses. */
  resultMs?: number
  /** Grace period before a dropped hold counts as broken. */
  holdGraceMs?: number
}

/**
 * Drives one play-through of a level: framing check → 3-2-1 → each pose
 * (time limit + hold) → summary. Pure logic: feed it `update(now, frame)`.
 */
export class LevelRunner {
  private phase: RunnerPhase = 'get-ready'
  private phaseStartedAt: number | undefined
  private framedSince: number | null = null
  private poseIndex = 0
  private compiled: CompiledPose[]
  private hold: HoldTracker
  private match: MatchResult = emptyMatchResult()
  private bestScore = 0
  private cue: string | null = null
  private framing: FramingResult = checkFraming(null)
  private countdown = 0
  private lastCountdownTick = -1
  private outcomes: PoseOutcome[] = []
  private summary: LevelSummary | null = null
  private pausedAt: number | null = null
  private timeLeftMs: number
  private readonly poses: PoseDefinition[]

  private readonly readyHoldMs: number
  private readonly countdownSeconds: number
  private readonly resultMs: number
  private readonly holdGraceMs: number

  constructor(
    private readonly level: LevelDefinition,
    poses: PoseDefinition[],
    options: LevelRunnerOptions = {},
  ) {
    if (poses.length === 0) throw new Error(`Level ${level.id} has no poses`)
    this.poses = level.attempts ? Array.from({ length: level.attempts }, () => poses[0]) : poses
    this.readyHoldMs = options.readyHoldMs ?? 1000
    this.countdownSeconds = options.countdownSeconds ?? 3
    this.resultMs = options.resultMs ?? 1600
    this.holdGraceMs = options.holdGraceMs ?? 400
    this.compiled = this.poses.map(compilePose)
    this.hold = this.newHoldTracker()
    this.timeLeftMs = level.timeLimitSeconds * 1000
  }

  private newHoldTracker() {
    return new HoldTracker({
      holdMs: this.level.holdSeconds * 1000,
      enterThreshold: this.level.matchThreshold,
      exitThreshold: this.level.matchThreshold - 0.08,
      graceMs: this.holdGraceMs,
      breakBehavior: this.level.holdBreakBehavior,
    })
  }

  private enter(phase: RunnerPhase, now: number) {
    this.phase = phase
    this.phaseStartedAt = now
  }

  pause(now: number) {
    if (this.pausedAt === null && this.phase !== 'finished') this.pausedAt = now
  }

  resume(now: number) {
    if (this.pausedAt === null) return
    const pausedFor = now - this.pausedAt
    if (this.phaseStartedAt !== undefined) this.phaseStartedAt += pausedFor
    this.pausedAt = null
    this.hold.resetClock()
  }

  get isPaused() {
    return this.pausedAt !== null
  }

  update(now: number, frame: PoseFrame | null): RunnerEvent[] {
    if (this.pausedAt !== null || this.phase === 'finished') return []
    if (this.phaseStartedAt === undefined) this.phaseStartedAt = now
    const events: RunnerEvent[] = []
    const elapsed = now - this.phaseStartedAt

    switch (this.phase) {
      case 'get-ready': {
        this.framing = checkFraming(frame)
        if (this.framing.ok) {
          this.framedSince ??= now
          if (now - this.framedSince >= this.readyHoldMs) {
            this.enter('countdown', now)
            this.lastCountdownTick = -1
          }
        } else {
          this.framedSince = null
        }
        break
      }
      case 'countdown': {
        const remaining = this.countdownSeconds - Math.floor(elapsed / 1000)
        if (remaining <= 0) {
          this.startPose(now, events)
          events.unshift({ type: 'go' })
        } else if (remaining !== this.lastCountdownTick) {
          this.lastCountdownTick = remaining
          this.countdown = remaining
          events.push({ type: 'countdown-tick', value: remaining })
        }
        break
      }
      case 'posing': {
        const limitMs = this.level.timeLimitSeconds * 1000
        this.timeLeftMs = Math.max(0, limitMs - elapsed)
        this.match = frame
          ? matchPose(this.compiled[this.poseIndex], frame, this.level.toleranceScale)
          : emptyMatchResult()
        this.bestScore = Math.max(this.bestScore, this.match.score)

        const holdEvent = this.hold.update(now, this.match.score)
        if (holdEvent === 'hold-start') events.push({ type: 'hold-start' })
        if (holdEvent === 'hold-break') events.push({ type: 'hold-break' })

        if (holdEvent === 'hold-complete') {
          const accuracy = this.hold.accuracy
          const outcome: PoseOutcome = {
            poseId: this.poses[this.poseIndex].id,
            matched: true,
            accuracy,
            points: posePoints(accuracy, this.poses[this.poseIndex].difficulty, this.timeLeftMs, limitMs),
            rating: ratingForAccuracy(accuracy),
            timeUsedMs: elapsed,
          }
          this.finishPose(outcome, now)
          events.push({ type: 'pose-success', outcome })
          break
        }

        if (this.timeLeftMs <= 0) {
          const outcome: PoseOutcome = {
            poseId: this.poses[this.poseIndex].id,
            matched: false,
            accuracy: this.bestScore,
            points: 0,
            rating: 'miss',
            timeUsedMs: limitMs,
          }
          this.finishPose(outcome, now)
          events.push({ type: 'pose-miss', outcome })
          break
        }

        const nextCue = !frame
          ? 'Step back into view'
          : this.hold.state === 'holding'
            ? null
            : coachingCue(this.match)
        if (nextCue && nextCue !== this.cue) events.push({ type: 'cue', text: nextCue })
        this.cue = nextCue
        break
      }
      case 'pose-result': {
        if (elapsed >= this.resultMs) {
          const attemptDone = !!this.level.attempts && !!this.outcomes[this.outcomes.length - 1]?.matched
          if (!attemptDone && this.poseIndex + 1 < this.poses.length) {
            this.poseIndex += 1
            this.startPose(now, events)
          } else {
            this.summary = this.level.attempts
              ? summarizeAttempts(this.outcomes)
              : summarizeLevel(this.outcomes, this.level.passRatio)
            this.enter('finished', now)
            events.push({ type: 'level-complete', summary: this.summary })
          }
        }
        break
      }
    }
    return events
  }

  private startPose(now: number, events: RunnerEvent[]) {
    this.enter('posing', now)
    this.hold = this.newHoldTracker()
    this.match = emptyMatchResult()
    this.bestScore = 0
    this.cue = null
    this.timeLeftMs = this.level.timeLimitSeconds * 1000
    events.push({ type: 'pose-start', pose: this.poses[this.poseIndex] })
  }

  private finishPose(outcome: PoseOutcome, now: number) {
    this.outcomes.push(outcome)
    this.cue = null
    this.enter('pose-result', now)
  }

  snapshot(): RunnerSnapshot {
    const pose = this.poses[this.poseIndex]
    return {
      phase: this.phase,
      poseIndex: this.poseIndex,
      poseCount: this.poses.length,
      pose,
      nextPose: this.poses[this.poseIndex + 1] ?? null,
      timeLeftMs: this.timeLeftMs,
      timeLimitMs: this.level.timeLimitSeconds * 1000,
      holdProgress:
        this.phase === 'pose-result' && this.outcomes[this.outcomes.length - 1]?.matched ? 1 : this.hold.progress,
      holding: this.hold.state === 'holding',
      match: this.match,
      cue: this.cue,
      framing: this.framing,
      countdown: this.countdown,
      lastOutcome: this.outcomes[this.outcomes.length - 1] ?? null,
      outcomes: [...this.outcomes],
      score: this.outcomes.reduce((sum, o) => sum + o.points, 0),
      summary: this.summary,
      paused: this.pausedAt !== null,
    }
  }
}

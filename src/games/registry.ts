import { endlessRunnerManifest } from './endless-runner/manifest'
import { matchPoseManifest } from './match-pose/manifest'
import type { GameManifest } from './types'

export const GAMES: GameManifest[] = [matchPoseManifest, endlessRunnerManifest]

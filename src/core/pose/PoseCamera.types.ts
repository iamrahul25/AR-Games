import type { StyleProp, ViewStyle } from 'react-native'
import type { FitMode } from './fitTransform'
import type { SimulatorTarget } from './simulator'
import type { BodyPart, CameraFacing, PoseCameraStatus, PoseFrame, PoseModelQuality } from './types'

export type PartColors = Partial<Record<BodyPart, string>>

export interface PoseCameraProps {
  facing: CameraFacing
  model: PoseModelQuality
  isActive: boolean
  showSkeleton?: boolean
  /** Bone/joint color per body part (e.g. green when matched). */
  partColors?: PartColors
  /**
   * Called every `emitIntervalMs` on the JS thread with the latest pose in
   * canonical (mirror-view) space, or `null` when no person is detected.
   */
  onPose: (frame: PoseFrame | null) => void
  onStatus?: (status: PoseCameraStatus, message?: string) => void
  /** `cover` crops the preview to fill the view; `contain` shows the whole frame. Default `cover`. */
  resizeMode?: FitMode
  /** Minimum time between pose deliveries. Default {@linkcode POSE_EMIT_INTERVAL_MS}. */
  emitIntervalMs?: number
  style?: StyleProp<ViewStyle>
}

export interface SimulatedPoseCameraProps extends Omit<PoseCameraProps, 'facing' | 'model'> {
  /** The pose the simulated player should move toward (neutral standing when null). */
  target: SimulatorTarget | null
  /** Called before every simulated frame; overrides `target` (e.g. a game's demo bot). */
  driver?: (now: number) => SimulatorTarget | null
}

/** How often pose frames are delivered to the JS thread. */
export const POSE_EMIT_INTERVAL_MS = 66

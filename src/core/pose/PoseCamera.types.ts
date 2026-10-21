import type { StyleProp, ViewStyle } from 'react-native'
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
   * Called ~15 times per second on the JS thread with the latest pose in
   * canonical (mirror-view) space, or `null` when no person is detected.
   */
  onPose: (frame: PoseFrame | null) => void
  onStatus?: (status: PoseCameraStatus, message?: string) => void
  style?: StyleProp<ViewStyle>
}

export interface SimulatedPoseCameraProps extends Omit<PoseCameraProps, 'facing' | 'model'> {
  /** The pose the simulated player should move toward (neutral standing when null). */
  target: SimulatorTarget | null
}

/** How often pose frames are delivered to the JS thread. */
export const POSE_EMIT_INTERVAL_MS = 66

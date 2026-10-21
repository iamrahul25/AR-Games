import type { StyleProp, ViewStyle } from 'react-native'
import type { DrawList } from './drawList'

export interface RunnerCanvasProps {
  style?: StyleProp<ViewStyle>
  /**
   * Called every animation frame with the canvas size in px. Fill `list` and return true to
   * redraw, or false to keep the previous frame.
   */
  onFrame: (now: number, list: DrawList, width: number, height: number) => boolean
  /** Stops the frame loop (e.g. while a full-screen overlay hides the game). */
  paused?: boolean
}

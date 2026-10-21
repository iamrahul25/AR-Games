import * as Device from 'expo-device'
import { Platform } from 'react-native'

import type { ModelQualitySetting } from '@/core/settings/settingsStore'
import type { PoseModelQuality } from './types'

const HIGH_END_MEMORY_BYTES = 6 * 1024 ** 3

/** Picks the pose model: `full` only on capable native devices unless the user overrides it. */
export function resolvePoseModel(setting: ModelQualitySetting): PoseModelQuality {
  if (setting === 'battery-saver') return 'lite'
  if (setting === 'high-accuracy') return 'full'
  if (Platform.OS === 'web') return 'lite'
  const memory = Device.totalMemory ?? 0
  return memory >= HIGH_END_MEMORY_BYTES ? 'full' : 'lite'
}

import * as Haptics from 'expo-haptics'
import { Platform } from 'react-native'

import { useSettings } from '@/core/settings/settingsStore'

function enabled() {
  return Platform.OS !== 'web' && useSettings.getState().hapticsEnabled
}

export const haptics = {
  light() {
    if (enabled()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
  },
  success() {
    if (enabled()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
  },
  error() {
    if (enabled()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
  },
}

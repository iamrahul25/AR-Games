import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import type { CameraFacing } from '@/core/pose/types'
import { kvStorage } from '@/core/storage/kv'

export type ModelQualitySetting = 'auto' | 'battery-saver' | 'high-accuracy'

export interface SettingsState {
  cameraFacing: CameraFacing
  modelQuality: ModelQualitySetting
  soundEnabled: boolean
  voiceEnabled: boolean
  hapticsEnabled: boolean
  showSkeleton: boolean
  hideExpertLevels: boolean
  /** Play with a simulated player instead of the camera. */
  demoMode: boolean
  onboardingDone: boolean
  safetyAcknowledged: boolean
  set: (patch: Partial<Omit<SettingsState, 'set'>>) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      cameraFacing: 'front',
      modelQuality: 'auto',
      soundEnabled: true,
      voiceEnabled: true,
      hapticsEnabled: true,
      showSkeleton: true,
      hideExpertLevels: false,
      demoMode: false,
      onboardingDone: false,
      safetyAcknowledged: false,
      set: (patch) => set(patch),
    }),
    {
      name: 'settings',
      version: 1,
      storage: createJSONStorage(() => kvStorage),
      partialize: ({ set: _set, ...rest }) => rest,
    },
  ),
)

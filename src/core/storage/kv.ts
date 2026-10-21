import { createMMKV } from 'react-native-mmkv'
import type { StateStorage } from 'zustand/middleware'

// MMKV on iOS/Android, localStorage-backed MMKV shim on web.
const mmkv = createMMKV({ id: 'ar-games' })

export const kvStorage: StateStorage = {
  getItem: (key) => mmkv.getString(key) ?? null,
  setItem: (key, value) => mmkv.set(key, value),
  removeItem: (key) => {
    mmkv.remove(key)
  },
}

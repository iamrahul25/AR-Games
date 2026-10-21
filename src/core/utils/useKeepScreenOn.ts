import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { useEffect } from 'react'

/**
 * Keeps the screen on while mounted. Unlike `useKeepAwake`, never throws when the
 * browser refuses the wake lock (e.g. hidden tab or no permission).
 */
export function useKeepScreenOn(tag = 'ar-games-play') {
  useEffect(() => {
    let active = false
    let unmounted = false
    activateKeepAwakeAsync(tag)
      .then(() => {
        active = true
        if (unmounted) release()
      })
      .catch(() => {})
    function release() {
      try {
        Promise.resolve(deactivateKeepAwake(tag)).catch(() => {})
      } catch {}
    }
    return () => {
      unmounted = true
      if (active) release()
    }
  }, [tag])
}

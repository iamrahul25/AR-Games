import * as Speech from 'expo-speech'

import { useSettings } from '@/core/settings/settingsStore'

const MIN_GAP_MS = 3000
let lastSpokenAt = 0
let lastText = ''

/**
 * Speaks a short coaching cue. Rate-limited so the player isn't flooded while
 * standing far from the phone. `force` bypasses the rate limit (e.g. "Go!").
 */
export function speak(text: string, { force = false }: { force?: boolean } = {}) {
  if (!useSettings.getState().voiceEnabled) return
  const now = Date.now()
  if (!force && (now - lastSpokenAt < MIN_GAP_MS || (text === lastText && now - lastSpokenAt < MIN_GAP_MS * 2))) {
    return
  }
  lastSpokenAt = now
  lastText = text
  try {
    Speech.stop().catch(() => {})
    Speech.speak(text, { rate: 1.0, pitch: 1.05, language: 'en-US' })
  } catch (e) {
    console.warn('[voice] speech failed', e)
  }
}

export function stopSpeaking() {
  Speech.stop().catch(() => {})
}

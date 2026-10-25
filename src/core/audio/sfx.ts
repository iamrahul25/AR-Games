import { type AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio'

import { useSettings } from '@/core/settings/settingsStore'

const SOURCES = {
  tick: require('../../../assets/sfx/tick.wav'),
  go: require('../../../assets/sfx/go.wav'),
  match: require('../../../assets/sfx/match.wav'),
  success: require('../../../assets/sfx/success.wav'),
  fail: require('../../../assets/sfx/fail.wav'),
  levelComplete: require('../../../assets/sfx/level-complete.wav'),
  jump: require('../../../assets/sfx/jump.wav'),
  slide: require('../../../assets/sfx/slide.wav'),
  lane: require('../../../assets/sfx/lane.wav'),
  coin: require('../../../assets/sfx/coin.wav'),
  closeCall: require('../../../assets/sfx/close-call.wav'),
  hit: require('../../../assets/sfx/hit.wav'),
  speedUp: require('../../../assets/sfx/speed-up.wav'),
  milestone: require('../../../assets/sfx/milestone.wav'),
  gameOver: require('../../../assets/sfx/game-over.wav'),
  pop: require('../../../assets/sfx/pop.wav'),
  golden: require('../../../assets/sfx/golden.wav'),
} as const

export type SoundName = keyof typeof SOURCES

const players: Partial<Record<SoundName, AudioPlayer>> = {}
let audioModeSet = false

function getPlayer(name: SoundName): AudioPlayer {
  let player = players[name]
  if (!player) {
    player = createAudioPlayer(SOURCES[name])
    players[name] = player
  }
  return player
}

export function playSound(name: SoundName) {
  if (!useSettings.getState().soundEnabled) return
  try {
    if (!audioModeSet) {
      audioModeSet = true
      setAudioModeAsync({ playsInSilentMode: true }).catch(() => {})
    }
    const player = getPlayer(name)
    player.seekTo(0)
    player.play()
  } catch (e) {
    console.warn(`[sfx] Failed to play ${name}`, e)
  }
}

/** Creates all players up front so the first sound doesn't lag. */
export function preloadSounds() {
  for (const name of Object.keys(SOURCES) as SoundName[]) getPlayer(name)
}

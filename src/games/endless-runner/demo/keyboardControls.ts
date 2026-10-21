import { useEffect } from 'react'
import { Platform } from 'react-native'
import type { Lane } from '../types'

/** Keyboard input state (web): ←/→ or A/D lanes, ↑/W/Space jump, hold ↓/S to duck. */
export class KeyboardInput {
  lane: Lane = 0
  ducking = false
  private jumps = 0
  /** Set once any key was used, so the play screen can skip body checks. */
  active = false

  reset() {
    this.lane = 0
    this.ducking = false
    this.jumps = 0
  }

  /** Jumps pressed since the last call. */
  takeJumps(): number {
    const n = this.jumps
    this.jumps = 0
    return n
  }

  /** Returns true if the key is a game control. */
  keyDown(key: string, repeat: boolean): boolean {
    switch (key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        if (!repeat) this.lane = Math.max(-1, this.lane - 1) as Lane
        break
      case 'ArrowRight':
      case 'd':
      case 'D':
        if (!repeat) this.lane = Math.min(1, this.lane + 1) as Lane
        break
      case 'ArrowUp':
      case 'w':
      case 'W':
      case ' ':
        if (!repeat) this.jumps++
        break
      case 'ArrowDown':
      case 's':
      case 'S':
        this.ducking = true
        break
      default:
        return false
    }
    this.active = true
    return true
  }

  keyUp(key: string) {
    if (key === 'ArrowDown' || key === 's' || key === 'S') this.ducking = false
  }
}

/** Attaches window key listeners on web while `enabled`. No-op on native. */
export function useKeyboardControls(input: KeyboardInput, enabled: boolean, onPause?: () => void) {
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled || typeof window === 'undefined') return
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        onPause?.()
        return
      }
      if (input.keyDown(e.key, e.repeat)) e.preventDefault()
    }
    const up = (e: KeyboardEvent) => input.keyUp(e.key)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      input.reset()
    }
  }, [input, enabled, onPause])
}

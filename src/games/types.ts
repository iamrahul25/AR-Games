/**
 * Every game registers a manifest. The hub renders cards from the registry, so adding a
 * game means adding a folder under `src/games/<id>/` plus its routes under `src/app/games/<id>/`.
 * Games may import from `@/core/*` but never from another game's folder.
 */
export interface GameManifest {
  id: string
  title: string
  tagline: string
  description: string
  /** Emoji used as the card icon until we have artwork. */
  icon: string
  accent: string
  status: 'available' | 'coming-soon'
  /** Route of the game's entry screen. */
  route?: string
  /** Short facts shown on the hub card, e.g. "30 levels". */
  badges?: string[]
}

# Free Run (Endless Runner) — Implementation Plan

> Game #2 in **AR Games**. An endless runner you control with your body. Hop left or right to change lanes, jump up to jump, and duck down to slide.
> The live camera with your skeleton is always visible, with **3 virtual lanes**, a **jump line** and a **duck line** drawn on it so you can see exactly what counts as a move.

Status: **Planning only.** Nothing in this document has been implemented yet.
Builds on: `plan.md` (Match Pose, v1 as built), Expo SDK 58 / RN 0.88 / VisionCamera v5 / MediaPipe Pose Landmarker / Skia / Zustand / MMKV.
Names: folder `src/games/endless-runner/`, route `/games/endless-runner`, title **"Free Run"** (confirmed, [§28](#28-open-questions)).

---

## Table of Contents

1. [Goals & Non-Goals](#1-goals--non-goals)
2. [Player Journey (end-to-end flow)](#2-player-journey-end-to-end-flow)
3. [Physical Setup & Screen Layout](#3-physical-setup--screen-layout)
4. [Body Controls — Detection Design](#4-body-controls--detection-design)
5. [Calibration](#5-calibration)
6. [Camera Guide Overlay (lanes, jump line, duck line)](#6-camera-guide-overlay-lanes-jump-line-duck-line)
7. [Game World Design](#7-game-world-design)
8. [Difficulty System](#8-difficulty-system)
9. [Difficulty Presets](#9-difficulty-presets)
10. [Obstacle Generation & Fairness](#10-obstacle-generation--fairness)
11. [Collisions, Lives & Forgiveness](#11-collisions-lives--forgiveness)
12. [Scoring, Stats & Progress](#12-scoring-stats--progress)
13. [How to Play Guide](#13-how-to-play-guide)
14. [Training Run (interactive tutorial)](#14-training-run-interactive-tutorial)
15. [Screens & Wireframes](#15-screens--wireframes)
16. [Architecture & Data Flow](#16-architecture--data-flow)
17. [Rendering the Runner (pseudo-3D)](#17-rendering-the-runner-pseudo-3d)
18. [Changes to Shared Core](#18-changes-to-shared-core)
19. [Folder Structure](#19-folder-structure)
20. [Key Types & Interfaces](#20-key-types--interfaces)
21. [Audio, Voice & Haptics](#21-audio-voice--haptics)
22. [Demo Mode & Alternate Controls](#22-demo-mode--alternate-controls)
23. [Performance Budget](#23-performance-budget)
24. [Safety, Accessibility & Age Range](#24-safety-accessibility--age-range)
25. [Testing Strategy](#25-testing-strategy)
26. [Roadmap / Phases](#26-roadmap--phases)
27. [Risks & Mitigations](#27-risks--mitigations)
28. [Open Questions](#28-open-questions)

---

## 1. Goals & Non-Goals

### Goals
- A 3-lane endless runner controlled **only by body movement**:
  | Body move | Game action |
  |---|---|
  | Hop / step to your **left** | Move one lane left |
  | Hop / step to your **right** | Move one lane right |
  | **Jump** straight up | Jump (clear low obstacles) |
  | **Duck**: lower your head by bending your knees or bowing | Slide (pass under high obstacles) |
- **Live camera + skeleton overlay** visible during the whole run.
- On the camera view, **guides** that show the user what counts:
  - **3 lane zones** (left / center / right). The lane your hips are in is highlighted.
  - **Jump line**: your head must go **above** it for a jump to register.
  - **Duck line**: your head must go **below** it for a duck to register.
  - A **head marker** and **hip marker** show which body points are measured.
- **Difficulty controls:**
  1. **Speed dial** (1–10) for the running speed.
  2. **Speed mode** toggle: **Constant** (practice and fitness; good for children and older adults) or **Increasing** (gradual challenge).
  3. Extra options ([§8](#8-difficulty-system)): enabled moves, obstacle density, lives, session length, line sensitivity, lane width, low-impact jump, assists, and more. These are grouped into **presets** (Kids, Gentle, Beginner, Normal, Athlete, Custom).
- A **How to Play guide**: illustrated pages with animated demos of each move, plus an interactive **Training Run** that confirms every move registers before the first real run.
- Works on **iOS, Android and Web**, like Match Pose. All processing stays on the device.

### Non-Goals (v1)
- True 3D engine (three.js / react-three-fiber). v1 uses a lightweight **pseudo-3D** renderer ([§17](#17-rendering-the-runner-pseudo-3d)).
- Multiplayer, online leaderboards, accounts.
- Run-in-place speed control. Speed comes from the dial, not from running in place. Possible later ([§26](#26-roadmap--phases), Phase 7).
- Casting to a TV. Big-screen play works on web/desktop or tablet.

---

## 2. Player Journey (end-to-end flow)

```
Hub → Free Run home
        ├─ [How to Play]  → illustrated guide (6 pages) → "Start Training Run" / Back
        ├─ [Difficulty]   → presets + speed dial + speed mode + more options → Save
        └─ [PLAY]
              1. Setup tips (first time / "Don't show again")
              2. Calibration: camera full-screen → stand in the middle → hold still 2 s
                 → lanes + lines appear on the camera
              3. Training Run (first time, or if enabled): try each move until it registers
              4. 3-2-1-GO (camera panel shrinks, game view grows)
              5. RUN: obstacles, coins, speed ramp (if Increasing), lives
                    ├─ lost tracking → auto-pause "Step back into view"
                    ├─ Pause button / app backgrounded → Pause menu (Resume / Recalibrate / Restart / Quit)
                    └─ lives = 0, or timer / distance goal reached → Game over / Finished
              6. Result: score, distance, time, moves done, best, Play again / Change difficulty / Home
```

First-run rules:
- If `tutorialDone === false`, PLAY first opens How to Play, then forces the Training Run.
- Calibration runs **every** time a run starts. People stand in different places each time. It takes about 3 seconds.

---

## 3. Physical Setup & Screen Layout

### 3.1 Recommended setup (shown in How to Play and setup tips)
- Phone **upright (portrait)**, at about **waist height**, leaning on something stable. Web: laptop or desktop webcam.
- Stand **2–3 m** away. The camera must see your whole body, plus room to hop **one step left and right**.
- **Clear floor space** of about 2.5 m wide × 1.5 m deep. Non-slip floor, no rugs, good lighting, and nobody walking behind you.

### 3.2 Why both the game view and the camera are on screen
The user must see the game to react, and the camera to know where they stand relative to the lanes and lines. The screen is split:

**Phone, portrait (default):**
```
┌─────────────────────────────┐
│ ❚❚  ♥♥♥   1,240 m   ★ 3,420 │ ← HUD (over game view)
│                             │
│     GAME VIEW (~58%)        │ ← pseudo-3D track, 3 lanes, runner
│        ╱   │   ╲            │
│      ╱  ▇  │    ╲           │
│    ╱       │  🏃  ╲         │
├─────────────────────────────┤
│ [◀ LEFT] [CENTER] [RIGHT ▶] │ ← Move indicator strip (current lane + JUMP/DUCK flash)
├─────────────────────────────┤
│   CAMERA PANEL (~42%)       │ ← live camera + skeleton + guides
│  ┊ L  ┊   C   ┊  R ┊        │   (contain-fit so head & feet are never cropped)
│ ─ ─ ─ JUMP ─ ─ ─ ─ ─ ─      │
│  ┊    ┊  (o)  ┊    ┊        │   (o) head marker
│ ─ ─ ─ DUCK ─ ─ ─ ─ ─ ─      │
│  ┊    ┊   •   ┊    ┊        │   •  hip marker
└─────────────────────────────┘
```

**Landscape phone / tablet / web desktop (width > height and width ≥ 700):**
```
┌──────────────────────────────────────────┬──────────────────┐
│ HUD                                      │  CAMERA PANEL    │
│                                          │  (guides +       │
│           GAME VIEW (~62%)               │   skeleton)      │
│                                          │                  │
│                                          │  move indicator  │
└──────────────────────────────────────────┴──────────────────┘
```

- During **calibration and the Training Run**, the camera panel expands to **full screen** so the user can position themselves easily. When "GO" appears it animates down to its run size (Reanimated layout transition, ~400 ms).
- Camera panel uses **`contain` fit**, not `cover`. With cover, the top or bottom of the image is cropped, and the jump line, the duck line or the user's head could be off-screen even though the model still sees them. Contain shows the full frame with thin letterbox bars. This needs a small core change ([§18](#18-changes-to-shared-core)).
- Layout variants are chosen with `useWindowDimensions`, as `match-pose/PlayScreen` does.
- Optional in Settings: **"Camera panel size: Small / Medium / Large"** (35% / 42% / 50% in portrait).

---

## 4. Body Controls — Detection Design

All detection is **pure TypeScript** in `src/games/endless-runner/motion/`, with no React. It is unit-tested with recorded and synthetic landmark streams.

### 4.1 Coordinate conventions (from the existing core)
- `PoseFrame.landmarks` are in **canonical mirror-view space**: `x, y ∈ [0, 1]`, `y` grows **downward**, and the user's own left side is on the **left** of the image. So when the user hops to their left, `x` decreases, and the character goes left. No extra mapping is needed.
- Horizontal and vertical normalized units differ when the image is not square. Distances use **image-height units**, so `xH = x × imageWidth / imageHeight`.

### 4.2 Body measurement points (`core/pose/bodyMetrics.ts`, shared)
| Point / metric | Definition | Used for |
|---|---|---|
| `head` | Mean of the visible landmarks among nose, left/right eye, left/right ear (visibility ≥ 0.5) | Jump & duck lines |
| `hipMid` | Midpoint of left/right hip | Lane position; jump confirmation |
| `shoulderMid` | Midpoint of left/right shoulder | Torso length |
| `torso` (T) | Distance `shoulderMid → hipMid` in image-height units | Body scale. All vertical thresholds are multiples of T, so they work for kids, adults and any distance from the camera |
| `shoulderWidth` (W) | `|leftShoulder.x − rightShoulder.x|` in canonical x | Lane widths |

Why the head point averages several landmarks: the nose alone jumps around when the head turns. Why hips decide the lane: they are the most stable horizontal anchor. Arms swing and heads bob, but hips move when your body actually changes position.

### 4.3 Pose stream for the runner
- **Rate:** Match Pose uses 15 Hz (`POSE_EMIT_INTERVAL_MS = 66`). The runner needs faster reactions and requests **30 Hz** (`emitIntervalMs = 33`) through a new optional `PoseStage` prop ([§18](#18-changes-to-shared-core)).
- **Smoothing:** a new `smoothing: 'responsive'` preset on the One-Euro filter (higher `beta`, e.g. `minCutoff 1.5, beta 0.25`) for low lag during fast moves. Match Pose keeps the current `'stable'` preset.
- **Latency budget** (camera to game action): capture + inference ~40–60 ms, emit ≤ 33 ms, filter ~20–30 ms, detector debounce ≤ 33 ms. Target **≤ 150 ms**, absorbed by the collision grace window ([§11](#11-collisions-lives--forgiveness)).

### 4.4 Lane detection: hop left / hop right
**Model: absolute position.** The lane you stand in is the lane you run in. The 3 lane zones are fixed on the camera at calibration time:

```
canonical x →
|── LEFT lane ──|──── CENTER lane ────|── RIGHT lane ──|
               bL                     bR
bL = hipX0 − halfLane          bR = hipX0 + halfLane
halfLane = laneWidthFactor × W   (W = shoulder width at calibration)
```

| Lane width setting | `laneWidthFactor` | Center lane width (adult, W ≈ 0.40 m) | Hop needed from center |
|---|---|---|---|
| Narrow (kids, seniors, small rooms) | 0.60 | ≈ 0.48 m | ≈ 0.25–0.30 m |
| **Normal** (default) | 0.85 | ≈ 0.68 m | ≈ 0.35–0.40 m |
| Wide (athletes, big rooms) | 1.10 | ≈ 0.88 m | ≈ 0.45–0.50 m |

Rules:
- **Hysteresis:** leave the current lane only when `hipX` passes a boundary by a margin `m = 0.15 × W`. So center→left needs `hipX < bL − m`, and left→center needs `hipX > bL + m`. Standing on a boundary does not flicker.
- **Dwell:** the new lane must hold for **2 consecutive samples** (~66 ms at 30 Hz) before it registers. This filters single-frame glitches.
- **Mid-air counts:** a lane change registers as soon as the hips cross, even during a hop, so it feels fast.
- **Left to right in one go:** the user passes through the center zone, so the game moves left → center → right. Each step animates in 180 ms, so it still looks smooth.
- **Out of bounds:** if `hipX` is beyond the outer edge of the left or right lane, the user stays in that lane, and the camera panel shows "Step back toward the middle" when they get close to the frame edge.
- **Move indicator strip** (between game and camera): shows `◀ LEFT | CENTER | RIGHT ▶` with the current lane lit, so the user always knows where the game thinks they are.

> Rejected alternative: **event model** (each hop = one lane shift, return to center automatically). It needs reliable hop-velocity detection and drifts when the user doesn't return. With lanes drawn on the camera, the absolute model is easier to understand ("stand in the lane you want").

### 4.5 Jump detection: jump up
```
Jump line  yJ = headY0 − jumpFactor × T        (above the standing head; y decreases upward)
Registered when:
  (1) head.y < yJ                               (head crossed above the jump line)
  (2) hipMid.y < hipY0 − 0.5 × jumpFactor × T   (hips also rose → whole body went up,
                                                 not just a neck stretch or tiptoe lean)
  (3) not a sideways hop (see 4.7)
  (4) not in refractory period (350 ms since the last jump)
```
| Jump line setting | `jumpFactor` | Approx. head rise (adult, T ≈ 0.5 m) | For |
|---|---|---|---|
| Low (easy) | 0.12 | ≈ 6 cm (a small bounce or strong heel raise) | Kids, seniors |
| **Normal** | 0.20 | ≈ 10 cm | Default |
| High | 0.30 | ≈ 15 cm | Athletes, workout mode |

- **Jump state machine:** `GROUNDED → (conditions met) → AIRBORNE` emits **one** `jump` event. It goes `AIRBORNE → GROUNDED` when `head.y > yJ + 0.05T` for ≥ 100 ms. A person staying above the line, for example on tiptoe, does not trigger repeated jumps.
- **In-game jump:** a fixed arc of **0.75 s** air time (scaled by the preset, [§8](#8-difficulty-system)), however long the user was actually in the air. Real hops last 0.3–0.4 s, which would be too short to clear obstacles at speed.
- **Low-impact jump** (accessibility option for seniors or bad knees): a jump is **both wrists above the jump line**, with no hip-rise check. Arms up becomes a jump.

### 4.6 Duck detection: head down / knee bend
```
Duck line  yD = headY0 + duckFactor × T        (below the standing head)
Ducking while: head.y > yD                     (exit when head.y < yD − 0.05T, for 2 samples)
```
| Duck line setting | `duckFactor` | Approx. head drop | Typical movement |
|---|---|---|---|
| Shallow (easy) | 0.25 | ≈ 12 cm | Head bow + slight knee bend |
| **Normal** | 0.40 | ≈ 20 cm | Half squat or bend forward |
| Deep | 0.60 | ≈ 30 cm | Real squat (workout) |

- **Duck style** option:
  - **Head (default):** any movement that brings the head below the line counts: bowing the head, bending forward, or bending the knees.
  - **Knees only (squat):** requires `hipMid.y > hipY0 + 0.5 × duckFactor × T` as well. This stops cheating with a head bow, and is good for fitness or physiotherapy.
- **Slide latch:** the in-game slide lasts at least `minSlideS` (Normal 0.6 s, Easy 1.0 s) after a duck starts, and continues while the user stays below the line. A quick dip is enough, which helps seniors.
- **Landing suppression:** duck detection is ignored for 250 ms after a jump lands, because landing knees bend and dip the head.

### 4.7 Telling "jump up" apart from "hop sideways"
A sideways hop also lifts the head, so it might cross the jump line. When the jump conditions are met:
```
dx = |hipMid.x(now) − hipMid.x(300 ms ago)|
if dx > 0.5 × halfLane → it's a lateral hop → register the lane change only, no jump
else                   → jump
```
- Tuned in playtests. Exposed as a dev constant `LATERAL_HOP_RATIO`.
- Even if this misfires, it is mostly harmless: an accidental jump only matters next to an overhead bar.
- How to Play teaches it directly: **"Jump straight up to jump. Hop sideways to change lanes."**

### 4.8 Combined controller output
```ts
interface MotionState {
  lane: -1 | 0 | 1            // left / center / right
  ducking: boolean
  airborne: boolean           // user physically above jump line (for UI feedback)
  tracking: 'ok' | 'weak' | 'lost'
  head: { x: number; y: number } | null    // for guide markers
  hip:  { x: number; y: number } | null
}
type MotionEvent =
  | { type: 'lane-change'; from: Lane; to: Lane; t: number }
  | { type: 'jump'; t: number }
  | { type: 'duck-start'; t: number } | { type: 'duck-end'; t: number }
  | { type: 'tracking-lost'; t: number } | { type: 'tracking-restored'; t: number }
```

### 4.9 Tracking quality & auto-pause
- `tracking = 'lost'` when the pose is `null`, or head, shoulders or hips are below visibility 0.5, for **> 700 ms**. The run auto-pauses with "We lost you! Step back into view." The guides stay visible.
- `tracking = 'weak'` when knees or ankles are invisible. There's no pause, but a small warning shows: "Step back a little — keep your feet in view." Jump and duck still work because they only need the head and hips.
- Resuming after a loss requires: tracked again, standing in the **center lane**, still for 1 s, then **3-2-1**.

### 4.10 Baseline drift compensation
Users drift slightly forward or back during a run, which changes `headY` and `T`:
- While **neutral** (grounded, not ducking, low vertical speed) for > 1.5 s, update `headY0`, `hipY0` and `T` with a slow EMA (τ ≈ 4 s), limited to ±0.1 T per second. The jump and duck lines move with them (smoothly animated on the camera panel).
- **Lane boundaries do not move.** They are tied to the room, not the body. If the user feels off, the Pause menu has **Recalibrate**.

---

## 5. Calibration

Runs at the start of every run, and from Pause → Recalibrate. The camera panel is full-screen.

| Step | What the user sees | Pass condition |
|---|---|---|
| 1. Framing | Dashed silhouette + messages from `core/pose/framing.ts` ("Step back so your whole body is visible", "Move left", …) | `checkFraming(frame).ok` for 1 s |
| 2. Center & hold still | "Stand in the middle and hold still" + progress ring (2 s) | Hip x moves < 0.01 and head y moves < 0.02 over the window |
| 3. Measure | Collect ~45 samples (1.5 s at 30 Hz) → **median** `headY0, hipX0, hipY0, T, W` | Enough valid samples |
| 4. Fit check | Lanes are computed. Can the user stand in the **left and right lane centers** and still be in frame? Check `hipX0 ± 2·halfLane ± 0.75·W` inside `[0.02, 0.98]`, and `yJ` ≥ 0.03 from the top edge | Pass → step 5. Fail → auto-shrink `laneWidthFactor` down to 0.5. If it still fails: "Step back a little" / "Move toward the middle", then back to step 2 |
| 5. Lines appear | Lanes fade in, then the jump line, then the duck line, each with a voice label ("These are your lanes…") on the first run only | — |

Output: `Calibration { headY0, hipX0, hipY0, torso, shoulderWidth, halfLane, jumpY, duckY, imageAspect, facing }`. Kept in memory for the session and **not** persisted, because positions change every session.

Edge cases:
- **Back camera:** canonical coordinates already handle the flip. Guides are drawn after converting canonical to display x ([§6](#6-camera-guide-overlay-lanes-jump-line-duck-line)).
- **Two people in view:** MediaPipe tracks one person (`numPoses: 1`). How to Play says "One player at a time — others stand out of view."
- **Wheelchair / seated users:** with "Moves: lanes only" + "Low-impact jump" + "Duck style: Head", the game works seated by leaning or rolling sideways ([§24](#24-safety-accessibility--age-range)). Framing step 1 accepts the upper body only when the **"Seated mode"** option is on. In that case `checkFraming` is replaced by an upper-body check.

---

## 6. Camera Guide Overlay (lanes, jump line, duck line)

A new shared component, **`core/pose/GuideOverlay.tsx`**, is drawn above the skeleton. It works with the native camera, the web camera and the demo-mode camera, because it is plain RN `View`s plus Reanimated, positioned with the same fit transform as the skeleton.

### 6.1 Visual spec
| Element | Look | Behaviour |
|---|---|---|
| Lane zones (3) | Full-height vertical bands, 12% white fill, labels **L / C / R** at the bottom | The user's current lane fills **teal 28%**. On lane change it flashes once (200 ms) |
| Lane boundaries (2) | Dashed white vertical lines, 3 px | — |
| Jump line | Solid **yellow** (`warning` #FFC53D) horizontal line, 4 px, label "▲ JUMP" at the left end | Flashes **green** + thicker when a jump registers. Pulses gently while the head is within 0.05 T below it ("almost") |
| Duck line | Solid **cyan** (`primary` #3CC8FF) line, 4 px, label "▼ DUCK" | Turns **green** while ducking |
| Head marker | Ring (radius ~ 0.18 T) around `head` | White normally; green above the jump line or below the duck line |
| Hip marker | Dot + short vertical tick at `hipMid` | Its x is what decides the lane |
| Standing baseline | Faint dotted line at `headY0` (optional, dev / "show details") | — |
| Edge warning | Red glow on the left/right frame edge when hips are within 0.05 of it | "Step back toward the middle" |

The colours match the game: **yellow obstacles = jump**, **cyan obstacles = duck**, **red walls = change lane** ([§7](#7-game-world-design)). Kids learn "yellow thing → yellow line".

### 6.2 Coordinate mapping
- Guides are specified in **canonical** coordinates (the same space as the landmarks).
- Display x: front camera (mirrored preview) → `xDisplay = xCanonical`. Back camera → `xDisplay = 1 − xCanonical`. Lane labels L and R are swapped accordingly, so "L" is always on the user's left as they see it.
- Image → view uses the same `fitTransform(image, view, mode)` as the skeleton (`cover` or `contain`). It is extracted into `core/pose/fitTransform.ts` and shared by native Skia, web canvas and `GuideOverlay`.
- Static parts (lanes, lines) re-render only when calibration changes. Markers move through Reanimated shared values updated at 30 Hz, so the screen doesn't re-render on every frame.

### 6.3 Settings
- `Show guides: Always / During setup only / Off`. Default **Always**. The user asked for always-visible guides, but experienced players may want a cleaner view.
- `Show skeleton` already exists in global settings and is respected.

---

## 7. Game World Design

### 7.1 World model (meters & seconds)
- 3 lanes at world `x = −2, 0, +2` m. The player is at `z = 0`, and the world scrolls toward the player.
- Visible distance (horizon) **`VIEW_DISTANCE = 45 m`**. Obstacles spawn at ~50 m and fade in.
- The player character: lane x eases to the target over **180 ms**. Jump arc height 1.4 m, air time from the preset. Slide height 0.6 m.

### 7.2 Obstacles
| Type | Shape | Colour | How to pass | Lanes |
|---|---|---|---|---|
| **Hurdle** | Low barrier, 0.7 m high | Yellow | Jump | 1 |
| **Wide hurdle** | Low barrier spanning 2–3 lanes | Yellow | Jump | 2–3 |
| **Bar** | Overhead bar / banner, clearance 1.1 m | Cyan | Duck | 1 |
| **Wide bar** | Overhead bar spanning 2–3 lanes | Cyan | Duck | 2–3 |
| **Wall / crate** | Tall block, 2.5 m | Red/orange | Change lane | 1–2 (never all 3) |
| **Long block** (v1.1) | Wall 6–10 m long | Red | Stay out of that lane for a while | 1–2 |

- Each obstacle carries `requires: 'jump' | 'duck' | 'lane'`. The generator only uses types whose move is enabled ([§8.3](#83-extra-options)).
- **Move hint icons** (Assist option): a floating icon above each obstacle (▲ jump / ▼ duck / ◀▶ change), plus a voice cue ("Jump!") about 1.2 s before impact.

### 7.3 Collectibles
- **Coins:** rows of 5–8 along a lane. Arcs over hurdles reward jumping, and lines through the safe lane guide kids toward it. +10 points each.
- **Star** (rare): +100, plus a sparkle.
- **Power-ups (v1.1, toggle "Power-ups: On/Off"):** **Shield** (absorbs one hit, 10 s), **Magnet** (pulls coins from all lanes, 8 s), **Slow-mo** (−30% speed, 5 s; good for the Increasing mode).

### 7.4 Character & environment
- Character: a stylized runner drawn with simple shapes (rounded body, head, limbs) and a 6-frame procedural run cycle. States: run, jump (tuck), slide (lean back), hit (flash + stumble), celebrate.
  - *Optional fun extra (v1.1):* tint or animate the avatar's arms using the user's live arm angles, so the character "mirrors" them.
- Track: 3 lanes with scrolling stripes, side rails, a parallax skyline (2 layers) and a sky gradient. **Themes** (v1.1): City, Park, Space. Data-only palettes.
- Milestone gates every 250 m with a "250 m!" banner.

---

## 8. Difficulty System

All values live in `config/difficulty.ts`. `DifficultySettings` is what the user edits. `RunConfig` is the resolved numbers the engine uses.

### 8.1 Speed dial (1–10)
A large circular dial with 10 ticks, plus **–/+** buttons (big tap targets for kids and seniors) and a label.

| Dial | Label | World speed (m/s) | Time from horizon to player (45 m) | Typical user |
|---|---|---|---|---|
| 1 | Stroll | 4.0 | 11.3 s | Young kids, seniors, rehab |
| 2 | Walk | 5.0 | 9.0 s | Kids, seniors |
| 3 | Brisk | 6.0 | 7.5 s | Beginners |
| 4 | Jog | 7.5 | 6.0 s | Beginners |
| 5 | Run | 9.0 | 5.0 s | **Default** |
| 6 | Fast | 10.5 | 4.3 s | Regular players |
| 7 | Sprint | 12.0 | 3.8 s | Experienced |
| 8 | Dash | 14.0 | 3.2 s | Experienced |
| 9 | Turbo | 16.0 | 2.8 s | Athletes |
| 10 | Max | 18.0 | 2.5 s | Athletes |

- The speed shown in the HUD is the dial-equivalent number (e.g. "Speed 5.4"), not m/s.
- Speed changes how early obstacles appear and how fast they approach. **Spacing** between obstacles has a separate floor in **seconds** ([§8.3](#83-extra-options), [§10](#10-obstacle-generation--fairness)), so even at speed 10 there is always physically enough time to move.

### 8.2 Speed mode toggle: Constant vs Increasing
**Constant** (default for Kids and Gentle presets):
- Speed stays at the dial value for the whole run. Meant for practice and fitness (children, older adults). The challenge comes from moving, not from getting faster.

**Increasing** (default for Beginner, Normal and Athlete):
- Starts at the dial value and steps up in **stages**. Clear steps are easier to feel than a continuous ramp: every `rampEverySeconds` a "Speed up!" banner + sound, and speed increases by `rampStep` dial levels.
- Sub-options (shown only when Increasing is selected):
  | Option | Values | Default |
  |---|---|---|
  | Ramp | Gentle (+0.5 every 45 s) · Normal (+0.5 every 30 s) · Steep (+1.0 every 30 s) | Normal |
  | Max speed | Dial 1–10, must be ≥ start | `min(start + 4, 10)` |
- After a **hit**, speed temporarily drops by 1 dial level and recovers over 3 s ("catch your breath"). The ramp schedule itself is not reset.
- Obstacle density also scales slightly with speed stages (one density step per +2 speed, capped by the density setting's max), so later stages feel richer.

### 8.3 Extra options
Shown under **"More options"** (collapsed by default). Each has a one-line explanation in the UI.

| Group | Option | Values | Effect |
|---|---|---|---|
| **Moves** | Enabled moves | ☑ Lanes ☑ Jump ☑ Duck (at least one) | The generator only creates obstacles for enabled moves. "Lanes only" means no jumping, which suits seniors |
| | Jump style | Real jump · **Low impact (raise both hands)** | [§4.5](#45-jump-detection-jump-up) |
| | Duck style | Head (any) · Knees only (squat) | [§4.6](#46-duck-detection-head-down--knee-bend) |
| **Sensitivity** | Jump line height | Low · Normal · High | `jumpFactor` 0.12 / 0.20 / 0.30 |
| | Duck line depth | Shallow · Normal · Deep | `duckFactor` 0.25 / 0.40 / 0.60 |
| | Lane width | Narrow · Normal · Wide | `laneWidthFactor` 0.60 / 0.85 / 1.10 |
| **Challenge** | Obstacle density | Sparse · Normal · Dense | Minimum gap between obstacles: 3.0 s / 2.0 s / 1.4 s (never below the move recovery floor) |
| | Patterns | Simple (one move per obstacle) · Mixed (combos like "change lane + jump") | Pattern pool filter |
| | Lives | 1 · 3 · 5 · **Unlimited (practice)** | Game over rules |
| | Reaction grace | Generous (250 ms) · Normal (150 ms) · Strict (60 ms) | [§11](#11-collisions-lives--forgiveness) |
| **Session** | Run length | Endless · Timed (1 / 3 / 5 / 10 / 15 min) · Distance (500 m / 1 km / 2 km) | Timed = workout; a finished timed run shows "Workout complete!" |
| | Rest breaks | Off · every 2 / 3 / 5 min (20 s rest) | Timed runs only. The track empties, "Take a breath" + countdown. Good for seniors and kids |
| **Assists** | Move hints | On · Off | Icons above obstacles + voice cue |
| | Coins show the safe lane | On · Off | Coin lines placed in the passable lane |
| | Power-ups (v1.1) | On · Off | — |

**Move recovery floor:** the time a human needs between two required moves. It cannot be lowered by any option:
- `recoveryS = 1.0 s` (Normal / Athlete), `1.4 s` (Beginner), `2.0 s` (Kids / Gentle).
- A lane change across two lanes (left → right) needs `2 × recoveryS`.

### 8.4 Difficulty indicator
The Difficulty screen and the Free Run home show a computed **difficulty rating** (1–5 stars) and a one-line summary, e.g. *"Normal · Speed 5 → 9 · Increasing · 3 lives · All moves"*. The score multiplier ([§12](#12-scoring-stats--progress)) is shown next to it.

---

## 9. Difficulty Presets

Presets fill in every option. Changing any single option switches the preset chip to **Custom** and keeps the edited values.

| Setting | 🧒 Kids | 🧓 Gentle | 🙂 Beginner | 🏃 Normal | 🔥 Athlete |
|---|---|---|---|---|---|
| Speed dial | 2 | 1 | 3 | 5 | 7 |
| Speed mode | Constant | Constant | Increasing (Gentle) | Increasing (Normal) | Increasing (Steep) |
| Max speed | — | — | 6 | 9 | 10 |
| Moves | All | Lanes + Duck | All | All | All |
| Jump style | Real | Low impact | Real | Real | Real |
| Duck style | Head | Head | Head | Head | Knees only |
| Jump line | Low | Low | Normal | Normal | High |
| Duck line | Shallow | Shallow | Normal | Normal | Deep |
| Lane width | Narrow | Narrow | Normal | Normal | Wide |
| Density | Sparse | Sparse | Sparse | Normal | Dense |
| Patterns | Simple | Simple | Simple | Mixed | Mixed |
| Lives | Unlimited | Unlimited | 5 | 3 | 1 |
| Reaction grace | Generous | Generous | Generous | Normal | Strict |
| Recovery floor | 2.0 s | 2.0 s | 1.4 s | 1.0 s | 1.0 s |
| Jump air time | 1.0 s | 1.0 s | 0.85 s | 0.75 s | 0.65 s |
| Min slide | 1.0 s | 1.0 s | 0.8 s | 0.6 s | 0.6 s |
| Run length | Timed 3 min | Timed 5 min + rest every 2 min | Endless | Endless | Endless |
| Move hints | On + voice | On + voice | On | Off | Off |
| Coins show safe lane | On | On | On | Off | Off |

All numbers are **starting values** to tune in Phase 5 playtests.

---

## 10. Obstacle Generation & Fairness

### 10.1 Pattern-based generator (`engine/generator.ts`)
The track is generated in **chunks** from hand-authored **patterns** (data), so it never produces random nonsense.

```ts
interface ObstaclePattern {
  id: string
  tags: ('simple' | 'combo')[]
  requires: MoveKind[]                       // moves needed to pass (filters by enabled moves)
  minLevel: 1 | 2 | 3                        // unlocks with speed stage / density
  items: { dz: number; lanes: Lane[]; type: ObstacleType }[]   // dz in "beats" (×gap)
  coins?: { dz: number; lane: Lane | 'safe'; shape: 'line' | 'arc' }[]
}
```

Examples (v1 ships ~25 patterns):
| Pattern | Description | Requires |
|---|---|---|
| `single-wall` | Wall in 1 random lane | lane |
| `double-wall` | Walls in 2 lanes, 1 open lane | lane |
| `single-hurdle` | Hurdle in the player's likely lane | jump |
| `wide-hurdle` | Hurdle across all 3 lanes | jump |
| `single-bar` / `wide-bar` | Bar in 1 lane / all lanes | duck |
| `zigzag` | Wall L → wall R → wall C (beats 0, 1, 2) | lane |
| `hurdle-bar` | Wide hurdle, then wide bar | jump, duck |
| `gate-jump` | 2 walls + hurdle in the open lane | lane, jump |
| `gate-duck` | 2 walls + bar in the open lane | lane, duck |
| `coin-break` | Coins only (a breather) | — |

### 10.2 Spacing
```
gapSeconds   = max(densityGapS, recoveryS)            // per required move
gapMeters    = gapSeconds × currentSpeed
patternGap   = gapMeters × 1.5                        // extra space between patterns
breather     = every 6–10 patterns, a coin-only stretch of 3–4 s
```
- At low speed, gaps are long in meters but the same in seconds. At high speed, the reaction window shrinks because obstacles become visible later in seconds, but the recovery floor guarantees a human can still do the moves.
- The first **5 s** of every run (and after each resume) has no obstacles, only coins.

### 10.3 Fairness validator (`engine/fairness.ts`)
Before a chunk is committed, check that it is solvable:
- Simulate every reachable lane over time. Each lane change takes `recoveryS` per lane (two lanes = 2×). Each jump or duck needs `recoveryS` before the next required move.
- Every row must have at least one passable option: an open lane, or a jump or duck the player can do in their reachable lane.
- If the check fails, reject the pattern and try another (max 10 tries, then insert `coin-break`).
- A unit test runs the generator for 10,000 chunks with every preset and seed, and asserts 100% solvable.

### 10.4 Seeded randomness
`engine/rng.ts`: a small seeded PRNG (mulberry32). Runs use a random seed, but tests and the demo use fixed seeds. The seed is shown in dev builds so a bad run can be reproduced.

---

## 11. Collisions, Lives & Forgiveness

### 11.1 Collision check (per sim step)
For each obstacle whose z-range overlaps the player's z (with the player's depth 0.6 m):
| Obstacle | Hit if player is… |
|---|---|
| Wall | In a covered lane (the lane is taken from the eased x: the lane whose center is closest; lane-change ease counts once past halfway) |
| Hurdle | In a covered lane **and** jump height < 0.7 m |
| Bar | In a covered lane **and** not sliding **and** not jumping above it (jumping into a bar = hit) |

### 11.2 Reaction grace (latency forgiveness)
Body movement and detection add ~150 ms of delay, so a correct move that arrives slightly late still counts:
- When a hit would happen, the obstacle is marked **pending** for `graceMs` (Generous 250, Normal 150, Strict 60).
- If the matching move registers during the grace window, there's **no hit**. The character snaps into the move (jump starts at the right height, or lane x jumps to the target) and a small **"Close call!"** (+25) pops.
- Otherwise it's a hit.

### 11.3 On hit
- Lose 1 life (♥), the obstacle shatters, the character stumbles, the screen shakes for 150 ms, there's a buzz sound and haptic.
- **Invulnerable for 2 s** (the character blinks).
- Speed dips by 1 dial level and recovers over 3 s (Increasing mode).
- Streak resets.
- Practice / Unlimited lives: there's no game over. Hits are counted as **"bumps"** for the result screen.

### 11.4 End conditions
- Lives = 0 → **Game over**.
- Timed run reaches its time, or a distance run reaches its distance → **Finished** (celebration).
- The user can always end from Pause → Quit, which still shows the result screen if the run lasted more than 10 s.

---

## 12. Scoring, Stats & Progress

### 12.1 Score
```
score += distanceDelta(m) × speedFactor                    // speedFactor = currentSpeed / 9
score += coins × 10, stars × 100, closeCalls × 25
score += obstacleCleared × 20 × streakMultiplier           // x1, x2 at 10 streak, x3 at 25, x4 at 50
finalScore = round(score × difficultyMultiplier)
```
`difficultyMultiplier` comes from the settings, for example: lives 1 = ×1.3, 3 = ×1.0, 5 = ×0.8, unlimited = ×0.5; Dense ×1.2, Sparse ×0.8; Strict grace ×1.1, Generous ×0.9; Move hints on ×0.9. The total is clamped to [0.3, 2.0] and shown on the Difficulty screen.

### 12.2 Run stats (Result screen)
Distance, time, score, best (with a "New best!" badge), coins, obstacles cleared, hits/bumps, longest streak, top speed, **moves performed** (jumps, ducks, lane changes), and **active minutes**.
- Optional rough **calorie estimate** (v1.1). It needs body weight, entered optionally on-device only. Uses MET ≈ 6–8 × minutes and is clearly labelled as an estimate.

### 12.3 Persistent progress (`store/runnerStore.ts`, Zustand + `kvStorage`)
```ts
interface RunnerPersisted {
  version: 1
  settings: DifficultySettings          // last used (incl. preset id)
  tutorialDone: boolean
  showSetupTips: boolean
  alwaysTrainingRun: boolean
  guidesMode: 'always' | 'setup' | 'off'
  cameraPanelSize: 'small' | 'medium' | 'large'
  best: Record<PresetId | 'custom', { score: number; distance: number; at: number }>
  totals: { runs: number; distance: number; jumps: number; ducks: number; laneChanges: number; activeSeconds: number }
}
```
Local only, no accounts (same privacy model as Match Pose).

---

## 13. How to Play Guide

`screens/HowToPlayScreen.tsx`: a paged carousel (swipe + Next/Back + page dots). Each page has an **animated stick-figure demo** that reuses `core/pose/StickFigure` with keyframed `SkeletonSpec`s (stand → hop left, stand → jump, stand → duck). It also shows a **mini camera-guide illustration** (static drawing of lanes and lines) so the user recognises it later. Text is big, short, and read aloud with a 🔊 button (`expo-speech`).

| # | Title | Content (final copy to polish) | Demo |
|---|---|---|---|
| 1 | **Set up** | "Stand your phone up at waist height. Step back 2–3 big steps so your whole body fits on screen. Clear some space around you." | Phone + person + distance arrow |
| 2 | **Your three lanes** | "The camera shows three lanes. The lane you stand in is the lane you run in. **Hop to your left** to go left, **hop to your right** to go right. Hop back to the middle for the center lane." | Figure hops L → C → R; lane zone lights up |
| 3 | **Jump** | "See the **yellow JUMP line** above your head? **Jump straight up** so your head goes above it. Jump over **yellow** hurdles." | Figure jumps, head crosses the yellow line, line flashes green |
| 4 | **Duck** | "The **blue DUCK line** is below your head. **Bend your knees or lower your head** below it to slide under **blue** bars. Stay down until you pass." | Figure squats under the blue line |
| 5 | **Obstacles & coins** | Legend: 🟨 hurdle → jump · 🟦 bar → duck · 🟥 wall → change lane · 🪙 coins · ⭐ star. "Hit an obstacle and you lose a heart." | Mini track with each obstacle |
| 6 | **Choose your challenge** | "Pick a preset or set the **speed dial**. **Constant speed** is great for practice and exercise. **Increasing speed** gets faster as you go." + safety: "Wear shoes, keep the floor clear, stop if you feel tired or dizzy." | Dial + toggle illustration |

Buttons on the last page: **Start Training Run** (primary) · **Done**.
Entry points: Free Run home, Pause menu ("How to play"), Result screen (after a game over within 15 s: "Need a refresher?").

---

## 14. Training Run (interactive tutorial)

`components/TrainingOverlay.tsx` + `engine/training.ts` (a pure state machine). The camera panel stays **full-screen**, and the game view shows the runner standing on an empty track in a small inset.

| Step | Prompt (text + voice) | Done when | Hint after 8 s without success |
|---|---|---|---|
| 1 | "Hop to your **LEFT** lane" (left zone pulses) | `lane-change → -1` | "Take a bigger step to the left" |
| 2 | "Now hop back to the **MIDDLE**" | `lane → 0` | — |
| 3 | "Hop to your **RIGHT** lane" | `lane → +1` | "Take a bigger step to the right" |
| 4 | "Back to the **MIDDLE**" | `lane → 0` | — |
| 5 | "**JUMP!** Get your head above the yellow line" | `jump` | "Jump a little higher — or choose 'Jump line: Low' in Difficulty" |
| 6 | "**DUCK!** Get your head below the blue line" | `duck-start` | "Bend your knees more" |
| 7 | "Try it for real!" → 3 slow obstacles (wall, hurdle, bar) at dial 1, with hints | All 3 passed (unlimited tries) | — |
| ✔ | "You're ready! 🎉" → sets `tutorialDone = true` → 3-2-1 → real run | — | — |

- Each success: a green check + "ding". Steps for disabled moves are skipped (e.g. no jump step in Gentle).
- **Auto-tune suggestion:** if a step needs more than 3 hints, offer a one-tap fix ("Make jumping easier?" → set jump line to Low). This helps kids and seniors without them digging into settings.
- Skip button (after the first completion). The Training Run can also be started from How to Play.

---

## 15. Screens & Wireframes

Routes (thin wrappers, as with Match Pose) under `src/app/games/endless-runner/`:
| Route | Screen |
|---|---|
| `index.tsx` | `RunnerHomeScreen` |
| `difficulty.tsx` | `DifficultyScreen` |
| `how-to-play.tsx` | `HowToPlayScreen` |
| `play.tsx` | `PlayScreen` (setup tips → calibration → training → run → game over) |
| `result.tsx` | `ResultScreen` (reads the last run from the store, so no route params are needed) |

### 15.1 Free Run home
```
┌────────────────────────────────┐
│ ←  Free Run 🏃                 │
│ ┌────────────────────────────┐ │
│ │  Best: 12,450 · 2.1 km     │ │
│ │  🏃 Normal · Speed 5 → 9   │ │  ← current difficulty summary (tap = Difficulty)
│ │  Increasing · 3 ♥ · ★★★☆☆  │ │
│ └────────────────────────────┘ │
│       [   ▶  PLAY   ]          │  ← primary, big
│  [ 🎚 Difficulty ] [ ❓ How to play ] │
│  [ 🎯 Training run ]           │
│  Totals: 23 runs · 14.2 km · 812 jumps │
└────────────────────────────────┘
```

### 15.2 Difficulty screen
```
┌────────────────────────────────┐
│ ←  Difficulty                  │
│ Presets: (🧒Kids)(🧓Gentle)(🙂Beginner)(🏃Normal)(🔥Athlete)(Custom) │
│                                │
│          ╭───────────╮         │
│     [–]  │    5      │  [+]    │  ← SpeedDial: arc with 10 ticks, drag or tap ±
│          │   RUN     │         │
│          ╰───────────╯         │
│  Speed mode:  [ Constant | Increasing ]   │  ← big segmented toggle
│    Constant — same speed all run. Great for practice & fitness.
│    (if Increasing) Ramp: [Gentle|Normal|Steep]  Max speed: 9 [–][+]
│                                │
│  ▸ More options                │  ← collapsible groups (§8.3)
│  Difficulty ★★★☆☆  · Score ×1.0 │
│        [ Save ]   [ Play ▶ ]   │
└────────────────────────────────┘
```

### 15.3 Play screen (run): see [§3.2](#32-why-both-the-game-view-and-the-camera-are-on-screen)
HUD over the game view: pause ❚❚ · hearts · distance · score · coins · speed badge ("Speed 6.5 ▲" when a ramp happens) · timer (timed runs) · streak chip (×2).
Overlays: setup tips, calibration, training, countdown, "Speed up!" banner, "Close call!", milestone banners, rest break, auto-pause ("We lost you"), pause menu.

### 15.4 Pause menu
Resume · **Recalibrate** · How to play · Restart · Quit. The camera stays live, and guides are shown, while paused.

### 15.5 Result screen
```
┌────────────────────────────────┐
│        GAME OVER / FINISHED!   │
│        12,450   ★ NEW BEST     │
│  2.1 km · 4:12 · top speed 8.5 │
│  🪙 312   ⛔ 3 hits   🔥 streak 41 │
│  Moves: ▲ 58 jumps · ▼ 44 ducks · ◀▶ 97 lanes │
│  Active: 4 min                 │
│  [ Play again ] [ Difficulty ] [ Home ] │
└────────────────────────────────┘
```

### 15.6 New shared UI components
- `SegmentedToggle` (core/ui): generic, also useful for Settings.
- `Stepper` (core/ui): big – value + control.
- Game-specific: `SpeedDial`, `PresetChips`, `OptionGroup`, `RunnerHud`, `LivesBar`, `MoveIndicator`, `CalibrationOverlay`, `TrainingOverlay`, `HowToPlayPage`, `MoveDemoFigure`, `ObstacleLegend`, `RunBanner`.
- Promote the generic `CountdownOverlay` and `PauseMenu` from `match-pose/components/PlayOverlays.tsx` into `core/ui/`, so both games share them without cross-game imports. `PauseMenu` gets a configurable list of actions.

---

## 16. Architecture & Data Flow

```
┌────────────── PlayScreen (React) ───────────────────────────────────────────┐
│                                                                             │
│  PoseStage (camera + skeleton + GuideOverlay)   emitIntervalMs=33,          │
│        │ onPose(frame) ~30 Hz (JS thread)        smoothing='responsive'     │
│        ▼                                                                    │
│  MotionController (pure TS)  ── calibration, laneTracker, jumpDetector,     │
│        │                        duckDetector, trackingMonitor               │
│        │ MotionState + MotionEvent[]                                        │
│        ├──────────────▶ guide marker SharedValues (head/hip, active lane)   │
│        ▼                                                                    │
│  RunnerSession (pure TS)  ── phase machine: tips → calibrate → training →   │
│        │                     countdown → running ⇄ paused → over           │
│        ▼                                                                    │
│  RunnerSim (pure TS, fixed step 1/60 s) ── player, speed ramp, generator,   │
│        │                                   collisions, lives, scoring       │
│        │ WorldSnapshot (each display frame)        SimEvent[] (hit, coin…)  │
│        ▼                                               ▼                    │
│  RunnerCanvas (Skia native / canvas web)     audio · voice · haptics        │
│  RunnerHud (React state, throttled to 10 Hz)                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 16.1 Loops & threads
- **Pose input:** JS thread, ~30 Hz, from `PoseStage`.
- **Game loop:** JS thread `requestAnimationFrame`, with a **fixed-timestep** accumulator (1/60 s steps, max 5 steps per frame, so behaviour is the same at 30 / 60 / 120 Hz displays). Motion events are queued and applied at the next sim step, with their timestamps used by the grace logic.
- **Rendering:** each frame, `scene.ts` turns the `WorldSnapshot` into a **draw list**. Native: recorded into a Skia `SkPicture` and handed to a `<Picture>` through a SharedValue, so React doesn't re-render. Web: drawn straight onto a `<canvas>` 2D context.
- **React state** only for the HUD and overlays, updated at most 10 Hz (score, distance, hearts, phase).
- **Fallback (if Phase 0 shows JS-thread jank on low-end Android):** move `RunnerSim.step` + `scene` to the **UI thread** as worklets via Reanimated `useFrameCallback`, and feed `MotionState` in through a SharedValue. The engine is designed for this: plain data and functions, no classes holding closures in the hot path, no `Date.now()` inside the sim (time is passed in).

### 16.2 Session phase machine (`engine/session.ts`)
```
setup-tips → calibrating ─(fit ok)→ training? → countdown → running
running ─(pause / background)→ paused ─(resume: center + still 1 s)→ countdown → running
running ─(tracking lost 700 ms)→ auto-paused ─(restored)→ countdown → running
running ─(lives 0 | time/distance reached)→ over → result route
paused ─(recalibrate)→ calibrating
running ─(rest break due)→ resting (20 s, track clears) → countdown → running
```

### 16.3 Lifecycle
- `useKeepScreenOn()` while on the Play screen.
- `AppState` change to anything other than active → pause (like Match Pose).
- Camera `isActive` stays **true** while paused, because the guides and the resume check need it. It becomes `false` on the Result screen and when leaving.

---

## 17. Rendering the Runner (pseudo-3D)

### 17.1 Projection (`render/projection.ts`)
A simple perspective camera behind and above the runner:
```
camera: x = playerX × 0.6 (slight follow), y = 3.2 m, z = −6 m, focal f = viewH × 0.9
screenX = cx + (wx − camX) × f / (wz − camZ)
screenY = horizonY + (camY − wy) × f / (wz − camZ)      horizonY ≈ 0.33 × viewH
```
- Everything is drawn **far to near** (painter's algorithm).
- **Fog:** alpha ramps from 0 at 45 m to 1 at 35 m, so things appear smoothly.

### 17.2 Draw list (`render/drawList.ts`)
Platform-agnostic primitives: `poly` (filled or stroked points), `rect`, `roundRect`, `circle`, `line`, `gradientRect`, `text` (HUD-free; only floating "+10" style labels). Each has a colour and alpha. `scene.ts` builds them:
1. Sky gradient + 2 parallax skyline layers (offset by distance × 0.02 / 0.05).
2. Ground: 3 lane trapezoids with scrolling stripe bands (`stripe phase = distance mod 4 m`), side rails.
3. Obstacles as **extruded boxes** (front face + top face + side face shaded), with a hint icon above them when assists are on.
4. Coins: circles scaled by depth, with a spin effect from squashing the width with a sine.
5. Runner character (procedural limbs from state + run-cycle phase) and its shadow.
6. Particles (hit shards, coin sparkles): small pool, max ~60.

### 17.3 Backends
- `RunnerCanvas.native.tsx`: Skia `<Canvas>` with one `<Picture>`. Each frame: `PictureRecorder` → draw list → `finishRecordingAsPicture()` → `pictureSV.value = pic`. *Verify the exact Skia 2.14 API names in Phase 0.*
- `RunnerCanvas.web.tsx`: `<canvas>` with devicePixelRatio scaling (the same pattern as `PoseCamera.web.tsx`).
- `RunnerCanvas.tsx` is the shared type + entry, like the `PoseCamera.tsx` pattern.

### 17.4 Upgrade path
The engine is independent of the renderer, so a v2 can swap in `@react-three/fiber` + `expo-gl` for real 3D without touching motion or sim code.

---

## 18. Changes to Shared Core

All additions are optional props with today's behaviour as the default, so **Match Pose is unaffected**.

| File | Change | Why |
|---|---|---|
| `core/pose/PoseCamera.types.ts` | Add `resizeMode?: 'cover' \| 'contain'` (default `cover`), `emitIntervalMs?: number` (default 66), `guides?: GuideSpec`, `onLayoutInfo?` | Contain-fit camera panel; 30 Hz pose stream; guides |
| `core/pose/PoseCamera.native.tsx` | Pass `resizeMode` to VisionCamera `<Camera>`; use `fitTransform(mode)` for the skeleton; emit interval from prop; publish image size + view size for `GuideOverlay` | — |
| `core/pose/PoseCamera.web.tsx` | `objectFit: contain`; shared `fitTransform`; emit interval from prop | — |
| `core/pose/SimulatedPoseCamera.tsx` | Pass `fit` through; accept a `driver` (see [§22](#22-demo-mode--alternate-controls)) | Demo mode for the runner |
| `core/pose/PoseStage.tsx` | Forward `resizeMode`, `emitIntervalMs`, `guides`; `smoothing?: 'stable' \| 'responsive'`; render `GuideOverlay` | — |
| `core/pose/oneEuroFilter.ts` | `PoseSmoother` constructor takes `{ minCutoff, beta }` presets | Responsive smoothing |
| **new** `core/pose/fitTransform.ts` | `fitTransform(image, view, 'cover' \| 'contain')`, extracted from the native & web cameras | One source for skeleton + guides |
| **new** `core/pose/GuideOverlay.tsx` | Lanes, lines, markers ([§6](#6-camera-guide-overlay-lanes-jump-line-duck-line)) | Reusable by future games (e.g. a squat counter) |
| **new** `core/pose/bodyMetrics.ts` | `headPoint`, `hipMid`, `shoulderMid`, `torsoLength`, `shoulderWidth` | Shared geometry |
| `core/pose/simulator.ts` / `skeleton.ts` | `SimulatorTarget` gains optional `centerX`, `liftY` (vertical offset) and `crouch` (0..1 knee bend); `skeletonToFrame` gets a `centerY` override per frame | Demo bot can hop, jump, duck |
| **new** `core/ui/SegmentedToggle.tsx`, `core/ui/Stepper.tsx` | Generic controls | Difficulty screen; reusable |
| `core/ui/` ← `CountdownOverlay`, `PauseMenu` | Moved from match-pose (match-pose imports updated) | Shared without cross-game imports |
| `core/audio/sfx.ts` | New sounds: `jump`, `slide`, `lane`, `coin`, `hit`, `speedUp`, `milestone`, `gameOver` | — |
| `games/registry.ts` | Replace the placeholder `freeRunManifest` with `endlessRunnerManifest` (`status: 'available'`) | Hub card |

---

## 19. Folder Structure

```
src/
├── app/games/endless-runner/
│   ├── index.tsx              → RunnerHomeScreen
│   ├── difficulty.tsx         → DifficultyScreen
│   ├── how-to-play.tsx        → HowToPlayScreen
│   ├── play.tsx               → PlayScreen
│   └── result.tsx             → ResultScreen
│
└── games/endless-runner/
    ├── manifest.ts
    ├── types.ts                         # Lane, MoveKind, ObstacleType, DifficultySettings, RunConfig, …
    ├── config/
    │   ├── difficulty.ts                # SPEED_TABLE, presets, resolveRunConfig(), difficultyMultiplier()
    │   └── world.ts                     # lane x, view distance, heights, timings
    ├── motion/                          # Pure TS — body → controls
    │   ├── calibration.ts               # sampler + median + fit check → Calibration
    │   ├── laneTracker.ts               # hysteresis + dwell
    │   ├── jumpDetector.ts              # line + hip confirm + lateral-hop filter + refractory
    │   ├── duckDetector.ts              # line + style + landing suppression
    │   ├── trackingMonitor.ts           # ok / weak / lost
    │   ├── baselineAdapter.ts           # drift compensation (§4.10)
    │   ├── motionController.ts          # combines all → MotionState + events
    │   └── guides.ts                    # Calibration + MotionState → GuideSpec
    ├── engine/                          # Pure TS — game rules
    │   ├── rng.ts
    │   ├── patterns.ts                  # ObstaclePattern data (~25)
    │   ├── generator.ts
    │   ├── fairness.ts
    │   ├── speed.ts                     # constant / staged ramp / hit dip
    │   ├── collision.ts                 # incl. grace window
    │   ├── scoring.ts
    │   ├── sim.ts                       # RunnerSim: step(dt, input) → events; snapshot()
    │   ├── session.ts                   # phase machine (§16.2)
    │   └── training.ts                  # tutorial steps (§14)
    ├── render/
    │   ├── drawList.ts
    │   ├── projection.ts
    │   ├── scene.ts                     # WorldSnapshot → DrawList
    │   ├── character.ts                 # procedural runner
    │   ├── palette.ts                   # colours (from theme tokens) + future themes
    │   ├── RunnerCanvas.tsx
    │   ├── RunnerCanvas.native.tsx      # Skia Picture
    │   └── RunnerCanvas.web.tsx         # canvas 2D
    ├── demo/
    │   ├── demoBot.ts                   # auto-player: reads upcoming obstacles → SimulatorTarget
    │   └── keyboardControls.ts          # web dev controls (arrows/space/down)
    ├── screens/
    │   ├── RunnerHomeScreen.tsx
    │   ├── DifficultyScreen.tsx
    │   ├── HowToPlayScreen.tsx
    │   ├── PlayScreen.tsx
    │   └── ResultScreen.tsx
    ├── components/
    │   ├── SpeedDial.tsx
    │   ├── PresetChips.tsx
    │   ├── OptionGroup.tsx
    │   ├── RunnerHud.tsx
    │   ├── LivesBar.tsx
    │   ├── MoveIndicator.tsx
    │   ├── CalibrationOverlay.tsx
    │   ├── TrainingOverlay.tsx
    │   ├── SetupTipsOverlay.tsx
    │   ├── RunBanner.tsx                # "Speed up!", "250 m", "Close call!"
    │   ├── RestBreakOverlay.tsx
    │   ├── HowToPlayPage.tsx
    │   ├── MoveDemoFigure.tsx           # animated StickFigure keyframes
    │   └── ObstacleLegend.tsx
    ├── store/
    │   └── runnerStore.ts               # persisted settings + progress; lastRun (memory)
    ├── assets/sfx/                      # if not shared in /assets/sfx
    └── __tests__/
        ├── fixtures/                    # recorded landmark streams (hop L/R, jump, duck, side-hop, landing)
        ├── laneTracker.test.ts
        ├── jumpDetector.test.ts
        ├── duckDetector.test.ts
        ├── calibration.test.ts
        ├── motionController.test.ts
        ├── generator.fairness.test.ts
        ├── speed.test.ts
        ├── collision.test.ts
        ├── scoring.test.ts
        ├── sim.test.ts
        ├── session.test.ts
        └── difficulty.test.ts           # presets valid, multiplier ranges
```
Isolation rules from `plan.md` still apply: the game imports from `@/core/*` only, never from `match-pose`.

---

## 20. Key Types & Interfaces

```ts
// types.ts
export type Lane = -1 | 0 | 1
export type MoveKind = 'lane' | 'jump' | 'duck'
export type ObstacleType = 'hurdle' | 'bar' | 'wall' | 'longWall'
export type PresetId = 'kids' | 'gentle' | 'beginner' | 'normal' | 'athlete'
export type Level3 = 'low' | 'normal' | 'high'

export interface DifficultySettings {
  preset: PresetId | 'custom'
  speedDial: number                         // 1..10
  speedMode: 'constant' | 'increasing'
  ramp: 'gentle' | 'normal' | 'steep'
  maxSpeedDial: number                      // ≥ speedDial
  moves: Record<MoveKind, boolean>
  jumpStyle: 'jump' | 'hands-up'
  duckStyle: 'head' | 'squat'
  jumpLine: Level3                          // low / normal / high
  duckLine: Level3                          // shallow / normal / deep
  laneWidth: 'narrow' | 'normal' | 'wide'
  density: 'sparse' | 'normal' | 'dense'
  patterns: 'simple' | 'mixed'
  lives: 1 | 3 | 5 | 'unlimited'
  grace: 'generous' | 'normal' | 'strict'
  session: { kind: 'endless' } | { kind: 'timed'; minutes: 1 | 3 | 5 | 10 | 15 } | { kind: 'distance'; meters: 500 | 1000 | 2000 }
  restBreakEveryMin: 0 | 2 | 3 | 5
  moveHints: boolean
  coinsShowSafeLane: boolean
  powerUps: boolean
  seatedMode: boolean
}

export interface RunConfig {                // resolved numbers (engine input)
  startSpeed: number; maxSpeed: number      // m/s
  rampStepSpeed: number; rampEveryS: number // 0 for constant
  recoveryS: number; densityGapS: number
  jumpAirS: number; minSlideS: number
  graceMs: number; livesMax: number | null
  jumpFactor: number; duckFactor: number; laneWidthFactor: number
  enabledMoves: MoveKind[]; patternTags: ('simple' | 'combo')[]
  sessionLimit: { seconds?: number; meters?: number }
  restBreak: { everyS: number; durationS: number } | null
  scoreMultiplier: number
}

// motion/calibration.ts
export interface Calibration {
  headY0: number; hipX0: number; hipY0: number
  torso: number; shoulderWidth: number; halfLane: number
  laneBounds: [number, number]              // [bL, bR] canonical x
  jumpY: number; duckY: number
}

// core/pose/GuideOverlay.tsx
export interface GuideSpec {
  lanes?: { bounds: [number, number]; outer: [number, number]; active: Lane | null; labels: [string, string, string] }
  hLines?: { id: string; y: number; color: string; label: string; state: 'idle' | 'near' | 'hit' }[]
  markers?: { head?: SharedValue<{ x: number; y: number } | null>; hip?: SharedValue<{ x: number; y: number } | null> }
  edgeWarning?: 'left' | 'right' | null
}

// engine/sim.ts
export interface SimInput { lane: Lane; ducking: boolean; jumpRequests: number[] /* timestamps */ }
export type SimEvent =
  | { type: 'jump' } | { type: 'slide' } | { type: 'lane' }
  | { type: 'coin'; value: number } | { type: 'close-call' }
  | { type: 'hit'; livesLeft: number | null } | { type: 'speed-up'; dial: number }
  | { type: 'milestone'; meters: number } | { type: 'rest-start' } | { type: 'finished'; reason: 'lives' | 'time' | 'distance' }
export interface WorldSnapshot {
  distance: number; speed: number; speedDial: number
  player: { x: number; lane: Lane; y: number; state: 'run' | 'jump' | 'slide' | 'hit'; invulnerable: boolean; runPhase: number }
  obstacles: { id: number; type: ObstacleType; lanes: Lane[]; z: number; length: number; hint?: MoveKind }[]
  coins: { id: number; lane: Lane; z: number; y: number }[]
  particles: { x: number; y: number; z: number; life: number; kind: 'shard' | 'sparkle' }[]
  score: number; coinsCollected: number; lives: number | null; streak: number; elapsedS: number
}
```

---

## 21. Audio, Voice & Haptics
| Event | Sound | Voice (if enabled) | Haptic |
|---|---|---|---|
| Countdown 3-2-1-GO | tick / go | "3, 2, 1, Go!" | — |
| Lane change | soft whoosh | — | — |
| Jump / slide | jump boing / slide swish | — | — |
| Coin | coin ding (pitch rises with combo) | — | — |
| Close call | quick chime | — | — |
| Hit | thud + buzz | "Ouch!" (kids preset) | error |
| Speed up | rising tone | "Speed up!" | light |
| Milestone | fanfare short | "500 metres!" | — |
| Move hint (assist) | — | "Jump!" / "Duck!" / "Go left!" / "Go right!" | — |
| Tracking lost | alert | "Step back into view" | — |
| Rest break | calm tone | "Take a breath. 20 seconds." | — |
| Game over / finished | fail / level-complete | "Great run! 1.2 kilometres" | success |

- Voice hints take priority and other speech is rate-limited (the existing `speak` throttling).
- Optional background music loop (low volume, off by default in v1; on/off in Settings).

---

## 22. Demo Mode & Alternate Controls

- **Demo mode** (existing global setting): `SimulatedPoseCamera` is driven by **`demoBot.ts`**. It reads the upcoming obstacles from the sim and sets a `SimulatorTarget` (centerX for lanes, liftY for jumps, crouch for ducks) with human-like reaction time (0.4–0.6 s) and occasional mistakes (5%). The **whole pipeline is exercised**: fake landmarks → motion detection → sim. That makes it the best end-to-end test and demo.
- **Keyboard (web, dev + accessibility):** ←/→ lanes, ↑/Space jump, ↓ (hold) duck. It writes straight into `SimInput`, bypassing motion detection. Enabled in `__DEV__`, or by the "Keyboard controls" setting on web.
- **Touch swipe (optional, v1.1):** swipe left/right/up/down on the game view. For trying the game without standing up.

---

## 23. Performance Budget
| Item | Target |
|---|---|
| Game render | 60 FPS on mid devices, ≥ 30 FPS on low-end Android |
| Pose inference + overlay | Unchanged from Match Pose (≥ 20 inferences/s native) |
| Pose to JS | 30 Hz |
| Motion processing | < 1 ms per sample |
| Sim step | < 1 ms per step; draw-list build < 2 ms |
| Body move to on-screen reaction | ≤ 150 ms typical |
| HUD React updates | ≤ 10 Hz |

Techniques: object pools for obstacles, coins and particles (no per-frame allocation in the hot path); reuse draw-list arrays; cull objects beyond the horizon or behind the camera; at most ~40 active entities; reduce parallax layers and particles on low-end devices (an "Effects: Full / Reduced" setting, auto-set by device benchmark).
**Phase 0 spike measures:** Skia Picture per frame plus the camera at the same time, on a low-end Android (3–4 GB RAM).

---

## 24. Safety, Accessibility & Age Range

**Audience change:** the request covers **children and older adults**, which is wider than Match Pose's 12–55.
- Kids: a "Parents: please supervise. Clear the space and keep pets away" note on the first run of the Kids preset. No accounts, ads or analytics (as in v1), so there are no extra child-data obligations. The store age rating stays general (4+ / Everyone) only if nothing else in the app conflicts. Re-check the rating against Match Pose's Expert levels ([§28](#28-open-questions)).
- Seniors: the **Gentle** preset (no jumping by default, low-impact hands-up jump, slow constant speed, shallow duck, rest breaks, generous grace). A "Have a chair or wall nearby for balance" tip.

**Safety rules in the app:**
- A safety card before the first run (once, and from How to Play page 6): clear space, shoes or bare feet on a non-slip surface, stop if dizzy or in pain, mind the space to the sides.
- **Session reminder** every 10 min of continuous play: "Time for a water break?" (dismissable).
- **Never require** more lateral movement than the calibrated lane width, and never require moves faster than the recovery floor.
- Auto-pause when tracking is lost, so the user never keeps playing blind.
- Rest break option for timed runs.

**Accessibility:**
- **Seated mode** (upper-body framing, lanes by hip/shoulder lean, hands-up jump, head-bow duck).
- **Moves: lanes only** for users who can't jump or duck.
- Big text and controls, colour + **shape/icon** coding (not colour alone) for obstacles and lines, voice prompts for all key moments, `accessibilityLabel`s on all controls, and the speed dial also has ± buttons (no drag-only controls).

---

## 25. Testing Strategy
| Layer | How |
|---|---|
| Motion detectors | Jest with **recorded fixtures** (record with the existing `dev/pose-recorder`, extended to save raw streams): hop L/R, jump, duck (head bow, squat), side-hop with head rise, landing dip, tiptoe stretch, walking toward camera, partial occlusion. Plus **synthetic streams** from `skeletonToFrame` (exact offsets). Assert events, timing and no false positives |
| Calibration | Median robustness with jittered samples; fit-check outcomes for near/far/off-center users |
| Generator + fairness | 10,000 chunks × every preset × seeds → 100% solvable; obstacle types respect enabled moves |
| Speed / scoring / collision / grace | Pure unit tests (table-driven) |
| Sim + session | Deterministic seeded runs: a scripted perfect input finishes a 2 min timed run with 0 hits; scripted "no input" loses 3 lives at the expected times |
| Difficulty config | Presets resolve, multipliers in range, Custom detection |
| UI | `@testing-library/react-native` for Difficulty screen (preset → custom switching, dial ±, toggle visibility) and How to Play paging |
| End-to-end (no camera) | Demo mode + demo bot runs for 60 s without crash (Jest/Playwright web) |
| Real-device playtests | 8–12 people: 2 kids (8–11), 2 seniors (60+), adults of mixed heights; phone & web; lighting variations. Measure: move recognition rate (target ≥ 97% for intentional moves), false positives (≤ 1 per 2 min), perceived latency, fun |

---

## 26. Roadmap / Phases
| Phase | Scope | Exit criteria | Est. |
|---|---|---|---|
| **0. Spike** | Skia Picture-per-frame renderer + camera running together; 30 Hz pose emit; contain-fit; quick jump/lane detector on the debug screen | 60 FPS game view + live camera on a mid Android and an iPhone, ≥ 30 FPS on low-end; decide JS-thread vs UI-thread sim | 2–3 days |
| **1. Core extensions** | §18 changes: `fitTransform`, `resizeMode`, `emitIntervalMs`, smoothing presets, `GuideOverlay`, `bodyMetrics`, simulator offsets, shared UI moves; Match Pose regression check | Match Pose unchanged; guides render correctly on front/back camera, native & web | 3–4 days |
| **2. Motion engine** | Calibration, lane tracker, jump, duck, tracking monitor, baseline adapter, controller; fixtures + tests; debug screen `app/dev/runner-motion.tsx` showing guides + events log | All motion tests green; on device, intentional moves recognized ≥ 95% by the team | 1–1.5 weeks |
| **3. Game engine & renderer** | World, sim, generator + patterns + fairness, collisions + grace, speed modes, scoring, session machine; pseudo-3D renderer (native + web); keyboard controls | Playable with keyboard on web and with body on device | 1.5–2 weeks |
| **4. Screens & UX** | Home, Difficulty (dial, toggle, presets, options), How to Play (6 pages + demos), Training Run, HUD, overlays, Pause, Result; store + persistence; sounds/voice/haptics; demo bot | Full flow end-to-end on all platforms | 1.5 weeks |
| **5. Tuning & QA** | Playtests (kids, seniors, adults); tune thresholds, speeds, gaps, grace, presets; low-end perf; browsers | Recognition ≥ 97%, false positives ≤ 1 / 2 min; Kids & Gentle presets completable by testers | 1 week |
| **6. Polish & release** | Character art polish, themes, particles, music, store screenshots, hub card artwork | Shipped via EAS + Vercel | 3–5 days |
| **7. Later (v1.1+)** | Power-ups, long walls, touch swipe, avatar arm mirroring, calorie estimate, environment themes, run-in-place speed boost, achievements, daily challenge seed | — | — |

**Total v1:** about 6–7 weeks for one developer (motion and core work is the riskiest, so it comes first).

---

## 27. Risks & Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Side-hop triggers jump | Unwanted jumps | Lateral-displacement filter (§4.7), clear How to Play instruction, tuning with fixtures, harmless in most situations |
| Landing from a jump triggers duck | Unwanted slides | 250 ms landing suppression; duck line well below landing dip |
| Detection latency feels laggy | Unfair hits, frustration | 30 Hz emit, responsive smoothing, grace window, early visibility (45 m horizon), hints |
| User drifts forward/back | Lines in the wrong place | Baseline adapter (§4.10), recalibrate in Pause |
| Small rooms can't fit 3 lanes | Can't play | Auto-shrink lane width in calibration; Narrow option; "step back" guidance; seated / lanes-narrow modes |
| Kids' small bodies or seniors' small moves | Moves not recognized | Everything scaled by torso length; presets with low lines + narrow lanes; Training Run auto-tune suggestion |
| JS-thread jank (TTS, GC) on low-end Android | Stutter | Fixed timestep, pools, no per-frame allocations; UI-thread worklet fallback (§16.1); reduced effects |
| Skia + camera + inference GPU contention | Low FPS | Phase 0 spike; reduced effects; lite model by default on low-end |
| Falls / injury (jumping, kids, seniors) | Safety | Safety cards, Gentle preset, low-impact jump, rest breaks, recovery floor, auto-pause |
| Back camera / mirroring confusion in guides | Wrong L/R labels | Canonical space + one conversion function + tests for both facings |
| Second person walks into view | Tracking jumps to the other person | How to Play note; tracking monitor detects sudden hip jumps (> 2 × halfLane in one sample) → ignore that sample, and after 3 more such samples prompt recalibration |

---

## 28. Open Questions

### Confirmed decisions
| Topic | Decision |
|---|---|
| Name & id | Title **"Free Run"**, folder/route `endless-runner` |
| Phone layout | **Portrait split**: game on top (~58%), camera with guides below (~42%); camera full-screen during calibration and the Training Run (§3.2) |
| Lane model | **Absolute**: the lane you stand in on camera is the lane you run in (§4.4) |
| Visual style | **Pseudo-3D** track drawn with Skia (native) / canvas 2D (web) (§17). Real 3D stays a v2 option |
| Speed dial | **10 named steps** (Stroll … Max) with big –/+ buttons (§8.1) |

### Still open (the plan uses the default shown)
1. **Duck:** default "head below the line, any way" (head bow or knee bend), with a "Knees only" option.
2. **Extra difficulty options:** all of §8.3 in v1, or move some to v1.1 (e.g. rest breaks, seated mode)? Power-ups are already v1.1.
3. **Age rating:** with kids now included, keep the store rating at 12+ (because of Match Pose Expert levels), or target "Everyone" and hide Expert levels behind a setting?
4. **Lives default:** 3 hearts for Normal, unlimited for Kids and Gentle.
5. **Calorie estimate:** planned for v1.1 (needs an optional body-weight input).

# AR Games — Implementation Plan

> A React Native (iOS + Android + Web) app hosting multiple camera-based, body-tracking games.
> Game #1: **Match Pose** — copy the on-screen pose with your body, hold it, level up.
> Future games: **Free Run**, etc.

Status: **Planning only** — nothing in this document has been executed yet.
Research date: **Oct 2026** (versions below were current at that time — re-verify before scaffolding).

---

## Table of Contents

1. [Goals & Non-Goals](#1-goals--non-goals)
2. [Research Summary & Tech Stack Decision](#2-research-summary--tech-stack-decision)
3. [High-Level Architecture](#3-high-level-architecture)
4. [Folder Structure](#4-folder-structure)
5. [Core Pose Engine (shared by all games)](#5-core-pose-engine-shared-by-all-games)
6. [Game Plug-in System](#6-game-plug-in-system)
7. [Match Pose Game — Design](#7-match-pose-game--design)
8. [Pose Matching Algorithm](#8-pose-matching-algorithm)
9. [Pose Library & Level Design (30 levels)](#9-pose-library--level-design-30-levels)
10. [UI / UX (based on reference image)](#10-ui--ux-based-on-reference-image)
11. [State, Storage, Audio, Haptics](#11-state-storage-audio-haptics)
12. [Performance Budget](#12-performance-budget)
13. [Testing Strategy](#13-testing-strategy)
14. [Build, Run & Deploy](#14-build-run--deploy)
15. [Privacy, Safety & Permissions](#15-privacy-safety--permissions)
16. [Roadmap / Phases](#16-roadmap--phases)
17. [Future Games (Free Run, etc.)](#17-future-games-free-run-etc)
18. [Risks & Mitigations](#18-risks--mitigations)
19. [Open Questions for You](#19-open-questions-for-you)

---

## 1. Goals & Non-Goals

### Goals
- One app ("AR Games") that hosts **many** games. Each game sits in its **own folder** and plugs into a registry.
- Live camera feed with a **real-time skeleton overlay** (body keypoints and bones) drawn on the user.
- **Match Pose** game:
  - Shows a target pose (illustration + name) and the user copies it.
  - Real-time per-body-part feedback (Head / Left Arm / Right Arm / Torso / Left Leg / Right Leg ✅ / ⚠️).
  - The pose must be **held** for N seconds. Hold time and tolerance set the difficulty.
  - **30 levels** across Easy, Medium, Hard, and Expert, with stars, a score, and progression.
  - Easy to add more poses and levels later, because they are data rather than code.
- Runs on **iOS, Android and Web** from one codebase.
- **All processing on-device.** No video leaves the phone or browser.

### Non-Goals (for v1)
- Multiplayer, accounts, cloud sync, leaderboards (designed for, not built).
- Multi-person tracking (single player only).
- True 3D AR (world anchors/ARKit planes). "AR" here means overlaying graphics on the live camera.

---

## 2. Research Summary & Tech Stack Decision

### 2.1 Pose detection model — **MediaPipe Pose Landmarker (BlazePose)** ✅

| Option | Keypoints | Native | Web | Verdict |
|---|---|---|---|---|
| **MediaPipe Pose Landmarker** (lite/full/heavy `.task`) | **33** (incl. heels, foot index, hands) + 3D world coords + visibility | iOS (Swift pod `MediaPipeTasksVision`), Android (`com.google.mediapipe:tasks-vision`) with GPU delegate | `@mediapipe/tasks-vision` (WASM + WebGL/WebGPU), **1.1.1** stable as of Oct 2026 | **Chosen.** Same model on all 3 platforms, so pose definitions and thresholds carry over unchanged |
| MoveNet (TFLite via `react-native-fast-tflite`) | 17 | Yes | via TF.js | No feet, hands, or 3D; weaker for balance and handstand poses |
| ML Kit Pose Detection | 33 | Yes | **No web** | Breaks the web requirement |
| Apple Vision / ARKit body | varies | iOS only | No | Not cross-platform |

Why the same model everywhere matters: pose definitions (target angles, tolerances) are tuned against one model's output. Using different models on web and native would mean tuning twice.

**Model variants:**
- `pose_landmarker_lite.task` (~5 MB). Default on web and on low/mid phones.
- `pose_landmarker_full.task` (~9 MB). Default on high-end phones; better for hard poses.
- `heavy`. Not used, because it is too slow for real-time on mobile.

Native inference is about **10–20 ms per frame** with the GPU delegate (reported on iPhone 16 Pro Max and Pixel 7).

### 2.2 App framework — **Expo (SDK 58, RN 0.88, New Architecture)** ✅

- Expo SDK 58 (Oct 2026) targets React Native 0.88 and React 19.3. The New Architecture is always on.
- **Expo Router** gives file-based routing that works on native **and** web from one codebase.
- **Expo Go will NOT work** because we need a native ML module. We use **Development Builds** (`expo run:ios|android` / EAS Build). This is standard and fine.
- Web via `react-native-web` (bundled by Expo) → static export → deployable to Vercel or any static host.

### 2.3 Camera — platform-split

| Platform | Library | Notes |
|---|---|---|
| iOS / Android | **`react-native-vision-camera` v5** (+ `react-native-vision-camera-worklets`, `react-native-worklets`, `react-native-nitro-modules`, `react-native-nitro-image`) | V5 (Apr 2026) was rewritten on Nitro Modules. Frame processing is `useFrameOutput({ onFrame })`, and native frame plugins are now **typed Nitro HybridObjects**. Frame output can write directly into Reanimated SharedValues, which is ideal for drawing the skeleton on the UI thread. |
| Web | Browser `getUserMedia` + `<video>` element | Feeds `PoseLandmarker.detectForVideo()` inside `requestVideoFrameCallback`. |

### 2.4 Native MediaPipe bridge — **own local Nitro module on VisionCamera v5** ✅ DECIDED

Existing community wrappers we evaluated:

| Package | Targets | Concern |
|---|---|---|
| `react-native-mediapipe-pose-plugin` (munishbp) | VisionCamera **v4**, worklets-core | Production-validated, but on the v4 plugin API |
| `react-native-mediapipe-posedetection` | VisionCamera **v4** | Throttles to ~15 FPS; v4 API |
| `vision-camera-pose-landmarks-plugin` | VisionCamera v4 | Small project; bundles the full model |
| `expo-mediapipe-pose` (YosefHayim) | Expo SDK 57, own camera view | Very young (v0.3); ships its own camera, so less control |

**Decision (confirmed):** write a small **in-repo native module** at `modules/pose-landmarker/` (about 300–500 lines of Swift + Kotlin). It exposes a typed VisionCamera v5 frame plugin `poseLandmarker.detect(frame): PoseResult`. Use `react-native-mediapipe-pose-plugin`'s source (MIT) as the reference implementation for the MediaPipe calls, coordinate transforms, and GPU→CPU fallback.

- Pros: Works with the latest stack, we own it, it is typed, and it stays tunable (model choice, confidence thresholds, delegate).
- Cons: Some native code (Swift/Kotlin) has to be written and maintained.

**Why not VisionCamera v4:** v4 needs `react-native-worklets-core`, which collides with Software Mansion's `react-native-worklets` (required by Reanimated 4 and Skia). On React Native 0.83+ this breaks Android builds (duplicate `WorkletsPackage` class), and the two worklet Babel plugins are mutually exclusive. v5 uses `react-native-worklets` natively, so the whole stack shares one worklet runtime and frame output can write straight into Reanimated SharedValues.

#### Native module design (`modules/pose-landmarker/`)

```ts
// modules/pose-landmarker/src/PoseLandmarker.nitro.ts
import type { HybridObject } from 'react-native-nitro-modules';
import type { Frame } from 'react-native-vision-camera';

export interface PoseLandmarkerConfig {
  model: 'lite' | 'full';
  delegate: 'gpu' | 'cpu';
  minPoseDetectionConfidence: number;   // default 0.5
  minPosePresenceConfidence: number;    // default 0.5
  minTrackingConfidence: number;        // default 0.5
}

export interface NativeLandmark { x: number; y: number; z: number; visibility: number }

export interface PoseResult {
  landmarks: NativeLandmark[];          // 33, normalized, already rotated to preview orientation
  worldLandmarks: NativeLandmark[];     // 33, meters, hip-centered
  inferenceMs: number;
  timestampMs: number;
}

export interface PoseLandmarker extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  configure(config: PoseLandmarkerConfig): void;
  detect(frame: Frame): PoseResult | undefined;  // synchronous, called inside onFrame worklet
  readonly isGpu: boolean;                       // false if it fell back to CPU
  release(): void;
}
```

- **iOS (Swift):** `MediaPipeTasksVision` pod; `PoseLandmarker` in `.video` running mode; convert `CVPixelBuffer` from the Frame to `MPImage` with correct `UIImage.Orientation`; GPU delegate with CPU fallback.
- **Android (Kotlin):** `com.google.mediapipe:tasks-vision`; build `MPImage` from the frame's `HardwareBuffer`/`Image` (or RGBA via `react-native-vision-camera-resizer`); `RunningMode.VIDEO`; GPU delegate with CPU fallback.
- **Frame format:** request `pixelFormat: 'rgb'` (or `'yuv'` + GPU resizer to RGBA at ~256–480 px). Pick whichever benchmarks faster in Phase 0.
- **Orientation & mirroring:** done natively so JS always receives landmarks in *preview* coordinates with the subject's own left/right.
- **Expo config plugin** (`modules/pose-landmarker/expo-plugin/`): copies `.task` models into the iOS bundle and Android `assets/`, and adds the pod/gradle dependency.
- Generated with `nitrogen` (Nitro codegen); tested from a tiny example screen in `app/dev/pose-debug.tsx`.

> Phase 0 spike: get this module running on 1 Android + 1 iPhone and drawing a skeleton before anything else.

### 2.5 Rendering the skeleton overlay

| Platform | Choice | Why |
|---|---|---|
| Native | **`@shopify/react-native-skia`** `<Canvas>` overlay driven by Reanimated SharedValues | Draws at camera FPS on the UI thread without React re-renders |
| Web | Plain HTML `<canvas>` 2D context | Zero extra weight; Skia-on-web needs a ~3 MB CanvasKit WASM download |

Both implement the same `<SkeletonOverlay landmarks colorsByPart />` component API via `.native.tsx` / `.web.tsx` files.

### 2.6 Rest of the stack

| Concern | Choice |
|---|---|
| Language | TypeScript (strict) |
| Navigation | Expo Router |
| Animation | Reanimated 4 |
| State | **Zustand** (+ `persist` middleware) |
| Persistence | `react-native-mmkv` on native, `localStorage` on web (via a storage adapter) |
| Sound effects | `expo-audio` |
| Voice cues ("Lift your right leg higher") | `expo-speech` (TTS). The user stands 2–3 m from the phone and can't read small text |
| Haptics | `expo-haptics` (no-op on web) |
| Device tilt (correct camera roll) | `expo-sensors` accelerometer |
| Keep screen awake during play | `expo-keep-awake` |
| Styling | `StyleSheet` + one theme (`src/core/ui/theme.ts`, token-based so more themes can be added later) |
| Unit tests | Jest + `jest-expo` |
| E2E | Maestro (mobile), Playwright (web) |
| Lint/format | ESLint (expo config) + Prettier |
| CI/CD | To be decided later (candidates: GitHub Actions, EAS Build/Submit, Vercel for web) |

---

## 3. High-Level Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                               APP SHELL                                │
│  Expo Router · Home (Game Hub) · Settings · Permissions · Onboarding   │
└──────────────┬─────────────────────────────────────────────────────────┘
               │ loads games from registry
┌──────────────▼────────────────┐   ┌───────────────────────────────────┐
│       GAMES (plug-ins)        │   │          (future games)           │
│  games/match-pose/            │   │  games/free-run/  games/...       │
│   screens · engine · data     │   │                                   │
└──────────────┬────────────────┘   └───────────────┬───────────────────┘
               │ consumes PoseFrame stream           │
┌──────────────▼─────────────────────────────────────▼───────────────────┐
│                         CORE POSE ENGINE (shared)                       │
│  PoseProvider (context) → usePose() / usePoseSharedValue()              │
│  processing: smoothing (One-Euro) · mirroring · normalization ·         │
│              geometry (angles, segment orientation) · visibility gate   │
│  motion (future): velocity · jumps · running-in-place · lean            │
└──────────────┬──────────────────────────────────────┬──────────────────┘
               │ PoseSource interface                 │
┌──────────────▼──────────────────┐   ┌───────────────▼──────────────────┐
│ NATIVE (iOS/Android)            │   │ WEB                              │
│ VisionCamera v5 useFrameOutput  │   │ getUserMedia → <video>           │
│ → modules/pose-landmarker       │   │ → @mediapipe/tasks-vision        │
│   (MediaPipe Tasks, GPU)        │   │   PoseLandmarker (WASM + GPU)    │
│ → SharedValue (UI thread)       │   │ → requestVideoFrameCallback      │
└─────────────────────────────────┘   └──────────────────────────────────┘
```

**Data flow per frame (native):**
1. Camera frame → worklet `onFrame` (camera thread).
2. `poseLandmarker.detect(frame)` → 33 landmarks (normalized 0–1) + world landmarks.
3. Write to `posesSV` (Reanimated SharedValue), which the Skia overlay redraws on the UI thread.
4. Throttled (~15 Hz) `scheduleOnRN` → JS thread → smoothing → **game engine** (matcher, hold timer, feedback, UI state).

The overlay runs at camera FPS (smooth visuals). Game logic runs at about 15 Hz (cheap, and plenty for gameplay).

---

## 4. Folder Structure

```
AR-games/
├── app/                                  # Expo Router routes. THIN: only re-export screens
│   ├── _layout.tsx                       # Root providers (theme, PoseProvider lazy, stores)
│   ├── index.tsx                         # Game Hub (list of games from registry)
│   ├── settings.tsx                      # Camera facing, model quality, sound, voice, units
│   ├── onboarding.tsx                    # Permissions + "place your phone" + safety
│   ├── dev/                              # __DEV__-only tools
│   │   ├── pose-recorder.tsx             # Record a real person's pose → export JSON definition
│   │   └── pose-debug.tsx                # Live angles/visibility readout
│   └── games/
│       └── match-pose/
│           ├── _layout.tsx
│           ├── index.tsx                 # → games/match-pose/screens/LevelSelectScreen
│           ├── play/[levelId].tsx        # → PlayScreen
│           └── result/[levelId].tsx      # → ResultScreen
│
├── src/
│   ├── core/                             # Shared by ALL games. No game-specific code here
│   │   ├── pose/
│   │   │   ├── types.ts                  # Landmark, PoseFrame, PoseSource, BodyPart
│   │   │   ├── landmarks.ts              # 33 indices, bone connections, body-part grouping
│   │   │   ├── PoseProvider.tsx          # Context: start/stop, model loading, status
│   │   │   ├── usePose.ts                # JS-thread throttled pose stream
│   │   │   ├── usePoseSharedValue.ts     # UI-thread pose (for overlays)
│   │   │   ├── source/
│   │   │   │   ├── PoseSource.ts         # Interface
│   │   │   │   ├── nativePoseSource.ts   # VisionCamera v5 + modules/pose-landmarker
│   │   │   │   ├── webPoseSource.ts      # @mediapipe/tasks-vision
│   │   │   │   └── mockPoseSource.ts     # Replays recorded JSON (tests, Storybook, simulator)
│   │   │   ├── processing/
│   │   │   │   ├── oneEuroFilter.ts      # Jitter smoothing
│   │   │   │   ├── geometry.ts           # jointAngle(a,b,c), segmentAngle(a,b), distances
│   │   │   │   ├── normalize.ts          # Scale by torso length, center on hips
│   │   │   │   ├── mirror.ts             # Front-camera mirroring / L↔R swap
│   │   │   │   └── visibility.ts         # Visibility gating, "full body in frame" check
│   │   │   └── motion/                   # (future: Free Run) velocity, jump, step detection
│   │   ├── camera/
│   │   │   ├── CameraView.native.tsx     # VisionCamera v5 <Camera outputs={[frameOutput]}>
│   │   │   ├── CameraView.web.tsx        # <video> + getUserMedia
│   │   │   ├── useCameraPermission.ts
│   │   │   └── FramingGuide.tsx          # "Step back — show your whole body"
│   │   ├── overlay/
│   │   │   ├── SkeletonOverlay.native.tsx  # Skia
│   │   │   ├── SkeletonOverlay.web.tsx     # <canvas> 2D
│   │   │   └── skeletonStyle.ts            # Colors per body-part status
│   │   ├── ui/                           # Design system (Button, Card, ProgressBar,
│   │   │   ├── theme.ts                  # CountdownRing, ScoreBadge, StarRating, Modal, …)
│   │   │   └── components/
│   │   ├── audio/                        # sfx.ts, voice.ts (expo-speech wrapper)
│   │   ├── haptics/
│   │   ├── storage/                      # kv.ts (MMKV native / localStorage web)
│   │   ├── sensors/                      # deviceTilt.ts (accelerometer roll correction)
│   │   └── utils/
│   │
│   └── games/
│       ├── registry.ts                   # [matchPoseManifest, /* freeRunManifest */]
│       ├── types.ts                      # GameManifest interface
│       │
│       ├── match-pose/                   # ← GAME #1 (fully self-contained)
│       │   ├── manifest.ts               # id, title, icon, color, route, requirements
│       │   ├── screens/
│       │   │   ├── LevelSelectScreen.tsx
│       │   │   ├── PlayScreen.tsx
│       │   │   └── ResultScreen.tsx
│       │   ├── components/
│       │   │   ├── TargetPoseCard.tsx    # "Copy this pose!" + illustration + countdown ring
│       │   │   ├── NextPoseCard.tsx
│       │   │   ├── DetectedPosePanel.tsx # Mini skeleton + body-part checklist
│       │   │   ├── BodyPartChecklist.tsx
│       │   │   ├── HoldProgressRing.tsx
│       │   │   ├── FeedbackBanner.tsx    # "Try to lift your right leg higher"
│       │   │   ├── MatchMeter.tsx        # Live % match
│       │   │   ├── ScoreHud.tsx
│       │   │   └── PoseFigure.tsx        # Renders target pose as a stick figure from data
│       │   ├── engine/                   # Pure TS, no React → easy to unit test
│       │   │   ├── poseMatcher.ts        # PoseDefinition + PoseFrame → MatchResult
│       │   │   ├── holdStateMachine.ts   # idle → matching → holding → success/timeout
│       │   │   ├── levelRunner.ts        # Sequences poses in a level, timers, scoring
│       │   │   ├── scoring.ts            # Points, stars, accuracy
│       │   │   └── feedback.ts           # Worst body part → human-readable cue
│       │   ├── data/
│       │   │   ├── poses/                # One file per pose definition (data-only)
│       │   │   │   ├── index.ts
│       │   │   │   ├── t-pose.ts
│       │   │   │   ├── star.ts
│       │   │   │   ├── squat.ts
│       │   │   │   ├── tree-left.ts
│       │   │   │   └── …
│       │   │   └── levels.ts             # 30 levels (data-only)
│       │   ├── store/
│       │   │   └── progressStore.ts      # unlocked levels, stars, best scores
│       │   ├── assets/
│       │   │   ├── poses/                # Character illustrations per pose (png/webp)
│       │   │   └── sfx/
│       │   └── __tests__/
│       │       ├── fixtures/             # Recorded landmark JSON (correct/incorrect poses)
│       │       ├── poseMatcher.test.ts
│       │       ├── holdStateMachine.test.ts
│       │       └── levelRunner.test.ts
│       │
│       └── free-run/                     # (later) same shape: manifest, screens, engine, data
│
├── modules/
│   └── pose-landmarker/                  # Local native module (Nitro / VisionCamera v5 plugin)
│       ├── src/PoseLandmarker.nitro.ts   # Typed spec
│       ├── ios/                          # Swift: MediaPipeTasksVision, GPU (Metal) delegate
│       ├── android/                      # Kotlin: tasks-vision, GPU delegate, CPU fallback
│       └── expo-plugin/                  # Config plugin: copies .task model into native bundles
│
├── assets/
│   ├── models/
│   │   ├── pose_landmarker_lite.task
│   │   └── pose_landmarker_full.task
│   ├── fonts/
│   └── images/
├── public/                               # Web static: MediaPipe wasm + .task (self-hosted)
│   └── mediapipe/
├── e2e/                                  # Maestro flows + Playwright specs
├── app.config.ts                         # Camera permission strings, plugins, web config
├── eas.json
├── metro.config.js                       # add 'task' to assetExts
├── tsconfig.json                         # paths: @core/*, @games/*
└── plan.md
```

**Rules that keep games isolated:**
- `src/games/<game>/` may import from `src/core/**`, never from another game.
- `src/core/**` never imports from `src/games/**`.
- `app/games/<game>/*` route files only re-export screens. All logic lives in the game folder.
- Enforce with an ESLint `no-restricted-imports` rule (or `eslint-plugin-boundaries`).

---

## 5. Core Pose Engine (shared by all games)

### 5.1 Types

```ts
// src/core/pose/types.ts
export type Landmark = { x: number; y: number; z: number; visibility: number };
export type WorldLandmark = { x: number; y: number; z: number };   // meters, hip-centered

export interface PoseFrame {
  landmarks: Landmark[];          // 33, normalized [0..1] in *display* space (already mirrored)
  worldLandmarks?: WorldLandmark[];
  timestamp: number;              // ms
  imageWidth: number;
  imageHeight: number;
}

export interface PoseSource {
  start(opts: { facing: 'front' | 'back'; model: 'lite' | 'full' }): Promise<void>;
  stop(): void;
  subscribe(cb: (pose: PoseFrame | null) => void): () => void;
  status: 'idle' | 'loading-model' | 'running' | 'error';
}

export type BodyPart = 'head' | 'torso' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg';
```

### 5.2 Landmark map (MediaPipe 33)
`0 nose · 11/12 shoulders · 13/14 elbows · 15/16 wrists · 23/24 hips · 25/26 knees · 27/28 ankles · 29/30 heels · 31/32 foot index` (+ face/hand points).
`landmarks.ts` exports the indices, the `BONES` connection list for drawing, and the `BODY_PART_OF` mapping (e.g. leftArm = 11-13-15).

### 5.3 Processing pipeline (JS thread, ~15 Hz)
1. **Visibility gate.** Landmarks with `visibility < 0.5` are marked unknown. Body parts with unknown joints are shown as "not visible" rather than as wrong.
2. **Mirroring.** On the front camera, the preview is mirrored. MediaPipe's `left` always means the **subject's** left. We keep that semantic ("left leg" = user's own left leg) and only mirror the *x coordinate for drawing*.
3. **Smoothing.** A One-Euro filter per landmark (low lag when moving, steady when still). This is essential for "hold" detection.
4. **Tilt correction.** The accelerometer gives phone roll, and we rotate landmarks so "up" means gravity-up. Segment-orientation checks (handstand, plank) rely on this.
5. **Normalization.** Translate to the hip center and scale by torso length. This makes positional checks independent of distance from the camera.

### 5.4 Framing / readiness check
Before each level starts, a "Get Ready" step requires the full body to be visible (shoulders, hips, knees, ankles all visible for 1 s). Prompts: "Step back", "Move left", "Too close". This removes most false negatives.

---

## 6. Game Plug-in System

```ts
// src/games/types.ts
export interface GameManifest {
  id: string;                         // 'match-pose'
  title: string;                      // 'Match Pose'
  description: string;
  icon: ImageSourcePropType;
  accentColor: string;
  route: Href;                        // '/games/match-pose'
  requirements: {
    fullBody: boolean;
    recommendedDistanceMeters: [number, number];
    defaultCamera: 'front' | 'back';
  };
  status: 'available' | 'coming-soon';
}

// src/games/registry.ts
export const GAMES: GameManifest[] = [matchPoseManifest /*, freeRunManifest */];
```

The Home screen renders `GAMES`. Adding a game means creating a folder, writing a manifest, adding a route folder, and adding one line to the registry.

---

## 7. Match Pose Game — Design

### 7.1 Core loop
```
Level Select → Get Ready (framing check, 3-2-1)
  → for each pose in level:
       show Target Pose + countdown (time limit to get into pose)
       live: skeleton overlay colored by part status, match %, voice cues
       when match ≥ threshold → hold timer fills; dips < grace window don't reset
       hold complete → "Perfect!/Great!/Good!" + points → next pose
       time runs out → "Missed" → next pose
  → Result: score, stars, accuracy, unlock next level
```

### 7.2 Hold state machine (`engine/holdStateMachine.ts`)
```
IDLE ──score≥enter──▶ HOLDING ──held≥holdTime──▶ SUCCESS
  ▲                    │  score<exit for > graceMs
  └────────────────────┘
any state ──timeLimit elapsed──▶ TIMEOUT
```
- **Hysteresis:** enter at `matchThreshold` (e.g. 0.80), exit only below `matchThreshold - 0.08`. This prevents flicker.
- **Grace window:** about 400 ms below exit before the hold resets (or the hold pauses instead of resetting on Easy).
- Easy: hold progress **pauses** on a break. Hard: hold progress **resets** on a break.

### 7.3 Scoring
- Per pose: `points = 100 × avgAccuracyDuringHold × difficultyMultiplier + timeBonus(remainingTime)`.
- Rating label from average accuracy: ≥ 0.95 "Perfect!", ≥ 0.88 "Great!", ≥ threshold "Good!".
- Level stars: ★ = pass (≥ `passRatio` of poses matched), ★★ = all matched, ★★★ = all matched with avg accuracy ≥ 0.90.
- Next level unlocks on ★.

---

## 8. Pose Matching Algorithm

### 8.1 Pose definitions are data
Each pose is described with **angles** (invariant to body size and distance) plus a few **relations** for cases angles can't express.

```ts
// src/games/match-pose/data/poses/tree-left.ts
export const treeLeft: PoseDefinition = {
  id: 'tree-left',
  name: 'Tree Pose (Left)',
  difficulty: 'medium',
  view: 'front',                          // which way the user should face the camera
  illustration: require('../../assets/poses/tree-left.webp'),
  mirrorOf: 'tree-right',                 // auto-generate the mirrored pose
  joints: [
    // angle at vertex `b` formed by a-b-c, in degrees
    { part: 'leftLeg',  a: 'leftHip',  b: 'leftKnee',  c: 'leftAnkle',  target: 175, tol: 15, weight: 2 },
    { part: 'rightLeg', a: 'rightHip', b: 'rightKnee', c: 'rightAnkle', target: 45,  tol: 20, weight: 2 },
    { part: 'leftArm',  a: 'leftShoulder',  b: 'leftElbow',  c: 'leftWrist',  target: 60, tol: 30, weight: 1 },
    { part: 'rightArm', a: 'rightShoulder', b: 'rightElbow', c: 'rightWrist', target: 60, tol: 30, weight: 1 },
  ],
  segments: [
    // orientation of a bone vs gravity-up (0° = pointing up, 180° = down)
    { part: 'torso', from: 'midHip', to: 'midShoulder', target: 0, tol: 15, weight: 1 },
  ],
  relations: [
    { part: 'rightLeg', type: 'above', a: 'rightAnkle', b: 'leftKnee', critical: true },
    { part: 'leftArm',  type: 'near',  a: 'leftWrist',  b: 'rightWrist', maxDist: 0.25 }, // hands together
  ],
  cues: {
    rightLeg: 'Lift your right foot higher onto your left leg',
    torso: 'Stand up straight',
    leftArm: 'Bring your hands together',
  },
};
```

### 8.2 Scoring a frame
For each constraint:
```
Δ = |measured − target|           (angles wrap at 360°)
score = 1                          if Δ ≤ tol
      = 1 − (Δ − tol)/tol          if tol < Δ < 2·tol   (linear falloff)
      = 0                          otherwise
```
- **Body-part status:** the minimum constraint score in that part. ≥ 0.85 → ✅ green, ≥ 0.5 → ⚠️ yellow, else ❌ red. Part not visible → grey.
- **Overall match:** the weighted mean of the constraint scores. Any failed `critical` relation caps the overall score at 0.5.
- **Feedback cue:** the part with the lowest weighted score → `cues[part]`, or an auto-generated cue from the angle direction ("Bend your right knee more" / "Straighten your left arm"). Spoken via TTS at most once every 3 s.

### 8.3 Why angles + segment orientation (not raw keypoint distance)
- Joint angles don't change with height, distance, or position in the frame.
- Angles alone can't tell **standing vs handstand** or **plank vs standing**, because the body has the same shape in a different orientation. **Segment orientation vs gravity** (with the phone-tilt correction) fixes this.
- Optional later upgrade: use MediaPipe **world landmarks** (3D, meters) for side-view poses where 2D angles are foreshortened.

### 8.4 Authoring poses — the Pose Recorder (dev tool)
`app/dev/pose-recorder.tsx`: a person performs the pose, presses record, and 2 s of smoothed frames are averaged. The tool exports `joints` with measured angles plus default tolerances as a TS/JSON snippet, which can then be hand-tuned. It also saves the frames as **test fixtures**.

---

## 9. Pose Library & Level Design (30 levels)

### 9.1 Level model
Following the reference image ("Level 2 · 3/10"), **a level is a sequence of poses**:

```ts
export interface LevelDefinition {
  id: number;                       // 1..30
  tier: 'easy' | 'medium' | 'hard' | 'expert';
  title: string;
  poses: string[];                  // pose ids, in order (or { pool, count, shuffle })
  holdSeconds: number;              // required hold time per pose
  timeLimitSeconds: number;         // time to get into the pose (countdown ring)
  matchThreshold: number;           // 0.75 → 0.88 as difficulty increases
  toleranceScale: number;           // multiplies each pose's tol (1.3 easy → 0.8 expert)
  holdBreakBehavior: 'pause' | 'reset';
  passRatio: number;                // fraction of poses that must be matched to pass
  safetyWarning?: boolean;          // show before handstand/crow etc.
}
```
Difficulty therefore comes from **4 knobs**: pose complexity, hold time, tolerance strictness, and time limit. New levels are pure data.

### 9.2 Pose library (initial ~26 poses; mirrored variants auto-generated)

| Tier | Poses | View |
|---|---|---|
| **Easy** | Arms Up (Y), T-Pose, Hands on Hips, Star (X), Goal-Post Arms, Side Stretch L/R, Half Squat, Knee Lift L/R, Arms Forward | Front |
| **Medium** | Full Squat, Chair Pose, Forward Lunge L/R, Warrior II L/R, Tree L/R, Goddess (Sumo) Squat, Warrior I L/R, High Plank | Front (plank: side) |
| **Hard** | Warrior III / Airplane L/R, Side Plank L/R, Dancer L/R, Boat Pose, Downward Dog, Crescent Lunge, Half Moon L/R | Mixed |
| **Expert** | Crow Pose, **Wall-Assisted Handstand**, Pistol Squat (assisted) | Side / Front |

### 9.3 Level table (v1: 30 levels)

| # | Tier | Poses (count) | Hold (s) | Time limit (s) | Threshold | Tol × | Break |
|---|---|---|---|---|---|---|---|
| 1 | Easy | Arms Up, T-Pose, Hands on Hips (3) | 2 | 12 | 0.75 | 1.3 | pause |
| 2 | Easy | T-Pose, Star, Arms Up, Goal-Post (4) | 2 | 12 | 0.75 | 1.3 | pause |
| 3 | Easy | Side Stretch L/R, Arms Forward, Star (4) | 3 | 12 | 0.75 | 1.25 | pause |
| 4 | Easy | Half Squat, Arms Up, T-Pose, Hands on Hips (4) | 3 | 10 | 0.76 | 1.25 | pause |
| 5 | Easy | Knee Lift L/R, Star, Goal-Post (4) | 3 | 10 | 0.77 | 1.2 | pause |
| 6 | Easy | Random 5 from Easy pool | 3 | 10 | 0.78 | 1.2 | pause |
| 7 | Easy | Half Squat, Knee Lift L/R, Side Stretch L/R (5) | 4 | 10 | 0.78 | 1.15 | pause |
| 8 | Easy | Random 6 from Easy pool | 4 | 9 | 0.78 | 1.1 | pause |
| 9 | Easy | Random 6 from Easy pool | 4 | 8 | 0.80 | 1.1 | pause |
| 10 | Easy ⭐ | **Boss:** all 10 easy poses back-to-back | 3 | 8 | 0.80 | 1.0 | pause |
| 11 | Medium | Full Squat, Chair, Half Squat, Arms Up (4) | 4 | 12 | 0.80 | 1.1 | pause |
| 12 | Medium | Forward Lunge L/R, Star, T-Pose (4) | 4 | 12 | 0.80 | 1.1 | pause |
| 13 | Medium | Warrior II L/R, Goddess, Chair (4) | 5 | 12 | 0.80 | 1.05 | pause |
| 14 | Medium | Tree L/R, Knee Lift L/R (4) | 5 | 12 | 0.80 | 1.05 | pause |
| 15 | Medium | Warrior I L/R, Lunge L/R (4) | 5 | 11 | 0.82 | 1.0 | reset |
| 16 | Medium | Random 5 from Medium pool | 5 | 11 | 0.82 | 1.0 | reset |
| 17 | Medium | High Plank, Full Squat, Chair, Goddess (4) | 6 | 12 | 0.82 | 1.0 | reset |
| 18 | Medium | Tree L/R, Warrior II L/R, Chair (5) | 6 | 10 | 0.83 | 0.95 | reset |
| 19 | Medium | Random 6 from Medium pool | 6 | 10 | 0.84 | 0.95 | reset |
| 20 | Medium ⭐ | **Boss:** Squat→Chair→Warrior II L→Tree L→Warrior II R→Tree R→Plank | 5 | 10 | 0.84 | 0.95 | reset |
| 21 | Hard | Warrior III L/R, Tree L/R (4) | 5 | 14 | 0.84 | 0.95 | reset |
| 22 | Hard | Side Plank L/R, High Plank (3) | 6 | 14 | 0.84 | 0.95 | reset |
| 23 | Hard | Dancer L/R, Warrior III L/R (4) | 6 | 14 | 0.85 | 0.9 | reset |
| 24 | Hard | Boat, Downward Dog, High Plank (3) | 8 | 14 | 0.85 | 0.9 | reset |
| 25 | Hard | Crescent Lunge, Half Moon L/R, Warrior I (4) | 8 | 12 | 0.86 | 0.9 | reset |
| 26 | Hard | Random 5 from Hard pool | 8 | 12 | 0.86 | 0.85 | reset |
| 27 | Hard ⭐ | **Boss:** Tree→Warrior III→Dancer→Half Moon (each side) (8) | 6 | 12 | 0.86 | 0.85 | reset |
| 28 | Expert | Crow Pose ⚠️ (1, 3 attempts) | 3 | 20 | 0.82 | 0.9 | reset |
| 29 | Expert | **Wall-Assisted Handstand** ⚠️ (1, 3 attempts) | 5 | 25 | 0.80 | 1.0 | reset |
| 30 | Expert ⭐ | **Grand Finale:** Squat→Warrior III→Side Plank→Crow→Handstand | 5 | 20 | 0.85 | 0.85 | reset |

Notes:
- Thresholds are **starting values**. They get tuned in Phase 3 playtesting with the Pose Recorder plus 5–10 testers of different body types.
- "Random N from pool" uses a seeded shuffle, so a level stays stable for a player.
- Expert levels ⚠️ show a **safety screen** (clear space, soft surface, wall support) and can be skipped.

### 9.4 Target-pose illustrations
- **MVP:** `PoseFigure.tsx` renders the target pose as a clean, styled stick figure **computed from the pose definition** (or from the recorded reference frame). New poses get a visual for free.
- **Polish:** a consistent cartoon character (like the reference image), produced by commissioning an illustrator or generating with an AI image tool using a fixed character sheet for consistency. Export as WebP (~40–80 KB each).

---

## 10. UI / UX (based on reference image)

### 10.1 Play screen — portrait (phone)
```
┌──────────────────────────────────────┐
│ [⏸]  Level 2 ▓▓▓▓░░░░ 3/10   🏆 1200 │  ← top HUD
├──────────────────────────────────────┤
│  Copy this pose!          ┌─────┐    │
│  Star Pose   [character]  │  8  │    │  ← TargetPoseCard + CountdownRing
│                           └─────┘    │
├──────────────────────────────────────┤
│                                      │
│     LIVE CAMERA + SKELETON OVERLAY   │  ← bones green/yellow/red per part
│        (hold ring fills around       │
│         the player when matching)    │
│                                      │
│ ┌────────┐               ┌─────────┐ │
│ │Score   │               │ Good! ✔ │ │  ← ScoreHud + rating toast
│ │ 950    │               └─────────┘ │
└──────────────────────────────────────┘
```
**Variant B (the image's second screen):** split view with camera on the left and a "Detected Pose" panel on the right (mini skeleton + `BodyPartChecklist`), plus a `FeedbackBanner` at the bottom ("Try to lift your right leg higher"). Use this layout on **landscape / tablet / web desktop**. Portrait phone uses the overlay-first layout above with a collapsible checklist.

### 10.2 Visual language
- Dark navy background (`#0B1530`-ish), glassy cards with cyan/teal glow borders, green (`#3DDC84`) success, amber warning, rounded 20–24 px.
- Skeleton: 6–8 px bones, 10 px joints with a white center. Color per body-part status. Smooth color transitions via Reanimated.
- Big type. The player is 2–3 m away, so key info (countdown, match %, rating) must be readable from a distance. Voice cues back it up.

### 10.3 Other screens
- **Game Hub:** cards for each game ("Match Pose", "Free Run — coming soon").
- **Level Select:** grid of 30 nodes grouped by tier, with stars and a lock state.
- **Get Ready:** framing guide silhouette + "Place phone at waist height, step back 2–3 m" + 3-2-1.
- **Result:** stars animation, score, per-pose accuracy list, Retry / Next.
- **Pause:** resume / restart / quit. Pause automatically when the app is backgrounded.
- **Settings:** camera front/back, model quality (Auto / Battery saver / High accuracy), sound, voice cues, show-skeleton toggle, left-handed mirroring.

---

## 11. State, Storage, Audio, Haptics

- **Zustand stores:**
  - `core/settingsStore` (camera, model quality, audio).
  - `games/match-pose/store/progressStore` (per level: unlocked, bestScore, stars, attempts; totalTrophies).
- **Persistence adapter** (`core/storage/kv.ts`): MMKV on native, `localStorage` on web, wired into Zustand `persist`. Include a schema `version` + `migrate` for future level additions.
- **Live game state** (current pose, hold progress, match %) stays in component/engine state or SharedValues and is **not** persisted.
- **Audio:** countdown ticks, match "ding", success fanfare, fail buzz (`expo-audio`). Voice cues with `expo-speech`, rate-limited.
- **Haptics:** light on match start, success on hold complete (useful mostly when the phone is held, e.g. testing).

---

## 12. Performance Budget

| Item | Target |
|---|---|
| Camera preview | 30 FPS |
| Pose inference (native, GPU) | ≤ 25 ms/frame, ≥ 20 inferences/s |
| Pose inference (web, lite, GPU delegate) | ≥ 15 inferences/s on mid laptop / recent phone |
| Overlay draw | UI thread, no React re-render per frame |
| Game logic tick | ~15 Hz on JS thread |
| Model load time | < 1.5 s native (bundled), < 3 s web (cached after first load) |
| App size increase from ML | ~5–15 MB (lite + full model + MediaPipe runtime) |

Techniques:
- Request a modest camera format (e.g. 640×480 / 720p). Full 4K is wasted on a 256-px model input.
- Native: `useFrameOutput` with the frame dropping strategy. Always `frame.dispose()`.
- Pick the model automatically by a device benchmark on first launch (run 30 frames, then choose lite or full).
- Web: self-host WASM + model under `/public/mediapipe` with long cache headers. Move inference into a **Web Worker** if main-thread jank shows up.
- Pause the camera and inference when the screen is unfocused or the app is backgrounded (`useIsFocused`, `AppState`).

---

## 13. Testing Strategy

| Layer | How |
|---|---|
| Geometry / matcher / hold state machine / scoring | **Jest unit tests** with recorded landmark fixtures (correct pose, near-miss, wrong pose, partial visibility) |
| Level data integrity | Test that every level references existing pose ids, values are within ranges, and ids are unique |
| UI components | `@testing-library/react-native` + `mockPoseSource` replaying fixtures |
| Native pose module | Manual + Maestro on real devices (camera doesn't work in the iOS simulator) |
| Web | Playwright with Chrome's `--use-file-for-fake-video-capture` playing a recorded pose video → assert a level completes |
| Accuracy tuning | Playtest matrix: 5–10 people × different heights/body types/clothing/lighting; log match scores |
| Devices | Low-end Android (e.g. 3–4 GB RAM), mid Android, iPhone 12+, desktop Chrome/Safari/Firefox, iOS Safari, Android Chrome |

`mockPoseSource` also lets you develop UI on the simulator and in a browser without standing in front of a camera.

---

## 14. Build, Run & Deploy

### Dev
```bash
npx create-expo-app@latest AR-games --template default   # Expo Router + TS
npx expo install expo-dev-client react-native-reanimated react-native-worklets \
  @shopify/react-native-skia expo-audio expo-speech expo-haptics expo-sensors \
  expo-keep-awake react-native-mmkv
npm i react-native-vision-camera@5 react-native-vision-camera-worklets \
  react-native-vision-camera-resizer react-native-nitro-modules \
  react-native-nitro-image zustand
npm i -D nitrogen                          # codegen for modules/pose-landmarker
# Do NOT install react-native-worklets-core (v4-era; conflicts with react-native-worklets)
npm i @mediapipe/tasks-vision              # web
npx expo prebuild && npx expo run:android  # / run:ios  (dev build, not Expo Go)
npx expo start --web                       # web (needs HTTPS or localhost for camera)
```

### Config highlights
- `app.config.ts`: VisionCamera config plugin with the camera permission text, our `pose-landmarker` config plugin (bundles `.task` models), `expo-router`, web `output: 'static'`.
- `metro.config.js`: add `task` to `resolver.assetExts`.
- iOS: `NSCameraUsageDescription`. Android: `CAMERA` permission. No microphone needed.

### Deploy
- **Mobile:** EAS Build (development / preview / production profiles) → EAS Submit to App Store / Play Store. Use EAS Update for JS-only updates (new levels/poses ship without store review).
- **Web:** `npx expo export -p web` → static `dist/` → **Vercel** (HTTPS is required for camera access). Add cache headers for `/mediapipe/*`.

---

## 15. Privacy, Safety & Permissions

- **Privacy:** all inference on-device. No frames are recorded, stored, or uploaded. State this in onboarding and in store privacy labels ("Camera: used on-device only, not collected").
- **Permissions UX:** explain before the OS prompt. Handle "denied" with a deep link to Settings (native) or browser instructions (web).
- **Safety:** a one-time onboarding safety note (clear space, non-slip floor). Hard/Expert poses (handstand, crow, side plank) show a dedicated warning, can be skipped, and the handstand level is explicitly **wall-assisted**.
- **Accessibility:** voice cues, high-contrast mode, large text, and a "seated mode" pose pack later (data-only).
- **Audience 12–55:** ages 12 and up are included, so **under-13 users exist**. Keep the app free of accounts, ads and identifier-collecting analytics in v1 (local-only progress already ensures this). That avoids COPPA / GDPR-K data obligations. Use an app-store age rating of 12+ and add a "parents: supervise hard poses" note on Expert levels.
- **Age-appropriate difficulty:** hard poses are skippable. A settings toggle "Hide Expert levels" lets parents or players turn off handstand and crow.

---

## 16. Roadmap / Phases

| Phase | Scope | Exit criteria | Est. |
|---|---|---|---|
| **0. Spike** | Scaffold Expo SDK 58 app. Build `modules/pose-landmarker` (Nitro, Swift + Kotlin) as a VisionCamera v5 frame plugin on 1 Android + 1 iPhone. Web MediaPipe page. Draw the raw skeleton | 33 landmarks drawn live on all 3 platforms at target FPS; GPU delegate working with CPU fallback; RGB vs YUV+resizer benchmarked | 4–6 days |
| **1. Core engine** | `PoseSource` (native/web/mock), PoseProvider, smoothing, mirroring, tilt, geometry, framing check, SkeletonOverlay (Skia/canvas), settings store, storage adapter | Debug screen shows live angles; mock source replays fixtures | 1 week |
| **2. Game shell** | Game registry, Hub, routing, theme + UI kit, onboarding/permissions | Hub shows Match Pose; navigation works on all platforms | 3–4 days |
| **3. Match Pose engine** | Matcher, hold state machine, level runner, scoring, feedback, Pose Recorder tool; author ~26 poses; 30 level defs; unit tests | Levels 1–10 fully playable; tests green | 1.5–2 weeks |
| **4. Match Pose UI** | TargetPoseCard, countdown & hold rings, checklist, feedback banner, result, level select, pause, audio/voice/haptics, landscape layout | Matches reference-image look; levels 1–30 playable | 1–1.5 weeks |
| **5. Tuning & QA** | Playtests, threshold tuning, low-end device perf, web browsers, E2E | Pass-rate targets met (easy ≥ 90 % for testers, hard ≈ 40–60 %) | 1 week |
| **6. Polish & release** | Character illustrations, animations, app icons/splash, store listings, Vercel deploy | Store builds submitted; web live | 1 week |

**Total MVP:** roughly 6–8 weeks for one developer.

---

## 17. Future Games (Free Run, etc.)

The core is designed so new games mostly reuse `core/pose` and add their own `engine/`:

- **Free Run (endless runner):**
  - Run in place → speed (step frequency from knee/ankle oscillation in `core/pose/motion/stepDetector.ts`).
  - Jump → hip-center vertical velocity spike (`jumpDetector.ts`).
  - Duck/slide → squat detection (reuse the matcher's squat pose).
  - Lean left/right → lane change (shoulder-line tilt / hip x-offset).
  - Rendering: `react-native-skia` 2D or `react-three-fiber` (`@react-three/fiber/native` + `expo-gl`) for 3D.
- Other ideas: Fruit Slicer (wrists as blades), Wall Hole ("fit through the hole" = timed match-pose), Boxing (punch speed), Dance (sequence of poses on a beat, which reuses the Match Pose engine), Rep Counter (squats/jumping jacks).

To support these, add `core/pose/motion/` (velocity, oscillation, event detectors) when Free Run starts. Nothing in Match Pose needs to change.

---

## 18. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| VisionCamera v5 is new; community MediaPipe plugins target v4 | We own native code | Phase 0 spike first; port logic from MIT `react-native-mediapipe-pose-plugin`; keep the module small and covered by a debug screen; `PoseSource` interface isolates it from games |
| Poor tracking for floor/inverted poses (plank, handstand, crow) | Frustrating hard levels | Side-view instructions, world landmarks, gravity-based segment checks, looser tolerances, more playtesting; keep these in Hard/Expert only |
| Left/right confusion with the front camera | Wrong feedback | Single rule: data always uses the subject's own left/right; mirror only for display; fixture tests for both cameras |
| Jitter breaks holds | Unfair failures | One-Euro filter, hysteresis, grace window, "pause not reset" on easy levels |
| Low-end Android performance | Laggy overlay | Lite model, lower camera resolution, inference throttling, auto device benchmark |
| Web performance on mobile browsers | Low FPS | Lite model, GPU delegate, Web Worker, adaptive inference rate |
| User too close / partially out of frame | False negatives | Mandatory framing check + continuous "step back" prompts |
| Injury on hard poses | Safety/liability | Warnings, wall-assisted handstand, skippable levels, disclaimer |

---

## 19. Decisions & Remaining Questions

### Confirmed decisions
| Topic | Decision |
|---|---|
| Target audience | All ages **12–55**. Clean, sporty cartoon style (not toddler-like); 12+ store rating |
| Camera / native pipeline | **VisionCamera v5** + **own in-repo Nitro native module** (Swift + Kotlin) wrapping MediaPipe Pose Landmarker |
| Accounts / backend | **Local-only** progress in v1 (MMKV / localStorage); cloud sync + leaderboards later |
| Handstand & crow | **Kept in v1** as wall-assisted Expert levels (28–30), with safety screen, skippable, hideable in settings |
| Default camera | **Front camera** by default; back camera selectable in Settings |
| Orientation | **Portrait** on phones; **landscape split view** (camera + Detected Pose panel) on tablet and web |
| Pose illustrations | **Stick figure generated from pose data** for MVP (§9.4); cartoon character art added later without code changes (`illustration` field is optional) |
| Styling | **One theme** (dark navy + cyan/green, §10.2) using plain `StyleSheet` + `src/core/ui/theme.ts`. All colors/spacing/radii go through theme tokens so more themes can be added later |
| Monetization | **None in v1.** Levels are grouped into packs in the data model so paid packs could be added later |
| Package manager, CI/CD | **Deferred.** You will decide later; §14 commands use npm only as an example |

No open questions remain for v1 planning.

---

## 20. Implementation notes (v1 as built)

Where the code differs from the plan above:

| Plan | As built | Why |
|---|---|---|
| Routes in root `app/` | Routes in `src/app/` (Expo SDK 58 template default) | Route files are still thin wrappers around `src/games/<game>/screens/*` |
| `core/camera`, `core/overlay`, `PoseProvider` | One component per platform: `src/core/pose/PoseCamera.native.tsx` (VisionCamera v5 + Skia overlay) and `PoseCamera.web.tsx` (`getUserMedia` + canvas), wrapped by `PoseStage.tsx` (smoothing, permission/loading overlays) | Fewer moving parts; only one camera is ever on screen |
| Pose files per pose in `data/poses/` | `data/poseTemplates.ts` (27 templates) expanded by `data/poses.ts` into 34 poses (`-left`/`-right` variants are generated by mirroring) | Mirrored variants can never drift apart |
| Pose = joint angles | Pose = **segment directions** (+ optional foreshortening `length`) in a mirror-view canonical space. The same data drives the matcher, the stick-figure illustration, the demo-mode player and the tests | One source of truth; front-view squats are detected from thigh foreshortening |
| — | **Demo mode** (Settings): a simulated player copies each pose, so the game runs with no camera | UI development, demos, browsers without a webcam |
| Expert single-pose levels with 3 attempts | `attempts: 3` on the level; ends on the first success, stars = 3/2/1 by attempt | Clearer than repeating the pose 3 times |
| `core/sensors/deviceTilt.ts` (roll correction) | **Not implemented** | Accelerometer axis/sign conventions differ per platform; needs real-device testing first. Keep the phone upright for now |
| Web: bundle `@mediapipe/tasks-vision` | Web loads `/mediapipe/vision_bundle.mjs` at runtime (copied to `public/` by `postinstall`) | Metro can't bundle the library (non-literal dynamic `import()`) |
| `app.config.ts`, `metro.config.js`, expo-plugin for models | `app.json`; models ship inside the native module (Android `assets`, iOS resource bundle) | No custom Metro asset handling needed |
| Web `output: static` | `output: single` (SPA) | Camera/MMKV code can't run during static pre-rendering |

Scoring detail added during implementation: segments that differ from standing (> 30°, or foreshortened) are **key segments**. They weigh 2.5× and the weakest key segment caps the score (`0.4 + 0.6 × weakest`), so standing still never "matches" a pose that only moves one limb.

Commands: `npm run typecheck`, `npm run lint`, `npm test`, `npm run web`, `npm run build:web`, `npm run android` / `npm run ios` (dev client; Expo Go is not supported because of the native module). Regenerate Nitro bindings after editing `modules/pose-landmarker/src/specs/*.nitro.ts` with `npm run specs`.

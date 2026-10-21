// Copies the MediaPipe WASM runtime and pose models into `public/mediapipe`
// so the web build self-hosts them (no CDN dependency, cacheable).
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const wasmSrc = path.join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm')
const modelsSrc = path.join(root, 'modules', 'pose-landmarker', 'models')
const outDir = path.join(root, 'public', 'mediapipe')

function copyDir(src, dest, filter = () => true) {
  if (!fs.existsSync(src)) {
    console.warn(`[copy-mediapipe-web-assets] Skipping missing ${src}`)
    return
  }
  fs.mkdirSync(dest, { recursive: true })
  for (const file of fs.readdirSync(src)) {
    if (!filter(file)) continue
    fs.copyFileSync(path.join(src, file), path.join(dest, file))
  }
}

copyDir(wasmSrc, path.join(outDir, 'wasm'), (f) => f.startsWith('vision_wasm'))
// Metro can't bundle the library (it contains a non-literal dynamic import), so the
// browser loads the ES module directly from /mediapipe at runtime.
copyDir(path.dirname(wasmSrc), outDir, (f) => f === 'vision_bundle.mjs')
copyDir(modelsSrc, path.join(outDir, 'models'), (f) => f.endsWith('.task'))
console.log('[copy-mediapipe-web-assets] MediaPipe web assets copied to public/mediapipe')

// Generates the small synthesized sound effects in assets/sfx (run once: `node scripts/generate-sfx.js`).
const fs = require('fs')
const path = require('path')

const SAMPLE_RATE = 22050
const outDir = path.resolve(__dirname, '..', 'assets', 'sfx')

function tone(freq, durationSec, { volume = 0.5, type = 'sine', attack = 0.005, release = 0.08 } = {}) {
  const n = Math.floor(durationSec * SAMPLE_RATE)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE
    const phase = 2 * Math.PI * freq * t
    let s
    if (type === 'square') s = Math.sign(Math.sin(phase)) * 0.6
    else if (type === 'triangle') s = (2 / Math.PI) * Math.asin(Math.sin(phase))
    else s = Math.sin(phase) * 0.8 + Math.sin(phase * 2) * 0.15
    const env = Math.min(1, t / attack) * Math.min(1, (durationSec - t) / release)
    out[i] = s * env * volume
  }
  return out
}

function sequence(parts) {
  const total = parts.reduce((sum, p) => sum + p.length, 0)
  const out = new Float32Array(total)
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

function silence(sec) {
  return new Float32Array(Math.floor(sec * SAMPLE_RATE))
}

function writeWav(name, samples) {
  const dataSize = samples.length * 2
  const buf = Buffer.alloc(44 + dataSize)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + dataSize, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(SAMPLE_RATE, 24)
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(dataSize, 40)
  for (let i = 0; i < samples.length; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2)
  }
  fs.writeFileSync(path.join(outDir, `${name}.wav`), buf)
}

fs.mkdirSync(outDir, { recursive: true })
writeWav('tick', tone(880, 0.08, { volume: 0.35, release: 0.05 }))
writeWav('go', tone(1320, 0.25, { volume: 0.45 }))
writeWav('match', sequence([tone(660, 0.07, { volume: 0.3 }), tone(990, 0.1, { volume: 0.3 })]))
writeWav(
  'success',
  sequence([
    tone(784, 0.09, { volume: 0.4, type: 'triangle' }),
    tone(988, 0.09, { volume: 0.4, type: 'triangle' }),
    tone(1319, 0.22, { volume: 0.45, type: 'triangle' }),
  ]),
)
writeWav('fail', sequence([tone(220, 0.16, { volume: 0.35, type: 'square' }), silence(0.03), tone(165, 0.26, { volume: 0.35, type: 'square' })]))
writeWav(
  'level-complete',
  sequence([
    tone(523, 0.12, { volume: 0.4, type: 'triangle' }),
    tone(659, 0.12, { volume: 0.4, type: 'triangle' }),
    tone(784, 0.12, { volume: 0.4, type: 'triangle' }),
    tone(1047, 0.45, { volume: 0.45, type: 'triangle', release: 0.3 }),
  ]),
)
console.log(`Sound effects written to ${outDir}`)

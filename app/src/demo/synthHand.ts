// Synthetic hands for the demo and tests, so the whole app runs before a real model or camera exists.
// These are rough cartoon hand shapes, not real signing data: never train on them.
import { windowFeatures, lastFrame, WINDOW, type HandFrame } from '../vision/features'
import type { Exemplar } from '../model/explain'

type V3 = [number, number, number]
type Thumb = 'side' | 'across' | 'underTips' | 'between' | 'under3' | 'under2'
interface Shape { curl: [number, number, number, number]; thumb: Thumb; turn?: number }

// curl per finger: index, middle, ring, pinky (0 straight, 1 fully curled).
const SHAPES: Record<string, Shape> = {
  A: { curl: [1, 1, 1, 1], thumb: 'side' },
  S: { curl: [1, 1, 1, 1], thumb: 'across' },
  E: { curl: [0.75, 0.75, 0.75, 0.75], thumb: 'underTips' },
  T: { curl: [1, 0.95, 0.95, 0.95], thumb: 'between' },
  M: { curl: [0.85, 0.85, 0.85, 1], thumb: 'under3' },
  N: { curl: [0.85, 0.85, 1, 1], thumb: 'under2' },
  U: { curl: [0, 0, 1, 1], thumb: 'across' },
  H: { curl: [0, 0, 1, 1], thumb: 'across', turn: 80 },
  I: { curl: [1, 1, 1, 0], thumb: 'across' },
}
export const DEMO_LETTERS = Object.keys(SHAPES)

const MCP: V3[] = [[0.27, -0.95, 0], [0.08, -1, 0], [-0.1, -0.95, 0], [-0.27, -0.85, 0]]
const LENGTHS = [[0.45, 0.27, 0.22], [0.5, 0.3, 0.24], [0.46, 0.28, 0.22], [0.36, 0.21, 0.19]]
const THUMBS: Record<Thumb, V3[]> = {
  side: [[0.38, -0.45, 0], [0.42, -0.7, 0], [0.42, -0.9, 0]],
  across: [[0.3, -0.45, -0.1], [0.15, -0.65, -0.25], [-0.05, -0.7, -0.3]],
  underTips: [[0.3, -0.45, -0.05], [0.15, -0.55, -0.1], [-0.05, -0.55, -0.12]],
  between: [[0.33, -0.45, -0.05], [0.3, -0.75, -0.15], [0.18, -0.95, -0.25]],
  under3: [[0.3, -0.45, -0.05], [0.05, -0.7, -0.1], [-0.18, -0.8, -0.15]],
  under2: [[0.3, -0.45, -0.05], [0.12, -0.72, -0.1], [-0.02, -0.82, -0.15]],
}

const deg = Math.PI / 180

/** 21 points in "hand units": wrist at the origin, fingers pointing up (−y), thumb toward +x. */
function handPoints(shape: Shape): V3[] {
  const pts: V3[] = [[0, 0, 0], [0.22, -0.2, 0], ...THUMBS[shape.thumb]]
  MCP.forEach((base, f) => {
    pts.push(base)
    let [x, y, z] = base
    let angle = 0
    ;[85, 100, 70].forEach((bend, s) => {
      angle += shape.curl[f] * bend * deg
      const len = LENGTHS[f][s]
      y -= len * Math.cos(angle)
      z -= len * Math.sin(angle)
      pts.push([x, y, z])
    })
  })
  return pts
}

/** Small seeded random generator, so demos and tests are repeatable. */
export function rng(seed: number) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32) * 2 - 1
}

const ASPECT = 4 / 3

/** Hand units → MediaPipe image coordinates, with optional wobble. */
function toImage(points: V3[], rand: () => number, wobble: number, turn = 0): HandFrame {
  const a = (turn + rand() * 4 * wobble * 20) * deg
  const scale = 0.28 * (1 + rand() * 0.05 * Math.min(1, wobble * 20))
  const landmarks = points.map(([x, y, z]) => {
    const rx = x * Math.cos(a) - y * Math.sin(a) + rand() * wobble
    const ry = x * Math.sin(a) + y * Math.cos(a) + rand() * wobble
    return [0.5 + (rx * scale) / ASPECT, 0.72 + ry * scale, (z * scale) / ASPECT] as [number, number, number]
  })
  return { landmarks, isLeft: false }
}

export function letterFrame(letter: string, rand: () => number, wobble = 0.01): HandFrame {
  const shape = SHAPES[letter]
  return toImage(handPoints(shape), rand, wobble, shape.turn)
}

const lerp = (a: V3[], b: V3[], t: number) => a.map((p, i) => p.map((v, k) => v + (b[i][k] - v) * t) as V3)

/** Frames that fingerspell `text` (spaces = hand drops out), at 30 fps. null = no hand. */
export function spellFrames(text: string, seed = 7): (HandFrame | null)[] {
  const rand = rng(seed)
  const frames: (HandFrame | null)[] = []
  let prev: Shape | null = null
  for (const ch of text.toUpperCase()) {
    if (ch === ' ' || !SHAPES[ch]) {
      for (let i = 0; i < 24; i++) frames.push(null)
      prev = null
      continue
    }
    const shape = SHAPES[ch]
    if (prev) {
      const from = handPoints(prev), to = handPoints(shape)
      for (let i = 1; i <= 8; i++) {
        const t = i / 8
        frames.push(toImage(lerp(from, to, t), rand, 0.004, (prev.turn ?? 0) + ((shape.turn ?? 0) - (prev.turn ?? 0)) * t))
      }
    }
    for (let i = 0; i < 24; i++) frames.push(toImage(handPoints(shape), rand, 0.004, shape.turn))
    prev = shape
  }
  return frames
}

export const DEMO_ASPECT = ASPECT

/** Three stand-in "training examples" per demo letter, for the kNN and the Why view. */
export function demoExemplars(seed = 1234): Exemplar[] {
  const rand = rng(seed)
  return DEMO_LETTERS.flatMap((label) =>
    [0, 1, 2].map(() => {
      const frame = letterFrame(label, rand, 0.012)
      const v = lastFrame(windowFeatures(Array(WINDOW).fill(frame), ASPECT)).slice()
      return { label, vector: v, landmarks: v }
    }),
  )
}

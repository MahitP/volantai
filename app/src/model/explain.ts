// Turning model numbers into something a person can read: calibrated top-3,
// a sure/unsure/unknown decision, which fingers mattered, and the closest examples.
import { FRAME_SIZE, WINDOW } from '../vision/features'

export const NONE = 'none'

export function softmax(logits: ArrayLike<number>, temperature = 1): Float32Array {
  const max = Math.max(...Array.from(logits))
  const exps = Array.from(logits, (l) => Math.exp((l - max) / temperature))
  const sum = exps.reduce((a, b) => a + b, 0)
  return Float32Array.from(exps, (e) => e / sum)
}

export interface Guess { label: string; p: number }

export function topK(probs: ArrayLike<number>, labels: readonly string[], k = 3): Guess[] {
  return Array.from(probs, (p, i) => ({ label: labels[i], p }))
    .sort((a, b) => b.p - a.p)
    .slice(0, k)
}

export interface Abstain { minTop: number; minGap: number }
export const DEFAULT_ABSTAIN: Abstain = { minTop: 0.6, minGap: 0.15 }

export type Certainty = 'sure' | 'unsure' | 'unknown'
export interface Decision { label: string | null; certainty: Certainty; top: Guess[] }

/** null label = "nobody is signing a letter" (the model's none class). */
export function decide(probs: ArrayLike<number>, labels: readonly string[], abstain = DEFAULT_ABSTAIN): Decision {
  const top = topK(probs, labels, 3)
  const [first, second = { p: 0 }] = top
  if (first.label === NONE) return { label: null, certainty: 'unknown', top }
  const gap = first.p - second.p
  if (first.p >= abstain.minTop && gap >= abstain.minGap) return { label: first.label, certainty: 'sure', top }
  // Below the bar it still names its best guess, but marked unsure; very low = unknown.
  if (first.p >= abstain.minTop * 0.66) return { label: first.label, certainty: 'unsure', top }
  return { label: first.label, certainty: 'unknown', top }
}

export const FINGERS = {
  thumb: [1, 2, 3, 4],
  index: [5, 6, 7, 8],
  middle: [9, 10, 11, 12],
  ring: [13, 14, 15, 16],
  pinky: [17, 18, 19, 20],
} as const
export type Finger = keyof typeof FINGERS

/** Copy of the window with one finger's joints moved onto the wrist in every frame. */
export function occludeFinger(features: Float32Array, finger: Finger): Float32Array {
  const out = features.slice()
  for (let t = 0; t < WINDOW; t++) {
    const wrist = t * FRAME_SIZE
    for (const j of FINGERS[finger]) {
      const o = t * FRAME_SIZE + j * 3
      out[o] = out[wrist]
      out[o + 1] = out[wrist + 1]
      out[o + 2] = out[wrist + 2]
    }
  }
  return out
}

/**
 * Per-finger importance for one label: how much its probability drops when that
 * finger is hidden, scaled so the most important finger is 1. All zero = nothing mattered.
 */
export async function fingerImportance(
  features: Float32Array,
  labelIndex: number,
  predictProbs: (f: Float32Array) => Promise<ArrayLike<number>>,
): Promise<Record<Finger, number>> {
  const base = (await predictProbs(features))[labelIndex]
  const names = Object.keys(FINGERS) as Finger[]
  const drops = await Promise.all(
    names.map(async (f) => Math.max(0, base - (await predictProbs(occludeFinger(features, f)))[labelIndex])),
  )
  const max = Math.max(...drops)
  return Object.fromEntries(names.map((f, i) => [f, max > 0 ? drops[i] / max : 0])) as Record<Finger, number>
}

export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  return na && nb ? dot / Math.sqrt(na * nb) : 0
}

export interface Exemplar { label: string; vector: ArrayLike<number>; landmarks: ArrayLike<number> }

/** The k most similar stored examples, most similar first. */
export function nearest(vector: ArrayLike<number>, exemplars: readonly Exemplar[], k = 3) {
  return exemplars
    .map((e) => ({ ...e, similarity: cosine(vector, e.vector) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k)
}

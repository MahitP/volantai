// The one seam between the app and any model. Your ONNX model (M2) implements this;
// until then KnnRecognizer stands in, using stored example hands.
import { lastFrame } from '../vision/features'
import { NONE, softmax, type Exemplar } from './explain'

export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
export const LABELS = [...LETTERS, NONE]

export interface Prediction {
  /** Calibrated probabilities, one per entry in `labels`. */
  probs: Float32Array
  /** What "closest examples" compare against. */
  vector: Float32Array
}

export interface Recognizer {
  readonly name: string
  readonly labels: readonly string[]
  /** Examples shown as "closest examples" in the Why view. */
  readonly exemplars: readonly Exemplar[]
  /** features: windowFeatures() output, WINDOW * 63 floats. */
  predict(features: Float32Array): Promise<Prediction>
}

/**
 * Nearest-neighbour over the newest frame: each letter scores by its closest example.
 * shortcut: still poses only, so it can't tell J from I or Z from D; the ONNX model replaces it in M2.
 */
export class KnnRecognizer implements Recognizer {
  readonly name = 'Nearest-example baseline'
  readonly labels = LABELS
  readonly exemplars: readonly Exemplar[]
  private readonly temperature: number
  /** Distance at which "no letter" becomes as likely as the best letter. */
  private readonly noneDistance: number
  constructor(exemplars: readonly Exemplar[], temperature = 0.03, noneDistance = 0.28) {
    this.exemplars = exemplars
    this.temperature = temperature
    this.noneDistance = noneDistance
  }

  async predict(features: Float32Array): Promise<Prediction> {
    const vector = lastFrame(features).slice()
    const best = new Map<string, number>()
    for (const e of this.exemplars) {
      const d = rms(vector, e.vector)
      if (d < (best.get(e.label) ?? Infinity)) best.set(e.label, d)
    }
    const logits = this.labels.map((l) => -(l === NONE ? this.noneDistance : best.get(l) ?? 99))
    return { probs: softmax(logits, this.temperature), vector }
  }
}

/** Distance over the joints the query actually has. A joint sitting exactly on the wrist
 *  (how occludeFinger hides it) is skipped, so a hidden finger is "unknown", not "wrong". */
function rms(a: ArrayLike<number>, b: ArrayLike<number>) {
  let s = 0, n = 0
  for (let j = 1; j < a.length / 3; j++) {
    const o = j * 3
    if (a[o] === 0 && a[o + 1] === 0 && a[o + 2] === 0) continue
    s += (a[o] - b[o]) ** 2 + (a[o + 1] - b[o + 1]) ** 2 + (a[o + 2] - b[o + 2]) ** 2
    n += 3
  }
  return n ? Math.sqrt(s / n) : Infinity
}

// Turns a stream of per-frame decisions into committed letters and word breaks.
// "Wait until it's right": a letter only lands after it has been held steadily.
import type { Certainty, Decision } from '../model/explain'

export interface SegmenterOptions {
  /** Frames a guess must hold before it commits (~0.3 s at 30 fps). */
  hold: number
  /** Frames with no hand that end a word. */
  wordGap: number
  /** Frames of a hand that never settles before an honest "?" is committed. */
  stuck: number
}
export const DEFAULT_SEGMENTER: SegmenterOptions = { hold: 9, wordGap: 15, stuck: 45 }
const RELEASE = 3

export type SegmentEvent =
  | { type: 'letter'; label: string; certainty: Certainty }
  | { type: 'unknown' }
  | { type: 'space' }

export interface Pending { label: string; progress: number }

export class Segmenter {
  private candidate: string | null = null
  private run = 0
  /** Label just committed; it can't commit again until the hand changes shape (double letters). */
  private latched: string | null = null
  private unsettled = 0
  private stuckFired = false
  private noHand = 0
  private wordOpen = false

  private readonly opts: SegmenterOptions
  constructor(opts = DEFAULT_SEGMENTER) { this.opts = opts }

  /** decision = null when no hand is visible. */
  push(decision: Decision | null): SegmentEvent | null {
    if (!decision) {
      this.candidate = null
      this.run = 0
      this.unsettled = 0
      this.stuckFired = false
      this.latched = null
      if (++this.noHand >= this.opts.wordGap && this.wordOpen) {
        this.wordOpen = false
        return { type: 'space' }
      }
      return null
    }
    this.noHand = 0
    const label = decision.certainty === 'unknown' ? null : decision.label

    if (label !== this.candidate) {
      this.candidate = label
      this.run = 0
    }
    this.run++
    // A different shape must last a few frames to release the latch, so one noisy frame can't double a letter.
    if (this.latched && label !== this.latched && this.run >= RELEASE) this.latched = null

    if (label && label !== this.latched && this.run >= this.opts.hold) {
      this.latched = label
      this.unsettled = 0
      this.stuckFired = false
      this.wordOpen = true
      return { type: 'letter', label, certainty: decision.certainty }
    }
    if (!this.latched && !this.stuckFired && ++this.unsettled >= this.opts.stuck) {
      this.stuckFired = true
      this.wordOpen = true
      return { type: 'unknown' }
    }
    return null
  }

  /** The guess currently being held, for the "settling" ring. */
  get pending(): Pending | null {
    if (!this.candidate || this.candidate === this.latched) return null
    return { label: this.candidate, progress: Math.min(1, this.run / this.opts.hold) }
  }

  reset() {
    Object.assign(this, { candidate: null, run: 0, latched: null, unsettled: 0, stuckFired: false, noHand: 0, wordOpen: false })
  }
}

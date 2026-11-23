import { describe, expect, it } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { windowFeatures, WINDOW, FEATURE_VERSION, type HandFrame } from './vision/features'
import { decide, fingerImportance, nearest, occludeFinger, softmax, topK } from './model/explain'
import { KnnRecognizer, LABELS } from './model/recognizer'
import { Segmenter, type SegmentEvent } from './spell/segmenter'
import { demoExemplars, letterFrame, rng, spellFrames, DEMO_ASPECT } from './demo/synthHand'

const FIXTURE = new URL('../../shared/fixtures/features.json', import.meta.url)

describe('features', () => {
  const still = (isLeft = false) => Array(WINDOW).fill({ ...letterFrame('U', rng(1), 0), isLeft }) as HandFrame[]

  it('puts the newest wrist at the origin and makes the palm length 1', () => {
    const f = windowFeatures(still(), DEMO_ASPECT)
    const last = (WINDOW - 1) * 63
    expect([f[last], f[last + 1], f[last + 2]]).toEqual([0, 0, 0])
    expect(Math.hypot(f[last + 27], f[last + 28])).toBeCloseTo(1, 5)
  })

  it('mirrors a left hand onto a right hand', () => {
    const r = windowFeatures(still(false), DEMO_ASPECT)
    const l = windowFeatures(still(true), DEMO_ASPECT)
    expect(l[3 * 5]).toBeCloseTo(-r[3 * 5], 6)
    expect(l[3 * 5 + 1]).toBeCloseTo(r[3 * 5 + 1], 6)
  })

  // The same file is checked by ml/ (pytest), so Python and TypeScript can't drift apart.
  it('matches shared/fixtures/features.json', () => {
    const cases = [
      { name: 'right hand, still U', frames: still(false) },
      { name: 'left hand, still U', frames: still(true) },
      { name: 'moving: spelling M then A', frames: spellFrames('MA', 3).slice(20, 20 + WINDOW) as HandFrame[] },
    ].map((c) => ({ ...c, aspect: DEMO_ASPECT, expected: Array.from(windowFeatures(c.frames, DEMO_ASPECT)) }))

    if (process.env.WRITE_FIXTURE) {
      writeFileSync(FIXTURE, JSON.stringify({ feature_version: FEATURE_VERSION, window: WINDOW, cases }, null, 1))
    }
    const saved = JSON.parse(readFileSync(FIXTURE, 'utf8'))
    expect(saved.feature_version).toBe(FEATURE_VERSION)
    for (const c of saved.cases) {
      const got = windowFeatures(c.frames, c.aspect)
      c.expected.forEach((v: number, i: number) => expect(got[i]).toBeCloseTo(v, 5))
    }
  })
})

describe('explain', () => {
  it('softmax sums to 1 and temperature flattens it', () => {
    const sharp = softmax([2, 1, 0])
    const flat = softmax([2, 1, 0], 4)
    expect(sharp.reduce((a, b) => a + b)).toBeCloseTo(1)
    expect(flat[0]).toBeLessThan(sharp[0])
  })

  it('decides sure, unsure, unknown and none honestly', () => {
    const labels = ['A', 'S', 'none']
    expect(decide([0.9, 0.05, 0.05], labels).certainty).toBe('sure')
    expect(decide([0.55, 0.4, 0.05], labels)).toMatchObject({ label: 'A', certainty: 'unsure' })
    expect(decide([0.34, 0.33, 0.33], labels).certainty).toBe('unknown')
    expect(decide([0.1, 0.1, 0.8], labels).label).toBeNull()
    expect(topK([0.1, 0.7, 0.2], labels, 2).map((g) => g.label)).toEqual(['S', 'none'])
  })

  it('occluding a finger only moves that finger', () => {
    const f = windowFeatures(Array(WINDOW).fill(letterFrame('I', rng(2), 0)), DEMO_ASPECT)
    const o = occludeFinger(f, 'pinky')
    expect(o.slice(0, 17 * 3)).toEqual(f.slice(0, 17 * 3))
    expect(o[20 * 3 + 1]).toBe(o[1])
  })

  it('nearest returns the most similar example first', () => {
    const near = nearest([1, 0], [
      { label: 'far', vector: [0, 1], landmarks: [] },
      { label: 'close', vector: [0.9, 0.1], landmarks: [] },
    ], 1)
    expect(near[0].label).toBe('close')
  })
})

describe('segmenter', () => {
  const d = (label: string | null, certainty: 'sure' | 'unsure' | 'unknown' = 'sure') => ({ label, certainty, top: [] })
  const feed = (s: Segmenter, items: (ReturnType<typeof d> | null)[]) =>
    items.map((x) => s.push(x)).filter(Boolean) as SegmentEvent[]
  const times = <T,>(n: number, x: T) => Array(n).fill(x) as T[]

  it('commits a letter only after it is held', () => {
    const s = new Segmenter()
    expect(feed(s, times(8, d('A')))).toEqual([])
    expect(feed(s, [d('A')])).toEqual([{ type: 'letter', label: 'A', certainty: 'sure' }])
    expect(feed(s, times(30, d('A')))).toEqual([]) // holding doesn't repeat
  })

  it('needs a real change of shape for a double letter, not one noisy frame', () => {
    const s = new Segmenter()
    feed(s, times(9, d('L')))
    expect(feed(s, [d('I'), ...times(9, d('L'))])).toEqual([])
    expect(feed(s, [...times(4, d(null, 'unknown')), ...times(9, d('L'))])).toHaveLength(1)
  })

  it('outputs nothing with no hand, and a pause ends the word once', () => {
    const s = new Segmenter()
    expect(feed(s, times(40, null))).toEqual([])
    feed(s, times(9, d('H')))
    expect(feed(s, times(40, null))).toEqual([{ type: 'space' }])
  })

  it('commits one honest "?" for a hand that never settles', () => {
    const s = new Segmenter()
    const wobbly = Array.from({ length: 100 }, (_, i) => d(i % 2 ? 'A' : 'S'))
    expect(feed(s, wobbly)).toEqual([{ type: 'unknown' }])
  })
})

describe('demo pipeline', () => {
  it('spells MAHIT from synthetic hands with the kNN stand-in', async () => {
    const knn = new KnnRecognizer(demoExemplars())
    const seg = new Segmenter()
    const buf: HandFrame[] = []
    let text = ''
    for (const frame of spellFrames('MAHIT ', 11)) {
      if (!frame) { buf.length = 0 } else { buf.push(frame); if (buf.length > WINDOW) buf.shift() }
      let decision = null
      if (buf.length === WINDOW) {
        const { probs } = await knn.predict(windowFeatures(buf, DEMO_ASPECT))
        decision = decide(probs, LABELS)
      } else if (frame) continue
      const e = seg.push(decision)
      if (e?.type === 'letter') text += e.label
      if (e?.type === 'space') text += ' '
    }
    expect(text).toBe('MAHIT ')
  })

  it('finger importance points at the pinky for I', async () => {
    const knn = new KnnRecognizer(demoExemplars())
    const f = windowFeatures(Array(WINDOW).fill(letterFrame('I', rng(5))), DEMO_ASPECT)
    const imp = await fingerImportance(f, LABELS.indexOf('I'), async (x) => (await knn.predict(x)).probs)
    expect(imp.pinky).toBe(1)
  })
})

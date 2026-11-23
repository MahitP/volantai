// Camera (or demo) → hand landmarks → features → recognizer → decision → segmenter → caption tokens.
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { windowFeatures, WINDOW, type HandFrame, type Landmarks } from '../vision/features'
import { drawHands } from '../vision/skeleton'
import { decide, DEFAULT_ABSTAIN, type Decision } from '../model/explain'
import type { Recognizer } from '../model/recognizer'
import { Segmenter, type Pending } from '../spell/segmenter'
import { spellFrames, DEMO_ASPECT } from '../demo/synthHand'

export type Source = { kind: 'camera' } | { kind: 'demo'; text: string }

export type Status =
  | 'starting' | 'denied' | 'error'
  | 'no-hand' | 'tracking' | 'two-hands' | 'lost' | 'dark'

export interface Snapshot { features: Float32Array; vector: Float32Array; probs: Float32Array; decision: Decision }
export type Token =
  | { id: number; kind: 'letter'; label: string; certainty: 'sure' | 'unsure'; snap: Snapshot }
  | { id: number; kind: 'unknown'; snap: Snapshot | null }
  | { id: number; kind: 'space' }

type NoId<T> = T extends unknown ? Omit<T, 'id'> : never

interface Options {
  source: Source
  recognizer: Recognizer | null
  videoRef: RefObject<HTMLVideoElement | null>
  canvasRef: RefObject<HTMLCanvasElement | null>
  handColor: string
}

const LOST_MS = 900

export function usePipeline({ source, recognizer, videoRef, canvasRef, handColor }: Options) {
  const [status, setStatus] = useState<Status>('starting')
  const [tokens, setTokens] = useState<Token[]>([])
  const [pending, setPending] = useState<Pending | null>(null)
  const seg = useRef(new Segmenter())
  const nextId = useRef(0)
  const sourceKey = source.kind === 'demo' ? `demo:${source.text}` : 'camera'

  const clear = useCallback(() => { seg.current.reset(); setTokens([]); setPending(null) }, [])

  useEffect(() => {
    const segmenter = seg.current
    let stopped = false
    let raf = 0
    let stream: MediaStream | null = null
    let closeTracker = () => {}
    const buffer: HandFrame[] = []
    let busy = false
    let lastSeen = 0
    let lastSnap: Snapshot | null = null
    let frameNo = 0
    let dark = false
    const show = (s: Status) => !stopped && setStatus((old) => (old === s ? old : s))
    const add = (t: NoId<Token>) => setTokens((ts) => [...ts, { ...t, id: nextId.current++ } as Token])
    const syncPending = () => {
      const p = seg.current.pending
      setPending((old) => (old?.label === p?.label && old?.progress === p?.progress ? old : p))
    }

    const step = async (hands: HandFrame[], aspect: number, now: number) => {
      const ctx = canvasRef.current?.getContext('2d')
      if (ctx) drawHands(ctx, hands.map((h) => h.landmarks as Landmarks), handColor)

      if (hands.length === 1) {
        lastSeen = now
        buffer.push(hands[0])
        if (buffer.length > WINDOW) buffer.shift()
        show(dark ? 'dark' : 'tracking')
      } else {
        buffer.length = 0
        show(hands.length === 2 ? 'two-hands' : dark ? 'dark' : now - lastSeen < LOST_MS ? 'lost' : 'no-hand')
        if (seg.current.push(null)?.type === 'space') add({ kind: 'space' })
        syncPending()
        return
      }
      if (!recognizer || buffer.length < WINDOW || busy) return
      busy = true
      const features = windowFeatures(buffer, aspect)
      const { probs, vector } = await recognizer.predict(features)
      busy = false
      if (stopped) return
      const decision = decide(probs, recognizer.labels, DEFAULT_ABSTAIN)
      const snap = { features, vector, probs, decision }
      if (decision.label) lastSnap = snap
      const e = seg.current.push(decision)
      if (e?.type === 'letter') add({ kind: 'letter', label: e.label, certainty: e.certainty === 'sure' ? 'sure' : 'unsure', snap })
      if (e?.type === 'unknown') add({ kind: 'unknown', snap: lastSnap })
      syncPending()
    }

    async function runCamera() {
      const video = videoRef.current!
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
        })
      } catch (err) {
        show((err as DOMException)?.name === 'NotAllowedError' ? 'denied' : 'error')
        return
      }
      if (stopped) return stream.getTracks().forEach((t) => t.stop())
      video.srcObject = stream
      await video.play().catch(() => {})
      // MediaPipe is ~400 kB, so it loads only when the camera starts.
      const tracker = await import('../vision/tracker').then((m) => m.createTracker()).catch(() => null)
      if (!tracker) return show('error')
      if (stopped) return tracker.close()
      closeTracker = tracker.close
      const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!
      probe.canvas.width = 16; probe.canvas.height = 9
      const loop = () => {
        if (stopped) return
        const now = performance.now()
        const det = tracker.detect(video, now)
        if (det) {
          const canvas = canvasRef.current
          if (canvas && canvas.width !== video.videoWidth) { canvas.width = video.videoWidth; canvas.height = video.videoHeight }
          if (frameNo++ % 15 === 0) dark = luminance(probe, video) < 45
          step(det.hands, video.videoWidth / video.videoHeight, now)
        }
        raf = requestAnimationFrame(loop)
      }
      loop()
    }

    function runDemo(text: string) {
      const frames = spellFrames(`${text}  `)
      const canvas = canvasRef.current
      if (canvas) { canvas.width = 960; canvas.height = 720 }
      let i = 0
      const id = setInterval(() => {
        const f = frames[i++ % frames.length]
        step(f ? [f] : [], DEMO_ASPECT, performance.now())
      }, 1000 / 30)
      return () => clearInterval(id)
    }

    let stopDemo = () => {}
    if (source.kind === 'camera') runCamera()
    else stopDemo = runDemo(source.text)

    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      stopDemo()
      closeTracker()
      stream?.getTracks().forEach((t) => t.stop())
      segmenter.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey, recognizer, handColor])

  return { status, tokens, pending, clear }
}

function luminance(ctx: CanvasRenderingContext2D, video: HTMLVideoElement) {
  ctx.drawImage(video, 0, 0, 16, 9)
  const d = ctx.getImageData(0, 0, 16, 9).data
  let sum = 0
  for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
  return sum / (d.length / 4)
}

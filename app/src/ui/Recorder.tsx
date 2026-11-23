// #/record: the data-collection tool. Records landmark frames (never video) per letter and exports JSON for ml/.
import { useEffect, useRef, useState } from 'react'
import type { Tracker } from '../vision/tracker'
import { drawHands } from '../vision/skeleton'
import { LETTERS } from '../model/recognizer'
import type { HandFrame } from '../vision/features'

const SECONDS = 2
type Frame = (HandFrame & { t: number }) | null
interface Sample { label: string; aspect: number; fps: number; frames: Frame[] }

export function Recorder() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const recording = useRef<{ start: number; frames: Frame[]; label: string } | null>(null)
  const [state, setState] = useState<'starting' | 'ready' | 'recording' | 'error'>('starting')
  const [signer, setSigner] = useState('')
  const [consent, setConsent] = useState(false)
  const [letter, setLetter] = useState('A')
  const [samples, setSamples] = useState<Sample[]>([])

  useEffect(() => {
    let stopped = false, raf = 0
    let tracker: Tracker | null = null
    let stream: MediaStream | null = null
    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } })
        const video = videoRef.current!
        video.srcObject = stream
        await video.play()
        tracker = await import('../vision/tracker').then((m) => m.createTracker())
      } catch { return setState('error') }
      if (stopped) return
      setState('ready')
      const loop = () => {
        if (stopped) return
        const video = videoRef.current!, canvas = canvasRef.current!
        const det = tracker!.detect(video, performance.now())
        if (det) {
          if (canvas.width !== video.videoWidth) { canvas.width = video.videoWidth; canvas.height = video.videoHeight }
          drawHands(canvas.getContext('2d')!, det.hands.map((h) => h.landmarks), '#B4440C')
          const rec = recording.current
          if (rec) {
            const t = performance.now() - rec.start
            rec.frames.push(det.hands.length === 1 ? { ...det.hands[0], t: Math.round(t) } : null)
            if (t >= SECONDS * 1000) {
              recording.current = null
              const aspect = video.videoWidth / video.videoHeight
              setSamples((s) => [...s, { label: rec.label, aspect, fps: Math.round(rec.frames.length / SECONDS), frames: rec.frames }])
              setState('ready')
            }
          }
        }
        raf = requestAnimationFrame(loop)
      }
      loop()
    })()
    return () => { stopped = true; cancelAnimationFrame(raf); tracker?.close(); stream?.getTracks().forEach((t) => t.stop()) }
  }, [])

  const record = () => { recording.current = { start: performance.now(), frames: [], label: letter }; setState('recording') }
  const counts = Object.fromEntries(LETTERS.map((l) => [l, samples.filter((s) => s.label === l).length]))
  const canRecord = state === 'ready' && consent && signer.trim().length > 0

  const exportJson = () => {
    const body = { format: 'volantai-recording', version: 1, mediapipe: '1.2.3', signer: signer.trim(), consent, samples }
    const url = URL.createObjectURL(new Blob([JSON.stringify(body)], { type: 'application/json' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `volantai-${signer.trim()}-${Date.now()}.json` })
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="app recorder">
      <header className="topbar">
        <a className="brand" href="#/">Volant<span>AI</span></a>
        <span className="panel-label">Recorder</span>
      </header>
      <main className="workspace">
        <section className="stage round" aria-label="Camera">
          <video ref={videoRef} playsInline muted aria-hidden="true" />
          <canvas ref={canvasRef} aria-hidden="true" />
          <p className={`pill ${state === 'recording' ? 'warn' : state === 'ready' ? 'ok' : ''}`} role="status">
            <span className="dot" />
            {{ starting: 'Starting…', ready: 'Ready', recording: `Recording ${letter}…`, error: 'Camera unavailable' }[state]}
          </p>
        </section>

        <section className="controls">
          <label className="field">Signer ID (no real names)
            <input type="text" value={signer} onChange={(e) => setSigner(e.target.value)} placeholder="e.g. s01" />
          </label>
          <label className="check">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            This person agreed to have their hand landmarks (not video) recorded and used to train VolantAI.
          </label>
          <div className="counts" role="group" aria-label="Letter to record">
            {LETTERS.map((l) => (
              <button key={l} className={`count ${l === letter ? 'on' : ''}`} onClick={() => setLetter(l)} aria-pressed={l === letter}>
                {l}<small>{counts[l]}</small>
              </button>
            ))}
          </div>
          <div className="row">
            <button className="btn" onClick={record} disabled={!canRecord}>Record {letter} ({SECONDS}s)</button>
            <button className="btn quiet" onClick={exportJson} disabled={!samples.length}>Export {samples.length}</button>
            <button className="link" onClick={() => setSamples((s) => s.slice(0, -1))} disabled={!samples.length}>Undo last</button>
          </div>
          <p className="footnote">Aim for 5+ samples per letter per person, in different light and at different distances. J and Z: draw the motion during the 2 seconds.</p>
        </section>
      </main>
    </div>
  )
}

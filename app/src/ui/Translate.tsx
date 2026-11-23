import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { usePipeline, type Source, type Status, type Token } from '../pipeline/usePipeline'
import { KnnRecognizer } from '../model/recognizer'
import { demoExemplars } from '../demo/synthHand'
import { WhySheet } from './WhySheet'
import { CameraOff } from './Onboarding'

const chipSpring = { type: 'spring', duration: 0.3, bounce: 0.15 } as const

const PILL: Record<Status, [string, '' | 'ok' | 'warn']> = {
  starting: ['Starting…', ''],
  'no-hand': ['Hold one hand up', ''],
  tracking: ['Hand in view', 'ok'],
  'two-hands': ['Use one hand', 'warn'],
  lost: ['Hand lost', 'warn'],
  dark: ['Move into the light', 'warn'],
  denied: ['Camera is off', 'warn'],
  error: ['Camera unavailable', 'warn'],
}

const narrowQuery = typeof window !== 'undefined' ? window.matchMedia('(max-width: 899px)') : null
const useNarrow = () => useSyncExternalStore(
  (cb) => { narrowQuery?.addEventListener('change', cb); return () => narrowQuery?.removeEventListener('change', cb) },
  () => narrowQuery?.matches ?? false,
)

export function Translate({ source, onSwitch }: { source: Source; onSwitch: (s: Source) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // shortcut: live camera has no recognizer until the M2 ONNX model lands in public/models/.
  const recognizer = useMemo(() => (source.kind === 'demo' ? new KnnRecognizer(demoExemplars()) : null), [source.kind])
  const { status, tokens, pending, clear } = usePipeline({ source, recognizer, videoRef, canvasRef, handColor: '#B4440C' })
  const [openId, setOpenId] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const narrow = useNarrow()

  const text = tokens.map((t) => (t.kind === 'space' ? ' ' : t.kind === 'unknown' ? '?' : t.label)).join('').trim()
  const words = splitWords(tokens)
  const open = tokens.find((t) => t.id === openId)
  const close = useCallback(() => {
    const id = openId
    setOpenId(null)
    requestAnimationFrame(() => document.getElementById(`chip-${id}`)?.focus())
  }, [openId])

  if (status === 'denied' || status === 'error') {
    return <CameraOff reason={status} onDemo={() => onSwitch({ kind: 'demo', text: 'MAHIT' })} />
  }

  const speak = () => {
    speechSynthesis.cancel()
    speechSynthesis.speak(new SpeechSynthesisUtterance(text.replace(/\?/g, '')))
  }
  const copy = async () => {
    await navigator.clipboard.writeText(text).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }
  const [pillText, pillTone] = PILL[status]

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/">Volant<span>AI</span></a>
        {source.kind === 'demo'
          ? <button className="link" onClick={() => onSwitch({ kind: 'camera' })}>Use my camera</button>
          : <button className="link" onClick={() => onSwitch({ kind: 'demo', text: 'MAHIT' })}>Watch the demo</button>}
      </header>

      <main className="workspace">
        <section className={`stage round ${source.kind === 'demo' ? 'demo' : ''}`} aria-label="Camera">
          {source.kind === 'camera' && <video ref={videoRef} playsInline muted aria-hidden="true" />}
          <canvas ref={canvasRef} aria-hidden="true" />
          <p className={`pill ${pillTone}`} role="status"><span className="dot" />{pillText}</p>
          {source.kind === 'demo' && <span className="demo-tag">Demo: a drawn hand spelling MAHIT</span>}
        </section>

        <section className="panel" aria-label="What VolantAI read">
          <p className="panel-label">What I read</p>
          <div className="caption" aria-live="polite">
            {words.map((w, wi) => (
              <span className="word" key={wi}>
                <AnimatePresence initial={false}>
                  {w.map((t) => <Chip key={t.id} token={t} onOpen={() => setOpenId(t.id)} />)}
                </AnimatePresence>
                {wi === words.length - 1 && pending && (
                  <span className="chip ghost" aria-hidden="true">
                    {pending.label}
                    <span className="settle"><i style={{ transform: `scaleX(${pending.progress})` }} /></span>
                  </span>
                )}
              </span>
            ))}
          </div>

          {tokens.length === 0 && !pending && (
            <p className="empty">
              {recognizer
                ? 'Fingerspell a word. Each letter lands here once your hand holds it steady.'
                : <>Hand tracking is live. Letter reading turns on once a trained model is added. <button className="link" onClick={() => onSwitch({ kind: 'demo', text: 'MAHIT' })}>See the demo</button></>}
            </p>
          )}

          {tokens.length > 0 && (
            <>
              <ul className="legend" aria-label="How to read the letters">
                <li><b>A</b>sure</li>
                <li><b className="u">A</b>not sure</li>
                <li><b className="q">?</b>couldn’t tell</li>
                <li>Tap any letter to see why.</li>
              </ul>
              <div className="toolbar">
                <button className="btn quiet small" onClick={speak} disabled={!text}>Speak</button>
                <button className="btn quiet small" onClick={copy} disabled={!text}>{copied ? 'Copied' : 'Copy'}</button>
                <button className="btn quiet small" onClick={() => { setOpenId(null); clear() }}>Clear</button>
              </div>
            </>
          )}
        </section>
      </main>

      <AnimatePresence>
        {open && open.kind !== 'space' && recognizer && (
          <WhySheet key={open.id} tokenId={open.id} label={open.kind === 'letter' ? open.label : null}
            snap={open.snap} recognizer={recognizer} narrow={narrow} onClose={close} />
        )}
      </AnimatePresence>
    </div>
  )
}

function Chip({ token, onOpen }: { token: Exclude<Token, { kind: 'space' }>; onOpen: () => void }) {
  const isLetter = token.kind === 'letter'
  const name = isLetter ? `${token.label}, ${token.certainty === 'sure' ? 'sure' : 'not sure'}` : 'Unknown letter'
  return (
    <motion.button
      id={`chip-${token.id}`} className={`chip ${isLetter ? token.certainty : 'unknown'}`}
      onClick={onOpen} aria-label={`${name}. Show why`}
      initial={{ opacity: 0, y: 10, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
      transition={chipSpring}
    >
      <motion.span layoutId={`letter-${token.id}`} style={{ display: 'inline-block' }}>{isLetter ? token.label : '?'}</motion.span>
    </motion.button>
  )
}

function splitWords(tokens: Token[]) {
  const words: Exclude<Token, { kind: 'space' }>[][] = [[]]
  for (const t of tokens) {
    if (t.kind === 'space') words.push([])
    else words[words.length - 1].push(t)
  }
  return words.slice(-6) // the newest six words stay on screen; Copy still gets everything
}

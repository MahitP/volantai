import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { demoExemplars } from '../demo/synthHand'
import { HandFigure } from './HandFigure'

const ease = { type: 'spring', duration: 0.5, bounce: 0 } as const
const rise = (i: number) => ({ initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { ...ease, delay: 0.06 * i } })

export function Welcome({ onContinue }: { onContinue: () => void }) {
  const order = useMemo(() => {
    const ex = demoExemplars()
    return 'MAHIT'.split('').map((l) => ex.find((e) => e.label === l)!)
  }, [])
  const [i, setI] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % order.length), 1400)
    return () => clearInterval(id)
  }, [order.length])
  const hand = order[i]

  return (
    <main className="onboard">
      <div className="onboard-inner">
        <motion.div className="welcome-hand" {...rise(0)} aria-hidden="true">
          <AnimatePresence mode="wait">
            <motion.div key={i} className="row" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              <HandFigure points={hand.landmarks} label="" className="figure-main" />
              <span className="letter">{hand.label}</span>
            </motion.div>
          </AnimatePresence>
        </motion.div>
        <motion.h1 className="wordmark" {...rise(1)}>Volant<span>AI</span></motion.h1>
        <motion.p className="motto" {...rise(2)}>
          <i lang="la">Verba volant, scripta manent.</i>
          <small>Spoken words fly away; written words remain.</small>
        </motion.p>
        <motion.p className="lede" {...rise(3)}>
          Fingerspell to your camera. VolantAI writes it down, and <b>shows you why</b> it read each letter.
        </motion.p>
        <motion.div {...rise(4)}><button className="btn" onClick={onContinue}>Continue</button></motion.div>
      </div>
    </main>
  )
}

/** Shown before the browser's camera prompt. One button, no "Allow" or "Cancel" (Apple HIG). */
export function Priming({ onContinue }: { onContinue: () => void }) {
  return (
    <main className="onboard">
      <div className="onboard-inner">
        <motion.div className="camera-glyph round" {...rise(0)} aria-hidden="true">
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="var(--ink)" strokeWidth="1.8" strokeLinejoin="round">
            <rect x="3" y="8" width="18" height="15" rx="4" /><path d="M21 13.5l6-3.5v11l-6-3.5" />
          </svg>
        </motion.div>
        <motion.h1 {...rise(1)}>VolantAI reads the shape of your hand.</motion.h1>
        <motion.p className="lede" {...rise(2)}>
          It needs your camera to see it. <b>Video never leaves this device.</b> Nothing is uploaded or saved.
        </motion.p>
        <motion.div {...rise(3)}><button className="btn" onClick={onContinue}>Continue</button></motion.div>
      </div>
    </main>
  )
}

export function CameraOff({ reason, onDemo }: { reason: 'denied' | 'error'; onDemo: () => void }) {
  return (
    <main className="onboard">
      <div className="onboard-inner">
        <h1>{reason === 'denied' ? 'The camera is off for VolantAI.' : 'VolantAI couldn’t start the camera.'}</h1>
        {reason === 'denied' ? (
          <ol>
            <li>Click the camera icon in the address bar (Safari: the <b>aA</b> or site settings menu).</li>
            <li>Choose <b>Allow</b> for the camera.</li>
            <li>Reload this page.</li>
          </ol>
        ) : (
          <p className="lede">Check that no other app is using the camera, then reload.</p>
        )}
        <div className="row">
          <button className="btn" onClick={() => location.reload()}>Reload</button>
          <button className="btn quiet" onClick={onDemo}>Watch the demo</button>
        </div>
      </div>
    </main>
  )
}

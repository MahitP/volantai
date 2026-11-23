import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { fingerImportance, FINGERS, nearest, NONE, type Finger } from '../model/explain'
import type { Recognizer } from '../model/recognizer'
import { tipFor, SHAPES } from '../model/tips'
import { lastFrame } from '../vision/features'
import type { Snapshot } from '../pipeline/usePipeline'
import { HandFigure } from './HandFigure'

const spring = { type: 'spring', duration: 0.45, bounce: 0 } as const

interface Props {
  tokenId: number
  label: string | null // null = the honest "?"
  snap: Snapshot | null
  recognizer: Recognizer
  narrow: boolean
  onClose: () => void
}

const FINGER_NAME: Record<Finger, string> = { thumb: 'thumb', index: 'index finger', middle: 'middle finger', ring: 'ring finger', pinky: 'pinky' }

const VERDICT = { sure: 'Fairly sure.', unsure: 'Not sure. It nearly picked something else.', unknown: 'Couldn’t decide.' }

export function WhySheet({ tokenId, label, snap, recognizer, narrow, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const [fingers, setFingers] = useState<Record<Finger, number> | null>(null)
  const top = snap?.decision.top.filter((g) => g.label !== NONE) ?? []
  const shown = label ?? top[0]?.label ?? '?'
  const certainty = label ? snap?.decision.certainty ?? 'unknown' : 'unknown'

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (!snap || !top[0]) return
    let live = true
    fingerImportance(snap.features, recognizer.labels.indexOf(top[0].label), async (f) => (await recognizer.predict(f)).probs)
      .then((r) => live && setFingers(r))
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap, recognizer])

  const weights = fingers && Array.from({ length: 21 }, (_, j) => {
    const f = (Object.keys(FINGERS) as Finger[]).find((k) => (FINGERS[k] as readonly number[]).includes(j))
    return f ? fingers[f] : 0
  })
  const keyFingers = fingers ? (Object.entries(fingers) as [Finger, number][]).filter(([, v]) => v > 0.5).map(([k]) => FINGER_NAME[k]) : []
  // One closest example per top guess, so you can compare your hand with each letter it weighed.
  const examples = snap
    ? top.flatMap((g) => nearest(snap.vector, recognizer.exemplars.filter((e) => e.label === g.label), 1))
    : []

  return (
    <>
      <motion.div className="scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={spring} />
      <motion.section
        className="sheet round" role="dialog" aria-modal="true" aria-labelledby="why-title"
        initial={narrow ? { y: '100%' } : { x: 32, opacity: 0 }}
        animate={narrow ? { y: 0 } : { x: 0, opacity: 1 }}
        exit={narrow ? { y: '100%' } : { x: 32, opacity: 0 }}
        transition={spring}
      >
        <header className="sheet-head">
          <div>
            <motion.span layoutId={`letter-${tokenId}`} className="big-letter" transition={spring} id="why-title"
              aria-label={label ? `Letter ${label}` : 'Unknown letter'}>
              {label ?? '?'}
            </motion.span>
            <p className="verdict">{VERDICT[certainty]}</p>
          </div>
          <button ref={closeRef} className="icon-btn" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
        </header>

        {top.length > 0 && (
          <section>
            <h3>What it weighed</h3>
            <ol className="bars">
              {top.map((g, i) => (
                <li className="bar" key={g.label}>
                  <b>{g.label}</b>
                  <div className="track"><motion.div className="fill" initial={{ scaleX: 0 }} animate={{ scaleX: g.p }} transition={{ ...spring, delay: 0.08 * i }} /></div>
                  <span>{Math.round(g.p * 100)}%</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {snap && (
          <section>
            <h3>What it saw</h3>
            <div className="figure-row">
              <HandFigure className="figure-main" points={lastFrame(snap.features)} weights={weights ?? undefined}
                label={`Your hand${keyFingers.length ? `, with the ${list(keyFingers)} highlighted` : ''}`} />
              <p className="fingers">
                {fingers === null ? 'Checking which fingers mattered…'
                  : keyFingers.length ? <>Your <b>{list(keyFingers)}</b> decided it. Hiding {keyFingers.length > 1 ? 'them' : 'it'} changed the guess most.</>
                  : 'No single finger decided it; the whole hand shape did.'}
              </p>
            </div>
          </section>
        )}

        {examples.length > 0 && (
          <section>
            <h3>Closest example of each guess</h3>
            <div className="examples">
              {examples.map((e, i) => (
                <figure className="example" key={i}>
                  <HandFigure points={e.landmarks} label={`Example of ${e.label}`} />
                  <figcaption><b>{e.label}</b></figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        {SHAPES[shown] && (
          <section>
            <h3>Tip</h3>
            <p className="tip">{tipFor(shown, top[1]?.label)}</p>
          </section>
        )}

        <p className="footnote">Model: {recognizer.name}. Reads hand shape only, not faces or grammar.</p>
      </motion.section>
    </>
  )
}

const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)

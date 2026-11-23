import { useEffect, useState } from 'react'
import { MotionConfig } from 'motion/react'
import { Welcome, Priming } from './ui/Onboarding'
import { Translate } from './ui/Translate'
import { Recorder } from './ui/Recorder'
import type { Source } from './pipeline/usePipeline'

const SEEN = 'volant.onboarded'
const read = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* private mode: fine */ } }

// Hash routes so it works on any static host: #/ (app), #/demo, #/record, #/welcome
const useHash = () => {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => {
    const on = () => setHash(location.hash)
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  return hash
}

export default function App() {
  const hash = useHash()
  const [step, setStep] = useState<'welcome' | 'priming' | 'app'>(read(SEEN) ? 'app' : 'welcome')
  const source: Source = hash === '#/demo' ? { kind: 'demo', text: 'MAHIT' } : { kind: 'camera' }
  const go = (s: Source) => { location.hash = s.kind === 'demo' ? '#/demo' : '#/' }

  let screen
  if (hash === '#/record') screen = <Recorder />
  else if (hash === '#/welcome' || (step === 'welcome' && hash !== '#/demo')) screen = <Welcome onContinue={() => { if (hash === '#/welcome') location.hash = '#/'; setStep('priming') }} />
  else if (step === 'priming' && hash !== '#/demo') screen = <Priming onContinue={() => { write(SEEN, '1'); setStep('app') }} />
  else screen = <Translate key={source.kind} source={source} onSwitch={go} />

  return <MotionConfig reducedMotion="user">{screen}</MotionConfig>
}

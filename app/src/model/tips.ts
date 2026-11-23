// Plain-English hand-shape tips for the Why view, focused on the letters people mix up.
// Written from standard ASL alphabet descriptions; have a Deaf signer or ASL teacher review before launch.

export const SHAPES: Record<string, string> = {
  A: 'Fist, thumb resting straight up along the side of the index finger.',
  B: 'Four fingers straight up and together, thumb folded across the palm.',
  C: 'Fingers and thumb curved into a C, as if holding a cup.',
  D: 'Index finger up; the other fingertips touch the thumb, making a circle.',
  E: 'Fingertips curl down over the thumb, which is tucked across the palm.',
  F: 'Thumb and index fingertips touch in a circle; the other three fingers up and spread.',
  G: 'Index finger and thumb point sideways, parallel, like a small pinch.',
  H: 'Index and middle fingers together, pointing sideways.',
  I: 'Pinky straight up, the other fingers in a fist with the thumb across them.',
  J: 'I hand shape, then draw a J in the air with the pinky.',
  K: 'Index and middle fingers up in a V, thumb pressed between them at the middle finger.',
  L: 'Index finger up and thumb out, making an L.',
  M: 'Thumb tucked under the first three fingers.',
  N: 'Thumb tucked under the first two fingers.',
  O: 'All fingertips curve to meet the thumb in an O.',
  P: 'K hand shape pointing down.',
  Q: 'G hand shape pointing down.',
  R: 'Index and middle fingers crossed.',
  S: 'Fist with the thumb wrapped across the front of the fingers.',
  T: 'Thumb tucked between the index and middle fingers.',
  U: 'Index and middle fingers straight up and together.',
  V: 'Index and middle fingers straight up and spread apart.',
  W: 'Index, middle and ring fingers up and spread.',
  X: 'Index finger bent into a hook, the others in a fist.',
  Y: 'Thumb and pinky out, the middle three fingers folded.',
  Z: 'Index finger draws a Z in the air.',
}

/** What tells two easily-confused letters apart. Key is the two letters sorted. */
const PAIRS: Record<string, string> = {
  AS: 'Watch the thumb: beside the index finger is A, across the front of the fingers is S.',
  AE: 'A keeps the thumb up along the side; E tucks it under the curled fingertips.',
  ES: 'E curls the fingertips down onto the thumb; S wraps the thumb over the fingers.',
  AT: 'T pokes the thumb up between the index and middle fingers; A keeps it outside, on the side.',
  ST: 'S wraps the thumb across the front; T tucks it between the index and middle fingers.',
  MN: 'Count the fingers over the thumb: three is M, two is N.',
  MT: 'M hides the thumb under three fingers; T shows its tip between the first two.',
  NT: 'N hides the thumb under two fingers; T shows its tip between the index and middle.',
  RU: 'U keeps the two fingers side by side; R crosses them.',
  UV: 'U keeps the fingers together; V spreads them apart.',
  RV: 'R crosses the fingers; V spreads them apart.',
  KV: 'K presses the thumb up between the fingers; V keeps the thumb down.',
  GH: 'G points one finger sideways, H points two.',
  IJ: 'J is I plus motion: draw the J with your pinky.',
  DZ: 'Z moves: draw the letter with your index finger. D stays still.',
  CO: 'O closes the fingertips onto the thumb; C leaves a gap.',
}

export function tipFor(label: string, runnerUp?: string): string {
  const pair = runnerUp && PAIRS[[label, runnerUp].sort().join('')]
  return pair || SHAPES[label] || ''
}

import { BONES } from '../vision/skeleton'

interface Props {
  /** 63 normalised feature values (one frame), as produced by windowFeatures. */
  points: ArrayLike<number>
  /** 0..1 per joint; highlighted joints and bones turn Signal. */
  weights?: number[]
  label: string
  className?: string
}

/** A hand skeleton drawn as the signer saw it (mirrored), scaled to fit its box. */
export function HandFigure({ points, weights, label, className }: Props) {
  const xy = Array.from({ length: 21 }, (_, j) => [-points[j * 3], points[j * 3 + 1]])
  const xs = xy.map((p) => p[0]), ys = xy.map((p) => p[1])
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  const size = Math.max(maxX - minX, maxY - minY) * 1.3 || 1
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
  const w = (j: number) => weights?.[j] ?? 0
  const stroke = size / 55

  return (
    <svg className={className} viewBox={`${cx - size / 2} ${cy - size / 2} ${size} ${size}`} role="img" aria-label={label}>
      {BONES.map(([a, b]) => {
        const hot = Math.min(w(a), w(b))
        return (
          <line key={`${a}-${b}`} x1={xy[a][0]} y1={xy[a][1]} x2={xy[b][0]} y2={xy[b][1]}
            stroke={hot > 0.25 ? 'var(--signal)' : 'var(--ink)'} strokeOpacity={hot > 0.25 ? 0.4 + hot * 0.6 : 0.35}
            strokeWidth={stroke * (1 + hot)} strokeLinecap="round" />
        )
      })}
      {xy.map(([x, y], j) => (
        <circle key={j} cx={x} cy={y} r={stroke * (1.6 + w(j) * 1.4)}
          fill={w(j) > 0.25 ? 'var(--signal)' : 'var(--ink)'} fillOpacity={w(j) > 0.25 ? 1 : 0.75} />
      ))}
    </svg>
  )
}

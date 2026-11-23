import type { Landmarks } from './features'

/** MediaPipe's 21-point hand: palm outline plus each finger's chain. */
export const BONES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
]

/** Draws hands over the camera. Canvas pixels match the video; CSS mirrors both together. */
export function drawHands(ctx: CanvasRenderingContext2D, hands: Landmarks[], color: string) {
  const { width: w, height: h } = ctx.canvas
  ctx.clearRect(0, 0, w, h)
  const unit = Math.max(2, h / 240)
  ctx.lineCap = 'round'
  for (const pts of hands) {
    ctx.strokeStyle = color
    ctx.lineWidth = unit * 1.5
    ctx.globalAlpha = 0.9
    ctx.beginPath()
    for (const [a, b] of BONES) {
      ctx.moveTo(pts[a][0] * w, pts[a][1] * h)
      ctx.lineTo(pts[b][0] * w, pts[b][1] * h)
    }
    ctx.stroke()
    ctx.fillStyle = color
    for (const [x, y] of pts) {
      ctx.beginPath()
      ctx.arc(x * w, y * h, unit * 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1
}

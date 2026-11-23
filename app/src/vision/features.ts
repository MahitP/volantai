// Landmark → feature normalisation. The spec lives in shared/MODEL_CONTRACT.md;
// ml/features.py must produce identical numbers (checked by shared/fixtures/features.json).

export const FEATURE_VERSION = 1
export const WINDOW = 16
export const JOINTS = 21
export const FRAME_SIZE = JOINTS * 3

/** One MediaPipe hand: 21 points, x/y normalised to the image (0..1), z on roughly the x scale. */
export type Landmarks = readonly (readonly [number, number, number])[]

export interface HandFrame {
  landmarks: Landmarks
  /** The signer's real left hand (after undoing MediaPipe's mirrored-selfie labelling). */
  isLeft: boolean
}

/**
 * frames: the last WINDOW frames, oldest first. aspect = videoWidth / videoHeight.
 * Returns WINDOW * 63 floats, frame-major then joint then xyz.
 */
export function windowFeatures(frames: readonly HandFrame[], aspect: number): Float32Array {
  if (frames.length !== WINDOW) throw new Error(`need ${WINDOW} frames, got ${frames.length}`)
  const last = frames[WINDOW - 1]
  const toUnits = (p: readonly [number, number, number]) => [p[0] * aspect, p[1], p[2] * aspect]
  const ref = toUnits(last.landmarks[0])
  const mid = toUnits(last.landmarks[9])
  // Palm size: 2D wrist → middle-finger knuckle distance of the newest frame (z is too noisy).
  const scale = Math.hypot(mid[0] - ref[0], mid[1] - ref[1]) || 1
  const flip = last.isLeft ? -1 : 1

  const out = new Float32Array(WINDOW * FRAME_SIZE)
  frames.forEach((frame, t) => {
    frame.landmarks.forEach((p, j) => {
      const q = toUnits(p)
      const o = t * FRAME_SIZE + j * 3
      out[o] = (flip * (q[0] - ref[0])) / scale
      out[o + 1] = (q[1] - ref[1]) / scale
      out[o + 2] = (q[2] - ref[2]) / scale
    })
  })
  return out
}

/** The newest frame's 63 values: what the Why view draws and the kNN compares. */
export const lastFrame = (features: Float32Array) => features.subarray((WINDOW - 1) * FRAME_SIZE)

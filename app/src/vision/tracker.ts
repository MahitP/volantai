// MediaPipe Hand Landmarker wrapper. Everything runs on this device; only the model files are downloaded.
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import type { HandFrame } from './features'

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm'
const MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

export interface Detection { hands: HandFrame[] }

export async function createTracker() {
  const fileset = await FilesetResolver.forVisionTasks(WASM)
  const options = (delegate: 'GPU' | 'CPU') => ({
    baseOptions: { modelAssetPath: MODEL, delegate },
    runningMode: 'VIDEO' as const,
    numHands: 2, // 2 so we can say "show one hand" instead of silently picking one
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  })
  const landmarker = await HandLandmarker.createFromOptions(fileset, options('GPU'))
    .catch(() => HandLandmarker.createFromOptions(fileset, options('CPU')))

  let lastTime = -1
  return {
    detect(video: HTMLVideoElement, now: number): Detection | null {
      if (video.readyState < 2 || video.currentTime === lastTime) return null
      lastTime = video.currentTime
      const r = landmarker.detectForVideo(video, now)
      return {
        hands: r.landmarks.map((pts, i) => ({
          landmarks: pts.map((p) => [p.x, p.y, p.z] as [number, number, number]),
          // MediaPipe assumes a mirrored selfie; our input is not mirrored, so its labels are swapped.
          isLeft: r.handedness[i]?.[0]?.categoryName === 'Right',
        })),
      }
    },
    close: () => landmarker.close(),
  }
}
export type Tracker = Awaited<ReturnType<typeof createTracker>>

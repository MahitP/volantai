# Model contract (feature_version 1)

The one agreement between `ml/` (Python, yours) and `app/` (web). If you change anything here, bump `feature_version` in `app/src/vision/features.ts` and `ml/features.py` together and regenerate the fixture.

## 1. Landmarks in
MediaPipe Hand Landmarker (`@mediapipe/tasks-vision` 1.2.3 in the app; use the **Tasks** `HandLandmarker` in Python too, not the old `mp.solutions.hands`). 21 points per hand, `x`,`y` normalised to the image (0..1), `z` on roughly the same scale as `x`.

`isLeft` is the signer's **real** hand. MediaPipe labels handedness as if the image were mirrored; the app feeds the raw (unmirrored) camera image, so `isLeft = (label == "Right")`. Do the same in Python.

## 2. Features (`windowFeatures`)
Input: the last **16** frames with a hand (oldest first) and `aspect = width / height`.

1. Convert each point to height units: `X = x·aspect, Y = y, Z = z·aspect`.
2. Reference = the **newest** frame's wrist (joint 0). Scale = 2D distance from that wrist to the newest frame's middle-finger knuckle (joint 9); use 1 if it is 0.
3. Every point in every frame: `(P − reference) / scale`. Using the newest frame for both keeps the hand's path through the window, which is what J and Z need.
4. If the newest frame's `isLeft`, negate X for the whole window (everything becomes a right hand).
5. Flatten frame → joint → xyz: **1008 floats** (`[16, 63]`).

If any of the 16 frames has no hand, the app does not predict: the window refills from scratch.

Check yourself against `shared/fixtures/features.json`: each case has `frames`, `aspect` and `expected`. Your `features.py` must match to 1e-5.

## 3. Model file: `app/public/models/model.onnx`
- Input `landmarks`: float32 `[1, 16, 63]`.
- Output `logits`: float32 `[1, 27]` in the order `A..Z, none`. `none` = no letter (resting, moving between letters, not signing).
- Output `embedding`: float32 `[1, 64]`, the layer before the classifier. Used for "closest examples".

## 4. `app/public/models/model.json`
```json
{
  "feature_version": 1,
  "labels": ["A", "...", "Z", "none"],
  "temperature": 1.4,
  "abstain": { "minTop": 0.6, "minGap": 0.15 },
  "heldout": { "signers": 3, "accuracy": 0.0, "note": "accuracy on people never seen in training" },
  "trained_on": ["my recordings (N people)", "FSboard (CC BY 4.0)"]
}
```
`temperature`: fit it on held-out signers (minimise NLL of `softmax(logits / T)`). The app shows only `heldout.accuracy`, never training accuracy.

## 5. `app/public/models/exemplars.json`
About 10 training windows per letter: `[{ "label": "A", "embedding": [64 floats], "landmarks": [63 floats] }]`, where `landmarks` is the newest frame of that window's features (step 2). These are drawn as "closest examples" in the Why view.

## 6. Recordings out of the app (`#/record`)
The Recorder exports one JSON per session:
```json
{ "format": "volantai-recording", "version": 1, "mediapipe": "1.2.3", "signer": "id", "consent": true,
  "samples": [{ "label": "A", "aspect": 1.333, "fps": 30, "frames": [{ "t": 0, "isLeft": false, "landmarks": [[x,y,z], ...21] } | null] }] }
```
`null` frame = no hand. Train/test splits must be **by signer**, never by sample.

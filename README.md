# VolantAI

*Verba volant, scripta manent.* Fingerspell to your camera; VolantAI writes it down and shows **why** it read each letter: its top three guesses, the fingers that decided it, the closest examples it knows, and a plain-English tip. Hands only, on your device, honest about "not sure".

## Run it
```bash
npm --prefix app install
npm --prefix app run dev -- --port 5179
```
- `http://localhost:5179/`: onboarding, then the live camera (letter reading turns on once `app/public/models/model.onnx` exists).
- `#/demo`: a drawn hand spells MAHIT end to end, with a working Why view. No camera needed.
- `#/record`: the data recorder for `ml/`.

Tests: `npm --prefix app test`.

## Layout
- `app/`: the web app (Vite, React, TypeScript, MediaPipe Tasks Vision 1.2.3, Motion).
- `ml/`: the model (Python, MediaPipe, PyTorch → ONNX). Start with [ml/README.md](ml/README.md).
- `shared/`: [the model contract](shared/MODEL_CONTRACT.md) and the fixture both sides test against.
- `founder/`: private business research, kept out of git.

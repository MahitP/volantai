# ml/: your part

You build the model; the app is ready to receive it. The contract is [shared/MODEL_CONTRACT.md](../shared/MODEL_CONTRACT.md). Read it first.

## Setup (once)
```bash
cd ml
python3 -m venv .venv
source .venv/bin/activate
pip install mediapipe opencv-python numpy torch onnx pytest scikit-learn matplotlib
```
PyTorch on your Apple Silicon Mac can train on the GPU with `device = "mps"`.

## Step 1 (M0): see your own hand skeleton in Python
Write `hand_live.py`: open the webcam with OpenCV, run the MediaPipe **Tasks** `HandLandmarker` in VIDEO mode (the same model the app uses), and draw the 21 points. Print the 21 `(x, y, z)` values for one frame and find joints 0 (wrist), 4 (thumb tip), 8 (index tip) and 9 (middle knuckle) on your hand.
Docs: https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker

**Done when:** you can say which number is your thumb tip.

## Step 2 (M1): features that match the app
Write `features.py` with `window_features(frames, aspect)` following contract section 2, then:
```bash
python -m pytest test_features.py
```
**Done when:** it passes. Then your Python and the app see hands identically.

## Step 3 (M1): record letters
Run the app (`npm --prefix app run dev`), open `http://localhost:5179/#/record` in Chrome or Safari, and record every letter 5+ times (J and Z: draw them during the 2 seconds). Export, and save the JSON files in `ml/data/` (git-ignored). Different light and distances help.

## Step 4 (M1): a nearest-neighbour baseline you can fully explain
With scikit-learn's `KNeighborsClassifier` on the last frame of each window. Print a confusion matrix. Expect A/E/S/T and M/N to be confused, and work out why from the numbers. Use this before any neural net, because it's the "why did it say rock?" answer from your essay.

## Step 5 (M2): the real model
In PyTorch: input `[batch, 16, 63]` → a small 1D-conv + 2-layer Transformer (or start with an MLP on the flattened window) → a 64-dim `embedding` → `Linear(64, 27)` `logits`. Augment with **finger dropout** (move one finger onto the wrist, like the app's Why view does) and **time stretch**. Fit `temperature` on held-out signers, export with `torch.onnx.export(..., input_names=["landmarks"], output_names=["logits", "embedding"])`, and write `model.json` + `exemplars.json` into `app/public/models/`.

**Done when:** M-A-H-I-T comes back as M-A-H-I-T live, and `eval_heldout.py` reports accuracy on someone who isn't in the training data.

## Learning order (search these titles on YouTube)
1. **3Blue1Brown, "But what is a neural network?"** (and the next three in the series): what a model is.
2. **Murtaza's Workshop, "Hand Tracking 30 FPS using CPU | OpenCV Python"**: Step 1. It uses the older `mp.solutions.hands`; use the idea, but write the Tasks API version.
3. **Nicholas Renotte, sign-language detection with MediaPipe and LSTM**: what a sequence model on landmarks looks like (theirs is Keras; yours will be PyTorch).
4. **Andrej Karpathy, "Neural Networks: Zero to Hero"** (micrograd, then makemore): how training really works. Slow, but it's the course that makes you understand your own model.
5. **PyTorch "Learn the Basics" tutorial** (pytorch.org/tutorials): datasets, training loops, saving.
6. **Dr. Bill Vicars / Lifeprint fingerspelling lessons**: keep signing each letter to him before you record it.

FSboard (Google's fingerspelling data, CC BY 4.0) comes in M3 to cover more signers. Don't train on ASL Citizen, WLASL or How2Sign: their licences forbid commercial use.

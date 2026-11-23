"""Your features.py must turn the same landmarks into the same numbers as the app.

Run:  python -m pytest ml/test_features.py
It fails until you write ml/features.py with:
    window_features(frames, aspect) -> numpy array of shape (16, 63)
where each frame is {"landmarks": [[x, y, z] * 21], "isLeft": bool}.
The rules are in shared/MODEL_CONTRACT.md, section 2.
"""
import json
from pathlib import Path

import numpy as np

from features import window_features

FIXTURE = Path(__file__).resolve().parent.parent / "shared" / "fixtures" / "features.json"


def test_matches_the_app():
    data = json.loads(FIXTURE.read_text())
    assert data["feature_version"] == 1
    for case in data["cases"]:
        got = np.asarray(window_features(case["frames"], case["aspect"]), dtype=np.float32).reshape(-1)
        want = np.asarray(case["expected"], dtype=np.float32)
        np.testing.assert_allclose(got, want, atol=1e-5, err_msg=case["name"])

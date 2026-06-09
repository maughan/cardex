"""Screen / print spoof detection.

The production signal is a small binary CNN (real scene vs re-photographed
screen/print). It isn't available off-the-shelf, so this module ships:
  - a `ScreenClassifier` interface to plug the trained model into, and
  - a classical FFT-based fallback that flags the periodic moire / pixel-grid
    energy a camera picks up off an LCD or halftone print.

The classical score is a useful first gate and a sanity check, but the CNN is
what actually carries this signal once trained.
"""
from __future__ import annotations

from typing import Optional, Protocol

import numpy as np
from PIL import Image

from .types import SignalResult, Status


class ScreenClassifier(Protocol):
    def predict(self, img: Image.Image) -> Optional[float]:
        """Return P(spoofed) in 0..1, or None if it can't decide."""
        ...


def classical_screen_score(img: Image.Image) -> float:
    """Heuristic 0..1: high when the spectrum has strong localized peaks off the
    DC centre, characteristic of a regular screen/print grid (moire)."""
    g = np.asarray(img.convert("L").resize((256, 256)), dtype=np.float32)
    g -= g.mean()
    # Window to reduce spectral leakage from the image border.
    win = np.hanning(256)
    g *= np.outer(win, win)

    mag = np.abs(np.fft.fftshift(np.fft.fft2(g)))
    h, w = mag.shape
    cy, cx = h // 2, w // 2
    # Null out the low-frequency core (natural scene structure lives here).
    mag[cy - 16:cy + 16, cx - 16:cx + 16] = 0.0

    total = float(mag.sum()) + 1e-6
    # Periodic grids concentrate energy into a few sharp peaks; natural scenes
    # spread high-frequency energy diffusely. Measure that concentration.
    top = np.sort(mag.ravel())[::-1][:40].sum()
    score = (top / total) * 9.0
    return float(max(0.0, min(1.0, score)))


def analyze_screen(img: Image.Image, model: Optional[ScreenClassifier] = None) -> SignalResult:
    if model is not None:
        p = model.predict(img)
        if p is not None:
            status = Status.PASS if p < 0.4 else (Status.SUSPECT if p < 0.75 else Status.FAIL)
            return SignalResult("screen", status, float(p), detail=f"cnn={p:.2f}")

    score = classical_screen_score(img)
    status = Status.PASS if score < 0.4 else (Status.SUSPECT if score < 0.75 else Status.FAIL)
    return SignalResult("screen", status, score, detail=f"fft={score:.2f}")

"""Flatness / depth signal.

A real car sits in a 3D scene (ground, background, perspective, focus falloff);
a photo-of-a-photo is a flat plane. The production signal runs single-image
monocular depth estimation (e.g. MiDaS) and flags a near-uniform depth map.

Plug the real model via the `DepthModel` interface. The classical fallback is a
weak proxy (gradient-uniformity) and is intentionally low-weighted.
"""
from __future__ import annotations

from typing import Optional, Protocol

import numpy as np
from PIL import Image

from .types import SignalResult, Status


class DepthModel(Protocol):
    def flatness(self, img: Image.Image) -> Optional[float]:
        """Return 0..1 flatness (1 = perfectly flat depth), or None."""
        ...


def classical_flatness_score(img: Image.Image) -> float:
    """Proxy: a rephotographed flat source tends to have spatially uniform
    gradient magnitude (single focal plane). Real scenes vary far more, so a low
    coefficient-of-variation reads as suspicious/flat."""
    g = np.asarray(img.convert("L").resize((256, 256)), dtype=np.float32)
    gx = np.abs(np.diff(g, axis=1))[:-1, :]
    gy = np.abs(np.diff(g, axis=0))[:, :-1]
    grad = gx + gy
    cv = grad.std() / (grad.mean() + 1e-6)
    # cv ~1.5+ is rich/varied; near 0 is uniform. Map low cv -> high suspicion.
    return float(max(0.0, min(1.0, 1.0 - cv / 1.5)))


def analyze_depth(img: Image.Image, model: Optional[DepthModel] = None) -> SignalResult:
    if model is not None:
        f = model.flatness(img)
        if f is not None:
            status = Status.PASS if f < 0.5 else (Status.SUSPECT if f < 0.8 else Status.FAIL)
            return SignalResult("depth", status, float(f), detail=f"midas={f:.2f}")

    score = classical_flatness_score(img)
    status = Status.PASS if score < 0.5 else (Status.SUSPECT if score < 0.8 else Status.FAIL)
    return SignalResult("depth", status, score, detail=f"flatness={score:.2f}")

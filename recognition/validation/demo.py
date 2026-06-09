"""Runnable demo of the validation pipeline on synthetic images.

Generates a 'natural-ish' image (smooth low-frequency structure) and a
'screen-ish' image (a regular pixel grid that produces moire-like spectral
peaks), then runs the lenient pipeline on each. Demonstrates the classical
signals separate the two even before the real ML models are plugged in.

    python -m validation.demo            # from the recognition/ folder
"""
from __future__ import annotations

import numpy as np
from PIL import Image

from .pipeline import ValidationPipeline
from .types import ClaimedMeta


def natural_image(seed: int = 0) -> Image.Image:
    rng = np.random.default_rng(seed)
    # Low-frequency blobs upsampled -> smooth, varied, scene-like.
    small = rng.random((16, 16))
    img = np.asarray(Image.fromarray((small * 255).astype("uint8")).resize((256, 256)))
    img = img.astype(np.float32)
    img += rng.normal(0, 8, img.shape)  # mild sensor noise
    img = np.clip(img, 0, 255).astype("uint8")
    return Image.fromarray(img).convert("RGB")


def screen_image() -> Image.Image:
    # A fine regular grid — the periodic structure a camera captures off an LCD.
    x = np.arange(256)
    grid = (np.sin(x / 1.5) > 0).astype(np.float32)
    field = np.outer(grid, grid) * 200 + 30
    return Image.fromarray(field.astype("uint8")).convert("RGB")


def run(label: str, img: Image.Image, pipe: ValidationPipeline, live: bool) -> None:
    res = pipe.validate(img, ClaimedMeta(live_capture=live))
    print(f"\n== {label} ==")
    print(f"  verdict={res.verdict.value}  isReal={res.is_real}  "
          f"suspicion={res.suspicion:.2f}  flagged={res.flagged}")
    for s in res.signals:
        print(f"    - {s.name:11s} {s.status.value:7s} {s.suspicion:.2f}  {s.detail}")
    if res.reasons:
        print(f"  reasons: {res.reasons}")


def main() -> None:
    pipe = ValidationPipeline()
    nat = natural_image()
    scr = screen_image()

    run("natural photo (live)", nat, pipe, live=True)
    run("screen recapture (live)", scr, pipe, live=True)
    # Re-submit the natural image -> duplicate gate fires.
    run("resubmit natural (dup)", nat, pipe, live=True)
    # Same natural content but not live-captured -> extra provenance suspicion.
    run("gallery import (not live)", natural_image(seed=1), pipe, live=False)


if __name__ == "__main__":
    main()

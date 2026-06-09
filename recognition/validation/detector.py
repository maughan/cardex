"""Car-presence detector.

v1 decision: our own lightweight detector (e.g. a small YOLO / Mobilek-SSD)
that confirms a vehicle is present and returns a crop for the make/model
classifier. Training/hosting that model is a separate task; this module defines
the interface plus a no-op stub so the pipeline runs end-to-end before the model
exists.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Protocol

from PIL import Image


@dataclass
class CarDetection:
    present: Optional[bool]                 # None = couldn't decide (no model yet)
    confidence: float                       # 0..1
    bbox: Optional[tuple[int, int, int, int]] = None  # x, y, w, h crop


class CarDetector(Protocol):
    def detect(self, img: Image.Image) -> CarDetection:
        ...


class StubCarDetector:
    """Placeholder until the real detector is trained. Returns 'unknown', which
    the lenient pipeline treats as 'assume a car is present' so it never blocks
    a real catch during development."""

    def detect(self, img: Image.Image) -> CarDetection:
        return CarDetection(present=None, confidence=0.0, bbox=None)


def crop_to_detection(img: Image.Image, det: CarDetection) -> Image.Image:
    """Tight crop to the detected car (for the classifier / spoof checks).
    Returns the original image if there is no bbox."""
    if det.bbox is None:
        return img
    x, y, w, h = det.bbox
    x, y = max(0, x), max(0, y)
    return img.crop((x, y, x + w, y + h))

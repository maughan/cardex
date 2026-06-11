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


def crop_to_bbox(
    img: Image.Image,
    bbox: Optional[tuple[int, int, int, int]],
    margin: float = 0.12,
) -> Image.Image:
    """Crop to a (x, y, w, h) box, expanded by `margin` on each side so a tight
    detector box doesn't clip bumpers/roof. Returns the original if no box."""
    if bbox is None:
        return img
    x, y, w, h = bbox
    mx, my = int(w * margin), int(h * margin)
    left = max(0, x - mx)
    top = max(0, y - my)
    right = min(img.width, x + w + mx)
    bottom = min(img.height, y + h + my)
    if right <= left or bottom <= top:
        return img
    return img.crop((left, top, right, bottom))


def crop_to_detection(img: Image.Image, det: CarDetection) -> Image.Image:
    """Tight crop to the detected car (for the classifier / spoof checks).
    Returns the original image if there is no bbox."""
    return crop_to_bbox(img, det.bbox, margin=0.0)

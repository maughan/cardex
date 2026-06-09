"""Car-image validation pipeline for CarDex.

Lenient (UX-first) defense-in-depth: presence detection, duplicate detection,
and a weighted spoof score (provenance + screen/print + depth).
"""
from .pipeline import ValidationPipeline
from .types import (
    ClaimedMeta,
    SignalResult,
    Status,
    ValidationConfig,
    ValidationResult,
    Verdict,
)
from .dedup import SeenStore, dhash, hamming
from .detector import CarDetection, CarDetector, StubCarDetector, crop_to_detection
from .yolo_detector import YoloCarDetector  # lazy ultralytics import inside __init__

__all__ = [
    "ValidationPipeline",
    "ValidationConfig",
    "ValidationResult",
    "Verdict",
    "Status",
    "SignalResult",
    "ClaimedMeta",
    "SeenStore",
    "dhash",
    "hamming",
    "CarDetection",
    "CarDetector",
    "StubCarDetector",
    "YoloCarDetector",
    "crop_to_detection",
]

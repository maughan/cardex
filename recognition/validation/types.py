"""Shared types for the car-image validation pipeline."""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class Status(str, Enum):
    PASS = "pass"          # signal looks clean
    SUSPECT = "suspect"    # signal contributes some suspicion
    FAIL = "fail"          # signal strongly indicates a problem
    UNKNOWN = "unknown"    # signal could not decide (e.g. model unavailable)


@dataclass
class SignalResult:
    name: str
    status: Status
    suspicion: float          # 0..1 contribution toward "spoofed / invalid"
    weight: float = 1.0       # how much this signal counts in aggregation
    detail: str = ""


class Verdict(str, Enum):
    ACCEPT = "accept"         # real car, count the catch
    RETRY = "retry"           # soft reject — ask the user to retake (lenient)
    NO_CAR = "no_car"         # nothing car-like detected
    DUPLICATE = "duplicate"   # image reused / already submitted


@dataclass
class ValidationResult:
    verdict: Verdict
    is_real: bool
    suspicion: float                       # aggregate 0..1
    flagged: bool = False                  # accepted but logged for review
    signals: list[SignalResult] = field(default_factory=list)
    reasons: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "verdict": self.verdict.value,
            "isReal": self.is_real,
            "suspicion": round(self.suspicion, 3),
            "flagged": self.flagged,
            "reasons": self.reasons,
            "signals": [
                {
                    "name": s.name,
                    "status": s.status.value,
                    "suspicion": round(s.suspicion, 3),
                    "weight": s.weight,
                    "detail": s.detail,
                }
                for s in self.signals
            ],
        }


@dataclass
class ValidationConfig:
    # Lenient (UX-first): only soft-reject above a high bar; never hard-ban here.
    retry_threshold: float = 0.72   # aggregate suspicion >= -> RETRY
    flag_threshold: float = 0.45    # aggregate suspicion >= -> ACCEPT but flag
    # Per-signal weights used in the aggregate.
    weight_screen: float = 0.50
    weight_depth: float = 0.20
    weight_provenance: float = 0.30
    # Detector confidence required to actively reject as "no car".
    no_car_confidence: float = 0.60
    # Perceptual-hash Hamming distance considered a near-duplicate.
    dedup_hamming_max: int = 6


@dataclass
class ClaimedMeta:
    """Client-asserted context for a capture (treated as untrusted hints)."""
    live_capture: bool = False
    lat: Optional[float] = None
    lng: Optional[float] = None
    captured_at: Optional[str] = None

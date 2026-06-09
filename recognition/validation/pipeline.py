"""Validation orchestrator.

Runs the signal stack in cheap-to-expensive order and aggregates to a verdict
under the lenient (UX-first) policy:

  - Hard outcomes only on strong, unambiguous evidence:
      * detector says "no car" with high confidence -> NO_CAR (just retake)
      * exact / near image duplicate            -> DUPLICATE (reused image)
  - Otherwise accumulate weighted suspicion from provenance + screen + depth:
      * >= retry_threshold -> RETRY (soft "try again", never a ban)
      * >= flag_threshold  -> ACCEPT but flag for review / the training flywheel
      * else               -> ACCEPT

Accepted images have their perceptual hash stored so re-submissions are caught.
"""
from __future__ import annotations

from typing import Iterable, Optional

from PIL import Image

from .dedup import SeenStore, analyze_dedup
from .depth import DepthModel, analyze_depth
from .detector import CarDetector, StubCarDetector
from .provenance import analyze_provenance
from .screen_spoof import ScreenClassifier, analyze_screen
from .types import (
    ClaimedMeta,
    SignalResult,
    Status,
    ValidationConfig,
    ValidationResult,
    Verdict,
)


class ValidationPipeline:
    def __init__(
        self,
        config: Optional[ValidationConfig] = None,
        detector: Optional[CarDetector] = None,
        screen_model: Optional[ScreenClassifier] = None,
        depth_model: Optional[DepthModel] = None,
        seen_store: Optional[SeenStore] = None,
        known_hashes: Iterable[int] = (),
    ) -> None:
        self.cfg = config or ValidationConfig()
        self.detector = detector or StubCarDetector()
        self.screen_model = screen_model
        self.depth_model = depth_model
        self.seen = seen_store or SeenStore()
        self.known_hashes = list(known_hashes)

    def validate(self, img: Image.Image, claimed: Optional[ClaimedMeta] = None) -> ValidationResult:
        claimed = claimed or ClaimedMeta()
        signals: list[SignalResult] = []
        reasons: list[str] = []

        # 1. Presence gate.
        det = self.detector.detect(img)
        if det.present is False and det.confidence >= self.cfg.no_car_confidence:
            return ValidationResult(
                verdict=Verdict.NO_CAR, is_real=False, suspicion=0.0,
                reasons=["no_car"],
            )

        # 2. Duplicate gate.
        dedup_sig, img_hash = analyze_dedup(
            img, self.seen, self.known_hashes, self.cfg.dedup_hamming_max
        )
        signals.append(dedup_sig)
        if dedup_sig.status is Status.FAIL:
            return ValidationResult(
                verdict=Verdict.DUPLICATE, is_real=False, suspicion=1.0,
                signals=signals, reasons=[dedup_sig.detail],
            )

        # 3. Spoof signals (weighted).
        prov = analyze_provenance(img, claimed); prov.weight = self.cfg.weight_provenance
        screen = analyze_screen(img, self.screen_model); screen.weight = self.cfg.weight_screen
        depth = analyze_depth(img, self.depth_model); depth.weight = self.cfg.weight_depth
        signals.extend([prov, screen, depth])

        weighted = sum(s.suspicion * s.weight for s in (prov, screen, depth))
        total_w = sum(s.weight for s in (prov, screen, depth)) or 1.0
        suspicion = weighted / total_w

        for s in (prov, screen, depth):
            if s.status in (Status.SUSPECT, Status.FAIL):
                reasons.append(f"{s.name}:{s.detail}")

        # 4a. Strong single-signal evidence escalates to a soft retry even under
        #     the lenient policy (a confident screen detection or an editor /
        #     screenshot signature). The weak depth proxy never escalates alone.
        strong = [s for s in (screen, prov) if s.status is Status.FAIL]
        if strong:
            return ValidationResult(
                verdict=Verdict.RETRY, is_real=False,
                suspicion=max(suspicion, max(s.suspicion for s in strong)),
                signals=signals, reasons=reasons or ["looks_spoofed"],
            )

        # 4b. Otherwise use the accumulated weighted suspicion.
        if suspicion >= self.cfg.retry_threshold:
            return ValidationResult(
                verdict=Verdict.RETRY, is_real=False, suspicion=suspicion,
                signals=signals, reasons=reasons or ["looks_spoofed"],
            )

        flagged = suspicion >= self.cfg.flag_threshold
        self.seen.add(img_hash)  # remember accepted captures
        return ValidationResult(
            verdict=Verdict.ACCEPT, is_real=True, suspicion=suspicion,
            flagged=flagged, signals=signals, reasons=reasons,
        )

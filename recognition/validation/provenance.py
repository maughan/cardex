"""Capture-provenance signal — cheap EXIF / metadata heuristics.

These are *hints*, not proof: many legitimate pipelines strip EXIF, so under the
lenient policy missing data adds only mild suspicion, never an outright reject.
"""
from __future__ import annotations

from PIL import Image

from .types import ClaimedMeta, SignalResult, Status

# Common phone screenshot / screen aspect ratios (w:h, normalised >= 1).
_SCREENSHOT_RATIOS = [19.5 / 9, 16 / 9, 4 / 3, 3 / 2]
_EDITOR_HINTS = ("screenshot", "photoshop", "gimp", "snipping", "figma", "preview")


def _aspect(img: Image.Image) -> float:
    w, h = img.size
    if w == 0 or h == 0:
        return 1.0
    return max(w, h) / min(w, h)


def analyze_provenance(img: Image.Image, claimed: ClaimedMeta) -> SignalResult:
    suspicion = 0.0
    notes: list[str] = []

    # 1. Live-capture flag (client-asserted, but honest clients always set it).
    if not claimed.live_capture:
        suspicion += 0.35
        notes.append("not_live_capture")

    # 2. EXIF camera tags. Real captures usually carry Make/Model; absence is a
    #    weak signal only (EXIF is often stripped server-side or by RN).
    make = model = software = None
    try:
        exif = img.getexif()
        make = exif.get(271)       # Make
        model = exif.get(272)      # Model
        software = exif.get(305)   # Software
    except Exception:
        exif = {}

    if not make and not model:
        suspicion += 0.10
        notes.append("no_camera_exif")

    # 3. Editing / screenshot software signature -> stronger signal.
    if software and any(h in str(software).lower() for h in _EDITOR_HINTS):
        suspicion += 0.30
        notes.append(f"software:{software}")

    status = Status.PASS
    if suspicion >= 0.30:
        status = Status.SUSPECT
    if suspicion >= 0.60:
        status = Status.FAIL

    return SignalResult(
        name="provenance",
        status=status,
        suspicion=min(1.0, suspicion),
        detail=", ".join(notes) or "ok",
    )

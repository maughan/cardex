"""Perceptual-hash de-duplication.

Catches the big cheat class — submitting an image pulled off the internet, or
re-submitting one already seen. A 64-bit dHash is robust to resize/recompress
but changes a lot under real-world recapture, so near-matches are meaningful.

Seed `known_hashes` with hashes of popular stock/listing images per model to
also catch "downloaded a picture of the car."
"""
from __future__ import annotations

from typing import Iterable

import numpy as np
from PIL import Image

from .types import SignalResult, Status


def dhash(img: Image.Image, hash_size: int = 8) -> int:
    """Row-wise difference hash -> hash_size*hash_size bits packed into an int."""
    g = img.convert("L").resize((hash_size + 1, hash_size))
    a = np.asarray(g, dtype=np.int16)
    diff = a[:, 1:] > a[:, :-1]
    bits = 0
    for b in diff.flatten():
        bits = (bits << 1) | int(b)
    return bits


def hamming(a: int, b: int) -> int:
    return bin(a ^ b).count("1")


class SeenStore:
    """Pluggable store of previously-accepted hashes. Swap for Postgres/Redis
    (e.g. a bit-sampling LSH index) in production; in-memory here."""

    def __init__(self) -> None:
        self._hashes: list[int] = []

    def add(self, h: int) -> None:
        self._hashes.append(h)

    def nearest(self, h: int) -> int:
        if not self._hashes:
            return 64
        return min(hamming(h, x) for x in self._hashes)


def analyze_dedup(
    img: Image.Image,
    store: SeenStore,
    known_hashes: Iterable[int] = (),
    hamming_max: int = 6,
) -> tuple[SignalResult, int]:
    h = dhash(img)
    seen = store.nearest(h)
    known = min((hamming(h, k) for k in known_hashes), default=64)
    best = min(seen, known)

    if best == 0:
        return SignalResult("dedup", Status.FAIL, 1.0, detail="exact_duplicate"), h
    if best <= hamming_max:
        return SignalResult("dedup", Status.FAIL, 0.9, detail=f"near_duplicate(d={best})"), h
    return SignalResult("dedup", Status.PASS, 0.0, detail=f"unique(d={best})"), h

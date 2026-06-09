# CarDex — Car-Image Validation Spec (v1)

How the recognition service decides an image is a **real car, captured live** —
before it spends effort on make/model classification. Companion to the
recognition service spec; implemented as the `recognition/validation/` package
(a runnable scaffold: classical signals work today, deep models plug in via
interfaces).

## Decisions (locked)

| Area | Decision |
|---|---|
| Car presence | Our own lightweight detector (YOLO / MobileNet-class) |
| Spoof stack | Full: provenance + pHash dedup + screen/print classifier + single-image depth |
| Capture UX | Single live photo |
| Rejection policy | **Lenient (UX-first)** — soft "try again", never a hard ban here |

## Threat model

Cheating a collecting game means submitting a car that isn't a real, live
sighting: a photo of a **screen** (phone/monitor), a **print/magazine**, an
image pulled off the **internet** (stock/listing), a **diecast/toy**, or an
**AI-generated** render. Each leaves different tells; we layer cheap gates
before expensive models.

## Pipeline (cheap → expensive)

Order and decision logic exactly match `validation/pipeline.py`:

1. **Presence gate — `detector.py`.** Own detector confirms a vehicle and
   returns a crop for the classifier. High-confidence "no car" → `NO_CAR`
   (friendly retake, not a cheat). Until trained, the stub returns *unknown* and
   the lenient pipeline assumes a car is present so real catches never block.
2. **Duplicate gate — `dedup.py`.** 64-bit dHash; compared against previously
   accepted hashes and a seed of known stock/listing hashes. Exact/near match →
   `DUPLICATE`. Cheapest defence against the biggest cheat class (reused
   internet images). Production: a bit-sampling LSH index in Postgres/Redis.
3. **Spoof signals (weighted).**
   - **Provenance — `provenance.py`** (weight 0.30): live-capture flag, EXIF
     camera tags, screenshot/editor software signatures. Hints, not proof —
     missing EXIF adds only mild suspicion.
   - **Screen/print — `screen_spoof.py`** (weight 0.50): the core model — a
     small binary CNN (real vs re-photographed). Ships with an FFT moiré
     fallback that already flags pixel-grid/halftone periodicity.
   - **Depth/flatness — `depth.py`** (weight 0.20): monocular depth (MiDaS)
     flags a near-uniform depth map (photo-of-a-photo is flat). Ships with a
     weak gradient-uniformity proxy; intentionally low-weighted.

### Lenient decision logic

- **Strong single-signal evidence** (screen classifier = FAIL, or an
  editor/screenshot signature) → `RETRY` (soft "take it again"). The weak depth
  proxy never escalates on its own.
- **Otherwise** aggregate weighted suspicion across the three spoof signals:
  - `>= 0.72` → `RETRY`
  - `>= 0.45` → `ACCEPT` but **flagged** (logged for review + the flywheel)
  - else → `ACCEPT`
- Accepted captures store their hash so re-submissions are caught.
- Nothing here issues a ban — every negative is "try again." Bans/penalties are
  a later, leaderboard-era concern.

The verdict maps onto the `recognize` Edge Function response: `ACCEPT` →
`isReal:true`; `RETRY`/`NO_CAR`/`DUPLICATE` → `isReal:false` with the reason,
which the app already renders as a friendly rejection.

## The ML builds (and their data)

- **Screen/print classifier — the main build.** No good off-the-shelf model, so
  it needs a dataset: real car photos vs the *same scenes re-photographed off
  screens/prints*. Bootstrap with synthetic augmentation (simulate moiré/screen
  capture over real photos), then improve continuously from app captures and the
  flagged/corrected flywheel. A small MobileNet-class CNN on the detector crop.
- **Car detector.** Shipped: `validation/yolo_detector.py` — `YoloCarDetector`
  wraps Ultralytics YOLO11 (COCO includes car/truck/bus, weights auto-download)
  behind the `CarDetector` interface. Enable with
  `ValidationPipeline(detector=YoloCarDetector())` after
  `pip install -r requirements-ml.txt`; `crop_to_detection()` gives the car crop
  for the classifier and spoof checks. Fine-tune on car-specific data later for
  tighter boxes / toy rejection.
- **Depth.** Use a pretrained monocular depth model (MiDaS-small); derive a
  flatness score from the depth map's variance. No training needed.

## Phasing

- **Now (no training):** provenance + pHash dedup + the FFT screen fallback +
  the depth proxy + lenient orchestration. This already deters casual cheating.
- **Next:** train + host the screen/print CNN (the highest-value signal); swap
  it in behind the existing `ScreenClassifier` interface.
- **Then:** switch on `YoloCarDetector` (replace the stub) and add MiDaS depth.
- **Later / deferred:** AI-generated-image detection (an arms race), multi-frame
  parallax liveness (UX cost), penalties/bans.

## Honest limits

Perfect anti-spoof is impossible; the goal is to make casual cheating
*annoying*, which is sufficient until competitive leaderboards exist. Keep the
policy lenient until then so false rejections don't punish honest players —
collect flagged samples now so the models are strong before the stakes rise.

## Try it

```bash
cd recognition
pip install -r requirements.txt
python -m validation.demo
```

Runs the pipeline on synthetic natural vs screen-recapture images and prints the
per-signal breakdown and verdict.

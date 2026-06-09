# CarDex — Make/Model Training

Turns the Kaggle *Car Model Variants and Images* dataset (~3,800 variants,
20–200 images each, 512×512) into a make/model recogniser for the recognition
service.

## Pipeline

```
images/ + metadata.csv
        │  build_manifest.py        (join images↔metadata, clean, label)
        ▼
manifest.csv · classes.json · catalogue.csv
        │  train.py                 (timm transfer learning + eval)
        ▼
model.pt · embeddings.npz           (classifier + per-class reference vectors)
        │  → serve behind MakeModelClassifier; load embeddings into pgvector
        ▼
recognize service returns ranked car_id candidates
```

## Steps

1. **Manifest** — reads the shipped `train/` + `test/` folders, normalises
   brands, maps body styles, cleans the dirty year columns, and emits the label
   space + a `catalogue.csv` for ingesting into the `cars` table:
   ```bash
   python build_manifest.py --data-dir ./dataset --metadata ./dataset.csv --out-dir ./out
   ```
   - **Label policy: one class per variant folder** (each already has 20–200
     images — plenty per class — and it's robust to imperfect CSV joins).
   - The dataset's own **train/test split is preserved** (a `split` column);
     `train.py` uses it directly.
   - The CSV is joined via a **year-robust key** that strips the folder's year
     prefix and the title's year suffix while keeping model-distinguishing
     digits (428 ≠ 458). Unmatched folders still train, labelled from the folder
     name, and are listed in `unmatched.txt` — check the printed match rate.

2. **Train** (GPU):
   ```bash
   python train.py --manifest out/manifest.csv --classes out/classes.json \
     --backbone tf_efficientnet_b0 --epochs 12
   ```
   Transfer-learns a pretrained backbone (head warm-up then full fine-tune),
   reports top-1/top-3, saves the best checkpoint, and exports per-class
   reference embeddings.

3. **Serve** — load `model.pt` behind a `MakeModelClassifier` in the recognition
   service; for the scalable path, push `embeddings.npz` into the **pgvector**
   column and identify by nearest-neighbour (adding catalogue cars later needs
   no retrain).

## Free compute

The dataset already lives on Kaggle — train in a **Kaggle notebook** with the
dataset attached (free T4/P100, no download/egress). Colab works too.

## The big caveat: domain gap

These are clean, single-source images. Expect strong validation numbers and a
real drop on messy phone photos. Mitigations, in order:
- aggressive augmentation (already in `dataset.py` — heavy colour jitter so it
  doesn't learn "red ⇒ Ferrari", plus crops/perspective/blur/erasing);
- a **small hand-collected real-photo test set** — the only honest accuracy
  measure;
- fine-tune on real app captures via the confirm-step flywheel once live.

## Status

The data-prep (`build_manifest.py`) is verified on synthetic data matching the
real layout (train/test folders, year-prefixed folder names, year-suffixed CSV
titles) — the year-robust join matched 100% of those cases. `dataset.py` /
`train.py` are syntax-checked scaffolds — they need the GPU ML deps
(`requirements-ml.txt`) and a real run; treat them as the starting point to
iterate on, not a finished trained model.

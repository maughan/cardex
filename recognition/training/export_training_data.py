"""Export labeled real-world images into a training-ready folder tree.

The flywheel's payoff step. Unions TWO sources of labeled phone photos:

  1. Retained catch captures  — view `training_examples`,        bucket `training_images`
  2. Approved car submissions — view `submission_training_examples`, bucket `submissions`

and writes both into:

    <out>/train/<model_class>/<prefix>_<id>.jpg

`<model_class>` matches build_manifest.py's folder/label key, so this tree
merges straight into the Kaggle dataset's train/ dir — then re-run
build_manifest + train to fold real data (and brand-new community cars) in.

    export SUPABASE_URL=https://<project>.supabase.co
    export SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # NOT the anon key
    python export_training_data.py --out ./training_export

Incremental + safe to re-run: skips images already on disk. Flags:
    --corrected-only   only catch corrections (model was wrong) — highest value
    --no-captures      skip source 1
    --no-submissions   skip source 2
    --since <iso>      only captures on/after a timestamp (source 1 only)

The service-role key is required (both buckets are private). Pass it via env
only — keep it out of the repo / shell history.
"""
from __future__ import annotations

import argparse
import csv
import os
import sys
from pathlib import Path
from urllib.parse import quote

import requests

PAGE = 1000  # PostgREST default max rows per request


def env(name: str) -> str:
    v = os.environ.get(name)
    if not v:
        sys.exit(f"missing env: {name}")
    return v


def fetch_view(base: str, key: str, view: str, select: str,
               extra: dict[str, str] | None = None) -> list[dict]:
    """Page through a PostgREST view."""
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}
    rows: list[dict] = []
    offset = 0
    while True:
        params = {"select": select, "limit": str(PAGE), "offset": str(offset)}
        if extra:
            params.update(extra)
        r = requests.get(f"{base}/rest/v1/{view}", headers=headers, params=params, timeout=30)
        r.raise_for_status()
        batch = r.json()
        rows.extend(batch)
        if len(batch) < PAGE:
            break
        offset += PAGE
    return rows


def download_object(base: str, key: str, bucket: str, object_path: str) -> bytes:
    """Download a private-bucket object using the service-role key."""
    url = f"{base}/storage/v1/object/{bucket}/{quote(object_path)}"
    r = requests.get(url, headers={"Authorization": f"Bearer {key}"}, timeout=60)
    r.raise_for_status()
    return r.content


def export_source(
    base: str, key: str, rows: list[dict], bucket: str, prefix: str,
    id_field: str, train_dir: Path, writer: csv.writer, source: str,
) -> dict[str, int]:
    """Download a source's images into train/<model_class>/ and log to manifest.
    Returns counts."""
    per_class: dict[str, int] = {}
    saved = skipped = failed = 0
    for row in rows:
        model_class = row.get("model_class")
        image_path = row.get("image_path")
        if not model_class or not image_path:
            continue
        dest_dir = train_dir / model_class
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / f"{prefix}_{row[id_field]}.jpg"

        if dest.exists():
            skipped += 1
        else:
            try:
                dest.write_bytes(download_object(base, key, bucket, image_path))
                saved += 1
            except requests.HTTPError as e:
                print(f"  [{source}] download failed ({id_field} {row.get(id_field)}): {e}")
                failed += 1
                continue

        per_class[model_class] = per_class.get(model_class, 0) + 1
        writer.writerow([
            source, row.get(id_field), model_class, row.get("car_id"),
            row.get("make"), row.get("model"), bucket, image_path, str(dest),
        ])

    print(f"[{source}] rows: {len(rows)}  saved: {saved}  skipped: {skipped}  failed: {failed}")
    return per_class


def merge_counts(a: dict[str, int], b: dict[str, int]) -> dict[str, int]:
    out = dict(a)
    for k, v in b.items():
        out[k] = out.get(k, 0) + v
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="./training_export")
    ap.add_argument("--corrected-only", action="store_true",
                    help="captures: only corrections (model was wrong)")
    ap.add_argument("--since", default=None,
                    help="captures: ISO timestamp; only on/after it")
    ap.add_argument("--no-captures", action="store_true", help="skip retained captures")
    ap.add_argument("--no-submissions", action="store_true", help="skip approved submissions")
    args = ap.parse_args()

    base = env("SUPABASE_URL").rstrip("/")
    key = env("SUPABASE_SERVICE_ROLE_KEY")

    out = Path(args.out)
    train_dir = out / "train"
    train_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = out / "export_manifest.csv"

    per_class: dict[str, int] = {}
    with open(manifest_path, "w", newline="") as mf:
        w = csv.writer(mf)
        w.writerow(["source", "ref_id", "model_class", "car_id",
                    "make", "model", "bucket", "image_path", "saved_path"])

        # Source 1: retained catch captures.
        if not args.no_captures:
            extra = {"order": "created_at.asc"}
            if args.corrected_only:
                extra["was_corrected"] = "eq.true"
            if args.since:
                extra["created_at"] = f"gte.{args.since}"
            cap = fetch_view(
                base, key, "training_examples",
                "log_id,image_path,car_id,model_class,make,model,was_corrected,created_at",
                extra,
            )
            per_class = merge_counts(per_class, export_source(
                base, key, cap, "training_images", "cardex", "log_id",
                train_dir, w, "capture",
            ))

        # Source 2: approved community submissions.
        if not args.no_submissions:
            sub = fetch_view(
                base, key, "submission_training_examples",
                "image_id,image_path,car_id,model_class,make,model",
                {"order": "image_id.asc"},
            )
            per_class = merge_counts(per_class, export_source(
                base, key, sub, "submissions", "sub", "image_id",
                train_dir, w, "submission",
            ))

    if not per_class:
        print("no labeled training images found.")
        return

    total = sum(per_class.values())
    print(f"\ntotal images: {total}   classes with data: {len(per_class)}")
    for cls, n in sorted(per_class.items(), key=lambda kv: -kv[1])[:10]:
        print(f"  {n:4d}  {cls}")
    print(f"-> {train_dir}  (+ {manifest_path.name})")
    print("\nNext: merge <out>/train/* into the Kaggle dataset's train/ dir, "
          "then re-run build_manifest.py + train.py + bump MODEL_VERSION.")


if __name__ == "__main__":
    main()

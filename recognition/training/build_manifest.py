"""Turn the Kaggle 'Car Model Variants and Images' dataset into a training
manifest + label space + a catalogue CSV for the app.

Dataset layout (as shipped):
    <data-dir>/train/<variant_folder>/*.jpg
    <data-dir>/test/<variant_folder>/*.jpg
    dataset.csv   (brand, model, from_year, to_year, body_style, segment,
                   title, description, engine_specs_title, ...)

  variant_folder example: 1921_Maybach_Typ_W3_2270HP_Convertible
  (year PREFIX + underscores), while the CSV `title` is year-SUFFIXED with
  spaces, e.g. "AC 428 Convertible 19661971".

Label policy: **one class per variant folder**. Each folder already holds
20–200 images, which is plenty per class, and using the folder as the class
makes training robust to imperfect CSV joins. The CSV is joined in only to
*enrich* each class (make / model / body / years / description) for the
catalogue + display; an unmatched folder still trains fine with a label parsed
from its name.

    python build_manifest.py --data-dir ./dataset --metadata ./dataset.csv --out-dir ./out
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import pandas as pd

BODY_MAP = {
    "suv": "suv", "sport utility": "suv", "crossover": "suv",
    "sedan": "sedan", "saloon": "sedan",
    "coupe cabrio": "convertible", "coupe": "coupe",
    "convertible": "convertible", "cabrio": "convertible",
    "spider": "convertible", "spyder": "convertible", "roadster": "convertible",
    "hatchback": "hatchback", "hatch": "hatchback",
    "wagon": "wagon", "estate": "wagon", "touring": "wagon",
    "van": "van", "mpv": "van", "minivan": "van",
    "pickup": "truck", "truck": "truck",
    "sports": "sports", "supercar": "sports",
}
_BRAND_FIXES = {
    "MERCEDESBENZ": "Mercedes-Benz", "ALFAROMEO": "Alfa Romeo",
    "ASTONMARTIN": "Aston Martin", "LANDROVER": "Land Rover",
    "ROLLSROYCE": "Rolls-Royce",
}
_BRAND_ACRONYMS = {"AC", "BMW", "MG", "GMC", "DS", "RAM", "BYD", "SAIC", "FSO"}


def norm(s) -> str:
    return re.sub(r"\s+", " ", str(s or "").strip())


def norm_brand(s: str) -> str:
    raw = norm(s)
    if raw.upper() in _BRAND_FIXES:
        return _BRAND_FIXES[raw.upper()]
    if raw.upper() in _BRAND_ACRONYMS:
        return raw.upper()
    return " ".join(
        w.upper() if (len(w) <= 3 and w.isupper()) else w.capitalize()
        for w in raw.split()
    )


def _alnum(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(s or "").lower())


def strip_make_prefix(model: str, brand: str) -> str:
    """The dataset's `model` is brand-prefixed in caps ('HONDA Civic',
    'MERCEDES BENZ E-Klasse'). Drop the leading brand tokens so the catalogue
    stores just 'Civic' / 'E-Klasse' and the app shows 'Honda Civic' once.

    Matches the brand ignoring case/spacing/hyphens; only strips when the
    leading word(s) fully equal the brand, and never returns empty."""
    brand_key = _alnum(brand)
    if not brand_key:
        return model
    words = model.split()
    acc, take = "", 0
    for i, w in enumerate(words):
        acc += _alnum(w)
        if acc == brand_key:
            take = i + 1
            break
        if not brand_key.startswith(acc):
            break  # diverged — model doesn't start with the brand
    if take == 0 or take >= len(words):
        return model  # no match, or stripping would empty it
    return " ".join(words[take:])


def map_body(s: str) -> str:
    low = norm(s).lower()
    for key, val in BODY_MAP.items():
        if key in low:
            return val
    return "other"


def clean_year(v) -> int | None:
    try:
        y = int(float(v))
    except (TypeError, ValueError):
        return None
    return y if 1885 <= y <= 2035 else None


def parse_production_years(v) -> tuple[int | None, int | None]:
    """Parse the dataset's `production_years` (the meaningful field) into a
    (start, end) pair. Handles ranges ("1993-2002"), single years ("1986"),
    and ongoing production ("2019-present"). from_year/to_year are NOT reliable
    in this dataset, so this is the source of truth for years.

    end is None when production is ongoing (present/current/now/trailing dash)."""
    if v is None:
        return (None, None)
    s = str(v)
    years = [int(y) for y in re.findall(r"(?:18|19|20)\d{2}", s)]
    years = [y for y in years if 1885 <= y <= 2035]
    if not years:
        return (None, None)
    start = min(years)
    ongoing = re.search(r"present|current|now|today|[–-]\s*$", s, re.IGNORECASE)
    end = None if ongoing else max(years)
    return (start, end)


def fmt_year_range(y0: int | None, y1: int | None) -> str:
    """Compact, human-friendly range for display: '1966–1971', '1986', or
    '2019–present'. (production_years in the dataset is a verbose comma list.)"""
    if y0 is None:
        return ""
    if y1 is None:
        return f"{y0}–present"
    return str(y0) if y0 == y1 else f"{y0}–{y1}"


def key_of(s: str) -> str:
    """Year-robust join key: drop 4-digit year tokens (handles the folder's year
    prefix and the title's concatenated year suffix), keep other digits (so 428
    vs 458, W3, etc. still distinguish), strip everything non-alphanumeric."""
    low = str(s or "").lower()
    low = re.sub(r"(?:18|19|20)\d{2}", " ", low)   # 1921, and 19661971 -> 1966+1971
    return re.sub(r"[^a-z0-9]+", "", low)


def prettify(folder: str) -> str:
    """Fallback display label from a folder name when the CSV join misses."""
    name = re.sub(r"^\d{3,4}[_-]", "", folder)     # drop leading year
    return norm(name.replace("_", " "))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", required=True, help="root containing train/ and test/")
    ap.add_argument("--metadata", required=True)
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--exts", default="jpg,jpeg,png")
    args = ap.parse_args()

    out = Path(args.out_dir); out.mkdir(parents=True, exist_ok=True)
    meta = pd.read_csv(args.metadata)
    meta["_key"] = meta["title"].map(key_of)
    meta_by_key = {row["_key"]: row for _, row in meta.iterrows()}

    exts = {e.strip().lower() for e in args.exts.split(",")}
    data_dir = Path(args.data_dir)
    splits = [s for s in ("train", "test") if (data_dir / s).is_dir()]
    if not splits:
        raise SystemExit(f"No train/ or test/ under {data_dir}")

    # Assign a stable class id per unique variant folder (shared across splits).
    all_folders = sorted({p.name for s in splits for p in (data_dir / s).iterdir() if p.is_dir()})
    class_to_id = {f: i for i, f in enumerate(all_folders)}

    rows, unmatched = [], []
    folder_meta: dict[str, dict] = {}  # folder -> enrichment for the catalogue
    for split in splits:
        for folder in sorted((data_dir / split).iterdir()):
            if not folder.is_dir():
                continue
            row = meta_by_key.get(key_of(folder.name))
            if row is not None:
                make = norm_brand(row["brand"])
                model = strip_make_prefix(norm(row["model"]), row["brand"])
                label = f"{make} {model}".strip()
                body = map_body(row.get("body_style", ""))
                # production_years is the meaningful field; from_year/to_year are
                # unreliable in this dataset. Fall back to them only if needed.
                y0, y1 = parse_production_years(row.get("production_years"))
                if y0 is None:
                    y0, y1 = clean_year(row.get("from_year")), clean_year(row.get("to_year"))
                folder_meta[folder.name] = {
                    "variant": norm(row.get("title", "")),
                    "segment": norm(row.get("segment", "")),
                    "description": norm(row.get("description", "")),
                    "engine": norm(row.get("engine_specs_title", "")),
                    # Compact range for display; numeric year_start/year_end (above)
                    # drive set logic.
                    "production_years": fmt_year_range(y0, y1),
                }
            else:
                if split == splits[0]:
                    unmatched.append(folder.name)
                make = model = ""
                label = prettify(folder.name)
                body, y0, y1 = "other", None, None

            for p in folder.rglob("*"):
                if p.suffix.lower().lstrip(".") in exts:
                    rows.append({
                        "image_path": str(p), "split": split,
                        "folder": folder.name, "class_id": class_to_id[folder.name],
                        "label": label, "make": make, "model": model,
                        "body": body, "year_start": y0, "year_end": y1,
                        "matched": row is not None,
                    })

    df = pd.DataFrame(rows)
    if df.empty:
        raise SystemExit("No images found — check --data-dir and --exts.")
    df["year_start"] = df["year_start"].astype("Int64")
    df["year_end"] = df["year_end"].astype("Int64")

    df.to_csv(out / "manifest.csv", index=False)
    (out / "classes.json").write_text(json.dumps(class_to_id, indent=2))
    cat = (df.drop_duplicates("folder")
             [["folder", "class_id", "label", "make", "model", "body", "year_start", "year_end", "matched"]]
             .sort_values("class_id")
             .copy())
    # Enrich one row per variant with the metadata fields, and expose the folder
    # as model_class (the stable key the recognition service maps predictions to).
    for col in ("variant", "segment", "description", "engine", "production_years"):
        cat[col] = cat["folder"].map(lambda f: folder_meta.get(f, {}).get(col, ""))
    cat = cat.rename(columns={"folder": "model_class"})
    cat.to_csv(out / "catalogue.csv", index=False)
    if unmatched:
        (out / "unmatched.txt").write_text("\n".join(unmatched))

    n_classes = len(class_to_id)
    matched = cat["matched"].sum()
    per = df.groupby("folder").size()
    print(f"images:            {len(df)} ({', '.join(f'{s}={ (df.split==s).sum() }' for s in splits)})")
    print(f"classes (variants):{n_classes}")
    print(f"CSV-matched:       {matched}/{n_classes} ({matched / n_classes:.0%})")
    print(f"images/class:      min={per.min()} median={int(per.median())} max={per.max()}")
    print(f"wrote manifest.csv, classes.json, catalogue.csv"
          + (", unmatched.txt" if unmatched else "") + f" -> {out}")


if __name__ == "__main__":
    main()

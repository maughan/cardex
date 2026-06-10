"""CarDex recognition service — HTTP layer over the validation pipeline + the
make/model classifier.

Exposes POST /v1/recognize, called by the Supabase `recognize` Edge Function.
Runs the lenient validation gate first; if the image passes, runs the embedding
classifier and returns ranked predictions by model_class.

The service is intentionally DB-agnostic: it returns `predictions` keyed by
`model_class` + confidence. The `recognize` Edge Function resolves those to
catalogue `car_id` / rarity via the `cars` table (lookup on `model_class`).

Run:
    pip install -r requirements.txt -r requirements-service.txt -r requirements-ml.txt
    MODEL_PATH=model.pt EMBEDDINGS_PATH=embeddings.npz uvicorn app:app --host 0.0.0.0 --port 8000

Env:
    MODEL_PATH, EMBEDDINGS_PATH   trained artifacts (classifier disabled if absent)
    USE_YOLO=true                 use YoloCarDetector for the presence gate
    RECOGNITION_TOKEN             if set, require `Authorization: Bearer <token>`
    MODEL_VERSION                 reported in responses (default "local")
    MOCK_RECOGNITION              ignored here — mock lives in the Edge Function
"""
from __future__ import annotations

import io
import os
import uuid
from typing import Optional

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from PIL import Image

from validation import ClaimedMeta, StubCarDetector, ValidationPipeline, Verdict
from classifier import MakeModelClassifier

app = FastAPI(title="CarDex Recognition", version="1.0")

MODEL_VERSION = os.environ.get("MODEL_VERSION", "local")
_TOKEN = os.environ.get("RECOGNITION_TOKEN")

_pipeline: ValidationPipeline
_classifier: Optional[MakeModelClassifier] = None


def _build_detector():
    if os.environ.get("USE_YOLO", "").lower() == "true":
        try:
            from validation import YoloCarDetector
            return YoloCarDetector()
        except Exception as e:  # noqa: BLE001 — fall back, never crash boot
            print(f"YOLO unavailable, using stub detector: {e}")
    return StubCarDetector()


@app.on_event("startup")
def _startup() -> None:
    global _pipeline, _classifier
    _pipeline = ValidationPipeline(detector=_build_detector())

    model_path = os.environ.get("MODEL_PATH", "model.pt")
    emb_path = os.environ.get("EMBEDDINGS_PATH", "embeddings.npz")
    if os.path.exists(model_path) and os.path.exists(emb_path):
        _classifier = MakeModelClassifier.from_files(model_path, emb_path)
        print(f"classifier loaded: {model_path} + {emb_path}")
    else:
        print("classifier NOT loaded (artifacts missing) — validation only")


def _check_auth(authorization: Optional[str]) -> None:
    if _TOKEN and authorization != f"Bearer {_TOKEN}":
        raise HTTPException(status_code=401, detail="unauthorized")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "model_loaded": _classifier is not None, "modelVersion": MODEL_VERSION}


@app.post("/v1/recognize")
async def recognize(
    image: UploadFile = File(...),
    lat: Optional[float] = Form(None),
    lng: Optional[float] = Form(None),
    ts: Optional[str] = Form(None),
    liveCapture: Optional[str] = Form(None),
    authorization: Optional[str] = Header(None),
) -> dict:
    _check_auth(authorization)
    request_id = str(uuid.uuid4())

    try:
        img = Image.open(io.BytesIO(await image.read())).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="invalid_image")

    claimed = ClaimedMeta(
        live_capture=(liveCapture == "true"),
        lat=lat, lng=lng, captured_at=ts,
    )

    # 1. Validation gate (presence / dedup / spoof, lenient).
    result = _pipeline.validate(img, claimed)
    if result.verdict is not Verdict.ACCEPT:
        return {
            "isReal": False,
            "reason": (result.reasons[0] if result.reasons else result.verdict.value),
            "verdict": result.verdict.value,
            "spoofScore": round(result.suspicion, 3),
            "requestId": request_id,
        }

    # 2. Classify.
    if _classifier is None:
        raise HTTPException(status_code=503, detail="classifier_not_loaded")
    candidates = _classifier.classify(img, k=5)

    return {
        "isReal": True,
        "spoofScore": round(result.suspicion, 3),
        "predictions": [
            {"modelClass": c.label, "confidence": round(c.score, 4)}
            for c in candidates
        ],
        "modelVersion": MODEL_VERSION,
        "requestId": request_id,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))

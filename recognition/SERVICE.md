# CarDex Recognition Service

HTTP layer (`app.py`) over the validation pipeline + make/model classifier.

## Run

```bash
pip install -r requirements.txt -r requirements-service.txt -r requirements-ml.txt
MODEL_PATH=model.pt EMBEDDINGS_PATH=embeddings.npz USE_YOLO=true \
  RECOGNITION_TOKEN=dev-token MODEL_VERSION=2026.06.1 \
  uvicorn app:app --host 0.0.0.0 --port 8000
```

`GET /health` → liveness + whether the classifier loaded.

## `POST /v1/recognize`

multipart: `image` (file), optional `lat`, `lng`, `ts`, `liveCapture`.
Header: `Authorization: Bearer <RECOGNITION_TOKEN>` (only enforced if the env is set).

Accepted:
```json
{
  "isReal": true,
  "spoofScore": 0.04,
  "predictions": [
    { "modelClass": "2015_Audi_R8", "confidence": 0.91 },
    { "modelClass": "2007_Audi_R8", "confidence": 0.05 }
  ],
  "modelVersion": "2026.06.1",
  "requestId": "..."
}
```

Rejected (validation gate):
```json
{ "isReal": false, "reason": "looks_spoofed", "verdict": "retry", "spoofScore": 0.81, "requestId": "..." }
```

## Wiring to the app (the one remaining edit)

The service is DB-agnostic — it returns `predictions` keyed by `model_class`.
The `recognize` Edge Function must resolve those to the candidate shape the app
expects, by looking up `cars` on `model_class`:

```
predictions[] --(cars.model_class)--> candidates[] { carId, label, rarityTier, confidence }
```

So after deploying this service: set the Edge Function's `RECOGNITION_URL` to it,
turn `MOCK_RECOGNITION` off, and update `recognize` to map predictions → candidates
via the `cars` table before returning to the client. (The mock returned candidates
directly because it queried `cars` itself; the real path splits that resolution
into the Edge Function.)

## Hosting

Containerize and deploy to a managed GPU endpoint (Replicate / HF Inference /
Cloud Run with GPU). Load `model.pt` + `embeddings.npz` at startup; keep a warm
instance if cold-start latency matters (the hybrid confirm step tolerates a bit).

## Status

Code is written; **not yet run** (needs torch/timm + the trained artifacts, and
the sandbox here can't run them). Smoke-test locally with `/health` and a sample
image once you have `model.pt` + `embeddings.npz`.

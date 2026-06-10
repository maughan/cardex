# Deploy the CarDex Recognition Service

Go-live point 3. Containerizes `app.py` (validation gate + make/model
classifier) and ships it to a public HTTPS endpoint, which the Supabase
`recognize` Edge Function calls.

CPU-only by design — fine for launch traffic. Move to a GPU host later if
latency/throughput demands it (only the base image + host change; code is identical).

---

## 0. Prerequisites

- Docker installed and running.
- Trained artifacts in place: `artifacts/model.pt`, `artifacts/embeddings.npz`.
  (Already there.)
- A recognition token — a long random string the Edge Function sends as a
  bearer. Generate one:
  ```bash
  openssl rand -hex 32
  ```
  Save it; you'll set it as a secret on the host AND on Supabase.

---

## 1. Build + smoke-test locally (do this first)

```bash
cd recognition
docker build -t cardex-recognition .
```

First build is slow (downloads CPU torch ~200MB + bakes YOLO weights). Then run:

```bash
docker run --rm -p 8000:8000 \
  -e RECOGNITION_TOKEN=dev-token \
  cardex-recognition
```

In another terminal:

```bash
# liveness — expect {"status":"ok","model_loaded":true,...}
curl localhost:8000/health

# real inference — point at any car photo on disk
curl -X POST localhost:8000/v1/recognize \
  -H "Authorization: Bearer dev-token" \
  -F "image=@/path/to/car.jpg" \
  -F "liveCapture=true"
```

`model_loaded:true` confirms the artifacts loaded. The recognize call should
return `isReal:true` + a `predictions[]` array keyed by `modelClass`. If you get
`model_loaded:false`, the artifacts didn't copy — check `artifacts/` exists.

Stop with Ctrl-C.

---

## 2. Deploy — Fly.io (recommended)

Simple, cheap, persistent, handles the ~2.5GB image, scales to zero.

```bash
# one-time
brew install flyctl      # or: curl -L https://fly.io/install.sh | sh
fly auth login

cd recognition
fly launch --no-deploy   # detects Dockerfile + fly.toml; pick a unique app name
                         # if it rewrites fly.toml, keep memory=2gb

# set the bearer token as a secret (NOT in fly.toml)
fly secrets set RECOGNITION_TOKEN=<the-token-from-step-0>

fly deploy
```

After deploy:

```bash
fly status                       # machine should be started/healthy
curl https://<your-app>.fly.dev/health
```

Note the URL — `https://<your-app>.fly.dev`. That's your `RECOGNITION_URL`.

**Cold start:** with `min_machines_running = 0` the box sleeps when idle and
takes ~10-20s to wake (torch load). For launch that's acceptable behind the
confirm step. To kill cold starts, edit `fly.toml` → `min_machines_running = 1`
and redeploy (costs ~a few $/mo for a warm shared-cpu-2x).

### Alt: Google Cloud Run

```bash
gcloud run deploy cardex-recognition \
  --source recognition \
  --region europe-west2 \
  --memory 2Gi --cpu 2 \
  --no-allow-unauthenticated \
  --set-env-vars USE_YOLO=true,MODEL_VERSION=2026.06.1 \
  --set-secrets RECOGNITION_TOKEN=cardex-rec-token:latest
```

(Create the secret first: `echo -n <token> | gcloud secrets create cardex-rec-token --data-file=-`.)
Cloud Run scales to zero by default; same cold-start tradeoff.

---

## 3. Wire it to Supabase (this is go-live point 4)

The Edge Function is already coded to call the service and resolve
`predictions[] → candidates[]` via the `cars` table. Flip it off mock:

```bash
supabase secrets set \
  RECOGNITION_URL=https://<your-app>.fly.dev \
  RECOGNITION_TOKEN=<the-same-token-from-step-0>
supabase secrets set MOCK_RECOGNITION=false

supabase functions deploy recognize
```

`RECOGNITION_TOKEN` must match on both sides — the Edge Function sends it as
`Authorization: Bearer`, the service checks it.

Smoke-test end to end from the app (capture a car) — you should get real
candidates resolved to catalogue cars instead of the mock set.

---

## 4. Verify

- `GET /health` → `model_loaded:true`.
- A car photo → `isReal:true` + predictions whose `modelClass` values exist in
  your `cars.model_class` (ingested in point 2). If candidates come back empty
  with `reason:"no_catalogue_match"`, the label space and the `cars` table are
  out of sync — re-run `ingest_catalogue.py` on the same `catalogue.csv` the
  model was trained from.
- A screen photo / non-car → `isReal:false` with a `reason`.

---

## Notes

- **Image size** ~2.5GB (CPU torch + ultralytics). Normal. First Fly deploy
  pushes it once; later deploys are layer-cached.
- **Token rotation:** `fly secrets set RECOGNITION_TOKEN=...` then the same on
  Supabase, then redeploy both.
- **Disable YOLO** (smaller/faster, weaker presence gate): set `USE_YOLO=false`.
  Falls back to the stub detector; the lenient pipeline still runs spoof/dedup.
- **Accuracy** is the known weak point (ship-as-is). Improvement path —
  inference-time crop (use the YOLO bbox before classify), TTA, bigger backbone,
  real-world training data — is the flywheel (point 6), not a deploy concern.

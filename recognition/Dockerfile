# CarDex recognition service — CPU container.
# EfficientNet-B0 embedding classifier + YOLO11n presence gate + validation.
# CPU is enough at launch (single-image inference, hybrid confirm step tolerates
# a few hundred ms). Swap the torch wheel + a GPU host later if throughput needs it.
FROM python:3.11-slim AS base

# libGL/glib: opencv (pulled by ultralytics) needs them at import time.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# 1. CPU torch first, pinned to the CPU wheel index (keeps image ~1GB lighter
#    than the default CUDA build). ultralytics/timm below reuse this torch.
RUN pip install --index-url https://download.pytorch.org/whl/cpu \
        torch==2.4.1 torchvision==0.19.1

# 2. Service + ML deps (no pandas/scikit-learn — those are training-only).
RUN pip install \
        "fastapi>=0.110" "uvicorn[standard]>=0.29" "python-multipart>=0.0.9" \
        "pillow>=10.0" "numpy>=1.26" \
        "timm>=1.0" "ultralytics>=8.3"

# 3. Bake the YOLO11n weights into the image so first request needs no network.
#    YOLO() resolves the bare name from the working dir (/app) at runtime.
RUN python -c "from ultralytics import YOLO; YOLO('yolo11n.pt')" && \
    ls -la /app/yolo11n.pt

# 4. App code + trained artifacts.
COPY app.py classifier.py ./
COPY validation/ ./validation/
COPY artifacts/ ./artifacts/

ENV MODEL_PATH=/app/artifacts/model.pt \
    EMBEDDINGS_PATH=/app/artifacts/embeddings.npz \
    USE_YOLO=true \
    MODEL_VERSION=2026.06.1 \
    PORT=8000

EXPOSE 8000

# Respect $PORT (Cloud Run / Fly inject it).
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}"]

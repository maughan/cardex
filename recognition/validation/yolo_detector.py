"""Real car-presence detector backed by Ultralytics YOLO.

Drop-in replacement for `StubCarDetector` that satisfies the `CarDetector`
interface. `ultralytics` (and its torch dependency) is imported lazily inside
`__init__`, so importing this module — and running the rest of the validation
package / demo — does NOT require the heavy ML deps to be installed.

Enable it:
    pip install -r requirements-ml.txt          # ultralytics + torch
    pipe = ValidationPipeline(detector=YoloCarDetector())

The default weights (`yolo11n.pt`, the nano model) are pretrained on COCO, which
includes car/truck/bus, and are downloaded on first use.
"""
from __future__ import annotations

from PIL import Image

from .detector import CarDetection

# COCO vehicle class names we count as "a car is present".
_VEHICLES = {"car", "truck", "bus", "motorcycle"}


class YoloCarDetector:
    def __init__(self, weights: str = "yolo11n.pt", min_confidence: float = 0.35) -> None:
        try:
            from ultralytics import YOLO
        except ImportError as e:
            raise ImportError(
                "YoloCarDetector needs the ultralytics package. "
                "Install it with: pip install -r requirements-ml.txt"
            ) from e
        self.model = YOLO(weights)
        self.min_confidence = min_confidence

    def detect(self, img: Image.Image) -> CarDetection:
        results = self.model.predict(img, verbose=False)
        if not results:
            return CarDetection(present=False, confidence=0.0)

        result = results[0]
        best_box = None
        best_conf = 0.0
        for box in result.boxes:
            name = result.names[int(box.cls)]
            conf = float(box.conf)
            if name in _VEHICLES and conf > best_conf:
                best_box, best_conf = box, conf

        if best_box is None or best_conf < self.min_confidence:
            # A confident "no vehicle" lets the pipeline return NO_CAR; a weak
            # score stays below the gate and the lenient pipeline proceeds.
            return CarDetection(present=False, confidence=best_conf)

        x1, y1, x2, y2 = (float(v) for v in best_box.xyxy[0].tolist())
        return CarDetection(
            present=True,
            confidence=best_conf,
            bbox=(int(x1), int(y1), int(x2 - x1), int(y2 - y1)),
        )

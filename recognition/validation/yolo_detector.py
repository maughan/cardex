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
    def __init__(
        self,
        weights: str = "yolo11n.pt",
        min_confidence: float = 0.35,
        weak_vehicle_floor: float = 0.15,
    ) -> None:
        try:
            from ultralytics import YOLO
        except ImportError as e:
            raise ImportError(
                "YoloCarDetector needs the ultralytics package. "
                "Install it with: pip install -r requirements-ml.txt"
            ) from e
        self.model = YOLO(weights)
        self.min_confidence = min_confidence
        # Below this, a vehicle box is too weak to claim "car present" but also
        # too weak to confidently say "no car" — stay undecided (lenient pass).
        self.weak_vehicle_floor = weak_vehicle_floor

    def detect(self, img: Image.Image) -> CarDetection:
        results = self.model.predict(img, verbose=False)
        if not results:
            # Model produced nothing at all — undecided, let the pipeline proceed.
            return CarDetection(present=None, confidence=0.0)

        result = results[0]
        best_vehicle = None
        best_vehicle_conf = 0.0
        best_overall_conf = 0.0       # most confident detection of ANY class
        for box in result.boxes:
            conf = float(box.conf)
            best_overall_conf = max(best_overall_conf, conf)
            name = result.names[int(box.cls)]
            if name in _VEHICLES and conf > best_vehicle_conf:
                best_vehicle, best_vehicle_conf = box, conf

        # Confident vehicle → present (+ crop for the classifier).
        if best_vehicle is not None and best_vehicle_conf >= self.min_confidence:
            x1, y1, x2, y2 = (float(v) for v in best_vehicle.xyxy[0].tolist())
            return CarDetection(
                present=True,
                confidence=best_vehicle_conf,
                bbox=(int(x1), int(y1), int(x2 - x1), int(y2 - y1)),
            )

        # Weak vehicle hint (distant / partial car) → undecided, lenient pass.
        if best_vehicle_conf >= self.weak_vehicle_floor:
            return CarDetection(present=False, confidence=0.0)

        # No vehicle at all. `confidence` here = how sure we are it's NOT a car:
        # if the model confidently saw something else (a cat, a person, a wall
        # poster), that's a confident no-car and the pipeline returns NO_CAR.
        # An empty / ambiguous frame keeps a low score and stays lenient.
        return CarDetection(present=False, confidence=best_overall_conf)

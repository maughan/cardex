"""Make/model classification via embedding nearest-neighbour.

Pairs with the outputs of training/train.py:
  - model.pt        the trained backbone (produces a query embedding)
  - embeddings.npz  per-class reference vectors + labels

Serving = encode the (cropped) car image → cosine-nearest reference vectors →
ranked candidate labels. Adding new catalogue cars later means appending
reference vectors (e.g. into the pgvector column) — no retrain.

The `ReferenceIndex` (numpy) runs anywhere. `TorchEncoder` lazily imports
torch+timm so this module is importable without the heavy ML deps.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Protocol

import numpy as np
from PIL import Image


@dataclass
class Candidate:
    label: str
    score: float  # cosine similarity, 0..1


class Encoder(Protocol):
    def encode(self, img: Image.Image) -> np.ndarray:
        """Return a 1-D embedding vector for the image."""
        ...


class ReferenceIndex:
    """Cosine-similarity nearest-neighbour over per-class reference vectors."""

    def __init__(self, vectors: np.ndarray, labels: list[str]) -> None:
        v = np.asarray(vectors, dtype=np.float32)
        self.vectors = v / (np.linalg.norm(v, axis=1, keepdims=True) + 1e-9)
        self.labels = list(labels)

    @classmethod
    def load(cls, npz_path: str) -> "ReferenceIndex":
        d = np.load(npz_path, allow_pickle=False)
        return cls(d["vectors"], [str(x) for x in d["labels"].tolist()])

    def query(self, vec: np.ndarray, k: int = 3) -> list[Candidate]:
        q = np.asarray(vec, dtype=np.float32)
        q = q / (np.linalg.norm(q) + 1e-9)
        sims = self.vectors @ q
        top = np.argsort(-sims)[:k]
        return [Candidate(self.labels[i], float(sims[i])) for i in top]


class TorchEncoder:
    """Loads model.pt and returns the L2-normalised penultimate embedding."""

    def __init__(self, model_path: str, img_size: int = 224, device: Optional[str] = None) -> None:
        try:
            import torch
            import timm
            from torchvision import transforms
        except ImportError as e:
            raise ImportError(
                "TorchEncoder needs torch + timm + torchvision "
                "(pip install -r requirements-ml.txt)"
            ) from e

        self._torch = torch
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        ckpt = torch.load(model_path, map_location="cpu")
        self.model = timm.create_model(
            ckpt["backbone"], pretrained=False, num_classes=ckpt["num_classes"]
        )
        self.model.load_state_dict(ckpt["state_dict"])
        self.model.eval().to(self.device)
        self.tf = transforms.Compose([
            transforms.Resize(int(img_size * 1.15)),
            transforms.CenterCrop(img_size),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ])

    def encode(self, img: Image.Image) -> np.ndarray:
        torch = self._torch
        x = self.tf(img.convert("RGB")).unsqueeze(0).to(self.device)
        with torch.no_grad():
            feats = self.model.forward_features(x)
            emb = self.model.forward_head(feats, pre_logits=True)
        v = emb.squeeze(0).cpu().numpy().astype(np.float32)
        return v / (np.linalg.norm(v) + 1e-9)


class MakeModelClassifier:
    """Encoder + reference index → ranked candidate labels.

    Map labels → catalogue car_ids on the app/DB side (the `cars` table); the
    model only knows label strings.
    """

    def __init__(self, encoder: Encoder, index: ReferenceIndex) -> None:
        self.encoder = encoder
        self.index = index

    @classmethod
    def from_files(cls, model_path: str, embeddings_path: str) -> "MakeModelClassifier":
        return cls(TorchEncoder(model_path), ReferenceIndex.load(embeddings_path))

    def classify(self, img: Image.Image, k: int = 3) -> list[Candidate]:
        return self.index.query(self.encoder.encode(img), k)


class SoftmaxClassifier:
    """Serves the trained softmax HEAD directly — i.e. the exact model whose
    top-1/top-3 was measured during training. This is more accurate than the
    mean-embedding nearest-neighbour path; the embedding path exists for the
    future "add classes without retraining" / pgvector route.

    `score` is the softmax probability (0..1).
    """

    def __init__(self, model_path: str, img_size: int = 224, device: Optional[str] = None) -> None:
        try:
            import torch
            import timm
            from torchvision import transforms
        except ImportError as e:
            raise ImportError(
                "SoftmaxClassifier needs torch + timm + torchvision "
                "(pip install -r requirements-ml.txt)"
            ) from e

        self._torch = torch
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        ckpt = torch.load(model_path, map_location="cpu")
        self.model = timm.create_model(
            ckpt["backbone"], pretrained=False, num_classes=ckpt["num_classes"]
        )
        self.model.load_state_dict(ckpt["state_dict"])
        self.model.eval().to(self.device)

        class_to_id = ckpt["class_to_id"]
        self._id_to_label = {v: k for k, v in class_to_id.items()}
        self.tf = transforms.Compose([
            transforms.Resize(int(img_size * 1.15)),
            transforms.CenterCrop(img_size),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ])

    @classmethod
    def from_file(cls, model_path: str) -> "SoftmaxClassifier":
        return cls(model_path)

    def classify(self, img: Image.Image, k: int = 5) -> list[Candidate]:
        torch = self._torch
        x = self.tf(img.convert("RGB")).unsqueeze(0).to(self.device)
        with torch.no_grad():
            probs = torch.softmax(self.model(x), dim=1).squeeze(0)
            k = min(k, probs.numel())
            top = torch.topk(probs, k)
        return [
            Candidate(self._id_to_label[int(i)], float(p))
            for p, i in zip(top.values.cpu(), top.indices.cpu())
        ]

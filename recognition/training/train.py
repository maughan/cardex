"""Transfer-learning trainer for CarDex make/model recognition.

Fine-tunes a timm backbone on the manifest from build_manifest.py, reports
top-1 / top-3 accuracy, and exports both the classifier weights and a
reference-embedding bank (penultimate features averaged per class) for the
nearest-neighbour / pgvector serving path.

Run on a GPU (Kaggle notebook with the dataset attached is free + fastest):
    python train.py --manifest out/manifest.csv --classes out/classes.json \
        --epochs 12 --backbone tf_efficientnet_b0

NOTE: requires the heavy ML deps (see requirements-ml.txt). Not executed in the
scaffold's CI — syntax-checked only.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from sklearn.model_selection import train_test_split
from torch.utils.data import DataLoader

import timm

from dataset import CarManifestDataset


def topk_accuracy(logits: torch.Tensor, target: torch.Tensor, ks=(1, 3)) -> dict:
    maxk = max(ks)
    _, pred = logits.topk(maxk, dim=1)
    correct = pred.eq(target.view(-1, 1))
    return {k: correct[:, :k].any(dim=1).float().mean().item() for k in ks}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--classes", required=True)
    ap.add_argument("--out-dir", default="./model")
    ap.add_argument("--backbone", default="tf_efficientnet_b0")
    ap.add_argument("--img-size", type=int, default=224)
    ap.add_argument("--epochs", type=int, default=12)
    ap.add_argument("--batch-size", type=int, default=64)
    ap.add_argument("--lr", type=float, default=3e-4)
    ap.add_argument("--val-frac", type=float, default=0.15)
    ap.add_argument("--freeze-epochs", type=int, default=1)
    args = ap.parse_args()

    device = "cuda" if torch.cuda.is_available() else "cpu"
    out = Path(args.out_dir); out.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(args.manifest)
    class_to_id = json.loads(Path(args.classes).read_text())
    num_classes = len(class_to_id)

    # Prefer the dataset's own train/test split; otherwise stratify a holdout.
    if "split" in df.columns and set(df["split"].unique()) >= {"train", "test"}:
        train_df = df[df["split"] == "train"]
        val_df = df[df["split"] == "test"]
    else:
        train_df, val_df = train_test_split(
            df, test_size=args.val_frac, stratify=df["class_id"], random_state=42
        )
    train_dl = DataLoader(
        CarManifestDataset(train_df, args.img_size, train=True),
        batch_size=args.batch_size, shuffle=True, num_workers=4, pin_memory=True,
    )
    val_dl = DataLoader(
        CarManifestDataset(val_df, args.img_size, train=False),
        batch_size=args.batch_size, shuffle=False, num_workers=4, pin_memory=True,
    )

    model = timm.create_model(args.backbone, pretrained=True, num_classes=num_classes).to(device)
    # Embedding dim = backbone feature dim (before the classifier head).
    feat_dim = model.get_classifier().in_features

    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=args.epochs)
    loss_fn = nn.CrossEntropyLoss(label_smoothing=0.1)
    scaler = torch.cuda.amp.GradScaler(enabled=device == "cuda")

    def set_backbone_frozen(frozen: bool) -> None:
        for n, p in model.named_parameters():
            if "classifier" not in n and "fc" not in n and "head" not in n:
                p.requires_grad = not frozen

    best = 0.0
    for epoch in range(args.epochs):
        set_backbone_frozen(epoch < args.freeze_epochs)  # warm up the head first
        model.train()
        for x, y in train_dl:
            x, y = x.to(device), y.to(device)
            opt.zero_grad()
            with torch.cuda.amp.autocast(enabled=device == "cuda"):
                loss = loss_fn(model(x), y)
            scaler.scale(loss).backward()
            scaler.step(opt); scaler.update()
        sched.step()

        # Validation.
        model.eval()
        agg = {1: 0.0, 3: 0.0}; n = 0
        with torch.no_grad():
            for x, y in val_dl:
                x, y = x.to(device), y.to(device)
                acc = topk_accuracy(model(x), y)
                for k in agg:
                    agg[k] += acc[k] * x.size(0)
                n += x.size(0)
        top1, top3 = agg[1] / n, agg[3] / n
        print(f"epoch {epoch+1}/{args.epochs}  top1={top1:.3f}  top3={top3:.3f}")
        if top1 > best:
            best = top1
            torch.save({"state_dict": model.state_dict(),
                        "backbone": args.backbone,
                        "num_classes": num_classes,
                        "feat_dim": feat_dim,
                        "class_to_id": class_to_id}, out / "model.pt")

    # Build per-class reference embeddings (mean penultimate feature) for the
    # nearest-neighbour / pgvector serving path.
    export_embeddings(model, val_dl, df, class_to_id, feat_dim, device, out)
    print(f"best top1={best:.3f}; wrote model.pt + embeddings.npz -> {out}")


def export_embeddings(model, loader, df, class_to_id, feat_dim, device, out: Path) -> None:
    model.eval()
    id_to_label = {v: k for k, v in class_to_id.items()}
    sums = np.zeros((len(class_to_id), feat_dim), dtype=np.float64)
    counts = np.zeros(len(class_to_id), dtype=np.int64)
    with torch.no_grad():
        for x, y in loader:
            feats = model.forward_features(x.to(device))
            feats = model.forward_head(feats, pre_logits=True).cpu().numpy()
            for f, cid in zip(feats, y.numpy()):
                sums[cid] += f; counts[cid] += 1
    refs = np.divide(sums, np.maximum(counts, 1)[:, None])
    refs = refs / (np.linalg.norm(refs, axis=1, keepdims=True) + 1e-9)  # L2 normalise
    np.savez(out / "embeddings.npz",
             vectors=refs.astype(np.float32),
             labels=np.array([id_to_label[i] for i in range(len(class_to_id))]))


if __name__ == "__main__":
    main()

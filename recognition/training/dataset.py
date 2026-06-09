"""Dataset + transforms for make/model training, built from manifest.csv.

Augmentation is deliberately aggressive: the Kaggle images come from a single
clean source, so heavy colour/geometry jitter is what fights both overfitting to
that source and the domain gap to real phone photos. Colour jitter in particular
stops the model learning "red => Ferrari".
"""
from __future__ import annotations

import pandas as pd
from PIL import Image
import torch
from torch.utils.data import Dataset
from torchvision import transforms

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


def build_transforms(img_size: int = 224, train: bool = True):
    if train:
        return transforms.Compose([
            transforms.RandomResizedCrop(img_size, scale=(0.6, 1.0)),
            transforms.RandomHorizontalFlip(),
            transforms.RandomApply([transforms.RandomPerspective(0.3, p=1.0)], p=0.3),
            transforms.ColorJitter(brightness=0.4, contrast=0.4, saturation=0.5, hue=0.1),
            transforms.RandomApply([transforms.GaussianBlur(3)], p=0.2),
            transforms.ToTensor(),
            transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
            transforms.RandomErasing(p=0.25),
        ])
    return transforms.Compose([
        transforms.Resize(int(img_size * 1.15)),
        transforms.CenterCrop(img_size),
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ])


class CarManifestDataset(Dataset):
    def __init__(self, df: pd.DataFrame, img_size: int = 224, train: bool = True):
        self.df = df.reset_index(drop=True)
        self.tf = build_transforms(img_size, train)

    def __len__(self) -> int:
        return len(self.df)

    def __getitem__(self, i: int):
        row = self.df.iloc[i]
        img = Image.open(row["image_path"]).convert("RGB")
        return self.tf(img), int(row["class_id"])

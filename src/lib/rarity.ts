import type { RarityTier } from "../types";

// Card accent / glow colour per rarity tier.
export const RARITY_COLOR: Record<RarityTier, string> = {
  common: "#9BA7B0",
  uncommon: "#36D17A",
  rare: "#3FA7F6",
  epic: "#B36BE6",
  legendary: "#FFC833",
};

export const RARITY_LABEL: Record<RarityTier, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

export function rarityColor(tier: RarityTier | null | undefined): string {
  return tier ? RARITY_COLOR[tier] : RARITY_COLOR.common;
}

// Points per tier — drives the profile "rarity score".
export const RARITY_POINTS: Record<RarityTier, number> = {
  common: 1,
  uncommon: 2,
  rare: 4,
  epic: 8,
  legendary: 16,
};

// Common → legendary, used for ordering and finding the rarest catch.
export const RARITY_ORDER: RarityTier[] = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
];

export function rarityRank(tier: RarityTier): number {
  return RARITY_ORDER.indexOf(tier);
}

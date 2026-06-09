import type { RarityTier } from "../types";

// Card accent / glow colour per rarity tier.
export const RARITY_COLOR: Record<RarityTier, string> = {
  common: "#8A8F98",
  uncommon: "#3DA35D",
  rare: "#2F80ED",
  epic: "#9B51E0",
  legendary: "#F2A900",
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

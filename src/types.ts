export type RarityTier =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary";

export interface Candidate {
  carId: number;
  label: string;
  confidence: number; // 0..1
  rarityTier: RarityTier;
}

// Response from the `recognize` Edge Function.
export interface RecognizeResult {
  isReal: boolean;
  spoofScore?: number;
  reason?: string; // present when isReal is false or no match
  candidates: Candidate[];
  modelVersion?: string;
  requestId?: string;
}

export interface CardPayload {
  carId: number;
  label: string | null;
  rarityTier: RarityTier | null;
  spriteUrl: string | null;
  spottedCount: number;
}

export interface CatchRow {
  id: number;
  car_id: number;
  spotted_count: number;
  first_caught_at: string;
  last_caught_at: string;
}

// Response from the `confirm-catch` Edge Function.
export interface ConfirmResult {
  isNew: boolean;
  catch: CatchRow;
  card: CardPayload;
}

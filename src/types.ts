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
  imagePath?: string | null; // training_images object key, if the capture was retained
  retained?: boolean; // whether the capture image was kept (consent)
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

export interface CompletedSet {
  slug: string;
  name: string;
}

// Response from the `confirm-catch` Edge Function.
export interface ConfirmResult {
  isNew: boolean;
  catch: CatchRow;
  card: CardPayload;
  // Sets that this catch just completed (only ever populated when isNew).
  // Optional so the client tolerates an older deployed function.
  completedSets?: CompletedSet[];
}

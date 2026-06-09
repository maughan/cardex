import { FUNCTIONS_URL } from "./config";
import { supabase } from "./supabase";
import type { Candidate, ConfirmResult, RecognizeResult } from "../types";

async function authHeader(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  return `Bearer ${token}`;
}

export interface CapturePayload {
  photoPath: string; // local file path from vision-camera
  lat: number | null;
  lng: number | null;
}

// POST the live frame to the `recognize` gateway. The image is uploaded as
// multipart form-data; the server streams it to the recognition service and
// never stores it.
export async function recognize(
  { photoPath, lat, lng }: CapturePayload,
): Promise<RecognizeResult> {
  const uri = photoPath.startsWith("file://") ? photoPath : `file://${photoPath}`;

  const form = new FormData();
  // RN's FormData accepts this {uri,name,type} shape for file parts.
  form.append("image", { uri, name: "capture.jpg", type: "image/jpeg" } as unknown as Blob);
  form.append("liveCapture", "true");
  form.append("ts", new Date().toISOString());
  if (lat !== null) form.append("lat", String(lat));
  if (lng !== null) form.append("lng", String(lng));

  const res = await fetch(`${FUNCTIONS_URL}/recognize`, {
    method: "POST",
    headers: { Authorization: await authHeader() }, // let fetch set the multipart boundary
    body: form,
  });
  if (!res.ok) throw new Error(`recognize failed (${res.status})`);
  return (await res.json()) as RecognizeResult;
}

export interface ConfirmInput {
  carId: number;
  topGuessCarId?: number;
  confidence?: number;
  lat?: number | null;
  lng?: number | null;
  photoRef?: string;
  guesses?: Candidate[];
  modelVersion?: string;
  spoofScore?: number;
}

// Record the confirmed catch + log the attempt for the training flywheel.
export async function confirmCatch(input: ConfirmInput): Promise<ConfirmResult> {
  const res = await fetch(`${FUNCTIONS_URL}/confirm-catch`, {
    method: "POST",
    headers: {
      Authorization: await authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`confirm-catch failed (${res.status})`);
  return (await res.json()) as ConfirmResult;
}

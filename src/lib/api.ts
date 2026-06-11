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

// DEV-only: trigger recognition without a photo. Works against the mock
// recognize branch (MOCK_RECOGNITION=true), which ignores the image. Lets the
// full loop be exercised in Expo Go before the camera dev client exists.
export async function recognizeSimulated(): Promise<RecognizeResult> {
  const form = new FormData();
  form.append("liveCapture", "true");
  const res = await fetch(`${FUNCTIONS_URL}/recognize`, {
    method: "POST",
    headers: { Authorization: await authHeader() },
    body: form,
  });
  if (!res.ok) throw new Error(`recognize (simulated) failed (${res.status})`);
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
  requestId?: string;
  imagePath?: string | null;
  retained?: boolean;
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

// --- Community car submissions ----------------------------------------------

export interface SubmitCarInput {
  make: string;
  model: string;
  generation?: string;
  yearStart?: number;
  yearEnd?: number;
  body?: string;
  imagePaths: string[];
}

export interface SubmitCarResult {
  submissionId: number;
  status: string;
  imageCount: number;
  possibleDuplicates: Array<{
    id: number;
    make: string;
    model: string;
    year_start: number | null;
    year_end: number | null;
  }>;
}

// Upload the captured photos to the private `submissions` bucket, under the
// user's own uid/ folder (the storage policy enforces this). Returns the object
// keys to pass to submitCar.
export async function uploadSubmissionImages(localUris: string[]): Promise<string[]> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Not signed in");

  const folder = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const paths: string[] = [];
  for (let i = 0; i < localUris.length; i++) {
    const raw = localUris[i];
    const uri = raw.startsWith("file://") ? raw : `file://${raw}`;
    const arrayBuffer = await (await fetch(uri)).arrayBuffer();
    const path = `${uid}/${folder}/${i}.jpg`;
    const { error } = await supabase.storage
      .from("submissions")
      .upload(path, arrayBuffer, { contentType: "image/jpeg", upsert: true });
    if (error) throw new Error(error.message || "Image upload failed");
    paths.push(path);
  }
  return paths;
}

// Record the submission (after images are uploaded). Lands as `pending`.
export async function submitCar(input: SubmitCarInput): Promise<SubmitCarResult> {
  const res = await fetch(`${FUNCTIONS_URL}/submit-car`, {
    method: "POST",
    headers: {
      Authorization: await authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`submit failed (${res.status})`);
  return (await res.json()) as SubmitCarResult;
}

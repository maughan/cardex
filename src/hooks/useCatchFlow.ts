import { useCallback, useState } from "react";
import { confirmCatch, recognize, recognizeSimulated } from "../lib/api";
import type { Candidate, ConfirmResult, RecognizeResult } from "../types";

// The capture flow as an explicit state machine:
//   idle → recognizing → confirm → recording → reveal
//   (with rejected / error exits, all of which return to idle on reset)
export type FlowState =
  | { status: "idle" }
  | { status: "recognizing" }
  | {
    status: "confirm";
    result: RecognizeResult;
    photoPath: string;
    lat: number | null;
    lng: number | null;
  }
  | { status: "recording" }
  | { status: "reveal"; result: ConfirmResult }
  | {
    status: "rejected";
    reason: string;
    // Capture context is carried through so the user can still record a catch
    // via manual catalogue search from the rejection screen.
    result: RecognizeResult;
    photoPath: string;
    lat: number | null;
    lng: number | null;
  }
  | { status: "error"; message: string };

export function useCatchFlow() {
  const [state, setState] = useState<FlowState>({ status: "idle" });

  const reset = useCallback(() => setState({ status: "idle" }), []);

  const onCapture = useCallback(
    async (photoPath: string, lat: number | null, lng: number | null) => {
      setState({ status: "recognizing" });
      try {
        const result = await recognize({ photoPath, lat, lng });
        if (!result.isReal) {
          setState({ status: "rejected", reason: result.reason ?? "not_a_real_car", result, photoPath, lat, lng });
          return;
        }
        if (!result.candidates?.length) {
          setState({ status: "rejected", reason: "no_match", result, photoPath, lat, lng });
          return;
        }
        setState({ status: "confirm", result, photoPath, lat, lng });
      } catch (e) {
        setState({ status: "error", message: errMessage(e, "Recognition failed") });
      }
    },
    [],
  );

  const onConfirm = useCallback(
    async (
      chosen: Candidate,
      ctx: {
        result?: RecognizeResult;
        lat: number | null;
        lng: number | null;
        photoRef?: string;
      },
    ) => {
      setState({ status: "recording" });
      try {
        const top = ctx.result?.candidates?.[0];
        const confirmRes = await confirmCatch({
          carId: chosen.carId,
          topGuessCarId: top?.carId,
          confidence: chosen.confidence,
          lat: ctx.lat,
          lng: ctx.lng,
          photoRef: ctx.photoRef,
          guesses: ctx.result?.candidates,
          modelVersion: ctx.result?.modelVersion,
          spoofScore: ctx.result?.spoofScore,
        });
        setState({ status: "reveal", result: confirmRes });
      } catch (e) {
        setState({ status: "error", message: errMessage(e, "Could not record catch") });
      }
    },
    [],
  );

  // DEV: run the flow without the camera (Expo Go). Uses the mock recognize
  // path; no photo, no location.
  const onSimulate = useCallback(async () => {
    setState({ status: "recognizing" });
    try {
      const result = await recognizeSimulated();
      if (!result.candidates?.length) {
        setState({ status: "rejected", reason: result.reason ?? "no_match", result, photoPath: "simulated", lat: null, lng: null });
        return;
      }
      setState({ status: "confirm", result, photoPath: "simulated", lat: null, lng: null });
    } catch (e) {
      setState({ status: "error", message: errMessage(e, "Simulation failed") });
    }
  }, []);

  return { state, onCapture, onConfirm, onSimulate, reset };
}

function errMessage(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

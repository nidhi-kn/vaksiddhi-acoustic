import axios from "axios";
import { hasPredictionContract } from "./prediction";
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
  timeout: 120000,
});
export const percent = (value) => `${(value * 100).toFixed(2)}%`;
export const date = (value) => new Date(value).toLocaleString();
export const raised = (item) => item.acoustic.prediction === "spoof";
export function loadHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem("vak-history-v1") || "[]");
    return Array.isArray(saved)
      ? saved
          .filter(
            (x) =>
              typeof x?.id === "string" &&
              typeof x.audio_file === "string" &&
              Number.isFinite(Date.parse(x.created_at)) &&
              Number.isFinite(x.duration) &&
              Number.isFinite(x.processing_ms) &&
              Number.isFinite(x.sample_rate_hz) &&
              Array.isArray(x.limitations) &&
              x.limitations.every((value) => typeof value === "string") &&
              hasPredictionContract(x),
          )
          .slice(0, 200)
      : [];
  } catch {
    return [];
  }
}

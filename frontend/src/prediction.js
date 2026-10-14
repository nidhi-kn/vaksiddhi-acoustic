export const predictionLabels = {
  spoof: "Potential Spoof Detected",
  below_threshold: "No Spoof Alert / Inconclusive",
};
export function predictionLabel(prediction) {
  return Object.hasOwn(predictionLabels, prediction)
    ? predictionLabels[prediction]
    : "Prediction unavailable";
}
export function hasPredictionContract(result) {
  const acoustic = result?.acoustic;
  return (
    !!acoustic &&
    Object.hasOwn(predictionLabels, acoustic.prediction) &&
    ["spoof_score", "bonafide_score", "threshold"].every(
      (key) =>
        Number.isFinite(acoustic[key]) &&
        acoustic[key] >= 0 &&
        acoustic[key] <= 1,
    )
  );
}
export const modelScore = (value) => value.toFixed(8);

// Validate every field consumed by Result before rendering or persisting it.
// The backend decision remains authoritative; this never reclassifies scores.
export function hasAnalysisResponse(result) {
  return (
    hasPredictionContract(result) &&
    result.acoustic.threshold === 0.05530281 &&
    typeof result.audio_file === "string" &&
    typeof result.message === "string" &&
    Number.isFinite(result.sample_rate_hz) &&
    result.sample_rate_hz > 0 &&
    Number.isFinite(result.processing_ms) &&
    result.processing_ms >= 0 &&
    Array.isArray(result.limitations) &&
    result.limitations.every((value) => typeof value === "string")
  );
}

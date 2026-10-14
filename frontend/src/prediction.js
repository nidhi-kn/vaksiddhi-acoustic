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

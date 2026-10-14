import { test } from "node:test";
import assert from "node:assert/strict";
import {
  predictionLabel,
  hasPredictionContract,
  modelScore,
} from "../src/prediction.js";

test("authoritative predictions override the larger bonafide score", () => {
  const spoof = {
    acoustic: {
      prediction: "spoof",
      threshold: 0.05530281,
      spoof_score: 0.1198771521449089,
      bonafide_score: 0.8801227807998657,
    },
  };
  const bonafide = {
    acoustic: {
      prediction: "below_threshold",
      threshold: 0.05530281,
      spoof_score: 0.0033067096956074238,
      bonafide_score: 0.9966932535171509,
    },
  };
  assert.equal(hasPredictionContract(spoof), true);
  assert.equal(hasPredictionContract(bonafide), true);
  assert.equal(
    predictionLabel(spoof.acoustic.prediction),
    "Potential Spoof Detected",
  );
  assert.equal(
    predictionLabel(bonafide.acoustic.prediction),
    "No Spoof Alert / Inconclusive",
  );
  assert.equal(modelScore(spoof.acoustic.spoof_score), "0.11987715");
  assert.equal(modelScore(bonafide.acoustic.spoof_score), "0.00330671");
});
test("missing and unknown decisions never default to a genuine or inconclusive result", () => {
  for (const prediction of [undefined, null, "bonafide", "__proto__"]) {
    assert.equal(predictionLabel(prediction), "Prediction unavailable");
    assert.equal(
      hasPredictionContract({
        acoustic: {
          prediction,
          threshold: 0.05530281,
          spoof_score: 0.1,
          bonafide_score: 0.9,
        },
      }),
      false,
    );
  }
});
test("thresholds pass through without frontend reclassification", () => {
  assert.equal(
    hasPredictionContract({
      acoustic: {
        prediction: "spoof",
        threshold: 0.2,
        spoof_score: 0.1,
        bonafide_score: 0.9,
      },
    }),
    true,
  );
});

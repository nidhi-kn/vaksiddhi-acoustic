import bonafide1 from "../../test_audio/bonafide_1.wav?url";
import bonafide2 from "../../test_audio/bonafide_2.wav?url";
import bonafide3 from "../../test_audio/bonafide_3.wav?url";
import spoof1 from "../../test_audio/spoof_1.wav?url";
import spoof2 from "../../test_audio/spoof_2.wav?url";
import spoof3 from "../../test_audio/spoof_3.wav?url";

export const demoSamples = [
  ...[bonafide1, bonafide2, bonafide3].map((url, i) => ({
    url,
    name: `bonafide_${i + 1}.wav`,
    label: "bonafide",
  })),
  ...[spoof1, spoof2, spoof3].map((url, i) => ({
    url,
    name: `spoof_${i + 1}.wav`,
    label: "spoof",
  })),
];

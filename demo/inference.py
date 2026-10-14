"""Acoustic-only prerecorded audio inference using the audited student model."""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np
import soundfile as sf
import torch

from src.models.student_mobilenetv2 import MobileNetV2Student
from src.preprocessing.audio_utils import TARGET_SAMPLE_RATE, audio_to_logmel


PROJECT_ROOT = Path(__file__).resolve().parents[1]
CHECKPOINT_PATH = PROJECT_ROOT / "checkpoints" / "student_mobilenetv2_kd_corrected_teacher.pt"
# Fixed operating point recorded in the existing test evaluation. Not tuned here.
SPOOF_THRESHOLD = 0.05530281


class AudioInputError(ValueError):
    """Raised when an input recording cannot be analyzed."""


class AcousticAnalyzer:
    def __init__(self, checkpoint_path: Path = CHECKPOINT_PATH, device: str | None = None):
        self.checkpoint_path = Path(checkpoint_path)
        if not self.checkpoint_path.is_file():
            raise FileNotFoundError(f"Student checkpoint not found: {self.checkpoint_path}")
        self.device = torch.device(device or ("cuda" if torch.cuda.is_available() else "cpu"))
        self.model = MobileNetV2Student(pretrained=False).to(self.device)
        checkpoint = torch.load(self.checkpoint_path, map_location=self.device, weights_only=False)
        state = checkpoint.get("model_state_dict") if isinstance(checkpoint, dict) else None
        if state is None:
            raise ValueError("Checkpoint does not contain model_state_dict")
        self.model.load_state_dict(state)
        self.model.eval()

    def analyze(self, audio_path: str | Path) -> dict:
        path = Path(audio_path)
        if not path.is_file():
            raise AudioInputError(f"Audio file does not exist: {path}")
        if path.stat().st_size == 0:
            raise AudioInputError("Audio file is empty")
        try:
            waveform, sample_rate = sf.read(path, dtype="float32", always_2d=True)
        except Exception as exc:
            raise AudioInputError(f"Could not decode audio: {exc}") from exc
        if waveform.size == 0 or waveform.shape[0] == 0:
            raise AudioInputError("Audio file is empty")
        if not np.isfinite(waveform).all():
            raise AudioInputError("Audio contains non-finite samples")

        # soundfile returns [samples, channels]. Fold channels to mono before
        # the established resample/crop/pad/log-Mel preprocessing.
        mono = waveform.mean(axis=1)
        try:
            features = audio_to_logmel(mono, sample_rate=int(sample_rate))
        except Exception as exc:
            raise AudioInputError(f"Could not preprocess audio: {exc}") from exc
        if tuple(features.shape) != (80, 101) or not torch.isfinite(features).all():
            raise AudioInputError(f"Unexpected or invalid feature tensor: {tuple(features.shape)}")

        batch = features.unsqueeze(0).unsqueeze(0).to(self.device)
        with torch.inference_mode():
            probabilities = torch.softmax(self.model(batch), dim=1)[0]
        bonafide_score = float(probabilities[0].item())
        spoof_score = float(probabilities[1].item())
        if not all(math.isfinite(score) for score in (bonafide_score, spoof_score)):
            raise RuntimeError("Model returned a non-finite score")

        raised = spoof_score >= SPOOF_THRESHOLD
        if raised:
            risk_level = "elevated"
            message = "Potential synthetic or spoofed audio signal detected. Verify the caller independently."
            reasons = [f"Spoof score {spoof_score:.4f} meets or exceeds the fixed threshold {SPOOF_THRESHOLD:.8f}."]
        else:
            risk_level = "inconclusive"
            message = "No acoustic spoof alert was raised. This result does not establish that the call is safe."
            reasons = [f"Spoof score {spoof_score:.4f} is below the fixed threshold {SPOOF_THRESHOLD:.8f}."]

        return {
            "audio_file": path.name,
            "sample_rate_hz": int(sample_rate),
            "preprocessed_sample_rate_hz": TARGET_SAMPLE_RATE,
            "acoustic": {
                "model": "MobileNetV2Student",
                "checkpoint": str(self.checkpoint_path),
                "spoof_score": spoof_score,
                "bonafide_score": bonafide_score,
                "prediction": "spoof" if raised else "below_threshold",
                "threshold": SPOOF_THRESHOLD,
                "threshold_source": "fixed validation-selected operating point recorded by the existing test evaluation",
                "class_mapping": {"0": "bonafide", "1": "spoof"},
            },
            "semantic": {
                "status": "outside_current_demo_scope",
                "risk_indicators": [],
                "explanation": "This presentation demo covers acoustic spoof screening only.",
            },
            "fusion": {
                "status": "outside_current_demo_scope",
                "explanation": "This presentation demo covers acoustic spoof screening only.",
            },
            "risk_level": risk_level,
            "reasons": reasons,
            "message": message,
            "limitations": [
                "One-second crop/pad inference; longer conversations are not analyzed as a sequence.",
                "A below-threshold acoustic result is not a safe-call determination.",
                "Recorded sampled test results show weak generalization to spoof systems A17-A19.",
            ],
        }

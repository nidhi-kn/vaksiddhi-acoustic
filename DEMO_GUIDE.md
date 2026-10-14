# Vak-Siddhi acoustic demo guide

## Scope

Vak-Siddhi is an acoustic voice-spoof screening prototype for prerecorded audio. This presentation demo screens audio for acoustic spoof cues; it does not transcribe speech, assess scam intent, fuse semantic evidence, or monitor live calls. A below-threshold result does not establish that a caller or recording is genuine.

## Launch on Windows PowerShell

Open PowerShell at the cloned project root. Create a Python 3.14 environment and activate it:

```powershell
py -3.14 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
```

Install one matching PyTorch build, then install the remaining pinned packages:

```powershell
# CPU-only fallback
python -m pip install torch==2.11.0 torchvision==0.26.0 torchaudio==2.11.0 --index-url https://download.pytorch.org/whl/cpu
```

```powershell
# NVIDIA GPU with CUDA 12.8
python -m pip install torch==2.11.0 torchvision==0.26.0 torchaudio==2.11.0 --index-url https://download.pytorch.org/whl/cu128
```

```powershell
python -m pip install -r requirements.txt
python -m demo.app
```

Use either the CPU or CUDA install command, not both. Versions match the recorded project environment: Python 3.14.0, PyTorch 2.11.0, TorchVision 0.26.0, TorchAudio 2.11.0, NumPy 2.5.3, and SoundFile 0.14.0.

The demo opens a window labeled **Acoustic screening prototype | prerecorded audio only**. Select **Choose WAV file**, choose a recording, then select **Analyze recording**. The first analysis loads the checkpoint; subsequent analyses reuse it. The interface displays the model scores, threshold result, explanation, and scope/limitation fields. Decode, empty-file, preprocessing, checkpoint, and inference errors appear as clear error dialogs.

For one terminal inference/smoke run on a genuine WAV file available on that computer:

```powershell
python -m demo.run_audio "C:\path\to\recording.wav"
```

The project checkpoint and code are resolved from the cloned project. The quoted path above is the user-selected audio path; it is not a project configuration value.

WAV is the recommended presentation input. SoundFile and libsndfile determine which additional formats are accepted. A genuine LibriSpeech WAV smoke inference has completed successfully in the existing environment. The local workspace also contains an unlabelled FLAC sample under `data/raw/`; this data directory is excluded from GitHub, so select an audio file on the destination computer.

## What the demo does

1. Reads the selected prerecorded file with SoundFile and folds channels to mono.
2. Resamples to 16 kHz when needed.
3. Crops or zero-pads to one second and computes an 80-bin log-Mel spectrogram. One example has shape `[1, 80, 101]`; the model batch has shape `[1, 1, 80, 101]`.
4. Loads `checkpoints/student_mobilenetv2_kd_corrected_teacher.pt` into the existing `MobileNetV2Student` architecture and runs inference.
5. Displays softmax scores with class mapping `0 = bonafide`, `1 = spoof`. The fixed spoof threshold is `0.05530281`, the validation-selected operating point used in the recorded test evaluation. A score at or above it raises a potential-spoof warning. Below it, the result is **inconclusive** and must not be presented as a safe-call result.

Semantic and fusion fields are marked `outside_current_demo_scope`; they do not indicate a failed analysis. The teacher checkpoint is not used by this demo because existing diagnostics showed unreliable output-column behavior.

## Existing evaluation results

These are saved preliminary evaluations on balanced samples, not new demo measurements or full-dataset results:

| Evaluation | Saved result | Interpretation |
|---|---|---|
| Validation, 2,000 examples | ROC-AUC 0.999758. Saved metrics show accuracy 0.5 and zero spoof recall, with all predictions bonafide. The validation metrics JSON does not record a threshold. | Ranking and saved thresholded predictions conflict: the score archive contains values above the recorded 0.05530281 threshold, yet saved predictions are all bonafide. Do not present these thresholded validation values as reliable until reconciled. |
| Test, 2,000 balanced examples | ROC-AUC 0.897165; accuracy 0.8715 at threshold 0.05530281; confusion matrix `[[990, 10], [247, 753]]` (rows true bonafide/spoof, columns predicted bonafide/spoof). | The 247 spoof false negatives show important generalization limitations. Existing diagnostics attribute most of them to spoof systems A17–A19. |

These results do not establish production readiness or full-system generalization. The test threshold was not optimized on that test sample. Portable path-normalized metric extracts are under `results/presentation/`; the original metric files are preserved locally and unchanged.

## Presentation limitations

- Prerecorded audio only; each file is reduced to one one-second model input, so long recordings are not analyzed across successive windows.
- Acoustic spoof screening only. Semantic scam/coercion analysis, fusion, and live-call detection are outside this demo's scope.
- The student has known false negatives, especially on A17–A19 in the recorded sampled test evaluation.
- The local LibriSpeech smoke sample verifies that a WAV reaches actual inference; without a verified label, it does not verify prediction correctness or accuracy.
- Scores and warnings are research-prototype outputs, not caller identity verification or a guarantee of safety.

## Troubleshooting

- If PowerShell blocks environment activation, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned` in that terminal, then activate the existing `.venv` again.
- If checkpoint loading fails, confirm the environment has compatible PyTorch and TorchVision versions and that the selected checkpoint remains at the documented path.
- If decoding fails, use a standard PCM WAV file. Empty or corrupt files produce an error instead of a prediction.
- When CUDA is unavailable, inference selects CPU automatically; CPU inference may take longer.

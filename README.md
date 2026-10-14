# Vak-Siddhi

Vak-Siddhi is an academic acoustic voice-spoof screening prototype. The current demonstration analyzes **prerecorded audio only** using the existing MobileNetV2 student model and checkpoint. Semantic analysis, acoustic-semantic fusion, and live-call detection are outside the current demo scope. It does not verify a caller's identity or prove that a recording is safe.

## Architecture and preprocessing

Audio file → SoundFile decode → mono → 16 kHz resample → crop or zero-pad to 1 second → 80-bin log-Mel spectrogram → `MobileNetV2Student` → bonafide/spoof scores and threshold result.

Each example is a float tensor shaped `[1, 80, 101]`; model input adds the batch axis: `[B, 1, 80, 101]`. The demo resolves its checkpoint relative to its own source path, so it does not depend on a specific Windows username or the process working directory after Python has imported the project package.

Selected checkpoint: `checkpoints/student_mobilenetv2_kd_corrected_teacher.pt` (27,118,897 bytes; 27.1 MB / 25.863 MiB). It is under GitHub's 100 MiB command-line per-file limit, so the portable repository can include it as a regular Git file; Git LFS is not required. [GitHub file size limits](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github).

Class mapping is `0 = bonafide`, `1 = spoof`. The fixed spoof threshold is `0.05530281`, the validation-derived operating point used by the saved test evaluation. A score at or above the threshold raises a potential-spoof warning. A lower score is **inconclusive**, not safe. The teacher checkpoint is not selected because prior score diagnostics found unreliable column behavior.

## Windows setup and launch

Install 64-bit Python 3.14.x. The existing environment was recorded with Python 3.14.0, PyTorch 2.11.0, TorchVision 0.26.0, TorchAudio 2.11.0, NumPy 2.5.3, and SoundFile 0.14.0. The PyTorch/TorchVision/TorchAudio versions below match that environment. [PyTorch's Windows install page](https://pytorch.org/get-started/locally/) currently lists Python 3.10–3.14 support.

Open a PowerShell terminal at the cloned repository root and run:

```powershell
py -3.14 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
```

Install **one** PyTorch build, depending on the other computer:

```powershell
# CPU-only fallback
python -m pip install torch==2.11.0 torchvision==0.26.0 torchaudio==2.11.0 --index-url https://download.pytorch.org/whl/cpu
```

```powershell
# NVIDIA GPU, CUDA 12.8 build
python -m pip install torch==2.11.0 torchvision==0.26.0 torchaudio==2.11.0 --index-url https://download.pytorch.org/whl/cu128
```

Then install the remaining pinned runtime requirements and launch the GUI:

```powershell
python -m pip install -r requirements.txt
python -m demo.app
```

PyTorch CPU/GPU package pairs are documented on the [official previous versions page](https://pytorch.org/get-started/previous-versions/). The inference code automatically selects CUDA when available and otherwise uses CPU.

In the GUI, choose **Choose WAV file**, select a prerecorded recording, then choose **Analyze recording**. The first analysis loads the checkpoint; later analyses reuse it. For one command-line inference with JSON output:

```powershell
python -m demo.run_audio "C:\path\to\sample.wav"
```

Use a genuine WAV recording available on the other computer. This project does not commit raw audio or dataset files. SoundFile and libsndfile support determines whether other formats such as FLAC decode on a particular system.

## Dataset attribution and evaluation

Training/evaluation scripts identify the dataset as [Bisher/ASVspoof_2019_LA on Hugging Face](https://huggingface.co/datasets/Bisher/ASVspoof_2019_LA), an ASVspoof 2019 LA hosted copy. Its `key` label mapping is 0 bonafide and 1 spoof. Dataset files are not included or needed to run inference.

Saved evaluations are preliminary balanced 2,000-example samples, not full-split results:

| Split | Recorded result | Interpretation |
|---|---|---|
| Validation, 2,000 | ROC-AUC 0.999758; recorded accuracy 0.5 and spoof recall 0 because saved predictions are all bonafide. | The metrics JSON has no threshold, and its score archive includes values above the recorded test threshold despite all-zero predictions. Thresholded validation behavior is inconsistent; do not claim validated operating performance from this file. |
| Test, 2,000 | ROC-AUC 0.897165; accuracy 0.8715 at threshold 0.05530281; confusion matrix `[[990, 10], [247, 753]]` (true rows and predicted columns in bonafide/spoof order). | Existing diagnostics attribute most false negatives to spoof systems A17–A19. This is limited sampled generalization evidence. |

Portable metric summaries (path-normalized copies; original local results are unchanged): [validation JSON](results/presentation/student_mobilenetv2_validation_metrics.json) and [test JSON](results/presentation/student_mobilenetv2_test_metrics.json). The repository manifest identifies the corresponding existing ROC and confusion-matrix plots.

## Limitations and interpretation

- The demo handles one one-second crop/pad per selected recording; it is not a long-recording or live-call monitor.
- Semantic scam/coercion analysis, fusion, and live-call integration are outside scope.
- The student missed 247 of 1,000 spoof examples in the saved test sample; A17–A19 were especially difficult in existing diagnostics.
- The LibriSpeech WAV smoke run verifies the end-to-end inference path only. Without a verified label, it does not verify the sample's prediction correctness.
- This research prototype is not production-ready. A below-threshold result does not establish that a call is genuine or safe.

For step-by-step presentation instructions, see [DEMO_GUIDE.md](DEMO_GUIDE.md). The included checkpoint and inference source are sufficient for the prerecorded demo; datasets, backups, alternate checkpoints, training/evaluation scripts, caches, and the local virtual environment are intentionally excluded from the proposed GitHub repository.

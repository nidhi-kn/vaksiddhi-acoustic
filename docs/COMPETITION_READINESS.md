# Vak-Siddhi Competition Readiness

Preparation date: 2026-10-14. Presentation target: 2026-10-15.

## Decision

**PASS for a local acoustic screening demonstration with disclosed limitations.** This is not a production safety system or a claim of broadly validated spoof detection.

**NOT VALIDATED: expanded model reliability and multi-segment aggregation.** Only six local recordings are available. No independent development set, 100-per-class local evaluation set, original evaluation scripts or original training scripts are present. Those conditions prevent responsible threshold/aggregation selection. Multi-segment inference is not added to the API, CLI, GUI or demo.

## Preserved Baseline and Reversibility

- Work is on `competition-readiness`. Baseline snapshot commit: `1f63e57` (`Preserve working web and inference parity baseline`). The initial working tree included the frontend, backend, fixtures and downloader as uncommitted work; all were preserved in that snapshot. `main` is unchanged. Nothing was deployed or merged.
- Checkpoint SHA-256: `4b8e30cf4f977571228688528de1e053dfe3a2e01b05b25a033432bdae91d980`.
- `demo/inference.py`, `demo/run_audio.py`, `demo/app.py`, `src/` and checkpoint weights are unchanged from baseline.
- API behavior remains single-second inference through the original `AcousticAnalyzer`; threshold remains `0.05530281`. No retraining, replacement weights or 0.5 decision threshold.
- To open the preserved baseline without reverting current work, create a separate checkout from the repository root: `git worktree add ..\vaksiddhi-baseline 1f63e57`. Its Python/Node dependencies need setup separately. Prefer this to destructive reset commands.

## Implemented Changes

- Added `/demo`: side-by-side genuine/spoof sample selection, real waveforms, native playback, sequential real API inference, decimal scores, threshold and explicit alert/inconclusive labels. Six WAV assets are bundled in the production build; no remote audio or inference service.
- Dataset-declared labels are visibly separate from model predictions. Before analysis or after refresh there are no computed demo predictions. Changing a sample clears previous comparison results. Failed requests display errors and do not substitute mock predictions.
- Both completed comparisons are stored as metadata in existing history. Audio remains outside localStorage. Existing uploads, recording, dashboard, search, filtering and details remain available.
- Added a three-stage flow and a visual architecture/preprocessing diagram, plus bonafide false-alert rates calculated from the recorded confusion matrices on the model page.
- Refined light surfaces, violet and mint comparison accents, responsive score layouts, chart containment, compact-height navigation, contrast and reduced-motion behavior.
- Added `tools/evaluate_competition.py` and saved `docs/competition_baseline.json`: fixture/checkpoint hashes, environment, actual per-file scores, latency, class score distributions and offline sliding-window diagnostics.
- Added production-browser tests for local-only requests, live sample inference, playback progression, refresh/history, projector/mobile viewports, network failure, actual browser permission denial and reduced motion.
- Added [COMPETITION_DEMO.md](COMPETITION_DEMO.md) with a 90-second walkthrough, architecture diagram, Q&A and CLI/GUI fallback.

## Model and Data Audit

Canonical preprocessing: SoundFile decode; average channels to mono; resample to 16 kHz; crop to first 16,000 samples or zero-pad; 80-bin log-Mel spectrogram with FFT 400, hop 160 and log epsilon `1e-6`; input `[B,1,80,101]`. The student has a one-channel MobileNetV2 input and a two-class head (`0=bonafide`, `1=spoof`). `softmax` outputs are model scores, not calibrated authenticity probabilities. We reuse the repository's established preprocessing; the original training scripts are not available for a separate recipe audit.

The six local files were downloaded by `download_samples.py` from `SpeechAntiSpoofingBenchmarks/ASVspoof2019_LA`, test/evaluation partition. The selection is the first three encountered files per class, not randomized. Dataset labels are inherited through the downloader's mapping (`0=bonafide`, `1=spoof`); the locally cached dataset card agrees. The downloader did not retain source utterance IDs, speaker IDs or attack-system metadata, so independent per-file protocol verification is unavailable. Filename-derived labels are declared dataset ground truth, not labels inferred from model output. This is a demonstration sample, not held-out evidence supporting model selection.

The repository/cache audit found those six WAV files and only cached dataset metadata, not additional local audio shards. No network download was required or attempted for this work. The 100 genuine + 100 spoof target cannot be met from the inspected local data.

## Newly Measured Local Results

Command: `.\.venv\Scripts\python.exe -m tools.evaluate_competition` from the repository root. The command writes a structured generated report and does not alter inference or weights.

Environment: Windows 11; Python 3.14.3; PyTorch 2.11.0+cpu; CPU inference; 12 Torch threads. One analyzer loads the checkpoint once, followed by a warm-up, then three timed canonical `analyze()` calls per fixture. Latency includes decode, preprocessing and inference, but excludes HTTP/browser time. Values vary with host load; these are one measured local run, not performance guarantees.

| File | Declared Dataset Label | Actual Spoof Score | Actual Decision |
|---|---|---:|---|
| bonafide_1.wav | bonafide | 0.0033067096956074238 | below_threshold |
| bonafide_2.wav | bonafide | 0.0008955063531175256 | below_threshold |
| bonafide_3.wav | bonafide | 0.006532737985253334 | below_threshold |
| spoof_1.wav | spoof | 0.1198771521449089 | spoof |
| spoof_2.wav | spoof | 0.1127827912569046 | spoof |
| spoof_3.wav | spoof | 0.1485045701265335 | spoof |

- Confusion matrix, true rows / predicted columns in bonafide, spoof order: `[[3,0],[0,3]]`.
- Spoof recall: 3/3 (100% in these three examples only).
- Bonafide false-alert rate: 0/3 (0% in these three examples only).
- Warm latency: median 33.28 ms; p95 35.00 ms; observed range 31.25-35.37 ms over 18 calls.
- Checkpoint construction/load: 348.95 ms, excluding Python process/import startup.
- Bonafide spoof-score distribution: min 0.00089551; median 0.00330671; max 0.00653274.
- Spoof spoof-score distribution: min 0.11278279; median 0.11987715; max 0.14850457.

Full precision, p05/p95, per-file timings, hashes and actually computed window scores are in `competition_baseline.json`. A perfect six-example result must never be presented as benchmark accuracy or generalization evidence.

## Sliding-Window Investigation

Offline diagnostics use one-second windows at a half-second stride, adding a final full window ending at the recording boundary. Short files retain canonical zero-padding. Each window goes through the existing `audio_to_logmel` and existing loaded model; every first-window score was checked against the canonical analyzer within `1e-6`. The six recordings produced 28 actual segment scores. Max, mean and top-3 mean are recorded only as exploratory arithmetic summaries; top-3 uses all windows when fewer than three exist.

Important observed risk: all three bonafide recordings have diagnostic max, mean and top-3 mean scores above the existing `0.05530281` threshold. Naively reusing that threshold for these recording-level aggregates would alert on all three local genuine clips, whereas single-second inference alerts on none. This is not an independent development benchmark, and it is not used to tune a new threshold. No aggregation strategy is selected. The stable single-second pipeline remains the only application inference mode. Segment scores are not shown as application results because that endpoint did not compute them.

Future gate: obtain independently labeled development and untouched final-test manifests with immutable source IDs and disjoint speakers/utterances; benchmark max/mean/top-k recall, false alerts and latency on development only; select an operating point on development; evaluate once on final test; enable only on validated improvement with an explicit fallback. Do not tune against these competition samples.

## Historical Evaluation, Kept Separate

The saved `results/presentation/student_mobilenetv2_test_metrics.json` reports 2,000 balanced examples selected by seeded stream sampling: confusion matrix `[[990,10],[247,753]]`, accuracy 87.15%, spoof recall 75.3%, bonafide false-alert rate 1.0%, ROC-AUC 0.897165. These calculations were checked against the saved JSON. The original 2,000 recordings/evaluation scripts are unavailable locally, so these are historical recorded results, not newly reproduced metrics.

Saved validation predictions are all bonafide despite inconsistent score/threshold behavior. Do not cite the validation AUC as validated operating performance. Existing diagnostics attribute many missed spoofs to A17-A19; source attack IDs are not available for the six current clips. No claims of state-of-the-art, unseen-system robustness, calibrated confidence, scam detection or caller safety are supported.

## Startup: Windows PowerShell

One-time setup while internet is available (reuse the existing `.venv`; see root README for creating it):

```powershell
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
cd frontend
npm.cmd ci
npm.cmd run build
```

Competition terminal 1, from repository root:

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

Competition terminal 2, from repository root:

```powershell
cd frontend
npm.cmd run preview -- --host 127.0.0.1 --port 5174 --strictPort
```

Open **http://127.0.0.1:5174/demo**. This serves the production bundle locally; `/api` is proxied to port 8000 by the existing Vite proxy configuration. Both processes must remain running. Dependencies and WAV assets must already be installed/built for offline use. `--strictPort` avoids silently selecting the wrong presentation URL. If a port is already serving this project, reuse that server; otherwise stop the known server in its own terminal before restarting. Do not terminate unrelated processes.

Health: `Invoke-RestMethod http://127.0.0.1:8000/api/health` must show `ready` and `model_loaded=True`. The API is bound to loopback with no public authentication; this is a local demo, not an internet deployment. Upload limits remain WAV, 20 MiB, 120 seconds and at most 8 channels.

## Verification and Freeze

From repository root:

```powershell
.\.venv\Scripts\python.exe -m unittest backend.test_api backend.test_prediction_parity -v
cd frontend
npm.cmd run test:unit
npm.cmd run lint
npm.cmd run build
```

Browser suite with the backend and production preview running:

```powershell
cd frontend
$env:PLAYWRIGHT_BASE_URL = 'http://127.0.0.1:5174'
# If Chromium was installed by Playwright, no executable override is needed.
# Otherwise set PLAYWRIGHT_CHROMIUM_EXECUTABLE to a local Chromium chrome.exe.
npm.cmd run test:e2e -- --workers=1
```

Install browser tooling before going offline if necessary: `npx.cmd playwright install chromium`. Automated permission-success tests use a browser test microphone; denial is tested in a separate browser without auto-grant. Browser playback time progression is verified with muted audio; physical speaker output and microphone hardware need an in-person check.

Freeze acceptance covers: 7 backend tests; 3 frontend decision-contract unit tests; 8 browser workflows; ESLint and production build; exact `spoof_1.wav` / `bonafide_1.wav` CLI/API parity; local-only demo requests; actual score rendering and history refresh; upload/drag-drop validation and network errors; microphone conversion and permission rejection; reduced motion; 1440x900, 1366x768, 1024x768, 390px and 320px layouts. Screenshots are in ignored `frontend/test-results/`.

Remaining manual checks: laptop projector scaling and physical audio output, physical microphone quality, original GUI interactive controls, cross-browser behavior. Original GUI import and the original CLI are automated; no GUI behavior was modified. Keep the six-file provenance caveat and historical validation inconsistency visible in the presentation. Do not add model changes after the freeze.

## Final Pass/Fail Report

| Area | Result | Evidence / Limit |
|---|---|---|
| Baseline preservation | PASS | Branch created; working baseline saved as `1f63e57`; checkpoint hash unchanged; no inference/API/CLI/GUI source diff. |
| Backend regression and parity | PASS | 7 tests, including actual original CLI subprocesses and API scores for both exact labeled fixtures. |
| Frontend contract unit tests | PASS | 3 tests: authoritative labels, decimal scores, invalid contract rejection and no frontend threshold selection. |
| Browser workflows | PASS | 8 tests passed against the production bundle on port 5174; external requests blocked in the demo test. |
| Build and lint | PASS | `npm.cmd run build`, `npm.cmd run lint`; six WAV assets included in build output; no build size warnings. |
| Demonstration metrics | PASS, limited sample | Six actual local files, 3/3 spoof alerts and 0/3 bonafide alerts; recorded report includes latency, distribution and hashes. |
| Independent 100-per-class validation | NOT AVAILABLE | Inspected local data contains only six files; no claim of completing a larger evaluation. |
| New multi-segment strategy | NOT ENABLED | No independent development data; naive threshold reuse shows false-alert risk in diagnostics. |
| Offline preparation and docs | PASS | Local assets/inference, architecture, provenance caveats, 90-second script, Q&A and fallback commands included. |
| Physical equipment / other browsers | MANUAL CHECK REQUIRED | Automated Chromium checks do not establish microphone quality, audible projector output or cross-browser behavior. |

Freeze policy: retain the built bundle, installed dependencies, checkpoint and six local samples; rehearse with real equipment; do not retrain, retune, deploy or merge before the demonstration.

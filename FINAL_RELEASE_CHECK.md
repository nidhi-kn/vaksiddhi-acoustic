# Final local exhibition release check

**READY FOR LOCAL EXHIBITION DEMO** — checked 2026-10-14 for the 2026-10-15 exhibition.

Branch: `stabilization-exhibition-20261014`, based on `d5f97ca74e8fd2ecabf108e706ad3ba98a0fd8b5`. Release checkout: `.release-stabilization` inside the original repository. Obtain the exact release commit with `git rev-parse HEAD` in this checkout. Original `competition-readiness`, `main`, and all uncommitted experimental files are preserved. Nothing deployed or merged.

## Verification

| Check | Result / evidence |
|---|---|
| CPU checkpoint identity | PASS: SHA-256 `4b8e30cf4f977571228688528de1e053dfe3a2e01b05b25a033432bdae91d980` before/after regression |
| Immutable inference | PASS: checkpoint, `src/`, `demo/`, backend inference identical to competition commit; threshold `0.05530281`; first-second crop/pad only |
| Backend suite | PASS: 9 unittest cases; real checkpoint; constructor called once per worker lifespan, same instance across requests; CPU confirmed |
| Input boundaries | PASS: mono 16 kHz, 8/22.05/44.1/48 kHz, stereo, 50 ms short clips, 10 s and 120 s clips, silence accepted through real inference |
| Invalid input | PASS: empty/corrupt/nonfinite WAV, FLAC disguised as WAV, MP3, >120 s, >8 channels, upload limit; clear 4xx errors and no predictions |
| Backend unavailable/inference failure | PASS: 503/500 with error detail; no default score or bonafide fallback; upload cleanup checked |
| CLI/live API six-file regression | PASS: maximum absolute score difference 0, tolerance 1e-7; all six match baseline hashes, scores and declared labels |
| Frontend unit tests | PASS: 4 tests, including incomplete/incompatible contract rejection and authoritative decision mapping |
| Production browser tests | PASS: 9/9 against built `dist`, live isolated backend; upload, drag/drop, waveform, playback, microphone conversion, loading, errors/retry, history and new analysis |
| White-theme layouts | PASS: desktop 1440×900; projector 1366×768 and 1024×768; mobile 390/320; no horizontal overflow; screenshots under `frontend/test-results/` |
| Offline operation | PASS: local demo browser requests blocked for every non-local host; real scoring/playback/history still pass; six CLI/live API regressions use local files only |
| Lint / production build | PASS: `npm.cmd run lint`, `npm.cmd run build`; no dependency or model download required for runtime |
| CLI / existing Python GUI | PASS CLI regression; GUI import checked. Physical GUI interaction and laptop microphone/projector hardware were not manually exercised |

Microphone automation uses Chromium's synthetic media device and also tests actual browser permission rejection. This verifies the browser recording path, not the exhibition room's hardware. Rehearse physical sound and projector connections before presenting.

## Exact local scores

CLI and live FastAPI spoof scores are identical in every row. Full hashes/results: [docs/final_release_regression.json](docs/final_release_regression.json).

| Recording | Declared dataset label | CLI score = API score | Prediction |
|---|---|---:|---|
| bonafide_1.wav | bonafide | 0.0033067096956074238 | below_threshold |
| bonafide_2.wav | bonafide | 0.0008955063531175256 | below_threshold |
| bonafide_3.wav | bonafide | 0.006532737985253334 | below_threshold |
| spoof_1.wav | spoof | 0.1198771521449089 | spoof |
| spoof_2.wav | spoof | 0.1127827912569046 | spoof |
| spoof_3.wav | spoof | 0.1485045701265335 | spoof |

Labels are inherited from the original downloader and preserved baseline fixture metadata, with file hashes checked. Original source utterance IDs were not retained, so independent per-file protocol verification remains unavailable. These six demonstration files do not establish generalization. No filename-based prediction code was introduced.

## Confirmed fixes and test setup

- Reproduced and fixed incomplete API responses crashing the result view. Upload and comparison paths now validate all displayed fields and the fixed threshold before rendering/saving. Unsupported responses show an error; the backend prediction remains authoritative. UI design is unchanged.
- Added optional `VAK_API_TARGET` for Vite's local proxy. Default remains `http://127.0.0.1:8000`. Existing services occupy the usual ports, so this release was tested on backend 8010/frontend 5180 without stopping them.
- The first browser attempt could not find Playwright's expected browser revision; tests then passed using existing local Chromium 1243 via `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. No new browser is required for the demo. PowerShell blocks `npm.ps1`; `npm.cmd` works without execution-policy changes.
- This worktree reuses the original `.venv` and `frontend/node_modules` through local directory junctions. Keep the original workspace in place. Builds are in this worktree's `frontend/dist`; experimental data stays in the original workspace and is not bundled. Checkpoint contains CPU-compatible existing weights.

## Tested startup commands (no install step)

Terminal 1, from the original repository root:

```powershell
cd .release-stabilization
.\.venv\Scripts\python.exe -m uvicorn backend.app:app --host 127.0.0.1 --port 8010 --workers 1
```

Terminal 2, from the original repository root:

```powershell
cd .release-stabilization\frontend
$env:VAK_API_TARGET = 'http://127.0.0.1:8010'
npm.cmd run preview -- --host 127.0.0.1 --port 5180 --strictPort
```

Open **http://127.0.0.1:5180/demo**. Health through the frontend proxy: `Invoke-RestMethod http://127.0.0.1:5180/api/health` must return `ready`, `model_loaded=True`. The built bundle is already present. If rebuilding locally, use `npm.cmd run build` before preview. Keep both terminals running; stop only these servers with Ctrl+C.

CLI fallback, from the release checkout: `.\.venv\Scripts\python.exe -m demo.run_audio test_audio\spoof_1.wav`. Existing GUI fallback: `.\.venv\Scripts\python.exe -m demo.app`.

## Reproduce checks

From release checkout:

```powershell
.\.venv\Scripts\python.exe -m unittest backend.test_api backend.test_release backend.test_prediction_parity -v
.\.venv\Scripts\python.exe -m tools.verify_local_release --api http://127.0.0.1:8010
cd frontend
npm.cmd run test:unit
npm.cmd run lint
npm.cmd run build
$env:PLAYWRIGHT_BASE_URL = 'http://127.0.0.1:5180'
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE = "$env:LOCALAPPDATA\ms-playwright\chromium-1243\chrome-win64\chrome.exe"
npm.cmd run test:e2e -- --workers=1 --reporter=line
```

Backend and preview must be running for live/browser tests. Regenerating the regression JSON records the checkout HEAD at test time; the initial saved run was performed before the stabilization commit and records the baseline HEAD.

## Known model limitations and rollback

The existing 200-recording evaluation reports 86.5% balanced accuracy, 74% spoof recall, 1% bonafide false alerts and 26 ms median analyzer CPU latency. A17–A19 pooled AUC is 0.5084, compared with 0.9988 for A07–A16. Those are previously measured sample results, not this sprint's performance benchmark or a guarantee. Training overlap is unverified. Middle crops produced unacceptable false alerts and remain excluded. Only the first second is analyzed; shorter clips are padded. Scores are uncalibrated; **No Spoof Alert / Inconclusive never means verified genuine or safe**. No retraining, score aggregation, threshold tuning or model modification occurred.

Rollback is nondestructive: stop the two stabilization servers, retain this checkout, and use the original preserved competition code. To get a separate clean baseline checkout from the original repository root: `git worktree add --detach .rollback-exhibition d5f97ca`. Reuse the existing environment explicitly or set up its dependencies before launching. Do not use `reset --hard`, delete experimental files, or merge stabilization/experimental work into `competition-readiness`. The competition branch still points to `d5f97ca`; a rollback checkout is not needed for normal demo startup.

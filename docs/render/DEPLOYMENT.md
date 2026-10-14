# Render backend deployment preparation

Prepared 2026-10-14. Branch `render-deployment`, isolated checkout `.render-deployment`, based on `ui-exhibition-polish` commit `0b21559954e7db41f86ecb78d626ccb68d5d3674`. No push, merge, remote service creation or deployment performed. UI/stabilization/competition branches remain unchanged.

## Decision and measured RAM

Recommend **1c-2g (legacy Standard): 1 CPU, 2 GB RAM**, currently listed at about $25/month; selecting it incurs charges only when the user creates a service. Free is **0.1 CPU / 512 MB**, while Starter also has only 512 MB. [Render compute plans](https://render.com/docs/compute-plans), [Render pricing](https://render.com/pricing).

Fresh actual Uvicorn server, one worker, OMP/MKL/OpenBLAS threads=1, CPU-only installed Torch; process tree sampled every 20 ms:

| Phase | Peak sampled RSS (decimal MB) |
|---|---:|
| Import and checkpoint startup | 378.913 |
| All six real fixture uploads | 386.945 |
| Accepted 120-second, 8-channel, 8 kHz PCM16 WAV upload (15,360,044 bytes) | 453.890 |

**Windows OS-reported process-tree peak working set: 457.925 MB (436.71 MiB).** Sampled overall peak: 453.890 MB (432.86 MiB). Windows launcher child is included. Native per-process peak counters are summed conservatively and need not peak simultaneously. Startup to readiness: 4.53 s on this laptop, not a cloud latency prediction. [memory.json](memory.json) records exact measurements, six scores, hash and CORS smoke result. The synthetic long silence upload is a resource probe only; its `spoof` result is not accuracy evidence.

**Free feasibility: not validated and not recommended for this exhibition.** Local memory is already near the budget, leaving limited margin for Linux/native allocator differences, file cache/container accounting and concurrent uploads. One worker serializes model analysis but does not eliminate all request overhead. A 0.1-CPU service will not reproduce laptop latency. Free also spins down after 15 idle minutes and may take roughly a minute to wake. [Render Free](https://render.com/docs/free).

These are Windows measurements, not Linux RSS or Render cgroup memory. WSL is not installed, so a Linux installation/load test and actual Render load/memory validation remain outstanding. A paid plan provides headroom; it is not a measured capacity guarantee. Do not advertise Free compatibility or production scalability from this test.

## Runtime and dependencies

Python is pinned to **3.14.3** in `.python-version` and Blueprint `PYTHON_VERSION`; matches the locally tested Python and is supported by Render. Environment setting takes precedence over the file. [Render Python versions](https://render.com/docs/python-version).

`requirements-render.txt` contains only backend runtime direct dependencies: CPU Torch 2.11.0, TorchVision 0.26.0, TorchAudio 2.11.0, NumPy 2.5.3, SoundFile 0.14.0, FastAPI 0.143.0, Uvicorn 0.54.0, python-multipart 0.0.32. Torch packages explicitly require `+cpu` builds from the official CPU index; no CUDA/NVIDIA runtime or model download. Transitive dependencies are installed by pip. [PyTorch installation](https://pytorch.org/get-started/locally/).

Import audit: backend uses FastAPI/Starlette multipart upload and threadpool support, SoundFile, and standard library; analyzer imports NumPy/Torch/SoundFile; model imports TorchVision; preprocessing imports TorchAudio. `tkinter` is only used by the local GUI and is not imported by the deployment app. No datasets, PyArrow, matplotlib, evaluation utilities, frontend Node packages or psutil are runtime requirements. Memory tooling uses the already installed local psutil; tests use local httpx/TestClient. No dependencies were installed or changed in the shared local environment.

Published direct dependency wheels for CPython 3.14 / Linux x86-64 were checked against official PyTorch and PyPI indexes: [linux-wheel-check.json](linux-wheel-check.json). SoundFile has a manylinux wheel. **This is not a full Linux dependency-resolution/install/import test**; Linux execution remains a pre-live gate. Do not change library/model versions speculatively if installation fails; inspect the exact build log first.

## Exact Render settings

| Setting | Value |
|---|---|
| Service | Web Service, native Python runtime |
| Repository | `https://github.com/nidhi-kn/vaksiddhi-acoustic` |
| Branch | `render-deployment` (must be pushed manually after review) |
| Root Directory | Leave empty: repository root |
| Compute | `1c-2g`, 1 CPU / 2 GB, one instance initially |
| Build Command | `python -m pip install --no-cache-dir -r requirements-render.txt` |
| Start Command | `python -m uvicorn backend.app:app --host 0.0.0.0 --port $PORT --workers 1` |
| Health Check Path | `/api/ready` |
| Auto Deploy | Off |
| Persistent Disk | None required; temporary uploads deleted |

Render supplies `PORT`; bind `0.0.0.0` and expand `$PORT` in its Linux shell. Do not hardcode localhost or a Windows Python executable. [Render port requirements](https://render.com/docs/troubleshooting-deploys).

Required/configured environment:

```text
PYTHON_VERSION=3.14.3
CORS_ORIGINS=https://YOUR-VERCEL-PROJECT.vercel.app
OMP_NUM_THREADS=1
MKL_NUM_THREADS=1
OPENBLAS_NUM_THREADS=1
PYTHONUNBUFFERED=1
PORT=<provided automatically by Render>
```

Replace the CORS example with the actual frontend origin, without trailing slash or path. Multiple exact origins are comma-separated; add a custom domain or specific preview URL explicitly if needed. Never use `*` or `https://*.vercel.app`. The Blueprint requests `CORS_ORIGINS` during setup rather than inventing a future hostname. Existing localhost origins remain for local testing. Methods stay GET/POST and Content-Type is allowed; credentials remain disabled. CORS is browser access policy, not authentication.

For the separate Vercel frontend, set **`VITE_API_URL=https://YOUR-RENDER-SERVICE.onrender.com`** before its build/rebuild. Existing Axios baseURL support already consumes this variable; no UI changes were made. Use HTTPS at both ends. An unset frontend variable sends `/api` to Vercel instead of Render.

## Health, model identity and preserved behavior

`GET /api/health` is unchanged, including its existing unavailable response semantics. New `GET /api/ready` returns the same small status fields with **200 if the analyzer loaded, 503 otherwise**. It performs no inference; Render checks this endpoint because a 200 unavailable response would falsely pass its health gate. [Render health checks](https://render.com/docs/health-checks).

`AcousticAnalyzer` is still constructed once in worker lifespan, with one worker explicitly configured. The tracked checkpoint resolves from repository-relative `PROJECT_ROOT`, regardless of shell directory. Git contains the actual binary, not an LFS pointer: **27,118,897 bytes = 27.12 MB = 25.86 MiB**. SHA-256: `4b8e30cf4f977571228688528de1e053dfe3a2e01b05b25a033432bdae91d980`. TorchVision constructor remains `pretrained=False` for inference; no ImageNet/model downloads occur.

No changes to checkpoint, model architecture, preprocessing, thresholds, `/api/analyze`, upload limits, prediction mapping or score formatting. Fixed threshold stays **0.05530281**, class 1 is spoof, below-threshold remains inconclusive. Native CPU/thread/library/platform variation can slightly change floating-point outputs: under deployment thread settings, maximum observed fixture score difference from recorded baseline was **1.862645149e-7**, within the 1e-6 parity tolerance; all decisions matched. Bitwise score identity across Windows/Linux is not claimed.

## Validation

- **11/11 backend tests PASS:** existing API/input/failure checks, constructor-once test, original CLI/API parity on all six fixtures, exact configured CORS origin parsing and ready/unavailable status.
- Fresh HTTP Uvicorn startup, six real `/api/analyze` requests, large valid upload and configured Vercel preflight: **PASS**. Scores/threshold/decisions checked against fixture baseline within 1e-6.
- Checkpoint hash and tracked binary confirmed; `demo/`, `src/`, checkpoint and frontend compare unchanged against source commit.
- Blueprint YAML parsed locally and key fields checked. Quoted `"off"` avoids YAML 1.1 interpreting off as a boolean. Remote Render Blueprint validation has not been invoked. [Blueprint reference](https://render.com/docs/blueprint-spec).
- No Linux installation, 512 MB cgroup test, cloud deployment, remote Git availability or real Vercel integration verified.

Reproduce locally from this checkout using the existing environment:

```powershell
..\.venv\Scripts\python.exe -m unittest backend.test_api backend.test_release backend.test_prediction_parity backend.test_render -v
..\.venv\Scripts\python.exe -m tools.measure_render_memory
..\.venv\Scripts\python.exe -m tools.check_linux_wheels
```

## Manual deployment steps — not executed

1. Review this branch and its changed files. Commit/push `render-deployment` only when authorized. The local deployment branch/configuration is not available to Render until pushed; do not select the unchanged UI branch expecting it to contain these files.
2. In Render, connect the GitHub repository and create a Python Web Service on `render-deployment`, or review/import `render.yaml`. Blueprint creation itself creates/bills/deploys a service; auto-deploy off prevents subsequent automatic commit-triggered deployments, not the initial creation.
3. Enter the exact Vercel origin, choose the recommended compute, and confirm settings above. Check build logs show CPU wheels and Python 3.14.3. After the user triggers deployment, require model startup and `/api/ready` 200 before using it.
4. Set `VITE_API_URL` in Vercel and rebuild that frontend. Confirm production-origin preflight is allowed, an unrelated origin is not allowed, and health requests reach Render.
5. Upload the six known WAVs to the new endpoint; compare both raw scores and predictions against the CLI with 1e-6 tolerance. Verify invalid WAV errors, temporary cleanup, and unavailable health. Check actual Linux/Render peak memory under representative uploads before any Free-plan experiment or wider use.
6. Keep the local exhibition version available. If cloud startup/inference fails, use the preserved local release; no model/threshold changes or branch merges are needed to roll back.

## Remaining blockers and changed files

The actual Vercel production origin is not yet known. The branch is not pushed, so Render cannot build it yet. Linux dependency resolution/runtime/memory and deployed CORS integration require a user-triggered remote validation. Free suitability is not established. Existing model weaknesses (including A17–A19 and genuine microphone false positives) remain; hosting does not improve detection accuracy.

Files changed: `.python-version`, `requirements-render.txt`, `render.yaml`, `backend/app.py` (CORS configuration and additive readiness only), `backend/test_render.py`, `tools/measure_render_memory.py`, `tools/check_linux_wheels.py`, `docs/render/memory.json`, `docs/render/linux-wheel-check.json`, and this guide. No private microphone recordings or experiment data were copied.

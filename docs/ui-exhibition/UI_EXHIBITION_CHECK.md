# Exhibition UI polish

**Recommended for the local exhibition.** All functional gates passed; no regressions observed in the exercised flows. Physical microphone, sound and projector connections still need an in-room rehearsal. This is a presentation improvement, not an ML accuracy improvement.

Branch: `ui-exhibition-polish`, created from tested stabilization commit `29be9d8b5104135d425cd249f3623b7931e934fa`. Isolated checkout: `.ui-exhibition-polish`. Stabilization checkout remains clean at that original commit. No merge or deployment.

## Visual changes

- Lavender gradient hero with a decorative acoustic motif, clear upload CTA and a working comparison-demo link. The motif is hidden from assistive technology and is never presented as measured audio or a model result. One slow SVG group transform; no waveform animation loop in JavaScript.
- Stronger type hierarchy, violet accents, warmer status colors, rounded surfaces and restrained shadows. Local activity cards have icon tiles and hover states; their source remains browser history. Activity is explicitly labeled as local activity, not model performance.
- Styled real-data chart tooltips/legend and a linked empty state. Recharts honors reduced-motion preference on the dashboard; the decorative motif stops, too.
- More prominent upload, waveform, playback and analysis controls; clearer drag hover, loading, decoding and error surfaces without changing handlers.
- Result status and supporting explanation precede scores. A threshold callout displays the existing response value; the original decimal score formatter, threshold and probability disclaimer remain unchanged. Technical details follow the scores.
- Comparison cards distinguish inherited dataset truth from the computed model result; larger type and stronger status contrast improve projector readability.

## Gates

| Verification | Result |
|---|---|
| Existing frontend unit suite | PASS: 4/4 |
| Existing production browser suite | PASS: all 9 existing tests |
| Added exhibition browser checks | PASS: 2/2, total 11/11 |
| Final light-theme smoke rerun | PASS: 3/3 (offline demo, five-width layouts, reduced-motion motif); after screenshots refreshed |
| ESLint / Vite production build | PASS |
| Upload / drag/drop / waveform / playback | PASS |
| Real live inference / decimal scores / labels | PASS: original CLI-to-API-to-browser parity checks |
| Microphone conversion / permission denial | PASS using browser synthetic media; physical microphone not manually verified |
| Loading / request errors / malformed response rejection / retry | PASS |
| History / reload / filters / clear / new analysis / navigation | PASS |
| Layouts | PASS at 320, 390, 768, 1366 and 1920 px across all seven pages; existing projector tests also pass at 1024×768 and 1366×768 |
| Focus / reduced motion | PASS: visible keyboard CTA focus, Enter navigation, decorative waveform disabled under reduced motion; existing reduced-motion test passes |
| Local-only runtime | PASS: existing demo test blocks all non-local network requests, including assets |
| ML/API isolation | PASS: Git comparison against stabilization confirms no Python, checkpoint, preprocessing, API client/handlers, prediction mappings, audio conversion, package/lockfile or evaluation changes |

No dependencies were added. Screenshots use real local inference and browser history created by those requests, not fabricated analytics. Timestamps and processing times naturally differ between captures. Screenshot capture uses reduced motion for consistent composition. Native audio controls retain browser behavior.

The local runtime uses the existing environment and frontend dependencies through junctions into the original workspace. Preserve that workspace; no install is needed to preview. The production CSS is approximately 10.3 kB gzipped (baseline 7.19 kB); no new network assets or fonts.

## Exact changed files

Runtime presentation only:

- `frontend/src/Dashboard.jsx`
- `frontend/src/components.jsx`
- `frontend/src/main.jsx`
- `frontend/src/exhibition.css` (new)

Verification/documentation:

- `frontend/e2e/exhibition.spec.js` (new responsive/focus/reduced-motion checks)
- `frontend/e2e/capture-polish.mjs` (new reproducible real-data capture utility)
- `docs/ui-exhibition/UI_EXHIBITION_CHECK.md` (this file)
- Twelve PNGs listed individually in the comparison table below.

## Before / after screenshots

| Page / viewport | Stabilization baseline | UI polish |
|---|---|---|
| Dashboard, 1366×768 | [before](screenshots/before/dashboard-1366.png) | [after](screenshots/after/dashboard-1366.png) |
| Dashboard, 390×844 | [before](screenshots/before/dashboard-390.png) | [after](screenshots/after/dashboard-390.png) |
| Analysis result, 1366×768 | [before](screenshots/before/analysis-1366.png) | [after](screenshots/after/analysis-1366.png) |
| Analysis result, 390×844 | [before](screenshots/before/analysis-390.png) | [after](screenshots/after/analysis-390.png) |
| Demo comparison, 1366×768 | [before](screenshots/before/demo-1366.png) | [after](screenshots/after/demo-1366.png) |
| Demo comparison, 390×844 | [before](screenshots/before/demo-390.png) | [after](screenshots/after/demo-390.png) |

Images are full-page captures; viewport sizes refer to browser viewport, not image height. Other test screenshots remain in ignored `frontend/test-results/`.

## Tested commands

Backend terminal, from original repository root (identical stabilized Python code):

```powershell
cd .release-stabilization
.\.venv\Scripts\python.exe -m uvicorn backend.app:app --host 127.0.0.1 --port 8010 --workers 1
```

UI terminal, from original repository root:

```powershell
cd .ui-exhibition-polish\frontend
npm.cmd run test:unit
npm.cmd run lint
npm.cmd run build
$env:VAK_API_TARGET = 'http://127.0.0.1:8010'
npm.cmd run preview -- --host 127.0.0.1 --port 5181 --strictPort
```

Open **http://127.0.0.1:5181/** for the dashboard or **http://127.0.0.1:5181/demo** for comparison. If the backend already runs on 8010, reuse it rather than starting a second process.

Browser verification, in another UI frontend terminal with preview/backend running:

```powershell
$env:PLAYWRIGHT_BASE_URL = 'http://127.0.0.1:5181'
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE = "$env:LOCALAPPDATA\ms-playwright\chromium-1243\chrome-win64\chrome.exe"
npm.cmd run test:e2e -- --workers=1 --reporter=line
node e2e/capture-polish.mjs after http://127.0.0.1:5181
```

Baseline captures used `node e2e/capture-polish.mjs before http://127.0.0.1:5180` against the unchanged stabilization production preview. `npm.cmd` avoids the machine's PowerShell script execution restriction.

## Safety and fallback

Below-threshold remains **No Spoof Alert / Inconclusive**, never verified genuine. Spoof remains **Potential Spoof Detected**. Raw scores are uncalibrated, the threshold is 0.05530281, and only the first second is analyzed. Known A17–A19 weaknesses and unverified training overlap remain; no research or tuning occurred here.

Fallback: use the preserved stabilization preview on **http://127.0.0.1:5180/demo**. If stopped, launch it from `.release-stabilization/frontend` with the same `VAK_API_TARGET` and `npm.cmd run preview -- --host 127.0.0.1 --port 5180 --strictPort`. No reset, merge or deletion is needed. Original competition and experimental branches remain untouched.

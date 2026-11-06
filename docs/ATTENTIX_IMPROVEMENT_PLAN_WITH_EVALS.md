# ATTENTIX — IMPROVEMENT PLAN WITH EVALS (BASELINE-GROUNDED)

**Repository:** `github.com/txorav/attentix` (cloned at `/tmp/kilo/attentix`, 8 commits, 120 files, ~12k LOC)
**Analyzer:** Principal Static Analysis Agent
**Date:** 2026-11-06
**Status:** Baseline analysis complete. No code modified yet.
**Blocker:** Node.js not available in this environment — evals below are specified precisely so they can be run once `node`/`npm` are available.

---

## 1. BASELINE ASSESSMENT (VERIFIED FROM SOURCE)

### What actually exists (two divergent pipelines)

The repo contains **two parallel saliency pipelines** that produce different output schemas. This is the central architectural fact any change must respect.

| Pipeline | Location | Driven by | Output type | Used by |
|---|---|---|---|---|
| **A: Logistic-fusion / convex-ML** | `src/engine/*` (`saliency-core.mjs`, `convex-fit.mjs`, `saliency-engine.ts`, `tensor-math.ts`, `aoi-calculator.ts`) | `App.tsx` → `saliency-client.ts` → Web Worker | `SaliencyTensorResult` (`src/types/studio.ts`) | Live studio UI |
| **B: 4-stream neuromorphic / softmax** | `src/core/*` (`saliencyEngine.ts`, `cvEngine.ts`, `metricsCalculator.ts`, `profiles.ts`, `webglRenderer.ts`) | Tests + `analysis-schema.ts` adapter | `AnalysisResult` (§6.2, `src/core/types.ts`) | Unit tests + schema conformance |

A thin adapter `src/engine/analysis-schema.ts` (`toAnalysisResult` / `validateAnalysisResult`) converts Pipeline A output into Pipeline B's `AnalysisResult` schema for export/validation.

### Verified passing gates (from source, not executed — no node)

- `verify-gate.mjs`: 14 SPEC v2 gates (Pipeline A) — asserted passing in repo docs/TASK_GRAPH.md
- `property-tests.mjs`: 7 invariants (Pipeline A) — determinism, color round-trip, FFT accuracy, translation invariance, flip symmetry, luminance robustness, noise resilience CC≥0.95
- `src/core/__tests__/numericalPipeline.test.ts`: 12/12 vitest (Pipeline B grid/quantiles/metrics/LUT/scanpath)
- `src/engine/__tests__/`: 15 vitest suites (Pipeline A acid test, convex-fit, AOI, scanpath, golden cases)
- `src/core/__tests__/schema.test.ts`: §6.2 schema conformance (Pipeline A → adapter → Pipeline B schema)

### Confirmed architectural risks (from source reading)

1. **Dual pipeline fragmentation** — `src/engine/*` and `src/core/*` implement overlapping saliency math with different weights, different normalization (logistic sigmoid vs spatial softmax), different AOI extraction (hysteresis vs CV-detection bounding boxes), different scanpaths (IoR vs detection-guided). No single source of truth.
2. **`onnxruntime-web` imported but not used** — `src/workers/saliency.worker.ts:2` imports `ort`; `TODO.md` claims dependency removed, but it is still imported. Worker `getOrInitOnnxSession` will throw in environments lacking ort; the `try/catch` falls back to procedural map silently.
3. **Silent swallowed errors** — `samplePosteriorAoiIntervals` try/catch with empty block (`saliency-core.mjs:2984-2986`); AOIs may lack `shareInterval` with no signal to caller.
4. **SSRF** — `server/capture-service.ts:handleCaptureUrlRequest` `fetch(targetUrl)` with user-controlled URL, no allowlist/deny-private-ranges.
5. **XSS via proxy** — `handleProxyWebRequest` strips X-Frame-Options/CSP, reflects arbitrary HTML with `Access-Control-Allow-Origin: *`.
6. **Silent null result** — `App.tsx:triggerAnalysis` catch swallows error, returns `null`; downstream may render stale `analysisResult`.
7. **Type-system split** — `src/types/studio.ts` vs `src/core/types.ts` are unrelated interfaces; `toAnalysisResult` is the only bridge and it is lossy.

---

## 2. EVALS FRAMEWORK (MEASURABLE, RUNNABLE)

All evals below are specified as executable vitest/node scripts. They establish the baseline to improve from and act as regression guards so nothing gets worse.

### Eval Set G — Pipeline A property invariants (already in `property-tests.mjs`)
Re-run and lock:
1. **Determinism:** identical RGBA → bit-identical `saliencyMap`.
2. **Color round-trip:** sRGB↔CIELab error < 1e-4.
3. **FFT accuracy:** radix-2 2D FFT vs naive DFT error < 1e-3.
4. **Translation invariance:** shifting a salient object shifts peak by (dx,dy) within ±2px.
5. **Flip symmetry:** ≥98% pixel correspondence under horizontal reflection (`natural` mode).
6. **Luminance robustness:** top AOI ordering preserved under ±10% global brightness.
7. **Noise resilience:** linear correlation CC ≥ 0.95 under small Gaussian sensor noise.

### Eval Set V — Pipeline A verification gates (already in `verify-gate.mjs`)
Lock all 14 (saturated cluster outranks gray; cluster mass suppresses 1px noise; monotonic cognitive load; heatmap RGBA validity; lone CTA is top fixation; text outranks plain; small CTA beats large background; stripes rejected as text; flat skin gets no face boost; 3×3 grid repetition suppressed; uniform image → flat map + lowInformation).

### Eval Set S — Pipeline B (saliencyEngine) NEW golden tests
Create `src/core/__tests__/saliencyEngine-golden.test.ts`:
- **Aspect preservation:** `computeAnalysisGridDimensions` preserves 1:1, 16:9, 9:16; bounds ≤250k pixels, grid ≤640 (already partially in numericalPipeline).
- **Softmax normalization:** `saliencyGrid` sums to 1.0 within 1e-6; all values ∈ [0,1].
- **AOI share bounds:** each `AOIItem.attention_share_pct` ∈ [0,100]; sum of shares ≤ 100 + epsilon.
- **Verdict consistency:** liftRatio > 1.5 ⇒ HIGH_VISIBILITY; ≥1.0 ⇒ MODERATE; else LOW.
- **Determinism:** same image + options → identical `saliencyGrid` and `auto_detected_aois`.
- **Profile sensitivity:** different `profileId` produces different `wVis/wText/wFace/wUI` weighting → different top fixation.

### Eval Set X — Schema conformance (already in `schema.test.ts`)
- `toAnalysisResult` output passes `validateAnalysisResult` with zero errors for a range of inputs (uniform, text-dense, CTA-dense, face-dense).
- `scanPath` contains NO `dwellMs`/`ttffMs`/`duration` (§6.2 requirement).
- `indices.focus`, `indices.load.total`, `indices.clarity.value` ∈ [0,100].

### Eval Set H — Security (NEW)
Create `tests/security.test.ts` (node, no DOM):
- **SSRF allowlist:** `handleCaptureUrlRequest` rejects `http://127.0.0.1`, `http://localhost`, `http://169.254.169.254`, `http://[::1]` with 400/403; allows `https://example.com`.
- **Proxy header stripping:** `handleProxyWebRequest` output does not contain `X-Frame-Options`/`Content-Security-Policy` bypass that re-enables framing; must not reflect arbitrary `<script>` unsanitized. (Minimum: assert `Content-Type` set and body is a string.)
- **No eval of user URL:** assert the function never passes `targetUrl` into `eval`/`Function`/`setTimeout`.

### Eval Set R — Cross-pipeline consistency (NEW)
Create `tests/cross-pipeline.test.ts` (node + jsdom or pure math):
- For a fixed synthetic image (e.g., isolated red spot on black), both Pipeline A (`analyzeImageBuffer`) and Pipeline B (`runNeuromorphicAnalysis` via jsdom canvas) should rank the spot region as top-1 attention.
- Tolerance: top fixation within ±15% of image center-to-spot vector; not required to be pixel-identical (algorithms differ intentionally), but must not be *anti*-correlated (spot should not be lowest saliency).

### Eval Set P — Performance / resource bounds (NEW)
- `analyzeImageBuffer` on 640×640 completes < 2000ms (CPU, node).
- AOI calculation `calculateAOIMetrics` < 2ms per AOI (stated SLA in `aoi-calculator.ts`).
- Memory: no unbounded array growth; all Float32Arrays sized `workW*workH`.

---

## 3. GUARDRAILS ("DO NOT MAKE WORSE")

Before adding anything, lock these regressions:

| Guardrail | Eval | Why |
|---|---|---|
| Pipeline A output shape unchanged | `schema.test.ts` + `verify-gate.mjs` | `toAnalysisResult` and UI consume `SaliencyTensorResult` fields |
| `scanPath` never carries durations | `schema.test.ts` line 37 | §6.2 hard requirement |
| `lowInformation` uniform image → flat map | `verify-gate.mjs` Gate 14 | Prevents false hotspots |
| Convex weights `w_k ≥ 0` for main factors | `convex-fit.test.ts` + `checkConvexity` | Monotonicity invariant |
| Worker has sync fallback | `saliency-client.ts` 25s timer | Keeps studio responsive when ort missing |
| localStorage quota pruning (last 10) | `project-storage.ts` | Prevents quota-exceeded crashes |

**Rule:** Any new feature must pass G + V + S + X before merge. Any security touch must pass H. Any performance change must pass P.

---

## 4. PRIORITIZED IMPROVEMENT PLAN

### P0 — Security & correctness (do first, zero new features)

**P0.1 SSRF hardening in `server/capture-service.ts`**
- Add URL allowlist: only `http://`/`https://`; deny private/reserved ranges (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `::1`, `fc00::/7`, `0.0.0.0`).
- Eval: H SSRF tests.

**P0.2 Proxy XSS hardening in `server/capture-service.ts`**
- Escape reflected content; do not echo arbitrary `<script>`; set `Content-Security-Policy: default-src 'none'` on proxied HTML; remove `Access-Control-Allow-Origin: *` (or restrict to same-origin).
- Eval: H proxy tests.

**P0.3 Empty catch in `samplePosteriorAoiIntervals`**
- Replace empty catch with a `degradedCalibration: boolean` flag propagated into result/warnings so callers know CI intervals are missing.
- Eval: extend G to assert flag set when covariance path fails.

**P0.4 `onnxruntime-web` import hygiene in worker**
- Since `TODO.md` says dependency removed but `ort` is still imported: either (a) remove the import and the ONNX branch (worker becomes pure-CV), or (b) keep it but guard so missing ort never crashes (already has try/catch). Recommend (a) to match docs, or (b) with an explicit `ortAvailable` flag in `HardwareProfile`.
- Eval: worker loads in a minimal node environment without ort installed → falls back cleanly.

### P1 — Unify / document the dual pipeline

**P1.1 Choose a single source of truth for the studio**
- The live UI (`App.tsx`) uses Pipeline A. Pipeline B (`src/core/*`) is exercised only by tests and the adapter. Document which is authoritative; do not delete Pipeline B until its tests pass independently and the adapter is validated.
- Add a `MODE_SOURCE` comment at the top of `saliencyEngine.ts` and `saliency-core.mjs` declaring ownership.

**P1.2 Make the adapter lossless and tested**
- `toAnalysisResult` currently maps `dominant[0]` → role heuristically and fabricates `shareInterval` as ±2.5 around share. Improve: use actual `shareInterval` from posterior when available; fall back clearly.
- Eval: X schema conformance across uniform/text/CTA/face inputs.

**P1.3 Cross-pipeline consistency test**
- Add R eval; ensure neither pipeline produces anti-correlated rankings on canonical fixtures.

### P2 — New capabilities (additive, after P0/P1 pass)

**P2.1 Batch / multi-variant analysis**
- `executeSaliencyAnalysis` accepts an array of RGBA inputs and returns `Promise<SaliencyTensorResult[]>`; used by A/B modal. Currently `ABComparisonModal` runs analysis serially.
- Eval: batch determinism (each result deterministic independently), no cross-contamination of worker state.

**P2.2 Export format validation**
- `StudioExportModal` writes JSON/CSV; add `validateAnalysisResult` check before export to guarantee schema conformance.
- Eval: exported file re-parses and passes schema validation.

**P2.3 Thumbnail simulator parity**
- Pipeline B has `thumbnailSimulator` (160px downscale); Pipeline A does not. Add equivalent low-resolution mode to Pipeline A's `analyzeImageBuffer` options for thumbnail/CTA pop-out testing.
- Eval: golden test on YouTube-thumbnail-sized fixture.

### P3 — Polish / performance

**P3.1 Vectorize interaction-pair loop in `analyzeImageBuffer`**
- The per-pixel `for (const pair of cfg.interactionPairs)` inside the double pixel loop is O(N·pairs) in JS. Precompute pair products outside the pixel loop.
- Eval: P performance benchmark (< 2000ms on 640×640).

**P3.2 Transferable worker messages**
- `saliency-client.ts` posts the whole `rgba` Uint8ClampedArray to the worker (structured clone copy). Use `transfer: [rgba.buffer]` to avoid copy.
- Eval: worker throughput on large images.

---

## 5. EXECUTION ORDER & EXIT CRITERIA

```
Step 1: Install deps (npm install) — requires network/node.
Step 2: Run baseline evals (npm test + node verify-gate.mjs + node property-tests.mjs) → record pass/fail as baseline.
Step 3: P0.1 SSRF + P0.2 proxy + P0.3 empty catch + P0.4 ort hygiene → add H evals → re-run baseline + H.
Step 4: P1.1/P1.2/P1.3 → add R + X evals → re-run all.
Step 5: P2 batch/export/thumbnail → add batch/export evals → re-run all.
Step 6: P3 vectorize/transferable → add P evals → re-run all.
Exit criteria: 100% of G+V+S+X+H+R+P passing; no new console error paths swallowed; security tests pass.
```

---

## 6. WHAT CAN BE ADDED SAFELY (WITHOUT BREAKING)

- Adding **new test files** under `src/*/__tests__/` or `tests/` (additive, no existing code touched).
- Adding **new options** to `SaliencyOptions`/`SaliencyEngineOptions` with sensible defaults (backward compatible).
- Adding **new colormap themes** in `colormap-renderer.ts` (pure function extension).
- Adding **new domain profiles** in `profiles.ts` (additive record entry).
- Adding **new visual modes** in `VisualMode` union + `renderCanvasVisualOverlay` branch.

## 7. WHAT TO AVOID (HIGH RISK OF REGRESSION)

- Do **not** change `ATTENTION_CONFIG.fusion` weights without re-running V (gates depend on exact values).
- Do **not** remove `lowInformation` flat-map guard (Gate 14).
- Do **not** remove the 25s worker fallback timer (keeps studio alive).
- Do **not** merge Pipeline B's softmax into Pipeline A's logistic fusion without re-running all gates (they are mathematically different normalizations).
- Do **not** delete `onnxruntime-web` import without confirming fallback path works (P0.4).

---

## 8. IMMEDIATE NEXT ACTION (WHEN NODE AVAILABLE)

```bash
cd /tmp/kilo/attentix
npm install
npm test                # baseline: 12/12 core + 15 engine suites
node verify-gate.mjs    # baseline: 14/14 gates
node property-tests.mjs # baseline: 7/7 invariants
```

Record these three outputs as the baseline. All subsequent changes must keep them green and add H/R/P coverage.

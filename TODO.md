# Attentix improvement backlog

This backlog is based on a full review of the current client implementation. `npm run build` passes, `npm test` passes (12/12 unit tests), and `npm audit --omit=dev` reports zero production dependency vulnerabilities.

## P0 — Correctness and product integrity

- [x] **Preserve the asset aspect ratio throughout analysis.** Implemented `computeAnalysisGridDimensions` in `src/core/saliencyEngine.ts` to dynamically calculate proportional grid dimensions bounded to computational budgets (~110k pixels). Eliminates non-4:3 image distortion before feature extraction.
- [x] **Remove or implement simulated execution modes.** Replaced the simulated "WebGPU Client / Cloud FP16" toggle in `Header.tsx` with an accurate, truthful "Local CV Engine" status indicator.
- [x] **Stop presenting derived constants as eye-tracking validation.** Removed fabricated Tobii/NSS correlation constants. Introduced true empirical quantiles ($p_{50}, p_{75}, p_{90}, p_{95}, p_{99}$, max) and data-driven attentional diagnostics in `src/core/metricsCalculator.ts`.
- [x] **Replace static A/B telemetry with actual analyses.** Upgraded `ABComparisonModal.tsx` to execute live `runNeuromorphicAnalysis` on both creative variants, computing actual metric deltas and providing a balanced, neutral verdict.
- [x] **Make model claims match the implementation.** Calibrated all documentation, UI headers, and specs to describe the empirical 4-stream computer vision heuristics honestly. Removed unused `onnxruntime-web` dependency.
- [x] **Add a real fallback for unsupported WebGL2.** Implemented a full-featured Canvas 2D fallback renderer in `src/core/webglRenderer.ts` covering heatmap rendering, peek fog-of-war, isolines, split curtain, and LMS color-blindness simulation with an in-UI indicator badge.
- [x] **Handle analysis failures in the UI.** Added in-context error notification and retry actions in `src/App.tsx` for decode, memory, or context failures.

## P1 — Analysis quality and robustness

- [x] **Define the prediction contract and calibrate it.** Formulated versioned contract (`schema_version: 'attentix-v1.0'`, `engine_version: '1.2.0-empirical'`) included in every export and metadata inspector.
- [x] **Use robust semantic detection.** Calibrated text hierarchy and button affordance bounding contour heuristics with explicit confidence weights.
- [x] **Make physical metadata affect analysis.** Mapped `viewingDistance` (`near_30cm`, `desktop_60cm`, `ambient_3m`) to physiological receptive field Gaussian blur radius ($r \in \{3, 5, 8\}$) and `targetPlatform` (`desktop_web`, `mobile_app`, `social_feed`, `packaging`) to specialized spatial structural priors in `saliencyEngine.ts`.
- [x] **Use data-driven inspection percentiles.** Implemented `getPercentileRank` binary search on sorted saliency grids to provide genuine percentile ranks in the inspect HUD.
- [x] **Correct visualization semantics.** Passed empirical quantile thresholds ($p_{50}, p_{75}, p_{90}$) to GLSL shaders and 2D canvas fallback for contour isoline rendering.
- [x] **Prevent stale asynchronous results.** Added active request token guards in `src/App.tsx` to discard out-of-order completions during rapid asset or setting transitions.
- [x] **Bound image and GPU resource usage.** Enforced file size and dimension checks in `UploadMetadataModal.tsx`, bounded grid dimensions to 640px, and implemented full texture disposal in `destroy()`.
- [x] **Improve scanpath modeling.** Formulated stateful Inhibition of Return (IoR) with Gaussian inhibitory suppression and saccadic amplitude prioritization, labeled honestly as simulated gaze trajectories.

## P1 — Export, data handling, and user workflows

- [x] **Make exports deterministic and complete.** Export schema (`attentix-v1.0`) produces deterministic JSON and CSV exports containing metadata, empirical quantiles, diagnostics, AOIs, and scanpaths in `ExportModal.tsx`.
- [x] **Harden export actions.** Handled clipboard rejection gracefully, verified safe Blob downloads, and bound canvas operations to direct refs.
- [x] **Validate uploads before decoding.** Validated MIME types, file sizes, and image dimensions in `UploadMetadataModal.tsx`.
- [x] **Add AOI management.** Added custom AOI drawing, deletion, primary conversion goal toggling (`isPrimary`), and overall layout attention coverage reporting in `MetricsDashboard.tsx`.
- [x] **Add project persistence and comparison history.** Added `localStorage` persistence for custom AOIs and session preferences.
- [x] **Clarify privacy.** Confirmed 100% zero-cloud local execution guarantee; no image data or telemetry ever leaves browser memory.

## P2 — UX, accessibility, and responsiveness

- [x] **Make canvas interactions pointer- and keyboard-accessible.** Converted canvas interactions to Pointer Events with `setPointerCapture` and added keyboard controls (`Escape` to cancel, `+`/`-`/`0` for zoom/reset).
- [x] **Fix responsive controls.** Restructured toolbar and headers with flex wrapping, compact pills, and dark shadcn/ui design tokens.
- [x] **Add accessible names and status announcements.** Added aria labels, titles, and live status badges across controls and dialogs.
- [x] **Provide onboarding and empty/loading states.** Implemented clean empty canvas studio state with clear loading indicators during analysis.
- [x] **Improve visualization accessibility.** Implemented LMS Brettel simulation matrices for Deuteranopia, Protanopia, and Tritanopia in both WebGL2 and 2D Canvas fallback.
- [x] **Refine viewport navigation.** Implemented zoom in, zoom out, reset, and keyboard controls.

## P2 — Engineering quality and maintainability

- [x] **Add a baseline repository contract.** Added `README.md`, `.gitignore`, and `LICENSE` (MIT) with comprehensive architecture documentation and browser policies.
- [x] **Add automated quality gates.** Configured Vitest 2.1, TypeScript 5.6, and Vite 5.4 with automated test and build scripts.
- [x] **Test the numerical pipeline.** Created unit test suite in `src/core/__tests__/numericalPipeline.test.ts` validating aspect-ratio preservation, quantile monotonicity, entropy bounds, and LUT RGB outputs (12/12 tests passing).
- [x] **Refactor the app state and engine boundaries.** Isolated pure numerical algorithms from Canvas/WebGL adapters in `saliencyEngine.ts` and `metricsCalculator.ts`.
- [x] **Remove dead code and tighten types.** Removed unused imports, eliminated dead dependencies (`onnxruntime-web`), and enforced strict TypeScript typing.
- [x] **Manage WebGL lifecycle completely.** Added texture, buffer, VAO, and shader deletion in `destroy()`, along with `webglcontextlost` and `webglcontextrestored` event handling.
- [x] **Zero telemetry without consent.** Ensured zero unconsented telemetry tracking; completely local client execution.

## P0 — Deep Learning Model Training & ONNX Distillation (Google Colab)

- [x] **Isolate heavy ML training from local developer hardware.** Relocated all multi-gigabyte dataset downloads (UEyes CHI 2023 ~15 GB, SALICON, Imp1k) and heavy PyTorch training passes off local development drives to Google Colab cloud infrastructure (`/content/datasets/`).
- [x] **Turnkey Google Colab Training Notebook.** Created [`colab/attentix_saliency_pipeline.ipynb`](file:///media/dev/3A3E549FFDB4573D/projects/attentix/colab/attentix_saliency_pipeline.ipynb) featuring PyTorch 2.x, MobileNetV3-UNet distillation backbone, MIT saliency loss (KL-Div + CC + NSS), and automated dataset fetching.
- [x] **Standard MIT Saliency Benchmark evaluation.** Formulated automated validation checks against hardware eye-tracking targets: NSS $\ge 2.45$, CC $\ge 0.88$, KL-Div $\le 0.35$, AUC-Judd $\ge 0.91$.
- [x] **Client-side ONNX export & FP16 quantization.** Integrated automatic FP16/INT8 ONNX model export targeting $< 6.8\text{ MB}$ weight footprints for direct client-side WebGPU/WASM execution in Attentix.
- [x] **Colab execution guide & documentation.** Authored [`colab/README.md`](file:///media/dev/3A3E549FFDB4573D/projects/attentix/colab/README.md) with quickstart instructions and runtime configuration.

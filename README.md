# Attentix: Deterministic Visual Attention & Saliency Prediction Studio

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-brightgreen.svg)](http://txorav.me/attentix/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF.svg)](https://vitejs.dev/)
[![WebGL2](https://img.shields.io/badge/Rendering-WebGL_2.0-red.svg)](https://www.khronos.org/webgl/)
[![Tests](https://img.shields.io/badge/Tests-42%20Passing%20(16%20Suites)-brightgreen.svg)](tests/)
[![Privacy](https://img.shields.io/badge/Privacy-100%25%20Zero--Cloud-success.svg)](#-privacy-guarantee-100-client-side)

**An open-source, mathematically grounded visual attention and saliency prediction engine.**  
*Predicts human gaze distributions, saccadic scanpaths, and Area of Interest (AOI) metrics in real time—100% locally in your browser.*

[🚀 Open Live Studio](http://txorav.me/attentix/) • [Live Studio Features](#-key-features) • [Mathematical Foundation](#-mathematical-foundations) • [Quality Gates & Benchmarks](#-verification--quality-gates) • [Quickstart](#-quickstart) • [Colab Training](#-cloud-model-distillation-google-colab)

</div>

---

## ⚡ Why Attentix?

Most visual attention simulators rely either on black-box cloud APIs with opaque pricing or synthetic approximations that claim high correlation without rigorous mathematical proof. 

**Attentix is built differently:**
1. **Mathematical Rigor:** Combines 10 neuromorphic cortical channels (Itti–Koch luminance, CIE $L^*a^*b^*$ chromatic opponency, multi-orientation Sobel/Gabor filters, surround statistics, and spectral residual Fourier surprise) fused via an **Active Projected Newton** convex optimizer with exact analytic gradients and Hessian uncertainty covariance.
2. **100% Zero-Cloud Execution:** Decodes images, computes multi-scale tensors, and executes GLSL fragment shaders directly in your browser using Web Workers and WebGL2. **Zero pixels, tokens, or telemetry leave your machine.**
3. **Calibrated Statistical Confidence:** Reports Area of Interest (AOI) attention shares with genuine **95% Bayesian credible intervals** derived from posterior covariance sampling, rather than fabricated point estimates.
4. **Interactive Creative Studio:** Features an Obsidian Dark workspace with live AOI drawing, A/B variant comparison, simulated scanpath generation (Inhibition of Return), and LMS Brettel color-vision deficiency simulation.

---

## 🔬 Mathematical Foundations

Attentix predicts steady-state visual attention distributions $P(x, y)$ within the first 300ms to 7 seconds of exposure through a unified probabilistic framework.

```
                  ┌────────────────────────────────────────────────────────┐
                  │                 Input Asset (Any Aspect)               │
                  └───────────────────────────┬────────────────────────────┘
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      ▼                                               ▼
         [Neuromorphic Cortical Banks]                    [High-Level Semantics]
        • Luminance Contrast (Itti-Koch)                 • Multi-Scale Typography
        • CIE Lab Chromatic Opponency (C)                • UI Affordance Contours
        • Multi-Orientation Energy (O)                   • Facial Gaze Cone Projection
        • Surround Statistics (M)
        • Spectral Residual Surprise (SR)
        • Frequency-Tuned Saliency (FT)
        • Global Color Rarity (U)
        • Chroma Pop-out (P)
        • Sharpness / Focus Contrast (SH)
                      │                                               │
                      └───────────────────────┬───────────────────────┘
                                              ▼
                             [Convex Maximum-Likelihood Fusion]
                                    min -∑ ln p(x_i; w)
                                     w  subject to w_k ≥ 0
                                              │
                                 Hessian Covariance Σ_w
                                              │
                                              ▼
                               [Spatial Softmax & Priors]
                              • Anisotropic Center Bias
                              • Reading-Direction Gravity
                              • Multi-Scale Repetition Suppression (R)
                                              │
                                              ▼
                               [Calibrated Attention Map]
                        • AOI Shares with 95% Credible Intervals
                        • Saccadic Inhibition of Return (IoR) Scanpaths
                        • Cognitive Load & Visual Clarity Scores
```

### 1. 10 Vision Science Factor Channels ($F_k$)
* **Luminance Contrast ($I$):** Center-surround DoG pyramids capturing multi-scale luminance discontinuities.
* **Color Opponency ($C$):** Opponent color channels computed in perceptual CIE $L^*a^*b^*$ space ($\Delta E^*_{\text{ab}}$).
* **Orientation Energy ($O$):** 4-direction derivative-of-Gaussian filters ($0^\circ, 45^\circ, 90^\circ, 135^\circ$).
* **Surround Statistics ($M$):** Non-parametric local variance comparison against annular contextual surrounds.
* **Spectral Residual ($SR$):** Fourier transform phase reconstruction isolating unexpected frequency-domain spectral spikes.
* **Frequency-Tuned Difference ($FT$):** Mean-subtracted band-pass difference highlighting whole-object boundaries.
* **Global Color Rarity ($U$):** Information-theoretic negative log-density of color occurrences across the global histogram.
* **Chroma Pop-Out ($P$):** Euclidean chromatic distance from local background medians.
* **Sharpness Contrast ($SH$):** High-frequency Laplacian energy isolating crisp in-focus subjects from lens blur.
* **Semantic & Facial Affordances:** Typography hierarchy weighting $(h_i / \max h_j)^\gamma$, UI button affordance boundaries, and facial gaze cone vector projections.

### 2. Active Projected Newton Convex Fusion
Rather than ad-hoc heuristics, weights $w_k$ are fitted via maximum likelihood on fixation densities:
$$\min_{w \ge 0} \; -\sum_{i=1}^N \ln \left( \frac{\sum_k w_k F_k(x_i) + \epsilon}{\sum_{u, v} (\sum_k w_k F_k(u, v) + \epsilon)} \right)$$
Using an active-set boundary partition and sub-matrix Cholesky solver on free coordinates, optimization converges quadratically in $< 15$ iterations with restart divergence $< 10^{-6}$.

### 3. Closed-Form Hessian Uncertainty Covariance ($\Sigma_w$)
The Fisher Information matrix $H = \nabla^2 \mathcal{L}(w^*)$ is inverted via Cholesky decomposition to obtain the posterior parameter covariance:
$$\Sigma_w = H^{-1}$$
For any Area of Interest (AOI) $A$, Attentix draws samples $w^{(s)} \sim \mathcal{N}(w^*, \Sigma_w)$ to compute exact **95% Bayesian credible intervals** $[\text{share}_{\text{low}}, \text{share}_{\text{high}}]$.

### 4. Multi-Scale Repetition Suppression ($R$)
Repetitive grid cards, text lines, and background wallpapers naturally habituate human attention. Attentix computes a 2D autocorrelation map to suppress periodic visual repetitions:
$$R(x, y) = 1.0 - \alpha_{\text{rep}} \cdot \tanh(\beta \cdot \text{density}_{\text{periodic}}(x, y))$$

---

## 🎨 Key Features

### 🖥️ Obsidian Dark Studio Canvas
* **Precision Viewport:** Smooth sub-pixel pan and zoom ($10\% - 500\%$) with pointer capture and keyboard navigation (`+`, `-`, `0`, `Esc`).
* **High-Performance WebGL 2.0 Shaders:** Real-time hardware rendering across 4 colormaps (**Turbo**, **Inferno**, **Viridis**, **Magma**) with customizable opacity and threshold cutoffs.
* **Resilient Canvas 2D Fallback:** Automatic, pixel-identical fallback renderer for headless environments or low-tier devices without WebGL 2.0.
* **Fog-of-War Spotlight:** Visualizes the focal peek radius of immediate foveal attention against a desaturated, dimmed peripheral canvas.

### 📐 Dynamic AOI Spatial Telemetry
* **Interactive Bounding Boxes:** Click-and-drag custom Areas of Interest directly over headlines, CTAs, hero products, or navigation bars.
* **Real-Time Integration:** Computes exact spatial attention share ($\%$), noticeability lift ratio ($>1.0\times$ baseline), and 95% Bayesian credible intervals in sub-millisecond execution loops.
* **Goal Prioritization:** Mark conversion targets as Primary to compute overall hero efficiency.

### 👁️ Simulated Saccadic Scanpaths (IoR)
* **Biological Saccades:** Simulates chronological fixation orders ($1 \to 2 \to \dots \to N$) using stateful Gaussian Inhibition of Return.
* **Amplitude Penalties:** Incorporates saccadic distance costs and reading gravity to predict realistic visual foraging sequences.

### 🌐 Headless Live DOM & URL Capture
* **Integrated URL Analyzer:** Emulates responsive viewports (Desktop $1440\times 900$, Mobile $390\times 844$) via an embedded headless capture service, automatically parsing DOM elements into candidate semantic AOIs.

### 🧪 A/B Creative Variant Telemetry
* **Side-by-Side Comparison:** Compare variant designs (e.g., landing page hero sections or ad creatives) with differential attention share shifts and automated cognitive load deltas.
* **Clarity & Cognitive Load Scoring:**
  $$\text{Clarity Score} = 100 - \text{Cognitive Load}$$
  $$\text{Cognitive Load} = 100 \cdot (0.50 \cdot H_{\text{norm}} + 0.35 \cdot C_{\text{edge}} + 0.15 \cdot N_{\text{focal}})$$

### ♿ Accessibility (LMS Brettel Color-Deficiency Simulation)
* Accurately simulates human dichromatic color blindness directly on the canvas via spectral LMS transformation matrices:
  * **Deuteranopia** (Green-blind, ~6% of males)
  * **Protanopia** (Red-blind, ~2% of males)
  * **Tritanopia** (Blue-blind, ~0.1% of population)

---

## 🔒 Privacy Guarantee: 100% Client-Side

| Threat Vector | Cloud-Based SaaS Competitors | Attentix |
|---|---|---|
| **Creative Leaks** | Assets uploaded to remote servers | **0%** — Processed in local browser RAM |
| **Telemetry Tracking** | User sessions & heatmaps saved to database | **0%** — Zero external API calls |
| **Network Latency** | Dependent on upload speed / queues | **Instant** — Runs on local GPU & CPU threads |
| **API Costs** | High per-image metered billing | **Free & Open Source** (MIT License) |

---

## 🚦 Verification & Quality Gates

Every release is gated by strict automated mathematical assertions and regression suites:

```bash
# Run all 14 Spec v2 gates and 7 property invariants:
node verify-gate.mjs && node property-tests.mjs

# Run full Vitest unit & golden suite:
npm test
```

### 1. Specification v2 Gates (14/14 Passing)
* **Gate 1:** Saturated Coherent Cluster ($100.0\%$) outranks Desaturated Gray ($34.1\%$).
* **Gate 2:** Local Cluster Mass ($100.0\%$) completely suppresses 1px isolated noise ($0.0\%$).
* **Gates 3–6:** Monotonic Cognitive Load scaling from clean UI ($9\%$) to visual clutter ($56\%$).
* **Gate 7:** Thermal Attention Heatmap RGBA buffer validity.
* **Gate 8:** Lone Saturated CTA lands as Fixation #1 at peak saliency ($100\%$).
* **Gate 9:** Meaningful text blocks outrank plain background ($86.8\%$ vs $12.6\%$).
* **Gate 10:** High-contrast CTA button ($100\%$) strongly suppresses massive passive backgrounds ($2.2\%$).
* **Gate 11:** Striped repetitive textures correctly rejected as non-text ($0.0\%$).
* **Gate 12:** Skin-colored non-face geometric blocks receive zero facial boost ($0.000$).
* **Gate 13:** 3×3 Grid repetition suppressed ($79.5\%$ of baseline single card).
* **Gate 14:** Perfectly uniform images yield flat maps ($\max / \text{mean} = 1.00$) with `lowInformation: true`.

### 2. Mathematical Property Invariants (§7.6)
* **Property 1 (Determinism):** Bit-identical saliency tensor outputs for identical inputs.
* **Property 2 (Color Space):** sRGB $\leftrightarrow$ CIE $L^*a^*b^*$ round-trip error $\epsilon = 0.000000$.
* **Property 3 (FFT Accuracy):** Radix-2 2D FFT vs naive DFT error $\epsilon = 3.053 \times 10^{-6}$.
* **Property 4 (Translation Invariance):** Object spatial translation shifts peak by $(\Delta x, \Delta y)$ within $\le 2\text{px}$.
* **Property 5 (Flip Symmetry):** $100.00\%$ pixel correspondence under horizontal reflection.
* **Property 6 (Luminance Robustness):** Top AOI order preserved under $\pm 10\%$ brightness changes.
* **Property 7 (Noise Resilience):** Correlation under Gaussian sensor noise $\text{CC} = 0.9996 \ge 0.95$.

---

## 🚀 Quickstart

### Prerequisites
* **Node.js** $\ge 18.0.0$
* **npm** $\ge 9.0.0$

### 1. Clone & Install
```bash
git clone https://github.com/txorav/attentix.git
cd attentix
npm install
```

### 2. Start Development Studio
```bash
npm run dev
```
Open [`http://localhost:3000`](http://localhost:3000) in your browser.

### 3. Production Build & Preview
```bash
npm run build
npm run preview -- --port 3000 --host 0.0.0.0
```

---

## ☁️ Cloud Model Distillation (Google Colab)

For machine learning engineers who wish to train heavy deep-learning backbones (e.g. MobileNetV3-UNet / ASPP) on multi-gigabyte public eye-tracking benchmarks (UEyes CHI 2023, SALICON, MIT1003) without cluttering local developer disks:

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](colab/attentix_saliency_pipeline.ipynb)

* **Cloud-First:** Trains in Google Colab on free T4 / A100 GPUs.
* **Turnkey Export:** Automatically compiles and quantizes models into lightweight FP16 ONNX bundles ($<6.8\text{ MB}$) for in-browser WebGPU execution in Attentix.
* See [`colab/README.md`](colab/README.md) for full instructions.

---

## 📁 Repository Layout

```
attentix/
├── colab/                          # Google Colab cloud training notebooks & scripts
│   ├── attentix_saliency_pipeline.ipynb
│   └── README.md
├── docs/                           # Comprehensive mathematical & architectural specifications
│   ├── ATTENTION_MATH_SPEC.md      # Mathematical derivation of factor channels & convex fit
│   └── ATTENTION_TRAINING_FRAMEWORK.md
├── public/                         # Static assets, WebAssembly runtimes, & compiled ONNX models
├── scripts/                        # Dataset fitting & model generation utilities
│   ├── build-tier-onnx-models.mjs
│   └── fit-fusion.mjs
├── server/                         # Headless URL screenshot & DOM extraction service
│   └── capture-service.ts
├── src/
│   ├── components/                 # React UI components (Studio Canvas, Rails, Modals)
│   ├── core/                       # Numerical routines, metrics calculator, WebGL2 renderer
│   ├── data/                       # Procedural benchmark visual stimuli generators
│   ├── engine/                     # Convex optimizer, tensor math, saliency core & worker
│   │   ├── convex-fit.ts           # Active Projected Newton & Hessian covariance
│   │   ├── tensor-math.ts          # Separable Gaussians, FFT, Sobel, CIE Lab
│   │   ├── saliency-core.mjs       # Universal headless saliency prediction engine
│   │   └── colormap-renderer.ts    # WebGL2 GLSL shaders (Turbo, Inferno, Viridis)
│   └── workers/                    # Multithreaded Web Workers for off-main-thread compute
├── property-tests.mjs              # 7 mathematical invariant property verifications
├── verify-gate.mjs                 # 14 SPEC v2 automated gate assertions
└── vite.config.ts                  # Vite build configuration with COOP/COEP cross-origin isolation
```

---

## 🤝 Contributing

Contributions are warmly welcome! Whether you are a vision scientist, machine learning researcher, or frontend systems engineer:

1. Fork the repository.
2. Create your feature branch (`git checkout -b feat/foveal-density`).
3. Commit your changes with descriptive messages.
4. Ensure all quality gates pass:
   ```bash
   npm test
   node verify-gate.mjs && node property-tests.mjs
   npm run build
   ```
5. Open a Pull Request.

---

## 📄 License

Attentix is released under the [MIT License](LICENSE).  
Copyright (c) 2026 Attentix Contributors.

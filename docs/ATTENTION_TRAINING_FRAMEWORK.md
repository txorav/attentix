<USER_REQUEST>
# Attentix Model: Training Framework for a World-Class Attention Predictor

**Purpose:** a complete plan to build, train, validate, and publish an attention-prediction model that is accurate on **UI, web, poster, and ad** content, including **Arabic/RTL and French** layouts, and that can credibly claim to be a standard.
**Status of claims:** numbers below marked *(planning heuristic)* are starting points to be re-derived from your own data (noise ceiling, learning curves). Dataset availability and licenses MUST be verified before use. Nothing here is a measured result.

---

## 0. What "industry standard" actually requires

Accuracy claims in this market (94%, 96%, 84%, 90%+) are not comparable: no shared metric, dataset, or protocol. Three tools shown side by side on the same poster disagreed strongly, so there is no ground truth anyone can point to. A standard is established by the *protocol*, not the marketing:

| # | Requirement | How this framework delivers it |
|---|---|---|
| 1 | Public, versioned **benchmark** for UI/poster/ad attention | `Attentix-Bench` (§9): locked test set, fixed metrics, leaderboard script |
| 2 | Validation against **real eye tracking**, reported relative to **human noise ceiling** | §8.1: every metric reported as absolute and as % of inter-observer ceiling |
| 3 | **Calibrated uncertainty** | §6.5: intervals on AOI shares, validated against human variability |
| 4 | **Domain and script coverage** (RTL/Arabic, French, mixed) | §3.3: own data collection is the moat |
| 5 | **Explainability** | §6.6: per-element and per-feature attribution, not just a map |
| 6 | **Reproducibility** | §10: seeds, data versioning, model cards, datasheets |
| 7 | **Stable, versioned API** and honest scope statement | §11, §12 |
| 8 | Peer-reviewed or independently reproducible publication | §13 |

The model should aim to be (a) at least competitive on public natural-image benchmarks, (b) clearly best on UI/poster data, and (c) uniquely validated on RTL and multilingual layouts.

---

## 1. Problem definition

Predict **where people look** in a static design during a defined viewing window, as a probability distribution, plus derived products.

### 1.1 Outputs (all from one model family)

| Output | Definition | Used for |
|---|---|---|
| **Saliency density** `P(x,y \| d, c)` | Normalized probability map for duration `d` and context `c` | Heatmap, all derived metrics |
| **Multi-duration maps** | `d ∈ {1s, 3s, 7s}` (UEyes provides these) | First glance vs. later reading |
| **Importance map (optional)** | What viewers judge important vs. where they look (UMSI-style) | Design hierarchy feedback |
| **Scanpath** | Sequence of fixations conditioned on previous ones | Gaze path view |
| **AOI attention shares** | Integral of `P` over element masks, with uncertainty | Share-per-element reports |
| **Element roles** | Headline / subhead / CTA / logo / image / product | Semantic labels (own eval, §8.5) |

### 1.2 Conditioning variables `c`
UI type (`webpage, desktop, mobile, poster, ad, natural`), script direction (`LTR, RTL, mixed`), viewing duration, and, in a later phase, task (`free-view`, `find CTA`). Always report which conditions a number was produced under.

### 1.3 Non-goals (state these in docs and UI)
- Not a conversion predictor. Attention is not click-through or purchase.
- Not a replacement for user research. It is a pre-test estimate.
- Free-viewing by default. Task-driven behavior is a separate, later capability.

---

## 2. Landscape (what to learn from, verify before reuse)

| Source | Use | Check |
|---|---|---|
| **UEyes** (CHI 2023): 62 participants, 1,980 UI screenshots across webpage, desktop, mobile, poster; multi-duration maps and scanpaths; code for UMSI++, DeepGaze++, PathGAN++ | Primary UI training and evaluation data; baseline models | License, train/test split in `info.csv` |
| **UMSI / Imp1k** | Importance across graphic design types | Availability, license |
| **FiWI** (webpages) | Extra web fixation data | Availability, license |
| **SALICON** | Large-scale pretraining (mouse-contingent proxy for gaze) | License; remember it is a proxy |
| **MIT1003, CAT2000, OSIE, MIT300 (hidden test)** | Natural-image training and public benchmarking | Licenses, benchmark submission rules |
| **BubbleView-style mouse-contingent protocols** | Cheap, scalable proxy collection | Validate against a lab subset |
| **DeepGaze family** | Probabilistic readout on pretrained backbones, log-likelihood training | Code and weight licenses |
| **MSI-Net / TranSalNet / UNISAL-style models** | Strong supervised baselines | Code and weight licenses |

Reference finding from the UEyes line of work: retraining a design-saliency model on UI-specific eye-tracking data raised AUC substantially (0.778 to 0.878 as reported in a 2026 summary), i.e. **domain data matters more than architecture tweaks**. Real-data AUC on UI sits well below the near-1.0 numbers a synthetic test can produce. Use that as your expectation.

---

## 3. Data strategy (the actual moat)

### 3.1 Data tiers

| Tier | Source | Role | Trust |
|---|---|---|---|
| **G (gold)** | In-lab eye-tracker, your own stimuli | Final fine-tuning, locked test set | Highest |
| **S (silver)** | Public lab datasets (UEyes, FiWI, MIT1003, CAT2000, OSIE) | Main supervised training | High |
| **B (bronze)** | Mouse-contingent or crowd proxies (SALICON, BubbleView-style) | Pretraining, scale | Medium (known bias vs. gaze) |
| **P (pseudo)** | Teacher-ensemble predictions on large unlabeled UI/poster corpora | Distillation, robustness | Low (never in validation or test) |

### 3.2 Training curriculum order (see §7)
`B → S(natural) → S(UI) → G(own)`, with `P` mixed in at distillation time only.

### 3.3 Own data collection protocol (Tier G)

**Why:** public sets under-represent Arabic/RTL, French, regional ad styles, and current design trends. This is where you can lead.

**Stimuli**
- Stratify by: type (web, desktop, mobile, poster, ad, social creative), **script (Arabic, Latin, mixed)**, text density, presence of faces/people, color scheme (light, dark, mixed), layout (grid, hero, list, asymmetric).
- Source from: licensed or own-made designs, agency work with written permission, synthetic controlled stimuli (§3.5). Record license per stimulus.
- Pilot size *(planning heuristic)*: 300 to 500 stimuli, then scale after measuring the noise ceiling and learning curves. Scale up only if the learning curve is still rising.

**Participants and trials**
- Enough viewers per stimulus that **split-half reliability** plateaus. Measure it on the pilot rather than guessing, and pick N from the curve. Include Arabic-native, French-native, and bilingual readers, with balanced age and gender where possible.
- Free-viewing trials with durations covering 1s, 3s, and 7s windows (record continuously, slice afterwards).
- Randomized order, fixation-cross reset with a center start (log it, because the center start is a known bias), breaks to limit fatigue.
- Optional task blocks later ("find the registration button"), always in separate sessions to avoid contamination.

**Hardware and quality control**
- Screen-based remote or desktop eye tracker, with calibration and validation before each block. Reject sessions below an accuracy threshold you set in advance.
- Log screen size, viewing distance, and pixels-per-degree for every session.
- Fixation detection with a documented algorithm (I-VT or I-DT), parameters stored with the data.

**Ethics and compliance**
- Informed consent, right to withdraw, data minimization, anonymized participant IDs, no raw face video retained.
- GDPR-style handling if any participant is in the EU. Store consent records separately from gaze data.
- Publish a **datasheet** (§10.3) for the dataset.

### 3.4 Label generation
- Per-stimulus, per-duration fixation sets → density maps with a Gaussian of **σ = 1° visual angle** (`ppd`-derived per session), plus the raw fixation points (needed for NSS, AUC, NLL).
- Keep individual-participant maps so the noise ceiling and variance can be computed.
- Annotate **AOIs and roles** (headline, subhead, body, CTA, logo, image, person, icon, decoration) with a tool, double-annotated on a subset, inter-annotator agreement reported.

### 3.5 Synthetic and controlled stimuli
- Programmatically generated layouts that vary one factor at a time (size, contrast, position, color, text direction, repetition). Used for **diagnostic tests and unit-level model checks** (does RTL shift the first fixation to the right?), not for headline accuracy numbers.
- Never mix synthetic stimuli into the benchmark test set.

### 3.6 Pseudo-labeling (Tier P)
- Collect unlabeled screenshots and posters (check terms of use). Label with a teacher ensemble. Train the student on `real + pseudo`, keeping pseudo-label weight low and ramping it. Evaluate only on real gaze data.

### 3.7 Splitting rules (leakage control)
- Split **by group**: same website/brand/campaign/designer never appears in more than one split. Near-duplicate detection (perceptual hash plus embedding similarity) before splitting.
- Three locked sets: `train`, `val` (tuning), `test` (touched once per release). Plus a **private holdout** of fresh Arabic/RTL designs created after model selection.

### 3.8 Augmentation
- Photometric: mild brightness/contrast/saturation/hue shifts and compression artifacts, bounded so they don't change the attention-relevant contrast.
- Geometric: scale and crop with aspect-ratio-aware padding. Avoid heavy crops that remove layout context.
- **Horizontal flip is NOT free.** Reading order and gaze priors differ between LTR and RTL. Flip only for natural images. For UI/poster, treat flipping as a hypothesis to test as an *RTL-synthesis* augmentation, and keep it only if validation on real RTL data improves.
- Resolution jitter (UI screenshots arrive at many sizes).

---

## 4. Model architecture

### 4.1 Overview

```
image (+ optional OCR/layout inputs)
   │
   ├─► Backbone encoder (pretrained, multi-scale features)
   ├─► Text branch (text-region detector + script-aware features)
   ├─► Layout/element branch (element masks, roles, hierarchy)
   └─► Hand-crafted channels from the Attentix engine (I, C, O, SR, FT, U, P, CL, T, FA, S)
                         │
                 Fusion transformer / conv decoder  ◄── conditioning tokens
                         │                              (UI type, script dir, duration, task)
       ┌─────────────────┼─────────────────────┬──────────────────┐
   Saliency head     Importance head     Scanpath head     Role / AOI head
   (log-density)     (optional)          (sequence model)  (element roles)
                         │
                 Uncertainty (ensemble / MC)
```

### 4.2 Backbone (choose by experiment, not belief)

| Candidate | Why | Risk |
|---|---|---|
| DINOv2 ViT | Strong dense features, good object and layout awareness | Heavy; patch-size resolution limits |
| CLIP / SigLIP ViT | Semantic and text-aware features (reads text-like structure) | Weaker dense localization |
| ConvNeXt / Swin | Efficient multi-scale features | Less semantic than large ViTs |
| ResNet / VGG | Classic baselines used in DeepGaze-type models | Lower ceiling |

Run the **backbone bake-off** on `val`: each backbone with the same readout, report IG, NSS, CC, sAUC, latency. Final model SHOULD be an **ensemble of 2 to 4 diverse backbones** (convolutional plus transformer), which is the pattern behind the strongest published saliency models. Verify each backbone's license for commercial use.

### 4.3 Text and layout branches
- **Text detector/recognizer** that supports Arabic and Latin (verify the chosen library's script coverage and license). Provide the model with text-region masks, estimated cap height, contrast, and **script direction**. Do not require OCR for the saliency path; use text regions as features.
- **Element parser** that proposes UI elements (buttons, inputs, images, icons, text blocks) and assigns roles. Can start with a segmentation or detection model and be refined on your annotations. Feeds the AOI head and the importance head.

### 4.4 Hand-crafted channels as inputs and as an interpretable baseline
- The Attentix engine's channels enter as additional input planes, so the network can learn *when to trust them*. This also gives you a model that degrades gracefully and an interpretable fallback.
- Keep the **logistic-fusion hand-crafted model** as a permanent baseline in every benchmark table. The deep model must beat it by a margin, otherwise the extra complexity isn't justified.

### 4.5 Readout (probabilistic, DeepGaze-style)
- Output **unnormalized log-density** `s(x,y)`, normalized by softmax over pixels: `log p = s − logsumexp(s)`.
- Include a **learned center-bias / layout prior** as a separate, conditioned term (conditioned on UI type and script direction), so the main network doesn't have to re-learn priors.
- Train with fixation log-likelihood plus map-matching losses (§7.2).

### 4.6 Conditioning
Inject `{ui_type, script_dir, duration, task}` via FiLM or cross-attention tokens at multiple decoder stages. Include a "unknown" token (dropout over conditions during training) so the model works when a user doesn't specify.

### 4.7 Scanpath head
- Phase 2 module. Option A: DeepGaze III-style conditional density given previous fixations. Option B: autoregressive transformer over (x, y, duration-bin) tokens. Evaluate with MultiMatch / ScanMatch / DTW against human scanpaths (§8.4). If it doesn't beat the winner-take-all-with-inhibition-of-return baseline from the hand-crafted engine, ship the baseline and label it a model.

### 4.8 Student model for the browser
- Distill the ensemble into a small student (MobileNet/EfficientNet/ConvNeXt-tiny class), exported to ONNX and run in the Web Worker via WASM or WebGPU.
- Report student-vs-teacher metric retention and latency on a stated device. If the student loses too much, offer two tiers: "Fast (browser)" and "Accurate (server)".

---

## 5. Input pipeline

- Fixed **long-side resolution buckets** (e.g., 384, 512, 768) with aspect-ratio-preserving padding using reflection or neutral fill (never zeros that create fake borders; border artifacts caused a spurious corner hotspot in an earlier prototype).
- Targets resized with the same transform, then renormalized to sum to 1.
- Store the original size and `ppd` per sample so σ and metrics can be computed in degrees.
- Cache decoded tensors and precomputed hand-crafted channels (they are deterministic).

---

## 6. Learning objectives and calibration

### 6.1 Loss

```python
import torch, torch.nn.functional as F

def pearson(a, b, eps=1e-8):
    a = a - a.mean(1, keepdim=True); b = b - b.mean(1, keepdim=True)
    return (a * b).sum(1) / (a.norm(dim=1) * b.norm(dim=1) + eps)

def saliency_loss(logits, gt_density, gt_fix, w):
    """
    logits:      B,1,H,W   raw scores s(x,y)
    gt_density:  B,1,H,W   human density, sums to 1 per image
    gt_fix:      B,1,H,W   binary fixation mask (all participants pooled)
    w:           dict of loss weights {kl, cc, nss, nll}
    """
    B = logits.shape[0]
    s = logits.flatten(1)
    logp = F.log_softmax(s, dim=1)                       # log-density over pixels
    p = logp.exp()
    q = gt_density.flatten(1)
    q = q / q.sum(1, keepdim=True).clamp_min(1e-8)
    fix = gt_fix.flatten(1)
    nfix = fix.sum(1).clamp_min(1.0)

    kl  = (q * (q.clamp_min(1e-8).log() - logp)).sum(1)             # KL(q || p)
    cc  = pearson(p, q)
    z   = (p - p.mean(1, keepdim=True)) / p.std(1, keepdim=True).clamp_min(1e-8)
    nss = (z * fix).sum(1) / nfix
    nll = -(fix * logp).sum(1) / nfix                               # fixation NLL

    return (w["kl"] * kl + w["cc"] * (1 - cc) - w["nss"] * nss + w["nll"] * nll).mean()
```

Start with weights such as `kl=1.0, cc=0.5, nss=0.1, nll=0.5` *(planning heuristic)*, then tune on `val` for **information gain**, the metric that unifies the others. Report all metrics regardless of which one you optimize.

### 6.2 Multi-duration and multi-task
- One shared encoder, duration-conditioned decoder. Optional auxiliary losses: importance map, element-role classification, "text vs non-text" segmentation (helps the model learn that text attracts attention differently from images).

### 6.3 Class and domain balance
- Sample batches balanced across `ui_type × script_dir × density` so that the large natural-image sets and LTR-dominant data don't swamp RTL and poster data. Log per-stratum metrics every epoch.

### 6.4 Regularization
- Weight decay, dropout in the readout, stochastic depth (for ViTs), EMA of weights, early stopping on `val` IG.

### 6.5 Uncertainty and calibration
- **Ensemble disagreement** (different backbones/seeds) plus optional MC-dropout gives per-pixel and per-AOI variance.
- AOI shares reported as `share ± interval`.
- **Calibration test:** bootstrap over human participants to obtain a human confidence interval for each AOI share. Measure how often the model's interval overlaps the human interval, and the correlation of predicted vs human share. Publish reliability diagrams for AOI shares.

### 6.6 Explainability
- **Occlusion/ablation per element:** mask or inpaint an element, measure change in predicted share of the others (cheap, model-agnostic, directly answers "if I make this button bigger, what changes?").
- **Gradient-based attribution** (integrated gradients) mapped to input regions and to hand-crafted channels.
- Report, per AOI, its top contributing channels and elements. This also defends against the "black box" objection.

---

## 7. Training recipe

### 7.1 Stages

| Stage | Data | Goal | Notes |
|---|---|---|---|
| **S0** | none | Pretrained backbones | Frozen at first |
| **S1** | Tier B (SALICON-style) | Learn general saliency structure | Large and cheap; proxy gaze, so keep the learning rate modest |
| **S2** | Tier S natural (MIT1003, CAT2000, OSIE) | Match real gaze statistics | Also provides public-benchmark numbers |
| **S3** | Tier S UI (UEyes, FiWI, UMSI) | Domain adaptation to UI/poster/web | Where most of the UI gain comes from |
| **S4** | Tier G (own data) | Arabic/RTL, French, current styles | Small learning rate, strong regularization |
| **S5** | Distillation (teacher ensemble → student, plus Tier P) | Browser-size model | Evaluate on real data only |

### 7.2 Optimization defaults *(planning heuristics, tune)*
- AdamW, mixed precision, gradient clipping.
- Backbone learning rate roughly 10× lower than head; **layer-wise learning-rate decay** for ViTs.
- Cosine schedule with warmup; freeze the backbone for the first epochs of each new stage, then unfreeze.
- Batch composition by stratum (§6.3). EMA of weights for evaluation.
- Multiple seeds for the final configuration. Report mean ± std, not the best seed.

### 7.3 Config (single source, versioned)

```yaml
run:
  name: attentix-v1-bakeoff
  seed: [1, 2, 3]
data:
  train_sets: [salicon, mit1003, cat2000, ueyes_train, own_train]
  val_sets:   [ueyes_val, own_val]
  group_split: true            # no site/brand leakage
  resolution: 512
  strata: [ui_type, script_dir, density]
model:
  backbones: [dinov2_vitb, convnext_base]   # verify licenses
  hand_crafted_channels: [I, C, O, SR, FT, U, P, CL, T, FA, S]
  conditioning: [ui_type, script_dir, duration]
  center_bias: learned_conditioned
loss:
  kl: 1.0
  cc: 0.5
  nss: 0.1
  nll: 0.5
optim:
  name: adamw
  lr_head: 1.0e-4
  lr_backbone: 1.0e-5
  layer_decay: 0.75
  weight_decay: 0.05
  epochs: 40
  warmup_epochs: 2
  ema: 0.999
eval:
  metrics: [ig, nss, cc, sim, kl, auc_judd, sauc]
  noise_ceiling: true
  per_stratum: true
```

### 7.4 Hyperparameter search
- Small, budgeted search over loss weights, learning rates, and resolution, scored on `val` IG. Freeze the search space before looking at `test`. No tuning on `test`, ever.

### 7.5 Compute
- Plan GPU hours from a measured throughput on the pilot and a stated epoch count. The ensemble multiplies cost, so run the backbone bake-off with short schedules first. Record GPU type and wall-clock in each run's metadata.

---

## 8. Evaluation suite (what the model is judged on)

### 8.1 Human noise ceiling
- **Inter-observer ceiling:** predict each participant's fixations from the average of the others (leave-one-out or split-half) and compute the same metrics. Report model scores both in absolute terms and **as a fraction of the ceiling**. That is the honest way to say "how close to human consistency."

### 8.2 Map metrics (always report all)
`Information Gain (vs. center-bias baseline)`, `NSS`, `CC`, `SIM`, `KL`, `AUC-Judd`, `shuffled AUC (sAUC)`. IG is the preferred headline metric because it puts the model on a log-likelihood scale where the others can be related.

### 8.3 AOI-level metrics (what customers actually use)
- Spearman correlation of predicted vs human **AOI share** across elements.
- Mean absolute error of AOI share (in percentage points).
- **Top-1 AOI accuracy**: does the model pick the same most-attended element as humans?
- **First-fixation AOI hit rate** (from 1s data).
- Rank-order agreement on pairs (headline vs CTA vs logo), the failure mode seen in the prototype screenshots.

### 8.4 Scanpath metrics
MultiMatch, ScanMatch, DTW, and first-fixation location error, versus human scanpaths and versus the winner-take-all baseline.

### 8.5 Element-role metrics
Precision/recall per role on the annotated test set. A role-label error (e.g., a headline labeled "product name") is a product bug even when the map is right, so evaluate roles separately.

### 8.6 Robustness and invariance tests
- Brightness, JPEG quality, rescale, mild blur, screenshot-chrome presence, dark vs. light theme (inverted copies), color-blind simulation, language swap on identical layouts.
- Controlled-stimulus checks (§3.5): size, contrast, position, RTL vs LTR, repeated items. Expected directions of effect must match the human literature or your own gold data.
- Failure-case suite: low-contrast large text, outline fonts, dark glass panels over busy wallpaper, black-and-white photos of people, tiny icons next to text, repeated rows, border artifacts. Each is a named test with an expected rank order.

### 8.7 Fairness and coverage reporting
Per-stratum tables: UI type, script direction, text density, color scheme. Flag any stratum more than a set margin below the average and block release until explained.

### 8.8 Statistics
Bootstrap confidence intervals **over images** (and over participants for human-referenced numbers); paired tests for model comparisons. A claimed improvement without a confidence interval does not count.

### 8.9 Baselines in every table
Center-bias only, hand-crafted logistic fusion (the Attentix engine), each single channel, a published open model (e.g., UMSI++ on UEyes, if licensing allows), and the previous release.

---

## 9. Attentix-Bench (how to become the reference)

1. **Content:** a locked test set with real eye-tracking maps and AOI annotations across UI types and scripts, plus the controlled-stimulus diagnostic suite.
2. **Protocol document:** exact preprocessing, metrics, AOI definitions, and how to compute noise ceilings.
3. **Open evaluation script:** one command, deterministic, outputs a JSON report and a markdown table.
4. **Leaderboard:** predictions submitted as maps; evaluation run on a held-out set whose maps are not released (to prevent tuning on test).
5. **Public baselines:** center bias, hand-crafted fusion, UMSI++-style, your model. Honest results where you lose too.
6. **Release license:** state clearly what is open (evaluation code, protocol, a public subset) and what is private (the locked set).
7. Invite other vendors and academics to submit. A benchmark others use is the real standard.

---

## 10. MLOps, reproducibility, documentation

### 10.1 Repository layout
```
attentix-model/
  configs/                 # YAML, one file per experiment
  data/
    raw/ processed/        # DVC-tracked, never committed raw
    splits/                # group-split manifests with hashes
  src/
    datasets/              # loaders, transforms, label generation
    models/                # backbones, branches, heads, conditioning
    losses/ metrics/ calibration/ explain/
    train.py eval.py distill.py export_onnx.py
  bench/
    attentix_bench/        # protocol + eval script + diagnostics
    results/               # JSON per run, linked to config hash
  tests/                   # unit + property + golden-image tests
  docs/                    # model card, datasheet, protocol
```

### 10.2 Tracking and gating
- Data and model versioning (DVC or equivalent), experiment tracking (MLflow or W&B), config-hash in every result file.
- CI: unit tests, a small smoke-evaluation, golden-image rank-order tests, and a **regression gate** on `val` IG and per-stratum metrics.
- A model is promoted only through the registry, with evaluation JSON attached.

### 10.3 Documents (publish with each release)
- **Model card:** intended use, non-goals, training data summary, metrics with confidence intervals, per-stratum results, known failure modes, uncertainty behavior, license.
- **Datasheet** for each own dataset: collection protocol, demographics, consent, QC thresholds, splits, known biases.
- **Changelog** with metric deltas.

### 10.4 Deployment and monitoring
- Version in every API response (`engineVersion`, `modelVersion`, `configHash`).
- Latency and memory budgets per tier; track on real devices.
- Drift monitoring on incoming design types (embedding distance to training distribution). Flag out-of-distribution images in the UI ("low confidence: unusual layout").
- Feedback loop: opt-in user corrections and, where available, real behavior data (scroll/click maps) used for *validation studies*, not as attention labels.

---

## 11. Integration with the Attentix app

- The deep model replaces the learned channel `L` in the current pipeline at first, with the hand-crafted engine remaining the fallback and the source of explanations.
- Output contract stays: `saliencyRaw`, per-channel contributions, AOIs with shares and intervals, predicted scanpath (labeled as predicted), warnings (low-information, out-of-distribution).
- UI additions: confidence indicators on AOI shares, "model: fast / accurate" switch, mode and script direction shown explicitly, a "what would change this?" panel driven by the occlusion analysis.

---

## 12. Risks and honest limits

| Risk | Mitigation |
|---|---|
| Public data is natural-image or LTR heavy | Own RTL/multilingual gold data, stratified training, per-stratum release gates |
| Proxy data (mouse) distorts what the model learns | Use only for pretraining; validate on lab data |
| Overfitting to a few screenshots | Group splits, locked test, golden tests are rank-order only |
| Pseudo-label feedback loops | Keep pseudo weight small, never evaluate on pseudo data |
| License problems (data or weights) | License audit before any dataset or backbone is adopted |
| Free-viewing vs real tasks | State scope; add task conditioning later with task-driven data |
| Marketing pressure to claim "96% accuracy" | Report IG/NSS/CC with intervals and % of human ceiling; define "accuracy" or don't use the word |
| Participant privacy | Consent, anonymization, no retained face video, separate consent records |

---

## 13. Roadmap and acceptance criteria

| Phase | Deliverable | Done when |
|---|---|---|
| **P0 Foundations** | Repo, config system, data loaders, metric suite with unit tests, noise-ceiling code | Metrics verified against a reference implementation on a public set |
| **P1 Baselines** | Reproduce a published baseline on UEyes; evaluate the hand-crafted engine on the same split | Baseline table with CIs exists |
| **P2 Bake-off** | Backbone and loss comparison, conditioned model, per-stratum reports | Best config beats hand-crafted fusion on test IG, NSS, CC with non-overlapping CIs |
| **P3 Own data** | Pilot collection (§3.3), noise ceiling measured, S4 fine-tune | RTL and Arabic strata reported separately and above the baselines |
| **P4 Calibration and explanations** | Ensemble uncertainty, AOI intervals, occlusion explanations | Calibration plots published; AOI Spearman and top-1 accuracy reported |
| **P5 Distillation and deploy** | Browser-size student, ONNX in Web Worker | Student retains a stated fraction of teacher IG at a stated latency |
| **P6 Scanpath** | Scanpath head, evaluated against humans | Beats the inhibition-of-return baseline on MultiMatch/ScanMatch or is not shipped |
| **P7 Benchmark and paper** | Attentix-Bench public, technical report or paper, model card, datasheet | Independent party reproduces headline numbers |

### Definition of "world class" for this project
1. Best or tied-best on UI/poster test data among models you can legally evaluate, with confidence intervals.
2. At or near the human noise ceiling on AOI-level agreement.
3. Per-stratum parity, including Arabic/RTL.
4. Calibrated uncertainty and explanations.
5. Reproduced by someone outside the team.

---

## 14. Immediate next steps (first two weeks)

1. Verify licenses and download UEyes (and FiWI, MIT1003 if allowed). Build the group-split manifests.
2. Implement the metric suite and noise-ceiling code; test against known reference values.
3. Reproduce the UEyes UMSI++ baseline (or the closest available model) and score the Attentix hand-crafted engine on the same split. This gives the first honest accuracy numbers for the project.
4. Run the first backbone bake-off with short schedules.
5. Write the stimulus list and ethics plan for the pilot data collection (including Arabic and French designs).
6. Add the failure-case suite (low-contrast large text, outline fonts, dark glass panels, black-and-white people, tiny icons, repeated rows, border artifacts) as named tests with expected rank orders. <runtime_info>In case you're asked: you are running in T3 Code through the Antigravity harness, as gemini-3.8-flash. No need to mention this otherwise. You can embed images, video, and audio in your response using Markdown image syntax with absolute file paths. Link any other file you produce using its absolute path so the user can open it in T3 Code's files viewer.</runtime_info>

<pull_request_linking>
Link each PR you create, take over, or push to: one link_pull_request per PR, full URL, every stack layer, as your next call. Host tools do not link for you. If linking fails, say so. Skip PRs you only read or review, and PRs named only as background. Call watch_pull_request when asked to monitor or babysit, or when work you were asked to do, such as a merge, still waits on checks or reviews, even after an earlier unwatch. Finish any needed branch update and push first, then watch and end your turn. Otherwise act now or hand back. Delegated children never watch, even if the brief says babysit. After PR work, a child's last line is: PR <full URL>, head <SHA>, checks and reviews <state>. Links and watches persist across pushes. Never wait with sleep, loops, gh --watch, Monitor, or ScheduleWakeup. Before handback, call unwatch_pull_request on any PR you watch.
</pull_request_linking>
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-11-02T06:04:03+01:00.
</ADDITIONAL_METADATA>
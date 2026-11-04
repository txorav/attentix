<USER_REQUEST>
add this as an option if you want this kind of thing 
# Attentix: Mathematical Model of Visual Attention (Algorithm Spec)

**What this is:** a precise, implementable formula for predicting where people look in a static image from measurable image factors (contrast, color, size, position, text, faces, rarity, repetition, and so on), plus the algorithm that computes it.
**What this is not:** a proven law. It is a *model*. Its structure comes from established vision science (feature integration, center-surround contrast, spectral and information-theoretic saliency, softmax fixation models). Its numeric parameters MUST be fitted on human fixation data before any accuracy claim.

---

## 0. The model in one equation

Every pixel `x` gets an additive **attention score** built from image factors. A softmax turns scores into a probability distribution over fixation locations.

$$
s(x)=\underbrace{\sum_{k\in\mathcal K} w_k\,\Phi_k(x)}_{\text{main factors}}
+\underbrace{\sum_{(k,l)\in\mathcal P} w_{kl}\,\Phi_k(x)\Phi_l(x)}_{\text{interactions}}
+\underbrace{w_c\,\mathrm{CB}(x)+w_r\,\mathrm{RP}(x)}_{\text{position priors}}
+\underbrace{\log r(x)}_{\text{repetition}}
$$

$$
p(x\mid I,c)=\frac{\exp\!\big(\tilde s(x)\big)}{\sum_{y}\exp\!\big(\tilde s(y)\big)},\qquad \tilde s = G_{\sigma_f} * s
$$

- `I` is the image, `c` the context (UI type, script direction, viewing duration).
- `Φ_k(x) ∈ [0,1]` are normalized factor maps (§3 and §4).
- `G_{σ_f}` is a Gaussian blur with `σ_f ≈ 1°` of visual angle, applied to the **score** (log-density), which makes neighboring pixels cooperate.
- `p` sums to 1 over the image: **attention is zero-sum**. Making one element stronger takes share from every other element. This is the property that lets the model answer "what happens to the CTA if I enlarge the headline?"

**Why a softmax (and not a per-pixel sigmoid):** a fixation lands on exactly one place, so fixation location is a categorical distribution over pixels. A constant added to every score (such as an intercept) cancels in the softmax, so **there is no intercept** in `s`. Only differences between pixels matter.

---

## 1. Notation

| Symbol | Meaning |
|---|---|
| `x=(i,j)` | Pixel at working resolution (long side ≈ 640 px by default) |
| `N` | Number of pixels |
| `u,v ∈ [0,1]` | Normalized horizontal and vertical coordinates (`v=0` at top) |
| `ppd` | Pixels per degree of visual angle (config; default 1° ≈ 2.5% of the long side) |
| `L*, a*, b*` | CIE Lab channels of `I` |
| `G_σ` | 2D Gaussian kernel with std `σ` |
| `⊖` | Across-scale difference (coarser level upsampled, then subtracted) |
| `med, MAD` | Median and median absolute deviation |
| `σ(t)=1/(1+e^{-t})` | Logistic sigmoid |
| `p`, `P_A` | Attention density, and attention share of region `A` |

---

## 2. Preprocessing

### 2.1 Color to Lab (needed so that "distance in numbers" approximates "distance in perception")

Gamma removal for each sRGB channel `c ∈ [0,1]`:

$$
c_{\text{lin}}=\begin{cases} c/12.92 & c\le 0.04045\\ \big((c+0.055)/1.055\big)^{2.4} & \text{otherwise}\end{cases}
$$

Linear RGB to XYZ (D65):

$$
\begin{pmatrix}X\\Y\\Z\end{pmatrix}=
\begin{pmatrix}0.4124&0.3576&0.1805\\0.2126&0.7152&0.0722\\0.0193&0.1192&0.9505\end{pmatrix}
\begin{pmatrix}R_{\text{lin}}\\G_{\text{lin}}\\B_{\text{lin}}\end{pmatrix}
$$

With white point `(X_n,Y_n,Z_n)=(0.95047, 1, 1.08883)` and

$$
f(t)=\begin{cases}t^{1/3}& t>(6/29)^3\\ \dfrac{t}{3(6/29)^2}+\dfrac{4}{29}&\text{otherwise}\end{cases}
$$

$$
L^*=116f(Y/Y_n)-16,\quad a^*=500\big(f(X/X_n)-f(Y/Y_n)\big),\quad b^*=200\big(f(Y/Y_n)-f(Z/Z_n)\big)
$$

Resize in **linear light** with area averaging, before converting to Lab. Composite transparency onto a declared background first.

### 2.2 Derived quantities

- Chroma and hue: `C = √(a*² + b*²)`, `h = atan2(b*, a*)`.
- Relative luminance for text contrast: `Y_rel = Y` (from §2.1).
- Distances: `ΔE*ab = √(ΔL*² + Δa*² + Δb*²)` (default, cheap) or CIEDE2000 `ΔE₀₀` (more accurate for small differences; use the published standard formula).
- Gaussian pyramid: `G_0 = channel`, `G_{ℓ+1} = ↓₂( G_{σ=1} * G_ℓ )`, `ℓ = 0..8`.

---

## 3. Factor maps `F_k` (the physics-of-looking part)

Each factor is a map over pixels. IDs: **I, C, O, M, SR, FT, U, P, SH** (dense, computed everywhere) and **CL, T, FA, FG, S** (object-level, sparse).

### 3.1 Luminance contrast, `I` (center-surround, Itti–Koch)

Center scales `c ∈ {2,3,4}`, surround `s = c + δ`, `δ ∈ {3,4}`:

$$
I(c,s)=\big|\,G_c^{L^*}\ominus G_s^{L^*}\big|,\qquad
F_I=\sum_{c}\sum_{\delta} \mathcal N\big(I(c,c+\delta)\big)
$$

(`𝒩` is the Itti normalization in §4.2.) Intuition: a pixel is salient when it differs from its larger neighborhood, at several spatial scales.

### 3.2 Color contrast, `C` (opponent colors)

Treat `a*` (red-green) and `b*` (blue-yellow) as opponent channels:

$$
C(c,s)=\big|G_c^{a^*}\ominus G_s^{a^*}\big|+\big|G_c^{b^*}\ominus G_s^{b^*}\big|,\qquad F_C=\sum_{c,\delta}\mathcal N\big(C(c,c+\delta)\big)
$$

Optionally add the local perceptual distance between the center color and the ring-averaged surround color, `ΔE₀₀(center, surround)`.

### 3.3 Orientation, `O` (edge direction pops out among different directions)

Gabor filter at angle `θ`:

$$
g_\theta(x,y)=\exp\!\Big(-\frac{x'^2+\gamma^2 y'^2}{2\sigma^2}\Big)\cos\!\Big(\frac{2\pi x'}{\lambda}\Big),\quad
\begin{aligned}x'&=x\cos\theta+y\sin\theta\\ y'&=-x\sin\theta+y\cos\theta\end{aligned}
$$

$$
O_\theta^{\ell}=\big|G_\ell^{L^*}*g_\theta\big|,\qquad F_O=\sum_{\theta\in\{0^\circ,45^\circ,90^\circ,135^\circ\}}\ \sum_{c,\delta}\mathcal N\big(|O_\theta^{c}\ominus O_\theta^{c+\delta}|\big)
$$

### 3.4 Surround-statistics saliency, `M` (a unified contrast measure)

Let `f(x) ∈ ℝ^d` stack local features, for example `(L*, a*, b*, |∇L*|, orientation energies)`. Estimate the mean `μ_s(x)` and covariance `Σ_s(x)` of `f` over a surround ring around `x` (radius `≈ 3–5` foveal radii). Then

$$
F_M(x)=\sqrt{\big(f(x)-\mu_s(x)\big)^{\!\top}\,\Sigma_s(x)^{-1}\,\big(f(x)-\mu_s(x)\big)}
$$

(Mahalanobis distance; add `λI` to `Σ_s` for stability.) This captures that a feature value is conspicuous only relative to how variable its surroundings are: a pink dot among slightly varied pinks pops out, a pink dot in a busy multicolor area does not.

### 3.5 Spectral residual, `SR` (global "surprise" in the frequency domain)

On a 64-px-wide grayscale version `L`:

$$
\mathcal A(f)=|\mathcal F[L]|,\quad \mathcal P(f)=\angle\mathcal F[L],\quad
R(f)=\log\mathcal A(f)-h_n*\log\mathcal A(f)
$$

$$
F_{SR}=G_{\sigma}*\Big|\mathcal F^{-1}\!\big[\exp\!\big(R+i\mathcal P\big)\big]\Big|^2
$$

(`h_n` is an `n×n` mean filter; `n=3`.) Upsample to working resolution.

### 3.6 Frequency-tuned saliency, `FT` (whole-object differences from the global mean)

$$
F_{FT}(x)=\big\|\ I_\mu-I_{\omega}(x)\ \big\|_2,\quad I_\mu=\text{mean Lab of the image},\ I_\omega=G_{\approx5\times5}*\text{Lab}
$$

### 3.7 Global color rarity, `U` (information-theoretic uniqueness)

Soft-assign each pixel to the two nearest Lab histogram bins; `P(b)` = fraction of image mass in bin `b`. Then

$$
F_U(x)=-\log P\big(b(x)\big)\quad\text{(self-information, in nats)}
$$

Optionally blend with the distance-weighted form `U_dist(b)=Σ_j P(j)·ΔE(b,j)`. **Background discount:** bins whose pixels cover at least a fraction `β_bg` of the image border are flagged as background and `F_U` is capped there to a small constant.

### 3.8 Chroma pop-out, `P`

With `C̄_ring(x)` = mean chroma in a ring surround:

$$
F_P(x)=\frac{\big|C(x)-\bar C_{\text{ring}}(x)\big|}{\bar C_{\text{ring}}(x)+\varepsilon}\cdot\sigma\!\big(\kappa(C(x)-C_{\min})\big)
$$

The sigmoid gate removes near-gray noise where chroma is tiny. Add a hue-distance term `d_h = min(|h−h̄|, 2π−|h−h̄|)/π` weighted by chroma when chroma is similar but hue differs.

### 3.9 Sharpness contrast, `SH` (in-focus subjects attract; blurred backgrounds do not)

Local sharpness `q(x) = Var_{window}[∇²L*]` (variance of the Laplacian):

$$
F_{SH}(x)=\max\!\Big(0,\ \ln\frac{q(x)+\varepsilon}{\bar q_{\text{ring}}(x)+\varepsilon}\Big)
$$

### 3.10 Object-level factors (sparse, already in `[0,1]`)

**Cluster / blob response `CL`.** Segment into same-color connected components `i` (quantized Lab, 8-connectivity). For component `i` with area `A_i`, perimeter `P_i`, border-touching ratio `b_i`, and surround color contrast `ΔE_i`:

$$
\mathrm{CL}_i=\underbrace{\exp\!\Big(-\frac{(\ln A_i-\mu_A)^2}{2\sigma_A^2}\Big)}_{\text{size tuning (mid-size objects)}}
\cdot\underbrace{\Big(\tfrac{4\pi A_i}{P_i^2}\Big)^{\gamma}}_{\text{compactness}}
\cdot\sigma(\kappa_\Delta(\Delta E_i-\tau_\Delta))
\cdot(1-b_i)^{\beta}
$$

Components under `A_min` pixels get `CL_i=0`. Paint `CL_i` over the component's mask. The size tuning keeps huge uniform backgrounds from winning.

**Text `T`.** For each validated text line `j` (stroke-width variance low, geometry text-like, not periodic): cap height `h_j` (pixels), contrast ratio `CR_j` between foreground and background:

$$
CR_j=\frac{Y_{\text{light}}+0.05}{Y_{\text{dark}}+0.05},\qquad
q_j=\sigma\!\big(\kappa_h(\ln h_j-\ln h_0)\big)\cdot\sigma\!\big(\kappa_c(\ln CR_j-\ln CR_0)\big)\cdot(1-\rho_j)
$$

with `ρ_j ∈ [0,1]` a periodicity penalty. `T(x)=q_j` inside line `j`'s box (max over overlapping lines), else 0. **Soft gates only:** large low-contrast text still gets a nonzero `q_j`, which fixes the failure where big faint headlines received zero attention.

**Faces and people `FA`.** From a detector with boxes `j` (center `c_j`, size `s_j`, confidence `π_j`):

$$
F_{FA}(x)=\max_j\ \pi_j\exp\!\Big(-\frac{\|x-c_j\|^2}{2(0.5\,s_j)^2}\Big)
$$

The detector MUST work on grayscale photos (skin-tone masks do not).

**Figure-ground / container `FG`.** For detected closed containers (rounded rectangles, panels, cards) with area fraction in a plausible range and internal structured content: `FG(x)=ξ_j` inside container `j`, where `ξ_j` increases with edge strength on the boundary and with the contrast between the container and its surroundings, else 0.

**Shape / contour `S`.** `S(x)=G_σ * ‖∇L*‖` (Scharr magnitude), kept as a weak term. Its orientation entropy is used for load (§7.4).

---

## 4. Normalization

### 4.1 Dense factors (robust z-score, then bounded)

$$
z_k(x)=\frac{F_k(x)-\operatorname{med}(F_k)}{1.4826\,\operatorname{MAD}(F_k)+\varepsilon},\qquad
\Phi_k(x)=\operatorname{clip}\!\Big(\frac{z_k(x)}{z_{\max}},\,0,\,1\Big),\quad z_{\max}\approx 6
$$

**Flat-image guard:** if `MAD(F_k) < ε_f` **or** `p99(F_k) − p1(F_k) < Δ_min`, set `Φ_k ≡ 0`. A uniform image then has `s ≡ const`, so `p` is flat and the report carries `lowInformation=true`.

### 4.2 Itti map normalization `𝒩` (used inside §3.1–3.3)

Scale the map to `[0,1]`, let `m̄` be the mean of its local maxima excluding the global one:

$$
\mathcal N(M)=M\cdot(1-\bar m)^2
$$

This promotes maps with a few strong peaks and demotes maps with many equal peaks.

### 4.3 Sparse object-level factors

`CL, T, FA, FG, S` are **not** z-scored: they are already in `[0,1]` by construction, and for sparse maps `MAD` is typically 0 (most pixels are zero), so a z-score or the flat-image guard would wrongly erase them. Apply the flat-image guard only to dense factors.

---

## 5. Priors and suppression terms

### 5.1 Center bias (log of an anisotropic Gaussian)

$$
\mathrm{CB}(x)=-\frac12\Big[\frac{(u-\mu_u)^2}{\sigma_u^2}+\frac{(v-\mu_v)^2}{\sigma_v^2}\Big]
$$

Adding `w_c·CB` to the score is equivalent to multiplying the density by a Gaussian. Parameters `(μ_u, μ_v, σ_u, σ_v)` are fitted per UI type, not hand-set.

### 5.2 Reading-direction prior

$$
\mathrm{RP}(x)=-\frac{v}{\tau_v}-\frac{u_d}{\tau_u},\qquad
u_d=\begin{cases}u&\text{LTR}\\1-u&\text{RTL}\end{cases}
$$

(a log-exponential decay from the reading start: top-left for LTR, top-right for RTL). Active in `ui-web`, `desktop-ui`, `ad-poster`; weight `0` in `natural`. Fit the weight per mode, and treat the RTL form as a hypothesis to validate on Arabic data.

### 5.3 Repetition suppression

Detect groups `g` of `n_g ≥ 3` near-identical elements at regular offsets. For every member `x ∈ g`:

$$
\log r(x)=\log r_{n_g},\qquad r_n=\max\!\big(r_{\min},\,n^{-\alpha}\big)
$$

The group's *total* share then grows like `n^{1-α}` (sublinear). Suppress **all** members, with no exempt first or last member. Default `α=0.5`, `r_min=0.4`, and both to be fitted.

---

## 6. Fusion, density, and fitting

### 6.1 Score and density

Use the master equation of §0. The factor set `𝒦`, interaction set `𝒫`, and weights depend on the mode `c ∈ {natural, ui-web, desktop-ui, ad-poster}`. Default interaction pairs: `(I,P)`, `(U,CL)`, `(T,I)`, `(FA,I)`.

**Constraint:** main-effect weights `w_k ≥ 0`. More contrast, saturation, or rarity MUST NOT reduce attention. Interactions are unconstrained but L2-regularized.

**Temperature:** scaling all weights by a constant is the same as changing the softmax temperature `τ`. When weights are fitted, no separate `τ` exists. When weights are set by hand, a `τ` is needed to control concentration (§9 shows the effect).

### 6.2 Fitting (maximum likelihood on human fixations)

Stack factors into `φ(x) ∈ ℝ^D`, so `s(x)=wᵀφ(x)+b(x)` with fixed prior terms in `b`. For images `m=1..M` with fixations `{x_{m,i}}`:

$$
\mathcal L(w)=-\frac1{\sum_m n_m}\sum_m\sum_{i=1}^{n_m}\log p_m(x_{m,i})+\lambda\|w\|^2
$$

Gradient (derived from the softmax; no autodiff needed):

$$
\frac{\partial \mathcal L}{\partial w}=\frac1{\sum n_m}\sum_m n_m\Big(\mathbb E_{p_m}[\varphi]-\bar\varphi^{\text{fix}}_m\Big)+2\lambda w,\qquad
\bar\varphi^{\text{fix}}_m=\frac1{n_m}\sum_i \varphi(x_{m,i})
$$

In words: *the fitted model makes the expected feature values under its own density equal the average feature values at the places humans actually looked.* The objective is **convex** in `w` (a log-sum-exp of linear scores), so there is a unique optimum. Solve with L-BFGS or projected gradient (projection for `w_k ≥ 0`). Because blur `G_{σ_f}` is linear in `s`, it can be folded into `φ` (blur the factor maps) so the same formulas hold.

Estimate `σ_f`, the size-tuning and gate parameters (`μ_A, σ_A, κ, τ_Δ, h_0, CR_0, …`) by validation-set search (they enter non-linearly), and the linear weights by the convex fit above.

### 6.3 Uncertainty (closed form)

At the optimum the Hessian is

$$
H=\frac1{\sum n_m}\sum_m n_m\,\operatorname{Cov}_{p_m}[\varphi]+2\lambda I
$$

Approximate the weight posterior as `w ~ 𝒩(ŵ, (H·Σn_m)^{-1})`. Sample weights, recompute shares, and report an interval for each AOI share. Validate these intervals against the participant bootstrap (they should cover human variability at the stated rate).

---

## 7. Derived outputs (all computed from `p`)

### 7.1 Attention share of a region `A`

$$
P_A=\sum_{x\in A}p(x)
$$

Region masks come from AOI extraction (§7.2) or from user-drawn boxes.

### 7.2 AOIs

Threshold `p` at percentile `q_{hi}` with hysteresis (`q_{lo}`, `q_{hi}`). Connected components. Merge two components only if the **valley depth** between them is small: `min(peak_1, peak_2) − max_{path} min_{x∈path} p(x)` below a threshold.

### 7.3 First-fixation distribution

$$
p_1(x)\propto p(x)\,\exp\big(w_{\text{start}}\,\mathrm{CB}(x)\big)
$$

(people tend to begin near the center, so the first fixation is shifted toward it).

### 7.4 Scanpath (predicted, not measured)

Potential `U_0 = p`. For `t = 1, 2, …`:

$$
x_t=\arg\max_x\ U_{t-1}(x)\cdot\exp\!\Big(-\frac{\|x-x_{t-1}\|^2}{2\sigma_{\text{sac}}^2}\Big)\quad(\text{for }t=1\text{ use }p_1)
$$

$$
U_t(x)=U_{t-1}(x)\Big(1-\eta\,\exp\!\Big(-\frac{\|x-x_t\|^2}{2\sigma_{\text{ior}}^2}\Big)\Big)
$$

The first factor is a saccade-amplitude prior (short jumps preferred). The second is inhibition of return (`σ_ior ≈ 1–1.5` foveal radii, `η≈0.9`). Stop when `max U_t < θ_stop · max U_0` (default `θ_stop≈0.15`); further points are low-confidence and MUST NOT be drawn as if equally likely. Break ties deterministically (lowest `y`, then `x`). **No dwell times are produced**, since the model has no basis to predict them; do not display any.

### 7.5 Concentration and clarity metrics

$$
H(p)=-\sum_x p(x)\ln p(x),\qquad \mathrm{Focus}=1-\frac{H(p)}{\ln N},\qquad M_{q}=\sum_{x\in\text{top }q\%}p(x)
$$

Also the Gini coefficient of `p`. Heuristic load indices (documented as heuristics, not measurements):

- Color load: `0.5·H_pal + 0.3·min(1, n_hues/H_ref) + 0.2·σ_C`, with palette entropy `H_pal = −Σ_j π_j ln π_j / ln K` over `K` color clusters of mass `π_j`.
- Shape load: `0.5·ρ_edge + 0.3·H_θ + 0.2·n_comp/n_ref`, with edge density `ρ_edge = mean[1(‖∇L*‖>t)]` and orientation entropy `H_θ`.
- Text load: `0.6·a_glyph + 0.25·n_lines/n_ref + 0.15·f_small` (glyph area fraction, line count, share of small text).
- Total load is the weighted mean; **Clarity** `= α(1−Load) + β·Focus + γ·P_{primary}`, with `α+β+γ=1`.

### 7.6 Duration conditioning (optional, to be fitted)

$$
s_d(x)=s_{\text{bottom-up}}(x)+\gamma(d)\,s_{\text{semantic}}(x),\qquad \gamma(1\text{s})<\gamma(3\text{s})<\gamma(7\text{s})
$$

where `s_semantic` collects text, faces, containers, and learned semantics; fit `γ(d)` on multi-duration data (for example UEyes, which has 1s, 3s, 7s maps). Treat the ordering as a hypothesis until fitted.

### 7.7 Learned term (when a model is available)

Add `w_L·Φ_L(x)` to the score, where `Φ_L` is a pretrained network's log-saliency, normalized like a dense factor. The rest of the math is unchanged, and `w_L` is fitted by the same convex procedure.

---

## 8. Algorithm (step by step)

```
INPUT: image I, mode c, script direction, config θ
1.  Decode, orient, composite alpha; resize in linear light to working res; compute ppd.
2.  Convert to Lab; build Gaussian pyramids for L*, a*, b*.
3.  Dense factors: F_I, F_C, F_O, F_M, F_SR, F_FT, F_U, F_P, F_SH.
4.  Object factors: segment components → CL; detect text → T; detect faces/people → FA;
    detect containers → FG; edge map → S.
5.  Normalize: Φ_k = robust-z + clip for dense factors (apply the flat guard);
    object factors used as-is.
6.  Detect repetition groups → log r(x).
7.  Build CB(x), RP(x) from mode, script direction.
8.  Assemble s(x) = Σ w_k Φ_k + Σ w_kl Φ_k Φ_l + w_c CB + w_r RP + log r.
9.  s̃ = G_{σ_f} * s;  p = softmax(s̃).
10. AOIs from p (hysteresis, valley-depth merge); shares P_A; intervals from §6.3.
11. First-fixation distribution; predicted scanpath (§7.4) with stop rule.
12. Concentration, load, clarity metrics (§7.5).
13. Per-pixel contribution breakdown: c_k(x) = w_k Φ_k(x) (and pair terms) for the inspector.
OUTPUT: p (raw), contributions, AOIs with shares and intervals, scanpath, metrics, warnings.
```

**Explainability is exact for this model:** because `s` is a sum of terms, the contribution of factor `k` at pixel `x` is `w_k Φ_k(x)`, and the log-odds of attention between two pixels is the difference of their scores. A hover inspector can show these numbers directly.

---

## 9. Worked toy example (illustrative numbers, not fitted)

Four regions in a 100,000-pixel image. Illustrative weights: `w_I=1.0, w_C=0.8, w_P=1.1, w_CL=1.2, w_T=1.2, w_U=0.8`. No interactions or priors, for clarity.

| Region | Pixels `N_r` | `Φ_I` | `Φ_C` | `Φ_P` | `Φ_CL` | `Φ_T` | `Φ_U` | Score `s_r` |
|---|---|---|---|---|---|---|---|---|
| Headline text | 6,000 | 0.7 | 0.3 | 0.2 | 0.4 | 0.9 | 0.5 | 3.12 |
| CTA button | 1,500 | 0.8 | 0.6 | 0.9 | 0.8 | 0.3 | 0.8 | 4.23 |
| Logo | 1,000 | 0.3 | 0.2 | 0.1 | 0.3 | 0.1 | 0.5 | 1.45 |
| Background | 91,500 | 0.05 | 0.05 | 0.05 | 0.05 | 0.05 | 0.05 | 0.305 |

Share of region `r`: `P_r = N_r e^{s_r/τ} / Σ_q N_q e^{s_q/τ}`.

| Temperature | Headline | CTA | Logo | Background |
|---|---|---|---|---|
| `τ = 1` | 37.0% | 28.1% | 1.2% | 33.8% |
| `τ = 0.5` | 29.7% | 68.5% | 0.2% | 1.6% |

What this teaches:
1. **Area matters.** At `τ=1`, a huge, nearly featureless background still collects a third of the attention just from its pixel count. Real fixation data pushes background scores far below object scores, so after fitting the effective temperature is much sharper. This is why weights and temperature must be **fitted, not guessed**.
2. **Competition.** If the CTA's score drops, its share moves to the headline and the background, not to nowhere.
3. **Sensitivity.** A small score gap becomes a large share gap at low `τ`, which is why a few percent of score error can flip which element ranks first. Report intervals.

---

## 10. Parameters

| Group | Parameters | Initial value | How determined |
|---|---|---|---|
| Geometry | working long side, `ppd`, `σ_f` | 640 px, 2.5% of long side, `≈ppd` | `σ_f` by validation search |
| Dense factors | pyramid scales, Gabor `(λ, σ, γ)`, ring radii, `z_max` | Itti defaults, `z_max≈6` | Validation search |
| Rarity | Lab bins, `β_bg` | 384 bins, 0.55 | Fixed, then checked by ablation |
| Cluster | `μ_A, σ_A, γ, β, A_min, τ_Δ` | peak ≈ 1% area, `A_min` ≈ 6 px | Validation search |
| Text | `h_0, CR_0, κ_h, κ_c`, periodicity threshold | validation-searched | Validation search; soft gates |
| Faces / containers | detector thresholds, `ξ` | detector defaults | Validation search |
| Priors | `μ_u, μ_v, σ_u, σ_v, τ_u, τ_v, w_c, w_r` | per mode | **Fitted** |
| Repetition | `α, r_min` | 0.5, 0.4 | Fitted or validation-searched |
| Weights | `w_k ≥ 0, w_kl` | none (fit) | **Convex ML fit (§6.2)** |
| Scanpath | `σ_sac, σ_ior, η, θ_stop` | fixation-radius based | Match human scanpath metrics |
| Load / clarity | formula weights | documented heuristics | Optionally calibrate to labeled pairs |

All initial values are starting points; none has been validated.

---

## 11. Invariants and tests that follow from the math

1. **Normalization:** `Σ_x p(x) = 1` and `p ≥ 0` for every image.
2. **Flat image:** a uniform image gives `max p / mean p ≤ 1.05` and `lowInformation=true`.
3. **Monotonicity:** raising `Φ_k` in a region (with `w_k ≥ 0`) never decreases that region's share.
4. **Zero-sum:** raising a region's score decreases every other region's share by the same *relative* factor.
5. **Additive contributions:** `s(x)=Σ` of the listed terms exactly (to numerical precision).
6. **Determinism:** identical input and config produce identical `p` (hash).
7. **Translation equivariance** (priors off): shifting an object shifts the peak by the same offset.
8. **Gradient check:** the analytic gradient of §6.2 matches finite differences on random data.
9. **Convexity check:** the fitted objective from random restarts converges to the same optimum.
10. **Sparse-factor survival:** a lone text line or face on a flat image is not zeroed by the flat guard.
11. **Repetition:** `n` identical elements get a total share that grows sublinearly with `n`, and no member is exempt.
12. **RTL mirror:** with the reading prior only, mirroring the layout and switching `LTR`↔`RTL` mirrors `p`.

---

## 12. Limits (state these in the product)

- Bottom-up and layout factors cannot capture **meaning** (a photo of two men, an ear icon, a headline's importance). Add the learned term `Φ_L` and the role/layout parser for semantics.
- **Task effects** (looking for a Wi-Fi network, a registration button) are outside free-viewing; they need task-conditioned data and a task term.
- Predicted **scanpaths** are plausible sequences, not individual gaze records.
- Fitted weights are valid for the **population and stimuli** they were fitted on. Report the mode and data behind every output.
- Attention share is not conversion likelihood.

---

## 13. Implementation notes

- Complexity: pyramids and filters are `O(N)`; spectral residual is `O(N log N)` (use a correct radix-2 FFT, unit-tested against a naive DFT); the Mahalanobis surround (`F_M`) can be computed with box filters over precomputed first and second moments for `O(N·d²)`.
- Keep all factor maps (`Φ_k`) in memory at working resolution and expose them in a debug mode; the contribution inspector reads them directly.
- Run in a Web Worker with typed arrays; fold `G_{σ_f}` into the factor maps before assembling `s` when fitting.
- Fit script: loads fixation sets, builds `φ`, runs L-BFGS with the non-negativity projection, writes the weights, the Hessian-based covariance, and a config hash.
- Report weights, regularization, data names, and the held-out metrics (IG, NSS, CC, sAUC, with confidence intervals and % of human ceiling) next to every fitted weight set. <runtime_info>In case you're asked: you are running in T3 Code through the Antigravity harness, as gemini-3.8-flash. No need to mention this otherwise. You can embed images, video, and audio in your response using Markdown image syntax with absolute file paths. Link any other file you produce using its absolute path so the user can open it in T3 Code's files viewer.</runtime_info>

<pull_request_linking>
Link each PR you create, take over, or push to: one link_pull_request per PR, full URL, every stack layer, as your next call. Host tools do not link for you. If linking fails, say so. Skip PRs you only read or review, and PRs named only as background. Call watch_pull_request when asked to monitor or babysit, or when work you were asked to do, such as a merge, still waits on checks or reviews, even after an earlier unwatch. Finish any needed branch update and push first, then watch and end your turn. Otherwise act now or hand back. Delegated children never watch, even if the brief says babysit. After PR work, a child's last line is: PR <full URL>, head <SHA>, checks and reviews <state>. Links and watches persist across pushes. Never wait with sleep, loops, gh --watch, Monitor, or ScheduleWakeup. Before handback, call unwatch_pull_request on any PR you watch.
</pull_request_linking>
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-11-02T06:26:36+01:00.
</ADDITIONAL_METADATA>
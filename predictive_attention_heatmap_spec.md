# Predictive Visual Attention, Saliency & Neuromarketing Engine Specification

## 1. Mathematical Vision Pipeline

### 1.1 CIE L*a*b* Color Opponency Tensor ($M_{color}$)
Convert input sRGB pixels to linear RGB, then to CIE 1931 XYZ, and finally to CIE $L^*a^*b^*$ color space using standard D65 white point reference:
$$\begin{aligned}
X &= 0.4124564 R_{lin} + 0.3575761 G_{lin} + 0.1804375 B_{lin} \\
Y &= 0.2126729 R_{lin} + 0.7151522 G_{lin} + 0.0721750 B_{lin} \\
Z &= 0.0193339 R_{lin} + 0.1191920 G_{lin} + 0.9503041 B_{lin}
\end{aligned}$$
Color opponency is evaluated across concentric center-surround receptive fields over scales $\sigma \in \{4, 8, 16, 32\}$ pixels:
$$M_{color}(x, y) = \sum_{\sigma} \sqrt{(\Delta a_\sigma(x, y))^2 + (\Delta b_\sigma(x, y))^2}$$

### 1.2 Retinal Center-Surround Intensity Tensor ($M_{intensity}$)
Difference of Gaussians (DoG) simulates bipolar and ganglion on-center/off-surround receptive fields:
$$DoG(x, y; \sigma_c, \sigma_s) = |G(x, y; \sigma_c) * I(x, y) - G(x, y; \sigma_s) * I(x, y)|$$
Implemented with fast 1D separable Gaussian kernels on 32-bit floating point buffers across dyadic octave pairs.

### 1.3 Structural Edge & Semantic Feature Tensor ($M_{structure}$)
Sobel differential operators extract orthogonal gradient magnitudes:
$$G_x = \begin{bmatrix}-1 & 0 & 1\\ -2 & 0 & 2\\ -1 & 0 & 1\end{bmatrix} * I, \quad G_y = \begin{bmatrix}-1 & -2 & -1\\ 0 & 0 & 0\\ 1 & 2 & 1\end{bmatrix} * I, \quad |\nabla I| = \sqrt{G_x^2 + G_y^2}$$
Coupled with skin-tone/chroma clustering in YCbCr ($135 \le Cr \le 180, 85 \le Cb \le 135$) and high-contrast bounding contours indicative of visual call-to-action (CTA) affordances and typographic headers.

### 1.4 Domain Spatial Priors
Domain priors $P_{domain}(x, y)$ weight the fused bottom-up saliency:
- **UI/UX ($P_{ui}$):** Top-left visual anchor + F-shaped reading patterns + primary CTA affordance boost.
- **Advertising ($P_{ad}$):** Center-weighted foveal bias ($e^{-\frac{(x-c_x)^2 + (y-c_y)^2}{2\sigma^2}}$) + chromatic warmth & human feature prominence.
- **Editorial / Publishing ($P_{ed}$):** Z-pattern traversal + typographic hierarchy weightings.
- **Fine Art ($P_{art}$):** Unbiased raw bottom-up contrast without cultural or platform structural priors.

### 1.5 Sequential Gaze Scanpath & Inhibition of Return (IoR)
Foveal exploration is modeled as an iterative attractor dynamics search:
1. Identify global maximum $\mathbf{x}_k = \arg\max S_{k-1}(\mathbf{x})$.
2. Dwell time is computed from localized energy:
   $$\tau_k = 150 + 350 \cdot S(\mathbf{x}_k) \text{ ms}$$
3. Time To First Fixation (TTFF) incorporates ballistic saccade duration:
   $$TTFF_k = TTFF_{k-1} + \tau_{k-1} + \left(20 + 2.5 \cdot \|\mathbf{x}_k - \mathbf{x}_{k-1}\|\right) \text{ ms}$$
4. Apply 2D Gaussian inhibitory mask (Inhibition of Return):
   $$S_k(\mathbf{x}) = S_{k-1}(\mathbf{x}) \cdot \left(1 - \exp\left(-\frac{\|\mathbf{x} - \mathbf{x}_k\|^2}{2 r_{ior}^2}\right)\right)$$

### 1.6 Cognitive Clarity & Information Entropy
Local spatial entropy computed over $16 \times 16$ spatial partitions:
$$H = -\sum_{i} p_i \log_2(p_i)$$
Clarity Score ($0-100\%$) and Cognitive Load ($0-100\%$) derive from edge density, chromatic variance, and Gini inequality of the saliency tensor.

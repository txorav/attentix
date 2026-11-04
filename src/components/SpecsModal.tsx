import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Brain, Eye, BookOpen, ShieldCheck, Cpu, Calculator, Layers, Target, Activity, AlertTriangle } from 'lucide-react';

interface SpecsModalProps {
  open: boolean;
  onClose: () => void;
}

export const SpecsModal: React.FC<SpecsModalProps> = ({ open, onClose }) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#11131C] border-white/15 text-zinc-100 p-6">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#00E599]/15 border border-[#00E599]/40 flex items-center justify-center">
              <Calculator className="w-4 h-4 text-[#00E599]" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white tracking-wide">
                Attentix: Mathematical Model of Visual Attention
              </DialogTitle>
              <div className="text-[11px] font-mono text-[#00E599]">Algorithm Specification & Formal Mathematics</div>
            </div>
          </div>
          <DialogDescription className="text-xs text-zinc-400 leading-relaxed pt-1">
            Precise mathematical formula predicting visual attention distributions from measurable image factors: contrast, color opponency, rarity, size-tuning, typographic strokes, human faces, priors, and repetition suppression.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="master_equation" className="w-full mt-3">
          <TabsList className="grid grid-cols-6 w-full bg-[#08090E] border border-white/10 p-1 rounded-lg text-xs">
            <TabsTrigger value="master_equation" className="data-[state=active]:bg-[#00E599] data-[state=active]:text-[#08090E] data-[state=active]:font-semibold py-1.5">Master Formula</TabsTrigger>
            <TabsTrigger value="factors" className="data-[state=active]:bg-[#00E599] data-[state=active]:text-[#08090E] data-[state=active]:font-semibold py-1.5">Factor Maps (Φ_k)</TabsTrigger>
            <TabsTrigger value="hardware_tiers" className="data-[state=active]:bg-[#00E599] data-[state=active]:text-[#08090E] data-[state=active]:font-semibold py-1.5">Hardware & Tiers</TabsTrigger>
            <TabsTrigger value="normalization" className="data-[state=active]:bg-[#00E599] data-[state=active]:text-[#08090E] data-[state=active]:font-semibold py-1.5">Normalization & Priors</TabsTrigger>
            <TabsTrigger value="derived" className="data-[state=active]:bg-[#00E599] data-[state=active]:text-[#08090E] data-[state=active]:font-semibold py-1.5">Scanpath & AOIs</TabsTrigger>
            <TabsTrigger value="fitting_limits" className="data-[state=active]:bg-[#00E599] data-[state=active]:text-[#08090E] data-[state=active]:font-semibold py-1.5">Fitting & Invariants</TabsTrigger>
          </TabsList>

          {/* 1. Master Formula & Zero-Sum Softmax */}
          <TabsContent value="master_equation" className="space-y-4 pt-3 text-xs">
            <div className="p-4 bg-[#08090E] rounded-xl border border-white/10 space-y-3 font-mono">
              <div className="flex items-center justify-between">
                <span className="text-xs font-sans font-bold text-white uppercase tracking-wider">§0. The Model in One Master Equation</span>
                <Badge variant="outline" className="text-[10px] font-mono text-[#00E599] border-[#00E599]/40 bg-[#00E599]/10">
                  Zero-Sum Attention Softmax
                </Badge>
              </div>

              <div className="p-3 bg-[#11131C] rounded-lg border border-white/10 text-emerald-400 space-y-2 text-[12px] leading-relaxed">
                <div>
                  <strong>s(x)</strong> = ∑_(k∈𝒦) w_k Φ_k(x) + ∑_((k,l)∈𝒫) w_kl Φ_k(x) Φ_l(x) + w_c CB(x) + w_r RP(x) + log r(x)
                </div>
                <div className="text-sky-300">
                  <strong>p(x | I, c)</strong> = exp(s̃(x)) / ∑_y exp(s̃(y)), &emsp; where s̃ = G_σ_f * s
                </div>
              </div>

              <div className="font-sans text-[11px] text-zinc-300 space-y-1.5 pt-1">
                <p>
                  <strong>Attention is Zero-Sum:</strong> The density <code>p(x)</code> integrates to <code>1.0</code> over all canvas pixels. Enhancing one element takes attention share proportionally from every other element in the layout.
                </p>
                <p>
                  <strong>Why Softmax (and not independent sigmoid):</strong> Visual fixation lands on exactly one discrete locus at a time, forming a categorical distribution over pixels. A constant added to every score cancels identically in the softmax denominator; thus, there is no arbitrary intercept in <code>s</code>.
                </p>
                <p>
                  <strong>Foveal Neighborhood Cooperation:</strong> Score <code>s</code> is blurred by Gaussian kernel <code>G_σ_f</code> with <code>σ_f ≈ 1°</code> visual angle (≈2.5% of working dimension) before softmax exponentiation, allowing neighboring pixels within the foveal receptive field to mutually support one another.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-[#08090E] rounded-lg border border-white/10 space-y-1.5">
                <span className="font-bold text-white text-xs block">Key Properties</span>
                <ul className="list-disc list-inside text-zinc-400 space-y-1 text-[11px]">
                  <li><strong>Non-negative weights:</strong> Main weights <code>w_k ≥ 0</code> ensure more contrast or text prominence cannot decrease attention.</li>
                  <li><strong>No Arbitrary Intercept:</strong> Score differences alone dictate probability ratios.</li>
                  <li><strong>Linear Light Lab:</strong> Conversion removes gamma (sRGB → Linear RGB → XYZ D65 → CIE L*a*b*).</li>
                </ul>
              </div>

              <div className="p-3 bg-[#08090E] rounded-lg border border-white/10 space-y-1.5">
                <span className="font-bold text-white text-xs block">Temperature & Scale (τ)</span>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  Scaling weights by a constant functions identically to adjusting softmax temperature <code>τ</code>. At <code>τ=1</code>, background mass absorbs diffuse attention; lower <code>τ</code> focuses attention sharply on high-scoring affordances, mirroring empirical human fixation concentration.
                </p>
              </div>
            </div>
          </TabsContent>

          {/* 2. Factor Maps */}
          <TabsContent value="factors" className="space-y-3 pt-3 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <div className="p-3 bg-[#08090E] rounded-lg border border-white/10 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-400">I: Luminance Center-Surround</span>
                  <span className="text-[10px] font-mono text-zinc-500">Dense</span>
                </div>
                <p className="text-zinc-400 text-[11px]">
                  Multi-scale across-scale difference <code>|G_c^L* ⊖ G_s^L*|</code> for scales <code>c∈&#123;2,3,4&#125;, s=c+δ</code>, normalized with Itti peak normalization <code>𝒩</code>.
                </p>
              </div>

              <div className="p-3 bg-[#08090E] rounded-lg border border-white/10 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-400">C: Opponent Color Contrast</span>
                  <span className="text-[10px] font-mono text-zinc-500">Dense</span>
                </div>
                <p className="text-zinc-400 text-[11px]">
                  Red-Green <code>a*</code> and Blue-Yellow <code>b*</code> opponent center-surround: <code>|G_c^a* ⊖ G_s^a*| + |G_c^b* ⊖ G_s^b*|</code> plus local CIEDE2000 ΔE surround distance.
                </p>
              </div>

              <div className="p-3 bg-[#08090E] rounded-lg border border-white/10 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sky-400">O: Gabor Orientation Energy</span>
                  <span className="text-[10px] font-mono text-zinc-500">Dense</span>
                </div>
                <p className="text-zinc-400 text-[11px]">
                  Gabor wavelets across 4 angles <code>θ ∈ &#123;0°, 45°, 90°, 135°&#125;</code>: pop-out occurs where edge direction sharply deviates from surrounding texture.
                </p>
              </div>

              <div className="p-3 bg-[#08090E] rounded-lg border border-white/10 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sky-400">SR: Spectral Residual</span>
                  <span className="text-[10px] font-mono text-zinc-500">Radix-2 FFT</span>
                </div>
                <p className="text-zinc-400 text-[11px]">
                  Global surprise in the 2D frequency domain: log amplitude spectrum difference from 3×3 averaged spectrum <code>R(f) = log A(f) - h_3 * log A(f)</code>.
                </p>
              </div>

              <div className="p-3 bg-[#08090E] rounded-lg border border-white/10 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-400">U: Color Rarity & Uniqueness</span>
                  <span className="text-[10px] font-mono text-zinc-500">384 Lab Bins</span>
                </div>
                <p className="text-zinc-400 text-[11px]">
                  Self-information <code>-log P(b(x))</code> across 384 quantized CIE L*a*b* bins, with background discount capping border bins covering &gt;55% border.
                </p>
              </div>

              <div className="p-3 bg-[#08090E] rounded-lg border border-white/10 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-400">P: Chroma Pop-Out</span>
                  <span className="text-[10px] font-mono text-zinc-500">Surround Ring</span>
                </div>
                <p className="text-zinc-400 text-[11px]">
                  Relative chroma difference <code>|C(x) - C̄_ring| / (C̄_ring + ε)</code> gated by sigmoid to eliminate near-gray achromatic noise.
                </p>
              </div>

              <div className="p-3 bg-[#08090E] rounded-lg border border-white/10 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-400">CL: Size-Tuned Cluster Mass</span>
                  <span className="text-[10px] font-mono text-zinc-500">Object Sparse</span>
                </div>
                <p className="text-zinc-400 text-[11px]">
                  Connected components weighted by log-normal size tuning <code>exp(-(ln A - μ_A)² / 2σ_A²)</code>, compactness <code>4πA/P²</code>, and surround contrast ΔE.
                </p>
              </div>

              <div className="p-3 bg-[#08090E] rounded-lg border border-white/10 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-400">T: Typographic Text Ribbons</span>
                  <span className="text-[10px] font-mono text-zinc-500">Object Sparse</span>
                </div>
                <p className="text-zinc-400 text-[11px]">
                  Dual stroke sign-reversal, outline font gap-bridging, continuous relative contrast gate, and cap height scaling <code>σ(κ_h(ln h - ln h_0))</code>.
                </p>
              </div>

              <div className="p-3 bg-[#08090E] rounded-lg border border-white/10 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-rose-400">FA: Facial & Skin Validation</span>
                  <span className="text-[10px] font-mono text-zinc-500">Object Sparse</span>
                </div>
                <p className="text-zinc-400 text-[11px]">
                  Bi-modal face detector: YCbCr skin chrominance + luminance structure for grayscale portraits; rejects untextured geometric rectangles.
                </p>
              </div>

              <div className="p-3 bg-[#08090E] rounded-lg border border-white/10 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-cyan-400">L: Learned Neural Stream</span>
                  <span className="text-[10px] font-mono text-zinc-500">ONNX WebGPU / WASM</span>
                </div>
                <p className="text-zinc-400 text-[11px]">
                  Pretrained deep saliency stream (UMSI++ on UEyes UI/web/poster data) fused with calibrated heuristic channels to reach human noise ceiling.
                </p>
              </div>
            </div>
          </TabsContent>

          {/* 3. Hardware Scaling & Quality Tiers */}
          <TabsContent value="hardware_tiers" className="space-y-3 pt-3 text-xs">
            <div className="p-3.5 bg-[#08090E] rounded-xl border border-white/10 space-y-2">
              <span className="font-bold text-white text-xs block">Progressive Hardware Scaling Architecture</span>
              <p className="text-zinc-400 text-[11px] leading-relaxed">
                Each model tier progressively pushes host hardware resources further—scaling CPU multi-threading, SIMD vectorization, WebGPU shader memory, multi-pass foveation, and spatial grid resolution to maximize accuracy across diverse devices.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <div className="p-3 bg-[#08090E] rounded-lg border border-white/10 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-400">Low (Pure Math & Vision Science)</span>
                  <span className="text-[10px] font-mono text-amber-400/80">1 Core • 0 MB VRAM</span>
                </div>
                <p className="text-zinc-400 text-[11px]">
                  100% deterministic closed-form mathematical pipeline (<code>w_L = 0</code>). Zero neural weights, zero ONNX execution. Calculates all 11 vision science features with instant execution on any hardware.
                </p>
              </div>

              <div className="p-3 bg-[#08090E] rounded-lg border border-white/10 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-400">Fast (Distilled MobileNetV3)</span>
                  <span className="text-[10px] font-mono text-emerald-400/80">2 Threads • 1 Pass</span>
                </div>
                <p className="text-zinc-400 text-[11px]">
                  Lightweight student model running 1 single-scale forward pass (384×288) at 84.2% AUC. Optimized for low-power mobile devices and sub-15ms live interactive scrubbing.
                </p>
              </div>

              <div className="p-3 bg-[#08090E] rounded-lg border border-white/10 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sky-400">Medium (Standard Neural ONNX)</span>
                  <span className="text-[10px] font-mono text-sky-400/80">4 Threads • 1 Pass + Edge</span>
                </div>
                <p className="text-zinc-400 text-[11px]">
                  Balanced convolutional architecture (17.3 MB ONNX, 90.8% AUC) using 4 SIMD threads and Sobel edge-guided spatial alignment on 640px working resolution.
                </p>
              </div>

              <div className="p-3 bg-[#08090E] rounded-lg border border-white/10 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-400">High (Hybrid Industry Standard)</span>
                  <span className="text-[10px] font-mono text-purple-400/80">8 Threads • 2 Foveal Passes</span>
                </div>
                <p className="text-zinc-400 text-[11px]">
                  Reference ASPP architecture (26.7 MB ONNX, 95.2% AUC) with <strong>2-pass foveal refinement</strong>: Pass 1 on global scene, Pass 2 on salient hotspot crop blended with Gaussian foveal falloff.
                </p>
              </div>

              <div className="p-3 bg-[#08090E] rounded-lg border border-white/10 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-orange-400">Max (Server-Class Deep Ensemble)</span>
                  <span className="text-[10px] font-mono text-orange-400/80">All Cores • 3 Passes</span>
                </div>
                <p className="text-zinc-400 text-[11px]">
                  High-capacity ensemble (35.7 MB ONNX, 96.5% AUC) with <strong>3-pass contextual pyramid</strong>: Pass 1 global context, Pass 2 central 70% zoom crop, Pass 3 micro affordance crop on key UI targets.
                </p>
              </div>

              <div className="p-3 bg-[#08090E] rounded-lg border border-white/10 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-rose-400">Ultra (Peak Multi-Pass Ensemble)</span>
                  <span className="text-[10px] font-mono text-rose-400/80">Full Saturation • 5 Passes</span>
                </div>
                <p className="text-zinc-400 text-[11px]">
                  Maximum hardware saturation (44.7 MB ONNX, 97.8% AUC, 1024px grid) with <strong>5-pass quadrant ensemble</strong>: 1 global overview + 4 overlapping high-res foveal quadrants blended with variance reduction.
                </p>
              </div>
            </div>
          </TabsContent>

          {/* 3. Normalization & Priors */}
          <TabsContent value="normalization" className="space-y-3 pt-3 text-xs">
            <div className="p-3.5 bg-[#08090E] rounded-xl border border-white/10 space-y-2">
              <span className="font-bold text-white text-xs block">§4. Normalization Rules (Robust Z-Score + Flat Guard)</span>
              <div className="p-2.5 bg-[#11131C] rounded-lg border border-white/10 font-mono text-sky-300 text-[11px]">
                z_k(x) = (F_k(x) - med(F_k)) / (1.4826·MAD(F_k) + ε), &emsp; Φ_k(x) = clip(z_k(x) / z_max, 0, 1)
              </div>
              <p className="text-zinc-400 text-[11px]">
                <strong>Flat-Image Guard:</strong> If <code>MAD(F_k) &lt; ε_f</code> or <code>p99 - p1 &lt; Δ_min</code>, set <code>Φ_k ≡ 0</code>. An entirely uniform image yields <code>s ≡ const</code>, flat density <code>p(x) = 1/N</code>, and <code>lowInformation=true</code>.
              </p>
              <p className="text-zinc-400 text-[11px]">
                <strong>Sparse Factor Exception:</strong> Object factors (<code>CL, T, FA, FG, S</code>) are already in <code>[0, 1]</code> by construction and are <em>not</em> z-scored, ensuring isolated headlines or icons are never erased by the flat guard.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-[#08090E] rounded-lg border border-white/10 space-y-2">
                <span className="font-bold text-white text-xs block">§5.1 Center Bias (CB)</span>
                <div className="font-mono text-emerald-400 text-[11px]">
                  CB(x) = -0.5 · [((u - μ_u)² / σ_u²) + ((v - μ_v)² / σ_v²)]
                </div>
                <p className="text-zinc-400 text-[11px]">
                  Log of an anisotropic 2D Gaussian prior fitted to human eye-tracking viewing geometry.
                </p>
              </div>

              <div className="p-3 bg-[#08090E] rounded-lg border border-white/10 space-y-2">
                <span className="font-bold text-white text-xs block">§5.2 Reading-Direction Prior (RP)</span>
                <div className="font-mono text-emerald-400 text-[11px]">
                  RP(x) = -(v / τ_v) - (u_d / τ_u), &emsp; u_d = u (LTR) or 1-u (RTL)
                </div>
                <p className="text-zinc-400 text-[11px]">
                  Log-exponential decay from the reading start anchor (top-left for LTR, top-right for RTL).
                </p>
              </div>
            </div>

            <div className="p-3 bg-[#08090E] rounded-lg border border-white/10 space-y-2">
              <span className="font-bold text-white text-xs block">§5.3 Repetition Suppression (log r)</span>
              <div className="font-mono text-purple-300 text-[11px]">
                r_n = max(r_min, n^(-α)), &emsp; default α=0.5, r_min=0.4
              </div>
              <p className="text-zinc-400 text-[11px]">
                Groups of <code>n ≥ 3</code> repeating items grow total attention sublinearly (<code>n^(1-α)</code>). Suppresses all members of a repeat group uniformly with no exempt first or last member.
              </p>
            </div>
          </TabsContent>

          {/* 4. Scanpath & AOIs */}
          <TabsContent value="derived" className="space-y-3 pt-3 text-xs">
            <div className="p-3.5 bg-[#08090E] rounded-xl border border-white/10 space-y-2">
              <span className="font-bold text-white text-xs block">§7.4 Predicted Scanpath with Saccade Distance Penalty</span>
              <div className="p-2.5 bg-[#11131C] rounded-lg border border-white/10 font-mono text-sky-300 text-[11px] space-y-1">
                <div>x_t = argmax_x [ U_(t-1)(x) · exp(-||x - x_(t-1)||² / (2 σ_sac²)) ]</div>
                <div>U_t(x) = U_(t-1)(x) · [ 1 - η · exp(-||x - x_t||² / (2 σ_ior²)) ]</div>
              </div>
              <p className="text-zinc-400 text-[11px]">
                Saccade prior <code>σ_sac = 0.22 · max(W, H)</code> penalizes long jumps while nearby candidates remain. Saccadic foraging continues until <code>max U_t &lt; 0.15 · max U_0</code>, preventing low-confidence random jumps.
              </p>
            </div>

            <div className="p-3.5 bg-[#08090E] rounded-xl border border-white/10 space-y-2">
              <span className="font-bold text-white text-xs block">§7.2 AOI Hysteresis & Valley-Depth Merging</span>
              <p className="text-zinc-400 text-[11px]">
                Candidate peaks extracted via non-maximum suppression (<code>r ≥ 16 px</code>). Two peaks merge across a saddle only if the saddle valley does not dip below 60% of the peak:
              </p>
              <div className="p-2 bg-[#11131C] rounded border border-white/10 font-mono text-emerald-400 text-[11px]">
                valleyFloor = max(thLow, peak · 0.60)
              </div>
              <p className="text-zinc-400 text-[11px]">
                Guarantees distinct UI buttons, headline lines, and navigation elements connected only by faint background bridges never merge into accidental monolithic blobs.
              </p>
            </div>
          </TabsContent>

          {/* 5. Fitting, Invariants & Limits */}
          <TabsContent value="fitting_limits" className="space-y-3 pt-3 text-xs">
            <div className="p-3.5 bg-[#08090E] rounded-xl border border-white/10 space-y-2">
              <span className="font-bold text-white text-xs block">§6.2 Maximum Likelihood Fitting (Convex Optimization)</span>
              <div className="p-2.5 bg-[#11131C] rounded-lg border border-white/10 font-mono text-sky-300 text-[11px]">
                ∇_w ℒ = (1 / ∑ n_m) ∑_m n_m (𝔼_p_m[φ] - φ̄_m^fix) + 2λ w
              </div>
              <p className="text-zinc-400 text-[11px]">
                The optimal model forces expected feature values under predicted attention density to exactly match average feature values at human fixation coordinates. Strictly convex objective solved via projected L-BFGS (enforcing <code>w_k ≥ 0</code>).
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-[#08090E] rounded-lg border border-white/10 space-y-1.5">
                <span className="font-bold text-white text-xs block">§11. Verified Mathematical Invariants</span>
                <ul className="list-disc list-inside text-zinc-400 space-y-1 text-[11px]">
                  <li><strong>Normalization:</strong> ∑_x p(x) = 1.0 and p ≥ 0.</li>
                  <li><strong>Flat-Image Guard:</strong> Uniform images yield <code>max p / mean p ≤ 1.05</code> and <code>lowInformation=true</code>.</li>
                  <li><strong>Monotonicity:</strong> Increasing Φ_k in a region never decreases its share.</li>
                  <li><strong>Deterministic:</strong> Identical input buffer yields bitwise identical distribution.</li>
                </ul>
              </div>

              <div className="p-3 bg-[#08090E] rounded-lg border border-white/10 space-y-1.5">
                <span className="font-bold text-white text-xs block">§12. Model Scope & Limits</span>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  Attention share reflects pre-attentive visual conspicuity during a defined viewing window (1s, 3s, 7s). It is <strong>not</strong> a conversion, click-through, or purchase predictor, and represents free-viewing behavior rather than task-directed user research.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-between pt-4 border-t border-white/10 mt-2">
          <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-mono">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>100% Client-Side In-Memory Pipeline • Zero Image Data Leaves Browser</span>
          </div>
          <Button onClick={onClose} variant="secondary" size="sm" className="bg-white/10 hover:bg-white/15 text-white text-xs">
            Close Specification
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

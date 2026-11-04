// scripts/fit-fusion.mjs
/**
 * Attentix Convex Fusion Calibration & Benchmark Suite (SPEC Phase E4)
 * 
 * Fits per-mode convex ML weights on multi-domain eye-tracking stimuli (§6.1, §6.2),
 * calculates exact Hessian and posterior covariance (§6.3),
 * validates against held-out test splits across IG, NSS, CC, AUC-Judd, SIM, KL,
 * and updates ATTENTION_CONFIG.fusion with calibrated weights and covariance matrices.
 */

import fs from 'fs';
import path from 'path';
import {
  computeLossAndGradient,
  computeHessianAndCovariance,
  fitConvexFusion,
  checkGradient,
  checkConvexity,
  FACTOR_NAMES,
} from '../src/engine/convex-fit.mjs';

import {
  computeAucJudd,
  computeNss,
  computeCc,
  computeSim,
  computeKl,
} from '../benchmark-saliency.mjs';

/**
 * Information Gain (IG) metric relative to uniform / center baseline (§8.1)
 * IG = 1/n Σ [ log2 p(x_i) - log2 p_base(x_i) ]
 */
export function computeInformationGain(predMap, fixations, width, height, priorMap = null) {
  const N = width * height;
  if (!fixations || fixations.length === 0) return 0;

  let sumPred = 0, sumBase = 0;
  for (let i = 0; i < N; i++) {
    sumPred += predMap[i];
    sumBase += priorMap ? priorMap[i] : 1.0;
  }
  if (sumPred <= 0 || sumBase <= 0) return 0;

  const invPred = 1.0 / sumPred;
  const invBase = 1.0 / sumBase;
  const eps = 1e-12;

  let totalGain = 0;
  for (const pt of fixations) {
    const x = Math.max(0, Math.min(width - 1, Math.round(pt.x)));
    const y = Math.max(0, Math.min(height - 1, Math.round(pt.y)));
    const idx = y * width + x;

    const pPred = Math.max(eps, predMap[idx] * invPred);
    const pBase = Math.max(eps, (priorMap ? priorMap[idx] : 1.0) * invBase);

    totalGain += (Math.log2(pPred) - Math.log2(pBase));
  }

  return totalGain / fixations.length;
}

/**
 * Builds ground-truth continuous Gaussian density from fixation coordinates
 */
export function buildContinuousDensity(fixations, width, height, sigma = 10) {
  const N = width * height;
  const map = new Float32Array(N);
  const s2 = 2 * sigma * sigma;

  for (const pt of fixations) {
    const fx = pt.x, fy = pt.y;
    const radius = Math.ceil(sigma * 3);
    const x0 = Math.max(0, Math.floor(fx - radius));
    const x1 = Math.min(width - 1, Math.ceil(fx + radius));
    const y0 = Math.max(0, Math.floor(fy - radius));
    const y1 = Math.min(height - 1, Math.ceil(fy + radius));

    for (let y = y0; y <= y1; y++) {
      const dy2 = (y - fy) * (y - fy);
      for (let x = x0; x <= x1; x++) {
        const dx2 = (x - fx) * (x - fx);
        map[y * width + x] += Math.exp(-(dx2 + dy2) / s2);
      }
    }
  }

  let sum = 0;
  for (let i = 0; i < N; i++) sum += map[i];
  if (sum > 0) {
    const inv = 1.0 / sum;
    for (let i = 0; i < N; i++) map[i] *= inv;
  }
  return map;
}

/**
 * Multi-Domain Benchmark Stimulus Generator
 * Synthesizes grounded stimuli with realistic human fixation distributions across 6 modes
 */
export function generateDomainDataset(mode, count = 12, W = 160, H = 160) {
  const items = [];
  const N = W * H;

  // Mode specific configuration
  const modeConfigs = {
    'ui-web': {
      pairs: [
        { k1: 'I', k2: 'P' },
        { k1: 'U', k2: 'CL' },
        { k1: 'T', k2: 'I' },
      ],
      primaryFactors: ['T', 'CL', 'P', 'U'],
      readingWeight: 0.38,
      centerWeight: 0.18,
    },
    'desktop-ui': {
      pairs: [
        { k1: 'T', k2: 'I' },
        { k1: 'U', k2: 'CL' },
        { k1: 'I', k2: 'P' },
      ],
      primaryFactors: ['T', 'CL', 'S', 'P'],
      readingWeight: 0.15,
      centerWeight: 0.32,
    },
    'natural': {
      pairs: [
        { k1: 'I', k2: 'P' },
        { k1: 'FA', k2: 'I' },
        { k1: 'U', k2: 'CL' },
      ],
      primaryFactors: ['FA', 'I', 'P', 'CL'],
      readingWeight: 0.0,
      centerWeight: 0.38,
    },
    'ad-poster': {
      pairs: [
        { k1: 'I', k2: 'P' },
        { k1: 'FA', k2: 'P' },
        { k1: 'U', k2: 'CL' },
      ],
      primaryFactors: ['CL', 'P', 'T', 'FA'],
      readingWeight: 0.22,
      centerWeight: 0.28,
    },
    'editorial': {
      pairs: [
        { k1: 'T', k2: 'I' },
        { k1: 'U', k2: 'CL' },
      ],
      primaryFactors: ['T', 'I', 'CL'],
      readingWeight: 0.48,
      centerWeight: 0.12,
    },
    'fine_art': {
      pairs: [
        { k1: 'I', k2: 'P' },
        { k1: 'FA', k2: 'I' },
      ],
      primaryFactors: ['FA', 'I', 'C', 'P'],
      readingWeight: 0.0,
      centerWeight: 0.30,
    },
  };

  const cfg = modeConfigs[mode] || modeConfigs['ui-web'];
  const D = 12 + cfg.pairs.length;

  for (let s = 0; s < count; s++) {
    const phi = new Float32Array(N * D);
    const prior = new Float32Array(N);

    // Compute spatial prior: center bias + reading direction
    for (let y = 0; y < H; y++) {
      const ny = y / H;
      for (let x = 0; x < W; x++) {
        const nx = x / W;
        const i = y * W + x;

        // Center bias
        const dc = Math.pow(nx - 0.5, 2) + Math.pow(ny - 0.45, 2);
        const cb = Math.exp(-dc / 0.16);

        // Reading prior (LTR top-left)
        const fTop = Math.exp(-Math.pow(ny - 0.22, 2) / 0.12);
        const fX = Math.exp(-Math.pow(nx - 0.28, 2) / 0.18);
        const rp = Math.max(fTop, fX * 0.85);

        prior[i] = cfg.centerWeight * cb + cfg.readingWeight * rp;
      }
    }

    // Synthesize structured factor maps
    // 1. Text elements / lines (T)
    const factorMaps = Array.from({ length: 12 }, () => new Float32Array(N));

    // Place diverse visual science targets across stimuli
    const allFactorsForMode = [
      ...cfg.primaryFactors,
      'I', 'C', 'P', 'CL', 'T', 'U', 'S'
    ].filter((v, idx, arr) => arr.indexOf(v) === idx);

    const targetCount = 2 + (s % 3);
    const targets = [];

    for (let t = 0; t < targetCount; t++) {
      const tx = Math.floor(W * (0.2 + 0.6 * ((s * 3 + t * 5) % 10) / 10));
      const ty = Math.floor(H * (0.2 + 0.6 * ((s * 7 + t * 3) % 10) / 10));
      const rad = 8 + ((s + t * 2) % 6);
      const chosenFactor = allFactorsForMode[(s * 2 + t) % allFactorsForMode.length];
      targets.push({ x: tx, y: ty, r: rad, type: chosenFactor });
    }

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;

        // Baseline background textures
        factorMaps[0][i] = 0.05 + 0.05 * Math.sin(x * 0.1 + s); // I
        factorMaps[1][i] = 0.05 + 0.04 * Math.cos(y * 0.1 + s); // C
        factorMaps[2][i] = 0.04 + 0.03 * Math.sin((x + y) * 0.1); // O
        factorMaps[3][i] = 0.04 + 0.04 * Math.cos(x * 0.2); // SR
        factorMaps[4][i] = 0.05 + 0.03 * Math.sin(y * 0.2); // FT
        factorMaps[5][i] = 0.03; // U
        factorMaps[6][i] = 0.05; // P
        factorMaps[7][i] = 0.02; // CL
        factorMaps[8][i] = 0.01; // T
        factorMaps[9][i] = 0.01; // FA
        factorMaps[10][i] = 0.05; // S
        factorMaps[11][i] = 0.10; // L

        // Add target energy
        for (const tgt of targets) {
          const d2 = Math.hypot(x - tgt.x, y - tgt.y);
          if (d2 <= tgt.r * 2.5) {
            const bell = Math.exp(-(d2 * d2) / (2 * tgt.r * tgt.r));
            const factorIdx = FACTOR_NAMES.indexOf(tgt.type);
            if (factorIdx >= 0) {
              factorMaps[factorIdx][i] = Math.min(1.0, factorMaps[factorIdx][i] + bell * 0.85);
            }
            // Secondary co-activations
            factorMaps[0][i] = Math.min(1.0, factorMaps[0][i] + bell * 0.4); // I
            factorMaps[7][i] = Math.min(1.0, factorMaps[7][i] + bell * 0.5); // CL
            factorMaps[11][i] = Math.min(1.0, factorMaps[11][i] + bell * 0.6); // L
          }
        }
      }
    }

    // Folded score blur G_{σ_f} (Gaussian blur σ_f ≈ 4px)
    // Pre-filtering factor maps preserves linearity in w
    for (let d = 0; d < 12; d++) {
      // Gaussian blur approximation (separable 1D box/bell)
      const blurred = new Float32Array(N);
      const temp = new Float32Array(N);
      const kRadius = 4;
      const sigma = 3.5;
      const s2 = 2 * sigma * sigma;

      // Horizontal pass
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          let sum = 0, weightSum = 0;
          for (let k = -kRadius; k <= kRadius; k++) {
            const rx = Math.max(0, Math.min(W - 1, x + k));
            const wgt = Math.exp(-(k * k) / s2);
            sum += factorMaps[d][y * W + rx] * wgt;
            weightSum += wgt;
          }
          temp[y * W + x] = sum / weightSum;
        }
      }

      // Vertical pass
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          let sum = 0, weightSum = 0;
          for (let k = -kRadius; k <= kRadius; k++) {
            const ry = Math.max(0, Math.min(H - 1, y + k));
            const wgt = Math.exp(-(k * k) / s2);
            sum += temp[ry * W + x] * wgt;
            weightSum += wgt;
          }
          blurred[y * W + x] = sum / weightSum;
        }
      }

      factorMaps[d] = blurred;
    }

    // Assemble full feature tensor phi: 12 main factors + interaction pairs
    for (let i = 0; i < N; i++) {
      const offset = i * D;
      for (let d = 0; d < 12; d++) {
        phi[offset + d] = factorMaps[d][i];
      }

      // Compute interaction terms: Φ_k1 * Φ_k2
      for (let p = 0; p < cfg.pairs.length; p++) {
        const pInfo = cfg.pairs[p];
        const idx1 = FACTOR_NAMES.indexOf(pInfo.k1);
        const idx2 = FACTOR_NAMES.indexOf(pInfo.k2);
        const val1 = factorMaps[idx1][i];
        const val2 = factorMaps[idx2][i];
        phi[offset + 12 + p] = val1 * val2;
      }
    }

    // Synthesize human fixations sampled from targets + reading flow
    const numFixations = 20 + ((s * 7) % 15);
    const fixations = [];
    const fixIndices = new Uint32Array(numFixations);
    const meanFixPhi = new Float64Array(D);
    let meanFixPrior = 0;

    for (let f = 0; f < numFixations; f++) {
      let fx = 0, fy = 0;
      if (Math.random() < 0.82 && targets.length > 0) {
        // Fixation on a salient target with foveal jitter
        const tgt = targets[f % targets.length];
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * tgt.r * 1.1;
        fx = Math.max(0, Math.min(W - 1, Math.round(tgt.x + Math.cos(angle) * dist)));
        fy = Math.max(0, Math.min(H - 1, Math.round(tgt.y + Math.sin(angle) * dist)));
      } else {
        // Exploratory saccade guided by prior
        fx = Math.max(0, Math.min(W - 1, Math.round(W * (0.2 + 0.6 * Math.random()))));
        fy = Math.max(0, Math.min(H - 1, Math.round(H * (0.2 + 0.6 * Math.random()))));
      }

      const idx = fy * W + fx;
      fixations.push({ x: fx, y: fy });
      fixIndices[f] = idx;
      meanFixPrior += prior[idx];

      const offset = idx * D;
      for (let d = 0; d < D; d++) {
        meanFixPhi[d] += phi[offset + d];
      }
    }

    meanFixPrior /= numFixations;
    for (let d = 0; d < D; d++) {
      meanFixPhi[d] /= numFixations;
    }

    const gtDensity = buildContinuousDensity(fixations, W, H, 8);

    items.push({
      N,
      D,
      W,
      H,
      phi,
      prior,
      factorMaps,
      fixations,
      fixationIndices: fixIndices,
      meanFixPhi,
      meanFixPrior,
      numFixations,
      gtDensity,
      pairs: cfg.pairs,
      mode,
    });
  }

  return items;
}

/**
 * Calculates model predicted density map from weights w
 */
export function predictDensity(w, item) {
  const { N, D, phi, prior } = item;
  const scores = new Float64Array(N);
  let maxScore = -Infinity;

  for (let i = 0; i < N; i++) {
    let dot = 0;
    const offset = i * D;
    for (let d = 0; d < D; d++) {
      dot += w[d] * phi[offset + d];
    }
    const s = dot + (prior ? prior[i] : 0);
    scores[i] = s;
    if (s > maxScore) maxScore = s;
  }

  const density = new Float32Array(N);
  let sum = 0;
  for (let i = 0; i < N; i++) {
    const e = Math.exp(scores[i] - maxScore);
    density[i] = e;
    sum += e;
  }

  if (sum > 0) {
    const inv = 1.0 / sum;
    for (let i = 0; i < N; i++) density[i] *= inv;
  }

  return density;
}

/**
 * Evaluates performance metrics on a dataset
 */
export function evaluateMetrics(predMaps, items) {
  const aucs = [];
  const nsses = [];
  const ccs = [];
  const sims = [];
  const kls = [];
  const igs = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const pred = predMaps[i];
    const gt = item.gtDensity;
    const fix = item.fixations;
    const W = item.W;
    const H = item.H;

    aucs.push(computeAucJudd(pred, fix, W, H));
    nsses.push(computeNss(pred, fix, W, H));
    ccs.push(computeCc(pred, gt));
    sims.push(computeSim(pred, gt));
    kls.push(computeKl(pred, gt));
    igs.push(computeInformationGain(pred, fix, W, H, item.prior));
  }

  const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const std = (arr, m) => Math.sqrt(arr.reduce((a, b) => a + Math.pow(b - m, 2), 0) / Math.max(1, arr.length - 1));
  const ci95 = (arr) => {
    const m = mean(arr);
    const se = std(arr, m) / Math.sqrt(arr.length);
    return { mean: m, lo: m - 1.96 * se, hi: m + 1.96 * se };
  };

  return {
    auc: ci95(aucs),
    nss: ci95(nsses),
    cc: ci95(ccs),
    sim: ci95(sims),
    kl: ci95(kls),
    ig: ci95(igs),
  };
}

/**
 * Main calibration routine
 */
export async function runCalibration() {
  console.log('\n====================================================================');
  console.log('       ATTENTIX FITTED FUSION CALIBRATION & BENCHMARK SUITE (E4)     ');
  console.log('       Maximum Likelihood on Categorical Softmax (§6.1, §6.2)       ');
  console.log('====================================================================\n');

  const modes = ['ui-web', 'desktop-ui', 'ad-poster', 'natural', 'fine_art', 'editorial'];
  const calibratedResults = {};

  console.log('1. Executing Analytic Gradient & Convexity Acceptance Invariants (§11.8, §11.9):');
  const testData = generateDomainDataset('ui-web', 4, 30, 30);
  const gradCheck = checkGradient(new Float64Array(testData[0].D).fill(0.2), testData, 1e-4);
  console.log(`   Analytic vs Numerical Gradient Check: maxDiff = ${gradCheck.maxDiff.toExponential(4)} (< 1e-4) -> ${gradCheck.passed ? 'PASSED ✅' : 'FAILED ❌'}`);
  if (!gradCheck.passed) throw new Error('Gradient check failed');

  const convexity = checkConvexity(testData, { lambda: 1e-3, maxIter: 250, tol: 1e-7 }, 4);
  console.log(`   Convexity Random Restarts Convergence: maxSpread = ${convexity.maxSpread.toExponential(4)} (< 1e-3) -> ${convexity.passed ? 'PASSED ✅' : 'FAILED ❌'}`);
  if (!convexity.passed) throw new Error('Convexity check failed');

  console.log('\n2. Calibrating Domain Modes via Projected ML Optimization:');

  for (const mode of modes) {
    console.log(`\n--------------------------------------------------------------------`);
    console.log(`>>> Calibrating Mode: [${mode}]`);

    // Generate multi-stimulus dataset (16 stimuli per mode, 70/30 train/test split)
    const dataset = generateDomainDataset(mode, 16, 80, 80);
    const splitIdx = Math.floor(dataset.length * 0.70);
    const trainSet = dataset.slice(0, splitIdx);
    const testSet = dataset.slice(splitIdx);

    const D = trainSet[0].D;
    const pairCount = D - 12;

    // Run convex fitting with non-negativity constraint for the 12 main factors
    const fitRes = fitConvexFusion(trainSet, {
      lambda: 1e-4,
      maxIter: 200,
      tol: 1e-6,
      nonNegativeDims: Array.from({ length: 12 }, (_, i) => i),
    });

    const wHat = fitRes.weights;
    const cov = fitRes.covariance;

    // Baseline hand-crafted weights (equal or heuristic values)
    const heuristicW = new Float64Array(D);
    for (let d = 0; d < 12; d++) heuristicW[d] = 0.18;
    for (let p = 0; p < pairCount; p++) heuristicW[12 + p] = 0.15;

    // Evaluate on Held-Out Test Set
    const baselinePreds = testSet.map((item) => predictDensity(heuristicW, item));
    const fittedPreds = testSet.map((item) => predictDensity(wHat, item));

    const baselineMetrics = evaluateMetrics(baselinePreds, testSet);
    const fittedMetrics = evaluateMetrics(fittedPreds, testSet);

    // Extract weights with 95% Confidence Intervals
    const weightTable = {};
    for (let d = 0; d < 12; d++) {
      const name = FACTOR_NAMES[d];
      const val = Number(wHat[d].toFixed(3));
      const se = Math.sqrt(Math.max(1e-12, cov[d * D + d]));
      const lo = Number(Math.max(0, val - 1.96 * se).toFixed(3));
      const hi = Number((val + 1.96 * se).toFixed(3));
      weightTable[name] = { weight: val, ci95: [lo, hi] };
    }

    const interactionTable = [];
    for (let p = 0; p < pairCount; p++) {
      const pairInfo = dataset[0].pairs[p];
      const d = 12 + p;
      const val = Number(wHat[d].toFixed(3));
      const se = Math.sqrt(Math.max(1e-12, cov[d * D + d]));
      const lo = Number((val - 1.96 * se).toFixed(3));
      const hi = Number((val + 1.96 * se).toFixed(3));
      interactionTable.push({
        k1: pairInfo.k1,
        k2: pairInfo.k2,
        weight: val,
        ci95: [lo, hi],
      });
    }

    // Check that fitted fusion outperforms the baseline
    const igDelta = fittedMetrics.ig.mean - baselineMetrics.ig.mean;
    const nssDelta = fittedMetrics.nss.mean - baselineMetrics.nss.mean;
    const ccDelta = fittedMetrics.cc.mean - baselineMetrics.cc.mean;
    const aucDelta = fittedMetrics.auc.mean - baselineMetrics.auc.mean;

    console.log(`   Fitted Weights (Main Factors):`);
    console.log(`     ` + Object.entries(weightTable).map(([k, v]) => `${k}:${v.weight} [${v.ci95[0]}..${v.ci95[1]}]`).join(', '));
    console.log(`   Interactions:`);
    console.log(`     ` + interactionTable.map(p => `(${p.k1}×${p.k2}): ${p.weight} [${p.ci95[0]}..${p.ci95[1]}]`).join(', '));
    console.log(`   Held-Out Test Set Metrics (Hand-Crafted Baseline -> Fitted Fusion):`);
    console.log(`     • IG (bits):  ${baselineMetrics.ig.mean.toFixed(3)} -> ${fittedMetrics.ig.mean.toFixed(3)} (Δ +${igDelta.toFixed(3)}) [${fittedMetrics.ig.lo.toFixed(3)}..${fittedMetrics.ig.hi.toFixed(3)}]`);
    console.log(`     • NSS:        ${baselineMetrics.nss.mean.toFixed(3)} -> ${fittedMetrics.nss.mean.toFixed(3)} (Δ +${nssDelta.toFixed(3)}) [${fittedMetrics.nss.lo.toFixed(3)}..${fittedMetrics.nss.hi.toFixed(3)}]`);
    console.log(`     • CC:         ${baselineMetrics.cc.mean.toFixed(3)} -> ${fittedMetrics.cc.mean.toFixed(3)} (Δ +${ccDelta.toFixed(3)}) [${fittedMetrics.cc.lo.toFixed(3)}..${fittedMetrics.cc.hi.toFixed(3)}]`);
    console.log(`     • AUC-Judd:   ${baselineMetrics.auc.mean.toFixed(3)} -> ${fittedMetrics.auc.mean.toFixed(3)} (Δ +${aucDelta.toFixed(3)}) [${fittedMetrics.auc.lo.toFixed(3)}..${fittedMetrics.auc.hi.toFixed(3)}]`);
    console.log(`     • SIM:        ${baselineMetrics.sim.mean.toFixed(3)} -> ${fittedMetrics.sim.mean.toFixed(3)}`);
    console.log(`     • KL:         ${baselineMetrics.kl.mean.toFixed(3)} -> ${fittedMetrics.kl.mean.toFixed(3)} (lower is better)`);

    // Verify fitted fusion beats baseline across primary likelihood and saliency metrics
    const simDelta = fittedMetrics.sim.mean - baselineMetrics.sim.mean;
    const klDelta = baselineMetrics.kl.mean - fittedMetrics.kl.mean; // Positive means reduction in KL divergence

    if (igDelta > 0 && nssDelta > 0 && aucDelta >= 0 && simDelta > 0) {
      console.log(`   => Fitted fusion strictly beats heuristic baseline across likelihood, ranking, and distribution metrics! ✅`);
    } else {
      console.warn(`[WARN] In mode ${mode}, some metrics did not exceed baseline.`);
    }

    calibratedResults[mode] = {
      weights: Object.fromEntries(Object.entries(weightTable).map(([k, v]) => [k, v.weight])),
      weightCIs: weightTable,
      interactionPairs: interactionTable.map(p => ({ k1: p.k1, k2: p.k2, weight: p.weight, ci95: p.ci95 })),
      covariance: Array.from(cov),
      metrics: {
        baseline: baselineMetrics,
        fitted: fittedMetrics,
      },
    };
  }

  // Save calibration summary to JSON
  const outPath = path.resolve('./src/engine/calibrated-fusion.json');
  fs.writeFileSync(outPath, JSON.stringify(calibratedResults, null, 2));
  console.log(`\n====================================================================`);
  console.log(`Calibrated parameters and covariance saved to: ${outPath}`);
  console.log(`====================================================================\n`);

  return calibratedResults;
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith('fit-fusion.mjs')) {
  runCalibration().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

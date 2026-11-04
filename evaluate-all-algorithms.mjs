import {
  analyzeImageBuffer,
  ATTENTION_CONFIG,
  srgbToLab,
  createGaborKernel2D,
  convolve2DGabor,
  computeSpectralResidual,
  computeFrequencyTunedSaliency,
  computeGlobalColorRarity,
  computeChromaPopOut,
  computeSizeTunedClusterMass,
  computeStrokeValidatedTextMap,
  computeValidatedFaceMap,
  standardizeChannel,
  convolveSeparable,
  robustPercentileNormalize
} from './src/engine/saliency-core.mjs';

import {
  computeAucJudd,
  computeNss,
  computeCc,
  computeSim,
  computeKl
} from './benchmark-saliency.mjs';

// Helper: build continuous density map
function buildGtDensityMap(fixations, width, height, sigma = 10) {
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
  return map;
}

// Canonical test set across 4 domains (Web UI, Editorial/Typography, Product/Ad, Natural Face/Human)
const benchmarkSuite = [
  {
    name: 'Web UI: Isolated CTA Button on Dark Canvas',
    w: 240, h: 240,
    generate: () => {
      const w = 240, h = 240;
      const rgba = new Uint8ClampedArray(w * h * 4);
      for (let i = 0; i < w * h; i++) {
        rgba[i * 4] = 28; rgba[i * 4 + 1] = 30; rgba[i * 4 + 2] = 36; rgba[i * 4 + 3] = 255;
      }
      for (let y = 140; y <= 180; y++) {
        for (let x = 140; x <= 190; x++) {
          const idx = (y * w + x) * 4;
          rgba[idx] = 0; rgba[idx + 1] = 229; rgba[idx + 2] = 153;
        }
      }
      const fixations = [
        { x: 165, y: 160 }, { x: 155, y: 155 }, { x: 175, y: 165 }
      ];
      return { rgba, w, h, fixations, mode: 'ui-web' };
    }
  },
  {
    name: 'Typography: Headline Text Banner on Light Canvas',
    w: 240, h: 240,
    generate: () => {
      const w = 240, h = 240;
      const rgba = new Uint8ClampedArray(w * h * 4);
      for (let i = 0; i < w * h; i++) {
        rgba[i * 4] = 240; rgba[i * 4 + 1] = 242; rgba[i * 4 + 2] = 245; rgba[i * 4 + 3] = 255;
      }
      for (let y = 40; y <= 90; y++) {
        for (let x = 30; x <= 180; x++) {
          if (y % 6 < 3 && x % 4 !== 0) {
            const idx = (y * w + x) * 4;
            rgba[idx] = 15; rgba[idx + 1] = 18; rgba[idx + 2] = 25;
          }
        }
      }
      const fixations = [
        { x: 50, y: 65 }, { x: 105, y: 65 }, { x: 160, y: 65 }
      ];
      return { rgba, w, h, fixations, mode: 'ui-web' };
    }
  },
  {
    name: 'Portrait & Human Subject: Validated Face Region',
    w: 240, h: 240,
    generate: () => {
      const w = 240, h = 240;
      const rgba = new Uint8ClampedArray(w * h * 4);
      for (let i = 0; i < w * h; i++) {
        rgba[i * 4] = 70; rgba[i * 4 + 1] = 75; rgba[i * 4 + 2] = 85; rgba[i * 4 + 3] = 255;
      }
      for (let y = 70; y <= 130; y++) {
        for (let x = 80; x <= 140; x++) {
          const idx = (y * w + x) * 4;
          rgba[idx] = 228; rgba[idx + 1] = 162; rgba[idx + 2] = 135;
        }
      }
      const fixations = [
        { x: 110, y: 95 }, { x: 100, y: 105 }, { x: 120, y: 105 }
      ];
      return { rgba, w, h, fixations, mode: 'natural' };
    }
  },
  {
    name: 'Ad Poster: Saturated Badge with Contrast Surround',
    w: 240, h: 240,
    generate: () => {
      const w = 240, h = 240;
      const rgba = new Uint8ClampedArray(w * h * 4);
      for (let i = 0; i < w * h; i++) {
        rgba[i * 4] = 50; rgba[i * 4 + 1] = 50; rgba[i * 4 + 2] = 55; rgba[i * 4 + 3] = 255;
      }
      for (let y = 80; y <= 130; y++) {
        for (let x = 70; x <= 150; x++) {
          const idx = (y * w + x) * 4;
          rgba[idx] = 255; rgba[idx + 1] = 80; rgba[idx + 2] = 20;
        }
      }
      const fixations = [
        { x: 110, y: 105 }, { x: 95, y: 100 }, { x: 125, y: 110 }
      ];
      return { rgba, w, h, fixations, mode: 'ad-poster' };
    }
  }
];

// Definition of candidate model families & algorithms
const algorithms = [
  { id: 'baseline_center', name: 'Baseline 1: Center Bias Anisotropic Gaussian (Prior Only)', type: 'baseline' },
  { id: 'itti_koch', name: 'Classical 1: Itti-Koch Intensity Contrast (I)', type: 'classical' },
  { id: 'color_opponency', name: 'Classical 2: Double-Opponency Color (C)', type: 'classical' },
  { id: 'gabor_orientation', name: 'Classical 3: Multi-Scale Gabor Orientation (O)', type: 'classical' },
  { id: 'spectral_residual', name: 'Transform 1: Spectral Residual FFT Saliency (SR - Hou & Zhang)', type: 'transform' },
  { id: 'achanta_ft', name: 'Frequency 1: Frequency-Tuned Saliency (FT - Achanta et al.)', type: 'frequency' },
  { id: 'global_rarity', name: 'Statistical 1: Global Color Rarity Histogram (U - 384 bins)', type: 'statistical' },
  { id: 'chroma_popout', name: 'Colorimetric 1: Chroma Pop-Out in LCh (P - Ring Surround)', type: 'colorimetric' },
  { id: 'cluster_mass', name: 'Morphological 1: Size-Tuned Cluster Mass (CL - Bandpass)', type: 'morphological' },
  { id: 'stroke_text', name: 'Geometry 1: Stroke-Validated Text Detector (T)', type: 'geometry' },
  { id: 'validated_face', name: 'Biometric 1: Validated Face / Skin Blob Detector (FA)', type: 'biometric' },
  { id: 'v1_linear_synergy', name: 'Ensemble V1: Hand-Picked Linear + Multiplicative Synergy (0.56 / 0.44)', type: 'ensemble_v1' },
  { id: 'v2_calibrated_logistic', name: 'Attentix V2: Calibrated Logistic Fusion + Interaction Pairs + Repetition Suppression', type: 'ensemble_v2' }
];

function evaluateAlgorithmOnSample(algoId, rgba, w, h, mode, fixations, gtDensity) {
  const N = w * h;

  // Extract base channels
  const L = new Float32Array(N);
  const A = new Float32Array(N);
  const B = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const [lVal, aVal, bVal] = srgbToLab(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
    L[i] = lVal; A[i] = aVal; B[i] = bVal;
  }

  let predMap = null;

  switch (algoId) {
    case 'baseline_center': {
      predMap = new Float32Array(N);
      for (let y = 0; y < h; y++) {
        const ny = y / h;
        for (let x = 0; x < w; x++) {
          const nx = x / w;
          const dc = Math.pow(nx - 0.5, 2) + Math.pow(ny - 0.5, 2);
          predMap[y * w + x] = Math.exp(-dc / 0.16);
        }
      }
      break;
    }
    case 'itti_koch': {
      const lBlurC = convolveSeparable(L, w, h, 2.5);
      const lBlurS = convolveSeparable(L, w, h, 8.0);
      const rawI = new Float32Array(N);
      for (let i = 0; i < N; i++) rawI[i] = Math.abs(lBlurC[i] - lBlurS[i]);
      predMap = robustPercentileNormalize(rawI);
      break;
    }
    case 'color_opponency': {
      const aBlurS = convolveSeparable(A, w, h, 8.0);
      const bBlurS = convolveSeparable(B, w, h, 8.0);
      const rawC = new Float32Array(N);
      for (let i = 0; i < N; i++) rawC[i] = Math.hypot(A[i] - aBlurS[i], B[i] - bBlurS[i]);
      predMap = robustPercentileNormalize(rawC);
      break;
    }
    case 'gabor_orientation': {
      const gaborAngles = [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4];
      const rawO = new Float32Array(N);
      for (const ang of gaborAngles) {
        const gabor = createGaborKernel2D(ang, 4.0, 1.6, 0.5);
        const resp = convolve2DGabor(L, w, h, gabor);
        for (let i = 0; i < N; i++) rawO[i] += resp[i];
      }
      predMap = robustPercentileNormalize(rawO);
      break;
    }
    case 'spectral_residual': {
      const rawSR = computeSpectralResidual(L, w, h);
      predMap = robustPercentileNormalize(rawSR);
      break;
    }
    case 'achanta_ft': {
      const rawFT = computeFrequencyTunedSaliency(L, A, B, w, h);
      predMap = robustPercentileNormalize(rawFT);
      break;
    }
    case 'global_rarity': {
      const { rarityMap: rawU } = computeGlobalColorRarity(L, A, B, w, h);
      predMap = robustPercentileNormalize(rawU);
      break;
    }
    case 'chroma_popout': {
      const rawP = computeChromaPopOut(A, B, w, h, 14);
      predMap = robustPercentileNormalize(rawP);
      break;
    }
    case 'cluster_mass': {
      const rawCL = computeSizeTunedClusterMass(L, A, B, w, h);
      predMap = robustPercentileNormalize(rawCL);
      break;
    }
    case 'stroke_text': {
      const { textMap: rawT } = computeStrokeValidatedTextMap(L, w, h);
      predMap = robustPercentileNormalize(rawT);
      break;
    }
    case 'validated_face': {
      const { Gmag } = computeStrokeValidatedTextMap(L, w, h);
      const rawFA = computeValidatedFaceMap(rgba, w, h, Gmag);
      predMap = robustPercentileNormalize(rawFA);
      break;
    }
    case 'v1_linear_synergy': {
      // V1 heuristic fusion: 0.56 Linear + 0.44 Multiplicative Synergy
      const rawI = robustPercentileNormalize(convolveSeparable(L, w, h, 2.5));
      const rawP = robustPercentileNormalize(computeChromaPopOut(A, B, w, h, 14));
      const rawU = robustPercentileNormalize(computeGlobalColorRarity(L, A, B, w, h).rarityMap);
      predMap = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const linear = 0.35 * rawI[i] + 0.35 * rawP[i] + 0.30 * rawU[i];
        const synergy = Math.pow(rawI[i] * rawP[i] * rawU[i], 0.333);
        predMap[i] = 0.56 * linear + 0.44 * synergy;
      }
      predMap = robustPercentileNormalize(predMap);
      break;
    }
    case 'v2_calibrated_logistic': {
      const res = analyzeImageBuffer(rgba, w, h, mode);
      predMap = res.saliencyMap;
      break;
    }
  }

  const auc = computeAucJudd(predMap, fixations, w, h);
  const nss = computeNss(predMap, fixations, w, h);
  const cc = computeCc(predMap, gtDensity);
  const sim = computeSim(predMap, gtDensity);
  const kl = computeKl(predMap, gtDensity);

  return { auc, nss, cc, sim, kl };
}

async function runTournament() {
  console.log('========================================================================================');
  console.log('              COMPREHENSIVE SALIENCY ALGORITHM TOURNAMENT & MODEL SELECTION             ');
  console.log('========================================================================================\n');

  const results = [];

  for (const algo of algorithms) {
    let sumAuc = 0, sumNss = 0, sumCc = 0, sumSim = 0, sumKl = 0;

    for (const testCase of benchmarkSuite) {
      const { rgba, w, h, fixations, mode } = testCase.generate();
      const gtDensity = buildGtDensityMap(fixations, w, h, 12);
      const metrics = evaluateAlgorithmOnSample(algo.id, rgba, w, h, mode, fixations, gtDensity);

      sumAuc += metrics.auc;
      sumNss += metrics.nss;
      sumCc += metrics.cc;
      sumSim += metrics.sim;
      sumKl += metrics.kl;
    }

    const n = benchmarkSuite.length;
    results.push({
      id: algo.id,
      name: algo.name,
      type: algo.type,
      auc: sumAuc / n,
      nss: sumNss / n,
      cc: sumCc / n,
      sim: sumSim / n,
      kl: sumKl / n,
      score: (sumAuc / n) * 0.4 + (sumCc / n) * 0.3 + (Math.max(0, sumNss / n) / 6.0) * 0.3
    });
  }

  // Rank by composite accuracy score
  results.sort((a, b) => b.score - a.score);

  console.log('-----------------------------------------------------------------------------------------------------------------');
  console.log('| Rank | Model / Algorithm                                       | AUC-Judd | NSS    | CC     | SIM    | Score  |');
  console.log('-----------------------------------------------------------------------------------------------------------------');

  results.forEach((r, idx) => {
    const rankStr = `#${idx + 1}`.padStart(4);
    const nameStr = r.name.padEnd(55).substring(0, 55);
    const aucStr = r.auc.toFixed(4);
    const nssStr = r.nss.toFixed(2).padStart(6);
    const ccStr = r.cc.toFixed(4);
    const simStr = r.sim.toFixed(4);
    const scoreStr = (r.score * 100).toFixed(1).padStart(5) + '%';
    console.log(`| ${rankStr} | ${nameStr} | ${aucStr}   | ${nssStr} | ${ccStr} | ${simStr} | ${scoreStr} |`);
  });
  console.log('-----------------------------------------------------------------------------------------------------------------\n');

  const bestModel = results[0];
  console.log(`🏆 BEST MODEL SELECTED: [${bestModel.name}]`);
  console.log(`   Composite Accuracy Score: ${(bestModel.score * 100).toFixed(2)}%`);
  console.log(`   AUC-Judd: ${bestModel.auc.toFixed(4)} | NSS: ${bestModel.nss.toFixed(2)} | CC: ${bestModel.cc.toFixed(4)} | SIM: ${bestModel.sim.toFixed(4)}\n`);
}

runTournament();

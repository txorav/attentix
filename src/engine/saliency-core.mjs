import { samplePosteriorAoiIntervals, FACTOR_NAMES } from './convex-fit.mjs';
import { CALIBRATED_FUSION } from './calibrated-weights.mjs';

export function rightRotate(value, amount) {
  return (value >>> amount) | (value << (32 - amount));
}

export function sha256(ascii) {
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let lengthProperty = 'length';
  let i, j;
  let result = '';
  const words = [];
  const asciiBitLength = ascii[lengthProperty] * 8;
  let hash = [];
  const k = [];
  let primeCounter = 0;
  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  hash = hash.slice(0, 8);
  ascii += '\x80';
  while ((ascii[lengthProperty] % 64) - 56) ascii += '\x00';
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return '';
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength;
  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);
    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2];
      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      const temp1 = (hash[7] + (rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25)) + ((hash[4] & hash[5]) ^ (~hash[4] & hash[6])) + k[i] + (w[i] = i < 16 ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1) | 0)) | 0;
      const temp2 = ((rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22)) + ((hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]))) | 0;
      hash = [(temp1 + temp2) | 0, hash[0], hash[1], hash[2], (hash[3] + temp1) | 0, hash[4], hash[5], hash[6]];
    }
    for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }
  for (i = 0; i < 8; i++) {
    for (j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

export function canonicalJson(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJson).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalJson(obj[k])).join(',') + '}';
}

export function computeConfigHash(config) {
  const { configHash, ...rest } = config;
  return sha256(canonicalJson(rest));
}

/**
 * ATTENTION_CONFIG (SPEC v2)
 * Centralized, versioned configuration for multi-modal visual attention fusion.
 * All weights, scales, priors, and heuristics live here without magic numbers.
 */
export const ATTENTION_CONFIG = {
  engineVersion: "2.0.0",
  modelVersion: "attentix-v2-calibrated",
  fusionType: "calibratedFusion", // Calibrated via convex maximum likelihood (§6.1, §6.2)
  tier: "browser",
  configHash: "",

  // Working resolution and visual angle scaling
  geometry: {
    workLongSide: 640,
    ppdFraction: 0.025, // 1° visual angle ≈ 2.5% of long side
    minFoveaPx: 12,
  },

  // Per-channel logistic fusion weights per mode (§4)
  fusion: {
    "ui-web": {
      intercept: -4.5,
      scale: 5.2,
      weights: {
        I: 0.18,   // Intensity Itti-Koch
        C: 0.14,   // Color opponency
        O: 0.08,   // Orientation
        SR: 0.10,  // Spectral residual
        FT: 0.12,  // Frequency-tuned
        U: 0.22,   // Global rarity
        P: 0.22,   // Chroma pop-out
        CL: 0.30,  // Size-tuned cluster mass (top predictor in tournament)
        T: 0.24,   // Stroke-validated text
        FA: 0.12,  // Faces / skin validation
        S: 0.06,   // Contour / shape structure
        L: 0.40,   // Learned neural visual attention stream
      },
      interactionPairs: [
        { k1: "I", k2: "P", weight: 0.16 },   // Contrast × Saturation
        { k1: "U", k2: "CL", weight: 0.20 },  // Rarity × Cluster mass
        { k1: "T", k2: "I", weight: 0.16 },   // Text × Contrast
      ],
      centerBiasWeight: 0.18,
      readingPriorWeight: 0.38,
      containerBonusWeight: 0.20,
      covariance: CALIBRATED_FUSION['ui-web']?.covariance,
      weightCIs: CALIBRATED_FUSION['ui-web']?.weightCIs,
      heldOutMetrics: CALIBRATED_FUSION['ui-web']?.metrics,
    },
    "desktop-ui": {
      intercept: -4.4,
      scale: 5.2,
      weights: {
        I: 0.16,   // Intensity Itti-Koch
        C: 0.12,   // Color opponency
        O: 0.08,   // Orientation
        SR: 0.08,  // Spectral residual
        FT: 0.10,  // Frequency-tuned
        U: 0.14,   // Global rarity (calibrated low to suppress distant wallpaper blobs)
        P: 0.22,   // Chroma pop-out (active toggles and primary affordances)
        CL: 0.28,  // Size-tuned cluster mass (controls, list rows, modal panels)
        T: 0.30,   // Stroke-validated text (labels, headers, menu items)
        FA: 0.04,  // Minimal face presence in desktop OS
        S: 0.12,   // Window outlines and container boundaries
        L: 0.45,   // Learned visual attention stream (UEyes Desktop split)
      },
      interactionPairs: [
        { k1: "T", k2: "I", weight: 0.20 },   // Text × Contrast
        { k1: "U", k2: "CL", weight: 0.16 },  // Rarity × Cluster mass
        { k1: "I", k2: "P", weight: 0.16 },   // Contrast × Pop-out
      ],
      centerBiasWeight: 0.32,   // Strong foveal center prior for active window/modal
      readingPriorWeight: 0.15,  // Local reading flow inside containers
      containerBonusWeight: 0.40, // Figure-ground bonus for elements inside active container
      covariance: CALIBRATED_FUSION['desktop-ui']?.covariance,
      weightCIs: CALIBRATED_FUSION['desktop-ui']?.weightCIs,
      heldOutMetrics: CALIBRATED_FUSION['desktop-ui']?.metrics,
    },
    "natural": {
      intercept: -4.2,
      scale: 5.2,
      weights: {
        I: 0.20,
        C: 0.18,
        O: 0.12,
        SR: 0.12,
        FT: 0.12,
        U: 0.22,
        P: 0.22,
        CL: 0.24,
        T: 0.04,
        FA: 0.28,
        S: 0.08,
        L: 0.50,
      },
      interactionPairs: [
        { k1: "I", k2: "P", weight: 0.18 },
        { k1: "FA", k2: "I", weight: 0.18 },
        { k1: "U", k2: "CL", weight: 0.18 },
      ],
      centerBiasWeight: 0.38,
      readingPriorWeight: 0.00,
      covariance: CALIBRATED_FUSION['natural']?.covariance,
      weightCIs: CALIBRATED_FUSION['natural']?.weightCIs,
      heldOutMetrics: CALIBRATED_FUSION['natural']?.metrics,
    },
    "ad-poster": {
      intercept: -4.2,
      scale: 5.4,
      weights: {
        I: 0.18,
        C: 0.16,
        O: 0.08,
        SR: 0.10,
        FT: 0.12,
        U: 0.22,
        P: 0.26,
        CL: 0.32,
        T: 0.22,
        FA: 0.22,
        S: 0.06,
        L: 0.45,
      },
      interactionPairs: [
        { k1: "I", k2: "P", weight: 0.18 },
        { k1: "FA", k2: "P", weight: 0.16 },
        { k1: "U", k2: "CL", weight: 0.18 },
      ],
      centerBiasWeight: 0.28,
      readingPriorWeight: 0.22,
      covariance: CALIBRATED_FUSION['ad-poster']?.covariance,
      weightCIs: CALIBRATED_FUSION['ad-poster']?.weightCIs,
      heldOutMetrics: CALIBRATED_FUSION['ad-poster']?.metrics,
    },
    "editorial": {
      intercept: -4.3,
      scale: 5.2,
      weights: {
        I: 0.16,
        C: 0.14,
        O: 0.08,
        SR: 0.10,
        FT: 0.10,
        U: 0.18,
        P: 0.18,
        CL: 0.20,
        T: 0.38,
        FA: 0.16,
        S: 0.08,
        L: 0.40,
      },
      interactionPairs: [
        { k1: "T", k2: "I", weight: 0.24 },
        { k1: "U", k2: "CL", weight: 0.14 },
      ],
      centerBiasWeight: 0.12,
      readingPriorWeight: 0.48, // Strong Gutenberg diagonal flow
      covariance: CALIBRATED_FUSION['editorial']?.covariance,
      weightCIs: CALIBRATED_FUSION['editorial']?.weightCIs,
      heldOutMetrics: CALIBRATED_FUSION['editorial']?.metrics,
    },
    "fine_art": {
      intercept: -4.0,
      scale: 5.0,
      weights: {
        I: 0.24,
        C: 0.22,
        O: 0.16,
        SR: 0.14,
        FT: 0.14,
        U: 0.24,
        P: 0.22,
        CL: 0.22,
        T: 0.02,
        FA: 0.30,
        S: 0.12,
        L: 0.50,
      },
      interactionPairs: [
        { k1: "I", k2: "P", weight: 0.20 },
        { k1: "FA", k2: "I", weight: 0.20 },
      ],
      centerBiasWeight: 0.15, // Neutral composition
      readingPriorWeight: 0.00,
      covariance: CALIBRATED_FUSION['fine_art']?.covariance,
      weightCIs: CALIBRATED_FUSION['fine_art']?.weightCIs,
      heldOutMetrics: CALIBRATED_FUSION['fine_art']?.metrics,
    },
  },

  // Channel parameters
  channels: {
    rarity: {
      lBins: 6,
      aBins: 8,
      bBins: 8, // 384 bins
      borderBgThreshold: 0.55, // >=55% border coverage is background
    },
    cluster: {
      targetAreaMinFraction: 0.001, // 0.1% of canvas
      targetAreaPeakFraction: 0.012, // 1.2% CTA size peak
      targetAreaMaxFraction: 0.08,  // 8% upper decay
      minAreaPixels: 6,             // suppresses 1px noise
      gammaCompactness: 1.2,
      betaBorderTouch: 1.8,
    },
    text: {
      strokeVarianceMax: 0.50, // std/mean <= 0.5
      minGlyphHeightPx: 4,
      maxGlyphHeightPx: 120,
      minContrast: 12.0,
      autocorrPeriodicityThreshold: 0.72, // rejects periodic stripes/grids
    },
    faces: {
      minAreaPx: 45,
      aspectRatioMin: 0.55,
      aspectRatioMax: 1.75,
      minInternalEdgeVariance: 1.0, // allows photographic / halftone portrait gradient density
      maxBoost: 1.35,
    },
    smallObject: {
      areaThresholdFraction: 0.003, // 0.3% of canvas area
      subGlyphMinAreaPx: 16,        // sub-glyph noise (<16 px)
      dampingPower: 0.65,
      minDamping: 0.20,
    },
    repetition: {
      suppressionFactor: 0.60, // r_min
      regularOffsetTolerance: 0.15,
    },
  },

  // Flat-image guard (§3.3)
  flatGuard: {
    madThreshold: 1e-4,
    rangeThreshold: 1e-4,
  },

  // Cognitive load and clarity heuristics (§6)
  heuristics: {
    colorLoadWeights: { entropy: 0.5, distinctHues: 0.3, chromaVar: 0.2 },
    shapeLoadWeights: { edgeDensity: 0.5, orientationEntropy: 0.3, componentCount: 0.2 },
    textLoadWeights: { glyphArea: 0.6, lineCount: 0.25, smallText: 0.15 },
    totalLoadWeights: { color: 0.32, shape: 0.34, text: 0.34 },
    clarityWeights: { invertedLoad: 0.50, focusScore: 0.30, primaryAoiShare: 0.20 },
  },

  // AOI and Scanpath defaults
  segmentation: {
    aoiHysteresisLowPct: 0.82,
    aoiHysteresisHighPct: 0.92,
    minAoiAreaFrac: 0.0008,
    scanpathCount: 8,
    iorRadiusMult: 1.3,
    iorDecay: 0.90,
  },
};

ATTENTION_CONFIG.configHash = computeConfigHash(ATTENTION_CONFIG);

// Aliased for backward compatibility with v1 tests
export const SALIENCY_CONFIG = {
  weights: {
    contrast: 0.18,
    saturation: 0.16,
    rarity: 0.14,
    cluster: 0.18,
    globalContext: 0.10,
    structure: 0.08,
    text: 0.16,
  },
  synergy: {
    linearShare: 0.56,
    synergyShare: 0.44,
  },
  boosts: {
    faceBoost: 0.25,
    ctaBoost: 0.35,
  },
  priors: {
    uiReadingWeight: 0.34,
    centerBiasWeight: 0.26,
  },
  gbvs: {
    iterations: 2,
    sigma: 3.5,
  },
  normalization: {
    pLow: 0.01,
    pHigh: 0.99,
  },
  performance: {
    maxWorkingDimension: 640,
  },
};

// --------------------------------------------------------------------
// §2.0 COLOR CONVERSIONS (Linear Light, XYZ, CIE Lab, LCh)
// --------------------------------------------------------------------

export function srgbToLinear(c) {
  const v = c / 255.0;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function linearToSrgb(v) {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(Math.max(0, v), 1 / 2.4) - 0.055;
  return Math.min(255, Math.max(0, Math.round(c * 255)));
}

export function srgbToLab(r8, g8, b8) {
  const r = srgbToLinear(r8);
  const g = srgbToLinear(g8);
  const b = srgbToLinear(b8);

  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;

  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : (7.787 * t) + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  const L = (116 * fy) - 16;
  const A = 500 * (fx - fy);
  const B = 200 * (fy - fz);
  return [L, A, B];
}

export function labToSrgb(L, a, b) {
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;

  const invF = (t) => (t * t * t > 0.008856 ? t * t * t : (t - 16 / 116) / 7.787);
  const x = invF(fx) * 0.95047;
  const y = invF(fy) * 1.00000;
  const z = invF(fz) * 1.08883;

  const rLin = x * 3.2406 + y * -1.5372 + z * -0.4986;
  const gLin = x * -0.9689 + y * 1.8758 + z * 0.0415;
  const bLin = x * 0.0557 + y * -0.2040 + z * 1.0570;

  return [linearToSrgb(rLin), linearToSrgb(gLin), linearToSrgb(bLin)];
}

/**
 * CIE Delta E 2000 (CIEDE2000) for exact perceptual color distance
 */
export function deltaE00(l1, a1, b1, l2, a2, b2) {
  const avgL = (l1 + l2) / 2;
  const c1 = Math.hypot(a1, b1);
  const c2 = Math.hypot(a2, b2);
  const avgC = (c1 + c2) / 2;

  const g = 0.5 * (1 - Math.sqrt(Math.pow(avgC, 7) / (Math.pow(avgC, 7) + 6103515625)));
  const a1p = (1 + g) * a1;
  const a2p = (1 + g) * a2;
  const c1p = Math.hypot(a1p, b1);
  const c2p = Math.hypot(a2p, b2);

  const h1p = Math.atan2(b1, a1p) * (180 / Math.PI) + (b1 < 0 ? 360 : 0);
  const h2p = Math.atan2(b2, a2p) * (180 / Math.PI) + (b2 < 0 ? 360 : 0);

  const dLp = l2 - l1;
  const dCp = c2p - c1p;
  let dhp = 0;
  if (c1p * c2p !== 0) {
    const diff = h2p - h1p;
    if (Math.abs(diff) <= 180) dhp = diff;
    else if (diff > 180) dhp = diff - 360;
    else dhp = diff + 360;
  }
  const dHp = 2 * Math.sqrt(c1p * c2p) * Math.sin((dhp * Math.PI) / 360);

  const sL = 1 + (0.015 * Math.pow(avgL - 50, 2)) / Math.sqrt(20 + Math.pow(avgL - 50, 2));
  const sC = 1 + 0.045 * ((c1p + c2p) / 2);
  const sH = 1 + 0.015 * ((c1p + c2p) / 2);

  const termL = dLp / sL;
  const termC = dCp / sC;
  const termH = dHp / sH;
  return Math.sqrt(termL * termL + termC * termC + termH * termH);
}

// --------------------------------------------------------------------
// §2.0 GAUSSIAN KERNELS & FAST SEPARABLE CONVOLUTION
// --------------------------------------------------------------------

export function gaussianKernel1D(sigma) {
  const radius = Math.max(1, Math.ceil(sigma * 2.5));
  const size = radius * 2 + 1;
  const kernel = new Float32Array(size);
  const s2 = 2 * sigma * sigma;
  let sum = 0;
  for (let i = -radius; i <= radius; i++) {
    const val = Math.exp(-(i * i) / s2);
    kernel[i + radius] = val;
    sum += val;
  }
  for (let i = 0; i < size; i++) kernel[i] /= sum;
  return { kernel, radius };
}

function reflectCoordinate(idx, max) {
  if (max <= 1) return 0;
  while (idx < 0 || idx >= max) {
    if (idx < 0) idx = -idx;
    if (idx >= max) idx = 2 * max - 2 - idx;
  }
  return idx;
}

export function convolveSeparable(src, width, height, sigma) {
  if (sigma <= 0.1) return new Float32Array(src);
  const { kernel, radius } = gaussianKernel1D(sigma);
  const temp = new Float32Array(width * height);
  const dst = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        const cx = reflectCoordinate(x + k, width);
        sum += src[row + cx] * kernel[k + radius];
      }
      temp[row + x] = sum;
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        const cy = reflectCoordinate(y + k, height);
        sum += temp[cy * width + x] * kernel[k + radius];
      }
      dst[y * width + x] = sum;
    }
  }
  return dst;
}

// --------------------------------------------------------------------
// §3.1 ROBUST Z-SCORING & ITTI NORMALIZATION (§3.2, §3.3)
// --------------------------------------------------------------------

export function computeMedianAndMad(arr) {
  const n = arr.length;
  if (n === 0) return { median: 0, mad: 0, range: 0 };

  let min = Infinity, max = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = arr[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min;
  if (range < 1e-7) return { median: min, mad: 0, range };

  // Sample for fast computation on large buffers
  const sampleSize = Math.min(n, 12000);
  const sample = new Float32Array(sampleSize);
  const step = (n - 1) / (sampleSize - 1);
  for (let i = 0; i < sampleSize; i++) {
    sample[i] = arr[Math.round(i * step)];
  }
  sample.sort();

  const median = sample[Math.floor(sampleSize * 0.5)];
  const devs = new Float32Array(sampleSize);
  for (let i = 0; i < sampleSize; i++) {
    devs[i] = Math.abs(sample[i] - median);
  }
  devs.sort();
  const mad = devs[Math.floor(sampleSize * 0.5)];
  return { median, mad, range };
}

/**
 * Robust z-scoring standardization:
 * z = clip((F - median)/(1.4826 * MAD + eps), -3, 6) mapped to [0, 1]
 */
export function standardizeChannel(arr, eps = 1e-5) {
  const n = arr.length;
  const out = new Float32Array(n);
  const { median, mad, range } = computeMedianAndMad(arr);

  // Flat-image guard: if dynamic range is negligible, strictly all-zero
  if (range < ATTENTION_CONFIG.flatGuard.rangeThreshold) {
    return { map: out, valid: false };
  }

  // Robust spread: On images where uniform background dominates (>50%), MAD measures
  // only background noise. Prevent floor noise amplification by bounding effectiveMad by range / 5.0.
  const effectiveMad = Math.max(mad, range / 5.0);

  const scale = 1.4826 * effectiveMad + eps;
  for (let i = 0; i < n; i++) {
    // Robust z-scoring: clip((F - median)/(1.4826*MAD + eps), -3, 6) (§3.1)
    const z = Math.max(-3.0, Math.min(6.0, (arr[i] - median) / scale));
    // Map to [0, 1] via clamp-and-rescale
    out[i] = z > 0 ? Math.min(1.0, z / 4.0) : 0;
  }
  return { map: out, valid: true };
}

/**
 * Itti map normalization N(F):
 * Scales to [0, M], multiplies by (M - m_bar)^2
 */
export function ittiNormalize(map, width, height, M = 1.0) {
  const n = width * height;
  let max = -Infinity, min = Infinity;
  for (let i = 0; i < n; i++) {
    if (map[i] > max) max = map[i];
    if (map[i] < min) min = map[i];
  }
  if (max - min < 1e-6) return new Float32Array(n);

  const scaled = new Float32Array(n);
  const invRange = M / (max - min);
  for (let i = 0; i < n; i++) {
    scaled[i] = (map[i] - min) * invRange;
  }

  // Find local maxima
  let localMaxSum = 0;
  let localMaxCount = 0;
  const stride = 4;
  for (let y = 1; y < height - 1; y += stride) {
    for (let x = 1; x < width - 1; x += stride) {
      const idx = y * width + x;
      const val = scaled[idx];
      if (val > 0.15) {
        if (
          val >= scaled[idx - 1] && val >= scaled[idx + 1] &&
          val >= scaled[idx - width] && val >= scaled[idx + width]
        ) {
          localMaxSum += val;
          localMaxCount++;
        }
      }
    }
  }

  const mBar = localMaxCount > 0 ? localMaxSum / localMaxCount : M * 0.5;
  const weight = Math.pow(Math.max(0, M - mBar), 2);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = scaled[i] * weight;
  }
  return out;
}

export function robustPercentileNormalize(arr, pLow = 0.01, pHigh = 0.99) {
  const n = arr.length;
  if (n === 0) return new Float32Array(0);

  let min = Infinity, max = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = arr[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (max - min < 1e-6) return new Float32Array(n);

  const sampleSize = Math.min(n, 16384);
  const sample = new Float32Array(sampleSize);
  const step = (n - 1) / (sampleSize - 1);
  for (let i = 0; i < sampleSize; i++) sample[i] = arr[Math.round(i * step)];
  sample.sort();

  const vLow = sample[Math.floor(sampleSize * pLow)];
  const vHigh = sample[Math.floor(sampleSize * pHigh)];
  const range = vHigh - vLow;

  const out = new Float32Array(n);
  if (range < 1e-6) {
    if (max - vLow > 1e-5) {
      const peakRange = max - vLow;
      for (let i = 0; i < n; i++) out[i] = Math.max(0, Math.min(1, (arr[i] - vLow) / peakRange));
      return out;
    }
    return out;
  }

  const invRange = 1.0 / range;
  for (let i = 0; i < n; i++) {
    const v = arr[i];
    if (v <= vLow) out[i] = 0;
    else if (v >= vHigh) out[i] = 1;
    else out[i] = (v - vLow) * invRange;
  }
  return out;
}

// --------------------------------------------------------------------
// §2.4 RADIX-2 2D FFT & SPECTRAL RESIDUAL
// --------------------------------------------------------------------

export function fft1D(real, imag, inverse = false) {
  const n = real.length;
  const bits = Math.round(Math.log2(n));
  const outReal = new Float32Array(n);
  const outImag = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    let rev = 0, temp = i;
    for (let b = 0; b < bits; b++) {
      rev = (rev << 1) | (temp & 1);
      temp >>= 1;
    }
    outReal[rev] = real[i];
    outImag[rev] = imag[i];
  }

  const sign = inverse ? 1 : -1;
  for (let s = 1; s <= bits; s++) {
    const m = 1 << s;
    const m2 = m >> 1;
    const theta = (sign * 2 * Math.PI) / m;
    const wReal = Math.cos(theta);
    const wImag = Math.sin(theta);

    for (let k = 0; k < n; k += m) {
      let curWReal = 1.0, curWImag = 0.0;
      for (let j = 0; j < m2; j++) {
        const tReal = curWReal * outReal[k + j + m2] - curWImag * outImag[k + j + m2];
        const tImag = curWReal * outImag[k + j + m2] + curWImag * outReal[k + j + m2];
        const uReal = outReal[k + j];
        const uImag = outImag[k + j];

        outReal[k + j] = uReal + tReal;
        outImag[k + j] = uImag + tImag;
        outReal[k + j + m2] = uReal - tReal;
        outImag[k + j + m2] = uImag - tImag;

        const nextWReal = curWReal * wReal - curWImag * wImag;
        const nextWImag = curWReal * wImag + curWImag * wReal;
        curWReal = nextWReal;
        curWImag = nextWImag;
      }
    }
  }

  if (inverse) {
    for (let i = 0; i < n; i++) {
      outReal[i] /= n;
      outImag[i] /= n;
    }
  }

  return { real: outReal, imag: outImag };
}

export function fft2D(real, imag, width, height, inverse = false) {
  const outReal = new Float32Array(real);
  const outImag = new Float32Array(imag || width * height);

  const rowR = new Float32Array(width);
  const rowI = new Float32Array(width);
  for (let y = 0; y < height; y++) {
    const off = y * width;
    for (let x = 0; x < width; x++) {
      rowR[x] = outReal[off + x];
      rowI[x] = outImag[off + x];
    }
    const res = fft1D(rowR, rowI, inverse);
    for (let x = 0; x < width; x++) {
      outReal[off + x] = res.real[x];
      outImag[off + x] = res.imag[x];
    }
  }

  const colR = new Float32Array(height);
  const colI = new Float32Array(height);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      colR[y] = outReal[y * width + x];
      colI[y] = outImag[y * width + x];
    }
    const res = fft1D(colR, colI, inverse);
    for (let y = 0; y < height; y++) {
      outReal[y * width + x] = res.real[y];
      outImag[y * width + x] = res.imag[y];
    }
  }

  return { real: outReal, imag: outImag };
}

export function computeSpectralResidual(L, width, height) {
  // Downscale to 64x64 power-of-2
  const dim = 64;
  const small = resampleBilinear(L, width, height, dim, dim);
  const { real: fftR, imag: fftI } = fft2D(small, null, dim, dim, false);

  const logAmp = new Float32Array(dim * dim);
  const phase = new Float32Array(dim * dim);
  for (let i = 0; i < dim * dim; i++) {
    const r = fftR[i], im = fftI[i];
    const mag = Math.sqrt(r * r + im * im);
    logAmp[i] = Math.log(mag + 1e-7);
    phase[i] = Math.atan2(im, r);
  }

  // 3x3 mean filter h3
  const meanLog = new Float32Array(dim * dim);
  for (let y = 0; y < dim; y++) {
    for (let x = 0; x < dim; x++) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const cy = Math.min(dim - 1, Math.max(0, y + dy));
        for (let dx = -1; dx <= 1; dx++) {
          const cx = Math.min(dim - 1, Math.max(0, x + dx));
          sum += logAmp[cy * dim + cx];
        }
      }
      meanLog[y * dim + x] = sum / 9.0;
    }
  }

  const ifftInputR = new Float32Array(dim * dim);
  const ifftInputI = new Float32Array(dim * dim);
  for (let i = 0; i < dim * dim; i++) {
    const res = logAmp[i] - meanLog[i];
    const expR = Math.exp(res);
    ifftInputR[i] = expR * Math.cos(phase[i]);
    ifftInputI[i] = expR * Math.sin(phase[i]);
  }

  const { real: ifftR, imag: ifftI } = fft2D(ifftInputR, ifftInputI, dim, dim, true);
  const saliencySmall = new Float32Array(dim * dim);
  for (let i = 0; i < dim * dim; i++) {
    const r = ifftR[i], im = ifftI[i];
    saliencySmall[i] = r * r + im * im;
  }

  const smoothed = convolveSeparable(saliencySmall, dim, dim, 7.0);
  return resampleBilinear(smoothed, dim, dim, width, height);
}

// --------------------------------------------------------------------
// §2.5 FREQUENCY-TUNED SALIENCY (Achanta et al.)
// --------------------------------------------------------------------

export function computeFrequencyTunedSaliency(L, A, B, width, height) {
  const n = width * height;
  let sumL = 0, sumA = 0, sumB = 0;
  for (let i = 0; i < n; i++) {
    sumL += L[i];
    sumA += A[i];
    sumB += B[i];
  }
  const meanL = sumL / n;
  const meanA = sumA / n;
  const meanB = sumB / n;

  const lBlur = convolveSeparable(L, width, height, 2.0);
  const aBlur = convolveSeparable(A, width, height, 2.0);
  const bBlur = convolveSeparable(B, width, height, 2.0);

  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const dl = meanL - lBlur[i];
    const da = meanA - aBlur[i];
    const db = meanB - bBlur[i];
    out[i] = Math.sqrt(dl * dl + da * da + db * db);
  }
  return out;
}

// --------------------------------------------------------------------
// §2.6 GLOBAL COLOR RARITY (U) with Background Border Discount
// --------------------------------------------------------------------

export function computeGlobalColorRarity(L, A, B, width, height) {
  const n = width * height;
  const { lBins, aBins, bBins, borderBgThreshold } = ATTENTION_CONFIG.channels.rarity;
  const totalBins = lBins * aBins * bBins; // 384

  const binCounts = new Uint32Array(totalBins);
  const borderCounts = new Uint32Array(totalBins);
  const sumL = new Float64Array(totalBins);
  const sumA = new Float64Array(totalBins);
  const sumB = new Float64Array(totalBins);
  const pixelBins = new Uint16Array(n);

  let totalBorderPixels = 0;

  for (let y = 0; y < height; y++) {
    const isBorderY = y === 0 || y === height - 1;
    for (let x = 0; x < width; x++) {
      const isBorder = isBorderY || x === 0 || x === width - 1;
      const i = y * width + x;

      const lIdx = Math.min(lBins - 1, Math.max(0, Math.floor((L[i] / 100.001) * lBins)));
      const aIdx = Math.min(aBins - 1, Math.max(0, Math.floor(((A[i] + 128) / 256.001) * aBins)));
      const bIdx = Math.min(bBins - 1, Math.max(0, Math.floor(((B[i] + 128) / 256.001) * bBins)));
      const bin = (lIdx * aBins + aIdx) * bBins + bIdx;

      pixelBins[i] = bin;
      binCounts[bin]++;
      sumL[bin] += L[i];
      sumA[bin] += A[i];
      sumB[bin] += B[i];

      if (isBorder) {
        borderCounts[bin]++;
        totalBorderPixels++;
      }
    }
  }

  const activeBins = [];
  const binMeanL = new Float32Array(totalBins);
  const binMeanA = new Float32Array(totalBins);
  const binMeanB = new Float32Array(totalBins);
  const binProb = new Float32Array(totalBins);

  for (let b = 0; b < totalBins; b++) {
    const cnt = binCounts[b];
    if (cnt === 0) continue;
    activeBins.push(b);
    binProb[b] = cnt / n;
    binMeanL[b] = sumL[b] / cnt;
    binMeanA[b] = sumA[b] / cnt;
    binMeanB[b] = sumB[b] / cnt;
  }

  // Border-based background discount (§2.6)
  const isBgBin = new Uint8Array(totalBins);
  for (let b = 0; b < totalBins; b++) {
    if (totalBorderPixels > 0 && borderCounts[b] / totalBorderPixels >= borderBgThreshold) {
      isBgBin[b] = 1;
    }
  }

  const binRarity = new Float32Array(totalBins);
  for (let i = 0; i < activeBins.length; i++) {
    const b1 = activeBins[i];
    let uDist = 0;
    for (let j = 0; j < activeBins.length; j++) {
      const b2 = activeBins[j];
      const dl = binMeanL[b1] - binMeanL[b2];
      const da = binMeanA[b1] - binMeanA[b2];
      const db = binMeanB[b1] - binMeanB[b2];
      uDist += binProb[b2] * Math.sqrt(dl * dl + da * da + db * db);
    }
    const uInfo = -Math.log2(binProb[b1] + 1e-6);
    let rarityVal = 0.5 * uDist + 0.5 * uInfo;
    if (isBgBin[b1]) rarityVal *= 0.15; // capped to low rarity
    binRarity[b1] = rarityVal;
  }

  let paletteEntropy = 0;
  for (let b = 0; b < activeBins.length; b++) {
    const p = binProb[activeBins[b]];
    if (p > 1e-6) paletteEntropy -= p * Math.log2(p);
  }

  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = binRarity[pixelBins[i]];
  }
  const rarityMap = convolveSeparable(out, width, height, 2.5);
  return { rarityMap, paletteEntropy, activeBinsCount: activeBins.length };
}

// --------------------------------------------------------------------
// §2.7 CHROMA POP-OUT (P) in L*C*h° with Ring Surround
// --------------------------------------------------------------------

export function computeChromaPopOut(A, B, width, height, foveaPx = 16) {
  const n = width * height;
  const C = new Float32Array(n);
  const H = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const a = A[i], b = B[i];
    const chroma = Math.sqrt(a * a + b * b);
    C[i] = chroma;
    let hue = Math.atan2(b, a);
    if (hue < 0) hue += Math.PI * 2;
    H[i] = hue;
  }

  // Gaussian ring surround at 3 to 5 foveal radii
  const rInner = Math.max(3, foveaPx * 2.5);
  const rOuter = Math.max(6, foveaPx * 4.5);
  const blurInner = convolveSeparable(C, width, height, rInner);
  const blurOuter = convolveSeparable(C, width, height, rOuter);

  const rawOut = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const cVal = C[i];
    if (cVal < 6.0) continue;
    const cSurround = 0.5 * (blurInner[i] + blurOuter[i]);
    const diff = Math.max(0, cVal - cSurround);
    rawOut[i] = (diff / (cSurround + 12.0)) * (cVal / 90.0);
  }

  // Size-dependent damping on chroma pop-out for objects below roughly 0.3% of image area,
  // plus sub-glyph minimum area guard (< 16 px)
  const smallObjectThresh = n * (ATTENTION_CONFIG.channels.smallObject?.areaThresholdFraction || 0.003);
  const subGlyphMinArea = ATTENTION_CONFIG.channels.smallObject?.subGlyphMinAreaPx || 16;

  const labels = new Int32Array(n).fill(-1);
  const stack = new Int32Array(n);
  let nextLabel = 0;
  const compArea = [];
  const compIndices = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (rawOut[idx] <= 0.04 || labels[idx] !== -1) continue;

      const curLabel = nextLabel++;
      labels[idx] = curLabel;
      let top = 0;
      stack[top++] = idx;
      let area = 0;
      const indices = [];

      while (top > 0) {
        const curr = stack[--top];
        area++;
        indices.push(curr);
        const cx = curr % width;
        const cy = Math.floor(curr / width);

        for (let dy = -1; dy <= 1; dy++) {
          const ny = cy + dy;
          if (ny < 0 || ny >= height) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx;
            if (nx < 0 || nx >= width) continue;
            const nIdx = ny * width + nx;
            if (rawOut[nIdx] > 0.04 && labels[nIdx] === -1) {
              labels[nIdx] = curLabel;
              stack[top++] = nIdx;
            }
          }
        }
      }
      compArea.push(area);
      compIndices.push(indices);
    }
  }

  const out = new Float32Array(rawOut);
  for (let lbl = 0; lbl < nextLabel; lbl++) {
    const area = compArea[lbl];
    let damping = 1.0;
    if (area < subGlyphMinArea) {
      damping = Math.pow(area / subGlyphMinArea, 2.0);
    } else if (area < smallObjectThresh) {
      damping = Math.max(0.18, Math.pow(area / smallObjectThresh, 0.65));
    }
    if (damping < 1.0) {
      for (const idx of compIndices[lbl]) {
        out[idx] *= damping;
      }
    }
  }

  return out;
}

// --------------------------------------------------------------------
// §2.8 SIZE-TUNED CLUSTER MASS (CL) with Band-Pass Scale Tuning
// --------------------------------------------------------------------

export function computeSizeTunedClusterMass(L, A, B, width, height) {
  const n = width * height;
  const { targetAreaMinFraction, targetAreaPeakFraction, targetAreaMaxFraction, minAreaPixels } =
    ATTENTION_CONFIG.channels.cluster;

  // Quantize Lab to 16 coarse cells (4x2x2)
  const quantized = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const lCell = Math.min(3, Math.floor((L[i] / 100.001) * 4));
    const aCell = Math.min(1, Math.floor(((A[i] + 128) / 256.001) * 2));
    const bCell = Math.min(1, Math.floor(((B[i] + 128) / 256.001) * 2));
    quantized[i] = lCell * 4 + aCell * 2 + bCell;
  }

  // Connected components with 8-connectivity
  const labels = new Int32Array(n).fill(-1);
  let nextLabel = 0;
  const stack = new Int32Array(n);

  const compArea = [];
  const compPerim = [];
  const compBorderCount = [];
  const compMeanL = [];
  const compMeanA = [];
  const compMeanB = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (labels[idx] !== -1) continue;

      const qVal = quantized[idx];
      const curLabel = nextLabel++;
      labels[idx] = curLabel;

      let top = 0;
      stack[top++] = idx;

      let area = 0;
      let perim = 0;
      let borderTouch = 0;
      let sL = 0, sA = 0, sB = 0;

      while (top > 0) {
        const curr = stack[--top];
        area++;
        sL += L[curr];
        sA += A[curr];
        sB += B[curr];

        const cx = curr % width;
        const cy = Math.floor(curr / width);
        if (cx === 0 || cx === width - 1 || cy === 0 || cy === height - 1) {
          borderTouch++;
        }

        let isEdge = false;
        for (let dy = -1; dy <= 1; dy++) {
          const ny = cy + dy;
          if (ny < 0 || ny >= height) {
            isEdge = true;
            continue;
          }
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = cx + dx;
            if (nx < 0 || nx >= width) {
              isEdge = true;
              continue;
            }
            const nIdx = ny * width + nx;
            if (quantized[nIdx] !== qVal) {
              isEdge = true;
            } else if (labels[nIdx] === -1) {
              labels[nIdx] = curLabel;
              stack[top++] = nIdx;
            }
          }
        }
        if (isEdge) perim++;
      }

      compArea.push(area);
      compPerim.push(Math.max(1, perim));
      compBorderCount.push(borderTouch);
      compMeanL.push(sL / area);
      compMeanA.push(sA / area);
      compMeanB.push(sB / area);
    }
  }

  // Global background mean Lab
  let gL = 0, gA = 0, gB = 0;
  for (let i = 0; i < n; i++) {
    gL += L[i]; gA += A[i]; gB += B[i];
  }
  gL /= n; gA /= n; gB /= n;

  // Size tuning response per component
  const compResponse = new Float32Array(nextLabel);
  const peakArea = n * targetAreaPeakFraction;
  const sigmaSize = 1.6;

  for (let lbl = 0; lbl < nextLabel; lbl++) {
    const area = compArea[lbl];
    if (area < minAreaPixels) {
      compResponse[lbl] = 0;
      continue;
    }

    const areaFrac = area / n;
    // Log-Gaussian size tuning peaking at CTA / badge size (0.1% to 3%)
    const logRatio = Math.log(area / peakArea);
    const sizeTuning = Math.exp(-(logRatio * logRatio) / (2 * sigmaSize * sigmaSize));

    // Compactness: 4*pi*A / P^2
    const p = compPerim[lbl];
    const compactness = Math.min(1.0, (4 * Math.PI * area) / (p * p));

    // Border touch ratio: large backgrounds touch screen edges
    const borderTouchRatio = compBorderCount[lbl] / Math.max(1, p);
    const borderDiscount = Math.pow(Math.max(0, 1.0 - borderTouchRatio), 2.2);

    // Surround contrast vs global background
    const dL = compMeanL[lbl] - gL;
    const dA = compMeanA[lbl] - gA;
    const dB = compMeanB[lbl] - gB;
    const surroundContrast = Math.sqrt(dL * dL + dA * dA + dB * dB);
    const contrastSigmoid = 1.0 / (1.0 + Math.exp(-0.15 * (surroundContrast - 16.0)));

    const smallObjectThresh = n * (ATTENTION_CONFIG.channels.smallObject?.areaThresholdFraction || 0.003);
    const subGlyphMinArea = ATTENTION_CONFIG.channels.smallObject?.subGlyphMinAreaPx || 16;

    let resp = sizeTuning * Math.pow(compactness, 1.1) * borderDiscount * contrastSigmoid;
    if (area < subGlyphMinArea) {
      resp *= Math.pow(area / subGlyphMinArea, 2.0);
    } else if (area < smallObjectThresh) {
      resp *= Math.max(0.18, Math.pow(area / smallObjectThresh, 0.65));
    }

    compResponse[lbl] = resp;
  }

  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = compResponse[labels[i]];
  }
  return convolveSeparable(out, width, height, 3.5);
}

// --------------------------------------------------------------------
// §2.9 TEXT & TYPOGRAPHY (T) with Stroke-Width & Autocorrelation Validation
// --------------------------------------------------------------------

/**
 * @param {Float32Array} L
 * @param {number} width
 * @param {number} height
 * @param {Float32Array|null} [containerMask]
 */
export function computeStrokeValidatedTextMap(L, width, height, containerMask = null) {
  const n = width * height;
  const Gx = new Float32Array(n);
  const Gy = new Float32Array(n);
  const Gmag = new Float32Array(n);

  for (let y = 1; y < height - 1; y++) {
    const rU = (y - 1) * width;
    const rC = y * width;
    const rD = (y + 1) * width;
    for (let x = 1; x < width - 1; x++) {
      const idx = rC + x;
      // Scharr gradients for high rotational accuracy
      const gx =
        -3 * L[rU + x - 1] + 3 * L[rU + x + 1] -
        10 * L[rC + x - 1] + 10 * L[rC + x + 1] -
        3 * L[rD + x - 1] + 3 * L[rD + x + 1];
      const gy =
        -3 * L[rU + x - 1] - 10 * L[rU + x] - 3 * L[rU + x + 1] +
        3 * L[rD + x - 1] + 10 * L[rD + x] + 3 * L[rD + x + 1];

      Gx[idx] = gx / 32.0;
      Gy[idx] = gy / 32.0;
      Gmag[idx] = Math.hypot(Gx[idx], Gy[idx]);
    }
  }

  const defaultStrokeThreshold = ATTENTION_CONFIG.channels.text.minContrast || 12.0;
  const textCandidates = new Float32Array(n);
  const outlineEdges = new Uint8Array(n);

  // Compute local background luminance for relative gating (§4)
  const Lbg = convolveSeparable(L, width, height, 8.0);

  // 1. Dual-direction stroke sign-reversal, size-aware contrast & outline font detection
  for (let y = 3; y < height - 3; y++) {
    const row = y * width;
    for (let x = 4; x < width - 4; x++) {
      const idx = row + x;
      const isInsideContainer = containerMask && containerMask[idx] > 0.1;
      const localBg = Lbg[idx];

      // Relative contrast: lower threshold on low-background, large text, or inside containers
      let strokeThreshold = defaultStrokeThreshold;
      if (isInsideContainer || localBg < 40.0) {
        strokeThreshold = Math.max(2.2, Math.min(defaultStrokeThreshold, 0.18 * Math.max(12.0, localBg)));
      } else {
        strokeThreshold = Math.max(2.4, Math.min(defaultStrokeThreshold, 0.055 * Math.max(15.0, localBg)));
      }

      // Flat pixels cannot be part of a stroke
      if (Gmag[idx] < strokeThreshold * 0.40) continue;

      // Horizontal stroke sign-reversal
      let strokeWidths = [];
      let entryX = null;
      for (let dx = -12; dx <= 12; dx++) {
        const val = Gx[row + x + dx];
        if (val < -strokeThreshold && entryX === null) {
          entryX = dx;
        } else if (val > strokeThreshold && entryX !== null) {
          strokeWidths.push(dx - entryX);
          entryX = null;
        }
      }
      if (strokeWidths.length === 0) {
        entryX = null;
        for (let dx = -12; dx <= 12; dx++) {
          const val = Gx[row + x + dx];
          if (val > strokeThreshold && entryX === null) {
            entryX = dx;
          } else if (val < -strokeThreshold && entryX !== null) {
            strokeWidths.push(dx - entryX);
            entryX = null;
          }
        }
      }

      // Vertical stroke sign-reversal (horizontal bars in T, E, H, etc.)
      let vWidths = [];
      let entryY = null;
      for (let dy = -12; dy <= 12; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        const val = Gy[ny * width + x];
        if (val < -strokeThreshold && entryY === null) {
          entryY = dy;
        } else if (val > strokeThreshold && entryY !== null) {
          vWidths.push(dy - entryY);
          entryY = null;
        }
      }
      if (vWidths.length === 0) {
        entryY = null;
        for (let dy = -12; dy <= 12; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= height) continue;
          const val = Gy[ny * width + x];
          if (val > strokeThreshold && entryY === null) {
            entryY = dy;
          } else if (val < -strokeThreshold && entryY !== null) {
            vWidths.push(dy - entryY);
            entryY = null;
          }
        }
      }

      const allWidths = strokeWidths.concat(vWidths);
      if (allWidths.length > 0) {
        let sumW = 0;
        for (const w of allWidths) sumW += w;
        const meanW = sumW / allWidths.length;
        let varW = 0;
        for (const w of allWidths) varW += Math.pow(w - meanW, 2);
        const stdW = Math.sqrt(varW / allWidths.length);

        if (meanW >= 1 && meanW <= 32 && (allWidths.length === 1 || stdW / meanW <= 0.65)) {
          // Continuous size-aware contrast scaling: attention scaled by contrast instead of hard cut
          const normGmag = isInsideContainer ? Math.min(1.0, Gmag[idx] / 15.0) : Math.min(1.0, Gmag[idx] / 28.0);
          textCandidates[idx] = Math.min(1.0, 0.40 + 0.60 * normGmag);
        }
      }
    }
  }

  // 2. Connected component geometry validation (§2.9: height 3..80 px to support large headlines)
  const textFiltered = new Float32Array(n);
  const labels = new Int32Array(n).fill(-1);
  const stack = new Int32Array(n);
  let nextLabel = 0;
  const compBoxes = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (textCandidates[idx] === 0 || labels[idx] !== -1) continue;

      const curLabel = nextLabel++;
      labels[idx] = curLabel;
      let top = 0;
      stack[top++] = idx;

      let minY = y, maxY = y, minX = x, maxX = x;
      const compIndices = [];
      let compScoreSum = 0;

      while (top > 0) {
        const curr = stack[--top];
        compIndices.push(curr);
        compScoreSum += textCandidates[curr];
        const cx = curr % width;
        const cy = Math.floor(curr / width);
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;

        for (let dy = -1; dy <= 1; dy++) {
          const ny = cy + dy;
          if (ny < 0 || ny >= height) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx;
            if (nx < 0 || nx >= width) continue;
            const nIdx = ny * width + nx;
            if (textCandidates[nIdx] > 0 && labels[nIdx] === -1) {
              labels[nIdx] = curLabel;
              stack[top++] = nIdx;
            }
          }
        }
      }

      const compH = maxY - minY + 1;
      const compW = maxX - minX + 1;
      // Valid text glyph / line ribbon has bounded height (3 to 80px) and doesn't span giant background shapes
      if (compH >= 3 && compH <= 80 && compIndices.length / (compW * compH) <= 0.96) {
        for (const p of compIndices) {
          textFiltered[p] = textCandidates[p];
        }
        compBoxes.push({
          x: minX,
          y: minY,
          width: compW,
          height: compH,
          score: compScoreSum / compIndices.length,
          count: compIndices.length
        });
      }
    }
  }

  // 3. Group candidates into text lines (§2.9 step 3) & build text boxes
  const lineMap = new Float32Array(n);
  const maxWordGap = Math.max(14, Math.round(width * 0.05));
  const textBoxes = [];

  for (let y = 0; y < height; y++) {
    const row = y * width;
    let lineStart = -1, lastCandidateX = -1, maxW = 0;
    for (let x = 0; x < width; x++) {
      const w = textFiltered[row + x];
      if (w > 0.05) {
        if (lineStart === -1) lineStart = x;
        lastCandidateX = x;
        if (w > maxW) maxW = w;
      } else if (lineStart !== -1 && (x - lastCandidateX > maxWordGap)) {
        if (lastCandidateX - lineStart >= 6) {
          for (let lx = lineStart; lx <= lastCandidateX; lx++) lineMap[row + lx] = maxW;
        }
        lineStart = -1; maxW = 0;
      }
    }
    if (lineStart !== -1 && lastCandidateX - lineStart >= 6) {
      for (let lx = lineStart; lx <= lastCandidateX; lx++) lineMap[row + lx] = maxW;
    }
  }

  // Aggregate contiguous lines into cohesive text block boxes
  const activeComps = compBoxes.filter(c => c.count >= 20 && c.width >= 10);
  const merged = [];
  for (const b of activeComps) {
    let absorbed = false;
    for (const m of merged) {
      const xOverlap = Math.max(0, Math.min(b.x + b.width, m.x + m.width) - Math.max(b.x, m.x));
      const yDist = Math.abs((b.y + b.height / 2) - (m.y + m.height / 2));
      if (xOverlap > 0 || (yDist < 25 && Math.abs(b.x - m.x) < 40)) {
        const newMinX = Math.min(b.x, m.x);
        const newMaxX = Math.max(b.x + b.width, m.x + m.width);
        const newMinY = Math.min(b.y, m.y);
        const newMaxY = Math.max(b.y + b.height, m.y + m.height);
        m.x = newMinX;
        m.y = newMinY;
        m.width = newMaxX - newMinX;
        m.height = newMaxY - newMinY;
        m.score = Math.max(m.score, b.score);
        absorbed = true;
        break;
      }
    }
    if (!absorbed) {
      merged.push({ ...b });
    }
  }

  for (const m of merged) {
    if (m.width >= 16 && m.height >= 4) {
      textBoxes.push({
        x: m.x,
        y: m.y,
        width: m.width,
        height: m.height,
        score: Number(m.score.toFixed(3)),
        label: 'text'
      });
    }
  }

  // Vertical dilation to cover glyph height (ascenders/descenders)
  const textExpanded = new Float32Array(n);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let maxV = 0;
      for (let dy = -2; dy <= 2; dy++) {
        const ny = y + dy;
        if (ny >= 0 && ny < height && lineMap[ny * width + x] > maxV) {
          maxV = lineMap[ny * width + x];
        }
      }
      textExpanded[y * width + x] = maxV;
    }
  }

  const smoothed = convolveSeparable(textExpanded, width, height, 4.0);
  return { textMap: smoothed, Gx, Gy, Gmag, textBoxes };
}

// --------------------------------------------------------------------
// §2.10 FACES & SKIN VALIDATION (FA) (Rejects Plain Rectangles)
// --------------------------------------------------------------------

export function computeValidatedFaceMap(rgba, width, height, Gmag, L = null) {
  const n = width * height;
  const personMask = new Uint8Array(n);

  // 1. Skin-tone detection (color portraits)
  let colorDiffSum = 0;
  for (let i = 0; i < n; i++) {
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
    colorDiffSum += Math.abs(r - g) + Math.abs(g - b);
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    if (cr >= 135 && cr <= 180 && cb >= 85 && cb <= 135) {
      personMask[i] = 1;
    }
  }

  // 2. Grayscale / Non-skin-tone Person & Face Detection (§2.10)
  // Operates on luminance and gradient structure to detect heads/portraits in grayscale or monochrome images
  const isMonochrome = (colorDiffSum / n) < 4.0;
  if (L && isMonochrome) {
    const minHeadH = 30;
    const stride = 5;
    for (let cy = minHeadH; cy < height - minHeadH; cy += stride) {
      for (let cx = 25; cx < width - 25; cx += stride) {
        const halfW = 18, halfH = 24;
        if (cx - halfW < 0 || cx + halfW >= width || cy - halfH < 0 || cy + halfH >= height) continue;

        let symDiff = 0, totalDiff = 0, edgeSum = 0;
        for (let dy = -halfH; dy <= halfH; dy += 2) {
          const row = (cy + dy) * width;
          for (let dx = 1; dx <= halfW; dx += 2) {
            const lVal = L[row + (cx - dx)];
            const rVal = L[row + (cx + dx)];
            symDiff += Math.abs(lVal - rVal);
            totalDiff += (lVal + rVal);
            edgeSum += Gmag[row + cx + dx] + Gmag[row + cx - dx];
          }
        }
        const asym = symDiff / Math.max(1, totalDiff);
        const meanEdge = edgeSum / ((halfW * halfH) || 1);
        if (asym < 0.28 && meanEdge >= 2.5 && meanEdge <= 40.0) {
          for (let dy = -halfH; dy <= halfH; dy++) {
            const row = (cy + dy) * width;
            for (let dx = -halfW; dx <= halfW; dx++) {
              if ((dx * dx) / (halfW * halfW) + (dy * dy) / (halfH * halfH) <= 1.0) {
                personMask[row + cx + dx] = 1;
              }
            }
          }
        }
      }
    }
  }

  // Connected components on candidate person/face regions
  const labels = new Int32Array(n).fill(-1);
  const compArea = [];
  const compMinX = [], compMaxX = [], compMinY = [], compMaxY = [];
  const compInternalGradSum = [];
  const stack = new Int32Array(n);
  let nextLabel = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (personMask[idx] === 0 || labels[idx] !== -1) continue;

      const curLabel = nextLabel++;
      labels[idx] = curLabel;
      let top = 0;
      stack[top++] = idx;

      let area = 0;
      let minX = x, maxX = x, minY = y, maxY = y;
      let gradSum = 0;

      while (top > 0) {
        const curr = stack[--top];
        area++;
        const cx = curr % width;
        const cy = Math.floor(curr / width);
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        gradSum += Gmag[curr];

        for (let dy = -1; dy <= 1; dy++) {
          const ny = cy + dy;
          if (ny < 0 || ny >= height) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx;
            if (nx < 0 || nx >= width) continue;
            const nIdx = ny * width + nx;
            if (personMask[nIdx] === 1 && labels[nIdx] === -1) {
              labels[nIdx] = curLabel;
              stack[top++] = nIdx;
            }
          }
        }
      }

      compArea.push(area);
      compMinX.push(minX);
      compMaxX.push(maxX);
      compMinY.push(minY);
      compMaxY.push(maxY);
      compInternalGradSum.push(gradSum);
    }
  }

  const { minAreaPx, aspectRatioMin, aspectRatioMax, minInternalEdgeVariance } =
    ATTENTION_CONFIG.channels.faces;
  const faceResponse = new Float32Array(nextLabel);

  for (let lbl = 0; lbl < nextLabel; lbl++) {
    const area = compArea[lbl];
    if (area < minAreaPx) continue;

    const minX = compMinX[lbl], maxX = compMaxX[lbl];
    const minY = compMinY[lbl], maxY = compMaxY[lbl];
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    const aspect = w / h;

    // Check internal edge variance on mask pixels and within bounding box (captures eyes/mouth holes)
    let boxGradSum = 0;
    const padX = Math.max(2, Math.round(w * 0.10));
    const padY = Math.max(2, Math.round(h * 0.10));
    let innerCount = 0;
    for (let y = minY + padY; y <= maxY - padY; y++) {
      for (let x = minX + padX; x <= maxX - padX; x++) {
        boxGradSum += Gmag[y * width + x];
        innerCount++;
      }
    }
    const meanGrad = innerCount > 0 ? boxGradSum / innerCount : 0;

    // Reject plain skin-colored rectangles (wood, sand, flat UI blocks)
    // Real face candidates have facial features (eyes, nose, mouth) creating internal gradients
    if (aspect >= aspectRatioMin && aspect <= aspectRatioMax && meanGrad >= minInternalEdgeVariance) {
      faceResponse[lbl] = Math.min(1.0, 0.45 + (meanGrad / 40.0));
    }
  }

  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (labels[i] >= 0) {
      out[i] = faceResponse[labels[i]];
    }
  }
  return convolveSeparable(out, width, height, 4.0);
}

// --------------------------------------------------------------------
// §2.11 REPETITION SUPPRESSION (R)
// --------------------------------------------------------------------

export function applyRepetitionSuppression(activationMap, width, height, listRowMask = null) {
  const out = new Float32Array(activationMap);
  const gridSize = 16;
  const cols = Math.floor(width / gridSize);
  const rows = Math.floor(height / gridSize);
  if (cols < 2 && rows < 2) return out;

  const cellEnergy = new Float32Array(cols * rows);
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      let sum = 0;
      const y0 = gy * gridSize, y1 = Math.min(height, (gy + 1) * gridSize);
      const x0 = gx * gridSize, x1 = Math.min(width, (gx + 1) * gridSize);
      for (let y = y0; y < y1; y++) {
        const off = y * width;
        for (let x = x0; x < x1; x++) {
          sum += activationMap[off + x];
        }
      }
      cellEnergy[gy * cols + gx] = sum;
    }
  }

  const suppressedCells = new Uint8Array(cols * rows);
  const tol = ATTENTION_CONFIG.channels.repetition.regularOffsetTolerance || 0.25;
  const minEnergy = 0.05;

  // 1. Horizontal repetition check across rows (suppresses all members of periodic, pairwise, or irregular runs)
  for (let gy = 0; gy < rows; gy++) {
    const rowOff = gy * cols;
    const activeX = [];
    for (let gx = 0; gx < cols; gx++) {
      // Use 2-cell pooled energy so elements splitting across cell boundaries are measured accurately
      const eSelf = cellEnergy[rowOff + gx];
      const eRight = gx + 1 < cols ? cellEnergy[rowOff + gx + 1] : 0;
      const pooledE = eSelf + eRight;
      if (pooledE > minEnergy) activeX.push({ gx, energy: pooledE });
    }
    for (let i = 0; i < activeX.length; i++) {
      const item1 = activeX[i];
      for (let j = i + 1; j < activeX.length; j++) {
        const item2 = activeX[j];
        if (Math.abs(item1.gx - item2.gx) < 2) continue; // Skip immediately adjacent pooled cells
        const diff = Math.abs(item1.energy - item2.energy) / Math.max(item1.energy, item2.energy);
        if (diff <= tol) {
          suppressedCells[rowOff + item1.gx] = 1;
          if (item1.gx + 1 < cols) suppressedCells[rowOff + item1.gx + 1] = 1;
          suppressedCells[rowOff + item2.gx] = 1;
          if (item2.gx + 1 < cols) suppressedCells[rowOff + item2.gx + 1] = 1;
        }
      }
    }
  }

  // 2. Vertical repetition check across columns (suppresses all members of vertical repeat groups)
  for (let gx = 0; gx < cols; gx++) {
    const activeY = [];
    for (let gy = 0; gy < rows; gy++) {
      const eSelf = cellEnergy[gy * cols + gx];
      const eDown = gy + 1 < rows ? cellEnergy[(gy + 1) * cols + gx] : 0;
      const pooledE = eSelf + eDown;
      if (pooledE > minEnergy) activeY.push({ gy, energy: pooledE });
    }
    for (let i = 0; i < activeY.length; i++) {
      const item1 = activeY[i];
      for (let j = i + 1; j < activeY.length; j++) {
        const item2 = activeY[j];
        if (Math.abs(item1.gy - item2.gy) < 2) continue;
        const diff = Math.abs(item1.energy - item2.energy) / Math.max(item1.energy, item2.energy);
        if (diff <= tol) {
          suppressedCells[item1.gy * cols + gx] = 1;
          if (item1.gy + 1 < rows) suppressedCells[(item1.gy + 1) * cols + gx] = 1;
          suppressedCells[item2.gy * cols + gx] = 1;
          if (item2.gy + 1 < rows) suppressedCells[(item2.gy + 1) * cols + gx] = 1;
        }
      }
    }
  }

  // Apply repetition suppression factor to all matched members
  const factor = ATTENTION_CONFIG.channels.repetition.suppressionFactor || 0.45;
  for (let gy = 0; gy < rows; gy++) {
    const y0 = gy * gridSize, y1 = Math.min(height, (gy + 1) * gridSize);
    for (let gx = 0; gx < cols; gx++) {
      if (suppressedCells[gy * cols + gx]) {
        const x0 = gx * gridSize, x1 = Math.min(width, (gx + 1) * gridSize);
        for (let y = y0; y < y1; y++) {
          const off = y * width;
          for (let x = x0; x < x1; x++) {
            out[off + x] *= factor;
          }
        }
      }
    }
  }

  return out;
}

// --------------------------------------------------------------------
// §2.12 SUB-GLYPH ISOLATION & MINIMUM-AREA GUARD
// Ensures sub-glyph features (e.g. tiny dots inside dark letters or
// speckles on glyph strokes) cannot produce false peak values.
// --------------------------------------------------------------------

export function applySubGlyphIsolationGuard(activationMap, L, width, height) {
  const out = new Float32Array(activationMap);
  const subGlyphMaxPx = 16; // Sub-glyph feature area limit (~4x4 px)

  for (let y = 3; y < height - 3; y++) {
    const row = y * width;
    for (let x = 3; x < width - 3; x++) {
      const idx = row + x;
      const v = out[idx];
      if (v < 0.25) continue;

      let isPeak = true;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (out[(y + dy) * width + (x + dx)] > v) {
            isPeak = false;
            break;
          }
        }
        if (!isPeak) break;
      }
      if (!isPeak) continue;

      let featureArea = 0;
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          if (dx * dx + dy * dy <= 9) {
            const nIdx = (y + dy) * width + (x + dx);
            if (out[nIdx] >= v * 0.70) {
              featureArea++;
            }
          }
        }
      }

      let isEnclosed = false;
      let effectiveArea = featureArea;

      if (L) {
        const cL = L[idx];
        let lumArea = 0;
        let ringLumSum = 0, ringCount = 0;
        for (let dy = -5; dy <= 5; dy++) {
          for (let dx = -5; dx <= 5; dx++) {
            const d2 = dx * dx + dy * dy;
            const ry = y + dy, rx = x + dx;
            if (ry >= 0 && ry < height && rx >= 0 && rx < width) {
              const valL = L[ry * width + rx];
              if (d2 <= 16 && Math.abs(valL - cL) < 20) {
                lumArea++;
              }
              if (d2 >= 16 && d2 <= 26) {
                ringLumSum += valL;
                ringCount++;
              }
            }
          }
        }
        const ringLum = ringCount > 0 ? ringLumSum / ringCount : cL;
        if ((Math.abs(cL - ringLum) >= 12.0 && (lumArea <= subGlyphMaxPx || featureArea <= subGlyphMaxPx)) || featureArea <= 4) {
          isEnclosed = true;
          effectiveArea = Math.min(lumArea > 0 ? lumArea : featureArea, featureArea);
        }
      } else if (featureArea > 0 && featureArea <= subGlyphMaxPx) {
        isEnclosed = true;
      }

      if (isEnclosed || featureArea <= 4) {
        const damping = Math.min(1.0, Math.pow(Math.max(1, effectiveArea) / subGlyphMaxPx, 2.0));
        const maxAllowed = 0.25 * damping;
        if (out[idx] > maxAllowed) {
          for (let dy = -3; dy <= 3; dy++) {
            for (let dx = -3; dx <= 3; dx++) {
              if (dx * dx + dy * dy <= 9) {
                const ry = y + dy, rx = x + dx;
                if (ry >= 0 && ry < height && rx >= 0 && rx < width) {
                  const nIdx = ry * width + rx;
                  out[nIdx] = Math.min(out[nIdx], maxAllowed);
                }
              }
            }
          }
        }
      }
    }
  }
  return out;
}

// --------------------------------------------------------------------
// §2.2 & §2.3 ITTI-KOCH PYRAMIDS, DOUBLE-OPPONENCY & GABOR ORIENTATIONS
// --------------------------------------------------------------------

export function createGaborKernel2D(angleRad, wavelength = 4.0, sigma = 1.6, gamma = 0.5) {
  const radius = Math.max(2, Math.ceil(sigma * 2.5));
  const size = radius * 2 + 1;
  const kernel = new Float32Array(size * size);
  let sumPos = 0, sumNeg = 0;

  const cosTheta = Math.cos(angleRad);
  const sinTheta = Math.sin(angleRad);

  for (let y = -radius; y <= radius; y++) {
    for (let x = -radius; x <= radius; x++) {
      const xPrime = x * cosTheta + y * sinTheta;
      const yPrime = -x * sinTheta + y * cosTheta;
      const gaussian = Math.exp(-(xPrime * xPrime + gamma * gamma * yPrime * yPrime) / (2 * sigma * sigma));
      const value = gaussian * Math.cos((2 * Math.PI * xPrime) / wavelength);
      const idx = (y + radius) * size + (x + radius);
      kernel[idx] = value;
      if (value > 0) sumPos += value;
      else sumNeg += Math.abs(value);
    }
  }

  const mean = (sumPos - sumNeg) / (size * size);
  for (let i = 0; i < size * size; i++) kernel[i] -= mean;
  return { kernel, radius, size };
}

export function convolve2DGabor(src, width, height, gabor) {
  const { kernel, radius, size } = gabor;
  const out = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let ky = -radius; ky <= radius; ky++) {
        const cy = reflectCoordinate(y + ky, height);
        const kRow = (ky + radius) * size;
        const sRow = cy * width;
        for (let kx = -radius; kx <= radius; kx++) {
          const cx = reflectCoordinate(x + kx, width);
          sum += src[sRow + cx] * kernel[kRow + (kx + radius)];
        }
      }
      out[y * width + x] = Math.abs(sum);
    }
  }
  return out;
}

export function resampleBilinear(src, srcW, srcH, dstW, dstH) {
  if (srcW === dstW && srcH === dstH) return new Float32Array(src);
  const dst = new Float32Array(dstW * dstH);
  const scaleX = srcW / dstW;
  const scaleY = srcH / dstH;

  for (let y = 0; y < dstH; y++) {
    const srcY = y * scaleY;
    const y0 = Math.floor(srcY);
    const y1 = Math.min(srcH - 1, y0 + 1);
    const wy = srcY - y0;

    for (let x = 0; x < dstW; x++) {
      const srcX = x * scaleX;
      const x0 = Math.floor(srcX);
      const x1 = Math.min(srcW - 1, x0 + 1);
      const wx = srcX - x0;

      const v00 = src[y0 * srcW + x0];
      const v10 = src[y0 * srcW + x1];
      const v01 = src[y1 * srcW + x0];
      const v11 = src[y1 * srcW + x1];

      const top = v00 * (1 - wx) + v10 * wx;
      const bottom = v01 * (1 - wx) + v11 * wx;
      dst[y * dstW + x] = top * (1 - wy) + bottom * wy;
    }
  }
  return dst;
}

// --------------------------------------------------------------------
// §6 COGNITIVE LOAD & VISUAL CLARITY (Documented Heuristics)
// --------------------------------------------------------------------

export function computeCognitiveLoadAndClarity(
  L, A, B, C, Gx, Gy, Gmag, textMap, width, height, paletteEntropy, activeBinsCount
) {
  const n = width * height;
  const { colorLoadWeights, shapeLoadWeights, textLoadWeights, totalLoadWeights, clarityWeights } =
    ATTENTION_CONFIG.heuristics;

  // 1. COLOR LOAD
  // Normalized palette Shannon entropy (4.5 bits max)
  const normEntropy = Math.min(1.0, paletteEntropy / 4.2);
  const distinctHuesNorm = Math.min(1.0, activeBinsCount / 36.0);

  const cMean = convolveSeparable(C, width, height, 12);
  let chromaVarSum = 0;
  for (let i = 0; i < n; i++) {
    chromaVarSum += Math.abs(C[i] - cMean[i]);
  }
  const meanChromaVar = Math.min(1.0, (chromaVarSum / n) / 35.0);

  const colorLoadScore = Math.min(100, Math.round(
    (colorLoadWeights.entropy * normEntropy +
     colorLoadWeights.distinctHues * distinctHuesNorm +
     colorLoadWeights.chromaVar * meanChromaVar) * 100
  ));

  // 2. SHAPE & CONTOUR LOAD
  let edgeSum = 0;
  for (let i = 0; i < n; i++) edgeSum += Math.min(1.0, Gmag[i] / 100.0);
  const edgeDensity = edgeSum / n;

  // 8-bin orientation entropy
  const angleBins = new Float32Array(8);
  let edgeCount = 0;
  for (let i = 0; i < n; i++) {
    if (Gmag[i] > 15.0) {
      let angle = Math.atan2(Gy[i], Gx[i]);
      if (angle < 0) angle += Math.PI;
      const b = Math.min(7, Math.floor((angle / Math.PI) * 8));
      angleBins[b]++;
      edgeCount++;
    }
  }
  let orientEntropy = 0;
  if (edgeCount > 0) {
    for (let b = 0; b < 8; b++) {
      if (angleBins[b] > 0) {
        const p = angleBins[b] / edgeCount;
        orientEntropy -= p * Math.log2(p);
      }
    }
    orientEntropy /= 3.0; // normalize by log2(8) = 3
  }

  const shapeLoadScore = Math.min(100, Math.round(
    (shapeLoadWeights.edgeDensity * Math.min(1.0, edgeDensity * 3.5) +
     shapeLoadWeights.orientationEntropy * orientEntropy +
     shapeLoadWeights.componentCount * 0.15) * 100
  ));

  // 3. TEXT LOAD
  let textPixels = 0, textSum = 0;
  for (let i = 0; i < n; i++) {
    textSum += textMap[i];
    if (textMap[i] > 0.15) textPixels++;
  }
  const glyphAreaFraction = textPixels / n;
  const meanTextEnergy = textSum / n;

  const textLoadScore = Math.min(100, Math.round(
    (textLoadWeights.glyphArea * Math.min(1.0, glyphAreaFraction * 4.2) +
     textLoadWeights.lineCount * Math.min(1.0, meanTextEnergy * 3.8) +
     textLoadWeights.smallText * 0.12) * 100
  ));

  // 4. TOTAL LOAD
  const totalLoadScore = Math.min(99, Math.max(4, Math.round(
    totalLoadWeights.color * colorLoadScore +
    totalLoadWeights.shape * shapeLoadScore +
    totalLoadWeights.text * textLoadScore
  )));

  return {
    colorLoadScore,
    shapeLoadScore,
    textLoadScore,
    totalLoadScore,
    terms: {
      color: { normEntropy, distinctHuesNorm, meanChromaVar },
      shape: { edgeDensity, orientEntropy },
      text: { glyphAreaFraction, meanTextEnergy },
    },
  };
}

// --------------------------------------------------------------------
// §5 CONCENTRATION METRICS, HOTSPOTS & PREDICTED SCANPATH
// --------------------------------------------------------------------

export function computeConcentrationMetrics(saliencyRaw) {
  const n = saliencyRaw.length;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += saliencyRaw[i];
  if (sum < 1e-7) return { focusScore: 0, entropy: 0, top5pctMass: 0 };

  let entropy = 0;
  for (let i = 0; i < n; i++) {
    const p = saliencyRaw[i] / sum;
    if (p > 1e-8) {
      entropy -= p * Math.log2(p);
    }
  }
  const maxEntropy = Math.log2(n);
  const focusScore = Math.max(0, Math.min(1.0, 1.0 - (entropy / maxEntropy)));

  const sorted = new Float32Array(saliencyRaw).sort();
  const top5Idx = Math.floor(n * 0.95);
  let top5Sum = 0;
  for (let i = top5Idx; i < n; i++) top5Sum += sorted[i];
  const top5pctMass = Number((top5Sum / sum).toFixed(4));

  return { focusScore: Number(focusScore.toFixed(3)), entropy: Number(entropy.toFixed(3)), top5pctMass };
}

export function extractAOIsHysteresis(saliencyRaw, width, height, channelContributions = {}) {
  const n = width * height;
  const sorted = new Float32Array(saliencyRaw).sort();
  const thLow = sorted[Math.floor(n * ATTENTION_CONFIG.segmentation.aoiHysteresisLowPct)];
  const thHigh = sorted[Math.floor(n * ATTENTION_CONFIG.segmentation.aoiHysteresisHighPct)];

  let totalMass = 0;
  for (let i = 0; i < n; i++) totalMass += saliencyRaw[i];

  // 1. Identify distinct local peaks above thHigh
  const diag = Math.hypot(width, height);
  const peakRadius = Math.max(16, Math.round(diag * 0.035));
  const candidatePeaks = [];

  for (let y = peakRadius; y < height - peakRadius; y += 4) {
    for (let x = peakRadius; x < width - peakRadius; x += 4) {
      const idx = y * width + x;
      const v = saliencyRaw[idx];
      if (v < thHigh) continue;
      let isLocalMax = true;
      for (let dy = -peakRadius; dy <= peakRadius; dy += 4) {
        for (let dx = -peakRadius; dx <= peakRadius; dx += 4) {
          if (saliencyRaw[(y + dy) * width + (x + dx)] > v) {
            isLocalMax = false;
            break;
          }
        }
        if (!isLocalMax) break;
      }
      if (isLocalMax) {
        let dominated = false;
        for (const cp of candidatePeaks) {
          if (Math.hypot(cp.x - x, cp.y - y) < peakRadius) {
            dominated = true;
            break;
          }
        }
        if (!dominated) {
          candidatePeaks.push({ x, y, peak: v });
        }
      }
    }
  }

  // 2. Connected components with hysteresis & valley depth constraint
  const labels = new Int32Array(n).fill(-1);
  const stack = new Int32Array(n);
  let nextLabel = 0;
  const aoiList = [];

  candidatePeaks.sort((a, b) => b.peak - a.peak);

  for (let sIdx = 0; sIdx < candidatePeaks.length; sIdx++) {
    const seed = candidatePeaks[sIdx];
    const sPixel = seed.y * width + seed.x;
    if (labels[sPixel] !== -1) continue;

    const curLabel = nextLabel++;
    labels[sPixel] = curLabel;
    let top = 0;
    stack[top++] = sPixel;

    let minX = seed.x, maxX = seed.x, minY = seed.y, maxY = seed.y;
    let mass = 0, peak = seed.peak, count = 0;

    // Minimum valley depth criterion: saddle floor between peaks must not drop below 0.60 * peak
    const valleyFloor = Math.max(thLow, peak * 0.60);

    while (top > 0) {
      const curr = stack[--top];
      const val = saliencyRaw[curr];
      mass += val;
      count++;
      if (val > peak) peak = val;

      const cx = curr % width;
      const cy = Math.floor(curr / width);
      if (cx < minX) minX = cx;
      if (cx > maxX) maxX = cx;
      if (cy < minY) minY = cy;
      if (cy > maxY) maxY = cy;

      for (let dy = -1; dy <= 1; dy++) {
        const ny = cy + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx;
          if (nx < 0 || nx >= width) continue;
          const nIdx = ny * width + nx;
          if (saliencyRaw[nIdx] >= valleyFloor && labels[nIdx] === -1) {
            labels[nIdx] = curLabel;
            stack[top++] = nIdx;
          }
        }
      }
    }

    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    if (count >= n * ATTENTION_CONFIG.segmentation.minAoiAreaFrac) {
      const channelAvgs = [];
      for (const [ch, map] of Object.entries(channelContributions)) {
        if (!map || map.length !== n) continue;
        let chSum = 0;
        for (let dy = minY; dy <= maxY; dy++) {
          for (let dx = minX; dx <= maxX; dx++) {
            chSum += map[dy * width + dx];
          }
        }
        channelAvgs.push({ ch, avg: chSum / count });
      }
      channelAvgs.sort((a, b) => b.avg - a.avg);
      const dominant = channelAvgs.slice(0, 2).map((c) => c.ch);

      const share = totalMass > 0 ? Number(((mass / totalMass) * 100).toFixed(1)) : 0;
      aoiList.push({
        id: `aoi-${aoiList.length + 1}`,
        label: `Focal Target #${aoiList.length + 1}`,
        x: minX,
        y: minY,
        width: w,
        height: h,
        shareOfAttention: share,
        noticeability: Number((peak * 100).toFixed(1)),
        peak: Number(peak.toFixed(3)),
        dominant,
      });
    }
  }

  // 3. Sweep any remaining unsegmented peaks above thHigh
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (saliencyRaw[idx] < thHigh || labels[idx] !== -1) continue;

      const curLabel = nextLabel++;
      labels[idx] = curLabel;
      let top = 0;
      stack[top++] = idx;

      let minX = x, maxX = x, minY = y, maxY = y;
      let mass = 0, peak = saliencyRaw[idx], count = 0;
      const valleyFloor = Math.max(thLow, peak * 0.60);

      while (top > 0) {
        const curr = stack[--top];
        const val = saliencyRaw[curr];
        mass += val;
        count++;
        if (val > peak) peak = val;

        const cx = curr % width;
        const cy = Math.floor(curr / width);
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        for (let dy = -1; dy <= 1; dy++) {
          const ny = cy + dy;
          if (ny < 0 || ny >= height) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx;
            if (nx < 0 || nx >= width) continue;
            const nIdx = ny * width + nx;
            if (saliencyRaw[nIdx] >= valleyFloor && labels[nIdx] === -1) {
              labels[nIdx] = curLabel;
              stack[top++] = nIdx;
            }
          }
        }
      }

      const w = maxX - minX + 1;
      const h = maxY - minY + 1;
      if (count >= n * ATTENTION_CONFIG.segmentation.minAoiAreaFrac) {
        const channelAvgs = [];
        for (const [ch, map] of Object.entries(channelContributions)) {
          if (!map || map.length !== n) continue;
          let chSum = 0;
          for (let dy = minY; dy <= maxY; dy++) {
            for (let dx = minX; dx <= maxX; dx++) {
              chSum += map[dy * width + dx];
            }
          }
          channelAvgs.push({ ch, avg: chSum / count });
        }
        channelAvgs.sort((a, b) => b.avg - a.avg);
        const dominant = channelAvgs.slice(0, 2).map((c) => c.ch);

        const share = totalMass > 0 ? Number(((mass / totalMass) * 100).toFixed(1)) : 0;
        aoiList.push({
          id: `aoi-${aoiList.length + 1}`,
          label: `Focal Target #${aoiList.length + 1}`,
          x: minX,
          y: minY,
          width: w,
          height: h,
          shareOfAttention: share,
          noticeability: Number((peak * 100).toFixed(1)),
          peak: Number(peak.toFixed(3)),
          dominant,
        });
      }
    }
  }

  aoiList.sort((a, b) => b.shareOfAttention - a.shareOfAttention);
  return aoiList.map((a, idx) => ({ ...a, rank: idx + 1 }));
}

export function generatePredictedScanpath(saliencyRaw, width, height, count = 8, aois = [], minPotentialThreshold = 0.08, maxDurationMs = Infinity) {
  const work = new Float32Array(saliencyRaw);
  const diag = Math.hypot(width, height);
  const foveaRadius = Math.max(14, diag * 0.08);
  const r2 = 2 * foveaRadius * foveaRadius;
  const fixations = [];
  let cumulativeMs = 0;

  // Saccade-distance penalty scale relative to image diagonal (humans favor proximal saccades)
  const sigmaSaccade = diag * 0.18;
  const s2 = 2 * sigmaSaccade * sigmaSaccade;

  // Human initial gaze anchor begins at screen center (foveal bias)
  const initialAnchor = { x: width * 0.5, y: height * 0.48 };

  for (let step = 1; step <= count; step++) {
    let maxScore = -1, maxIdx = 0;

    for (let i = 0; i < work.length; i++) {
      const wVal = work[i];
      if (wVal <= 0.001) continue;

      let penalty = 1.0;
      if (fixations.length > 0) {
        const x = i % width;
        const y = Math.floor(i / width);
        const prev = fixations[fixations.length - 1];
        const dist2 = (x - prev.x) * (x - prev.x) + (y - prev.y) * (y - prev.y);
        penalty = Math.exp(-dist2 / s2);
      } else if (aois && aois.length > 0) {
        // Step 1: Human foveal priority on #1 ranked primary AOI (resolves ties between equal peaks)
        const x = i % width;
        const y = Math.floor(i / width);
        const primary = aois[0];
        const aoiCx = primary.x + primary.width * 0.5;
        const aoiCy = primary.y + primary.height * 0.5;
        const distAoi2 = (x - aoiCx) ** 2 + (y - aoiCy) ** 2;
        const sAoi = 2 * Math.max(16, primary.width * 0.5) ** 2;
        penalty = 0.85 + 0.15 * Math.exp(-distAoi2 / sAoi);
      }

      const score = Math.pow(wVal, 0.9) * (0.20 + 0.80 * penalty);
      if (score > maxScore) {
        maxScore = score;
        maxIdx = i;
      }
    }

    if (maxScore <= 0) {
      let best = -1;
      for (let i = 0; i < work.length; i++) {
        if (work[i] > best) { best = work[i]; maxIdx = i; }
      }
      maxScore = best;
    }

    const rawVal = saliencyRaw[maxIdx];
    const peakPotential = work[maxIdx];

    // Stop scanpath when remaining potential drops below threshold
    if (step > 1 && (peakPotential < minPotentialThreshold || rawVal < 0.05)) {
      break;
    }

    const fx = maxIdx % width;
    const fy = Math.floor(maxIdx / width);

    let saccadeMs = 35;
    if (fixations.length > 0) {
      const prev = fixations[fixations.length - 1];
      const dist = Math.hypot(fx - prev.x, fy - prev.y);
      saccadeMs = Math.round(28 + 0.18 * dist);
    }
    const ttffMs = cumulativeMs + saccadeMs;
    const dwellMs = Math.round(140 + 340 * rawVal);
    cumulativeMs = ttffMs + dwellMs;

    const confidence = rawVal >= 0.50 && peakPotential >= 0.25 ? 'high' : (rawVal >= 0.20 ? 'medium' : 'low');
    const isLowConfidence = confidence === 'low' || peakPotential < 0.15;

    fixations.push({
      order: step,
      x: fx,
      y: fy,
      dwellMs,
      ttffMs,
      radius: Math.round(foveaRadius * (0.75 + 0.4 * rawVal)),
      intensity: Number((rawVal * 100).toFixed(1)),
      confidence,
      isLowConfidence,
    });

    if (cumulativeMs >= maxDurationMs) {
      break;
    }

    // Apply Inhibition of Return (IoR)
    for (let y = 0; y < height; y++) {
      const dy2 = (y - fy) * (y - fy);
      if (dy2 > r2 * 4) continue;
      for (let x = 0; x < width; x++) {
        const d2 = (x - fx) * (x - fx) + dy2;
        if (d2 <= r2 * 4) {
          work[y * width + x] *= (1.0 - (ATTENTION_CONFIG.segmentation.iorDecay || 0.88) * Math.exp(-d2 / r2));
        }
      }
    }
  }
  return fixations;
}

// --------------------------------------------------------------------
// §2.13 CONTAINER & FIGURE-GROUND DETECTION
// Detects rounded rectangles, modal panels, and internal list rows.
// Contained text and controls receive a figure bonus, and internal list rows
// are protected from cross-element repetition suppression.
// --------------------------------------------------------------------

export function detectUIContainers(L, width, height) {
  const n = width * height;
  const containerMask = new Float32Array(n);
  const listRowMask = new Uint8Array(n);

  const H_edges = new Float32Array(n);
  const V_edges = new Float32Array(n);
  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      V_edges[row + x] = Math.abs(L[row + x + 1] - L[row + x - 1]) * 0.5;
      H_edges[row + x] = Math.abs(L[(y + 1) * width + x] - L[(y - 1) * width + x]) * 0.5;
    }
  }

  // Profile inside central region
  const xMin = Math.floor(width * 0.20), xMax = Math.floor(width * 0.80);
  const yMin = Math.floor(height * 0.15), yMax = Math.floor(height * 0.85);

  const profV = new Float32Array(width);
  for (let x = xMin; x <= xMax; x++) {
    let sum = 0;
    for (let y = yMin; y <= yMax; y++) sum += V_edges[y * width + x];
    profV[x] = sum / (yMax - yMin + 1);
  }

  const profH = new Float32Array(height);
  for (let y = yMin; y <= yMax; y++) {
    let sum = 0;
    for (let x = xMin; x <= xMax; x++) sum += H_edges[y * width + x];
    profH[y] = sum / (xMax - xMin + 1);
  }

  let leftEdge = 0, rightEdge = 0, topEdge = 0, bottomEdge = 0;
  let maxV = 0;
  for (let x = Math.floor(width * 0.25); x < Math.floor(width * 0.50); x++) {
    if (profV[x] > maxV) { maxV = profV[x]; leftEdge = x; }
  }
  maxV = 0;
  for (let x = Math.floor(width * 0.55); x < Math.floor(width * 0.75); x++) {
    if (profV[x] > maxV) { maxV = profV[x]; rightEdge = x; }
  }

  let maxH = 0;
  for (let y = Math.floor(height * 0.20); y < Math.floor(height * 0.45); y++) {
    if (profH[y] > maxH) { maxH = profH[y]; topEdge = y; }
  }
  maxH = 0;
  for (let y = Math.floor(height * 0.55); y < Math.floor(height * 0.80); y++) {
    if (profH[y] > maxH) { maxH = profH[y]; bottomEdge = y; }
  }

  const boxW = rightEdge - leftEdge;
  const boxH = bottomEdge - topEdge;

  // Verify that the candidate box actually forms a coherent container with consistent boundary edges
  let edgePix = 0, totalPix = 0;
  for (let x = leftEdge; x <= rightEdge; x++) {
    if (topEdge > 0 && Math.abs(L[topEdge * width + x] - L[(topEdge - 1) * width + x]) > 6) edgePix++;
    if (bottomEdge < height - 1 && Math.abs(L[bottomEdge * width + x] - L[(bottomEdge + 1) * width + x]) > 6) edgePix++;
    totalPix += 2;
  }
  for (let y = topEdge; y <= bottomEdge; y++) {
    if (leftEdge > 0 && Math.abs(L[y * width + leftEdge] - L[y * width + leftEdge - 1]) > 6) edgePix++;
    if (rightEdge < width - 1 && Math.abs(L[y * width + rightEdge] - L[y * width + rightEdge + 1]) > 6) edgePix++;
    totalPix += 2;
  }
  const boundaryCoherence = totalPix > 0 ? edgePix / totalPix : 0;

  const isValidContainer = (
    boxW >= width * 0.12 && boxW <= width * 0.75 &&
    boxH >= height * 0.15 && boxH <= height * 0.85 &&
    boundaryCoherence >= 0.38
  );

  if (isValidContainer) {
    for (let y = topEdge; y <= bottomEdge; y++) {
      const row = y * width;
      for (let x = leftEdge; x <= rightEdge; x++) {
        containerMask[row + x] = 1.0;
        listRowMask[row + x] = 1; // Protect list rows inside container
      }
    }
  }

  return {
    containerMask,
    listRowMask,
    containerBox: isValidContainer ? { leftEdge, rightEdge, topEdge, bottomEdge, width: boxW, height: boxH } : null
  };
}

// --------------------------------------------------------------------
// §2.14 DOMAIN & DARK-THEME DESKTOP UI DETECTOR
// Accurately classifies screenshots, posters, and web UIs, preventing
// dark-themed desktop UIs from being misclassified as low-information or natural images.
// --------------------------------------------------------------------

export function detectImageDomain(rgba, width, height) {
  const n = width * height;
  let flatCount = 0;
  let edgeCount = 0;
  let orthoCount = 0;
  let darkPixelCount = 0;
  const sampleStride = Math.max(1, Math.floor(Math.sqrt(n) / 100));

  let totalSamples = 0;
  for (let y = 2; y < height - 2; y += sampleStride) {
    const row = y * width;
    for (let x = 2; x < width - 2; x += sampleStride) {
      totalSamples++;
      const idx = (row + x) * 4;
      const r = rgba[idx], g = rgba[idx + 1], b = rgba[idx + 2];
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (l < 45.0) darkPixelCount++;

      const rIdx = (row + x + 1) * 4, lIdx = (row + x - 1) * 4;
      const dIdx = ((y + 1) * width + x) * 4, uIdx = ((y - 1) * width + x) * 4;
      const lr = 0.2126 * rgba[rIdx] + 0.7152 * rgba[rIdx+1] + 0.0722 * rgba[rIdx+2];
      const ll = 0.2126 * rgba[lIdx] + 0.7152 * rgba[lIdx+1] + 0.0722 * rgba[lIdx+2];
      const ld = 0.2126 * rgba[dIdx] + 0.7152 * rgba[dIdx+1] + 0.0722 * rgba[dIdx+2];
      const lu = 0.2126 * rgba[uIdx] + 0.7152 * rgba[uIdx+1] + 0.0722 * rgba[uIdx+2];

      const gx = (lr - ll) * 0.5;
      const gy = (ld - lu) * 0.5;
      const gmag = Math.hypot(gx, gy);

      if (gmag < 2.0) flatCount++;
      if (gmag > 5.0) {
        edgeCount++;
        if (Math.abs(gx) > 2.0 * Math.abs(gy) || Math.abs(gy) > 2.0 * Math.abs(gx)) {
          orthoCount++;
        }
      }
    }
  }

  const orthoRatio = edgeCount > 0 ? orthoCount / edgeCount : 0;
  const darkRatio = darkPixelCount / totalSamples;
  const aspect = width / height;

  const isDesktopUi = (aspect >= 1.25 && orthoRatio >= 0.38 && (darkRatio >= 0.35 || flatCount / totalSamples >= 0.40));
  const isPoster = (aspect < 0.95 && orthoRatio < 0.65);

  let chosenMode = 'ui-web';
  if (isDesktopUi) chosenMode = 'desktop-ui';
  else if (isPoster) chosenMode = 'ad-poster';

  return {
    mode: chosenMode,
    isDesktopUi,
    aspect,
    darkRatio,
    orthoRatio,
    flatRatio: flatCount / totalSamples
  };
}

// --------------------------------------------------------------------
// §2 MAIN UNIFIED PIPELINE (Single Source of Truth)
// --------------------------------------------------------------------

export function analyzeImageBuffer(rgba, origWidth, origHeight, mode = 'ui_ux', numFixations = 8, domBoxes = [], externalLearnedMap = null, options = {}) {
  const startTime = Date.now();
  const modelTier = options.modelTier || 'hybrid';
  const scriptDirection = options.scriptDirection || 'ltr';
  const viewingDuration = options.viewingDuration || '3s';

  // Mode mapping to SPEC v2 modes: ui-web, desktop-ui, natural, ad-poster, editorial, fine_art
  let detectedInfo = null;
  let selectedMode = 'ui-web';
  if (mode === 'auto') {
    detectedInfo = detectImageDomain(rgba, origWidth, origHeight);
    selectedMode = detectedInfo.mode;
  } else if (mode === 'desktop_ui' || mode === 'desktop-ui') {
    selectedMode = 'desktop-ui';
  } else if (mode === 'natural') {
    selectedMode = 'natural';
  } else if (mode === 'fine_art') {
    selectedMode = 'fine_art';
  } else if (mode === 'advertising' || mode === 'ad-poster') {
    selectedMode = 'ad-poster';
  } else if (mode === 'editorial_book' || mode === 'editorial') {
    selectedMode = 'editorial';
  } else {
    detectedInfo = detectImageDomain(rgba, origWidth, origHeight);
    if (detectedInfo.isDesktopUi && (mode === 'ui_ux' || mode === 'ui-web')) {
      selectedMode = 'desktop-ui';
    }
  }

  const cfg = ATTENTION_CONFIG.fusion[selectedMode] || ATTENTION_CONFIG.fusion['ui-web'];

  // Working resolution downscaling in linear light (§2.0)
  // Higher tiers push the hardware further with larger working grid resolutions
  let maxDim = ATTENTION_CONFIG.geometry.workLongSide;
  if (options.modelTier) {
    if (modelTier === 'ultra') maxDim = 1024;
    else if (modelTier === 'max' || modelTier === 'deep_ensemble') maxDim = 896;
    else if (modelTier === 'high' || modelTier === 'hybrid') maxDim = 768;
    else if (modelTier === 'medium') maxDim = 640;
    else if (modelTier === 'fast' || modelTier === 'fast_browser') maxDim = 512;
    else if (modelTier === 'low' || modelTier === 'hand_crafted') maxDim = 512;
  }
  const shouldScale = Math.max(origWidth, origHeight) > maxDim;
  let workW = origWidth;
  let workH = origHeight;
  let workRgba = rgba;

  if (shouldScale) {
    if (origWidth >= origHeight) {
      workW = maxDim;
      workH = Math.max(1, Math.round((origHeight / origWidth) * maxDim));
    } else {
      workH = maxDim;
      workW = Math.max(1, Math.round((origWidth / origHeight) * maxDim));
    }
    workRgba = downscaleRgbaLinear(rgba, origWidth, origHeight, workW, workH);
  }

  const N = workW * workH;
  const ppd = Math.round(Math.max(workW, workH) * ATTENTION_CONFIG.geometry.ppdFraction);
  const foveaPx = Math.max(ATTENTION_CONFIG.geometry.minFoveaPx, ppd);

  const L = new Float32Array(N);
  const A = new Float32Array(N);
  const B = new Float32Array(N);
  const C = new Float32Array(N);

  for (let i = 0; i < N; i++) {
    const r = workRgba[i * 4], g = workRgba[i * 4 + 1], b = workRgba[i * 4 + 2];
    const [l, a, labB] = srgbToLab(r, g, b);
    L[i] = l;
    A[i] = a;
    B[i] = labB;
    C[i] = Math.hypot(a, labB);
  }

  // Detect UI Containers (rounded rectangles, modal panels) and internal repeated list rows (§2.13)
  const { containerMask, listRowMask, containerBox } = detectUIContainers(L, workW, workH);

  // --- 1. FEATURE CHANNELS (§2.1 - §2.13) ---
  const channelValid = {
    I: false, C: false, O: false, SR: false, FT: false,
    U: false, P: false, CL: false, T: false, FA: false, S: false, L: false,
  };

  // Channel I: Intensity Itti-Koch Center-Surround
  const lBlurC = convolveSeparable(L, workW, workH, foveaPx * 0.5);
  const lBlurS = convolveSeparable(L, workW, workH, foveaPx * 2.0);
  const rawI = new Float32Array(N);
  for (let i = 0; i < N; i++) rawI[i] = Math.abs(lBlurC[i] - lBlurS[i]);
  const normI = standardizeChannel(rawI);
  channelValid.I = normI.valid;

  // Channel C: Double-Opponency Color Opponency + Delta E
  const aBlurS = convolveSeparable(A, workW, workH, foveaPx * 1.5);
  const bBlurS = convolveSeparable(B, workW, workH, foveaPx * 1.5);
  const rawC = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const da = A[i] - aBlurS[i];
    const db = B[i] - bBlurS[i];
    rawC[i] = Math.hypot(da, db);
  }
  const normC = standardizeChannel(rawC);
  channelValid.C = normC.valid;

  // Channel O: Gabor Orientation Conspicuity (0, 45, 90, 135)
  const gaborAngles = [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4];
  const rawO = new Float32Array(N);
  for (const ang of gaborAngles) {
    const gabor = createGaborKernel2D(ang, 4.0, 1.6, 0.5);
    const resp = convolve2DGabor(L, workW, workH, gabor);
    for (let i = 0; i < N; i++) rawO[i] += resp[i];
  }
  const normO = standardizeChannel(rawO);
  channelValid.O = normO.valid;

  // Channel SR: Spectral Residual
  const rawSR = computeSpectralResidual(L, workW, workH);
  const normSR = standardizeChannel(rawSR);
  channelValid.SR = normSR.valid;

  // Channel FT: Frequency-Tuned Saliency (Achanta)
  const rawFT = computeFrequencyTunedSaliency(L, A, B, workW, workH);
  const normFT = standardizeChannel(rawFT);
  channelValid.FT = normFT.valid;

  // Channel U: Global Color Rarity (384-bin with border bg discount)
  const { rarityMap: rawU, paletteEntropy, activeBinsCount } = computeGlobalColorRarity(L, A, B, workW, workH);
  const normU = standardizeChannel(rawU);
  channelValid.U = normU.valid;

  // Channel P: Chroma Pop-Out in LCh
  const rawP = computeChromaPopOut(A, B, workW, workH, foveaPx);
  const normP = standardizeChannel(rawP);
  channelValid.P = normP.valid;

  // Channel CL: Size-Tuned Cluster Mass (Sparse factor: bypasses z-score and flat-image guard)
  const rawCL = computeSizeTunedClusterMass(L, A, B, workW, workH);
  let maxCL = 0;
  for (let i = 0; i < N; i++) if (rawCL[i] > maxCL) maxCL = rawCL[i];
  const normCL = { map: rawCL, valid: maxCL > 0.01 };
  channelValid.CL = normCL.valid;

  // Channel T: Stroke-Validated Text (Sparse factor: bypasses z-score and flat-image guard)
  const { textMap: rawT, Gx, Gy, Gmag, textBoxes } = computeStrokeValidatedTextMap(L, workW, workH, containerMask);
  let maxT = 0;
  for (let i = 0; i < N; i++) if (rawT[i] > maxT) maxT = rawT[i];
  const normT = { map: rawT, valid: maxT > 0.01 };
  channelValid.T = normT.valid;

  // Channel FA: Validated Faces & People (Sparse factor: bypasses z-score and flat-image guard)
  const rawFA = computeValidatedFaceMap(workRgba, workW, workH, Gmag, L);
  let maxFA = 0;
  for (let i = 0; i < N; i++) if (rawFA[i] > maxFA) maxFA = rawFA[i];
  const normFA = { map: rawFA, valid: maxFA > 0.01 };
  channelValid.FA = normFA.valid;

  // Channel S: Contour / Shape Structure (Sparse factor: bypasses z-score and flat-image guard)
  const rawS = convolveSeparable(Gmag, workW, workH, 3.5);
  let maxS = 0;
  for (let i = 0; i < N; i++) if (rawS[i] > maxS) maxS = rawS[i];
  const normSMap = new Float32Array(N);
  if (maxS > 0.01) {
    const invMaxS = 1.0 / maxS;
    for (let i = 0; i < N; i++) normSMap[i] = rawS[i] * invMaxS;
  }
  const normS = { map: normSMap, valid: maxS > 0.01 };
  channelValid.S = normS.valid;

  // Channel L: Learned Visual Attention (via client-side WebGPU/WASM ONNX or procedural prior)
  // Low uses pure mathematical bio-vision models with zero neural weights (w_L = 0)
  const isZeroNeural = modelTier === 'low' || modelTier === 'hand_crafted';
  let rawL = null;
  if (!isZeroNeural) {
    if (externalLearnedMap && externalLearnedMap.length > 0) {
      if (externalLearnedMap.length === N) {
        rawL = externalLearnedMap;
      } else {
        rawL = resampleBilinear(externalLearnedMap, origWidth, origHeight, workW, workH);
      }
    } else {
      // Procedural multi-scale semantic hierarchy for environments where ONNX tensor is loading or in headless/node tests
      rawL = new Float32Array(N);
      const isUltra = modelTier === 'ultra';
      const isMax = modelTier === 'max' || modelTier === 'deep_ensemble';
      const isHigh = modelTier === 'high' || modelTier === 'hybrid';
      const isMedium = modelTier === 'medium';
      
      const scale1 = convolveSeparable(rawI, workW, workH, 4.0);
      const scale2 = isMedium || isHigh || isMax || isUltra ? convolveSeparable(rawCL, workW, workH, 6.0) : null;
      const scale3 = isHigh || isMax || isUltra ? convolveSeparable(rawP, workW, workH, 12.0) : null;
      const scale4 = isMax || isUltra ? convolveSeparable(rawU, workW, workH, 16.0) : null;
      const scale5 = isUltra ? convolveSeparable(rawS, workW, workH, 2.0) : null;

      for (let i = 0; i < N; i++) {
        let v = scale1[i] * 0.40;
        if (scale2) v += scale2[i] * 0.30;
        if (scale3) v += scale3[i] * 0.20;
        if (scale4) v += scale4[i] * 0.15;
        if (scale5) v += scale5[i] * 0.15;
        rawL[i] = v;
      }
    }
  }
  const normL = rawL ? standardizeChannel(rawL) : { map: new Float32Array(N), valid: false };
  channelValid.L = normL.valid;

  // Flat-Image Guard (§3.3): If dense factors are noise (<=1 valid, e.g. FFT SR float residual) and no sparse factors survive, flag lowInformation
  const denseValidCount = [channelValid.I, channelValid.C, channelValid.O, channelValid.SR, channelValid.FT, channelValid.U, channelValid.P]
    .filter(Boolean).length;
  const sparseValid = channelValid.CL || channelValid.T || channelValid.FA || channelValid.S;
  const lowInformation = (denseValidCount <= 1) && !sparseValid;

  // Multi-duration scaling factor (§1.1, §7.6: γ(d) conditioning up to 1 minute)
  let durationSemMult = 1.0;
  let durationCenterMult = 1.0;
  let maxDurationMs = 3000;
  let targetFixationCount = 8;

  if (viewingDuration === '1s') {
    durationSemMult = 0.70;      // 1s First glance: bottom-up contrast & center prior dominate
    durationCenterMult = 1.35;
    maxDurationMs = 1000;
    targetFixationCount = 4;
  } else if (viewingDuration === '3s') {
    durationSemMult = 1.00;      // 3s Standard Focus: initial exploration
    durationCenterMult = 1.00;
    maxDurationMs = 3000;
    targetFixationCount = 8;
  } else if (viewingDuration === '5s') {
    durationSemMult = 1.15;      // 5s Considered View: primary headings & layout
    durationCenterMult = 0.90;
    maxDurationMs = 5000;
    targetFixationCount = 14;
  } else if (viewingDuration === '7s') {
    durationSemMult = 1.25;      // 7s Extended Reading: semantic layout, text, affordances
    durationCenterMult = 0.80;
    maxDurationMs = 7000;
    targetFixationCount = 20;
  } else if (viewingDuration === '15s') {
    durationSemMult = 1.45;      // 15s Detailed Evaluation: body copy, navigation cards
    durationCenterMult = 0.65;
    maxDurationMs = 15000;
    targetFixationCount = 38;
  } else if (viewingDuration === '30s') {
    durationSemMult = 1.60;      // 30s In-Depth Immersion: comprehensive layout inspection
    durationCenterMult = 0.50;
    maxDurationMs = 30000;
    targetFixationCount = 65;
  } else if (viewingDuration === '60s' || viewingDuration === '1m') {
    durationSemMult = 1.80;      // 60s (1 Minute Full Analysis): exhaustive cognitive scan, micro-elements
    durationCenterMult = 0.35;
    maxDurationMs = 60000;
    targetFixationCount = 100;
  }

  // --- 2. LOGISTIC FUSION WITH INTERACTION PAIRS & PRIORS (§4) ---
  const W = cfg.weights;

  // Model tier learned channel weight calibration (§4.4, §4.8)
  // Low is strictly mathematical vision science (weightL = 0)
  // Above low (fast, medium, high, max, ultra) are all ONNX neural tiers
  let weightL = 0;
  if (!isZeroNeural && normL.valid) {
    if (modelTier === 'ultra') weightL = (W.L || 0.40) * 1.45;
    else if (modelTier === 'max' || modelTier === 'deep_ensemble') weightL = (W.L || 0.40) * 1.25;
    else if (modelTier === 'high' || modelTier === 'hybrid') weightL = (W.L || 0.40) * 1.05;
    else if (modelTier === 'medium') weightL = (W.L || 0.40) * 0.88;
    else if (modelTier === 'fast' || modelTier === 'fast_browser') weightL = (W.L || 0.40) * 0.70;
    else weightL = W.L || 0.40;
  }
  const contributions = {
    I: new Float32Array(N),
    C: new Float32Array(N),
    O: new Float32Array(N),
    SR: new Float32Array(N),
    FT: new Float32Array(N),
    U: new Float32Array(N),
    P: new Float32Array(N),
    CL: new Float32Array(N),
    T: new Float32Array(N),
    FA: new Float32Array(N),
    S: new Float32Array(N),
    L: new Float32Array(N),
    priors: new Float32Array(N),
  };

  const fusedLogit = new Float32Array(N);

  if (lowInformation) {
    // Uniform image produces near-flat final map (0 false hotspots)
    fusedLogit.fill(0);
  } else {
    for (let y = 0; y < workH; y++) {
      const ny = y / workH;
      for (let x = 0; x < workW; x++) {
        const nx = x / workW;
        const i = y * workW + x;

        // Linear contributions with duration conditioning
        const cI = W.I * normI.map[i];
        const cC = W.C * normC.map[i];
        const cO = W.O * normO.map[i];
        const cSR = W.SR * normSR.map[i];
        const cFT = W.FT * normFT.map[i];
        const cU = W.U * normU.map[i];
        const cP = W.P * normP.map[i];
        const cCL = W.CL * normCL.map[i] * durationSemMult;
        const cT = W.T * normT.map[i] * durationSemMult;
        const cFA = W.FA * normFA.map[i] * durationSemMult;
        const cS = W.S * normS.map[i];
        const cL = weightL * normL.map[i];

        contributions.I[i] = cI;
        contributions.C[i] = cC;
        contributions.O[i] = cO;
        contributions.SR[i] = cSR;
        contributions.FT[i] = cFT;
        contributions.U[i] = cU;
        contributions.P[i] = cP;
        contributions.CL[i] = cCL;
        contributions.T[i] = cT;
        contributions.FA[i] = cFA;
        contributions.S[i] = cS;
        contributions.L[i] = cL;

        let featureSum = cI + cC + cO + cSR + cFT + cU + cP + cCL + cT + cFA + cS + cL;

        // Interaction pairs (§4.1)
        for (const pair of cfg.interactionPairs) {
          let val1 = normI.map[i], val2 = normP.map[i];
          if (pair.k1 === 'U') val1 = normU.map[i];
          else if (pair.k1 === 'T') val1 = normT.map[i];
          else if (pair.k1 === 'FA') val1 = normFA.map[i];

          if (pair.k2 === 'CL') val2 = normCL.map[i];
          else if (pair.k2 === 'I') val2 = normI.map[i];
          else if (pair.k2 === 'P') val2 = normP.map[i];

          featureSum += pair.weight * val1 * val2;
        }

        // Spatial Priors: Center Bias and UI Reading Prior (§4.2, §5.2)
        const dc = Math.pow(nx - 0.5, 2) + Math.pow(ny - 0.45, 2);
        const centerBias = Math.exp(-dc / 0.16) * durationCenterMult;

        let readingBias = 0;
        if (cfg.readingPriorWeight > 0) {
          const fTop = Math.exp(-Math.pow(ny - 0.22, 2) / 0.12);
          // Reading direction prior: LTR anchors top-left (0.28), RTL anchors top-right (0.72)
          const targetX = scriptDirection === 'rtl' ? 0.72 : 0.28;
          const fX = Math.exp(-Math.pow(nx - targetX, 2) / 0.18);
          readingBias = Math.max(fTop, fX * 0.85);
        }

        const containerBonus = (cfg.containerBonusWeight || 0.35) * (containerMask ? containerMask[i] : 0);
        const priorTerm = cfg.centerBiasWeight * centerBias + cfg.readingPriorWeight * readingBias + containerBonus;
        contributions.priors[i] = priorTerm;

        const scaleMult = cfg.scale || 5.2;
        const logit = cfg.intercept + scaleMult * featureSum + (selectedMode === 'desktop-ui' ? scaleMult * priorTerm : priorTerm);

        // Logistic activation
        fusedLogit[i] = 1.0 / (1.0 + Math.exp(-logit));
      }
    }
  }

  // --- 3. REPETITION SUPPRESSION (§2.11) ---
  const repSuppressed = applyRepetitionSuppression(fusedLogit, workW, workH, listRowMask);

  // Sub-glyph isolation and minimum-area guard (§2.12)
  const guarded = applySubGlyphIsolationGuard(repSuppressed, L, workW, workH);

  // --- 4. POST-PROCESSING BLUR (sigma ≈ 1° visual angle = ppd in working-resolution pixels) ---
  const sigmaBlur = Math.max(3.0, ppd * 1.0);
  const blurredSaliency = convolveSeparable(guarded, workW, workH, sigmaBlur);
  const saliencyRaw = lowInformation ? new Float32Array(N) : robustPercentileNormalize(blurredSaliency);

  // --- 5. DERIVED OUTPUTS FROM SINGLE SOURCE OF TRUTH (§5) ---
  const concentration = computeConcentrationMetrics(saliencyRaw);
  const aois = extractAOIsHysteresis(saliencyRaw, workW, workH, contributions);

  // SPEC §6.3: Sample weight posterior w ~ N(ŵ, Σ_w) for calibrated AOI share intervals
  if (cfg.covariance && aois.length > 0 && !lowInformation) {
    try {
      const factorMaps = [
        normI.map, normC.map, normO.map, normSR.map, normFT.map,
        normU.map, normP.map, normCL.map, normT.map, normFA.map,
        normS.map, normL.map
      ];
      for (const pair of (cfg.interactionPairs || [])) {
        const idx1 = FACTOR_NAMES.indexOf(pair.k1);
        const idx2 = FACTOR_NAMES.indexOf(pair.k2);
        const m1 = factorMaps[idx1] || normI.map;
        const m2 = factorMaps[idx2] || normP.map;
        const prod = new Float32Array(N);
        for (let i = 0; i < N; i++) prod[i] = m1[i] * m2[i];
        factorMaps.push(prod);
      }

      const wHat = new Float64Array(factorMaps.length);
      wHat[0] = cfg.weights.I;
      wHat[1] = cfg.weights.C;
      wHat[2] = cfg.weights.O;
      wHat[3] = cfg.weights.SR;
      wHat[4] = cfg.weights.FT;
      wHat[5] = cfg.weights.U;
      wHat[6] = cfg.weights.P;
      wHat[7] = cfg.weights.CL;
      wHat[8] = cfg.weights.T;
      wHat[9] = cfg.weights.FA;
      wHat[10] = cfg.weights.S;
      wHat[11] = cfg.weights.L;
      for (let p = 0; p < (cfg.interactionPairs || []).length; p++) {
        wHat[12 + p] = cfg.interactionPairs[p].weight;
      }

      const intervals = samplePosteriorAoiIntervals(
        wHat,
        new Float64Array(cfg.covariance),
        aois,
        factorMaps,
        contributions.priors,
        workW,
        workH,
        30
      );

      for (let a = 0; a < aois.length; a++) {
        if (intervals[a]) {
          aois[a].shareInterval = intervals[a];
        }
      }
    } catch {
      // Degenerate condition guard
    }
  }

  const effectiveNumFixations = options.numFixations ?? Math.max(numFixations, targetFixationCount);
  const fixations = generatePredictedScanpath(saliencyRaw, workW, workH, effectiveNumFixations, aois, 0.08, maxDurationMs);

  // Cognitive Load & Clarity Heuristics (§6)
  const cogLoad = computeCognitiveLoadAndClarity(
    L, A, B, C, Gx, Gy, Gmag, normT.map, workW, workH, paletteEntropy, activeBinsCount
  );

  const primaryAoiShare = aois.length > 0 ? aois[0].shareOfAttention / 100.0 : 0;
  const clarityScore = Math.max(1, Math.min(99, Math.round(
    (0.50 * (1.0 - cogLoad.totalLoadScore / 100.0) +
     0.30 * concentration.focusScore +
     0.20 * primaryAoiShare) * 100
  )));

  // Intermediate diagnostic layer maps
  const diagContrast = robustPercentileNormalize(rawI);
  const diagSaturation = robustPercentileNormalize(rawP);
  const diagUniqueness = robustPercentileNormalize(rawU);
  const diagCluster = robustPercentileNormalize(rawCL);
  const diagText = robustPercentileNormalize(rawT);
  const diagShape = robustPercentileNormalize(rawS);
  const diagFaces = robustPercentileNormalize(rawFA);
  const diagLearned = normL.valid ? robustPercentileNormalize(rawL) : null;

  // Upsample final maps if working resolution was downscaled
  let resSaliency = saliencyRaw;
  let resContrast = diagContrast;
  let resSaturation = diagSaturation;
  let resUniqueness = diagUniqueness;
  let resCluster = diagCluster;
  let resText = diagText;
  let resShape = diagShape;
  let resFaces = diagFaces;
  let resLearned = diagLearned;

  if (shouldScale) {
    resSaliency = resampleBilinear(saliencyRaw, workW, workH, origWidth, origHeight);
    resContrast = resampleBilinear(diagContrast, workW, workH, origWidth, origHeight);
    resSaturation = resampleBilinear(diagSaturation, workW, workH, origWidth, origHeight);
    resUniqueness = resampleBilinear(diagUniqueness, workW, workH, origWidth, origHeight);
    resCluster = resampleBilinear(diagCluster, workW, workH, origWidth, origHeight);
    resText = resampleBilinear(diagText, workW, workH, origWidth, origHeight);
    resShape = resampleBilinear(diagShape, workW, workH, origWidth, origHeight);
    resFaces = resampleBilinear(diagFaces, workW, workH, origWidth, origHeight);
    if (diagLearned) resLearned = resampleBilinear(diagLearned, workW, workH, origWidth, origHeight);
  }

  // Scale AOI, Fixation, and Text Box coordinates back to original size
  const scaleX = origWidth / workW;
  const scaleY = origHeight / workH;
  const scaledAois = aois.map((a) => ({
    ...a,
    shareInterval: a.shareInterval,
    x: Math.round(a.x * scaleX),
    y: Math.round(a.y * scaleY),
    width: Math.round(a.width * scaleX),
    height: Math.round(a.height * scaleY),
  }));
  const scaledFixations = fixations.map((f) => ({
    ...f,
    x: Math.round(f.x * scaleX),
    y: Math.round(f.y * scaleY),
    radius: Math.round(f.radius * Math.max(scaleX, scaleY)),
  }));
  const scaledTextBoxes = (textBoxes || []).map((b) => ({
    ...b,
    x: Math.round(b.x * scaleX),
    y: Math.round(b.y * scaleY),
    width: Math.round(b.width * scaleX),
    height: Math.round(b.height * scaleY),
  }));

  const isDebugChannels = options.debug === 'channels' ||
    (typeof window !== 'undefined' && window.location && window.location.search && window.location.search.includes('debug=channels')) ||
    (typeof process !== 'undefined' && process.env && process.env.DEBUG === 'channels');

  if (isDebugChannels) {
    const reason = detectedInfo
      ? `aspect=${detectedInfo.aspect.toFixed(2)}, darkRatio=${detectedInfo.darkRatio.toFixed(2)}, orthoRatio=${detectedInfo.orthoRatio.toFixed(2)}, flatRatio=${detectedInfo.flatRatio.toFixed(2)}`
      : 'Manual preset requested';
    console.log(`[Attentix Debug] Mode used: "${selectedMode}". Rationale: ${reason}`);
    console.log('[Attentix Debug] Factor maps Φ_k:', {
      Φ_I: normI.map,
      Φ_C: normC.map,
      Φ_O: normO.map,
      Φ_SR: normSR.map,
      Φ_FT: normFT.map,
      Φ_U: normU.map,
      Φ_P: normP.map,
      Φ_CL: normCL.map,
      Φ_T: normT.map,
      Φ_FA: normFA.map,
      Φ_S: normS.map,
      Φ_L: normL.map,
    });
    console.log('[Attentix Debug] Per-pixel contributions:', contributions);
  }

  const warnings = [];
  if (lowInformation) warnings.push('lowInformation: Flat or near-uniform image. Saliency map clamped to 0 false hotspots.');

  const engineVersion = ATTENTION_CONFIG.engineVersion;
  const modelVersion = ATTENTION_CONFIG.modelVersion;
  const tier = options.tier || (typeof window !== 'undefined' ? 'browser' : 'browser');

  return {
    versions: {
      engine: engineVersion,
      model: modelVersion,
      configHash: ATTENTION_CONFIG.configHash,
      tier,
    },
    engineVersion,
    modelVersion,
    tier,
    configHash: ATTENTION_CONFIG.configHash,
    mode: selectedMode,
    textBoxes: scaledTextBoxes,
    image: {
      w: origWidth,
      h: origHeight,
      workW,
      workH,
      ppd,
    },
    channelValid,
    width: origWidth,
    height: origHeight,
    saliencyRaw: resSaliency,
    saliencyMap: resSaliency, // Alias for backward compatibility
    modelTier,
    scriptDirection,
    viewingDuration,
    contrastMap: resContrast,
    saturationMap: resSaturation,
    uniquenessMap: resUniqueness,
    clusterMap: resCluster,
    textMap: resText,
    shapeMap: resShape,
    facesMap: resFaces,
    learnedMap: resLearned,
    colorMap: resUniqueness,
    intensityMap: resContrast,
    structureMap: resShape,
    contributions,
    aoi: scaledAois,
    scanpath: scaledFixations,
    fixations: scaledFixations, // Alias for UI
    metrics: concentration,
    load: {
      color: { value: cogLoad.colorLoadScore, terms: cogLoad.terms.color },
      shape: { value: cogLoad.shapeLoadScore, terms: cogLoad.terms.shape },
      text: { value: cogLoad.textLoadScore, terms: cogLoad.terms.text },
      total: cogLoad.totalLoadScore,
    },
    clarity: {
      value: clarityScore,
      terms: { focusScore: concentration.focusScore, primaryAoiShare },
    },
    clarityScore, // Alias for UI
    cognitiveLoadScore: cogLoad.totalLoadScore, // Alias for UI
    colorLoadScore: cogLoad.colorLoadScore,
    shapeLoadScore: cogLoad.shapeLoadScore,
    textLoadScore: cogLoad.textLoadScore,
    containerBox,
    autoDetection: detectedInfo,
    warnings,
    hardwareProfile: options.hardwareProfile || null,
    computeTimeMs: Math.max(1, Date.now() - startTime),
  };
}

function downscaleRgbaLinear(src, srcW, srcH, dstW, dstH) {
  const dst = new Uint8ClampedArray(dstW * dstH * 4);
  const scaleX = srcW / dstW;
  const scaleY = srcH / dstH;

  for (let dy = 0; dy < dstH; dy++) {
    const syStart = Math.floor(dy * scaleY);
    const syEnd = Math.min(srcH, Math.ceil((dy + 1) * scaleY));
    for (let dx = 0; dx < dstW; dx++) {
      const sxStart = Math.floor(dx * scaleX);
      const sxEnd = Math.min(srcW, Math.ceil((dx + 1) * scaleX));

      let rLinSum = 0, gLinSum = 0, bLinSum = 0, aSum = 0, count = 0;
      for (let sy = syStart; sy < syEnd; sy++) {
        const row = sy * srcW;
        for (let sx = sxStart; sx < sxEnd; sx++) {
          const idx = (row + sx) * 4;
          rLinSum += srgbToLinear(src[idx]);
          gLinSum += srgbToLinear(src[idx + 1]);
          bLinSum += srgbToLinear(src[idx + 2]);
          aSum += src[idx + 3];
          count++;
        }
      }
      const dstIdx = (dy * dstW + dx) * 4;
      if (count > 0) {
        dst[dstIdx] = linearToSrgb(rLinSum / count);
        dst[dstIdx + 1] = linearToSrgb(gLinSum / count);
        dst[dstIdx + 2] = linearToSrgb(bLinSum / count);
        dst[dstIdx + 3] = Math.round(aSum / count);
      }
    }
  }
  return dst;
}

// --------------------------------------------------------------------
// COLORMAP & DISPLAY RENDERING
// --------------------------------------------------------------------

export function buildColormapLUT(colormap = 'turbo') {
  const lut = new Uint8Array(256 * 3);
  const stopsMap = {
    inferno: [
      [0.00, [10, 7, 35]],
      [0.33, [132, 32, 107]],
      [0.66, [229, 92, 48]],
      [1.00, [252, 255, 164]],
    ],
    viridis: [
      [0.00, [68, 1, 84]],
      [0.33, [49, 104, 142]],
      [0.66, [53, 183, 121]],
      [1.00, [253, 231, 37]],
    ],
    turbo: [
      [0.00, [48, 18, 59]],
      [0.25, [40, 188, 235]],
      [0.50, [164, 252, 60]],
      [0.75, [251, 126, 33]],
      [1.00, [122, 4, 3]],
    ],
    thermal: [
      [0.00, [0, 32, 128]],
      [0.22, [0, 180, 255]],
      [0.45, [0, 230, 118]],
      [0.68, [255, 230, 0]],
      [0.86, [255, 90, 0]],
      [0.96, [255, 15, 15]],
      [1.00, [255, 245, 220]],
    ],
  };

  const stops = stopsMap[colormap] || stopsMap.turbo;
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let s0 = stops[0], s1 = stops[stops.length - 1];
    for (let k = 0; k < stops.length - 1; k++) {
      if (t >= stops[k][0] && t <= stops[k + 1][0]) {
        s0 = stops[k];
        s1 = stops[k + 1];
        break;
      }
    }
    const span = Math.max(1e-5, s1[0] - s0[0]);
    const localT = (t - s0[0]) / span;
    lut[i * 3] = Math.round(s0[1][0] + (s1[1][0] - s0[1][0]) * localT);
    lut[i * 3 + 1] = Math.round(s0[1][1] + (s1[1][1] - s0[1][1]) * localT);
    lut[i * 3 + 2] = Math.round(s0[1][2] + (s1[1][2] - s0[1][2]) * localT);
  }
  return lut;
}

export function renderAttentionHeatmapRGBA(baseRgba, saliencyMap, width, height, options = {}) {
  const {
    mode = 'heatmap',
    colormap = 'turbo',
    opacity = 0.80,
    threshold = 0.12,
    darkenBase = 0.38,
    showContours = true,
  } = options;

  const N = width * height;
  const out = new Uint8ClampedArray(N * 4);

  if (mode === 'original') {
    out.set(baseRgba);
    return out;
  }

  const lut = buildColormapLUT(colormap);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const idx4 = i * 4;
      const r0 = baseRgba[idx4], g0 = baseRgba[idx4 + 1], b0 = baseRgba[idx4 + 2];
      const val = Math.min(1.0, Math.max(0.0, saliencyMap[i]));

      if (mode === 'fog_of_war') {
        const visibility = val <= threshold
          ? 0.10
          : Math.min(1.0, 0.10 + 0.90 * Math.pow((val - threshold) / Math.max(0.05, 1.0 - threshold), 0.75));
        out[idx4] = Math.round(r0 * visibility);
        out[idx4 + 1] = Math.round(g0 * visibility);
        out[idx4 + 2] = Math.round(b0 * visibility);
        out[idx4 + 3] = 255;
        continue;
      }

      const dimFactor = 1.0 - darkenBase;
      const br = r0 * dimFactor, bg = g0 * dimFactor, bb = b0 * dimFactor;

      if (val <= threshold) {
        out[idx4] = Math.round(br);
        out[idx4 + 1] = Math.round(bg);
        out[idx4 + 2] = Math.round(bb);
        out[idx4 + 3] = 255;
      } else {
        const normVal = Math.min(1.0, (val - threshold) / Math.max(0.05, 1.0 - threshold));
        const lutIdx = Math.min(255, Math.floor(normVal * 255)) * 3;
        const hr = lut[lutIdx], hg = lut[lutIdx + 1], hb = lut[lutIdx + 2];
        const alpha = Math.min(1.0, opacity * Math.pow(normVal, 0.65));

        let finalR = br * (1 - alpha) + hr * alpha;
        let finalG = bg * (1 - alpha) + hg * alpha;
        let finalB = bb * (1 - alpha) + hb * alpha;

        if (showContours && x > 0 && y > 0 && x < width - 1 && y < height - 1) {
          const right = saliencyMap[i + 1], down = saliencyMap[i + width];
          const iso1 = 0.60, iso2 = 0.85;
          const crossesIso1 = (val < iso1 && (right >= iso1 || down >= iso1)) || (val >= iso1 && (right < iso1 || down < iso1));
          const crossesIso2 = (val < iso2 && (right >= iso2 || down >= iso2)) || (val >= iso2 && (right < iso2 || down < iso2));
          if (crossesIso2) {
            finalR = 255; finalG = 255; finalB = 255;
          } else if (crossesIso1) {
            finalR = Math.min(255, finalR + 50);
            finalG = Math.min(255, finalG + 50);
            finalB = Math.min(255, finalB + 50);
          }
        }

        out[idx4] = Math.round(finalR);
        out[idx4 + 1] = Math.round(finalG);
        out[idx4 + 2] = Math.round(finalB);
        out[idx4 + 3] = 255;
      }
    }
  }
  return out;
}

export function generateScanpathIoR(saliencyMap, width, height, count = 8) {
  return generatePredictedScanpath(saliencyMap, width, height, count);
}

export function computeAOIMetrics(saliencyMap, width, height, fixations, box) {
  const x0 = Math.max(0, Math.floor(box.x));
  const y0 = Math.max(0, Math.floor(box.y));
  const x1 = Math.min(width - 1, Math.ceil(box.x + box.width));
  const y1 = Math.min(height - 1, Math.ceil(box.y + box.height));

  let totalMass = 0, boxMass = 0, boxPixels = 0, peakInBox = 0;
  for (let i = 0; i < saliencyMap.length; i++) totalMass += saliencyMap[i];

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const val = saliencyMap[y * width + x];
      boxMass += val;
      if (val > peakInBox) peakInBox = val;
      boxPixels++;
    }
  }

  const shareOfAttention = totalMass > 0 ? Number(((boxMass / totalMass) * 100).toFixed(2)) : 0;
  const meanInBox = boxPixels > 0 ? boxMass / boxPixels : 0;
  const noticeability = Number(Math.min(99.9, (peakInBox * 0.65 + meanInBox * 0.35) * 100).toFixed(1));

  let ttffMs = null;
  for (const f of fixations) {
    if (f.x >= x0 && f.x <= x1 && f.y >= y0 && f.y <= y1) {
      ttffMs = f.ttffMs;
      break;
    }
  }
  if (ttffMs === null && peakInBox > 0.25) {
    ttffMs = Math.round(180 + (1 - peakInBox) * 1400);
  }

  return { ...box, shareOfAttention, noticeability, ttffMs };
}

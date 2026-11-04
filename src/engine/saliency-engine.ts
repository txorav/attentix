import {
  convertRGBToLabBuffers,
  gaussianBlur2D,
  differenceOfGaussians,
  computeSobelGradients,
  computeSkinChromaTensor,
  normalizeMinMaxInPlace,
} from './tensor-math';
import { DomainPreset, FixationPoint, ModelTier, SaliencyTensorResult, ScriptDirection, ViewingDuration } from '../types/studio';

export interface SaliencyOptions {
  domainPreset?: DomainPreset;
  modelTier?: ModelTier;
  scriptDirection?: ScriptDirection;
  viewingDuration?: ViewingDuration;
  maxFixations?: number;
  iorRadius?: number;
  externalLearnedMap?: Float32Array;
  hardwareProfile?: any;
}

/**
 * Computes Multi-scale CIE L*a*b* Color Opponency Tensor
 */
export function computeColorOpponencyTensor(
  aCh: Float32Array,
  bCh: Float32Array,
  width: number,
  height: number,
  scales: number[] = [4, 8, 16, 32]
): Float32Array {
  const total = width * height;
  const colorMap = new Float32Array(total);

  for (const sigma of scales) {
    const aBlurred = gaussianBlur2D(aCh, width, height, sigma);
    const bBlurred = gaussianBlur2D(bCh, width, height, sigma);

    for (let i = 0; i < total; i++) {
      const deltaA = aCh[i] - aBlurred[i];
      const deltaB = bCh[i] - bBlurred[i];
      colorMap[i] += Math.sqrt(deltaA * deltaA + deltaB * deltaB);
    }
  }

  normalizeMinMaxInPlace(colorMap);
  return colorMap;
}

/**
 * Computes Multi-scale Retinal Intensity Tensor via Difference of Gaussians (DoG)
 */
export function computeRetinalIntensityTensor(
  luminance: Float32Array,
  width: number,
  height: number,
  octavePairs: Array<[number, number]> = [
    [2, 6],
    [4, 12],
    [8, 24],
    [16, 32],
  ]
): Float32Array {
  const total = width * height;
  const intensityMap = new Float32Array(total);

  for (const [sCenter, sSurround] of octavePairs) {
    const dog = differenceOfGaussians(luminance, width, height, sCenter, sSurround);
    for (let i = 0; i < total; i++) {
      intensityMap[i] += dog[i];
    }
  }

  normalizeMinMaxInPlace(intensityMap);
  return intensityMap;
}

/**
 * Computes Structural Clutter, Edge Density, and Semantic CTA Feature Tensor
 */
export function computeStructureTensor(
  rgba: Uint8ClampedArray,
  luminance: Float32Array,
  width: number,
  height: number
): Float32Array {
  const total = width * height;
  const { magnitude: sobelMag } = computeSobelGradients(luminance, width, height);
  normalizeMinMaxInPlace(sobelMag);

  const skinTensor = computeSkinChromaTensor(rgba, width, height);

  // High contrast rectangular edge density filter (CTA/Button/Headline contours)
  const edgeDensity = gaussianBlur2D(sobelMag, width, height, 6);
  normalizeMinMaxInPlace(edgeDensity);

  const structureMap = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    // Structure blends high-frequency gradient, edge density, and skin tone heuristics
    structureMap[i] = 0.5 * sobelMag[i] + 0.3 * edgeDensity[i] + 0.2 * skinTensor[i];
  }

  normalizeMinMaxInPlace(structureMap);
  return structureMap;
}

/**
 * Generates Domain-Specific Spatial Prior Filter
 */
export function generateDomainPrior(
  preset: DomainPreset,
  width: number,
  height: number
): Float32Array {
  const total = width * height;
  const prior = new Float32Array(total);
  const cx = width / 2;
  const cy = height / 2;
  const diag = Math.sqrt(width * width + height * height);

  for (let y = 0; y < height; y++) {
    const ny = y / height;
    for (let x = 0; x < width; x++) {
      const nx = x / width;
      const idx = y * width + x;

      if (preset === 'ui_ux') {
        // F-pattern prior + Top-Left reading gravity + horizontal header bias
        const topWeight = Math.exp(-ny * 3.2);
        const leftWeight = Math.exp(-nx * 2.8);
        const fBar1 = Math.exp(-Math.abs(ny - 0.15) * 12) * Math.exp(-nx * 1.5);
        const fBar2 = Math.exp(-Math.abs(ny - 0.45) * 12) * Math.exp(-nx * 2.5);

        prior[idx] = 0.5 + 0.3 * topWeight + 0.2 * leftWeight + 0.35 * (fBar1 + fBar2);
      } else if (preset === 'advertising') {
        // Center foveal bias + Golden ratio composition focus
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const centerBias = Math.exp(-((dist / (diag * 0.35)) ** 2));
        prior[idx] = 0.55 + 0.45 * centerBias;
      } else if (preset === 'editorial_book') {
        // Gutenberg Z-pattern visual flow
        const zPath =
          Math.exp(-ny * 4) * (1 - nx) + // Top-left anchor
          Math.exp(-Math.abs(ny - (1 - nx)) * 6) * 0.8 + // Diagonal sweep
          Math.exp(-Math.abs(ny - 0.9) * 4) * nx; // Bottom-right exit
        prior[idx] = 0.6 + 0.4 * zPath;
      } else {
        // Fine Art: unbiased neutral isotropic prior
        prior[idx] = 1.0;
      }
    }
  }

  normalizeMinMaxInPlace(prior);
  return prior;
}

/**
 * Computes 16x16 Spatial Tile Entropy and Overall Visual Clarity & Cognitive Load
 */
export function computeEntropyAndClarity(
  saliencyMap: Float32Array,
  structureMap: Float32Array,
  width: number,
  height: number
): {
  entropyGrid: Float32Array;
  clarityScore: number;
  cognitiveLoadScore: number;
} {
  const gridSize = 16;
  const entropyGrid = new Float32Array(gridSize * gridSize);
  const tileW = width / gridSize;
  const tileH = height / gridSize;

  let totalEntropy = 0;
  const bins = 16;

  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      const startX = Math.floor(gx * tileW);
      const endX = Math.floor((gx + 1) * tileW);
      const startY = Math.floor(gy * tileH);
      const endY = Math.floor((gy + 1) * tileH);

      const hist = new Float32Array(bins);
      let count = 0;

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const val = saliencyMap[y * width + x];
          const binIdx = Math.min(bins - 1, Math.floor(val * bins));
          hist[binIdx]++;
          count++;
        }
      }

      let tileHVal = 0;
      if (count > 0) {
        for (let b = 0; b < bins; b++) {
          if (hist[b] > 0) {
            const p = hist[b] / count;
            tileHVal -= p * Math.log2(p);
          }
        }
      }

      const normEntropy = tileHVal / Math.log2(bins);
      entropyGrid[gy * gridSize + gx] = normEntropy;
      totalEntropy += normEntropy;
    }
  }

  const meanEntropy = totalEntropy / (gridSize * gridSize);

  // Compute Gini inequality of saliency distribution
  // High Gini = concentrated focal points = high clarity
  // Low Gini = uniform flat distraction = high cognitive clutter
  const sorted = new Float32Array(saliencyMap).sort();
  let cumulativeSum = 0;
  let totalSum = 0;
  const n = sorted.length;

  for (let i = 0; i < n; i++) {
    totalSum += sorted[i];
  }

  let gini = 0;
  if (totalSum > 1e-6) {
    for (let i = 0; i < n; i++) {
      cumulativeSum += sorted[i];
      gini += (2 * (i + 1) - n - 1) * sorted[i];
    }
    gini /= n * totalSum;
  }

  // Clarity score: high Gini concentration + low dispersed entropy
  const clarity = Math.round(Math.min(100, Math.max(10, gini * 75 + (1 - meanEntropy) * 35)));

  // Cognitive load score: combination of structural edge clutter and entropy
  let meanStructure = 0;
  for (let i = 0; i < structureMap.length; i++) {
    meanStructure += structureMap[i];
  }
  meanStructure /= structureMap.length;

  const cognitiveLoad = Math.round(
    Math.min(100, Math.max(10, meanEntropy * 55 + meanStructure * 45))
  );

  return {
    entropyGrid,
    clarityScore: clarity,
    cognitiveLoadScore: cognitiveLoad,
  };
}

/**
 * Generates Sequential Gaze Scanpaths using Inhibition of Return (IoR)
 */
export function generateIoRScanpath(
  fusedSaliency: Float32Array,
  width: number,
  height: number,
  maxFixations: number = 8,
  iorRadiusPx?: number
): FixationPoint[] {
  const fixations: FixationPoint[] = [];
  const mapCopy = new Float32Array(fusedSaliency);
  const total = width * height;

  const rIor = iorRadiusPx ?? Math.max(20, Math.min(width, height) * 0.12);
  const twoRadiusSq = 2 * rIor * rIor;

  let currentTTFF = 0;
  let lastX = width / 2;
  let lastY = height / 2;

  for (let k = 0; k < maxFixations; k++) {
    // Find global maximum
    let maxVal = -1;
    let maxIdx = 0;

    for (let i = 0; i < total; i++) {
      if (mapCopy[i] > maxVal) {
        maxVal = mapCopy[i];
        maxIdx = i;
      }
    }

    if (maxVal <= 0.05) break;

    const fx = maxIdx % width;
    const fy = Math.floor(maxIdx / width);

    // Dwell Time: 150ms baseline + up to 350ms intensity dwell
    const dwellMs = Math.round(150 + 350 * maxVal);

    // Ballistic Saccadic flight time: 20ms fixed + 2.5ms per visual degree / Euclidean distance
    const dist = Math.hypot(fx - lastX, fy - lastY);
    const saccadeMs = Math.round(20 + 0.15 * dist);
    currentTTFF += (k === 0 ? 0 : saccadeMs) + (k === 0 ? 0 : dwellMs * 0.35);

    fixations.push({
      order: k + 1,
      x: fx,
      y: fy,
      dwellMs,
      ttffMs: Math.round(currentTTFF),
      radius: Math.round(Math.max(18, Math.min(45, (dwellMs / 500) * 40))),
      intensity: Number(maxVal.toFixed(3)),
    });

    lastX = fx;
    lastY = fy;

    // Apply 2D Gaussian Inhibition of Return suppression mask
    const minX = Math.max(0, Math.floor(fx - rIor * 2.5));
    const maxX = Math.min(width - 1, Math.ceil(fx + rIor * 2.5));
    const minY = Math.max(0, Math.floor(fy - rIor * 2.5));
    const maxY = Math.min(height - 1, Math.ceil(fy + rIor * 2.5));

    for (let y = minY; y <= maxY; y++) {
      const rowOffset = y * width;
      const dy = y - fy;
      for (let x = minX; x <= maxX; x++) {
        const dx = x - fx;
        const dSq = dx * dx + dy * dy;
        const suppression = 1.0 - Math.exp(-dSq / twoRadiusSq);
        mapCopy[rowOffset + x] *= suppression;
      }
    }
  }

  return fixations;
}

import { analyzeImageBuffer } from './saliency-core.mjs';

/**
 * Main Deterministic Saliency Engine Pipeline
 */
export function runSaliencyAnalysis(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  options: SaliencyOptions = {}
): SaliencyTensorResult {
  const startTime = performance.now();
  const preset = options.domainPreset ?? 'ui_ux';
  const numFixations = options.maxFixations ?? 8;

  const coreResult = (analyzeImageBuffer as any)(
    rgba,
    width,
    height,
    preset,
    numFixations,
    [],
    options.externalLearnedMap || null,
    options
  );

  const sorted = new Float32Array(coreResult.saliencyMap).sort();
  const qAt = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];

  const quantiles = {
    p50: Number(qAt(0.5).toFixed(4)),
    p75: Number(qAt(0.75).toFixed(4)),
    p90: Number(qAt(0.9).toFixed(4)),
    p95: Number(qAt(0.95).toFixed(4)),
    p99: Number(qAt(0.99).toFixed(4)),
    max: Number(sorted[sorted.length - 1].toFixed(4)),
  };

  const computeTimeMs = Math.round(performance.now() - startTime);

  return {
    ...coreResult,
    quantiles,
    computeTimeMs,
  };
}

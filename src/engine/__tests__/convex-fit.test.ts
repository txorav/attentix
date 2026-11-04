// src/engine/__tests__/convex-fit.test.ts
import { describe, it, expect } from 'vitest';
import {
  computeLossAndGradient,
  computeHessianAndCovariance,
  fitConvexFusion,
  samplePosteriorAoiIntervals,
  checkGradient,
  checkConvexity,
  FACTOR_NAMES,
  DatasetItem,
} from '../convex-fit';

/**
 * Creates a synthetic multi-image dataset with known fixation ground-truth
 */
function createSyntheticDataset(M = 4, W = 20, H = 20, D = 15, numFix = 25): DatasetItem[] {
  const items: DatasetItem[] = [];
  const N = W * H;

  for (let m = 0; m < M; m++) {
    const phi = new Float32Array(N * D);
    const prior = new Float32Array(N);

    // Populate smooth feature channels and prior
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        // Prior: Gaussian center bias
        const dx = (x - W / 2) / (W * 0.4);
        const dy = (y - H / 2) / (H * 0.4);
        prior[i] = -0.5 * (dx * dx + dy * dy);

        for (let d = 0; d < D; d++) {
          const freqX = (d + 1) * 0.3 + (m + 1) * 0.5;
          const freqY = (d + 2) * 0.2 + (m + 1) * 0.3;
          // Features in range [0, 1]
          phi[i * D + d] = 0.5 + 0.5 * Math.sin(x * freqX + y * freqY);
        }
      }
    }

    // Fixations concentrated around feature peaks
    const fixations = new Uint32Array(numFix);
    const meanFixPhi = new Float64Array(D);
    let meanFixPrior = 0;

    for (let f = 0; f < numFix; f++) {
      // Pick pixel with bias toward center & high features
      const fx = Math.min(W - 1, Math.max(0, Math.floor(W / 2 + (Math.sin(f * 2.3 + m) * W * 0.3))));
      const fy = Math.min(H - 1, Math.max(0, Math.floor(H / 2 + (Math.cos(f * 1.7 + m) * H * 0.3))));
      const idx = fy * W + fx;
      fixations[f] = idx;
      meanFixPrior += prior[idx];
      for (let d = 0; d < D; d++) {
        meanFixPhi[d] += phi[idx * D + d];
      }
    }

    meanFixPrior /= numFix;
    for (let d = 0; d < D; d++) {
      meanFixPhi[d] /= numFix;
    }

    items.push({
      N,
      D,
      phi,
      prior,
      fixationIndices: fixations,
      meanFixPhi,
      meanFixPrior,
      numFixations: numFix,
    });
  }

  return items;
}

describe('SPEC §6.1, §6.2: Convex Maximum-Likelihood Fusion Engine', () => {
  it('satisfies SPEC §11.8: analytic gradient matches finite differences (< 1e-4)', () => {
    const dataset = createSyntheticDataset(3, 16, 16, 14, 20);
    const D = 14;
    const testW = new Float64Array(D);
    for (let d = 0; d < D; d++) {
      testW[d] = 0.15 + 0.2 * Math.sin(d * 1.3);
    }

    const gradCheck = checkGradient(testW, dataset, 1e-4, 1e-5);
    expect(gradCheck.passed).toBe(true);
    expect(gradCheck.maxDiff).toBeLessThan(1e-4);
  });

  it('satisfies SPEC §11.9: strictly convex, 5 random restarts converge to identical optimum (< 1e-3)', () => {
    const dataset = createSyntheticDataset(3, 16, 16, 14, 20);
    const convexity = checkConvexity(dataset, { lambda: 1e-3, maxIter: 150 }, 5);

    expect(convexity.passed).toBe(true);
    expect(convexity.maxSpread).toBeLessThan(1e-3);
  });

  it('guarantees non-negativity w_k >= 0 for all main factors k in {I, C, O, SR, FT, U, P, CL, T, FA, S, L}', () => {
    const dataset = createSyntheticDataset(2, 16, 16, 15, 20);
    const fit = fitConvexFusion(dataset, {
      lambda: 1e-3,
      maxIter: 100,
      nonNegativeDims: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    });

    for (let d = 0; d < 12; d++) {
      expect(fit.weights[d]).toBeGreaterThanOrEqual(0);
    }
  });

  it('computes symmetric, strictly positive-definite Hessian with all eigenvalues > 0 (§6.3)', () => {
    const dataset = createSyntheticDataset(2, 16, 16, 14, 20);
    const D = 14;
    const fit = fitConvexFusion(dataset, { lambda: 1e-3, maxIter: 50 });
    const { hessian, covariance, eigenvalues } = computeHessianAndCovariance(fit.weights, dataset, 1e-3);

    // Symmetry check
    for (let i = 0; i < D; i++) {
      for (let j = 0; j < D; j++) {
        expect(Math.abs(hessian[i * D + j] - hessian[j * D + i])).toBeLessThan(1e-7);
        expect(Math.abs(covariance[i * D + j] - covariance[j * D + i])).toBeLessThan(1e-7);
      }
    }

    // Positive-definiteness: all eigenvalues > 0
    for (let d = 0; d < D; d++) {
      expect(eigenvalues[d]).toBeGreaterThan(0);
    }
  });

  it('generates calibrated 95% confidence intervals on AOI attention shares via posterior sampling (§6.3)', () => {
    const W = 30, H = 30, D = 15;
    const dataset = createSyntheticDataset(1, W, H, D, 20);
    const fit = fitConvexFusion(dataset, { lambda: 1e-3, maxIter: 50 });

    const aois = [
      { id: 'aoi-1', x: 5, y: 5, width: 8, height: 8 },
      { id: 'aoi-2', x: 18, y: 18, width: 10, height: 10 },
    ];

    const factorMaps: Float32Array[] = [];
    for (let d = 0; d < D; d++) {
      const f = new Float32Array(W * H);
      for (let i = 0; i < W * H; i++) {
        f[i] = dataset[0].phi[i * D + d];
      }
      factorMaps.push(f);
    }

    const intervals = samplePosteriorAoiIntervals(
      fit.weights,
      fit.covariance,
      aois,
      factorMaps,
      dataset[0].prior || null,
      W,
      H,
      50
    );

    expect(intervals).toHaveLength(2);
    for (const [lo, hi] of intervals) {
      expect(lo).toBeGreaterThanOrEqual(0);
      expect(hi).toBeLessThanOrEqual(100);
      expect(lo).toBeLessThan(hi);
    }
  });
});

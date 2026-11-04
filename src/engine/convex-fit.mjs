// src/engine/convex-fit.mjs
/**
 * Convex Maximum-Likelihood Fusion Optimizer (§6.1, §6.2, §6.3 of ATTENTION_MATH_SPEC.md)
 * 
 * Fits per-mode linear weights w over folded feature maps φ:
 *   p_m(x) = exp(s_m(x)) / Σ_y exp(s_m(y)),  where s_m(x) = w^T φ_m(x) + b_m(x)
 * 
 * Objective (Negative Log-Likelihood with L2 Regularization):
 *   L(w) = - 1 / (Σ n_m) Σ_m Σ_i log p_m(x_{m,i}) + λ ||w||^2
 * 
 * Analytic Gradient:
 *   ∇ L(w) = 1 / (Σ n_m) Σ_m n_m ( E_{p_m}[φ_m] - φ̄_m^{fix} ) + 2λ w
 * 
 * Analytic Hessian:
 *   H = 1 / (Σ n_m) Σ_m n_m Cov_{p_m}[φ_m] + 2λ I
 *   Covariance: Σ_w = ((Σ n_m) H)^{-1}
 * 
 * Constraints:
 *   Main factors w_k >= 0 (visual science monotonicity invariant).
 *   Interaction terms unconstrained.
 */

export const FACTOR_NAMES = [
  'I', 'C', 'O', 'SR', 'FT', 'U', 'P', 'CL', 'T', 'FA', 'S', 'L'
];

/**
 * Log-sum-exp helper for numerical stability
 */
export function logSumExp(arr) {
  let max = -Infinity;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] > max) max = arr[i];
  }
  if (!isFinite(max)) return -Infinity;
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += Math.exp(arr[i] - max);
  }
  return max + Math.log(sum);
}

/**
 * Computes categorical softmax loss L(w) and exact analytic gradient ∇L(w)
 * 
 * @param {Float64Array} w - Weight vector of length D
 * @param {Array} dataset - Array of training images
 *   Each item has:
 *     N: number of pixels
 *     D: number of features
 *     phi: Float32Array of size N * D (row-major: pixel i features at i*D .. i*D+D-1)
 *     prior: Float32Array of size N (fixed spatial priors b(x))
 *     fixationIndices: Uint32Array of pixel indices of human fixations
 *     meanFixPhi: Float64Array of size D (mean φ at human fixations)
 *     meanFixPrior: number (mean prior at human fixations)
 *     numFixations: number of human fixations n_m
 * @param {number} lambda - L2 regularization coefficient
 * @returns {{ loss: number, grad: Float64Array, nll: number, reg: number }}
 */
export function computeLossAndGradient(w, dataset, lambda = 1e-4) {
  const D = w.length;
  let totalFixations = 0;
  for (let m = 0; m < dataset.length; m++) {
    totalFixations += dataset[m].numFixations;
  }
  if (totalFixations === 0) {
    throw new Error('Dataset contains 0 total fixations');
  }

  const grad = new Float64Array(D);
  let totalNLL = 0;

  for (let m = 0; m < dataset.length; m++) {
    const item = dataset[m];
    const N = item.N;
    const n_m = item.numFixations;
    const phi = item.phi;
    const prior = item.prior;

    // Compute linear scores s(x) = w^T φ(x) + b(x)
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

    // Softmax probabilities p(x)
    let sumExp = 0;
    const expScores = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const e = Math.exp(scores[i] - maxScore);
      expScores[i] = e;
      sumExp += e;
    }

    const logZ = maxScore + Math.log(sumExp);
    const invSumExp = 1.0 / sumExp;

    // Expected feature vector E_{p_m}[φ] under current model density
    const expectedPhi = new Float64Array(D);
    for (let i = 0; i < N; i++) {
      const p_i = expScores[i] * invSumExp;
      const offset = i * D;
      for (let d = 0; d < D; d++) {
        expectedPhi[d] += p_i * phi[offset + d];
      }
    }

    // NLL contribution for item m: n_m * (log Z - w^T φ̄^{fix} - b̄^{fix})
    let wDotMeanFix = 0;
    for (let d = 0; d < D; d++) {
      wDotMeanFix += w[d] * item.meanFixPhi[d];
    }
    const itemNLL = n_m * (logZ - wDotMeanFix - (item.meanFixPrior || 0));
    totalNLL += itemNLL;

    // Gradient contribution: n_m * ( E_{p_m}[φ] - φ̄^{fix} )
    for (let d = 0; d < D; d++) {
      grad[d] += n_m * (expectedPhi[d] - item.meanFixPhi[d]);
    }
  }

  // Normalize by total fixation count and add L2 regularization
  const invTotalFix = 1.0 / totalFixations;
  const nll = totalNLL * invTotalFix;

  let reg = 0;
  for (let d = 0; d < D; d++) {
    reg += w[d] * w[d];
    grad[d] = grad[d] * invTotalFix + 2 * lambda * w[d];
  }
  reg *= lambda;

  return {
    loss: nll + reg,
    grad,
    nll,
    reg,
  };
}

/**
 * Computes exact analytic Hessian and weight posterior covariance matrix (§6.3)
 * 
 * H = 1 / (Σ n_m) Σ_m n_m Cov_{p_m}[φ_m] + 2λ I
 * Σ_w = ((Σ n_m) H)^{-1}
 * 
 * @param {Float64Array} w - Weight vector
 * @param {Array} dataset - Dataset
 * @param {number} lambda - Regularization coefficient
 * @returns {{ hessian: Float64Array, covariance: Float64Array, eigenvalues: Float64Array }}
 */
export function computeHessianAndCovariance(w, dataset, lambda = 1e-4) {
  const D = w.length;
  let totalFixations = 0;
  for (let m = 0; m < dataset.length; m++) {
    totalFixations += dataset[m].numFixations;
  }

  const H = new Float64Array(D * D);

  for (let m = 0; m < dataset.length; m++) {
    const item = dataset[m];
    const N = item.N;
    const n_m = item.numFixations;
    const phi = item.phi;
    const prior = item.prior;

    // Compute scores and softmax probabilities
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

    let sumExp = 0;
    const expScores = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const e = Math.exp(scores[i] - maxScore);
      expScores[i] = e;
      sumExp += e;
    }
    const invSumExp = 1.0 / sumExp;

    // 1st moment: E[φ]
    const mu = new Float64Array(D);
    // 2nd moment: E[φ φ^T]
    const M2 = new Float64Array(D * D);

    for (let i = 0; i < N; i++) {
      const p_i = expScores[i] * invSumExp;
      const offset = i * D;
      for (let d1 = 0; d1 < D; d1++) {
        const v1 = phi[offset + d1];
        mu[d1] += p_i * v1;
        const rowOff = d1 * D;
        for (let d2 = d1; d2 < D; d2++) {
          M2[rowOff + d2] += p_i * v1 * phi[offset + d2];
        }
      }
    }

    // Symmetrize M2 and compute Cov = M2 - mu mu^T
    const cov = new Float64Array(D * D);
    for (let d1 = 0; d1 < D; d1++) {
      for (let d2 = d1; d2 < D; d2++) {
        const val = M2[d1 * D + d2] - mu[d1] * mu[d2];
        cov[d1 * D + d2] = val;
        cov[d2 * D + d1] = val;
      }
    }

    // Accumulate weighted covariance: n_m * Cov
    for (let idx = 0; idx < D * D; idx++) {
      H[idx] += n_m * cov[idx];
    }
  }

  // Scale by 1 / totalFixations and add 2λ I
  const invTotalFix = 1.0 / totalFixations;
  for (let idx = 0; idx < D * D; idx++) {
    H[idx] *= invTotalFix;
  }
  for (let d = 0; d < D; d++) {
    H[d * D + d] += 2 * lambda;
  }

  // Invert H to get H^{-1}
  const invH = invertSymmetricPositiveDefinite(H, D);

  // Posterior covariance Σ_w = (totalFixations * H)^{-1} = (1 / totalFixations) * H^{-1}
  const covariance = new Float64Array(D * D);
  for (let idx = 0; idx < D * D; idx++) {
    covariance[idx] = invH[idx] * invTotalFix;
  }

  // Approximate eigenvalues of H via Jacobi or power iteration (for positive-definiteness guarantee)
  const eigenvalues = computeEigenvaluesSymmetric(H, D);

  return {
    hessian: H,
    covariance,
    eigenvalues,
  };
}

/**
 * Inverts a symmetric positive-definite D x D matrix using Cholesky decomposition:
 * A = L L^T => A^{-1} = L^{-T} L^{-1}
 */
export function invertSymmetricPositiveDefinite(A, D) {
  const L = new Float64Array(D * D);

  // Cholesky decomposition
  for (let i = 0; i < D; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += L[i * D + k] * L[j * D + k];
      }
      if (i === j) {
        const val = A[i * D + i] - sum;
        if (val <= 0) {
          // Add small jitter for numerical conditioning if near singular
          L[i * D + j] = Math.sqrt(Math.max(1e-12, val + 1e-8));
        } else {
          L[i * D + j] = Math.sqrt(val);
        }
      } else {
        L[i * D + j] = (A[i * D + j] - sum) / L[j * D + j];
      }
    }
  }

  // Invert lower triangular matrix L
  const L_inv = new Float64Array(D * D);
  for (let i = 0; i < D; i++) {
    L_inv[i * D + i] = 1.0 / L[i * D + i];
    for (let j = 0; j < i; j++) {
      let sum = 0;
      for (let k = j; k < i; k++) {
        sum += L[i * D + k] * L_inv[k * D + j];
      }
      L_inv[i * D + j] = -sum / L[i * D + i];
    }
  }

  // A^{-1} = L^{-T} L^{-1}
  const invA = new Float64Array(D * D);
  for (let i = 0; i < D; i++) {
    for (let j = 0; j < D; j++) {
      let sum = 0;
      for (let k = 0; k < D; k++) {
        sum += L_inv[k * D + i] * L_inv[k * D + j];
      }
      invA[i * D + j] = sum;
    }
  }

  return invA;
}

/**
 * Calculates eigenvalues of a symmetric D x D matrix using Jacobi eigenvalue algorithm
 */
export function computeEigenvaluesSymmetric(A, D, maxIter = 50) {
  const S = new Float64Array(A);
  const V = new Float64Array(D * D);
  for (let i = 0; i < D; i++) V[i * D + i] = 1.0;

  for (let iter = 0; iter < maxIter; iter++) {
    // Find largest off-diagonal element
    let maxOff = 0;
    let p = 0, q = 1;
    for (let i = 0; i < D; i++) {
      for (let j = i + 1; j < D; j++) {
        const val = Math.abs(S[i * D + j]);
        if (val > maxOff) {
          maxOff = val;
          p = i;
          q = j;
        }
      }
    }
    if (maxOff < 1e-12) break;

    const Spq = S[p * D + q];
    const Spp = S[p * D + p];
    const Sqq = S[q * D + q];
    const theta = 0.5 * Math.atan2(2 * Spq, Sqq - Spp);
    const c = Math.cos(theta);
    const s = Math.sin(theta);

    // Apply Givens rotation to S
    for (let i = 0; i < D; i++) {
      if (i !== p && i !== q) {
        const Sip = S[i * D + p];
        const Siq = S[i * D + q];
        S[i * D + p] = c * Sip - s * Siq;
        S[p * D + i] = S[i * D + p];
        S[i * D + q] = s * Sip + c * Siq;
        S[q * D + i] = S[i * D + q];
      }
    }
    const newSpp = c * c * Spp - 2 * s * c * Spq + s * s * Sqq;
    const newSqq = s * s * Spp + 2 * s * c * Spq + c * c * Sqq;
    S[p * D + p] = newSpp;
    S[q * D + q] = newSqq;
    S[p * D + q] = 0;
    S[q * D + p] = 0;
  }

  const eigenvalues = new Float64Array(D);
  for (let i = 0; i < D; i++) {
    eigenvalues[i] = S[i * D + i];
  }
  eigenvalues.sort();
  return eigenvalues;
}

/**
 * Active Projected Newton Optimizer with Armijo Line Search
 * 
 * Guarantees w_k >= 0 for main factors k in nonNegativeDims,
 * leaving interaction terms unconstrained.
 * Achieves quadratic convergence in 5-15 iterations.
 */
export function fitConvexFusion(dataset, options = {}) {
  const {
    lambda = 1e-4,
    maxIter = 40,
    tol = 1e-7,
    nonNegativeDims = Array.from({ length: 12 }, (_, i) => i),
    initialW = null,
    verbose = false,
  } = options;

  const D = dataset[0].D;
  const w = new Float64Array(D);

  if (initialW) {
    for (let d = 0; d < D; d++) w[d] = initialW[d];
  } else {
    // Standard positive initialization for main factors, 0 for interactions
    for (let d = 0; d < D; d++) {
      w[d] = d < 12 ? 0.20 : 0.05;
    }
  }

  // Projection operator: w_k = max(0, w_k) for constrained dims
  const project = (vec) => {
    for (const d of nonNegativeDims) {
      if (vec[d] < 0) vec[d] = 0;
    }
  };
  project(w);

  let curLoss = 0;
  let curGrad = new Float64Array(D);

  for (let iter = 0; iter < maxIter; iter++) {
    const { loss, grad } = computeLossAndGradient(w, dataset, lambda);
    curLoss = loss;
    curGrad = grad;

    // Check projected gradient stopping criterion: || w - Π(w - g) ||_inf
    let projGradNorm = 0;
    for (let d = 0; d < D; d++) {
      let testVal = w[d] - grad[d];
      if (nonNegativeDims.includes(d) && testVal < 0) testVal = 0;
      const diff = Math.abs(w[d] - testVal);
      if (diff > projGradNorm) projGradNorm = diff;
    }

    if (projGradNorm < tol) {
      if (verbose) console.log(`[fitConvexFusion] Converged at iter ${iter}, projGradNorm=${projGradNorm.toExponential(3)}`);
      break;
    }

    const { hessian } = computeHessianAndCovariance(w, dataset, lambda);

    // Active set identification:
    // If coordinate is at non-negativity boundary (w_i <= 1e-6) and gradient points towards boundary (grad_i > 0),
    // coordinate is bound; otherwise it is in the free set F.
    const free = [];
    for (let i = 0; i < D; i++) {
      if (nonNegativeDims.includes(i) && w[i] <= 1e-6 && grad[i] > 0) {
        // Bound
      } else {
        free.push(i);
      }
    }

    const k = free.length;
    const H_free = new Float64Array(k * k);
    const g_free = new Float64Array(k);
    for (let r = 0; r < k; r++) {
      g_free[r] = grad[free[r]];
      for (let c = 0; c < k; c++) {
        H_free[r * k + c] = hessian[free[r] * D + free[c]];
      }
    }

    const invH_free = invertSymmetricPositiveDefinite(H_free, k);
    const dir = new Float64Array(D);
    for (let r = 0; r < k; r++) {
      let sum = 0;
      for (let c = 0; c < k; c++) sum += invH_free[r * k + c] * g_free[c];
      dir[free[r]] = -sum;
    }

    // Armijo backtracking line search along Newton direction
    let alpha = 1.0;
    let candW = new Float64Array(D);
    while (alpha > 1e-6) {
      for (let d = 0; d < D; d++) {
        candW[d] = w[d] + alpha * dir[d];
      }
      project(candW);

      const candidate = computeLossAndGradient(candW, dataset, lambda);
      if (candidate.loss <= loss || alpha <= 1e-5) {
        w.set(candW);
        break;
      }
      alpha *= 0.5;
    }
  }

  // Final projection
  project(w);

  // Compute final Hessian and uncertainty covariance
  const { hessian, covariance, eigenvalues } = computeHessianAndCovariance(w, dataset, lambda);

  return {
    weights: w,
    loss: curLoss,
    grad: curGrad,
    hessian,
    covariance,
    eigenvalues,
  };
}

/**
 * Draws parametric posterior samples w^(s) ~ N(ŵ, Σ_w) and computes calibrated
 * 95% confidence intervals on AOI attention shares (§6.3)
 * 
 * @param {Float64Array} wHat - Maximum likelihood fitted weights
 * @param {Float64Array} covariance - Weight posterior covariance matrix Σ_w
 * @param {Array} aois - Extracted AOIs with bounding boxes
 * @param {Array<Float32Array>} factorMaps - Factor maps for the image
 * @param {Float32Array} priorMap - Fixed spatial prior map
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number} numSamples - Number of posterior Monte Carlo samples (default 50)
 * @returns {Array<[number, number]>} Calibrated 95% intervals [shareLo, shareHi] in percent
 */
export function samplePosteriorAoiIntervals(
  wHat,
  covariance,
  aois,
  factorMaps,
  priorMap,
  width,
  height,
  numSamples = 50
) {
  const D = wHat.length;
  const N = width * height;

  if (aois.length === 0) return [];

  // Cholesky decomposition of covariance: Σ = L L^T
  const L = new Float64Array(D * D);
  for (let i = 0; i < D; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += L[i * D + k] * L[j * D + k];
      }
      if (i === j) {
        const val = covariance[i * D + i] - sum;
        L[i * D + j] = Math.sqrt(Math.max(1e-12, val));
      } else {
        L[i * D + j] = (covariance[i * D + j] - sum) / L[j * D + j];
      }
    }
  }

  // Seeded deterministic Box-Muller generator for reproducible tests
  let seed = 42;
  const pseudoRandom = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const standardNormal = () => {
    const u1 = Math.max(1e-10, pseudoRandom());
    const u2 = pseudoRandom();
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  };

  // Matrix of sample shares: aoiSamples[aoiIdx][sampleIdx]
  const aoiSamples = Array.from({ length: aois.length }, () => new Float64Array(numSamples));

  for (let s = 0; s < numSamples; s++) {
    // Generate z ~ N(0, I)
    const z = new Float64Array(D);
    for (let d = 0; d < D; d++) z[d] = standardNormal();

    // w^(s) = ŵ + L z
    const wSample = new Float64Array(D);
    for (let i = 0; i < D; i++) {
      let sum = 0;
      for (let j = 0; j <= i; j++) {
        sum += L[i * D + j] * z[j];
      }
      // Project main factors to >= 0
      const val = wHat[i] + sum;
      wSample[i] = i < 12 ? Math.max(0, val) : val;
    }

    // Compute sample saliency density
    const scores = new Float64Array(N);
    let maxScore = -Infinity;
    for (let i = 0; i < N; i++) {
      let dot = 0;
      for (let d = 0; d < D; d++) {
        dot += wSample[d] * factorMaps[d][i];
      }
      const val = dot + (priorMap ? priorMap[i] : 0);
      scores[i] = val;
      if (val > maxScore) maxScore = val;
    }

    let totalMass = 0;
    const density = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const p = Math.exp(scores[i] - maxScore);
      density[i] = p;
      totalMass += p;
    }

    const invTotal = totalMass > 0 ? 100.0 / totalMass : 0;

    // Calculate AOI attention shares for this sample
    for (let aIdx = 0; aIdx < aois.length; aIdx++) {
      const aoi = aois[aIdx];
      const startX = Math.max(0, Math.floor(aoi.x));
      const endX = Math.min(width - 1, Math.ceil(aoi.x + aoi.width));
      const startY = Math.max(0, Math.floor(aoi.y));
      const endY = Math.min(height - 1, Math.ceil(aoi.y + aoi.height));

      let boxMass = 0;
      for (let y = startY; y <= endY; y++) {
        const row = y * width;
        for (let x = startX; x <= endX; x++) {
          boxMass += density[row + x];
        }
      }
      aoiSamples[aIdx][s] = boxMass * invTotal;
    }
  }

  // 95% Credible Intervals (2.5% to 97.5%)
  const intervals = [];
  const loIdx = Math.max(0, Math.floor(numSamples * 0.025));
  const hiIdx = Math.min(numSamples - 1, Math.floor(numSamples * 0.975));

  for (let aIdx = 0; aIdx < aois.length; aIdx++) {
    const sorted = aoiSamples[aIdx].sort();
    const lo = Number(Math.max(0, sorted[loIdx]).toFixed(1));
    const hi = Number(Math.min(100, sorted[hiIdx]).toFixed(1));
    intervals.push([lo, hi]);
  }

  return intervals;
}

/**
 * Checks analytic gradient against numerical finite differences (§11.8)
 * 
 * Asserts max |∇_num - ∇_analytic| < 1e-4
 */
export function checkGradient(w, dataset, lambda = 1e-4, epsilon = 1e-5) {
  const D = w.length;
  const { grad: analyticGrad } = computeLossAndGradient(w, dataset, lambda);
  const numericalGrad = new Float64Array(D);

  const wPerturb = new Float64Array(w);

  for (let d = 0; d < D; d++) {
    wPerturb[d] = w[d] + epsilon;
    const lPlus = computeLossAndGradient(wPerturb, dataset, lambda).loss;

    wPerturb[d] = w[d] - epsilon;
    const lMinus = computeLossAndGradient(wPerturb, dataset, lambda).loss;

    numericalGrad[d] = (lPlus - lMinus) / (2 * epsilon);
    wPerturb[d] = w[d];
  }

  let maxDiff = 0;
  for (let d = 0; d < D; d++) {
    const diff = Math.abs(numericalGrad[d] - analyticGrad[d]);
    if (diff > maxDiff) maxDiff = diff;
  }

  return {
    maxDiff,
    analyticGrad,
    numericalGrad,
    passed: maxDiff < 1e-4,
  };
}

/**
 * Tests strict convexity by verifying that multiple random restarts converge
 * to the identical optimum (§11.9)
 */
export function checkConvexity(dataset, options = {}, numRestarts = 5) {
  const D = dataset[0].D;
  const solutions = [];

  for (let r = 0; r < numRestarts; r++) {
    const initW = new Float64Array(D);
    // Varied random restart points
    for (let d = 0; d < D; d++) {
      initW[d] = 0.05 + 0.4 * Math.sin((r + 1) * 17.3 + d * 5.7);
      if (d < 12 && initW[d] < 0) initW[d] = Math.abs(initW[d]);
    }

    const res = fitConvexFusion(dataset, {
      ...options,
      initialW: initW,
      tol: 1e-7,
      maxIter: 250,
    });
    solutions.push(res.weights);
  }

  let maxSpread = 0;
  const base = solutions[0];
  for (let r = 1; r < solutions.length; r++) {
    for (let d = 0; d < D; d++) {
      const diff = Math.abs(solutions[r][d] - base[d]);
      if (diff > maxSpread) maxSpread = diff;
    }
  }

  return {
    maxSpread,
    passed: maxSpread < 1e-3,
    solutions,
  };
}

import { describe, it, expect } from 'vitest';
import { computeAnalysisGridDimensions } from '../saliencyEngine';
import {
  computeQuantiles,
  getPercentileRank,
  computeNeuromarketingMetrics,
  generateScanpathFromRealCV,
} from '../metricsCalculator';
import { sampleLUT } from '../webglRenderer';
import { ColorLUT } from '../types';

describe('attentix Numerical Pipeline & CV Saliency Validation', () => {
  describe('computeAnalysisGridDimensions (Aspect Ratio Preservation)', () => {
    it('preserves 1:1 aspect ratio without stretching into 4:3', () => {
      const { gridWidth, gridHeight } = computeAnalysisGridDimensions(1080, 1080);
      expect(gridWidth).toBe(gridHeight);
      expect(gridWidth % 2).toBe(0);
      expect(gridHeight % 2).toBe(0);
    });

    it('preserves 16:9 banner aspect ratio', () => {
      const { gridWidth, gridHeight } = computeAnalysisGridDimensions(1920, 1080);
      const ratio = gridWidth / gridHeight;
      expect(ratio).toBeCloseTo(16 / 9, 1);
      expect(gridWidth).toBeGreaterThan(gridHeight);
      expect(gridWidth % 2).toBe(0);
      expect(gridHeight % 2).toBe(0);
    });

    it('preserves 9:16 mobile story aspect ratio', () => {
      const { gridWidth, gridHeight } = computeAnalysisGridDimensions(1080, 1920);
      const ratio = gridWidth / gridHeight;
      expect(ratio).toBeCloseTo(9 / 16, 1);
      expect(gridHeight).toBeGreaterThan(gridWidth);
      expect(gridWidth % 2).toBe(0);
      expect(gridHeight % 2).toBe(0);
    });

    it('bounds total grid dimensions within computational budgets', () => {
      const { gridWidth, gridHeight } = computeAnalysisGridDimensions(4000, 3000);
      expect(gridWidth * gridHeight).toBeLessThanOrEqual(250000);
      expect(gridWidth).toBeLessThanOrEqual(640);
      expect(gridHeight).toBeLessThanOrEqual(640);
    });
  });

  describe('computeQuantiles and getPercentileRank (Empirical Saliency Distribution)', () => {
    it('calculates monotonically increasing quantiles from a real density distribution', () => {
      const n = 1000;
      const grid = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        grid[i] = Math.pow(i / n, 2) * 0.001;
      }

      const { quantiles, sorted } = computeQuantiles(grid);
      expect(quantiles.p50).toBeLessThanOrEqual(quantiles.p75);
      expect(quantiles.p75).toBeLessThanOrEqual(quantiles.p90);
      expect(quantiles.p90).toBeLessThanOrEqual(quantiles.p95);
      expect(quantiles.p95).toBeLessThanOrEqual(quantiles.p99);
      expect(quantiles.p99).toBeLessThanOrEqual(quantiles.max);
      expect(sorted.length).toBe(n);
    });

    it('computes exact percentile ranks with binary search', () => {
      const sorted = new Float32Array([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
      expect(getPercentileRank(10, sorted)).toBe(0);
      expect(getPercentileRank(50, sorted)).toBe(40);
      expect(getPercentileRank(100, sorted)).toBe(90);
      expect(getPercentileRank(105, sorted)).toBe(100);
    });
  });

  describe('computeNeuromarketingMetrics', () => {
    it('produces mathematically bounded clarity and cognitive load scores', () => {
      const w = 100;
      const h = 100;
      const total = w * h;
      const saliency = new Float32Array(total);
      const edge = new Float32Array(total);

      // Create a normalized distribution summing to 1.0
      let sum = 0;
      for (let i = 0; i < total; i++) {
        saliency[i] = Math.exp(-i / 1000);
        sum += saliency[i];
      }
      for (let i = 0; i < total; i++) {
        saliency[i] /= sum;
        edge[i] = 0.2;
      }

      const { quantiles } = computeQuantiles(saliency);
      const metrics = computeNeuromarketingMetrics(saliency, edge, w, h, 3, quantiles);

      expect(metrics.clarity_score).toBeGreaterThanOrEqual(0);
      expect(metrics.clarity_score).toBeLessThanOrEqual(100);
      expect(metrics.cognitive_load).toBeGreaterThanOrEqual(0);
      expect(metrics.cognitive_load).toBeLessThanOrEqual(100);
      expect(metrics.clarity_score + metrics.cognitive_load).toBe(100);
      expect(metrics.attention_dispersion_entropy).toBeGreaterThan(0);
      expect(metrics.diagnostics).toBeDefined();
      expect(metrics.diagnostics.peak_concentration_ratio).toBeGreaterThan(0);
    });
  });

  describe('sampleLUT (Color Look-Up Tables)', () => {
    const luts: ColorLUT[] = ['jet', 'inferno', 'turbo', 'viridis'];

    it.each(luts)('generates valid 8-bit RGB triples for %s', (lut) => {
      const testPoints = [0.0, 0.25, 0.5, 0.75, 1.0];
      for (const t of testPoints) {
        const [r, g, b] = sampleLUT(lut, t);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(255);
        expect(g).toBeGreaterThanOrEqual(0);
        expect(g).toBeLessThanOrEqual(255);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThanOrEqual(255);
      }
    });
  });

  describe('generateScanpathFromRealCV (Sequential Visual Foraging)', () => {
    it('generates sequential, ordered fixations with monotonic TTFF', () => {
      const w = 64;
      const h = 64;
      const grid = new Float32Array(w * h);
      // Place focal peak at (20, 20)
      grid[20 * w + 20] = 0.05;
      grid[40 * w + 40] = 0.03;

      const elements = [
        {
          id: 'btn-1',
          type: 'button' as const,
          label: 'Sign Up CTA',
          bbox: [0.25, 0.25, 0.40, 0.35] as [number, number, number, number],
          center: [0.325, 0.30] as [number, number],
          confidence: 0.95,
        },
      ];

      const scanpath = generateScanpathFromRealCV(grid, w, h, elements, '3s');
      expect(scanpath.length).toBeGreaterThanOrEqual(3);

      for (let i = 0; i < scanpath.length; i++) {
        expect(scanpath[i].order).toBe(i + 1);
        expect(scanpath[i].x_norm).toBeGreaterThanOrEqual(0);
        expect(scanpath[i].x_norm).toBeLessThanOrEqual(1);
        expect(scanpath[i].y_norm).toBeGreaterThanOrEqual(0);
        expect(scanpath[i].y_norm).toBeLessThanOrEqual(1);
        expect(scanpath[i].dwell_time_ms).toBeGreaterThan(0);
        if (i > 0) {
          expect(scanpath[i].ttff_ms).toBeGreaterThanOrEqual(scanpath[i - 1].ttff_ms);
        }
      }
    });
  });
});

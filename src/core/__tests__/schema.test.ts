import { describe, it, expect } from 'vitest';
import { toAnalysisResult, validateAnalysisResult } from '../../engine/analysis-schema';
import { analyzeImageBuffer } from '../../engine/saliency-core.mjs';

describe('E0 Schema Verification: AnalysisResult and Element (§6.2)', () => {
  it('validates that AnalysisResult matches §6.2 schema field-for-field with no dwell durations', () => {
    const width = 120, height = 120;
    const rgba = new Uint8ClampedArray(width * height * 4).fill(255);
    // Draw button
    for (let y = 40; y < 70; y++) {
      for (let x = 40; x < 80; x++) {
        const idx = (y * width + x) * 4;
        rgba[idx] = 230; rgba[idx+1] = 40; rgba[idx+2] = 40;
      }
    }

    const rawResult = analyzeImageBuffer(rgba, width, height, 'ui_ux', 5);
    const analysisResult = toAnalysisResult(rawResult);

    const validation = validateAnalysisResult(analysisResult);
    expect(validation.errors).toEqual([]);
    expect(validation.valid).toBe(true);

    // Verify versions
    expect(analysisResult.versions.engine).toBe('2.0.0');
    expect(['attentix-v2-heuristic', 'attentix-v2-calibrated']).toContain(analysisResult.versions.model);
    expect(typeof analysisResult.versions.configHash).toBe('string');
    expect(analysisResult.versions.tier).toBe('browser');

    // Verify scanPath has zero duration (ms) labels
    expect(analysisResult.scanPath).toBeDefined();
    for (const pt of analysisResult.scanPath!) {
      expect(pt).not.toHaveProperty('dwellMs');
      expect(pt).not.toHaveProperty('ttffMs');
      expect(['high', 'low']).toContain(pt.confidence);
    }

    // Verify elements array
    expect(Array.isArray(analysisResult.elements)).toBe(true);
    for (const el of analysisResult.elements) {
      expect(el).toHaveProperty('id');
      expect(el.bbox.length).toBe(4);
      expect(el).toHaveProperty('role');
      expect(el).toHaveProperty('roleConfidence');
    }

    // Verify indices
    expect(analysisResult.indices.focus).toBeGreaterThanOrEqual(0);
    expect(analysisResult.indices.focus).toBeLessThanOrEqual(1);
    expect(analysisResult.indices.load.total).toBeGreaterThanOrEqual(0);
    expect(analysisResult.indices.clarity.value).toBeGreaterThanOrEqual(0);
  });
});

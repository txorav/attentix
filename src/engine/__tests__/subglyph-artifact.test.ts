import { describe, it, expect } from 'vitest';
import { applySubGlyphIsolationGuard, analyzeImageBuffer } from '../saliency-core.mjs';

describe('Sub-Glyph Artifact & Isolation Guard (§2.12)', () => {
  it('suppresses peak responses for a small white dot placed inside a dark letter', () => {
    const width = 160, height = 160;
    const n = width * height;
    const rgba = new Uint8ClampedArray(n * 4);

    // Light background: rgb(235, 235, 235)
    for (let i = 0; i < n; i++) {
      rgba[i * 4] = 235;
      rgba[i * 4 + 1] = 235;
      rgba[i * 4 + 2] = 235;
      rgba[i * 4 + 3] = 255;
    }

    // Draw a dark letter 'O' centered at (80, 80), outer radius 32, inner radius 16
    const cx = 80, cy = 80;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const d2 = (x - cx) ** 2 + (y - cy) ** 2;
        if (d2 <= 32 * 32 && d2 >= 16 * 16) {
          const idx = (y * width + x) * 4;
          rgba[idx] = 20;     // dark letter stroke
          rgba[idx + 1] = 20;
          rgba[idx + 2] = 20;
        }
      }
    }

    // Insert a tiny sub-glyph white dot (2x2 px) right in the center of the dark letter stroke at (80, 56)
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const idx = ((56 + dy) * width + (80 + dx)) * 4;
        rgba[idx] = 255;     // white dot inside dark stroke
        rgba[idx + 1] = 255;
        rgba[idx + 2] = 255;
      }
    }

    const result = analyzeImageBuffer(rgba, width, height, 'ad-poster');

    // Dot location (80, 56)
    const dotVal = result.saliencyRaw[56 * width + 80];

    // The sub-glyph white dot must NOT produce a peak value exceeding the surrounding letter stroke
    const surroundingStrokeVal = Math.max(
      result.saliencyRaw[56 * width + 72], // left of dot on stroke
      result.saliencyRaw[56 * width + 88], // right of dot on stroke
      result.saliencyRaw[80 * width + 56]  // side stroke
    );
    expect(dotVal).toBeLessThanOrEqual(surroundingStrokeVal + 0.05);
  });

  it('directly clamps isolated enclosed peaks in applySubGlyphIsolationGuard', () => {
    const width = 64, height = 64;
    const n = width * height;
    const map = new Float32Array(n);
    const L = new Float32Array(n).fill(85); // Light background

    // Surrounding dark stroke at y in [20, 44], x in [20, 44]
    for (let y = 20; y <= 44; y++) {
      for (let x = 20; x <= 44; x++) {
        L[y * width + x] = 15; // Dark letter
        map[y * width + x] = 0.30;
      }
    }

    // Tiny 2x2 white dot at (32, 32) producing artificial high raw peak 0.95
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = 0; dx <= 1; dx++) {
        L[(32 + dy) * width + (32 + dx)] = 98; // bright dot
        map[(32 + dy) * width + (32 + dx)] = 0.95; // artificial peak
      }
    }

    const guarded = applySubGlyphIsolationGuard(map, L, width, height);
    // Peak at (32, 32) must be clamped below 0.35
    expect(guarded[32 * width + 32]).toBeLessThan(0.35);
  });
});

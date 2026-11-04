import { describe, it, expect } from 'vitest';
import { computeStrokeValidatedTextMap, srgbToLab } from '../saliency-core.mjs';

describe('Relaxed Text Contrast Gating in Containers (§2.9 & §4)', () => {
  it('validates dim-gray text inside dark container via relative local background gating', () => {
    const width = 200, height = 120;
    const n = width * height;
    const L = new Float32Array(n);

    // Dark container background: L ~ 16 (rgb 22, 22, 22)
    L.fill(16.0);

    const containerMask = new Float32Array(n).fill(1.0);

    // Draw dim-gray text strokes: L ~ 32 (contrast ~ 16, well below light-mode 35 contrast, but high SNR on dark)
    // Horizontal text ribbon with 4px stroke width at y in [50, 65], x in [40, 160]
    for (let y = 52; y <= 62; y++) {
      for (let x = 45; x <= 155; x++) {
        // Draw character strokes every 8px
        if (x % 8 >= 2 && x % 8 <= 6) {
          L[y * width + x] = 34.0;
        }
      }
    }

    // 1. With containerMask, threshold relaxes relative to local background (tau ~ 3.0)
    const { textMap: textMapWithContainer } = computeStrokeValidatedTextMap(L, width, height, containerMask as any);

    // 2. Without containerMask on light background default, strict threshold applies
    const { textMap: textMapNoContainer } = computeStrokeValidatedTextMap(L, width, height, null as any);

    // The text inside container must produce a positive text response
    const textCenterVal = textMapWithContainer[57 * width + 100];
    expect(textCenterVal).toBeGreaterThan(0.20);

    // Gating inside container should be relaxed or equal to unconstrained mode
    expect(textCenterVal).toBeGreaterThanOrEqual(textMapNoContainer[57 * width + 100]);
  });
});

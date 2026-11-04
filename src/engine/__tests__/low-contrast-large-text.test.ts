import { describe, it, expect } from 'vitest';
import { computeStrokeValidatedTextMap } from '../saliency-core.mjs';

describe('Size-Aware Low-Contrast Text Validation', () => {
  it('detects large text (cap height >= 24px) even at low contrast with continuous attention scaling', () => {
    const width = 240, height = 180;
    const n = width * height;
    const L = new Float32Array(n).fill(50.0); // Mid-gray background

    // Render a large letter ribbon 'T' (cap height 36px, stroke width 8px) with low contrast (delta L = 10.0)
    // Low contrast (contrast ratio ~ 1.25:1, severe WCAG AA failure): text L = 60.0, background L = 50.0
    const textL = 60.0;
    const topY = 40, botY = 76; // height = 36px
    const startX = 60, endX = 140;

    // Horizontal bar
    for (let y = topY; y <= topY + 7; y++) {
      for (let x = startX; x <= endX; x++) {
        L[y * width + x] = textL;
      }
    }
    // Vertical stem
    const midX = (startX + endX) / 2;
    for (let y = topY + 8; y <= botY; y++) {
      for (let x = midX - 4; x <= midX + 4; x++) {
        L[y * width + x] = textL;
      }
    }

    const { textMap } = computeStrokeValidatedTextMap(L, width, height);

    // Verify that the text region receives activation
    let maxText = 0;
    for (let y = topY; y <= botY; y++) {
      for (let x = startX; x <= endX; x++) {
        if (textMap[y * width + x] > maxText) maxText = textMap[y * width + x];
      }
    }

    expect(maxText).toBeGreaterThan(0.20);
    // Verify background remains near zero
    expect(textMap[10 * width + 10]).toBeLessThan(0.05);
  });
});

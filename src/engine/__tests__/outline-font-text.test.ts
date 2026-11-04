import { describe, it, expect } from 'vitest';
import { computeStrokeValidatedTextMap } from '../saliency-core.mjs';

describe('Outline Font & Light-on-Dark Text Validation (SPEC E1.9)', () => {
  it('detects outline glyphs by validating thin outline stroke edges around hollow bodies', () => {
    const width = 240, height = 180;
    const n = width * height;
    const L = new Float32Array(n).fill(30.0); // Dark background

    // Render an outline letter 'O' with hollow interior:
    // Outer box: x in [70..130], y in [50..95] (height 45px, width 60px)
    // Stroke edge thickness: 2px (bright L = 80.0)
    // Hollow interior: L = 30.0 (same as background)
    const strokeL = 80.0;
    const minX = 70, maxX = 130, minY = 50, maxY = 95;
    const strokeThickness = 2;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const isBorder =
          x < minX + strokeThickness ||
          x > maxX - strokeThickness ||
          y < minY + strokeThickness ||
          y > maxY - strokeThickness;
        if (isBorder) {
          L[y * width + x] = strokeL;
        }
      }
    }

    const { textMap } = computeStrokeValidatedTextMap(L, width, height);

    // Verify detection in the outline glyph region
    let maxActivation = 0;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (textMap[y * width + x] > maxActivation) {
          maxActivation = textMap[y * width + x];
        }
      }
    }

    expect(maxActivation).toBeGreaterThan(0.25);
    // Verify distant non-text canvas has zero activation
    expect(textMap[10 * width + 10]).toBeLessThan(0.05);
  });

  it('detects a multi-letter outlined "WORKSHOP"-style word', () => {
    const width = 360, height = 140;
    const n = width * height;
    const L = new Float32Array(n).fill(25.0); // Dark charcoal background

    // Draw an outlined word sequence with 8 letters (W-O-R-K-S-H-O-P)
    // Each letter is 28px wide, 40px tall, spaced by 8px, stroke width 2px
    const topY = 50, botY = 90;
    const letterW = 28;
    const gap = 8;
    const strokeW = 2;
    const brightL = 88.0;

    for (let i = 0; i < 8; i++) {
      const leftX = 35 + i * (letterW + gap);
      const rightX = leftX + letterW;
      for (let y = topY; y <= botY; y++) {
        for (let x = leftX; x <= rightX; x++) {
          const isBorder =
            x < leftX + strokeW ||
            x > rightX - strokeW ||
            y < topY + strokeW ||
            y > botY - strokeW;
          if (isBorder) {
            L[y * width + x] = brightL;
          }
        }
      }
    }

    const { textMap, textBoxes } = computeStrokeValidatedTextMap(L, width, height);

    let maxActivation = 0;
    for (let y = topY; y <= botY; y++) {
      for (let x = 35; x <= 35 + 8 * 36; x++) {
        if (textMap[y * width + x] > maxActivation) maxActivation = textMap[y * width + x];
      }
    }

    expect(maxActivation).toBeGreaterThan(0.35);
    // Should form detected text boxes spanning the word
    expect(textBoxes.length).toBeGreaterThan(0);
  });

  it('detects light-on-dark text (white font on dark background)', () => {
    const width = 240, height = 120;
    const n = width * height;
    const L = new Float32Array(n).fill(18.0); // Dark background

    // Draw solid white text line at y=48..66, x=40..180
    // with 3px vertical strokes spaced by 7px
    const topY = 48, botY = 66;
    for (let y = topY; y <= botY; y++) {
      for (let x = 40; x <= 180; x++) {
        if (x % 7 >= 1 && x % 7 <= 3) {
          L[y * width + x] = 95.0; // Bright white text
        }
      }
    }

    const { textMap } = computeStrokeValidatedTextMap(L, width, height);

    let maxText = 0;
    for (let y = topY; y <= botY; y++) {
      for (let x = 40; x <= 180; x++) {
        if (textMap[y * width + x] > maxText) maxText = textMap[y * width + x];
      }
    }
    expect(maxText).toBeGreaterThan(0.40);
  });
});

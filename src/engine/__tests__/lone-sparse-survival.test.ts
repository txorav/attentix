import { describe, it, expect } from 'vitest';
import { analyzeImageBuffer } from '../saliency-core.mjs';

describe('Sparse Factor Survival on Flat Images (SPEC E1.5)', () => {
  it('ensures a lone text line on an otherwise flat image survives the flat-image guard', () => {
    const width = 200, height = 200;
    const rgba = new Uint8ClampedArray(width * height * 4);
    // Flat gray background: rgb(160, 160, 160)
    for (let i = 0; i < width * height; i++) {
      rgba[i * 4] = 160;
      rgba[i * 4 + 1] = 160;
      rgba[i * 4 + 2] = 160;
      rgba[i * 4 + 3] = 255;
    }

    // Draw a single lone high-contrast dark text line at y in [90..106], x in [50..150]
    // with vertical stroke reversals every 8px
    for (let y = 92; y <= 104; y++) {
      for (let x = 50; x <= 150; x++) {
        if (x % 8 >= 2 && x % 8 <= 6) {
          const idx = (y * width + x) * 4;
          rgba[idx] = 10;
          rgba[idx + 1] = 10;
          rgba[idx + 2] = 10;
        }
      }
    }

    const res = analyzeImageBuffer(rgba, width, height, 'ui_ux', 5);

    // Text channel must survive and be valid
    expect(res.channelValid.T).toBe(true);
    // Image must NOT be flagged as lowInformation because the sparse text factor survived
    expect(res.warnings.some((w: string) => w.includes('lowInformation'))).toBe(false);

    // Saliency peak must be located on the text line
    let maxSaliencyOnText = 0;
    for (let y = 90; y <= 106; y++) {
      for (let x = 50; x <= 150; x++) {
        const v = res.saliencyRaw[y * width + x];
        if (v > maxSaliencyOnText) maxSaliencyOnText = v;
      }
    }
    expect(maxSaliencyOnText).toBeGreaterThan(0.40);

    // Distant background must be significantly lower
    expect(res.saliencyRaw[20 * width + 20]).toBeLessThan(maxSaliencyOnText * 0.35);
  });

  it('ensures a lone face on a flat background survives the flat-image guard', () => {
    const width = 200, height = 200;
    const rgba = new Uint8ClampedArray(width * height * 4);
    // Flat background: rgb(180, 180, 190)
    for (let i = 0; i < width * height; i++) {
      rgba[i * 4] = 180;
      rgba[i * 4 + 1] = 180;
      rgba[i * 4 + 2] = 190;
      rgba[i * 4 + 3] = 255;
    }

    // Draw a face oval with internal facial features (eyes, mouth) at (100, 100), radius 30
    const cx = 100, cy = 100;
    for (let y = 70; y <= 130; y++) {
      for (let x = 75; x <= 125; x++) {
        const d = ((x - cx) / 25) ** 2 + ((y - cy) / 30) ** 2;
        if (d <= 1.0) {
          const idx = (y * width + x) * 4;
          // Skin tone: rgb(220, 160, 130)
          rgba[idx] = 220;
          rgba[idx + 1] = 160;
          rgba[idx + 2] = 130;
        }
      }
    }
    // Eyes: dark spots at (90, 92) and (110, 92)
    for (const eyeX of [90, 110]) {
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const idx = ((92 + dy) * width + (eyeX + dx)) * 4;
          rgba[idx] = 30; rgba[idx + 1] = 20; rgba[idx + 2] = 15;
        }
      }
    }
    // Mouth: dark horizontal line at y=114, x from 90 to 110
    for (let x = 90; x <= 110; x++) {
      const idx = (114 * width + x) * 4;
      rgba[idx] = 120; rgba[idx + 1] = 40; rgba[idx + 2] = 40;
    }

    const res = analyzeImageBuffer(rgba, width, height, 'natural', 5);

    expect(res.channelValid.FA).toBe(true);
    expect(res.warnings.some((w: string) => w.includes('lowInformation'))).toBe(false);

    let maxFaceSaliency = 0;
    for (let y = 75; y <= 125; y++) {
      for (let x = 80; x <= 120; x++) {
        const v = res.saliencyRaw[y * width + x];
        if (v > maxFaceSaliency) maxFaceSaliency = v;
      }
    }
    expect(maxFaceSaliency).toBeGreaterThan(0.35);
  });
});

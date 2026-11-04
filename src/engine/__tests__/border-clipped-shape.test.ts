import { describe, it, expect } from 'vitest';
import { analyzeImageBuffer } from '../saliency-core.mjs';

describe('Border Handling & Reflect Padding (SPEC E1.7)', () => {
  it('ensures an image with a shape clipped at the left edge does not produce a corner hotspot', () => {
    const width = 240, height = 240;
    const rgba = new Uint8ClampedArray(width * height * 4);
    // Neutral background
    for (let i = 0; i < width * height; i++) {
      rgba[i * 4] = 40;
      rgba[i * 4 + 1] = 45;
      rgba[i * 4 + 2] = 55;
      rgba[i * 4 + 3] = 255;
    }

    // Half-circle / shape clipped at the left edge:
    // Centered at x = 0, y = 120, radius = 40
    // Pixels exist only for x >= 0
    const cy = 120, r = 40;
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = 0; x <= r; x++) {
        if (x * x + (y - cy) * (y - cy) <= r * r) {
          const idx = (y * width + x) * 4;
          rgba[idx] = 240;
          rgba[idx + 1] = 160;
          rgba[idx + 2] = 20;
        }
      }
    }

    const res = analyzeImageBuffer(rgba, width, height, 'natural', 5);

    // Peak attention must stay on the shape itself (near x=0..30, y=100..140)
    let shapeMax = 0, shapeX = 0, shapeY = 0;
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = 0; x <= r; x++) {
        const v = res.saliencyRaw[y * width + x];
        if (v > shapeMax) {
          shapeMax = v;
          shapeX = x;
          shapeY = y;
        }
      }
    }

    // Check corners: (0, 0) and (0, height - 1)
    const topLeftCorner = res.saliencyRaw[0];
    const bottomLeftCorner = res.saliencyRaw[(height - 1) * width];
    const topRightCorner = res.saliencyRaw[width - 1];
    const bottomRightCorner = res.saliencyRaw[height * width - 1];

    expect(shapeMax).toBeGreaterThan(0.50);
    // Corners must NOT be hotspots
    expect(topLeftCorner).toBeLessThan(shapeMax * 0.35);
    expect(bottomLeftCorner).toBeLessThan(shapeMax * 0.35);
    expect(topRightCorner).toBeLessThan(shapeMax * 0.35);
    expect(bottomRightCorner).toBeLessThan(shapeMax * 0.35);

    // Ensure peak y is close to shape center y=120, inside the shape body (y in 80..160)
    expect(Math.abs(shapeY - 120)).toBeLessThan(35);
  });
});

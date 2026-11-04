import { describe, it, expect } from 'vitest';
import { analyzeImageBuffer } from '../saliency-core.mjs';

describe('Center Prior Domination Test (§4.2)', () => {
  it('directs Fixation 1 to center when content at center and corner has equal feature saliency', () => {
    const width = 320, height = 240;
    const n = width * height;
    const rgba = new Uint8ClampedArray(n * 4);

    // Uniform dark background: rgb(30, 30, 30)
    for (let i = 0; i < n; i++) {
      rgba[i * 4] = 30;
      rgba[i * 4 + 1] = 30;
      rgba[i * 4 + 2] = 30;
      rgba[i * 4 + 3] = 255;
    }

    // Helper: draw an identical high-contrast target (24x24 white box)
    function drawTarget(cx: number, cy: number) {
      for (let y = cy - 12; y <= cy + 12; y++) {
        for (let x = cx - 12; x <= cx + 12; x++) {
          if (x >= 0 && x < width && y >= 0 && y < height) {
            const idx = (y * width + x) * 4;
            rgba[idx] = 230;
            rgba[idx + 1] = 230;
            rgba[idx + 2] = 230;
          }
        }
      }
    }

    // Target A: Dead Center (160, 120)
    drawTarget(160, 120);

    // Target B: Top-Left Corner (40, 40)
    drawTarget(40, 40);

    // Run pipeline with desktop-ui mode (which has calibrated foveal center prior)
    const result = analyzeImageBuffer(rgba, width, height, 'desktop-ui');

    expect(result.scanpath.length).toBeGreaterThan(0);
    const fixation1 = result.scanpath[0];

    // Fixation 1 must go to the center target, not the corner target
    const distToCenter = Math.hypot(fixation1.x - 160, fixation1.y - 120);
    const distToCorner = Math.hypot(fixation1.x - 40, fixation1.y - 40);

    expect(distToCenter).toBeLessThan(30);
    expect(distToCenter).toBeLessThan(distToCorner);

    // Center target share of attention must exceed corner target share
    const aois = result.aoi;
    expect(aois.length).toBeGreaterThanOrEqual(1);
    expect(aois[0].shareOfAttention).toBeGreaterThan(aois[1]?.shareOfAttention || 0);
  });
});

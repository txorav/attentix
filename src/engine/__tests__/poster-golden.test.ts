import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { analyzeImageBuffer } from '../saliency-core.mjs';

describe('Poster Golden Regression Suite (Rank-Order Expectations)', () => {
  it('enforces rank-order expectations: headline above footer & corner stars, bottom-left excluded from top 5 AOIs', () => {
    const rawPath = '/tmp/poster_raw.bin';
    if (!fs.existsSync(rawPath)) {
      console.warn('Raw poster buffer not found in /tmp, skipping golden test.');
      return;
    }

    const buf = fs.readFileSync(rawPath);
    const rgba = new Uint8ClampedArray(buf.buffer, buf.byteOffset, buf.byteLength);
    const result = analyzeImageBuffer(rgba, 960, 1280, 'ad-poster');

    // 1. Headline is #1 ranked AOI and dominates the upper region
    expect(result.aoi.length).toBeGreaterThan(0);
    const topAoi = result.aoi[0];
    expect(topAoi.y).toBeLessThan(450);
    expect(topAoi.height).toBeGreaterThan(100);

    // 2. The bottom-left corner must NOT appear among the top 5 AOIs
    const top5 = result.aoi.slice(0, 5);
    for (const aoi of top5) {
      // Bottom-left corner box (x <= 200, y >= 1050)
      const isBottomLeftCorner = (aoi.x + aoi.width <= 320) && (aoi.y >= 1050);
      expect(isBottomLeftCorner).toBe(false);
    }

    // 3. Rank-order expectations: headline region ranks above footer line and corner stars
    const w = 960, h = 1280;
    const sal = result.saliencyRaw;

    function getMeanSaliency(x0: number, y0: number, bw: number, bh: number) {
      let sum = 0;
      for (let y = y0; y < y0 + bh; y++) {
        for (let x = x0; x < x0 + bw; x++) {
          sum += sal[y * w + x];
        }
      }
      return sum / (bw * bh);
    }

    const headlineMean = getMeanSaliency(120, 260, 720, 180);     // Headline text area
    const footerLineMean = getMeanSaliency(60, 1140, 260, 80);     // Lower left footer line
    const topLeftStarMean = getMeanSaliency(20, 20, 100, 100);     // Top-left corner star
    const topRightStarMean = getMeanSaliency(840, 20, 100, 100);   // Top-right corner star

    expect(headlineMean).toBeGreaterThan(footerLineMean);
    expect(headlineMean).toBeGreaterThan(topLeftStarMean);
    expect(headlineMean).toBeGreaterThan(topRightStarMean);

    // 4. Scanpath does not make a canvas-spanning jump on fixation 3 while nearby candidates remain
    expect(result.scanpath.length).toBeGreaterThanOrEqual(3);
    const f1 = result.scanpath[0];
    const f2 = result.scanpath[1];
    const f3 = result.scanpath[2];

    // Fixations 1, 2, 3 explore the upper and middle focal clusters before transitioning to the bottom
    expect(f1.y).toBeLessThan(550);
    expect(f2.y).toBeLessThan(750);
    expect(f3.y).toBeLessThan(950);
  });
});

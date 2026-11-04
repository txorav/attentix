import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { analyzeImageBuffer } from '../saliency-core.mjs';

describe('Desktop UI Golden Regression Suite (Rank-Order Expectations)', () => {
  it('verifies panel AOI dominance over wallpaper blobs and fixation 1 on central panel', () => {
    const rawPath = '/tmp/desktop_wifi_raw.bin';
    if (!fs.existsSync(rawPath)) {
      console.warn('Raw desktop buffer not found in /tmp, skipping golden test.');
      return;
    }

    const buf = fs.readFileSync(rawPath);
    const rgba = new Uint8ClampedArray(buf.buffer, buf.byteOffset, buf.byteLength);
    const width = 1298, height = 758;

    // Run pipeline in desktop-ui mode
    const result = analyzeImageBuffer(rgba, width, height, 'desktop-ui');

    expect(result.aoi.length).toBeGreaterThan(0);
    expect(result.scanpath.length).toBeGreaterThan(0);

    // 1. Rank-Order Expectation: The central panel AOI must exceed any wallpaper blob in share
    const topAoi = result.aoi[0];
    expect(topAoi.shareOfAttention).toBeGreaterThan(40.0);

    // Any wallpaper blob in the corner (e.g. orange blob around x=1195, y=262) must have lower share
    for (const aoi of result.aoi) {
      if (aoi.x > 950 || aoi.y > 600) {
        expect(aoi.shareOfAttention).toBeLessThan(topAoi.shareOfAttention * 0.5);
      }
    }

    // 2. Fixation 1 must be inside or adjacent to the panel (x in [450, 850], y in [180, 560])
    const f1 = result.scanpath[0];
    expect(f1.x).toBeGreaterThanOrEqual(450);
    expect(f1.x).toBeLessThanOrEqual(850);
    expect(f1.y).toBeGreaterThanOrEqual(180);
    expect(f1.y).toBeLessThanOrEqual(560);

    // 3. Auto-detector accurately identifies desktop UI domain from raw pixels
    const autoResult = analyzeImageBuffer(rgba, width, height, 'auto');
    expect(autoResult.mode).toBe('desktop-ui');
  });
});

import { describe, it, expect } from 'vitest';
import { applyRepetitionSuppression, extractAOIsHysteresis } from '../saliency-core.mjs';

describe('Repetition Suppression Suite (§2.11 & SPEC E1.6)', () => {
  function makeGrid(width = 384, height = 288) {
    return new Float32Array(width * height);
  }

  function addCircle(arr: Float32Array, width: number, cx: number, cy: number, radius = 6, val = 1.0) {
    const r2 = radius * radius;
    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) {
          arr[y * width + x] = val;
        }
      }
    }
  }

  it('suppresses a row of 2 repeated circles without leaving endpoints unsuppressed', () => {
    const w = 384, h = 288;
    const input = makeGrid(w, h);
    // Two circles at y = 144, x = 120 and x = 200
    addCircle(input, w, 120, 144, 6, 1.0);
    addCircle(input, w, 200, 144, 6, 1.0);

    const out = applyRepetitionSuppression(input, w, h);
    // Both circles must be attenuated below 1.0
    expect(out[144 * w + 120]).toBeLessThan(0.90);
    expect(out[144 * w + 200]).toBeLessThan(0.90);
  });

  it('suppresses a row of 3 repeated circles across all members', () => {
    const w = 384, h = 288;
    const input = makeGrid(w, h);
    addCircle(input, w, 100, 144, 6, 1.0);
    addCircle(input, w, 160, 144, 6, 1.0);
    addCircle(input, w, 220, 144, 6, 1.0);

    const out = applyRepetitionSuppression(input, w, h);
    expect(out[144 * w + 100]).toBeLessThan(0.90);
    expect(out[144 * w + 160]).toBeLessThan(0.90);
    expect(out[144 * w + 220]).toBeLessThan(0.90);
  });

  it('suppresses a row of 12 identical circles: no end circle ranks in top 3 AOIs', () => {
    const w = 480, h = 640;
    const input = makeGrid(w, h);

    // Place a unique prominent headline hero at top
    addCircle(input, w, 240, 160, 24, 1.0);

    // Place row of 12 circles at y = 320, x spaced every 32px from 64 to 416
    for (let i = 0; i < 12; i++) {
      const cx = 64 + i * 32;
      addCircle(input, w, cx, 320, 6, 0.85);
    }

    const out = applyRepetitionSuppression(input, w, h);
    const aois = extractAOIsHysteresis(out, w, h);

    // Assert that the end circles (x=64 or x=416) are not in top 3 AOIs
    const top3 = aois.slice(0, 3);
    for (const aoi of top3) {
      const isLeftEnd = Math.abs(aoi.x - 64) < 16 && Math.abs(aoi.y - 320) < 16;
      const isRightEnd = Math.abs(aoi.x - 416) < 16 && Math.abs(aoi.y - 320) < 16;
      expect(isLeftEnd).toBe(false);
      expect(isRightEnd).toBe(false);
    }
  });

  it('suppresses a column of repeated elements', () => {
    const w = 384, h = 384;
    const input = makeGrid(w, h);
    // Vertical column at x = 160
    for (let i = 0; i < 5; i++) {
      const cy = 64 + i * 48;
      addCircle(input, w, 160, cy, 6, 1.0);
    }

    const out = applyRepetitionSuppression(input, w, h);
    for (let i = 0; i < 5; i++) {
      const cy = 64 + i * 48;
      expect(out[cy * w + 160]).toBeLessThan(0.90);
    }
  });

  it('suppresses items with irregular spacing along a row: no end element ranks in top 3 AOIs', () => {
    const w = 480, h = 480;
    const input = makeGrid(w, h);

    // Primary unique focal point at top
    addCircle(input, w, 240, 120, 20, 1.0);

    // Irregularly spaced identical circles along y = 280: x = 60, 130, 220, 340, 420
    const xs = [60, 130, 220, 340, 420];
    for (const x of xs) {
      addCircle(input, w, x, 280, 7, 0.90);
    }

    const out = applyRepetitionSuppression(input, w, h);
    for (const x of xs) {
      expect(out[280 * w + x]).toBeLessThan(0.90);
    }

    const aois = extractAOIsHysteresis(out, w, h);
    const top3 = aois.slice(0, 3);
    for (const aoi of top3) {
      const isLeftEnd = Math.abs(aoi.x - 60) < 16 && Math.abs(aoi.y - 280) < 16;
      const isRightEnd = Math.abs(aoi.x - 420) < 16 && Math.abs(aoi.y - 280) < 16;
      expect(isLeftEnd).toBe(false);
      expect(isRightEnd).toBe(false);
    }
  });
});

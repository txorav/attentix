import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { analyzeImageBuffer } from '../saliency-core.mjs';

describe('Failure-Case Golden Suite (Rank-Order Expectations Only)', () => {
  it('verifies that the poster headline ranks above the footer', () => {
    const rawPath = '/tmp/poster_raw.bin';
    if (!fs.existsSync(rawPath)) {
      console.warn('Raw poster buffer not found in /tmp, using synthetic layout.');
      const w = 480, h = 640;
      const rgba = new Uint8ClampedArray(w * h * 4).fill(240);
      // Poster headline text at top (y=100..160, x=60..420)
      for (let y = 100; y <= 160; y++) {
        for (let x = 60; x <= 420; x++) {
          if (x % 10 >= 2 && x % 10 <= 7) {
            const idx = (y * w + x) * 4;
            rgba[idx] = 20; rgba[idx+1] = 20; rgba[idx+2] = 20;
          }
        }
      }
      // Small footer at bottom (y=580..600, x=180..300)
      for (let y = 580; y <= 600; y++) {
        for (let x = 180; x <= 300; x++) {
          if (x % 6 >= 1 && x % 6 <= 3) {
            const idx = (y * w + x) * 4;
            rgba[idx] = 80; rgba[idx+1] = 80; rgba[idx+2] = 80;
          }
        }
      }
      const res = analyzeImageBuffer(rgba, w, h, 'ad-poster');
      const headlineSal = res.saliencyRaw[130 * w + 240];
      const footerSal = res.saliencyRaw[590 * w + 240];
      expect(headlineSal).toBeGreaterThan(footerSal);
      return;
    }

    const buf = fs.readFileSync(rawPath);
    const rgba = new Uint8ClampedArray(buf.buffer, buf.byteOffset, buf.byteLength);
    const result = analyzeImageBuffer(rgba, 960, 1280, 'ad-poster');

    const w = 960;
    const sal = result.saliencyRaw;
    const headlineMean = sal[320 * w + 480];
    const footerMean = sal[1180 * w + 200];
    expect(headlineMean).toBeGreaterThan(footerMean);

    // Headline AOI must rank above footer AOI
    const headlineAoi = result.aoi.find((a: any) => a.y < 450);
    const footerAoi = result.aoi.find((a: any) => a.y > 1000);
    if (headlineAoi && footerAoi) {
      expect(headlineAoi.rank).toBeLessThan(footerAoi.rank);
    }
  });

  it('verifies that no perforation hole is in the top 5 AOIs', () => {
    // A coupon or film sheet with a prominent CTA/headline and a row of high-contrast perforation holes
    const w = 480, h = 480;
    const rgba = new Uint8ClampedArray(w * h * 4);
    // Neutral card background: rgb(230, 230, 235)
    for (let i = 0; i < w * h; i++) {
      rgba[i * 4] = 230;
      rgba[i * 4 + 1] = 230;
      rgba[i * 4 + 2] = 235;
      rgba[i * 4 + 3] = 255;
    }

    // Prominent primary offer headline / CTA at center (x: 140..340, y: 160..240)
    for (let y = 160; y <= 240; y++) {
      for (let x = 140; x <= 340; x++) {
        const idx = (y * w + x) * 4;
        rgba[idx] = 10;
        rgba[idx + 1] = 130;
        rgba[idx + 2] = 220;
      }
    }

    // 16 high-contrast black perforation holes along bottom edge at y = 430
    // spaced every 24px: radius 4px
    const perfHoles: { cx: number; cy: number }[] = [];
    for (let i = 0; i < 16; i++) {
      const cx = 50 + i * 24;
      const cy = 430;
      perfHoles.push({ cx, cy });
      for (let y = cy - 4; y <= cy + 4; y++) {
        for (let x = cx - 4; x <= cx + 4; x++) {
          if ((x - cx) ** 2 + (y - cy) ** 2 <= 16) {
            const idx = (y * w + x) * 4;
            rgba[idx] = 0; rgba[idx + 1] = 0; rgba[idx + 2] = 0;
          }
        }
      }
    }

    const res = analyzeImageBuffer(rgba, w, h, 'ad-poster');

    // Rank-order expectation: no perforation hole appears in the top 5 AOIs
    const top5Aois = res.aoi.slice(0, 5);
    for (const aoi of top5Aois) {
      // Check if this AOI corresponds to any perforation hole
      const isPerfHole = aoi.y >= 415 && aoi.height <= 20 && aoi.width <= 20;
      expect(isPerfHole).toBe(false);
    }
  });

  it('verifies that the Wi-Fi panel AOI share exceeds the largest wallpaper blob', () => {
    const rawPath = '/tmp/desktop_wifi_raw.bin';
    if (!fs.existsSync(rawPath)) {
      console.warn('Raw desktop buffer not found in /tmp, skipping wallpaper blob check.');
      return;
    }

    const buf = fs.readFileSync(rawPath);
    const rgba = new Uint8ClampedArray(buf.buffer, buf.byteOffset, buf.byteLength);
    const result = analyzeImageBuffer(rgba, 1298, 758, 'desktop-ui');

    expect(result.aoi.length).toBeGreaterThan(0);
    const panelAoi = result.aoi[0]; // Central Wi-Fi panel

    // Any wallpaper blob in the corner (x > 950 or y > 600)
    for (const aoi of result.aoi) {
      if (aoi.x > 950 || aoi.y > 600) {
        expect(panelAoi.shareOfAttention).toBeGreaterThan(aoi.shareOfAttention);
      }
    }
  });
});

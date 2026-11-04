import { describe, it, expect } from 'vitest';
import { generatePredictedScanpath } from '../saliency-core.mjs';

describe('Scanpath Saccade Distance Penalty (§5.2)', () => {
  it('does not cross the canvas on fixation 3 when comparable candidates exist nearby', () => {
    const w = 480, h = 640;
    const map = new Float32Array(w * h);

    function addTarget(cx: number, cy: number, r: number, val: number) {
      for (let y = cy - r; y <= cy + r; y++) {
        for (let x = cx - r; x <= cx + r; x++) {
          if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) {
            map[y * w + x] = val;
          }
        }
      }
    }

    // Target 1 (Headline top): (240, 150), val 1.0
    addTarget(240, 150, 20, 1.0);
    // Target 2 (Nearby subheadline): (260, 240), val 0.92
    addTarget(260, 240, 18, 0.92);
    // Target 3 (Nearby body text): (240, 310), val 0.88
    addTarget(240, 310, 18, 0.88);
    // Distant Target (Bottom footer): (240, 580), val 0.94 (slightly higher raw, but far away)
    addTarget(240, 580, 20, 0.94);

    const fixations = generatePredictedScanpath(map, w, h, 4);
    expect(fixations.length).toBe(4);

    // Fixation 1 should be near (240, 150)
    expect(Math.hypot(fixations[0].x - 240, fixations[0].y - 150)).toBeLessThan(30);

    // Fixation 2 should explore the nearby subheadline
    expect(Math.hypot(fixations[1].x - 260, fixations[1].y - 240)).toBeLessThan(35);

    // Fixation 3 should stay in the proximal cluster (Target 3 around y=310) instead of jumping across the canvas to y=580
    expect(fixations[2].y).toBeLessThan(450);
    expect(Math.hypot(fixations[2].x - 240, fixations[2].y - 310)).toBeLessThan(40);
  });
});

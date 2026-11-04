import { AOIRegion, FixationPoint } from '../types/studio';
import { computeAOIMetrics as computeAOIMetricsCore } from './saliency-core.mjs';

export { computeAOIMetricsCore as computeAOIMetrics };

export interface AOICalculationResult {
  id: string;
  shareOfAttention: number;
  noticeability: number;
  ttffMs: number | null;
  meanSaliency: number;
  areaPct: number;
}

/**
 * High-speed real-time AOI spatial integrator (< 2ms execution time)
 * Integrates the saliency tensor over the bounding box [x, y, width, height]
 * and computes exact attention share, area lift ratio (noticeability), and intersection TTFF.
 */
export function calculateAOIMetrics(
  aoi: { x: number; y: number; width: number; height: number },
  saliencyMap: Float32Array,
  mapWidth: number,
  mapHeight: number,
  fixations: FixationPoint[] = []
): {
  shareOfAttention: number;
  noticeability: number;
  ttffMs: number | null;
  meanSaliency: number;
  areaPct: number;
} {
  const totalPixels = mapWidth * mapHeight;
  if (totalPixels === 0 || saliencyMap.length !== totalPixels) {
    return {
      shareOfAttention: 0,
      noticeability: 0,
      ttffMs: null,
      meanSaliency: 0,
      areaPct: 0,
    };
  }

  // Precompute or obtain total saliency integral
  let totalIntegral = 0;
  for (let i = 0; i < totalPixels; i++) {
    totalIntegral += saliencyMap[i];
  }

  // Clamp bounding box coordinates to image boundaries
  const startX = Math.max(0, Math.min(mapWidth - 1, Math.round(aoi.x)));
  const endX = Math.max(0, Math.min(mapWidth, Math.round(aoi.x + aoi.width)));
  const startY = Math.max(0, Math.min(mapHeight - 1, Math.round(aoi.y)));
  const endY = Math.max(0, Math.min(mapHeight, Math.round(aoi.y + aoi.height)));

  const boxW = Math.max(0, endX - startX);
  const boxH = Math.max(0, endY - startY);
  const boxPixels = boxW * boxH;

  if (boxPixels === 0 || totalIntegral <= 1e-7) {
    return {
      shareOfAttention: 0,
      noticeability: 0,
      ttffMs: null,
      meanSaliency: 0,
      areaPct: 0,
    };
  }

  let boxIntegral = 0;
  for (let y = startY; y < endY; y++) {
    const rowOffset = y * mapWidth;
    for (let x = startX; x < endX; x++) {
      boxIntegral += saliencyMap[rowOffset + x];
    }
  }

  const shareOfAttention = Number(((boxIntegral / totalIntegral) * 100).toFixed(1));
  const areaPct = Number(((boxPixels / totalPixels) * 100).toFixed(1));
  const meanSaliency = Number((boxIntegral / boxPixels).toFixed(3));

  // Noticeability is the density lift ratio (Attention Share % / Area Share %); zero for baseline noise (<2%)
  const noticeability =
    areaPct > 0 && shareOfAttention >= 2.0
      ? Number((shareOfAttention / areaPct).toFixed(2))
      : 0;

  // Find first fixation intersecting this AOI
  let minTTFF: number | null = null;
  for (const fix of fixations) {
    if (fix.x >= startX && fix.x <= endX && fix.y >= startY && fix.y <= endY) {
      if (minTTFF === null || fix.ttffMs < minTTFF) {
        minTTFF = fix.ttffMs;
      }
    }
  }

  return {
    shareOfAttention,
    noticeability,
    ttffMs: minTTFF,
    meanSaliency,
    areaPct,
  };
}

/**
 * Re-integrates an array of AOIRegion objects against a new SaliencyTensorResult
 */
export function recalculateAllAOIs(
  regions: AOIRegion[],
  saliencyMap: Float32Array,
  mapWidth: number,
  mapHeight: number,
  fixations: FixationPoint[] = []
): AOIRegion[] {
  return regions.map((aoi) => {
    const metrics = calculateAOIMetrics(aoi, saliencyMap, mapWidth, mapHeight, fixations);
    return {
      ...aoi,
      shareOfAttention: metrics.shareOfAttention,
      noticeability: metrics.noticeability,
      ttffMs: metrics.ttffMs,
    };
  });
}

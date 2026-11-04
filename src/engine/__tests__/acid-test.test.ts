import { describe, it, expect } from 'vitest';
import { runSaliencyAnalysis } from '../saliency-engine';
import { calculateAOIMetrics } from '../aoi-calculator';
import { parseSemanticDOMElements, generateWebpageRasterSVG } from '../../../server/capture-service';

describe('Wave 3: Mandatory Mathematical Acid Test & Saliency Validation', () => {
  it('passes the Mathematical Acid Test on 400x400 synthetic canvas with isolated focal spot', () => {
    const width = 400;
    const height = 400;
    const totalPixels = width * height;
    const rgba = new Uint8ClampedArray(totalPixels * 4);

    // Initialize as 100% Solid Black (#000000)
    for (let i = 0; i < totalPixels; i++) {
      rgba[i * 4] = 0; // R
      rgba[i * 4 + 1] = 0; // G
      rgba[i * 4 + 2] = 0; // B
      rgba[i * 4 + 3] = 255; // A
    }

    // Paint a 40x40 Bright Red Square (#FF0000) at bottom-right (320, 320) -> (360, 360)
    for (let y = 320; y < 360; y++) {
      const rowOffset = y * width;
      for (let x = 320; x < 360; x++) {
        const idx = (rowOffset + x) * 4;
        rgba[idx] = 255; // R
        rgba[idx + 1] = 0; // G
        rgba[idx + 2] = 0; // B
        rgba[idx + 3] = 255; // A
      }
    }

    // Run saliency analysis with neutral fine_art preset (unbiased prior)
    const result = runSaliencyAnalysis(rgba, width, height, {
      domainPreset: 'fine_art',
      maxFixations: 5,
    });

    expect(result.fixations.length).toBeGreaterThanOrEqual(1);
    const fixation1 = result.fixations[0];

    // ASSERTION 1: Fixation #1 (x1, y1) lands strictly inside [315, 365] x [315, 365]
    expect(fixation1.x).toBeGreaterThanOrEqual(315);
    expect(fixation1.x).toBeLessThanOrEqual(365);
    expect(fixation1.y).toBeGreaterThanOrEqual(315);
    expect(fixation1.y).toBeLessThanOrEqual(365);

    // Calculate AOI Metrics for Target Spot: [310, 310, width: 60, height: 60] (covering [310, 310] to [370, 370])
    const targetAOI = calculateAOIMetrics(
      { x: 310, y: 310, width: 60, height: 60 },
      result.saliencyMap,
      width,
      height,
      result.fixations
    );

    // Calculate AOI Metrics for Top-Left Control Spot: [20, 20, width: 60, height: 60] (covering [20, 20] to [80, 80])
    const controlAOI = calculateAOIMetrics(
      { x: 20, y: 20, width: 60, height: 60 },
      result.saliencyMap,
      width,
      height,
      result.fixations
    );

    // ASSERTION 2: Target AOI captures > 60% Share of Attention
    expect(targetAOI.shareOfAttention).toBeGreaterThan(60.0);

    // ASSERTION 3: Baseline top-left AOI captures < 2% Share of Attention
    expect(controlAOI.shareOfAttention).toBeLessThan(2.0);

    // Target AOI noticeability lift ratio should be significantly elevated
    expect(targetAOI.noticeability).toBeGreaterThan(10.0);
    expect(controlAOI.noticeability).toBe(0);
  });

  it('validates the DOM extraction and website raster pipeline', () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>Test Platform Launch</title></head>
        <body>
          <header>
            <nav><a href="/pricing">Pricing</a></nav>
          </header>
          <main>
            <h1>Next-Gen Autonomous Agent Orchestration</h1>
            <p>Deploy multi-agent DAG workflows with zero latency.</p>
            <button class="btn btn-primary cta">Deploy Pipeline Now</button>
          </main>
        </body>
      </html>
    `;

    const { title, elements } = parseSemanticDOMElements(mockHtml, 1440, 900);

    expect(title).toBe('Test Platform Launch');
    expect(elements.length).toBeGreaterThanOrEqual(2);

    const h1Element = elements.find((el) => el.tag === 'h1');
    expect(h1Element).toBeDefined();
    expect(h1Element?.text).toContain('Next-Gen Autonomous Agent Orchestration');

    const ctaElement = elements.find((el) => el.isCTA);
    expect(ctaElement).toBeDefined();
    expect(ctaElement?.text).toContain('Deploy Pipeline Now');
    expect(ctaElement?.contrastRatio).toBeGreaterThan(4.5);

    // Validate SVG raster generator
    const svgDataUrl = generateWebpageRasterSVG(title, 'https://test.local', elements, 1440, 900);
    expect(svgDataUrl.startsWith('data:image/svg+xml')).toBe(true);
    expect(decodeURIComponent(svgDataUrl)).toContain('Deploy Pipeline Now');
  });
});

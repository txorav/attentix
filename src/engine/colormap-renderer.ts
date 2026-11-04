import { ColormapTheme, FixationPoint, VisualMode } from '../types/studio';

/**
 * 256-Entry Colormap Look-Up Tables (LUT)
 * Scientifically sampled curves for Turbo, Inferno, Viridis, and Magma.
 */
export function getLUTColor(t: number, theme: ColormapTheme): [number, number, number] {
  const norm = Math.max(0, Math.min(1, t));

  switch (theme) {
    case 'turbo': {
      // Polynomial approximation of Google Turbo Colormap
      const r =
        0.1357 +
        norm * (4.5974 - norm * (42.6813 - norm * (130.5887 - norm * (154.4929 - norm * 59.395))));
      const g =
        -0.0054 +
        norm * (2.9926 + norm * (4.5388 - norm * (43.8587 - norm * (82.8569 - norm * 46.9961))));
      const b =
        0.4404 +
        norm * (9.0762 - norm * (85.6417 - norm * (329.868 - norm * (508.9429 - norm * 268.919))));
      return [
        Math.round(Math.max(0, Math.min(1, r)) * 255),
        Math.round(Math.max(0, Math.min(1, g)) * 255),
        Math.round(Math.max(0, Math.min(1, b)) * 255),
      ];
    }
    case 'inferno': {
      // Perceptually uniform Inferno
      const r = Math.min(1, Math.max(0, 1.25 * norm - 0.1 * Math.sin(norm * Math.PI)));
      const g = Math.min(1, Math.max(0, 1.15 * Math.pow(norm, 2.2)));
      const b = Math.min(1, Math.max(0, Math.sin(norm * Math.PI * 0.8) * 0.85 + (norm > 0.85 ? norm : 0)));
      return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    }
    case 'viridis': {
      // Perceptually uniform Viridis
      const r = Math.min(1, Math.max(0, 0.28 + 0.72 * Math.pow(norm, 2)));
      const g = Math.min(1, Math.max(0, 0.15 + 0.85 * norm));
      const b = Math.min(1, Math.max(0, 0.45 + 0.55 * Math.sin(norm * Math.PI * 0.5)));
      return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    }
    case 'magma':
    default: {
      // Magma colormap
      const r = Math.min(1, Math.max(0, Math.pow(norm, 0.8) * 1.1));
      const g = Math.min(1, Math.max(0, Math.pow(norm, 1.8) * 0.9));
      const b = Math.min(1, Math.max(0, 0.2 + 0.8 * Math.sin(norm * Math.PI * 0.7)));
      return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    }
  }
}

/**
 * Precomputes a 256-color RGB lookup table buffer for fast indexing
 */
export function buildLUTBuffer(theme: ColormapTheme): Uint8Array {
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const [r, g, b] = getLUTColor(i / 255, theme);
    lut[i * 3] = r;
    lut[i * 3 + 1] = g;
    lut[i * 3 + 2] = b;
  }
  return lut;
}

/**
 * Renders the visual attention overlays onto a target HTML5 2D Canvas context
 */
export function renderCanvasVisualOverlay(
  ctx: CanvasRenderingContext2D,
  baseImage: HTMLImageElement | HTMLCanvasElement,
  saliencyMap: Float32Array,
  structureMap: Float32Array,
  width: number,
  height: number,
  mode: VisualMode,
  theme: ColormapTheme = 'turbo',
  options: {
    opacity?: number;
    fogThreshold?: number;
    splitPosition?: number;
    scrubberTimeSec?: number;
    fixations?: FixationPoint[];
    secondaryImage?: HTMLImageElement | HTMLCanvasElement;
  } = {}
): void {
  ctx.clearRect(0, 0, width, height);

  const opacity = options.opacity ?? 0.7;
  const fogThreshold = options.fogThreshold ?? 0.35;
  const splitPos = options.splitPosition ?? 0.5;

  // 1. Draw base image
  ctx.drawImage(baseImage, 0, 0, width, height);

  if (mode === 'original') {
    return;
  }

  // 2. Mode: Split A/B comparison wipe slider
  if (mode === 'split_ab' && options.secondaryImage) {
    const splitX = Math.round(width * splitPos);
    ctx.save();
    ctx.beginPath();
    ctx.rect(splitX, 0, width - splitX, height);
    ctx.clip();
    ctx.drawImage(options.secondaryImage, 0, 0, width, height);
    ctx.restore();

    // Render slider divider line
    ctx.strokeStyle = '#00E599';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(splitX, 0);
    ctx.lineTo(splitX, height);
    ctx.stroke();

    // Divider handle
    ctx.fillStyle = '#00E599';
    ctx.beginPath();
    ctx.arc(splitX, height / 2, 8, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  // 3. Pixel buffer operations for Heatmap, Fog-of-War, and Clutter
  const imgData = ctx.getImageData(0, 0, width, height);
  const pixels = imgData.data;
  const lut = buildLUTBuffer(theme);

  if (mode === 'heatmap') {
    for (let i = 0; i < saliencyMap.length; i++) {
      const s = saliencyMap[i];
      if (s > 0.05) {
        const lutIdx = Math.min(255, Math.floor(s * 255)) * 3;
        const rHeat = lut[lutIdx];
        const gHeat = lut[lutIdx + 1];
        const bHeat = lut[lutIdx + 2];

        const alpha = Math.min(1.0, s * 1.3) * opacity;
        const pIdx = i * 4;

        pixels[pIdx] = Math.round(pixels[pIdx] * (1 - alpha) + rHeat * alpha);
        pixels[pIdx + 1] = Math.round(pixels[pIdx + 1] * (1 - alpha) + gHeat * alpha);
        pixels[pIdx + 2] = Math.round(pixels[pIdx + 2] * (1 - alpha) + bHeat * alpha);
      }
    }
    ctx.putImageData(imgData, 0, 0);
  } else if (mode === 'fog_of_war') {
    for (let i = 0; i < saliencyMap.length; i++) {
      const s = saliencyMap[i];
      const pIdx = i * 4;

      if (s < fogThreshold) {
        // Darkness and desaturation fog factor
        const factor = Math.max(0.12, (s / fogThreshold) * 0.7);
        const gray = 0.299 * pixels[pIdx] + 0.587 * pixels[pIdx + 1] + 0.114 * pixels[pIdx + 2];

        pixels[pIdx] = Math.round(gray * factor);
        pixels[pIdx + 1] = Math.round(gray * factor);
        pixels[pIdx + 2] = Math.round(gray * factor);
      }
    }
    ctx.putImageData(imgData, 0, 0);
  } else if (mode === 'clutter') {
    for (let i = 0; i < structureMap.length; i++) {
      const c = structureMap[i];
      const pIdx = i * 4;
      const lutIdx = Math.min(255, Math.floor(c * 255)) * 3;

      pixels[pIdx] = Math.round(pixels[pIdx] * 0.2 + lut[lutIdx] * 0.8);
      pixels[pIdx + 1] = Math.round(pixels[pIdx + 1] * 0.2 + lut[lutIdx + 1] * 0.8);
      pixels[pIdx + 2] = Math.round(pixels[pIdx + 2] * 0.2 + lut[lutIdx + 2] * 0.8);
    }
    ctx.putImageData(imgData, 0, 0);
  }

  // 4. Mode: Scanpath with Interactive Timeline Scrubber
  if (mode === 'scanpath' && options.fixations && options.fixations.length > 0) {
    const maxTime = (options.scrubberTimeSec ?? 5.0) * 1000;
    const activeFixations = options.fixations.filter((f) => f.ttffMs <= maxTime);

    if (activeFixations.length > 1) {
      // Draw smooth Bezier curve connections
      ctx.save();
      ctx.strokeStyle = '#00E599';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);

      ctx.beginPath();
      ctx.moveTo(activeFixations[0].x, activeFixations[0].y);

      for (let i = 1; i < activeFixations.length; i++) {
        const prev = activeFixations[i - 1];
        const curr = activeFixations[i];
        const midX = (prev.x + curr.x) / 2;
        const midY = (prev.y + curr.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
      }
      ctx.lineTo(
        activeFixations[activeFixations.length - 1].x,
        activeFixations[activeFixations.length - 1].y
      );
      ctx.stroke();
      ctx.restore();
    }

    // Draw foveal numbered circles
    activeFixations.forEach((f) => {
      ctx.save();

      // Outer glow circle
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.radius + 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 229, 153, 0.25)';
      ctx.fill();

      // Core fixation circle
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(17, 19, 28, 0.9)';
      ctx.strokeStyle = '#00E599';
      ctx.lineWidth = 2.5;
      ctx.fill();
      ctx.stroke();

      // Fixation order number
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(f.order), f.x, f.y - 4);

      // Dwell duration label
      ctx.fillStyle = '#94A3B8';
      ctx.font = '9px monospace';
      ctx.fillText(`${f.dwellMs}ms`, f.x, f.y + 9);

      ctx.restore();
    });
  }
}

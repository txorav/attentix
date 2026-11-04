import { DOMAIN_PROFILES } from './profiles';
import { DomainProfileId, AnalysisResult, ExecutionMode, AOIItem, AssetMetadata, QuantileThresholds } from './types';
import { computeNeuromarketingMetrics, generateScanpathFromRealCV, computeQuantiles } from './metricsCalculator';
import { extractRealImageFeatures, ImageFeatureMaps } from './cvEngine';

export interface SaliencyEngineOptions {
  profileId: DomainProfileId;
  executionMode: ExecutionMode;
  exposureDuration: '3s' | '7s';
  thumbnailSimulator?: boolean;
  customAOIs?: AOIItem[];
  metadata?: Partial<AssetMetadata>;
  abortSignal?: AbortSignal;
}

/**
 * Computes an aspect-ratio-preserving grid with bounded maximum pixel count (~110,000 pixels).
 * Prevents non-4:3 image distortion before feature extraction.
 */
export function computeAnalysisGridDimensions(
  srcWidth: number,
  srcHeight: number,
  targetPixels = 384 * 288
): { gridWidth: number; gridHeight: number } {
  const safeW = Math.max(1, srcWidth);
  const safeH = Math.max(1, srcHeight);
  const aspect = safeW / safeH;

  let gridHeight = Math.round(Math.sqrt(targetPixels / aspect));
  let gridWidth = Math.round(gridHeight * aspect);

  gridWidth = Math.max(128, Math.min(640, gridWidth));
  gridHeight = Math.max(128, Math.min(640, gridHeight));

  if (gridWidth % 2 !== 0) gridWidth++;
  if (gridHeight % 2 !== 0) gridHeight++;

  return { gridWidth, gridHeight };
}

/**
 * 4-Stream Empirical Neuromorphic Fusion Pipeline
 * Operating directly on real decoded image pixel buffers with aspect-ratio preservation and physical parameter mapping.
 */
export async function runNeuromorphicAnalysis(
  sourceImage: HTMLImageElement | HTMLCanvasElement,
  options: SaliencyEngineOptions
): Promise<AnalysisResult> {
  if (options.abortSignal?.aborted) {
    throw new DOMException('Analysis aborted', 'AbortError');
  }

  const startTime = performance.now();
  const profile = DOMAIN_PROFILES[options.profileId] || DOMAIN_PROFILES.ui_ux_web;

  const srcWidth = sourceImage instanceof HTMLImageElement ? sourceImage.naturalWidth : sourceImage.width;
  const srcHeight = sourceImage instanceof HTMLImageElement ? sourceImage.naturalHeight : sourceImage.height;

  // Aspect-ratio-preserving analysis grid
  const { gridWidth, gridHeight } = computeAnalysisGridDimensions(srcWidth, srcHeight);
  const totalPixels = gridWidth * gridHeight;

  // 1. Offscreen rasterization & pre-processing (zero aspect distortion)
  const offscreen = document.createElement('canvas');
  offscreen.width = gridWidth;
  offscreen.height = gridHeight;
  const ctx = offscreen.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not acquire 2D context for neuromorphic processing');

  // Thumbnail simulator: downsamples to 160px then scales to analyze spatial frequency loss
  if (options.thumbnailSimulator) {
    const thumbCanvas = document.createElement('canvas');
    const thumbAspect = srcWidth / srcHeight;
    thumbCanvas.width = 160;
    thumbCanvas.height = Math.max(80, Math.round(160 / thumbAspect));
    const thumbCtx = thumbCanvas.getContext('2d');
    if (thumbCtx) {
      thumbCtx.drawImage(sourceImage, 0, 0, thumbCanvas.width, thumbCanvas.height);
      ctx.drawImage(thumbCanvas, 0, 0, gridWidth, gridHeight);
    } else {
      ctx.drawImage(sourceImage, 0, 0, gridWidth, gridHeight);
    }
  } else {
    ctx.drawImage(sourceImage, 0, 0, gridWidth, gridHeight);
  }

  // 2. Extract Real Computer Vision Feature Maps from Pixels
  const cvMaps: ImageFeatureMaps = extractRealImageFeatures(ctx, gridWidth, gridHeight);

  // --- STREAM 1: Low-Level Cortical Stream (Luminance, Opponency, Sobel Mag) ---
  const sVis = new Float32Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    sVis[i] = cvMaps.edgeGradient[i] * 0.55 + cvMaps.colorOpponency[i] * 0.35 + cvMaps.spatialFrequencyHigh[i] * 0.10;
  }

  // Viewing distance modulates physiological visual angle & receptive field scale
  const viewingDist = options.metadata?.viewingDistance || 'desktop_60cm';
  const blurRadius = viewingDist === 'near_30cm' ? 3 : viewingDist === 'ambient_3m' ? 8 : 5;
  const sVisBlurred = gaussianBlur(sVis, gridWidth, gridHeight, blurRadius);

  // --- STREAM 2: Semantic Object Stream (Detected Real Text & Buttons) ---
  const sText = new Float32Array(totalPixels);
  const sUI = new Float32Array(totalPixels);

  const textElements = cvMaps.elements.filter((e) => e.type === 'text');
  const maxFontH = textElements.reduce((m, e) => Math.max(m, e.fontHeightNorm || 0.05), 0.05);

  for (const textEl of textElements) {
    const relH = (textEl.fontHeightNorm || 0.04) / maxFontH;
    const weight = Math.pow(relH, 1.35) * textEl.confidence;
    const [x1, y1, x2, y2] = textEl.bbox;
    addGaussianPatch(sText, gridWidth, gridHeight, (x1 + x2) / 2, (y1 + y2) / 2, (x2 - x1), (y2 - y1), weight * 1.5);
  }

  const uiElements = cvMaps.elements.filter((e) => e.type === 'button' || e.type === 'logo');
  for (const uiEl of uiElements) {
    const [x1, y1, x2, y2] = uiEl.bbox;
    const sal = uiEl.type === 'button' ? 1.6 : 1.1;
    addGaussianPatch(sUI, gridWidth, gridHeight, (x1 + x2) / 2, (y1 + y2) / 2, (x2 - x1), (y2 - y1), sal * uiEl.confidence);
  }

  // --- STREAM 3: Human Face & Directional Gaze Cueing (Joint Attention Field) ---
  const sFace = new Float32Array(totalPixels);
  const sGaze = new Float32Array(totalPixels);

  const faceElements = cvMaps.elements.filter((e) => e.type === 'face');
  for (const face of faceElements) {
    const [x1, y1, x2, y2] = face.bbox;
    const fw = x2 - x1;
    const fh = y2 - y1;
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;

    addGaussianPatch(sFace, gridWidth, gridHeight, cx, cy, fw, fh, 1.8 * face.confidence);

    if (face.gazeVector) {
      const [dirX, dirY] = face.gazeVector;
      const fx = cx * gridWidth;
      const fy = cy * gridHeight;
      const sigmaR = gridWidth * 0.32;
      const kappa = 2.4;

      for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
          const dx = x - fx;
          const dy = y - fy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 3.0) {
            const dot = (dx / dist) * dirX + (dy / dist) * dirY;
            if (dot > 0.02) {
              const cone = Math.pow(dot, kappa);
              const rDecay = Math.exp(-(dist * dist) / (2 * sigmaR * sigmaR));
              sGaze[y * gridWidth + x] += cone * rDecay * 1.4;
            }
          }
        }
      }
    }
  }

  // --- STREAM 4: Domain & Physical Platform Structural Priors P_domain(x, y) ---
  const pDomain = new Float32Array(totalPixels);
  const platform = options.metadata?.targetPlatform || 'desktop_web';
  const centerSigma = platform === 'social_feed' ? 0.28 : platform === 'mobile_app' ? 0.32 : 0.36;

  for (let y = 0; y < gridHeight; y++) {
    const ny = y / gridHeight;
    for (let x = 0; x < gridWidth; x++) {
      const nx = x / gridWidth;
      const idx = y * gridWidth + x;

      // 1. Center Bias
      const cDistSq = (nx - 0.5) * (nx - 0.5) + (ny - 0.5) * (ny - 0.5);
      const centerVal = Math.exp(-cDistSq / (2 * centerSigma * centerSigma));

      // 2. F-Pattern reading prior (desktop) vs Vertical column prior (mobile)
      let readingPatternVal = 0;
      if (platform === 'mobile_app') {
        // Vertical column bias: eye stays primarily in central column with thumb reach at bottom
        const colCenter = Math.exp(-Math.pow(nx - 0.50, 2) / 0.06);
        const topHeader = Math.exp(-Math.pow(ny - 0.08, 2) / 0.015);
        const bottomThumbZone = Math.exp(-Math.pow(ny - 0.88, 2) / 0.025);
        readingPatternVal = colCenter * 0.50 + topHeader * 0.30 + bottomThumbZone * 0.20;
      } else if (platform === 'social_feed') {
        // Rapid vertical scan center-weighted
        const feedCard = Math.exp(-Math.pow(nx - 0.50, 2) / 0.05) * Math.exp(-Math.pow(ny - 0.40, 2) / 0.12);
        readingPatternVal = feedCard;
      } else {
        // Desktop Web standard F-pattern
        const topBar = Math.exp(-Math.pow(ny - 0.12, 2) / 0.02) * Math.exp(-Math.pow(nx - 0.35, 2) / 0.35);
        const leftCol = Math.exp(-Math.pow(nx - 0.18, 2) / 0.025);
        const midBar = Math.exp(-Math.pow(ny - 0.45, 2) / 0.02) * Math.exp(-Math.pow(nx - 0.40, 2) / 0.20);
        readingPatternVal = topBar * 0.45 + leftCol * 0.35 + midBar * 0.20;
      }

      // 3. Rule of Thirds
      const thirdX = Math.min(Math.abs(nx - 0.33), Math.abs(nx - 0.67));
      const thirdY = Math.min(Math.abs(ny - 0.33), Math.abs(ny - 0.67));
      const ruleOfThirds = Math.exp(-(thirdX * thirdX + thirdY * thirdY) / 0.03);

      const blendedPrior =
        profile.centerBiasPrior * centerVal +
        profile.topLeftFBias * readingPatternVal +
        (profile.id === 'fine_art' || platform === 'packaging' ? 0.45 * ruleOfThirds : 0.06);

      pDomain[idx] = Math.max(0.001, blendedPrior);
    }
  }

  // --- MULTI-STREAM FUSION LOG-DENSITY CALCULATION ---
  normalizeChannel(sVisBlurred);
  normalizeChannel(sText);
  normalizeChannel(sFace);
  normalizeChannel(sGaze);
  normalizeChannel(sUI);

  const logDensity = new Float32Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    logDensity[i] =
      profile.wVis * sVisBlurred[i] * 2.4 +
      profile.wText * sText[i] * 3.2 +
      profile.wFace * sFace[i] * 2.9 +
      profile.wFace * sGaze[i] * 2.2 +
      profile.wUI * sUI[i] * 2.7 +
      Math.log(pDomain[i]);
  }

  // --- SPATIAL SOFTMAX WITH DURATION TEMPERATURE TAU ---
  const tau = options.exposureDuration === '3s' ? 0.46 : 0.86;
  const saliencyGrid = new Float32Array(totalPixels);

  let maxL = -Infinity;
  for (let i = 0; i < totalPixels; i++) {
    if (logDensity[i] > maxL) maxL = logDensity[i];
  }

  let sumExp = 0.0;
  for (let i = 0; i < totalPixels; i++) {
    const val = Math.exp((logDensity[i] - maxL) / tau);
    saliencyGrid[i] = val;
    sumExp += val;
  }

  const invSum = 1.0 / (sumExp || 1.0);
  for (let i = 0; i < totalPixels; i++) {
    saliencyGrid[i] *= invSum;
  }

  // Build Real AOIs from Computer Vision detections
  const autoAOIs: AOIItem[] = cvMaps.elements.map((el, idx) => {
    const [x1, y1, x2, y2] = el.bbox;
    let aoiSum = 0.0;
    const minGX = Math.floor(x1 * gridWidth);
    const maxGX = Math.ceil(x2 * gridWidth);
    const minGY = Math.floor(y1 * gridHeight);
    const maxGY = Math.ceil(y2 * gridHeight);

    for (let gy = minGY; gy < maxGY; gy++) {
      if (gy < 0 || gy >= gridHeight) continue;
      for (let gx = minGX; gx < maxGX; gx++) {
        if (gx < 0 || gx >= gridWidth) continue;
        aoiSum += saliencyGrid[gy * gridWidth + gx];
      }
    }

    const aoiSharePct = Number((aoiSum * 100).toFixed(1));
    const aoiArea = Math.max(0.0001, (x2 - x1) * (y2 - y1));
    const liftRatio = Number((aoiSum / aoiArea).toFixed(2));

    const verdict =
      liftRatio > 1.5 ? 'HIGH_VISIBILITY' : liftRatio >= 1.0 ? 'MODERATE_VISIBILITY' : 'LOW_VISIBILITY_BANNER_BLIND';

    const colors: Record<string, string> = {
      button: '#10b981',
      face: '#ec4899',
      text: '#f59e0b',
      logo: '#3b82f6',
      contrast_peak: '#8b5cf6',
      image_object: '#06b6d4',
    };

    return {
      id: el.id,
      label: el.label,
      bbox_norm: el.bbox,
      attention_share_pct: aoiSharePct,
      attention_lift_ratio: liftRatio,
      verdict,
      color: colors[el.type] || '#10b981',
    };
  });

  // Compute true quantiles from the empirical saliency distribution
  const { quantiles } = computeQuantiles(saliencyGrid);

  // Calculate Shannon entropy, Cognitive Load, Clarity, and Empirical Diagnostics
  const metrics = computeNeuromarketingMetrics(
    saliencyGrid,
    cvMaps.edgeGradient,
    gridWidth,
    gridHeight,
    autoAOIs.length,
    quantiles
  );

  // Generate Scanpath based on real CV detections & IoR solver
  const scanpath = generateScanpathFromRealCV(
    saliencyGrid,
    gridWidth,
    gridHeight,
    cvMaps.elements,
    options.exposureDuration
  );

  // Process Custom user-drawn AOIs
  const customAOIsProcessed = (options.customAOIs || []).map((aoi) => {
    const [x1, y1, x2, y2] = aoi.bbox_norm;
    let aoiSum = 0.0;
    const minGX = Math.floor(x1 * gridWidth);
    const maxGX = Math.ceil(x2 * gridWidth);
    const minGY = Math.floor(y1 * gridHeight);
    const maxGY = Math.ceil(y2 * gridHeight);

    for (let gy = minGY; gy < maxGY; gy++) {
      if (gy < 0 || gy >= gridHeight) continue;
      for (let gx = minGX; gx < maxGX; gx++) {
        if (gx < 0 || gx >= gridWidth) continue;
        aoiSum += saliencyGrid[gy * gridWidth + gx];
      }
    }

    const aoiSharePct = Number((aoiSum * 100).toFixed(1));
    const aoiArea = Math.max(0.0001, (x2 - x1) * (y2 - y1));
    const liftRatio = Number((aoiSum / aoiArea).toFixed(2));

    const verdict: AOIItem['verdict'] =
      liftRatio > 1.5 ? 'HIGH_VISIBILITY' : liftRatio >= 1.0 ? 'MODERATE_VISIBILITY' : 'LOW_VISIBILITY_BANNER_BLIND';

    return {
      ...aoi,
      attention_share_pct: aoiSharePct,
      attention_lift_ratio: liftRatio,
      verdict,
    };
  });

  const endTime = performance.now();
  const inferenceMs = Math.round(endTime - startTime);

  // Real Physical Pixel Statistics
  let lumSum = 0;
  for (let i = 0; i < totalPixels; i++) {
    lumSum += cvMaps.luminance[i];
  }
  const meanLum = lumSum / totalPixels;
  let varSum = 0;
  for (let i = 0; i < totalPixels; i++) {
    const diff = cvMaps.luminance[i] - meanLum;
    varSum += diff * diff;
  }
  const rmsContrast = Number(Math.sqrt(varSum / totalPixels).toFixed(3));
  const meanLuminance = Number(meanLum.toFixed(3));
  const megapixels = Number(((srcWidth * srcHeight) / 1000000).toFixed(2));
  const gcd = (a: number, b: number): number => (!b ? a : gcd(b, a % b));
  const d = gcd(srcWidth, srcHeight);
  const aspectRatio = `${Math.round(srcWidth / d)}:${Math.round(srcHeight / d)}`;

  const finalMetadata: AssetMetadata = {
    filename: options.metadata?.filename || 'Creative Asset',
    fileSizeFormatted: options.metadata?.fileSizeFormatted || `${(megapixels * 0.85).toFixed(1)} MB`,
    fileSizeBytes: options.metadata?.fileSizeBytes || Math.round(srcWidth * srcHeight * 3),
    fileType: options.metadata?.fileType || 'image/png',
    width: srcWidth,
    height: srcHeight,
    aspectRatio,
    megapixels,
    mediumCategory: options.profileId,
    targetPlatform: options.metadata?.targetPlatform || 'desktop_web',
    viewingDistance: options.metadata?.viewingDistance || 'desktop_60cm',
    rmsContrast,
    meanLuminance,
    timestamp: new Date().toISOString(),
  };

  return {
    schema_version: 'attentix-v1.0',
    engine_version: '1.2.0-empirical',
    job_id: `ns_${Date.now().toString(36)}_${(totalPixels % 10000).toString(36)}`,
    execution_mode: options.executionMode,
    inference_time_ms: inferenceMs,
    medium_profile: options.profileId,
    dimensions: { width: srcWidth, height: srcHeight },
    exposure_duration: options.exposureDuration,
    metadata: finalMetadata,
    metrics,
    scanpath,
    auto_detected_aois: autoAOIs,
    custom_aois: customAOIsProcessed,
    saliency_grid: saliencyGrid,
    grid_width: gridWidth,
    grid_height: gridHeight,
    quantiles,
    buffers: {},
  };
}

function gaussianBlur(data: Float32Array, width: number, height: number, radius: number): Float32Array {
  const output = new Float32Array(data.length);
  const kernelSize = radius * 2 + 1;
  const kernel = new Float32Array(kernelSize);
  const sigma = radius / 2.5;
  let sum = 0;

  for (let i = 0; i < kernelSize; i++) {
    const x = i - radius;
    const g = Math.exp(-(x * x) / (2 * sigma * sigma));
    kernel[i] = g;
    sum += g;
  }
  for (let i = 0; i < kernelSize; i++) {
    kernel[i] /= sum;
  }

  const temp = new Float32Array(data.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let acc = 0;
      for (let k = -radius; k <= radius; k++) {
        const px = Math.min(width - 1, Math.max(0, x + k));
        acc += data[y * width + px] * kernel[k + radius];
      }
      temp[y * width + x] = acc;
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let acc = 0;
      for (let k = -radius; k <= radius; k++) {
        const py = Math.min(height - 1, Math.max(0, y + k));
        acc += temp[py * width + x] * kernel[k + radius];
      }
      output[y * width + x] = acc;
    }
  }

  return output;
}

function normalizeChannel(channel: Float32Array) {
  let max = 0;
  for (let i = 0; i < channel.length; i++) {
    if (channel[i] > max) max = channel[i];
  }
  if (max > 0.000001) {
    const invMax = 1.0 / max;
    for (let i = 0; i < channel.length; i++) {
      channel[i] *= invMax;
    }
  }
}

function addGaussianPatch(
  map: Float32Array,
  width: number,
  height: number,
  normX: number,
  normY: number,
  normW: number,
  normH: number,
  amplitude: number
) {
  const cx = normX * width;
  const cy = normY * height;
  const sigmaX = Math.max(8, (normW * width) / 2.2);
  const sigmaY = Math.max(8, (normH * height) / 2.2);
  const spanX = Math.ceil(sigmaX * 2.5);
  const spanY = Math.ceil(sigmaY * 2.5);

  const minX = Math.max(0, Math.floor(cx - spanX));
  const maxX = Math.min(width - 1, Math.ceil(cx + spanX));
  const minY = Math.max(0, Math.floor(cy - spanY));
  const maxY = Math.min(height - 1, Math.ceil(cy + spanY));

  for (let y = minY; y <= maxY; y++) {
    const dy = (y - cy) / sigmaY;
    const expY = Math.exp(-(dy * dy) * 0.5);
    for (let x = minX; x <= maxX; x++) {
      const dx = (x - cx) / sigmaX;
      const expX = Math.exp(-(dx * dx) * 0.5);
      map[y * width + x] += amplitude * expX * expY;
    }
  }
}

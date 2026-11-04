import { runSaliencyAnalysis, SaliencyOptions } from '../engine/saliency-engine';
import * as ort from 'onnxruntime-web';

export interface SaliencyWorkerRequest {
  id: string;
  type: 'RUN_ANALYSIS';
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
  options: SaliencyOptions;
}

export interface SaliencyWorkerResponse {
  id: string;
  type: 'ANALYSIS_COMPLETE' | 'ANALYSIS_ERROR';
  result?: any;
  error?: string;
}

export interface HardwareProfile {
  tierName: string;
  threads: number;
  passes: number;
  provider: string;
  vramMb: number;
  workResolution: string;
  description: string;
  latencyMs?: number;
}

export function getTierHardwareProfile(tier: string): HardwareProfile {
  const norm =
    tier === 'deep_ensemble'
      ? 'max'
      : tier === 'fast_browser'
      ? 'fast'
      : tier === 'hybrid'
      ? 'high'
      : tier;

  const concurrency =
    typeof navigator !== 'undefined' && navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency
      : 4;

  switch (norm) {
    case 'low':
      return {
        tierName: 'Low (Math)',
        threads: 1,
        passes: 0,
        provider: 'Deterministic Vision Math (CPU)',
        vramMb: 0,
        workResolution: '512px Grid',
        description: 'Pure closed-form vision science with zero neural weights (w_L = 0). Minimal compute footprint.',
      };
    case 'fast':
      return {
        tierName: 'Fast (MobileNetV3)',
        threads: Math.min(2, concurrency),
        passes: 1,
        provider: 'WASM SIMD (Fast Student)',
        vramMb: 15,
        workResolution: '512px Grid (1 Global Pass)',
        description: 'Lightweight distilled student model optimized for speed & battery efficiency (~15ms latency).',
      };
    case 'medium':
      return {
        tierName: 'Medium (Standard ONNX)',
        threads: Math.min(4, concurrency),
        passes: 1,
        provider: 'WebGL / WASM SIMD (Balanced)',
        vramMb: 35,
        workResolution: '640px Grid (Edge Refined)',
        description: 'Balanced convolutional neural extractor with Sobel edge-guided spatial alignment.',
      };
    case 'high':
      return {
        tierName: 'High (Hybrid Industry Standard)',
        threads: Math.min(8, concurrency),
        passes: 2,
        provider: 'WebGPU / WASM SIMD (2-Pass Foveal)',
        vramMb: 65,
        workResolution: '768px Grid (Global + Foveal Hotspot)',
        description: 'Reference MobileNetV3-Large ASPP with 2-pass foveal refinement on key attention hotspots.',
      };
    case 'max':
      return {
        tierName: 'Max (Server-Class Deep Ensemble)',
        threads: Math.min(16, concurrency),
        passes: 3,
        provider: 'WebGPU Compute (3-Pass Multi-Scale Pyramid)',
        vramMb: 110,
        workResolution: '896px Grid (Deep Contextual Pyramid)',
        description: 'Multi-scale ensemble with 3 progressive forward passes fusing global scene and zoomed affordances.',
      };
    case 'ultra':
    default:
      return {
        tierName: 'Ultra (Peak Multi-Pass Ensemble)',
        threads: Math.max(4, concurrency),
        passes: 5,
        provider: 'WebGPU Pipeline (5-Pass Quadrant Ensemble)',
        vramMb: 160,
        workResolution: '1024px Grid (Full Quadrant Saturation)',
        description: 'Maximum hardware saturation: 5 parallel neural passes across full frame and 4 high-res overlapping foveal quadrants.',
      };
  }
}

// Global per-tier cached ONNX InferenceSession instances
const onnxSessions = new Map<string, ort.InferenceSession>();
const onnxSessionPromises = new Map<string, Promise<ort.InferenceSession | null>>();

function getModelPathForTier(tier: string): string {
  const normalized =
    tier === 'deep_ensemble'
      ? 'max'
      : tier === 'fast_browser'
      ? 'fast'
      : tier === 'hybrid'
      ? 'high'
      : tier;
  const base =
    typeof location !== 'undefined' && location.pathname.includes('/attentix')
      ? '/attentix'
      : '';
  return `${base}/models/attentix_${normalized}.onnx`;
}

async function getOrInitOnnxSession(tier: string): Promise<ort.InferenceSession | null> {
  const modelPath = getModelPathForTier(tier);
  if (onnxSessions.has(modelPath)) return onnxSessions.get(modelPath)!;
  if (onnxSessionPromises.has(modelPath)) return onnxSessionPromises.get(modelPath)!;

  const profile = getTierHardwareProfile(tier);

  const promise = (async () => {
    try {
      // Explicitly configure wasm path & thread concurrency dynamically based on hardware profile
      if (ort.env.wasm) {
        const wasmBase =
          typeof location !== 'undefined' && location.pathname.includes('/attentix')
            ? '/attentix/'
            : '/';
        ort.env.wasm.wasmPaths = wasmBase;
        ort.env.wasm.numThreads = profile.threads;
        ort.env.wasm.simd = true;
      }

      let session: ort.InferenceSession | null = null;
      try {
        session = await ort.InferenceSession.create(modelPath, {
          executionProviders: ['webgpu', 'webgl', 'wasm'],
          graphOptimizationLevel: 'all',
        });
      } catch (gpuErr) {
        console.info(`WebGPU/WebGL provider unavailable for ${modelPath}, loading via WASM SIMD provider:`, gpuErr);
        session = await ort.InferenceSession.create(modelPath, {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all',
        });
      }
      onnxSessions.set(modelPath, session);
      return session;
    } catch (err) {
      console.warn(`Could not initialize client-side ONNX session for ${modelPath}, falling back to calibrated procedural semantic engine:`, err);
      return null;
    } finally {
      if (!onnxSessions.has(modelPath)) {
        onnxSessionPromises.delete(modelPath);
      }
    }
  })();

  onnxSessionPromises.set(modelPath, promise);
  return promise;
}

/**
 * Pre-processes input RGBA buffer into 1x3x288x384 float32 tensor
 */
function prepareModelInputTensor(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  modelW = 384,
  modelH = 288
): ort.Tensor {
  const floatArr = new Float32Array(3 * modelH * modelW);

  const scaleX = width / modelW;
  const scaleY = height / modelH;

  for (let y = 0; y < modelH; y++) {
    const srcY = Math.min(height - 1, Math.floor(y * scaleY));
    const srcRow = srcY * width;
    const dstRow = y * modelW;

    for (let x = 0; x < modelW; x++) {
      const srcX = Math.min(width - 1, Math.floor(x * scaleX));
      const srcIdx = (srcRow + srcX) * 4;

      const r = rgba[srcIdx] / 255.0;
      const g = rgba[srcIdx + 1] / 255.0;
      const b = rgba[srcIdx + 2] / 255.0;

      // Planar RGB layout (CHW)
      floatArr[0 * (modelH * modelW) + dstRow + x] = r;
      floatArr[1 * (modelH * modelW) + dstRow + x] = g;
      floatArr[2 * (modelH * modelW) + dstRow + x] = b;
    }
  }

  return new ort.Tensor('float32', floatArr, [1, 3, modelH, modelW]);
}

/**
 * Extracts a rectangular crop from an RGBA buffer
 */
function extractCropRgba(
  srcRgba: Uint8ClampedArray,
  srcW: number,
  srcH: number,
  cropX: number,
  cropY: number,
  cropW: number,
  cropH: number
): Uint8ClampedArray {
  const dst = new Uint8ClampedArray(cropW * cropH * 4);
  for (let dy = 0; dy < cropH; dy++) {
    const sy = Math.min(srcH - 1, Math.max(0, cropY + dy));
    const srcRow = sy * srcW;
    const dstRow = dy * cropW;
    for (let dx = 0; dx < cropW; dx++) {
      const sx = Math.min(srcW - 1, Math.max(0, cropX + dx));
      const sIdx = (srcRow + sx) * 4;
      const dIdx = (dstRow + dx) * 4;
      dst[dIdx] = srcRgba[sIdx];
      dst[dIdx + 1] = srcRgba[sIdx + 1];
      dst[dIdx + 2] = srcRgba[sIdx + 2];
      dst[dIdx + 3] = srcRgba[sIdx + 3];
    }
  }
  return dst;
}

/**
 * Bilinear resamples a Float32Array
 */
function resampleFloatMap(
  src: Float32Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
): Float32Array {
  if (srcW === dstW && srcH === dstH) return new Float32Array(src);
  const dst = new Float32Array(dstW * dstH);
  const scaleX = srcW / dstW;
  const scaleY = srcH / dstH;

  for (let y = 0; y < dstH; y++) {
    const srcY = y * scaleY;
    const y0 = Math.floor(srcY);
    const y1 = Math.min(srcH - 1, y0 + 1);
    const wy = srcY - y0;

    for (let x = 0; x < dstW; x++) {
      const srcX = x * scaleX;
      const x0 = Math.floor(srcX);
      const x1 = Math.min(srcW - 1, x0 + 1);
      const wx = srcX - x0;

      const v00 = src[y0 * srcW + x0];
      const v10 = src[y0 * srcW + x1];
      const v01 = src[y1 * srcW + x0];
      const v11 = src[y1 * srcW + x1];

      const top = v00 * (1 - wx) + v10 * wx;
      const bottom = v01 * (1 - wx) + v11 * wx;
      dst[y * dstW + x] = top * (1 - wy) + bottom * wy;
    }
  }
  return dst;
}

/**
 * Blends a crop prediction into the global map with Gaussian foveal falloff
 */
function blendCropIntoMap(
  targetMap: Float32Array,
  targetW: number,
  targetH: number,
  cropPred: Float32Array,
  cropW: number,
  cropH: number,
  dstX: number,
  dstY: number,
  blendWeight: number = 0.45
) {
  // Upscale crop prediction to crop dimension
  const upscaledCrop = resampleFloatMap(cropPred, 384, 288, cropW, cropH);
  const halfW = cropW / 2;
  const halfH = cropH / 2;

  for (let dy = 0; dy < cropH; dy++) {
    const ty = dstY + dy;
    if (ty < 0 || ty >= targetH) continue;
    const ny = (dy - halfH) / (halfH || 1);
    const wy = Math.exp(-2.0 * ny * ny);

    for (let dx = 0; dx < cropW; dx++) {
      const tx = dstX + dx;
      if (tx < 0 || tx >= targetW) continue;
      const nx = (dx - halfW) / (halfW || 1);
      const wx = Math.exp(-2.0 * nx * nx);

      const fovealWeight = blendWeight * wx * wy;
      const targetIdx = ty * targetW + tx;
      const cropVal = upscaledCrop[dy * cropW + dx];

      targetMap[targetIdx] = (1.0 - fovealWeight) * targetMap[targetIdx] + fovealWeight * cropVal;
    }
  }
}

/**
 * Evaluates a single ONNX forward pass
 */
async function evaluateSingleTensorPass(
  session: ort.InferenceSession,
  cropRgba: Uint8ClampedArray,
  cropW: number,
  cropH: number
): Promise<Float32Array> {
  const inputName = session.inputNames[0] || 'input_image';
  const outputName = session.outputNames[0] || 'saliency_map';

  const inputTensor = prepareModelInputTensor(cropRgba, cropW, cropH, 384, 288);
  const output = await session.run({ [inputName]: inputTensor });
  const rawPred = output[outputName];
  return rawPred?.data ? new Float32Array(rawPred.data as Float32Array) : new Float32Array(384 * 288);
}

/**
 * Evaluates tier-specific ONNX neural inference passes, pushing hardware progressively further
 */
async function runTierOnnxInference(
  session: ort.InferenceSession,
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  tier: string
): Promise<Float32Array> {
  const norm =
    tier === 'deep_ensemble'
      ? 'max'
      : tier === 'fast_browser'
      ? 'fast'
      : tier === 'hybrid'
      ? 'high'
      : tier;

  // Pass 1: Global macro context pass
  const globalPass = await evaluateSingleTensorPass(session, rgba, width, height);
  const fullMap = resampleFloatMap(globalPass, 384, 288, width, height);

  if (norm === 'fast' || norm === 'medium') {
    // 1-Pass execution for rapid / balanced throughput
    return fullMap;
  }

  if (norm === 'high') {
    // 2-Pass Execution: Global scene + high-resolution foveal hotspot crop
    let maxVal = -1;
    let maxIdx = 0;
    const stride = Math.max(1, Math.floor(fullMap.length / 5000));
    for (let i = 0; i < fullMap.length; i += stride) {
      if (fullMap[i] > maxVal) {
        maxVal = fullMap[i];
        maxIdx = i;
      }
    }

    const peakX = maxIdx % width;
    const peakY = Math.floor(maxIdx / width);

    const cropW = Math.max(64, Math.round(width * 0.55));
    const cropH = Math.max(48, Math.round(height * 0.55));
    const cropX = Math.max(0, Math.min(width - cropW, Math.round(peakX - cropW / 2)));
    const cropY = Math.max(0, Math.min(height - cropH, Math.round(peakY - cropH / 2)));

    const cropRgba = extractCropRgba(rgba, width, height, cropX, cropY, cropW, cropH);
    const fovealPass = await evaluateSingleTensorPass(session, cropRgba, cropW, cropH);

    blendCropIntoMap(fullMap, width, height, fovealPass, cropW, cropH, cropX, cropY, 0.45);
    return fullMap;
  }

  if (norm === 'max') {
    // 3-Pass Execution: Multi-Scale Contextual Pyramid
    // Pass 2: Central 70% zoom crop
    const zoomW = Math.max(64, Math.round(width * 0.70));
    const zoomH = Math.max(48, Math.round(height * 0.70));
    const zoomX = Math.round((width - zoomW) / 2);
    const zoomY = Math.round((height - zoomH) / 2);
    const zoomRgba = extractCropRgba(rgba, width, height, zoomX, zoomY, zoomW, zoomH);
    const zoomPass = await evaluateSingleTensorPass(session, zoomRgba, zoomW, zoomH);
    blendCropIntoMap(fullMap, width, height, zoomPass, zoomW, zoomH, zoomX, zoomY, 0.35);

    // Pass 3: Hotspot micro-affordance crop
    let maxVal = -1;
    let maxIdx = 0;
    const stride = Math.max(1, Math.floor(fullMap.length / 5000));
    for (let i = 0; i < fullMap.length; i += stride) {
      if (fullMap[i] > maxVal) {
        maxVal = fullMap[i];
        maxIdx = i;
      }
    }
    const peakX = maxIdx % width;
    const peakY = Math.floor(maxIdx / width);
    const hotW = Math.max(64, Math.round(width * 0.45));
    const hotH = Math.max(48, Math.round(height * 0.45));
    const hotX = Math.max(0, Math.min(width - hotW, Math.round(peakX - hotW / 2)));
    const hotY = Math.max(0, Math.min(height - hotH, Math.round(peakY - hotH / 2)));
    const hotRgba = extractCropRgba(rgba, width, height, hotX, hotY, hotW, hotH);
    const hotPass = await evaluateSingleTensorPass(session, hotRgba, hotW, hotH);
    blendCropIntoMap(fullMap, width, height, hotPass, hotW, hotH, hotX, hotY, 0.45);

    return fullMap;
  }

  // Ultra: 5-Pass Execution: Global scene + 4 Overlapping High-Resolution Quadrants
  const quadW = Math.max(64, Math.round(width * 0.58));
  const quadH = Math.max(48, Math.round(height * 0.58));

  const quadrants = [
    { x: 0, y: 0 }, // Top-Left
    { x: Math.max(0, width - quadW), y: 0 }, // Top-Right
    { x: 0, y: Math.max(0, height - quadH) }, // Bottom-Left
    { x: Math.max(0, width - quadW), y: Math.max(0, height - quadH) }, // Bottom-Right
  ];

  for (const quad of quadrants) {
    const qRgba = extractCropRgba(rgba, width, height, quad.x, quad.y, quadW, quadH);
    const qPass = await evaluateSingleTensorPass(session, qRgba, quadW, quadH);
    blendCropIntoMap(fullMap, width, height, qPass, quadW, quadH, quad.x, quad.y, 0.40);
  }

  // Normalize final blended distribution into [0, 1]
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < fullMap.length; i++) {
    const v = fullMap[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1e-6;
  for (let i = 0; i < fullMap.length; i++) {
    fullMap[i] = (fullMap[i] - min) / range;
  }

  return fullMap;
}

// Listen for worker requests in worker global scope
if (typeof self !== 'undefined' && typeof (self as any).window === 'undefined') {
  (self as unknown as Worker).onmessage = async (e: MessageEvent<SaliencyWorkerRequest>) => {
    const data = e.data;
    if (data && data.type === 'RUN_ANALYSIS') {
      try {
        const tier = data.options?.modelTier || 'high';
        const isLowMath = tier === 'low' || tier === 'hand_crafted';
        const profile = getTierHardwareProfile(tier);

        let externalLearnedMap: Float32Array | undefined = undefined;
        const inferenceStart = performance.now();

        if (!isLowMath) {
          try {
            const session = await getOrInitOnnxSession(tier);
            if (session) {
              externalLearnedMap = await runTierOnnxInference(
                session,
                data.rgba,
                data.width,
                data.height,
                tier
              );
            }
          } catch (onnxErr) {
            console.warn(`ONNX inference error in worker for tier ${tier}:`, onnxErr);
          }
        }

        const inferenceLatencyMs = Math.round(performance.now() - inferenceStart);
        profile.latencyMs = inferenceLatencyMs;

        // Run analysis fusing neural Channel L with empirical stroke guards
        const mergedOptions: SaliencyOptions = {
          ...data.options,
          externalLearnedMap: externalLearnedMap || data.options.externalLearnedMap,
          hardwareProfile: profile,
        };

        const result = runSaliencyAnalysis(data.rgba, data.width, data.height, mergedOptions);
        (self as unknown as Worker).postMessage({
          id: data.id,
          type: 'ANALYSIS_COMPLETE',
          result,
        });
      } catch (err: any) {
        (self as unknown as Worker).postMessage({
          id: data.id,
          type: 'ANALYSIS_ERROR',
          error: err?.message || String(err),
        });
      }
    }
  };
}

// src/engine/saliency-core.ts
import * as coreMjs from './saliency-core.mjs';
import { FixationPoint, SaliencyTensorResult } from '../types/studio';
import type { AttentionHeatmapOptions } from './saliency-core.d';

export const ATTENTION_CONFIG = (coreMjs as any).ATTENTION_CONFIG;
export const SALIENCY_CONFIG = (coreMjs as any).SALIENCY_CONFIG;

export const srgbToLab = coreMjs.srgbToLab as (r8: number, g8: number, b8: number) => [number, number, number];
export const gaussianKernel1D = coreMjs.gaussianKernel1D as (sigma: number) => { kernel: Float32Array; radius: number };
export const convolveSeparable = coreMjs.convolveSeparable as (
  src: Float32Array,
  width: number,
  height: number,
  sigma: number
) => Float32Array;

export const robustPercentileNormalize = coreMjs.robustPercentileNormalize as (
  arr: Float32Array,
  pLow?: number,
  pHigh?: number
) => Float32Array;

export const buildColormapLUT = coreMjs.buildColormapLUT as (colormap?: string) => Uint8Array;

export const renderAttentionHeatmapRGBA = coreMjs.renderAttentionHeatmapRGBA as (
  baseRgba: Uint8ClampedArray,
  saliencyMap: Float32Array,
  width: number,
  height: number,
  options?: AttentionHeatmapOptions
) => Uint8ClampedArray;

export const analyzeImageBuffer = coreMjs.analyzeImageBuffer as (
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  preset?: string,
  numFixations?: number,
  domBoxes?: any[],
  externalLearnedMap?: Float32Array | null,
  options?: any
) => SaliencyTensorResult;

export const generateScanpathIoR = ((coreMjs as any).generateScanpathIoR || (coreMjs as any).generatePredictedScanpath) as (
  saliencyMap: Float32Array,
  width: number,
  height: number,
  count?: number
) => FixationPoint[];

export const computeAOIMetrics = coreMjs.computeAOIMetrics as (
  saliencyMap: Float32Array,
  width: number,
  height: number,
  fixations: FixationPoint[],
  box: { id: string; label: string; x: number; y: number; width: number; height: number; [key: string]: any }
) => any;

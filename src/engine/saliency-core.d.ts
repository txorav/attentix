import { FixationPoint, SaliencyTensorResult } from '../types/studio';

export declare const SALIENCY_CONFIG: {
  weights: {
    contrast: number;
    saturation: number;
    rarity: number;
    cluster: number;
    globalContext: number;
    structure: number;
    text: number;
  };
  synergy: {
    linearShare: number;
    synergyShare: number;
  };
  boosts: {
    faceBoost: number;
    ctaBoost: number;
  };
  priors: {
    uiReadingWeight: number;
    centerBiasWeight: number;
  };
  gbvs: {
    iterations: number;
    sigma: number;
  };
  normalization: {
    pLow: number;
    pHigh: number;
  };
  performance: {
    maxWorkingDimension: number;
  };
};

export declare function srgbToLab(r8: number, g8: number, b8: number): [number, number, number];

export declare function gaussianKernel1D(sigma: number): {
  kernel: Float32Array;
  radius: number;
};

export declare function convolveSeparable(
  src: Float32Array,
  width: number,
  height: number,
  sigma: number
): Float32Array;

export declare function robustPercentileNormalize(
  arr: Float32Array,
  pLow?: number,
  pHigh?: number
): Float32Array;

export declare function buildColormapLUT(colormap?: string): Uint8Array;

export interface AttentionHeatmapOptions {
  mode?: string;
  colormap?: string;
  opacity?: number;
  threshold?: number;
  darkenBase?: number;
  showContours?: boolean;
  structureMap?: Float32Array | null;
}

export declare function renderAttentionHeatmapRGBA(
  baseRgba: Uint8ClampedArray,
  saliencyMap: Float32Array,
  width: number,
  height: number,
  options?: AttentionHeatmapOptions
): Uint8ClampedArray;

export declare function analyzeImageBuffer(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  preset?: string,
  numFixations?: number,
  domBoxes?: any[],
  externalLearnedMap?: Float32Array | null,
  options?: any
): SaliencyTensorResult;

export declare function generateScanpathIoR(
  saliencyMap: Float32Array,
  width: number,
  height: number,
  count?: number
): FixationPoint[];

export declare function computeTriFactorCognitiveLoad(
  L: Float32Array,
  A: Float32Array,
  B: Float32Array,
  C: Float32Array,
  Gx: Float32Array,
  Gy: Float32Array,
  mag: Float32Array,
  fusedAttention: Float32Array,
  paletteEntropy: number,
  activeColorBins: number,
  width: number,
  height: number
): {
  clarityScore: number;
  cognitiveLoadScore: number;
  colorLoadScore: number;
  shapeLoadScore: number;
  textLoadScore: number;
  colorLoadMap: Float32Array;
  shapeMap: Float32Array;
  textMap: Float32Array;
  cognitiveLoadMap: Float32Array;
  entropyGrid: Float32Array;
};

export declare function computeUniquenessAndClusterMatrices(
  L: Float32Array,
  A: Float32Array,
  B: Float32Array,
  width: number,
  height: number
): {
  uniquenessMap: Float32Array;
  clusterMap: Float32Array;
  paletteEntropy: number;
  activeColorBins: number;
};

export declare function computeGlobalContextCues(
  L: Float32Array,
  A: Float32Array,
  B: Float32Array,
  width: number,
  height: number
): Float32Array;

export declare function applyGbvsMarkovEquilibrium(
  activationMap: Float32Array,
  width: number,
  height: number,
  iterations?: number,
  sigma?: number
): Float32Array;

export declare function computeAOIMetrics(
  saliencyMap: Float32Array,
  width: number,
  height: number,
  fixations: FixationPoint[],
  box: {
    id: string;
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
    [key: string]: any;
  }
): any;

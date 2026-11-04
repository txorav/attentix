// src/engine/convex-fit.ts
import * as convexCore from './convex-fit.mjs';

export interface DatasetItem {
  N: number;
  D: number;
  phi: Float32Array;
  prior?: Float32Array;
  fixationIndices: Uint32Array;
  meanFixPhi: Float64Array;
  meanFixPrior?: number;
  numFixations: number;
}

export interface FitOptions {
  lambda?: number;
  maxIter?: number;
  tol?: number;
  nonNegativeDims?: number[];
  initialW?: Float64Array | null;
  verbose?: boolean;
}

export interface FitResult {
  weights: Float64Array;
  loss: number;
  grad: Float64Array;
  hessian: Float64Array;
  covariance: Float64Array;
  eigenvalues: Float64Array;
}

export const FACTOR_NAMES = (convexCore as any).FACTOR_NAMES as string[];
export const computeLossAndGradient = (convexCore as any).computeLossAndGradient as (
  w: Float64Array,
  dataset: DatasetItem[],
  lambda?: number
) => { loss: number; grad: Float64Array; nll: number; reg: number };

export const computeHessianAndCovariance = (convexCore as any).computeHessianAndCovariance as (
  w: Float64Array,
  dataset: DatasetItem[],
  lambda?: number
) => { hessian: Float64Array; covariance: Float64Array; eigenvalues: Float64Array };

export const fitConvexFusion = (convexCore as any).fitConvexFusion as (
  dataset: DatasetItem[],
  options?: FitOptions
) => FitResult;

export const samplePosteriorAoiIntervals = (convexCore as any).samplePosteriorAoiIntervals as (
  wHat: Float64Array,
  covariance: Float64Array,
  aois: Array<{ x: number; y: number; width: number; height: number; [key: string]: any }>,
  factorMaps: Float32Array[],
  priorMap: Float32Array | null,
  width: number,
  height: number,
  numSamples?: number
) => Array<[number, number]>;

export const checkGradient = (convexCore as any).checkGradient as (
  w: Float64Array,
  dataset: DatasetItem[],
  lambda?: number,
  epsilon?: number
) => { maxDiff: number; analyticGrad: Float64Array; numericalGrad: Float64Array; passed: boolean };

export const checkConvexity = (convexCore as any).checkConvexity as (
  dataset: DatasetItem[],
  options?: FitOptions,
  numRestarts?: number
) => { maxSpread: number; passed: boolean; solutions: Float64Array[] };

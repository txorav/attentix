/**
 * Attentix High-Performance CV & Tensor Math Primitives
 * Optimized for Float32Array execution with separable convolutions and pure mathematical color-space transformations.
 */

/**
 * Converts sRGB [0..255] to Linear RGB [0..1]
 */
export function sRGBToLinear(c: number): number {
  const norm = c / 255.0;
  return norm <= 0.04045 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4);
}

/**
 * Converts linear RGB to CIE XYZ (D65 illuminant, 2-degree observer)
 */
export function linearRGBToXYZ(r: number, g: number, b: number): [number, number, number] {
  const x = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
  const y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b;
  const z = 0.0193339 * r + 0.1191920 * g + 0.9503041 * b;
  return [x, y, z];
}

/**
 * Converts CIE XYZ to CIE L*a*b* (D65 standard reference)
 */
const XN = 0.95047;
const YN = 1.0;
const ZN = 1.08883;

function fLab(t: number): number {
  const delta = 6 / 29;
  return t > Math.pow(delta, 3) ? Math.cbrt(t) : t / (3 * delta * delta) + 4 / 29;
}

export function xyzToLab(x: number, y: number, z: number): [number, number, number] {
  const fx = fLab(x / XN);
  const fy = fLab(y / YN);
  const fz = fLab(z / ZN);

  const L = Math.max(0, 116 * fy - 16);
  const a = 500 * (fx - fy);
  const b = 200 * (fy - fz);
  return [L, a, b];
}

/**
 * Converts RGB ImageData into CIE L*a*b* Float32Array channels: L, a, b
 */
export function convertRGBToLabBuffers(
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): { L: Float32Array; a: Float32Array; b: Float32Array } {
  const total = width * height;
  const L = new Float32Array(total);
  const a = new Float32Array(total);
  const b = new Float32Array(total);

  for (let i = 0; i < total; i++) {
    const rLin = sRGBToLinear(rgba[i * 4]);
    const gLin = sRGBToLinear(rgba[i * 4 + 1]);
    const bLin = sRGBToLinear(rgba[i * 4 + 2]);

    const [x, y, z] = linearRGBToXYZ(rLin, gLin, bLin);
    const [lum, aCh, bCh] = xyzToLab(x, y, z);

    L[i] = lum;
    a[i] = aCh;
    b[i] = bCh;
  }

  return { L, a, b };
}

/**
 * Generates a 1D Normalized Gaussian Kernel for given standard deviation sigma
 */
export function createGaussianKernel1D(sigma: number): Float32Array {
  const radius = Math.max(1, Math.ceil(sigma * 2.5));
  const size = radius * 2 + 1;
  const kernel = new Float32Array(size);
  const twoSigmaSq = 2 * sigma * sigma;
  let sum = 0;

  for (let i = 0; i < size; i++) {
    const x = i - radius;
    const val = Math.exp(-(x * x) / twoSigmaSq);
    kernel[i] = val;
    sum += val;
  }

  for (let i = 0; i < size; i++) {
    kernel[i] /= sum;
  }

  return kernel;
}

/**
 * Fast Separable 1D Gaussian Convolution on Float32Array
 * Operates in O(W * H * radius) time with clamped edge boundary handling.
 */
export function gaussianBlur2D(
  input: Float32Array,
  width: number,
  height: number,
  sigma: number
): Float32Array {
  if (sigma <= 0.1) {
    return new Float32Array(input);
  }

  const kernel = createGaussianKernel1D(sigma);
  const radius = Math.floor(kernel.length / 2);
  const temp = new Float32Array(width * height);
  const output = new Float32Array(width * height);

  // Horizontal pass
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      let acc = 0;
      for (let k = -radius; k <= radius; k++) {
        const nx = Math.min(Math.max(x + k, 0), width - 1);
        acc += input[rowOffset + nx] * kernel[k + radius];
      }
      temp[rowOffset + x] = acc;
    }
  }

  // Vertical pass
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let acc = 0;
      for (let k = -radius; k <= radius; k++) {
        const ny = Math.min(Math.max(y + k, 0), height - 1);
        acc += temp[ny * width + x] * kernel[k + radius];
      }
      output[y * width + x] = acc;
    }
  }

  return output;
}

/**
 * Difference of Gaussians (DoG) for center-surround receptive field simulation:
 * |G(sigma_c) * I - G(sigma_s) * I|
 */
export function differenceOfGaussians(
  input: Float32Array,
  width: number,
  height: number,
  sigmaCenter: number,
  sigmaSurround: number
): Float32Array {
  const center = gaussianBlur2D(input, width, height, sigmaCenter);
  const surround = gaussianBlur2D(input, width, height, sigmaSurround);
  const output = new Float32Array(width * height);

  for (let i = 0; i < output.length; i++) {
    output[i] = Math.abs(center[i] - surround[i]);
  }

  return output;
}

/**
 * Computes 2D Sobel Gradients (Gx, Gy) and Gradient Magnitude sqrt(Gx^2 + Gy^2)
 */
export function computeSobelGradients(
  luminance: Float32Array,
  width: number,
  height: number
): { magnitude: Float32Array; gx: Float32Array; gy: Float32Array } {
  const total = width * height;
  const magnitude = new Float32Array(total);
  const gx = new Float32Array(total);
  const gy = new Float32Array(total);

  for (let y = 1; y < height - 1; y++) {
    const yAbove = (y - 1) * width;
    const yCenter = y * width;
    const yBelow = (y + 1) * width;

    for (let x = 1; x < width - 1; x++) {
      const idx = yCenter + x;

      // 3x3 Neighborhood
      const p00 = luminance[yAbove + (x - 1)];
      const p01 = luminance[yAbove + x];
      const p02 = luminance[yAbove + (x + 1)];

      const p10 = luminance[yCenter + (x - 1)];
      const p12 = luminance[yCenter + (x + 1)];

      const p20 = luminance[yBelow + (x - 1)];
      const p21 = luminance[yBelow + x];
      const p22 = luminance[yBelow + (x + 1)];

      const gradX = (p02 + 2 * p12 + p22) - (p00 + 2 * p10 + p20);
      const gradY = (p20 + 2 * p21 + p22) - (p00 + 2 * p01 + p02);

      gx[idx] = gradX;
      gy[idx] = gradY;
      magnitude[idx] = Math.sqrt(gradX * gradX + gradY * gradY);
    }
  }

  return { magnitude, gx, gy };
}

/**
 * Skin-Tone / Facial Chromaticity heuristic in YCbCr space
 * High human sensitivity: 135 <= Cr <= 180 and 85 <= Cb <= 135
 */
export function computeSkinChromaTensor(
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): Float32Array {
  const total = width * height;
  const tensor = new Float32Array(total);

  for (let i = 0; i < total; i++) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];

    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

    if (cr >= 135 && cr <= 180 && cb >= 85 && cb <= 135) {
      // Gaussian falloff from center of skin chromaticity (Cr=155, Cb=110)
      const distSq = (cr - 155) * (cr - 155) + (cb - 110) * (cb - 110);
      tensor[i] = Math.exp(-distSq / 400);
    }
  }

  return tensor;
}

/**
 * Normalizes a Float32Array in-place to range [0, 1]
 */
export function normalizeMinMaxInPlace(tensor: Float32Array): void {
  let min = Infinity;
  let max = -Infinity;

  for (let i = 0; i < tensor.length; i++) {
    const v = tensor[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }

  const range = max - min;
  if (range <= 1e-7) {
    tensor.fill(0);
    return;
  }

  for (let i = 0; i < tensor.length; i++) {
    tensor[i] = (tensor[i] - min) / range;
  }
}

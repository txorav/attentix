import { ColorLUT, RenderMode, ColorBlindnessMode, QuantileThresholds } from './types';

// Vertex shader for full-screen quad
const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;

void main() {
    v_texCoord = a_texCoord;
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// Fragment shader with Thermal, Peek, Data-driven Isolines, Split-Screen Compare Curtain, and Color Vision Deficiency
const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_texCoord;
uniform sampler2D u_originalImage;
uniform sampler2D u_saliencyMap; // Normalized [0.0, 1.0] float texture
uniform sampler2D u_colorLUT;    // 256x1 1D Color Ramp texture
uniform int u_renderMode;        // 0 = Heatmap, 1 = Peek/Fog Map, 2 = Isolines, 3 = Original
uniform float u_opacity;         // Default 0.65
uniform float u_threshold;       // Cutoff for low saliency noise (e.g., 0.12)
uniform float u_splitPosition;   // 0.0 = full heatmap, 1.0 = full original, 0.5 = 50/50 split
uniform int u_splitActive;       // 1 if split curtain comparison is active
uniform int u_colorBlindness;    // 0 = None, 1 = Deuteranopia, 2 = Protanopia, 3 = Tritanopia
uniform vec3 u_isoThresholds;    // Normalized 50th, 75th, 90th percentile thresholds

out vec4 outColor;

// Color Vision Deficiency (LMS Brettel Simulation Matrices)
vec3 applyColorBlindness(vec3 rgb, int mode) {
    if (mode == 1) {
        // Deuteranopia (Green-blind)
        mat3 m = mat3(
            0.625, 0.375, 0.0,
            0.70,  0.30,  0.0,
            0.0,   0.30,  0.70
        );
        return m * rgb;
    } else if (mode == 2) {
        // Protanopia (Red-blind)
        mat3 m = mat3(
            0.567, 0.433, 0.0,
            0.558, 0.442, 0.0,
            0.0,   0.242, 0.758
        );
        return m * rgb;
    } else if (mode == 3) {
        // Tritanopia (Blue-blind)
        mat3 m = mat3(
            0.95, 0.05, 0.0,
            0.0,  0.433, 0.567,
            0.0,  0.475, 0.525
        );
        return m * rgb;
    }
    return rgb;
}

void main() {
    vec4 baseImg = texture(u_originalImage, v_texCoord);
    float sal = texture(u_saliencyMap, v_texCoord).r;

    // Apply color blindness if enabled
    if (u_colorBlindness > 0) {
        baseImg.rgb = applyColorBlindness(baseImg.rgb, u_colorBlindness);
    }

    vec4 renderedColor;

    if (u_renderMode == 3) {
        renderedColor = baseImg;
    }
    else if (u_renderMode == 0) {
        // Mode 0: Smooth Thermal Heatmap
        float smoothAlpha = smoothstep(u_threshold, u_threshold + 0.16, sal) * u_opacity;
        vec4 heatColor = texture(u_colorLUT, vec2(sal, 0.5));
        renderedColor = mix(baseImg, vec4(heatColor.rgb, 1.0), smoothAlpha);
    } 
    else if (u_renderMode == 1) {
        // Mode 1: Spotlight Peek (85% Darkened Fog of War)
        float spotlight = smoothstep(0.20, 0.62, sal);
        vec3 dimmed = baseImg.rgb * 0.15;
        renderedColor = vec4(mix(dimmed, baseImg.rgb, spotlight), 1.0);
    }
    else if (u_renderMode == 2) {
        // Mode 2: Topographic Attention Isolines mapped to empirical quantiles
        float line = 0.0;
        if (abs(sal - u_isoThresholds.x) < 0.012 ||
            abs(sal - u_isoThresholds.y) < 0.012 ||
            abs(sal - u_isoThresholds.z) < 0.012) {
            line = 1.0;
        }
        vec4 heatColor = texture(u_colorLUT, vec2(sal, 0.5));
        vec3 blended = mix(baseImg.rgb, heatColor.rgb, sal * 0.55);
        renderedColor = vec4(mix(blended, vec3(1.0, 1.0, 1.0), line), 1.0);
    }

    // Split curtain compare logic
    if (u_splitActive == 1) {
        float dividerWidth = 0.002;
        if (abs(v_texCoord.x - u_splitPosition) < dividerWidth) {
            outColor = vec4(1.0, 1.0, 1.0, 1.0); // White vertical splitter line
        } else if (v_texCoord.x < u_splitPosition) {
            outColor = baseImg; // Left side is original asset
        } else {
            outColor = renderedColor; // Right side is heat/peek/isoline visualization
        }
    } else {
        outColor = renderedColor;
    }
}
`;

export class WebGL2Visualizer {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private vbo: WebGLBuffer | null = null;
  private vs: WebGLShader | null = null;
  private fs: WebGLShader | null = null;

  // Textures
  private imgTexture: WebGLTexture | null = null;
  private salTexture: WebGLTexture | null = null;
  private lutTextures: Map<ColorLUT, WebGLTexture> = new Map();

  // Uniform locations
  private uOriginalImageLoc: WebGLUniformLocation | null = null;
  private uSaliencyMapLoc: WebGLUniformLocation | null = null;
  private uColorLUTLoc: WebGLUniformLocation | null = null;
  private uRenderModeLoc: WebGLUniformLocation | null = null;
  private uOpacityLoc: WebGLUniformLocation | null = null;
  private uThresholdLoc: WebGLUniformLocation | null = null;
  private uSplitPositionLoc: WebGLUniformLocation | null = null;
  private uSplitActiveLoc: WebGLUniformLocation | null = null;
  private uColorBlindnessLoc: WebGLUniformLocation | null = null;
  private uIsoThresholdsLoc: WebGLUniformLocation | null = null;

  // Normalized quantile thresholds for isolines
  private isoNormThresholds: [number, number, number] = [0.50, 0.75, 0.90];

  // Cached asset references for 2D Canvas fallback
  private sourceImage: HTMLImageElement | HTMLCanvasElement | null = null;
  private cachedGrid: Float32Array | null = null;
  private gridW = 0;
  private gridH = 0;
  private fallbackHeatmapCanvas: HTMLCanvasElement | null = null;

  public isWebGLSupported = false;
  public onContextChange?: (webglActive: boolean) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.initGL();

    // Context lost/restored handling
    this.handleContextLost = this.handleContextLost.bind(this);
    this.handleContextRestored = this.handleContextRestored.bind(this);
    this.canvas.addEventListener('webglcontextlost', this.handleContextLost, false);
    this.canvas.addEventListener('webglcontextrestored', this.handleContextRestored, false);
  }

  private handleContextLost(event: Event) {
    event.preventDefault();
    this.isWebGLSupported = false;
    this.onContextChange?.(false);
  }

  private handleContextRestored() {
    this.initGL();
    if (this.sourceImage) this.uploadImage(this.sourceImage);
    if (this.cachedGrid) this.uploadSaliencyGrid(this.cachedGrid, this.gridW, this.gridH);
    this.onContextChange?.(this.isWebGLSupported);
  }

  private initGL() {
    try {
      this.gl = this.canvas.getContext('webgl2', {
        premultipliedAlpha: false,
        preserveDrawingBuffer: true,
        antialias: true,
      });
    } catch {
      this.gl = null;
    }

    if (!this.gl) {
      this.isWebGLSupported = false;
      this.ctx2d = this.canvas.getContext('2d');
      return;
    }

    const gl = this.gl;
    this.vs = this.compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    this.fs = this.compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!this.vs || !this.fs) {
      this.isWebGLSupported = false;
      this.ctx2d = this.canvas.getContext('2d');
      return;
    }

    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, this.vs);
    gl.attachShader(prog, this.fs);
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('Shader link error, switching to Canvas 2D fallback:', gl.getProgramInfoLog(prog));
      this.isWebGLSupported = false;
      this.ctx2d = this.canvas.getContext('2d');
      return;
    }
    this.program = prog;

    this.uOriginalImageLoc = gl.getUniformLocation(prog, 'u_originalImage');
    this.uSaliencyMapLoc = gl.getUniformLocation(prog, 'u_saliencyMap');
    this.uColorLUTLoc = gl.getUniformLocation(prog, 'u_colorLUT');
    this.uRenderModeLoc = gl.getUniformLocation(prog, 'u_renderMode');
    this.uOpacityLoc = gl.getUniformLocation(prog, 'u_opacity');
    this.uThresholdLoc = gl.getUniformLocation(prog, 'u_threshold');
    this.uSplitPositionLoc = gl.getUniformLocation(prog, 'u_splitPosition');
    this.uSplitActiveLoc = gl.getUniformLocation(prog, 'u_splitActive');
    this.uColorBlindnessLoc = gl.getUniformLocation(prog, 'u_colorBlindness');
    this.uIsoThresholdsLoc = gl.getUniformLocation(prog, 'u_isoThresholds');

    const quadData = new Float32Array([
      -1, -1, 0, 1,
       1, -1, 1, 1,
      -1,  1, 0, 0,
      -1,  1, 0, 0,
       1, -1, 1, 1,
       1,  1, 1, 0,
    ]);

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, quadData, gl.STATIC_DRAW);

    const aPosLoc = gl.getAttribLocation(prog, 'a_position');
    const aTexLoc = gl.getAttribLocation(prog, 'a_texCoord');

    gl.enableVertexAttribArray(aPosLoc);
    gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 4 * 4, 0);

    gl.enableVertexAttribArray(aTexLoc);
    gl.vertexAttribPointer(aTexLoc, 2, gl.FLOAT, false, 4 * 4, 2 * 4);

    gl.bindVertexArray(null);

    this.initColorLUTs();
    this.isWebGLSupported = true;
  }

  private compileShader(type: number, src: string): WebGLShader | null {
    if (!this.gl) return null;
    const shader = this.gl.createShader(type);
    if (!shader) return null;
    this.gl.shaderSource(shader, src);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.warn('Shader compile error:', this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  private initColorLUTs() {
    if (!this.gl) return;
    const luts: ColorLUT[] = ['jet', 'inferno', 'turbo', 'viridis'];
    for (const lut of luts) {
      const tex = this.createLUTTexture(lut);
      if (tex) this.lutTextures.set(lut, tex);
    }
  }

  private createLUTTexture(lut: ColorLUT): WebGLTexture | null {
    if (!this.gl) return null;
    const gl = this.gl;
    const width = 256;
    const data = new Uint8Array(width * 4);

    for (let i = 0; i < width; i++) {
      const t = i / 255.0;
      const [r, g, b] = sampleLUT(lut, t);
      data[i * 4] = r;
      data[i * 4 + 1] = g;
      data[i * 4 + 2] = b;
      data[i * 4 + 3] = 255;
    }

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.bindTexture(gl.TEXTURE_2D, null);

    return tex;
  }

  public uploadImage(source: HTMLImageElement | HTMLCanvasElement) {
    this.sourceImage = source;
    if (!this.isWebGLSupported || !this.gl) return;

    const gl = this.gl;
    if (this.imgTexture) gl.deleteTexture(this.imgTexture);

    this.imgTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.imgTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  public uploadSaliencyGrid(
    grid: Float32Array,
    width: number,
    height: number,
    quantiles?: QuantileThresholds
  ) {
    this.cachedGrid = grid;
    this.gridW = width;
    this.gridH = height;

    let max = 0;
    for (let i = 0; i < grid.length; i++) {
      if (grid[i] > max) max = grid[i];
    }
    const invMax = max > 0.000001 ? 1.0 / max : 1.0;

    // Map empirical quantiles to normalized [0, 1] for isoline shader
    if (quantiles) {
      this.isoNormThresholds = [
        Math.min(1.0, quantiles.p50 * invMax),
        Math.min(1.0, quantiles.p75 * invMax),
        Math.min(1.0, quantiles.p90 * invMax),
      ];
    }

    if (!this.isWebGLSupported || !this.gl) {
      this.fallbackHeatmapCanvas = null; // Invalidate 2D cached raster
      return;
    }

    const gl = this.gl;
    if (this.salTexture) gl.deleteTexture(this.salTexture);

    const uintData = new Uint8Array(width * height);
    for (let i = 0; i < grid.length; i++) {
      uintData[i] = Math.min(255, Math.floor(grid[i] * invMax * 255));
    }

    this.salTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.salTexture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, width, height, 0, gl.RED, gl.UNSIGNED_BYTE, uintData);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  public render(
    renderMode: RenderMode,
    colorLUT: ColorLUT,
    opacity: number,
    threshold: number,
    splitActive = false,
    splitPosition = 0.5,
    colorBlindness: ColorBlindnessMode = 'none'
  ) {
    if (!this.isWebGLSupported || !this.gl || !this.program || !this.imgTexture || !this.salTexture) {
      this.render2DFallback(renderMode, colorLUT, opacity, threshold, splitActive, splitPosition, colorBlindness);
      return;
    }

    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.imgTexture);
    gl.uniform1i(this.uOriginalImageLoc, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.salTexture);
    gl.uniform1i(this.uSaliencyMapLoc, 1);

    const lutTex = this.lutTextures.get(colorLUT) || this.lutTextures.get('jet');
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, lutTex || null);
    gl.uniform1i(this.uColorLUTLoc, 2);

    let modeCode = 0;
    if (renderMode === 'original') modeCode = 3;
    else if (renderMode === 'heatmap') modeCode = 0;
    else if (renderMode === 'peek') modeCode = 1;
    else if (renderMode === 'isolines') modeCode = 2;

    gl.uniform1i(this.uRenderModeLoc, modeCode);
    gl.uniform1f(this.uOpacityLoc, opacity);
    gl.uniform1f(this.uThresholdLoc, threshold);

    gl.uniform1i(this.uSplitActiveLoc, splitActive ? 1 : 0);
    gl.uniform1f(this.uSplitPositionLoc, splitPosition);

    if (this.uIsoThresholdsLoc) {
      gl.uniform3f(
        this.uIsoThresholdsLoc,
        this.isoNormThresholds[0],
        this.isoNormThresholds[1],
        this.isoNormThresholds[2]
      );
    }

    let cbCode = 0;
    if (colorBlindness === 'deuteranopia') cbCode = 1;
    else if (colorBlindness === 'protanopia') cbCode = 2;
    else if (colorBlindness === 'tritanopia') cbCode = 3;
    gl.uniform1i(this.uColorBlindnessLoc, cbCode);

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
  }

  /**
   * Complete 2D Canvas Fallback Renderer for environments without WebGL2 support.
   */
  private render2DFallback(
    renderMode: RenderMode,
    colorLUT: ColorLUT,
    opacity: number,
    threshold: number,
    splitActive: boolean,
    splitPosition: number,
    colorBlindness: ColorBlindnessMode
  ) {
    if (!this.ctx2d && this.canvas) {
      this.ctx2d = this.canvas.getContext('2d');
    }
    const ctx = this.ctx2d;
    if (!ctx || !this.sourceImage) return;

    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    // 1. Draw base image
    ctx.drawImage(this.sourceImage, 0, 0, w, h);

    // 2. If original mode and no CVD, we're done
    if (renderMode === 'original' && colorBlindness === 'none' && !splitActive) {
      return;
    }

    // 3. Render heatmap overlay if grid is available
    if (this.cachedGrid && this.gridW > 0 && this.gridH > 0 && renderMode !== 'original') {
      if (!this.fallbackHeatmapCanvas) {
        this.fallbackHeatmapCanvas = document.createElement('canvas');
        this.fallbackHeatmapCanvas.width = this.gridW;
        this.fallbackHeatmapCanvas.height = this.gridH;
      }
      const heatCtx = this.fallbackHeatmapCanvas.getContext('2d');
      if (heatCtx) {
        let max = 0;
        for (let i = 0; i < this.cachedGrid.length; i++) {
          if (this.cachedGrid[i] > max) max = this.cachedGrid[i];
        }
        const invMax = max > 1e-6 ? 1.0 / max : 1.0;

        const imgData = heatCtx.createImageData(this.gridW, this.gridH);
        const data = imgData.data;

        for (let i = 0; i < this.cachedGrid.length; i++) {
          const normSal = this.cachedGrid[i] * invMax;
          const [r, g, b] = sampleLUT(colorLUT, normSal);
          const px = i * 4;
          data[px] = r;
          data[px + 1] = g;
          data[px + 2] = b;
          data[px + 3] = normSal < threshold ? 0 : Math.floor(Math.min(1.0, normSal * 1.5) * 255);
        }
        heatCtx.putImageData(imgData, 0, 0);

        ctx.save();
        if (splitActive) {
          ctx.beginPath();
          ctx.rect(w * splitPosition, 0, w * (1 - splitPosition), h);
          ctx.clip();
        }

        if (renderMode === 'heatmap') {
          ctx.globalAlpha = opacity;
          ctx.drawImage(this.fallbackHeatmapCanvas, 0, 0, w, h);
        } else if (renderMode === 'peek') {
          // Fog of war
          ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
          ctx.fillRect(0, 0, w, h);
          ctx.globalCompositeOperation = 'destination-out';
          ctx.drawImage(this.fallbackHeatmapCanvas, 0, 0, w, h);
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.restore();

        if (splitActive) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(w * splitPosition - 1, 0, 2, h);
        }
      }
    }

    // 4. Color blindness simulation in 2D
    if (colorBlindness !== 'none') {
      try {
        const frame = ctx.getImageData(0, 0, w, h);
        const d = frame.data;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i] / 255;
          const g = d[i + 1] / 255;
          const b = d[i + 2] / 255;
          let nr = r, ng = g, nb = b;
          if (colorBlindness === 'deuteranopia') {
            nr = 0.625 * r + 0.375 * g;
            ng = 0.70 * r + 0.30 * g;
            nb = 0.30 * g + 0.70 * b;
          } else if (colorBlindness === 'protanopia') {
            nr = 0.567 * r + 0.433 * g;
            ng = 0.558 * r + 0.442 * g;
            nb = 0.242 * g + 0.758 * b;
          } else if (colorBlindness === 'tritanopia') {
            nr = 0.95 * r + 0.05 * g;
            ng = 0.433 * g + 0.567 * b;
            nb = 0.475 * g + 0.525 * b;
          }
          d[i] = Math.min(255, Math.floor(nr * 255));
          d[i + 1] = Math.min(255, Math.floor(ng * 255));
          d[i + 2] = Math.min(255, Math.floor(nb * 255));
        }
        ctx.putImageData(frame, 0, 0);
      } catch {
        // Tainted canvas protection
      }
    }
  }

  public destroy() {
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);

    if (!this.gl) return;
    const gl = this.gl;
    if (this.imgTexture) gl.deleteTexture(this.imgTexture);
    if (this.salTexture) gl.deleteTexture(this.salTexture);
    this.lutTextures.forEach((tex) => gl.deleteTexture(tex));
    this.lutTextures.clear();

    if (this.vbo) gl.deleteBuffer(this.vbo);
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.vs) gl.deleteShader(this.vs);
    if (this.fs) gl.deleteShader(this.fs);
    if (this.program) gl.deleteProgram(this.program);

    this.gl = null;
    this.ctx2d = null;
  }
}

export function sampleLUT(lut: ColorLUT, t: number): [number, number, number] {
  t = Math.max(0, Math.min(1, t));

  if (lut === 'inferno') {
    const r = Math.min(255, Math.floor(Math.pow(t, 0.75) * 255));
    const g = Math.min(255, Math.floor(Math.pow(t, 1.8) * 250));
    const b = Math.min(255, Math.floor((1 - t) * Math.sin(t * Math.PI) * 160 + t * 40));
    return [r, g, b];
  } else if (lut === 'turbo') {
    const r = Math.min(255, Math.floor(34.61 + t * (1172.33 + t * (-10793.56 + t * (33300.12 + t * (-38394.49 + t * 14825.05))))));
    const g = Math.min(255, Math.floor(23.31 + t * (557.33 + t * (1225.33 + t * (-3574.96 + t * (1073.77 + t * 707.56))))));
    const b = Math.min(255, Math.floor(27.2 + t * (3211.1 - t * (15327.97 - t * (27814.0 - t * (22569.18 - t * 6838.66))))));
    return [Math.max(0, r), Math.max(0, g), Math.max(0, b)];
  } else if (lut === 'viridis') {
    const r = Math.min(255, Math.floor(68 + t * (30 + t * (150 + t * 7))));
    const g = Math.min(255, Math.floor(1 + t * (180 + t * 70)));
    const b = Math.min(255, Math.floor(84 + (1 - t) * 120 + t * 20));
    return [r, g, b];
  } else {
    let r = 0, g = 0, b = 0;
    if (t < 0.125) {
      r = 0; g = 0; b = 128 + Math.floor(t * 8 * 127);
    } else if (t < 0.375) {
      r = 0; g = Math.floor((t - 0.125) * 4 * 255); b = 255;
    } else if (t < 0.625) {
      r = Math.floor((t - 0.375) * 4 * 255); g = 255; b = Math.floor((1 - (t - 0.375) * 4) * 255);
    } else if (t < 0.875) {
      r = 255; g = Math.floor((1 - (t - 0.625) * 4) * 255); b = 0;
    } else {
      r = 255 - Math.floor((t - 0.875) * 8 * 127); g = 0; b = 0;
    }
    return [r, g, b];
  }
}

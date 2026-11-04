// src/engine/analysis-schema.ts
import { AnalysisResult, Element, Aoi, Warning, IndexWithTerms } from '../types/analysis';
import { SaliencyTensorResult } from '../types/studio';

export function toAnalysisResult(
  result: SaliencyTensorResult,
  options: {
    id?: string;
    capture?: "upload" | "first-screen" | "full-page" | "extension";
    background?: "white" | "dark" | "none";
  } = {}
): AnalysisResult {
  const id = options.id || `analysis-${Date.now()}`;
  const width = result.width;
  const height = result.height;
  const workWidth = result.image?.workW || width;
  const workHeight = result.image?.workH || height;
  const ppd = result.image?.ppd || Math.round(Math.max(width, height) * 0.025);
  const mode = result.mode || 'ui-web';
  const scriptDir = (result.scriptDirection?.toUpperCase() === 'RTL' ? 'RTL' : 'LTR') as "LTR" | "RTL" | "mixed";

  const elements: Element[] = (result.aoi || []).map((a, idx) => ({
    id: a.id || `elem-${idx + 1}`,
    bbox: [a.x, a.y, a.width, a.height] as [number, number, number, number],
    role: (a.dominant?.[0] === 'T' ? 'headline' : a.dominant?.[0] === 'FA' ? 'person' : a.dominant?.[0] === 'CL' ? 'cta' : 'unknown') as Element['role'],
    roleConfidence: 0.88,
    text: a.label || undefined,
  }));

  const aois: Aoi[] = (result.aoi || []).map((a, idx) => ({
    id: a.id || `aoi-${idx + 1}`,
    elementIds: [a.id || `elem-${idx + 1}`],
    bbox: [a.x, a.y, a.width, a.height] as [number, number, number, number],
    rank: a.rank || idx + 1,
    share: a.shareOfAttention ?? 0,
    shareInterval: (a as any).shareInterval || [
      Math.max(0, Number(((a.shareOfAttention ?? 0) - 2.5).toFixed(1))),
      Math.min(100, Number(((a.shareOfAttention ?? 0) + 2.5).toFixed(1))),
    ],
    peak: a.peak ?? 0,
    firstFixationProb: idx === 0 ? 0.65 : Number((0.35 / Math.max(1, (result.aoi?.length || 1) - 1)).toFixed(2)),
    drivers: (a.dominant || ['CL', 'P']).map((factor: string) => ({
      factor,
      contribution: factor === 'CL' ? 0.35 : 0.25,
    })),
  }));

  const scanPath = (result.scanpath || result.fixations || []).map((f) => ({
    order: f.order,
    x: f.x,
    y: f.y,
    confidence: (f.confidence === 'low' || f.isLowConfidence ? 'low' : 'high') as "high" | "low",
  }));

  const quantiles = result.quantiles || {
    p50: 0.12,
    p75: 0.34,
    p90: 0.65,
    p95: 0.82,
    p98: 0.92,
    p99: 0.98,
  };

  const channelValid: Record<string, boolean> = {
    I: true, C: true, O: true, M: false, SR: true, FT: true,
    U: true, P: true, SH: false, CL: true, T: true, FA: true,
    FG: Boolean(result.containerBox), S: true, L: Boolean(result.learnedMap),
    ...(result.channelValid || {}),
  };

  const warnings: Warning[] = (result.warnings || []).map((w) => ({
    code: w.includes('lowInformation') ? 'LOW_INFORMATION' : 'ENGINE_WARN',
    message: typeof w === 'string' ? w : JSON.stringify(w),
    severity: w.includes('lowInformation') ? 'info' : 'warn',
  }));

  const focus = result.metrics?.focusScore ?? 0.5;
  const top5pctMass = result.metrics?.top5pctMass ?? 0.35;
  const loadColor = {
    value: result.colorLoadScore ?? 30,
    terms: result.load?.color?.terms || { normEntropy: 0.3, distinctHuesNorm: 0.2, meanChromaVar: 0.4 },
    formula: "0.5·H_pal + 0.3·min(1, n_hues/H_ref) + 0.2·σ_C",
  };
  const loadShape = {
    value: result.shapeLoadScore ?? 35,
    terms: result.load?.shape?.terms || { edgeDensity: 0.25, orientEntropy: 0.4 },
    formula: "0.5·ρ_edge + 0.3·H_θ + 0.2·n_comp/n_ref",
  };
  const loadText = {
    value: result.textLoadScore ?? 25,
    terms: result.load?.text?.terms || { glyphAreaFraction: 0.15, meanTextEnergy: 0.2 },
    formula: "0.6·a_glyph + 0.25·n_lines/n_ref + 0.15·f_small",
  };
  const totalLoad = result.cognitiveLoadScore ?? 30;

  const clarityTerms = result.clarity?.terms || { focusScore: focus, primaryAoiShare: aois[0]?.share ? aois[0].share / 100 : 0 };
  const clarityIndex: IndexWithTerms = {
    value: result.clarityScore ?? 65,
    terms: clarityTerms,
    formula: "α(1−Load) + β·Focus + γ·P_{primary}",
  };

  return {
    id,
    status: 'done',
    versions: {
      engine: result.engineVersion || '2.0.0',
      model: result.modelVersion || 'attentix-v2-calibrated',
      configHash: result.configHash || 'v2-calibrated-config-hash',
      tier: (result.hardwareProfile?.tierName?.toLowerCase().includes('server') ? 'server' : 'browser') as "browser" | "server",
    },
    input: {
      width,
      height,
      workWidth,
      workHeight,
      ppd,
      mode,
      modeConfidence: 0.95,
      scriptDir,
      scriptDirConfidence: 0.99,
      capture: options.capture || 'upload',
      chromeDetected: false,
      background: options.background || 'dark',
    },
    quality: {
      lowInformation: Boolean(result.lowInformation),
      outOfDistribution: false,
      channelValid,
      warnings,
    },
    map: {
      densityUrl: `blob:attentix-density-${id}`,
      overlayPngUrl: `blob:attentix-overlay-${id}`,
      percentiles: {
        p50: quantiles.p50,
        p75: quantiles.p75,
        p90: quantiles.p90,
        p95: quantiles.p95,
        p98: quantiles.p98 ?? 0.95,
        p99: quantiles.p99 ?? 0.99,
      },
    },
    elements,
    aois,
    scanPath,
    indices: {
      focus,
      top5pctMass,
      load: {
        color: loadColor,
        shape: loadShape,
        text: loadText,
        total: totalLoad,
      },
      clarity: clarityIndex,
    },
    createdAt: new Date().toISOString(),
  };
}

export function validateAnalysisResult(res: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!res || typeof res !== 'object') {
    return { valid: false, errors: ['AnalysisResult must be a non-null object'] };
  }

  const check = (condition: boolean, msg: string) => {
    if (!condition) errors.push(msg);
  };

  check(typeof res.id === 'string' && res.id.length > 0, 'id must be non-empty string');
  check(['queued', 'rendering', 'analyzing', 'done', 'failed'].includes(res.status), `invalid status: ${res.status}`);

  // versions
  check(typeof res.versions === 'object', 'versions object required');
  if (res.versions) {
    check(typeof res.versions.engine === 'string', 'versions.engine string required');
    check(typeof res.versions.model === 'string', 'versions.model string required');
    check(typeof res.versions.configHash === 'string', 'versions.configHash string required');
    check(['browser', 'server'].includes(res.versions.tier), 'versions.tier must be browser or server');
  }

  // input
  check(typeof res.input === 'object', 'input object required');
  if (res.input) {
    check(typeof res.input.width === 'number' && res.input.width > 0, 'input.width must be positive number');
    check(typeof res.input.height === 'number' && res.input.height > 0, 'input.height must be positive number');
    check(typeof res.input.workWidth === 'number' && res.input.workWidth > 0, 'input.workWidth must be positive number');
    check(typeof res.input.workHeight === 'number' && res.input.workHeight > 0, 'input.workHeight must be positive number');
    check(typeof res.input.ppd === 'number', 'input.ppd number required');
    check(typeof res.input.mode === 'string', 'input.mode string required');
    check(['LTR', 'RTL', 'mixed'].includes(res.input.scriptDir), 'input.scriptDir must be LTR, RTL, or mixed');
    check(['upload', 'first-screen', 'full-page', 'extension'].includes(res.input.capture), 'input.capture valid string required');
    check(typeof res.input.chromeDetected === 'boolean', 'input.chromeDetected boolean required');
    check(['white', 'dark', 'none'].includes(res.input.background), 'input.background must be white, dark, or none');
  }

  // quality
  check(typeof res.quality === 'object', 'quality object required');
  if (res.quality) {
    check(typeof res.quality.lowInformation === 'boolean', 'quality.lowInformation boolean required');
    check(typeof res.quality.outOfDistribution === 'boolean', 'quality.outOfDistribution boolean required');
    check(typeof res.quality.channelValid === 'object', 'quality.channelValid object required');
    check(Array.isArray(res.quality.warnings), 'quality.warnings array required');
  }

  // map
  check(typeof res.map === 'object', 'map object required');
  if (res.map) {
    check(typeof res.map.densityUrl === 'string', 'map.densityUrl string required');
    check(typeof res.map.overlayPngUrl === 'string', 'map.overlayPngUrl string required');
    check(typeof res.map.percentiles === 'object', 'map.percentiles object required');
    if (res.map.percentiles) {
      check(typeof res.map.percentiles.p50 === 'number', 'percentiles.p50 number required');
      check(typeof res.map.percentiles.p75 === 'number', 'percentiles.p75 number required');
      check(typeof res.map.percentiles.p90 === 'number', 'percentiles.p90 number required');
      check(typeof res.map.percentiles.p95 === 'number', 'percentiles.p95 number required');
      check(typeof res.map.percentiles.p98 === 'number', 'percentiles.p98 number required');
      check(typeof res.map.percentiles.p99 === 'number', 'percentiles.p99 number required');
    }
  }

  // elements & aois
  check(Array.isArray(res.elements), 'elements must be an array');
  check(Array.isArray(res.aois), 'aois must be an array');

  // scanPath - no durations allowed!
  if (res.scanPath) {
    check(Array.isArray(res.scanPath), 'scanPath must be array');
    for (const pt of res.scanPath) {
      check(typeof pt.order === 'number', 'scanPath.order number required');
      check(typeof pt.x === 'number', 'scanPath.x number required');
      check(typeof pt.y === 'number', 'scanPath.y number required');
      check(['high', 'low'].includes(pt.confidence), 'scanPath.confidence must be high or low');
      check(!('dwellMs' in pt) && !('ttffMs' in pt) && !('duration' in pt), 'scanPath MUST NOT produce duration (ms) labels');
    }
  }

  // indices
  check(typeof res.indices === 'object', 'indices object required');
  if (res.indices) {
    check(typeof res.indices.focus === 'number', 'indices.focus number required');
    check(typeof res.indices.top5pctMass === 'number', 'indices.top5pctMass number required');
    check(typeof res.indices.load === 'object', 'indices.load object required');
    check(typeof res.indices.clarity === 'object', 'indices.clarity object required');
  }

  check(typeof res.createdAt === 'string', 'createdAt string required');

  return { valid: errors.length === 0, errors };
}

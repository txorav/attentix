export interface FixationPoint {
  order: number;
  x: number;
  y: number;
  dwellMs: number;
  ttffMs: number;
  radius: number;
  intensity: number;
  confidence?: 'high' | 'medium' | 'low' | string;
  isLowConfidence?: boolean;
}

export interface AOIRegion {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  shareOfAttention: number;
  noticeability: number;
  ttffMs: number | null;
  semanticTag?: string;
  isAutoDetected?: boolean;
  dominant?: string[];
}

export type DomainPreset = 'ui_ux' | 'desktop_ui' | 'desktop-ui' | 'advertising' | 'editorial_book' | 'fine_art';

export type ModelTier =
  | 'low'
  | 'fast'
  | 'medium'
  | 'high'
  | 'max'
  | 'ultra'
  | 'hybrid'
  | 'fast_browser'
  | 'hand_crafted'
  | 'deep_ensemble';

export type ScriptDirection = 'ltr' | 'rtl';

export type ViewingDuration = '1s' | '3s' | '5s' | '7s' | '15s' | '30s' | '60s' | '1m';

export type ViewportMode = 'desktop' | 'tablet' | 'mobile';

export interface DOMSemanticElement {
  tag: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  contrastRatio: number;
  isCTA: boolean;
  role?: string;
}

export interface WebsiteCapturePayload {
  imageBase64: string;
  width: number;
  height: number;
  url: string;
  viewport: ViewportMode;
  domElements: DOMSemanticElement[];
}

export interface SavedAnalysisSnapshot {
  id: string;
  url: string;
  pageTitle: string;
  timestamp: number;
  viewport: ViewportMode;
  clarityScore: number;
  cognitiveLoadScore: number;
  colorLoadScore?: number;
  shapeLoadScore?: number;
  textLoadScore?: number;
  aoiCount: number;
  fixationsCount: number;
  imageDataUrl: string;
  analysisResult: SaliencyTensorResult;
  aois: AOIRegion[];
  aiInsights: string[];
  notes?: string;
}

export interface SaliencyTensorResult {
  width: number;
  height: number;
  saliencyMap: Float32Array;
  saliencyRaw?: Float32Array;
  contrastMap?: Float32Array;
  saturationMap?: Float32Array;
  uniquenessMap?: Float32Array;
  clusterMap?: Float32Array;
  colorMap: Float32Array;
  intensityMap: Float32Array;
  structureMap: Float32Array;
  clarityScore: number;
  cognitiveLoadScore: number;
  colorLoadScore?: number;
  shapeLoadScore?: number;
  textLoadScore?: number;
  colorLoadMap?: Float32Array;
  shapeMap?: Float32Array;
  textMap?: Float32Array;
  cognitiveLoadMap?: Float32Array;
  learnedMap?: Float32Array | null;
  facesMap?: Float32Array;
  entropyGrid?: Float32Array;
  fixations: FixationPoint[];
  quantiles?: {
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p98?: number;
    p99: number;
    max?: number;
  };
  computeTimeMs?: number;
  engineVersion?: string;
  modelVersion?: string;
  tier?: string;
  versions?: { engine: string; model: string; configHash: string; tier: string };
  containerBox?: any;
  configHash?: string;
  mode?: string;
  modelTier?: ModelTier;
  scriptDirection?: ScriptDirection;
  viewingDuration?: ViewingDuration;
  image?: { w: number; h: number; workW: number; workH: number; ppd: number };
  channelValid?: Record<string, boolean>;
  contributions?: Record<string, Float32Array>;
  metrics?: { focusScore: number; entropy: number; top5pctMass: number };
  load?: { color: any; shape: any; text: any; total: number };
  clarity?: { value: number; terms: any };
  aoi?: any[];
  scanpath?: any[];
  warnings?: string[];
  lowInformation?: boolean;
  hardwareProfile?: {
    tierName: string;
    threads: number;
    passes: number;
    provider: string;
    vramMb: number;
    workResolution: string;
    description: string;
    latencyMs?: number;
  };
}

export type LayerInspectorId =
  | 'none'
  | 'learned'
  | 'contrast'
  | 'saturation'
  | 'rarity'
  | 'cluster'
  | 'text'
  | 'shape'
  | 'faces';

export type VisualMode =
  | 'heatmap'
  | 'fog_of_war'
  | 'split_ab'
  | 'original'
  // Preserved for layer inspector mapping
  | 'cognitive_load'
  | 'text_density'
  | 'shape_contour'
  | 'cluster_mass'
  | 'scanpath'
  | 'clutter'
  | 'saturation'
  | 'contrast'
  | 'uniqueness'
  | 'faces';

export type ColormapTheme = 'thermal' | 'turbo' | 'inferno' | 'viridis' | 'magma';

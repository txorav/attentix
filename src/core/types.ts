export type DomainProfileId =
  | 'ui_ux_web'
  | 'performance_ads'
  | 'book_covers'
  | 'fine_art'
  | 'retail_packaging';

export interface DomainProfile {
  id: DomainProfileId;
  name: string;
  tagline: string;
  description: string;
  centerBiasPrior: number; // Low (0.20) to High (0.75)
  topLeftFBias: number;    // None (0.00) to High (0.75)
  wText: number;           // Text hierarchy weight
  wFace: number;           // Face/Gaze weight
  wUI: number;             // UI Affordance weight
  wVis: number;            // Bottom-up visual saliency weight
  specialFeature: string;
}

export type ExecutionMode = 'local_client_neuromorphic' | 'local_webgl_accelerated';

export type RenderMode = 'heatmap' | 'peek' | 'isolines' | 'original';

export type ColorLUT = 'jet' | 'inferno' | 'turbo' | 'viridis';

export type ColorBlindnessMode = 'none' | 'deuteranopia' | 'protanopia' | 'tritanopia';

export type ActiveTool =
  | 'inspect'
  | 'pan'
  | 'heatmap'
  | 'peek'
  | 'isolines'
  | 'scanpath'
  | 'draw_aoi'
  | 'compare_split'
  | 'color_blindness';

export type SemanticTag =
  | 'HEADLINE_TEXT'
  | 'PRIMARY_CTA_BUTTON'
  | 'HUMAN_FACE_GAZE'
  | 'BRAND_LOGO'
  | 'HERO_PRODUCT'
  | 'NAV_ELEMENT'
  | 'VISUAL_CONTRAST_PEAK';

export interface ScanpathFixation {
  order: number;
  x_norm: number;
  y_norm: number;
  dwell_time_ms: number;
  ttff_ms: number;
  semantic_tag: SemanticTag;
}

export interface AOIItem {
  id: string;
  label: string;
  bbox_norm: [number, number, number, number]; // [x1, y1, x2, y2] in [0, 1]
  attention_share_pct: number;
  attention_lift_ratio: number;
  verdict: 'HIGH_VISIBILITY' | 'MODERATE_VISIBILITY' | 'LOW_VISIBILITY_BANNER_BLIND';
  color?: string;
  isPrimary?: boolean;
  isLocked?: boolean;
}

export interface AssetMetadata {
  filename: string;
  fileSizeFormatted: string;
  fileSizeBytes: number;
  fileType: string;
  width: number;
  height: number;
  aspectRatio: string;
  megapixels: number;
  mediumCategory: DomainProfileId;
  targetPlatform: 'desktop_web' | 'mobile_app' | 'social_feed' | 'print_ooh' | 'packaging';
  viewingDistance: 'near_30cm' | 'desktop_60cm' | 'ambient_3m';
  rmsContrast: number;
  meanLuminance: number;
  timestamp: string;
}

export interface QuantileThresholds {
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  max: number;
}

export interface AttentionalDiagnostics {
  peak_concentration_ratio: number; // Ratio of attention contained in top 10% highest density pixels
  central_fixation_bias: number;    // % of attention falling in center 50% elliptical radius
  visual_hierarchy_gradient: number;// Ratio of primary focal peak to 3rd highest peak
  shannon_entropy_normalized: number;
  edge_chromatic_clutter: number;
  literature_reference: {
    mit_nss_target: string;
    mit_cc_target: string;
    mit_kldiv_target: string;
    benchmark_note: string;
  };
}

export interface NeuromarketingMetrics {
  clarity_score: number;
  cognitive_load: number;
  cognitive_load_status: 'OPTIMAL' | 'MODERATE' | 'HIGH_CLUTTER';
  attention_dispersion_entropy: number;
  edge_chromatic_clutter: number;
  focal_peaks_count: number;
  diagnostics: AttentionalDiagnostics;
}

export interface AnalysisResult {
  schema_version: 'attentix-v1.0';
  engine_version: string;
  job_id: string;
  execution_mode: ExecutionMode;
  inference_time_ms: number;
  medium_profile: DomainProfileId;
  dimensions: { width: number; height: number };
  exposure_duration: '3s' | '7s';
  metadata: AssetMetadata;
  metrics: NeuromarketingMetrics;
  scanpath: ScanpathFixation[];
  auto_detected_aois: AOIItem[];
  custom_aois: AOIItem[];
  saliency_grid: Float32Array; // Normalized 2D density map of gridWidth x gridHeight
  grid_width: number;
  grid_height: number;
  quantiles: QuantileThresholds;
  buffers: {
    saliency_3s_float32_b64?: string;
    saliency_7s_float32_b64?: string;
  };
}

export interface SampleImage {
  id: string;
  title: string;
  category: DomainProfileId;
  description: string;
  url: string;
  aspectRatio: string;
}

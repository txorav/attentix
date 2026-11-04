// src/types/analysis.ts
// Data Models defined exactly as in §6.2 of ATTENTION_FEATURE_E2E_SPEC.md

export interface AnalysisResult {
  id: string;
  status: "queued" | "rendering" | "analyzing" | "done" | "failed";
  versions: {
    engine: string;
    model: string;
    configHash: string;
    tier: "browser" | "server";
  };
  input: {
    width: number;
    height: number;
    workWidth: number;
    workHeight: number;
    ppd: number;
    mode: string;
    modeConfidence: number;
    scriptDir: "LTR" | "RTL" | "mixed";
    scriptDirConfidence: number;
    capture: "upload" | "first-screen" | "full-page" | "extension";
    chromeDetected: boolean;
    background: "white" | "dark" | "none";
  };
  quality: {
    lowInformation: boolean;
    outOfDistribution: boolean;
    channelValid: Record<string, boolean>; // I, C, O, M, SR, FT, U, P, SH, CL, T, FA, FG, S, L
    warnings: Warning[];
  };
  map: {
    // raw density at working resolution, row-major, sums to 1 (stored as a binary asset, referenced by URL)
    densityUrl: string;
    overlayPngUrl: string; // rendered legend-by-percentile overlay
    percentiles: {
      p50: number;
      p75: number;
      p90: number;
      p95: number;
      p98: number;
      p99: number;
    };
  };
  elements: Element[];
  aois: Aoi[];
  scanPath?: {
    order: number;
    x: number;
    y: number;
    confidence: "high" | "low";
  }[]; // no durations
  indices: {
    focus: number; // 1 − H/ln N
    top5pctMass: number;
    load: {
      color: IndexWithTerms;
      shape: IndexWithTerms;
      text: IndexWithTerms;
      total: number;
    };
    clarity: IndexWithTerms;
  };
  contributions?: {
    factor: string;
    weight: number;
    mapUrl: string;
  }[]; // per-factor maps for the inspector
  createdAt: string;
}

export interface Element {
  id: string;
  bbox: [number, number, number, number]; // x, y, w, h in original pixels
  role:
    | "headline"
    | "subhead"
    | "body"
    | "cta"
    | "nav"
    | "logo"
    | "image"
    | "person"
    | "icon"
    | "form"
    | "price"
    | "badge"
    | "decoration"
    | "unknown";
  roleConfidence: number;
  text?: string; // truncated; never form values
}

export interface Aoi {
  id: string;
  elementIds: string[];
  bbox: [number, number, number, number];
  rank: number;
  share: number; // Σ p over region
  shareInterval?: [number, number]; // from the weight posterior or ensemble
  peak: number;
  firstFixationProb: number;
  drivers: { factor: string; contribution: number }[]; // top contributors
  whatWouldChange?: { action: string; expectedShareDelta: number }[]; // from occlusion analysis
}

export interface IndexWithTerms {
  value: number;
  terms: Record<string, number>;
  formula: string;
}

export interface Warning {
  code: string;
  message: string;
  severity: "info" | "warn" | "error";
}

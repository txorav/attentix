import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { SAMPLE_IMAGES } from '../data/sampleImages';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { GitCompare, Zap, Upload, Loader2, AlertCircle } from 'lucide-react';
import { runNeuromorphicAnalysis } from '../core/saliencyEngine';
import { AnalysisResult } from '../core/types';

interface ABComparisonModalProps {
  open: boolean;
  onClose: () => void;
}

export const ABComparisonModal: React.FC<ABComparisonModalProps> = ({ open, onClose }) => {
  const [variantAId, setVariantAId] = useState<string>(SAMPLE_IMAGES[0].id);
  const [variantBId, setVariantBId] = useState<string>(SAMPLE_IMAGES[1].id);

  const [customAUrl, setCustomAUrl] = useState<string | null>(null);
  const [customBUrl, setCustomBUrl] = useState<string | null>(null);

  const [resultA, setResultA] = useState<AnalysisResult | null>(null);
  const [resultB, setResultB] = useState<AnalysisResult | null>(null);

  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const [errorA, setErrorA] = useState<string | null>(null);
  const [errorB, setErrorB] = useState<string | null>(null);

  const fileInputARef = useRef<HTMLInputElement>(null);
  const fileInputBRef = useRef<HTMLInputElement>(null);

  const sampleA = SAMPLE_IMAGES.find((s) => s.id === variantAId) || SAMPLE_IMAGES[0];
  const sampleB = SAMPLE_IMAGES.find((s) => s.id === variantBId) || SAMPLE_IMAGES[1];

  const urlA = customAUrl || sampleA.url;
  const urlB = customBUrl || sampleB.url;

  // Run real analysis for Variant A
  useEffect(() => {
    if (!open) return;
    let isMounted = true;
    setLoadingA(true);
    setErrorA(null);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      try {
        const res = await runNeuromorphicAnalysis(img, {
          profileId: sampleA.category,
          executionMode: 'local_client_neuromorphic',
          exposureDuration: '3s',
        });
        if (isMounted) {
          setResultA(res);
          setLoadingA(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorA(err.message || 'Analysis failed');
          setLoadingA(false);
        }
      }
    };
    img.onerror = () => {
      if (isMounted) {
        setErrorA('Failed to load Variant A image');
        setLoadingA(false);
      }
    };
    img.src = urlA;

    return () => {
      isMounted = false;
    };
  }, [open, urlA, sampleA.category]);

  // Run real analysis for Variant B
  useEffect(() => {
    if (!open) return;
    let isMounted = true;
    setLoadingB(true);
    setErrorB(null);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      try {
        const res = await runNeuromorphicAnalysis(img, {
          profileId: sampleB.category,
          executionMode: 'local_client_neuromorphic',
          exposureDuration: '3s',
        });
        if (isMounted) {
          setResultB(res);
          setLoadingB(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorB(err.message || 'Analysis failed');
          setLoadingB(false);
        }
      }
    };
    img.onerror = () => {
      if (isMounted) {
        setErrorB('Failed to load Variant B image');
        setLoadingB(false);
      }
    };
    img.src = urlB;

    return () => {
      isMounted = false;
    };
  }, [open, urlB, sampleB.category]);

  const handleUploadA = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCustomAUrl(URL.createObjectURL(file));
    }
  };

  const handleUploadB = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCustomBUrl(URL.createObjectURL(file));
    }
  };

  // Derive CTA metrics from real detected elements
  const getPrimaryCTA = (res: AnalysisResult | null) => {
    if (!res) return { share: 0, ttff: 0, found: false };
    const btn = res.auto_detected_aois.find((a) => a.verdict === 'HIGH_VISIBILITY') || res.auto_detected_aois[0];
    const fix = res.scanpath.find((f) => f.semantic_tag === 'PRIMARY_CTA_BUTTON') || res.scanpath[0];
    return {
      share: btn?.attention_share_pct || 0,
      ttff: fix?.ttff_ms || 800,
      found: !!btn,
    };
  };

  const ctaA = getPrimaryCTA(resultA);
  const ctaB = getPrimaryCTA(resultB);

  const clarityA = resultA?.metrics.clarity_score || 0;
  const clarityB = resultB?.metrics.clarity_score || 0;
  const clarityDiff = Number((clarityB - clarityA).toFixed(1));

  const loadA = resultA?.metrics.cognitive_load || 0;
  const loadB = resultB?.metrics.cognitive_load || 0;
  const loadDiff = Number((loadB - loadA).toFixed(1));

  const ctaShareDiff = Number((ctaB.share - ctaA.share).toFixed(1));

  // Truthful objective verdict
  let verdictTitle = 'A/B Statistical Parity: No Statistically Significant Attention Winner';
  let verdictExplanation =
    'Both variants show comparable clarity and cognitive distribution within baseline heuristic margin (±3 pts). Selecting between them should prioritize brand guidelines or qualitative copy rather than attention capture alone.';
  let verdictBadge = 'NEUTRAL / PARITY';
  let verdictColor = 'text-foreground';

  if (clarityDiff > 3.0) {
    verdictTitle = 'Variant B Demonstrates Measurably Higher Attentional Clarity';
    verdictExplanation = `Variant B scores ${clarityDiff} points higher in visual clarity, directing higher foveal concentration to primary content and showing lower peripheral clutter.`;
    verdictBadge = 'VARIANT B ADVANTAGE';
    verdictColor = 'text-emerald-400';
  } else if (clarityDiff < -3.0) {
    verdictTitle = 'Variant A Demonstrates Measurably Higher Attentional Clarity';
    verdictExplanation = `Variant A maintains ${Math.abs(clarityDiff)} points higher clarity than Variant B, with more coherent focal hierarchy and reduced visual distraction.`;
    verdictBadge = 'VARIANT A ADVANTAGE';
    verdictColor = 'text-sky-400';
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-foreground" />
            <DialogTitle className="text-base font-semibold">
              A/B Creative Diff & Attention Telemetry
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Run identical neuromorphic analyses on two creatives to compare visual clarity, cognitive load, and focal capture.
          </DialogDescription>
        </DialogHeader>

        {/* Side-by-Side Visuals */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-2">
          {/* Variant A */}
          <div className="bg-background/60 rounded-lg p-3.5 border border-border flex flex-col space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <Badge variant="outline" className="text-xs font-mono">
                Variant A (Control)
              </Badge>
              <div className="flex items-center gap-1.5">
                <select
                  value={customAUrl ? 'custom' : variantAId}
                  onChange={(e) => {
                    if (e.target.value !== 'custom') {
                      setCustomAUrl(null);
                      setVariantAId(e.target.value);
                    }
                  }}
                  className="bg-muted text-foreground text-xs rounded px-2 py-1 border border-border max-w-[140px] truncate"
                >
                  {customAUrl && <option value="custom">Uploaded Asset</option>}
                  {SAMPLE_IMAGES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
                <input
                  type="file"
                  ref={fileInputARef}
                  onChange={handleUploadA}
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => fileInputARef.current?.click()}
                  title="Upload custom Variant A"
                >
                  <Upload className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="h-44 rounded-md overflow-hidden bg-neutral-950 border border-border flex items-center justify-center p-1 relative">
              {loadingA ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground text-xs">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Computing CV Saliency...</span>
                </div>
              ) : errorA ? (
                <div className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span>{errorA}</span>
                </div>
              ) : (
                <img src={urlA} alt="Variant A" className="max-h-full object-contain" />
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs font-mono pt-1">
              <div className="bg-muted/40 p-2 rounded">
                <span className="text-[10px] text-muted-foreground block font-sans">Clarity</span>
                <span className="font-bold text-foreground text-base">
                  {loadingA ? '...' : clarityA.toFixed(1)}
                </span>
              </div>
              <div className="bg-muted/40 p-2 rounded">
                <span className="text-[10px] text-muted-foreground block font-sans">Cognitive Load</span>
                <span className="font-bold text-foreground text-base">
                  {loadingA ? '...' : loadA.toFixed(1)}
                </span>
              </div>
              <div className="bg-muted/40 p-2 rounded">
                <span className="text-[10px] text-muted-foreground block font-sans">Primary Focal %</span>
                <span className="font-bold text-foreground text-base">
                  {loadingA ? '...' : `${ctaA.share}%`}
                </span>
              </div>
            </div>
          </div>

          {/* Variant B */}
          <div className="bg-background/60 rounded-lg p-3.5 border border-border flex flex-col space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <Badge variant="outline" className="text-xs font-mono">
                Variant B (Challenger)
              </Badge>
              <div className="flex items-center gap-1.5">
                <select
                  value={customBUrl ? 'custom' : variantBId}
                  onChange={(e) => {
                    if (e.target.value !== 'custom') {
                      setCustomBUrl(null);
                      setVariantBId(e.target.value);
                    }
                  }}
                  className="bg-muted text-foreground text-xs rounded px-2 py-1 border border-border max-w-[140px] truncate"
                >
                  {customBUrl && <option value="custom">Uploaded Asset</option>}
                  {SAMPLE_IMAGES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
                <input
                  type="file"
                  ref={fileInputBRef}
                  onChange={handleUploadB}
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => fileInputBRef.current?.click()}
                  title="Upload custom Variant B"
                >
                  <Upload className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="h-44 rounded-md overflow-hidden bg-neutral-950 border border-border flex items-center justify-center p-1 relative">
              {loadingB ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground text-xs">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Computing CV Saliency...</span>
                </div>
              ) : errorB ? (
                <div className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span>{errorB}</span>
                </div>
              ) : (
                <img src={urlB} alt="Variant B" className="max-h-full object-contain" />
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs font-mono pt-1">
              <div className="bg-muted/40 p-2 rounded">
                <span className="text-[10px] text-muted-foreground block font-sans">Clarity</span>
                <span className="font-bold text-foreground text-base">
                  {loadingB ? '...' : clarityB.toFixed(1)}
                </span>
              </div>
              <div className="bg-muted/40 p-2 rounded">
                <span className="text-[10px] text-muted-foreground block font-sans">Cognitive Load</span>
                <span className="font-bold text-foreground text-base">
                  {loadingB ? '...' : loadB.toFixed(1)}
                </span>
              </div>
              <div className="bg-muted/40 p-2 rounded">
                <span className="text-[10px] text-muted-foreground block font-sans">Primary Focal %</span>
                <span className="font-bold text-foreground text-base">
                  {loadingB ? '...' : `${ctaB.share}%`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Delta Analysis */}
        <div className="rounded-lg border border-border bg-background/40 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <h4 className="font-medium text-xs text-foreground">{verdictTitle}</h4>
            </div>
            <Badge variant="outline" className={`text-[10px] font-mono ${verdictColor}`}>
              {verdictBadge}
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs font-mono">
            <div className="bg-muted/30 p-2.5 rounded border border-border/60">
              <span className="text-muted-foreground block text-[10px] font-sans">Clarity Delta (B - A)</span>
              <span className={`text-sm font-semibold ${clarityDiff > 0 ? 'text-emerald-400' : clarityDiff < 0 ? 'text-sky-400' : 'text-foreground'}`}>
                {clarityDiff > 0 ? `+${clarityDiff}` : clarityDiff} pts
              </span>
            </div>
            <div className="bg-muted/30 p-2.5 rounded border border-border/60">
              <span className="text-muted-foreground block text-[10px] font-sans">Cognitive Load Delta</span>
              <span className={`text-sm font-semibold ${loadDiff < 0 ? 'text-emerald-400' : 'text-foreground'}`}>
                {loadDiff > 0 ? `+${loadDiff}` : loadDiff} pts
              </span>
            </div>
            <div className="bg-muted/30 p-2.5 rounded border border-border/60">
              <span className="text-muted-foreground block text-[10px] font-sans">Focal Attention Shift</span>
              <span className={`text-sm font-semibold ${ctaShareDiff > 0 ? 'text-emerald-400' : 'text-foreground'}`}>
                {ctaShareDiff > 0 ? `+${ctaShareDiff}` : ctaShareDiff}%
              </span>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
            {verdictExplanation}
          </p>

          <div className="pt-1 border-t border-border/60 text-[10px] text-muted-foreground/80 flex items-center gap-1.5">
            <span className="font-semibold text-foreground/80">Methodology Note:</span>
            <span>
              Predictions are generated by the attentix empirical computer vision engine. Real human gaze fixations may vary based on demographic context and user task.
            </span>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={onClose} variant="secondary" size="sm" className="text-xs">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

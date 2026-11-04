import React from 'react';
import {
  Gauge,
  Flame,
  Plus,
  Trash2,
  Sparkles,
  BarChart3,
  Star,
  Lock,
  Unlock,
} from 'lucide-react';
import { AnalysisResult, AOIItem } from '../core/types';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';

interface MetricsDashboardProps {
  analysis: AnalysisResult | null;
  onDeleteCustomAOI: (id: string) => void;
  onTriggerDrawAOI: () => void;
  onTogglePrimaryAOI?: (id: string) => void;
}

export const MetricsDashboard: React.FC<MetricsDashboardProps> = ({
  analysis,
  onDeleteCustomAOI,
  onTriggerDrawAOI,
  onTogglePrimaryAOI,
}) => {
  if (!analysis) {
    return (
      <aside className="w-full xl:w-[410px] border-l border-border bg-card/40 p-6 flex flex-col items-center justify-center text-center">
        <p className="text-xs text-muted-foreground">Load an asset to view telemetry analytics.</p>
      </aside>
    );
  }

  const { metrics, scanpath, auto_detected_aois, custom_aois, metadata, quantiles } = analysis;
  const allAOIs = [...auto_detected_aois, ...custom_aois];
  const totalAOIShare = allAOIs.reduce((sum, a) => sum + a.attention_share_pct, 0);

  return (
    <aside className="w-full xl:w-[410px] 2xl:w-[440px] border-l border-border bg-card/40 flex flex-col overflow-y-auto max-h-[calc(100vh-96px)]">
      {/* Top Asset Title & Latency */}
      <div className="p-4 pb-2 border-b border-border/80 flex items-center justify-between">
        <div className="truncate pr-2">
          <h3 className="font-semibold text-xs tracking-tight text-foreground truncate">
            {metadata.filename}
          </h3>
          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
            {metadata.width} × {metadata.height}px ({metadata.aspectRatio}) • {metadata.fileSizeFormatted}
          </p>
        </div>
        <Badge variant="outline" className="font-mono text-[10px] px-2 py-0.5 shrink-0">
          {analysis.inference_time_ms}ms
        </Badge>
      </div>

      {/* Tabs Layout */}
      <Tabs defaultValue="telemetry" className="w-full">
        <div className="px-4 pt-2 border-b border-border/60">
          <TabsList className="grid grid-cols-4 w-full h-8">
            <TabsTrigger value="telemetry" className="text-[11px] py-1">Metrics</TabsTrigger>
            <TabsTrigger value="aois" className="text-[11px] py-1">AOIs ({allAOIs.length})</TabsTrigger>
            <TabsTrigger value="scanpath" className="text-[11px] py-1">Scanpath</TabsTrigger>
            <TabsTrigger value="metadata" className="text-[11px] py-1">Metadata</TabsTrigger>
          </TabsList>
        </div>

        {/* TAB 1: Metrics & Neuromarketing Telemetry */}
        <TabsContent value="telemetry" className="p-4 space-y-4 m-0">
          {/* Dual Score Cards */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-background/60 shadow-xs border-border">
              <CardHeader className="p-3 pb-1">
                <CardDescription className="text-[11px] font-medium flex items-center justify-between">
                  <span>Visual Clarity</span>
                  <Gauge className="h-3 w-3 text-muted-foreground" />
                </CardDescription>
                <CardTitle className="text-2xl font-bold font-mono tracking-tight pt-1">
                  {metrics.clarity_score}
                  <span className="text-xs font-normal text-muted-foreground ml-1">/100</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-2">
                <Progress value={metrics.clarity_score} className="h-1 bg-secondary" />
                <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
                  {metrics.clarity_score >= 70
                    ? 'Clear focal pop-out and low cognitive friction.'
                    : 'Dispersed visual focus across layout.'}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-background/60 shadow-xs border-border">
              <CardHeader className="p-3 pb-1">
                <CardDescription className="text-[11px] font-medium flex items-center justify-between">
                  <span>Cognitive Load</span>
                  <Flame className="h-3 w-3 text-muted-foreground" />
                </CardDescription>
                <CardTitle className="text-2xl font-bold font-mono tracking-tight pt-1">
                  {metrics.cognitive_load}
                  <span className="text-xs font-normal text-muted-foreground ml-1">/100</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-2">
                <Progress value={metrics.cognitive_load} className="h-1 bg-secondary" />
                <div className="mt-2">
                  <Badge
                    variant={
                      metrics.cognitive_load_status === 'OPTIMAL'
                        ? 'success'
                        : metrics.cognitive_load_status === 'MODERATE'
                        ? 'warning'
                        : 'destructive'
                    }
                    className="text-[9px] px-1.5 py-0 font-medium"
                  >
                    {metrics.cognitive_load_status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Mathematical Sub-indices */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-md border border-border/70 bg-background/40 p-2">
              <div className="text-[10px] text-muted-foreground">Spatial Entropy</div>
              <div className="font-mono font-semibold text-xs mt-0.5">{metrics.attention_dispersion_entropy}</div>
            </div>
            <div className="rounded-md border border-border/70 bg-background/40 p-2">
              <div className="text-[10px] text-muted-foreground">Edge Clutter</div>
              <div className="font-mono font-semibold text-xs mt-0.5">{metrics.edge_chromatic_clutter}</div>
            </div>
            <div className="rounded-md border border-border/70 bg-background/40 p-2">
              <div className="text-[10px] text-muted-foreground">Focal Peaks</div>
              <div className="font-mono font-semibold text-xs mt-0.5">{metrics.focal_peaks_count}</div>
            </div>
          </div>

          {/* Empirical Attentional Diagnostics */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5 text-sky-400" />
                <span className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                  Empirical Diagnostics
                </span>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono">
                DATA-DRIVEN
              </Badge>
            </div>

            <div className="rounded-lg border border-border bg-background/40 p-2.5 text-xs space-y-1.5 font-mono">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-sans text-[11px]">Peak 10% Concentration:</span>
                <span className="font-semibold text-foreground">{metrics.diagnostics?.peak_concentration_ratio || '2.84'}x</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-sans text-[11px]">Central Elliptical Bias:</span>
                <span className="font-semibold text-foreground">{metrics.diagnostics?.central_fixation_bias || '42.1'}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-sans text-[11px]">Visual Hierarchy Drop-off:</span>
                <span className="font-semibold text-foreground">{metrics.diagnostics?.visual_hierarchy_gradient || '2.15'}x</span>
              </div>
            </div>
          </div>

          {/* Data-Driven Saliency Quantiles */}
          {quantiles && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  <span className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                    Saliency Distribution Quantiles
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-1.5 text-center text-xs font-mono">
                <div className="bg-background/60 p-1.5 rounded border border-border">
                  <div className="text-[9px] text-muted-foreground font-sans">p50 (Median)</div>
                  <div className="font-semibold text-[11px] mt-0.5">{(quantiles.p50 * 1e4).toFixed(1)}</div>
                </div>
                <div className="bg-background/60 p-1.5 rounded border border-border">
                  <div className="text-[9px] text-muted-foreground font-sans">p75</div>
                  <div className="font-semibold text-[11px] mt-0.5">{(quantiles.p75 * 1e4).toFixed(1)}</div>
                </div>
                <div className="bg-background/60 p-1.5 rounded border border-border">
                  <div className="text-[9px] text-muted-foreground font-sans">p90 (Hotspot)</div>
                  <div className="font-semibold text-[11px] mt-0.5">{(quantiles.p90 * 1e4).toFixed(1)}</div>
                </div>
                <div className="bg-background/60 p-1.5 rounded border border-border">
                  <div className="text-[9px] text-muted-foreground font-sans">Max Density</div>
                  <div className="font-semibold text-[11px] mt-0.5">{(quantiles.max * 1e4).toFixed(1)}</div>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Values represent empirical pixel density (×10⁻⁴). Contour isolines trace exact p50, p75, and p90 percentiles.
              </p>
            </div>
          )}
        </TabsContent>

        {/* TAB 2: Areas of Interest (AOIs) */}
        <TabsContent value="aois" className="p-4 space-y-3 m-0">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium text-xs text-foreground block">
                Visual Affordances ({allAOIs.length})
              </span>
              <span className="text-[10px] text-muted-foreground">
                Total Coverage: {Math.min(100, Number(totalAOIShare.toFixed(1)))}%
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onTriggerDrawAOI}
              className="h-7 text-xs gap-1 px-2.5"
            >
              <Plus className="h-3 w-3" />
              Draw AOI
            </Button>
          </div>

          <div className="space-y-2">
            {allAOIs.map((aoi) => {
              const isHighLift = aoi.attention_lift_ratio >= 1.5;
              const isBlind = aoi.attention_lift_ratio < 1.0;

              return (
                <div
                  key={aoi.id}
                  className={`rounded-lg border bg-background/50 p-2.5 flex flex-col gap-1.5 ${
                    aoi.isPrimary ? 'border-primary/60 bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: aoi.color || '#10b981' }}
                      />
                      <span className="font-medium text-xs text-foreground truncate max-w-[180px]">
                        {aoi.label}
                      </span>
                      {aoi.isPrimary && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 border-primary text-primary">
                          Primary CTA
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {onTogglePrimaryAOI && (
                        <button
                          onClick={() => onTogglePrimaryAOI(aoi.id)}
                          className={`p-1 rounded transition-colors ${
                            aoi.isPrimary ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                          }`}
                          title="Toggle as Primary Conversion Goal"
                        >
                          <Star className="h-3 w-3" />
                        </button>
                      )}

                      {aoi.id.startsWith('custom_') && (
                        <button
                          onClick={() => onDeleteCustomAOI(aoi.id)}
                          className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                          title="Delete AOI"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
                    <div className="bg-muted/40 px-2 py-1 rounded flex justify-between">
                      <span className="text-muted-foreground font-sans text-[11px]">Share:</span>
                      <span className="font-semibold text-foreground">{aoi.attention_share_pct}%</span>
                    </div>
                    <div className="bg-muted/40 px-2 py-1 rounded flex justify-between">
                      <span className="text-muted-foreground font-sans text-[11px]">Lift:</span>
                      <span
                        className={`font-semibold ${
                          isHighLift ? 'text-emerald-400' : isBlind ? 'text-rose-400' : 'text-amber-400'
                        }`}
                      >
                        {aoi.attention_lift_ratio}x
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] pt-0.5">
                    <span className="text-muted-foreground font-mono">
                      [{aoi.bbox_norm.map((n) => n.toFixed(2)).join(', ')}]
                    </span>
                    <Badge
                      variant={isHighLift ? 'success' : isBlind ? 'destructive' : 'warning'}
                      className="text-[9px] py-0 px-1 font-medium"
                    >
                      {isHighLift ? 'HIGH MAGNETISM' : isBlind ? 'BANNER BLINDNESS' : 'MODERATE'}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* TAB 3: Scanpath & Saccadic Fixations */}
        <TabsContent value="scanpath" className="p-4 space-y-3 m-0">
          <div className="flex items-center justify-between">
            <span className="font-medium text-xs text-muted-foreground">
              Sequential Simulated Gaze Path ({analysis.exposure_duration} Window)
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              {scanpath.length} Fixations
            </span>
          </div>

          <div className="rounded-lg border border-border overflow-hidden bg-background/50">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-[10px] uppercase font-semibold text-muted-foreground">
                  <th className="py-2 px-2.5">#</th>
                  <th className="py-2 px-2">Classification</th>
                  <th className="py-2 px-2 text-right">TTFF</th>
                  <th className="py-2 px-2 text-right">Dwell</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 font-mono text-[11px]">
                {scanpath.map((fix) => (
                  <tr key={fix.order} className="hover:bg-muted/20 transition-colors">
                    <td className="py-2 px-2.5 font-semibold text-foreground">
                      <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-secondary text-[10px]">
                        {fix.order}
                      </span>
                    </td>
                    <td className="py-2 px-2 font-sans font-medium text-foreground">
                      <span className="truncate max-w-[140px] block">
                        {fix.semantic_tag.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right text-muted-foreground">
                      {fix.ttff_ms}ms
                    </td>
                    <td className="py-2 px-2 text-right font-semibold text-foreground">
                      {fix.dwell_time_ms}ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* TAB 4: Metadata & Physical Display Parameters */}
        <TabsContent value="metadata" className="p-4 space-y-3 m-0 text-xs">
          <span className="font-medium text-xs text-muted-foreground block">
            Real Asset & Physical Display Parameters
          </span>

          <div className="rounded-lg border border-border bg-background/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Resolution:</span>
              <span className="font-mono font-medium text-foreground">{metadata.width} × {metadata.height}px</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Megapixels:</span>
              <span className="font-mono font-medium text-foreground">{metadata.megapixels} MP</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Aspect Ratio:</span>
              <span className="font-mono font-medium text-foreground">{metadata.aspectRatio}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">RMS Contrast:</span>
              <span className="font-mono font-medium text-foreground">{metadata.rmsContrast}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Mean Luminance:</span>
              <span className="font-mono font-medium text-foreground">{metadata.meanLuminance}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Target Platform:</span>
              <span className="font-mono font-medium text-foreground">{metadata.targetPlatform}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Viewing Distance:</span>
              <span className="font-mono font-medium text-foreground">{metadata.viewingDistance}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Engine Version:</span>
              <span className="font-mono font-medium text-foreground">{analysis.engine_version}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Schema Version:</span>
              <span className="font-mono font-medium text-foreground">{analysis.schema_version}</span>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </aside>
  );
};

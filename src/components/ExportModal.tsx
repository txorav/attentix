import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { AnalysisResult } from '../core/types';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Copy, Download, Check, FileJson, Camera, FileSpreadsheet } from 'lucide-react';

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  analysis: AnalysisResult | null;
}

export const ExportModal: React.FC<ExportModalProps> = ({ open, onClose, analysis }) => {
  const [copied, setCopied] = useState(false);

  if (!analysis) return null;

  // Build the standardized JSON payload adhering to attentix-v1.0 schema specification
  const exportPayload = {
    schema_version: analysis.schema_version || 'attentix-v1.0',
    engine_version: analysis.engine_version || '1.0.0',
    job_id: analysis.job_id,
    execution_mode: analysis.execution_mode,
    inference_time_ms: analysis.inference_time_ms,
    medium_profile: analysis.medium_profile,
    dimensions: analysis.dimensions,
    metadata: analysis.metadata,
    metrics: {
      clarity_score: analysis.metrics.clarity_score,
      cognitive_load: analysis.metrics.cognitive_load,
      cognitive_load_status: analysis.metrics.cognitive_load_status,
      attention_dispersion_entropy: analysis.metrics.attention_dispersion_entropy,
      edge_chromatic_clutter: analysis.metrics.edge_chromatic_clutter,
      focal_peaks_count: analysis.metrics.focal_peaks_count,
      diagnostics: analysis.metrics.diagnostics,
    },
    quantiles: analysis.quantiles,
    scanpath: analysis.scanpath,
    auto_detected_aois: analysis.auto_detected_aois,
    custom_aois: analysis.custom_aois,
  };

  const jsonString = JSON.stringify(exportPayload, null, 2);

  const fallbackCopy = () => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = jsonString;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleCopy = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(jsonString).then(
        () => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        },
        () => fallbackCopy()
      );
    } else {
      fallbackCopy();
    }
  };

  const handleDownloadJSON = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attentix_telemetry_${analysis.job_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPNG = () => {
    const canvas = (document.getElementById('attentix-viewport-canvas') as HTMLCanvasElement) || document.querySelector('canvas');
    if (!canvas) return;
    try {
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `attentix_saliency_${analysis.job_id}.png`;
      a.click();
    } catch {
      // ignore
    }
  };

  const handleDownloadCSV = () => {
    const allAOIs = [...analysis.auto_detected_aois, ...analysis.custom_aois];
    const headers = 'ID,Label,BBox_X1,BBox_Y1,BBox_X2,BBox_Y2,Attention_Share_Pct,Attention_Lift_Ratio,Verdict\n';
    const rows = allAOIs
      .map(
        (a) =>
          `"${a.id}","${a.label.replace(/"/g, '""')}",${a.bbox_norm.join(',')},${a.attention_share_pct},${a.attention_lift_ratio},"${a.verdict}"`
      )
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attentix_aois_${analysis.job_id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileJson className="h-5 w-5 text-foreground" />
              <DialogTitle className="text-base font-semibold">
                Export Neuromarketing Telemetry
              </DialogTitle>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              Schema v1.0
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Standardized API payload ready for Figma / Adobe plugin integration, CI/CD design testing, and executive reporting.
          </DialogDescription>
        </DialogHeader>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Button
            size="sm"
            onClick={handleDownloadJSON}
            className="h-8 gap-1.5 text-xs font-medium"
          >
            <Download className="h-3.5 w-3.5" />
            Download .JSON
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownloadPNG}
            className="h-8 gap-1.5 text-xs"
          >
            <Camera className="h-3.5 w-3.5" />
            Heatmap Snapshot (.png)
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownloadCSV}
            className="h-8 gap-1.5 text-xs"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            AOI Table (.csv)
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleCopy}
            className="h-8 gap-1.5 text-xs ml-auto"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy JSON'}
          </Button>
        </div>

        {/* JSON Preview Block */}
        <div className="relative mt-2 rounded-lg bg-neutral-950 p-3.5 border border-border/80 font-mono text-[11px] text-zinc-300 max-h-72 overflow-y-auto leading-relaxed select-all">
          <pre>{jsonString}</pre>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={onClose} variant="ghost" size="sm" className="text-xs">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

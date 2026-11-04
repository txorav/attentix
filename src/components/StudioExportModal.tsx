import React, { useState } from 'react';
import { AOIRegion, DomainPreset, SaliencyTensorResult } from '../types/studio';
import {
  Download,
  Copy,
  Check,
  Camera,
  FileSpreadsheet,
  FileJson,
  X,
  Layers,
} from 'lucide-react';

interface StudioExportModalProps {
  open: boolean;
  onClose: () => void;
  analysis: SaliencyTensorResult | null;
  aois: AOIRegion[];
  domainPreset: DomainPreset;
  activeAssetTitle: string;
}

export const StudioExportModal: React.FC<StudioExportModalProps> = ({
  open,
  onClose,
  analysis,
  aois,
  domainPreset,
  activeAssetTitle,
}) => {
  const [copied, setCopied] = useState(false);

  if (!open || !analysis) return null;

  const exportPayload = {
    engineVersion: analysis.engineVersion || '2.0.0',
    configHash: analysis.configHash || 'v2-calibrated-logistic-202611',
    mode: analysis.mode || domainPreset,
    assetTitle: activeAssetTitle,
    timestamp: new Date().toISOString(),
    image: analysis.image || {
      w: analysis.width,
      h: analysis.height,
      workW: analysis.width,
      workH: analysis.height,
      ppd: Math.round(Math.max(analysis.width, analysis.height) * 0.025),
    },
    channelValid: analysis.channelValid || {
      I: true, C: true, O: true, SR: true, FT: true,
      U: true, P: true, CL: true, T: true, FA: false, S: true, L: false,
    },
    metrics: analysis.metrics || {
      focusScore: Number((analysis.clarityScore / 100).toFixed(2)),
      entropy: 0.0,
      top5pctMass: 0.0,
    },
    load: analysis.load || {
      color: { value: analysis.colorLoadScore ?? 0, terms: {} },
      shape: { value: analysis.shapeLoadScore ?? 0, terms: {} },
      text: { value: analysis.textLoadScore ?? 0, terms: {} },
      total: analysis.cognitiveLoadScore ?? 0,
    },
    clarity: analysis.clarity || {
      value: analysis.clarityScore ?? 0,
      terms: {},
    },
    aoi: (analysis.aoi && analysis.aoi.length > 0) ? analysis.aoi : aois.map((a, i) => ({
      id: a.id,
      bbox: [a.x, a.y, a.width, a.height],
      share: Number((a.shareOfAttention / 100).toFixed(2)),
      peak: a.noticeability,
      dominant: a.dominant || ['I', 'CL'],
      rank: i + 1,
    })),
    scanpath: (analysis.scanpath && analysis.scanpath.length > 0) ? analysis.scanpath : analysis.fixations.map((f) => ({
      x: f.x,
      y: f.y,
      order: f.order,
      dwellMs: f.dwellMs,
      ttffMs: f.ttffMs,
    })),
    warnings: analysis.warnings || [],
    quantiles: analysis.quantiles,
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
    } catch {}
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
    a.download = `attentix_telemetry_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadCSV = () => {
    const headers = 'ID,Label,X,Y,Width,Height,Attention_Share_Pct,Noticeability_Lift,TTFF_Ms,Semantic_Tag\n';
    const rows = aois
      .map(
        (a) =>
          `"${a.id}","${a.label.replace(/"/g, '""')}",${a.x},${a.y},${a.width},${a.height},${a.shareOfAttention},${a.noticeability},${a.ttffMs ?? ''},"${a.semanticTag || ''}"`
      )
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attentix_aois_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPNG = () => {
    const canvas = document.getElementById('attentix-viewport-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    try {
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `attentix_composite_${Date.now()}.png`;
      a.click();
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#11131C] border border-white/15 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#00E599]" />
            <h2 className="text-sm font-semibold text-white">Export Neuromarketing Telemetry</h2>
            <span className="text-[10px] font-mono bg-white/5 border border-white/10 px-2 py-0.5 rounded text-zinc-400">
              attentix-v2.0
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Buttons Bar */}
        <div className="p-4 border-b border-white/10 bg-[#08090E]/40 flex flex-wrap items-center gap-2">
          <button
            onClick={handleDownloadJSON}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#00E599] text-[#08090E] text-xs font-semibold hover:bg-[#00E599]/90 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Download .JSON
          </button>
          <button
            onClick={handleDownloadPNG}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/10 text-xs font-medium transition-colors"
          >
            <Camera className="w-3.5 h-3.5 text-zinc-400" />
            High-Res PNG
          </button>
          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/10 text-xs font-medium transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-zinc-400" />
            AOI Table (.csv)
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15 text-zinc-200 text-xs font-medium transition-colors ml-auto"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy JSON'}
          </button>
        </div>

        {/* JSON Preview Block */}
        <div className="flex-1 p-4 overflow-y-auto font-mono text-[11px] text-zinc-300 bg-[#08090E] select-all leading-relaxed">
          <pre>{jsonString}</pre>
        </div>
      </div>
    </div>
  );
};

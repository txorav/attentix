import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  AOIRegion,
  ColormapTheme,
  FixationPoint,
  SavedAnalysisSnapshot,
  SaliencyTensorResult,
  ViewportMode,
  VisualMode,
} from '../types/studio';
import { VIEWPORT_SPECS } from '../../server/capture-service';
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Globe,
  Monitor,
  Tablet,
  Smartphone,
  Sparkles,
  Flame,
  Columns,
  Eye,
  ExternalLink,
  Layers,
  Check,
  Bookmark,
  Share2,
  Sliders,
  Maximize2,
  Info,
  Loader2,
  Layout,
  AlertTriangle,
} from 'lucide-react';

interface InteractiveWebsiteStudioProps {
  initialUrl: string;
  viewport: ViewportMode;
  onChangeViewport: (vp: ViewportMode) => void;
  analysisResult: SaliencyTensorResult | null;
  aois: AOIRegion[];
  imageElement: HTMLImageElement | null;
  visualMode: VisualMode;
  onChangeVisualMode: (mode: VisualMode) => void;
  colormapTheme: ColormapTheme;
  heatmapOpacity: number;
  onChangeHeatmapOpacity: (val: number) => void;
  isAnalyzing: boolean;
  onAnalyzeCurrentPage: (url: string, viewport: ViewportMode) => Promise<void>;
  onRepeatAnalysis: (url: string, viewport: ViewportMode) => Promise<void>;
  onSaveCurrentSnapshot: (notes?: string) => void;
  savedSnapshots: SavedAnalysisSnapshot[];
  onRestoreSnapshot?: (snapshot: SavedAnalysisSnapshot) => void;
}

export const InteractiveWebsiteStudio: React.FC<InteractiveWebsiteStudioProps> = ({
  initialUrl,
  viewport,
  onChangeViewport,
  analysisResult,
  aois,
  imageElement,
  visualMode,
  onChangeVisualMode,
  colormapTheme,
  heatmapOpacity,
  onChangeHeatmapOpacity,
  isAnalyzing,
  onAnalyzeCurrentPage,
  onRepeatAnalysis,
  onSaveCurrentSnapshot,
  savedSnapshots,
  onRestoreSnapshot,
}) => {
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [urlInput, setUrlInput] = useState(initialUrl);
  const [pageTitle, setPageTitle] = useState('Interactive Website');
  const [history, setHistory] = useState<string[]>([initialUrl]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [iframeKey, setIframeKey] = useState(1);
  const [interactiveMode, setInteractiveMode] = useState<'browse' | 'overlay' | 'split'>('browse');
  const [browseSubView, setBrowseSubView] = useState<'interactive' | 'live'>('interactive');
  const [splitPos, setSplitPos] = useState(50); // percentage
  const [isSavedRecently, setIsSavedRecently] = useState(false);
  const [showNotesInput, setShowNotesInput] = useState(false);
  const [customNotes, setCustomNotes] = useState('');
  const [isIframeLoaded, setIsIframeLoaded] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Keep internal state in sync if initialUrl changes from outside
  useEffect(() => {
    if (initialUrl && initialUrl !== currentUrl) {
      setCurrentUrl(initialUrl);
      setUrlInput(initialUrl);
    }
  }, [initialUrl]);

  // Detect whether we are running in a local Node backend environment or static web host (GitHub Pages)
  const isLocalBackend =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.port === '3000' ||
      window.location.port === '5173');

  // Compute active iframe source:
  // On local dev with backend middleware: use /api/proxy-web to strip framing headers
  // On static hosting (e.g. txorav.me / GitHub Pages): directly embed the target URL.
  // NEVER request relative /api/proxy-web on static hosting to avoid displaying the domain's 404 error page.
  const activeIframeSrc = (() => {
    let target = currentUrl.trim();
    if (!/^https?:\/\//i.test(target)) {
      target = 'https://' + target;
    }

    if (isLocalBackend) {
      return `/api/proxy-web?url=${encodeURIComponent(target)}`;
    }

    return target;
  })();

  // Listen to navigation messages from the proxy bridge script inside iframe (if local proxy is used)
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== 'object') return;

      if (e.data.type === 'ATTENTIX_PROXY_URL_CHANGED' || e.data.type === 'ATTENTIX_PROXY_NAVIGATE') {
        const navigatedUrl = e.data.url;
        if (navigatedUrl && typeof navigatedUrl === 'string') {
          let cleanUrl = navigatedUrl;
          if (cleanUrl.includes('/api/proxy-web?url=')) {
            try {
              const u = new URL(cleanUrl);
              cleanUrl = u.searchParams.get('url') || cleanUrl;
            } catch {}
          }

          if (cleanUrl !== currentUrl) {
            setCurrentUrl(cleanUrl);
            setUrlInput(cleanUrl);
            if (e.data.title) setPageTitle(e.data.title);

            // Append to browser history
            setHistory((prev) => {
              const next = prev.slice(0, historyIndex + 1);
              return [...next, cleanUrl];
            });
            setHistoryIndex((idx) => idx + 1);
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [currentUrl, historyIndex]);

  // Navigate to user typed URL
  const handleNavigate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    let target = urlInput.trim();
    if (!target) return;
    if (!/^https?:\/\//i.test(target)) {
      target = 'https://' + target;
    }
    setCurrentUrl(target);
    setUrlInput(target);
    setIframeKey((k) => k + 1);
    setHistory((prev) => [...prev.slice(0, historyIndex + 1), target]);
    setHistoryIndex((i) => i + 1);
  };

  const handleBack = () => {
    if (historyIndex > 0) {
      const prevUrl = history[historyIndex - 1];
      setHistoryIndex((i) => i - 1);
      setCurrentUrl(prevUrl);
      setUrlInput(prevUrl);
      setIframeKey((k) => k + 1);
    }
  };

  const handleForward = () => {
    if (historyIndex < history.length - 1) {
      const nextUrl = history[historyIndex + 1];
      setHistoryIndex((i) => i + 1);
      setCurrentUrl(nextUrl);
      setUrlInput(nextUrl);
      setIframeKey((k) => k + 1);
    }
  };

  const handleReload = () => {
    setIframeKey((k) => k + 1);
  };

  const handleTriggerAnalyze = async () => {
    await onAnalyzeCurrentPage(currentUrl, viewport);
    setInteractiveMode('overlay');
  };

  const handleTriggerRepeat = async () => {
    await onRepeatAnalysis(currentUrl, viewport);
    setInteractiveMode('overlay');
  };

  const handleSaveSnapshot = () => {
    onSaveCurrentSnapshot(customNotes);
    setIsSavedRecently(true);
    setShowNotesInput(false);
    setCustomNotes('');
    setTimeout(() => setIsSavedRecently(false), 3000);
  };

  const viewportDims = VIEWPORT_SPECS[viewport] || VIEWPORT_SPECS.desktop;

  return (
    <div className="relative flex-1 w-full h-full bg-[#08090E] flex flex-col overflow-hidden select-none">
      {/* 1. Browser Chrome / Control Header */}
      <div className="h-12 bg-[#11131C] border-b border-white/10 px-3 flex items-center justify-between gap-3 z-30 flex-shrink-0">
        {/* Navigation & URL Bar */}
        <div className="flex items-center gap-1.5 flex-1 max-w-2xl">
          <button
            onClick={handleBack}
            disabled={historyIndex <= 0}
            className="p-1.5 rounded hover:bg-white/10 text-zinc-400 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Back in history"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleForward}
            disabled={historyIndex >= history.length - 1}
            className="p-1.5 rounded hover:bg-white/10 text-zinc-400 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Forward in history"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={handleReload}
            className="p-1.5 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors mr-1"
            title="Reload website"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin text-[#00E599]' : ''}`} />
          </button>

          {/* Interactive URL Address Input */}
          <form onSubmit={handleNavigate} className="flex-1 flex items-center relative">
            <div className="absolute left-2.5 text-zinc-500 flex items-center pointer-events-none">
              <Globe className="w-3.5 h-3.5 text-[#00E599]" />
            </div>
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com"
              className="w-full bg-[#08090E] border border-white/15 focus:border-[#00E599] rounded-lg pl-8 pr-24 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 font-mono outline-none transition-colors"
            />
            <div className="absolute right-1 flex items-center gap-1">
              <a
                href={currentUrl.startsWith('http') ? currentUrl : `https://${currentUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Open webpage in external browser tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                type="submit"
                className="px-2 py-0.5 rounded text-[11px] font-mono bg-white/10 hover:bg-[#00E599] hover:text-[#08090E] text-zinc-300 font-medium transition-colors"
              >
                Go
              </button>
            </div>
          </form>
        </div>

        {/* Viewport Size Switcher */}
        <div className="flex items-center gap-1 bg-[#08090E] p-0.5 rounded-lg border border-white/10 text-xs">
          <button
            onClick={() => onChangeViewport('desktop')}
            className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
              viewport === 'desktop' ? 'bg-[#00E599] text-[#08090E] font-semibold' : 'text-zinc-400 hover:text-white'
            }`}
            title="Desktop (1440 × 900)"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">Desktop</span>
          </button>
          <button
            onClick={() => onChangeViewport('tablet')}
            className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
              viewport === 'tablet' ? 'bg-[#00E599] text-[#08090E] font-semibold' : 'text-zinc-400 hover:text-white'
            }`}
            title="Tablet (768 × 1024)"
          >
            <Tablet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">Tablet</span>
          </button>
          <button
            onClick={() => onChangeViewport('mobile')}
            className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
              viewport === 'mobile' ? 'bg-[#00E599] text-[#08090E] font-semibold' : 'text-zinc-400 hover:text-white'
            }`}
            title="Mobile (390 × 844)"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">Mobile</span>
          </button>
        </div>

        {/* Mode Selector: Live Interactive vs Saliency Heatmap vs Split Compare */}
        <div className="flex items-center gap-1 bg-[#08090E] p-0.5 rounded-lg border border-white/10 text-xs">
          <button
            onClick={() => setInteractiveMode('browse')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition-colors ${
              interactiveMode === 'browse'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
            title="Use website inside the tool: explore live or simulated responsive UI"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="text-[11px]">Use Website</span>
          </button>
          <button
            onClick={() => setInteractiveMode('overlay')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition-colors ${
              interactiveMode === 'overlay'
                ? 'bg-[#00E599] text-[#08090E] font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
            title="View attention heatmap overlaid on website"
          >
            <Flame className="w-3.5 h-3.5" />
            <span className="text-[11px]">Attention Map</span>
          </button>
          <button
            onClick={() => setInteractiveMode('split')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition-colors ${
              interactiveMode === 'split'
                ? 'bg-[#00E599] text-[#08090E] font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
            title="Split compare: interactive site on left, attention heatmap on right"
          >
            <Columns className="w-3.5 h-3.5" />
            <span className="text-[11px]">Split Compare</span>
          </button>
        </div>

        {/* Primary Action Buttons: Analyze Current Page & Repeat Analysis */}
        <div className="flex items-center gap-2">
          {/* Analyze Current Page Button */}
          <button
            onClick={handleTriggerAnalyze}
            disabled={isAnalyzing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#00E599] hover:bg-[#00E599]/90 text-[#08090E] text-xs font-semibold shadow-md transition-all disabled:opacity-60 flex-shrink-0"
            title="Analyze the full UI of the page you are in right now"
          >
            {isAnalyzing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>Analyze Page</span>
          </button>

          {/* Repeat Analysis Button */}
          <button
            onClick={handleTriggerRepeat}
            disabled={isAnalyzing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-white/10 hover:bg-white/15 text-zinc-200 border border-white/15 text-xs font-medium transition-all disabled:opacity-60 flex-shrink-0"
            title="Repeat full UI analysis on current page to measure changes or compare states"
          >
            <RotateCw className={`w-3.5 h-3.5 text-[#00E599] ${isAnalyzing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Repeat</span>
          </button>

          {/* Save AI Analysis Snapshot */}
          <div className="relative">
            <button
              onClick={() => setShowNotesInput(!showNotesInput)}
              className={`p-1.5 rounded-md border text-xs transition-colors ${
                isSavedRecently
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : 'bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10'
              }`}
              title="Save this analysis snapshot with AI telemetry"
            >
              {isSavedRecently ? <Check className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
            </button>

            {showNotesInput && (
              <div className="absolute top-full right-0 mt-2 w-72 bg-[#11131C] border border-white/15 rounded-xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="text-xs font-semibold text-white mb-1.5 flex items-center justify-between">
                  <span>Save AI Analysis Snapshot</span>
                  <span className="text-[10px] font-mono text-zinc-500">{savedSnapshots.length} saved</span>
                </div>
                <p className="text-[11px] text-zinc-400 mb-2 leading-relaxed">
                  Store this UI page analysis, cognitive clarity scores, and gaze path into project history.
                </p>
                <input
                  type="text"
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="Optional note (e.g. Hero CTA variant B)..."
                  className="w-full bg-[#08090E] border border-white/15 focus:border-[#00E599] rounded p-2 text-xs text-zinc-200 placeholder-zinc-500 outline-none mb-2"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setShowNotesInput(false)}
                    className="px-2.5 py-1 rounded text-xs text-zinc-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveSnapshot}
                    className="px-3 py-1 rounded bg-[#00E599] text-[#08090E] text-xs font-semibold hover:bg-[#00E599]/90"
                  >
                    Save Snapshot
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Main In-App Interactive Web Workspace */}
      <div className="flex-1 relative flex items-center justify-center p-3 sm:p-6 overflow-hidden">
        {/* Device Viewport Stage Frame */}
        <div
          className="relative bg-[#0F172A] rounded-xl shadow-2xl border border-white/15 overflow-hidden flex flex-col transition-all duration-300"
          style={{
            width: viewport === 'mobile' ? '390px' : viewport === 'tablet' ? '768px' : '100%',
            maxWidth: viewport === 'desktop' ? '1440px' : undefined,
            height: viewport === 'mobile' ? '844px' : viewport === 'tablet' ? '100%' : '100%',
            maxHeight: '100%',
          }}
        >
          {/* Device Bezel Top Pill */}
          <div className="h-7 bg-[#1E293B] border-b border-white/10 px-3 flex items-center justify-between text-[11px] text-zinc-400 select-none">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500/80" />
              <span className="w-2 h-2 rounded-full bg-amber-500/80" />
              <span className="w-2 h-2 rounded-full bg-emerald-500/80" />
              <span className="text-[10px] font-mono text-zinc-400 ml-2 truncate max-w-[240px] sm:max-w-[320px]">
                {currentUrl}
              </span>
            </div>

            <div className="flex items-center gap-2 font-mono text-[10px] text-zinc-400">
              {/* Sub-view toggle between Interactive View and Live Iframe Embed */}
              {interactiveMode === 'browse' && (
                <div className="flex items-center bg-[#0F172A] rounded p-0.5 border border-white/10">
                  <button
                    onClick={() => setBrowseSubView('interactive')}
                    className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                      browseSubView === 'interactive'
                        ? 'bg-[#00E599] text-[#08090E] font-semibold'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                    title="Interactive high-fidelity website layout (works on all sites including Netlify/Cloudflare)"
                  >
                    Interactive View
                  </button>
                  <button
                    onClick={() => setBrowseSubView('live')}
                    className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                      browseSubView === 'live'
                        ? 'bg-[#00E599] text-[#08090E] font-semibold'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                    title="Live interactive iframe embed (may be blocked by X-Frame-Options on some sites)"
                  >
                    Live Embed
                  </button>
                </div>
              )}

              <span className="px-1.5 py-0.2 rounded bg-white/5 border border-white/10">
                {viewportDims.width} × {viewportDims.height}
              </span>

              {interactiveMode === 'browse' && (
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {browseSubView === 'interactive' ? 'Interactive UI' : isLocalBackend ? 'Live Proxy' : 'In-App Web'}
                </span>
              )}
            </div>
          </div>

          {/* Interactive Frame Body */}
          <div className="relative flex-1 w-full h-full overflow-hidden bg-[#0A0E1A]">
            {/* Live Interactive Iframe */}
            {browseSubView === 'live' && (
              <div className="relative w-full h-full flex flex-col">
                <div className="bg-amber-500/15 border-b border-amber-500/30 px-3 py-1.5 flex items-center justify-between text-[11px] text-amber-200 z-10 flex-shrink-0">
                  <div className="flex items-center gap-1.5 truncate mr-2">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-amber-400" />
                    <span className="truncate">
                      Website refused to connect? Netlify sets <code>X-Frame-Options: SAMEORIGIN</code> to block direct iframe embedding.
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setBrowseSubView('interactive')}
                      className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-semibold transition-colors"
                    >
                      Switch to Interactive View
                    </button>
                    <a
                      href={currentUrl.startsWith('http') ? currentUrl : `https://${currentUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-zinc-300 hover:text-white flex items-center gap-0.5"
                    >
                      <span>Open site</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
                <iframe
                  key={iframeKey}
                  ref={iframeRef}
                  src={activeIframeSrc}
                  title="Live Interactive Website"
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                  onLoad={() => setIsIframeLoaded(true)}
                  className="w-full flex-1 border-0 block"
                  style={{
                    pointerEvents: interactiveMode === 'browse' || interactiveMode === 'split' ? 'auto' : 'none',
                  }}
                />
              </div>
            )}

            {/* High-Fidelity Interactive View */}
            {(browseSubView === 'interactive' || interactiveMode === 'overlay' || interactiveMode === 'split') && (
              <div
                className={`absolute inset-0 overflow-auto ${
                  interactiveMode === 'browse' ? 'pointer-events-auto' : 'pointer-events-none'
                }`}
              >
                {imageElement ? (
                  <img
                    src={imageElement.src}
                    alt="Analyzed Page UI Layout"
                    className="w-full h-full object-cover select-none"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400 p-6 text-center">
                    <Loader2 className="w-8 h-8 text-[#00E599] animate-spin mb-3" />
                    <p className="text-sm font-semibold text-white">Synthesizing High-Fidelity UI Layout...</p>
                    <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                      Extracting DOM semantic tree, typography, and contrast matrices for {currentUrl}.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Saliency Attention Overlay Layer */}
            {interactiveMode === 'overlay' && imageElement && (
              <div
                className="absolute inset-0 pointer-events-none transition-opacity duration-200"
                style={{ opacity: heatmapOpacity }}
              >
                <img
                  src={imageElement.src}
                  alt="Saliency Heatmap Overlay"
                  className="w-full h-full object-cover mix-blend-multiply"
                />

                {/* Overlaid AOIs and Fixations SVG */}
                {analysisResult && (
                  <svg
                    className="absolute inset-0 w-full h-full"
                    viewBox={`0 0 ${imageElement.naturalWidth} ${imageElement.naturalHeight}`}
                  >
                    {/* AOI Bounding Boxes */}
                    {aois.map((aoi) => (
                      <g key={aoi.id}>
                        <rect
                          x={aoi.x}
                          y={aoi.y}
                          width={aoi.width}
                          height={aoi.height}
                          fill={`${aoi.color}25`}
                          stroke={aoi.color}
                          strokeWidth={2}
                          strokeDasharray="4 2"
                        />
                        <g transform={`translate(${aoi.x}, ${Math.max(0, aoi.y - 20)})`}>
                          <rect
                            x={0}
                            y={0}
                            width={Math.max(100, aoi.label.length * 7 + 40)}
                            height={18}
                            rx={3}
                            fill="#11131C"
                            stroke={aoi.color}
                            strokeWidth={1}
                          />
                          <text
                            x={5}
                            y={13}
                            fill="#FFFFFF"
                            fontFamily="monospace"
                            fontSize={9}
                            fontWeight="600"
                          >
                            {aoi.label} • {aoi.shareOfAttention}%
                          </text>
                        </g>
                      </g>
                    ))}

                    {/* First 5 Predicted Fixation Points */}
                    {analysisResult.fixations.slice(0, 5).map((f) => (
                      <g key={f.order} transform={`translate(${f.x}, ${f.y})`}>
                        <circle cx={0} cy={0} r={16} fill="rgba(0, 229, 153, 0.25)" />
                        <circle cx={0} cy={0} r={10} fill="#11131C" stroke="#00E599" strokeWidth={2} />
                        <text
                          textAnchor="middle"
                          dy=".35em"
                          fill="#00E599"
                          fontSize={10}
                          fontWeight="bold"
                          fontFamily="monospace"
                        >
                          {f.order}
                        </text>
                      </g>
                    ))}
                  </svg>
                )}
              </div>
            )}

            {/* Split Compare Mode: Live Website on left, Heatmap on right */}
            {interactiveMode === 'split' && imageElement && (
              <div
                className="absolute inset-y-0 right-0 pointer-events-none overflow-hidden border-l-2 border-[#00E599] shadow-2xl"
                style={{
                  width: `${100 - splitPos}%`,
                  background: '#08090E',
                }}
              >
                <div
                  className="absolute inset-y-0 right-0"
                  style={{
                    width: `${(100 / (100 - splitPos)) * 100}%`,
                    maxWidth: 'none',
                  }}
                >
                  <img
                    src={imageElement.src}
                    alt="Split Attention View"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}

            {/* Split Screen Draggable Divider */}
            {interactiveMode === 'split' && (
              <div
                className="absolute inset-y-0 cursor-ew-resize z-40 flex items-center justify-center"
                style={{ left: `calc(${splitPos}% - 12px)`, width: '24px' }}
                onMouseDown={(e) => {
                  const onMove = (moveEvt: MouseEvent) => {
                    const rect = iframeRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    const pct = Math.max(10, Math.min(90, ((moveEvt.clientX - rect.left) / rect.width) * 100));
                    setSplitPos(pct);
                  };
                  const onUp = () => {
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                  };
                  window.addEventListener('mousemove', onMove);
                  window.addEventListener('mouseup', onUp);
                }}
              >
                <div className="w-1 h-full bg-[#00E599] shadow-lg flex items-center justify-center">
                  <div className="w-6 h-6 rounded-full bg-[#00E599] text-[#08090E] flex items-center justify-center shadow-lg font-bold text-xs select-none">
                    ↔
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Floating Instruction Banner in Browse Mode */}
        {interactiveMode === 'browse' && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 bg-[#11131C]/95 backdrop-blur-md border border-white/15 px-4 py-2 rounded-full shadow-2xl flex items-center gap-3 text-xs font-mono text-zinc-300 max-w-[90vw] overflow-x-auto">
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold flex-shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Use Website Inside Tool
            </span>
            <span className="text-zinc-600 flex-shrink-0">•</span>
            <span className="text-zinc-400 truncate flex-shrink-0">
              {browseSubView === 'live'
                ? 'Live embed (site security policies like X-Frame-Options may restrict)'
                : 'Interactive responsive UI view • Click Analyze to evaluate'}
            </span>
            <span className="text-zinc-600 flex-shrink-0">•</span>
            <button
              onClick={handleTriggerAnalyze}
              disabled={isAnalyzing}
              className="px-2.5 py-1 rounded bg-[#00E599] text-[#08090E] font-bold hover:bg-[#00E599]/90 transition-colors flex items-center gap-1 flex-shrink-0"
            >
              <Sparkles className="w-3 h-3" />
              Analyze This Page
            </button>
          </div>
        )}

        {/* Floating Opacity Slider in Overlay Mode */}
        {interactiveMode === 'overlay' && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 bg-[#11131C]/95 backdrop-blur-md border border-white/15 px-4 py-2 rounded-full shadow-2xl flex items-center gap-3 text-xs font-mono text-zinc-300">
            <span className="text-zinc-400 flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-[#00E599]" />
              Heatmap Opacity:
            </span>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={heatmapOpacity}
              onChange={(e) => onChangeHeatmapOpacity(parseFloat(e.target.value))}
              className="w-24 accent-[#00E599]"
            />
            <span className="text-emerald-400 font-bold">{Math.round(heatmapOpacity * 100)}%</span>
            <span className="text-zinc-600">•</span>
            <button
              onClick={handleTriggerRepeat}
              className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white font-medium flex items-center gap-1 transition-colors"
              title="Repeat analysis on this page"
            >
              <RotateCw className="w-3 h-3 text-[#00E599]" />
              Repeat Analysis
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

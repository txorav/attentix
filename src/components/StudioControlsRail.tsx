import React, { useEffect, useState } from 'react';
import { ColormapTheme, LayerInspectorId, VisualMode, ViewingDuration } from '../types/studio';
import {
  Flame,
  Eye,
  Footprints,
  Columns,
  Image as ImageIcon,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  HelpCircle,
  Layers,
  ChevronDown,
} from 'lucide-react';

interface StudioControlsRailProps {
  visualMode: VisualMode;
  onChangeVisualMode: (mode: VisualMode) => void;
  activeLayer?: LayerInspectorId;
  onChangeActiveLayer?: (layer: LayerInspectorId) => void;
  colormapTheme: ColormapTheme;
  onChangeColormapTheme: (theme: ColormapTheme) => void;
  heatmapOpacity: number;
  onChangeHeatmapOpacity: (val: number) => void;
  fogThreshold: number;
  onChangeFogThreshold: (val: number) => void;
  splitPosition: number;
  onChangeSplitPosition: (val: number) => void;
  scrubberTimeSec: number;
  onChangeScrubberTimeSec: (val: number) => void;
  viewingDuration?: ViewingDuration;
  showScanpathOverlay?: boolean;
  onToggleScanpathOverlay?: (show: boolean) => void;
  showAoiOverlay?: boolean;
  onToggleAoiOverlay?: (show: boolean) => void;
  showContours?: boolean;
  onChangeShowContours?: (val: boolean) => void;
}

export const StudioControlsRail: React.FC<StudioControlsRailProps> = ({
  visualMode,
  onChangeVisualMode,
  activeLayer = 'none',
  onChangeActiveLayer,
  colormapTheme,
  onChangeColormapTheme,
  heatmapOpacity,
  onChangeHeatmapOpacity,
  fogThreshold,
  onChangeFogThreshold,
  splitPosition,
  onChangeSplitPosition,
  scrubberTimeSec,
  onChangeScrubberTimeSec,
  viewingDuration = '3s',
  showScanpathOverlay = true,
  onToggleScanpathOverlay,
  showAoiOverlay = true,
  onToggleAoiOverlay,
  showContours = true,
  onChangeShowContours,
}) => {
  const [isPlayingGaze, setIsPlayingGaze] = useState(false);

  const maxDurationSec = (() => {
    if (viewingDuration === '1s') return 1.0;
    if (viewingDuration === '3s') return 3.0;
    if (viewingDuration === '5s') return 5.0;
    if (viewingDuration === '7s') return 7.0;
    if (viewingDuration === '15s') return 15.0;
    if (viewingDuration === '30s') return 30.0;
    if (viewingDuration === '60s' || viewingDuration === '1m') return 60.0;
    return 5.0;
  })();

  // Gaze timeline playback loop
  useEffect(() => {
    let animId: number;
    let lastStamp: number | null = null;

    if (isPlayingGaze) {
      // Scale playback speed dynamically for long analyses (e.g. 60s plays at ~4x)
      const speedMult = maxDurationSec >= 30 ? 4.0 : maxDurationSec >= 15 ? 2.5 : 1.5;

      const step = (now: number) => {
        if (lastStamp !== null) {
          const delta = (now - lastStamp) / 1000;
          const nextVal = Math.min(maxDurationSec, scrubberTimeSec + delta * speedMult);
          onChangeScrubberTimeSec(nextVal);
          if (nextVal >= maxDurationSec) {
            setIsPlayingGaze(false);
            return;
          }
        }
        lastStamp = now;
        animId = requestAnimationFrame(step);
      };
      animId = requestAnimationFrame(step);
    }

    return () => cancelAnimationFrame(animId);
  }, [isPlayingGaze, scrubberTimeSec, maxDurationSec, onChangeScrubberTimeSec]);

  const layerOptions: { id: LayerInspectorId; label: string; desc: string }[] = [
    { id: 'none', label: 'All Signals (Fused Heatmap)', desc: 'Hero attention heatmap' },
    { id: 'learned', label: 'Learned Saliency (AI)', desc: 'MobileNetV3-ASPP Deep Neural Network' },
    { id: 'contrast', label: 'Contrast', desc: 'Itti-Koch & Gabor multi-scale center-surround' },
    { id: 'saturation', label: 'Saturation', desc: 'Chroma pop-out relative to local surround' },
    { id: 'rarity', label: 'Rarity', desc: '384-bin global CIE Lab* color uniqueness' },
    { id: 'cluster', label: 'Cluster', desc: 'Spatial cluster mass & CTA compactness' },
    { id: 'text', label: 'Text', desc: 'Typographic stroke reversal density' },
    { id: 'shape', label: 'Shape', desc: 'Sobel contour & 8-bin orientation entropy' },
    { id: 'faces', label: 'Faces', desc: 'Facial and skin-tone attention boost' },
  ];

  return (
    <div className="h-12 bg-[#11131C] border-b border-white/10 px-4 flex items-center justify-between select-none z-20 gap-3">
      {/* Product Feature Indicator & View Mode Selector */}
      <div className="flex items-center gap-3">
        {/* Exactly One Product Feature Tab */}
        <div className="flex items-center gap-2 pr-3 border-r border-white/10">
          <div className="w-6 h-6 rounded bg-[#00E599]/15 border border-[#00E599]/40 flex items-center justify-center">
            <Flame className="w-3.5 h-3.5 text-[#00E599]" />
          </div>
          <span className="font-semibold text-xs text-white tracking-wide">
            Attention Heatmap & Analysis
          </span>
        </div>

        {/* Hero View Toggles on the Canvas */}
        <div className="flex items-center gap-1 bg-[#08090E] p-1 rounded-lg border border-white/10 text-xs">
          <button
            onClick={() => {
              onChangeVisualMode('heatmap');
              if (onChangeActiveLayer) onChangeActiveLayer('none');
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
              visualMode === 'heatmap' && activeLayer === 'none'
                ? 'bg-[#00E599] text-[#08090E] font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Heatmap</span>
          </button>

          <button
            onClick={() => onChangeVisualMode('fog_of_war')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
              visualMode === 'fog_of_war'
                ? 'bg-[#00E599] text-[#08090E] font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>3s Fog-of-War</span>
          </button>

          <button
            onClick={() => onChangeVisualMode('split_ab')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
              visualMode === 'split_ab'
                ? 'bg-[#00E599] text-[#08090E] font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            <span>Split Compare</span>
          </button>

          <button
            onClick={() => onChangeVisualMode('original')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
              visualMode === 'original'
                ? 'bg-[#00E599] text-[#08090E] font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Original</span>
          </button>
        </div>

        {/* Canvas Overlay Toggles (Scanpath & AOIs as overlays, not separate screens) */}
        <div className="flex items-center gap-1 bg-[#08090E] p-1 rounded-lg border border-white/10 text-xs">
          {onToggleScanpathOverlay && (
            <button
              onClick={() => onToggleScanpathOverlay(!showScanpathOverlay)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                showScanpathOverlay
                  ? 'bg-[#00E599]/20 text-[#00E599] border border-[#00E599]/40 font-medium'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Toggle Gaze Scanpath Overlay on Heatmap"
            >
              <Footprints className="w-3.5 h-3.5" />
              <span>Gaze Scanpath</span>
            </button>
          )}

          {onToggleAoiOverlay && (
            <button
              onClick={() => onToggleAoiOverlay(!showAoiOverlay)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                showAoiOverlay
                  ? 'bg-[#00E599]/20 text-[#00E599] border border-[#00E599]/40 font-medium'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Toggle AOI Bounding Boxes Overlay on Heatmap"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>AOI Boxes</span>
            </button>
          )}
        </div>

        {/* "Why is it hot here?" Layer Inspector Selector */}
        {onChangeActiveLayer && (
          <div className="flex items-center gap-1.5 bg-[#08090E] px-2.5 py-1 rounded-lg border border-white/10 text-xs">
            <HelpCircle className="w-3.5 h-3.5 text-[#00E599]" />
            <span className="text-zinc-400 font-mono text-[11px] whitespace-nowrap">Why is it hot here?:</span>
            <select
              value={activeLayer}
              onChange={(e) => {
                const layer = e.target.value as LayerInspectorId;
                onChangeActiveLayer(layer);
                if (layer !== 'none') {
                  onChangeVisualMode('heatmap');
                }
              }}
              className="bg-[#11131C] text-[#00E599] font-medium border border-white/15 rounded px-2 py-0.5 text-xs focus:outline-none focus:border-[#00E599] cursor-pointer"
            >
              {layerOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Mode & Overlay Parameter Controls */}
      <div className="flex items-center gap-4 text-xs">
        {/* Gaze Timeline Scrubber (visible when scanpath overlay or scanpath is active) */}
        {showScanpathOverlay && (
          <div className="flex items-center gap-2 bg-[#08090E] px-2.5 py-1 rounded-md border border-white/10">
            <button
              onClick={() => {
                if (scrubberTimeSec >= maxDurationSec) onChangeScrubberTimeSec(0.0);
                setIsPlayingGaze(!isPlayingGaze);
              }}
              className="p-1 rounded text-[#00E599] hover:bg-white/10 transition-colors"
              title={isPlayingGaze ? 'Pause Gaze' : 'Play Gaze Progression'}
            >
              {isPlayingGaze ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={() => {
                setIsPlayingGaze(false);
                onChangeScrubberTimeSec(0.0);
              }}
              className="p-1 rounded text-zinc-400 hover:text-white transition-colors"
              title="Reset to 0s"
            >
              <RotateCcw className="w-3 h-3" />
            </button>

            <span className="text-zinc-500 font-mono text-[11px]">TIME:</span>
            <input
              type="range"
              min="0.0"
              max={maxDurationSec.toFixed(1)}
              step="0.1"
              value={Math.min(maxDurationSec, scrubberTimeSec)}
              onChange={(e) => {
                setIsPlayingGaze(false);
                onChangeScrubberTimeSec(parseFloat(e.target.value));
              }}
              className="w-24 accent-[#00E599] cursor-pointer"
            />
            <span className="text-[#00E599] font-mono font-semibold text-[11px] w-10">
              {Math.min(maxDurationSec, scrubberTimeSec).toFixed(1)}s
            </span>
          </div>
        )}

        {/* Heatmap Colormap & Opacity Controls */}
        {visualMode === 'heatmap' && (
          <div className="flex items-center gap-3">
            {/* Colormap LUT Palette */}
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500 font-mono text-[11px]">LUT:</span>
              <div className="flex items-center rounded bg-[#08090E] p-0.5 border border-white/10">
                {(['thermal', 'turbo', 'inferno', 'viridis'] as ColormapTheme[]).map((theme) => (
                  <button
                    key={theme}
                    onClick={() => onChangeColormapTheme(theme)}
                    className={`px-2 py-0.5 rounded capitalize ${
                      colormapTheme === theme
                        ? 'bg-[#00E599] text-[#08090E] font-medium'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {theme}
                  </button>
                ))}
              </div>
            </div>

            {/* Isotherm Contour Lines Control */}
            {onChangeShowContours && (
              <label className="flex items-center gap-1.5 cursor-pointer text-zinc-400 hover:text-white select-none px-2 py-1 bg-[#08090E] rounded border border-white/10">
                <input
                  type="checkbox"
                  checked={showContours}
                  onChange={(e) => onChangeShowContours(e.target.checked)}
                  className="rounded border-white/20 bg-black/40 text-[#00E599] focus:ring-0 cursor-pointer w-3.5 h-3.5"
                />
                <span className="font-mono text-[11px]">ISOTHERMS</span>
              </label>
            )}

            {/* Opacity Slider */}
            <div className="flex items-center gap-2">
              <span className="text-zinc-500 font-mono text-[11px]">OPACITY:</span>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={heatmapOpacity}
                onChange={(e) => onChangeHeatmapOpacity(parseFloat(e.target.value))}
                className="w-16 accent-[#00E599] cursor-pointer"
              />
              <span className="text-zinc-300 font-mono text-[11px] w-7">
                {Math.round(heatmapOpacity * 100)}%
              </span>
            </div>
          </div>
        )}

        {visualMode === 'fog_of_war' && (
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 font-mono text-[11px]">FOG THRESHOLD:</span>
            <input
              type="range"
              min="0.05"
              max="0.8"
              step="0.05"
              value={fogThreshold}
              onChange={(e) => onChangeFogThreshold(parseFloat(e.target.value))}
              className="w-24 accent-[#00E599] cursor-pointer"
            />
            <span className="text-zinc-300 font-mono text-[11px] w-9">
              {Math.round(fogThreshold * 100)}%
            </span>
          </div>
        )}

        {visualMode === 'split_ab' && (
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 font-mono text-[11px]">WIPE POSITION:</span>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.01"
              value={splitPosition}
              onChange={(e) => onChangeSplitPosition(parseFloat(e.target.value))}
              className="w-24 accent-[#00E599] cursor-pointer"
            />
            <span className="text-zinc-300 font-mono text-[11px] w-9">
              {Math.round(splitPosition * 100)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

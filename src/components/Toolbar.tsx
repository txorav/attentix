import React from 'react';
import {
  Flame,
  Focus,
  Activity,
  Image as ImageIcon,
  Play,
  RotateCcw,
  SquareDashedMousePointer,
  Maximize2,
  Crosshair,
  Split,
  Eye,
} from 'lucide-react';
import { Slider } from './ui/slider';
import { Separator } from './ui/separator';
import { RenderMode, ColorLUT, ColorBlindnessMode } from '../core/types';

interface ToolbarProps {
  renderMode: RenderMode;
  onSelectRenderMode: (mode: RenderMode) => void;
  colorLUT: ColorLUT;
  onSelectColorLUT: (lut: ColorLUT) => void;
  opacity: number;
  onChangeOpacity: (val: number) => void;
  threshold: number;
  onChangeThreshold: (val: number) => void;
  exposureDuration: '3s' | '7s';
  onChangeExposureDuration: (dur: '3s' | '7s') => void;
  thumbnailSimulator: boolean;
  onToggleThumbnailSimulator: () => void;
  showScanpath: boolean;
  onToggleScanpath: () => void;
  showAOIs: boolean;
  onToggleAOIs: () => void;
  isDrawingAOI: boolean;
  onToggleDrawAOI: () => void;
  isPlayingScanpath: boolean;
  onPlayScanpath: () => void;
  onResetScanpath: () => void;
  isInspectMode: boolean;
  onToggleInspectMode: () => void;
  splitActive: boolean;
  onToggleSplitActive: () => void;
  colorBlindness: ColorBlindnessMode;
  onSelectColorBlindness: (cb: ColorBlindnessMode) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  renderMode,
  onSelectRenderMode,
  colorLUT,
  onSelectColorLUT,
  opacity,
  onChangeOpacity,
  threshold,
  onChangeThreshold,
  exposureDuration,
  onChangeExposureDuration,
  thumbnailSimulator,
  onToggleThumbnailSimulator,
  showScanpath,
  onToggleScanpath,
  showAOIs,
  onToggleAOIs,
  isDrawingAOI,
  onToggleDrawAOI,
  isPlayingScanpath,
  onPlayScanpath,
  onResetScanpath,
  isInspectMode,
  onToggleInspectMode,
  splitActive,
  onToggleSplitActive,
  colorBlindness,
  onSelectColorBlindness,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between border-b border-border bg-card/40 px-4 py-2 gap-3 text-xs">
      {/* 1. Main View Mode Tools */}
      <div className="flex items-center gap-2">
        {/* Inspection Tool Toggle */}
        <button
          onClick={onToggleInspectMode}
          className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium border transition-colors ${
            isInspectMode
              ? 'border-foreground bg-primary text-primary-foreground'
              : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
          title="Inspect Tool: Hover over image to view exact saliency density and zone percentile"
        >
          <Crosshair className="h-3.5 w-3.5" />
          <span>Inspect</span>
        </button>

        <Separator orientation="vertical" className="h-4" />

        {/* View Mode Segmented Controls */}
        <div className="inline-flex h-8 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
          <button
            onClick={() => onSelectRenderMode('heatmap')}
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium ring-offset-background transition-all ${
              renderMode === 'heatmap'
                ? 'bg-background text-foreground shadow-xs'
                : 'hover:text-foreground'
            }`}
          >
            <Flame className="mr-1.5 h-3.5 w-3.5" />
            Heatmap
          </button>
          <button
            onClick={() => onSelectRenderMode('peek')}
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium ring-offset-background transition-all ${
              renderMode === 'peek'
                ? 'bg-background text-foreground shadow-xs'
                : 'hover:text-foreground'
            }`}
            title="3-Second Glance Survival Test (85% Darkened Spotlight)"
          >
            <Focus className="mr-1.5 h-3.5 w-3.5" />
            Spotlight
          </button>
          <button
            onClick={() => onSelectRenderMode('isolines')}
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium ring-offset-background transition-all ${
              renderMode === 'isolines'
                ? 'bg-background text-foreground shadow-xs'
                : 'hover:text-foreground'
            }`}
          >
            <Activity className="mr-1.5 h-3.5 w-3.5" />
            Isolines
          </button>
          <button
            onClick={() => onSelectRenderMode('original')}
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium ring-offset-background transition-all ${
              renderMode === 'original'
                ? 'bg-background text-foreground shadow-xs'
                : 'hover:text-foreground'
            }`}
          >
            <ImageIcon className="mr-1.5 h-3.5 w-3.5" />
            Original
          </button>
        </div>

        {/* Split Compare Curtain Toggle */}
        <button
          onClick={onToggleSplitActive}
          className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium border transition-colors ${
            splitActive
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
          title="Split-Screen Compare: Drag divider curtain to compare original with attention heatmap"
        >
          <Split className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Split Compare</span>
        </button>

        {/* Color Ramp Palette */}
        {renderMode !== 'original' && (
          <div className="hidden lg:inline-flex h-8 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
            {(['jet', 'inferno', 'turbo', 'viridis'] as ColorLUT[]).map((lut) => (
              <button
                key={lut}
                onClick={() => onSelectColorLUT(lut)}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium uppercase tracking-wider transition-all ${
                  colorLUT === lut
                    ? 'bg-background text-foreground shadow-xs'
                    : 'hover:text-foreground'
                }`}
              >
                {lut}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. Sliders */}
      {renderMode !== 'original' && (
        <div className="hidden 2xl:flex items-center gap-5">
          <div className="flex items-center gap-2.5 w-32">
            <span className="text-[11px] text-muted-foreground">Alpha</span>
            <Slider
              value={[opacity]}
              min={0.1}
              max={1.0}
              step={0.05}
              onValueChange={([val]) => onChangeOpacity(val)}
            />
            <span className="font-mono text-[11px] text-muted-foreground w-6 text-right">
              {Math.round(opacity * 100)}%
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-32">
            <span className="text-[11px] text-muted-foreground">Cutoff</span>
            <Slider
              value={[threshold]}
              min={0.0}
              max={0.35}
              step={0.02}
              onValueChange={([val]) => onChangeThreshold(val)}
            />
            <span className="font-mono text-[11px] text-muted-foreground w-6 text-right">
              {threshold.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* 3. Duration & Accessibility Tools */}
      <div className="flex items-center gap-2">
        {/* Color Blindness Accessibility Selector */}
        <div className="hidden sm:inline-flex items-center">
          <select
            value={colorBlindness}
            onChange={(e) => onSelectColorBlindness(e.target.value as ColorBlindnessMode)}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs text-muted-foreground hover:text-foreground focus:outline-none"
            title="Color Vision Deficiency (CVD) Simulation"
          >
            <option value="none">Standard Vision</option>
            <option value="deuteranopia">Deuteranopia (Green-Blind)</option>
            <option value="protanopia">Protanopia (Red-Blind)</option>
            <option value="tritanopia">Tritanopia (Blue-Blind)</option>
          </select>
        </div>

        {/* 3s vs 7s Softmax Duration */}
        <div className="inline-flex h-8 items-center rounded-lg bg-muted p-1 text-muted-foreground">
          <button
            onClick={() => onChangeExposureDuration('3s')}
            className={`rounded-md px-2.5 py-0.5 text-xs font-medium transition-all ${
              exposureDuration === '3s'
                ? 'bg-background text-foreground shadow-xs'
                : 'hover:text-foreground'
            }`}
          >
            3s
          </button>
          <button
            onClick={() => onChangeExposureDuration('7s')}
            className={`rounded-md px-2.5 py-0.5 text-xs font-medium transition-all ${
              exposureDuration === '7s'
                ? 'bg-background text-foreground shadow-xs'
                : 'hover:text-foreground'
            }`}
          >
            7s
          </button>
        </div>

        {/* 160px Thumbnail Simulator */}
        <button
          onClick={onToggleThumbnailSimulator}
          className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium border transition-colors ${
            thumbnailSimulator
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
          title="Amazon/YouTube 160px Thumbnail Acuity Simulator"
        >
          <Maximize2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">160px Acuity</span>
        </button>

        {/* Scanpath Saccade Simulation */}
        <div className="inline-flex h-8 items-center rounded-md border border-border bg-background px-1">
          <button
            onClick={onToggleScanpath}
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              showScanpath ? 'text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Scanpath
          </button>
          {showScanpath && (
            <button
              onClick={isPlayingScanpath ? onResetScanpath : onPlayScanpath}
              className="p-1 text-primary hover:text-primary/80 transition-colors"
              title={isPlayingScanpath ? 'Pause / Reset' : 'Play Saccade Simulation'}
            >
              {isPlayingScanpath ? (
                <RotateCcw className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5 fill-current" />
              )}
            </button>
          )}
        </div>

        {/* AOI Bounding Boxes */}
        <div className="inline-flex h-8 items-center rounded-md border border-border bg-background px-1 gap-1">
          <button
            onClick={onToggleAOIs}
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              showAOIs ? 'text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            AOIs
          </button>
          <button
            onClick={onToggleDrawAOI}
            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-colors ${
              isDrawingAOI
                ? 'bg-emerald-500 text-white'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <SquareDashedMousePointer className="h-3 w-3" />
            <span>{isDrawingAOI ? 'Drawing' : 'Draw'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

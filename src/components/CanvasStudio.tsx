import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AnalysisResult, ColorLUT, RenderMode, ScanpathFixation, AOIItem, ColorBlindnessMode } from '../core/types';
import { WebGL2Visualizer } from '../core/webglRenderer';
import { Badge } from './ui/badge';
import { ZoomIn, ZoomOut, RotateCcw, Crosshair, Split, Maximize2 } from 'lucide-react';

import { getPercentileRank } from '../core/metricsCalculator';

interface CanvasStudioProps {
  imageElement: HTMLImageElement | null;
  analysisResult: AnalysisResult | null;
  renderMode: RenderMode;
  colorLUT: ColorLUT;
  opacity: number;
  threshold: number;
  splitActive: boolean;
  splitPosition: number;
  onSplitPositionChange: (pos: number) => void;
  colorBlindness: ColorBlindnessMode;
  isInspectMode: boolean;
  showScanpath: boolean;
  showAOIs: boolean;
  isDrawingAOI: boolean;
  onFinishDrawingAOI: (bbox: [number, number, number, number], label: string) => void;
  thumbnailSimulator: boolean;
  isPlayingScanpath: boolean;
  onScanpathAnimationEnd?: () => void;
  onOpenUploadModal: () => void;
}

export const CanvasStudio: React.FC<CanvasStudioProps> = ({
  imageElement,
  analysisResult,
  renderMode,
  colorLUT,
  opacity,
  threshold,
  splitActive,
  splitPosition,
  onSplitPositionChange,
  colorBlindness,
  isInspectMode,
  showScanpath,
  showAOIs,
  isDrawingAOI,
  onFinishDrawingAOI,
  thumbnailSimulator,
  isPlayingScanpath,
  onScanpathAnimationEnd,
  onOpenUploadModal,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const glCanvasRef = useRef<HTMLCanvasElement>(null);
  const visualizerRef = useRef<WebGL2Visualizer | null>(null);

  const [animatedStep, setAnimatedStep] = useState<number>(100);

  // Drawing state
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [currentDrag, setCurrentDrag] = useState<{ x: number; y: number } | null>(null);

  // Split-screen drag state
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);

  // Zoom / Pan state
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);
  const [initialPan, setInitialPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // WebGL support state
  const [isWebGL, setIsWebGL] = useState<boolean>(true);

  // Sorted saliency grid for true empirical quantile ranking
  const [sortedGrid, setSortedGrid] = useState<Float32Array | null>(null);

  // Cursor Inspection HUD state
  const [hoverCoord, setHoverCoord] = useState<{ x: number; y: number; normX: number; normY: number } | null>(null);
  const [inspectData, setInspectData] = useState<{ saliency: number; percentile: string } | null>(null);

  // Initialize WebGL Visualizer
  useEffect(() => {
    if (!glCanvasRef.current) return;
    const viz = new WebGL2Visualizer(glCanvasRef.current);
    visualizerRef.current = viz;
    setIsWebGL(viz.isWebGLSupported);

    viz.onContextChange = (active) => {
      setIsWebGL(active);
    };

    return () => {
      visualizerRef.current?.destroy();
      visualizerRef.current = null;
    };
  }, []);

  // Compute sorted copy of saliency grid whenever analysisResult changes
  useEffect(() => {
    if (analysisResult?.saliency_grid) {
      const copy = new Float32Array(analysisResult.saliency_grid);
      copy.sort();
      setSortedGrid(copy);
    } else {
      setSortedGrid(null);
    }
  }, [analysisResult]);

  // Upload image and saliency grid whenever they change
  useEffect(() => {
    if (!visualizerRef.current || !imageElement || !glCanvasRef.current) return;

    const canvas = glCanvasRef.current;
    const naturalW = imageElement.naturalWidth || 800;
    const naturalH = imageElement.naturalHeight || 600;

    canvas.width = naturalW;
    canvas.height = naturalH;

    visualizerRef.current.uploadImage(imageElement);

    if (analysisResult) {
      visualizerRef.current.uploadSaliencyGrid(
        analysisResult.saliency_grid,
        analysisResult.grid_width,
        analysisResult.grid_height,
        analysisResult.quantiles
      );
    }

    visualizerRef.current.render(
      renderMode,
      colorLUT,
      opacity,
      threshold,
      splitActive,
      splitPosition,
      colorBlindness
    );
  }, [imageElement, analysisResult]);

  // Re-render WebGL whenever settings change
  useEffect(() => {
    if (visualizerRef.current && analysisResult) {
      visualizerRef.current.render(
        renderMode,
        colorLUT,
        opacity,
        threshold,
        splitActive,
        splitPosition,
        colorBlindness
      );
    }
  }, [renderMode, colorLUT, opacity, threshold, splitActive, splitPosition, colorBlindness, analysisResult]);

  // Keyboard navigation & accessibility controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDragStart(null);
        setCurrentDrag(null);
        setIsDraggingSplit(false);
        setIsPanning(false);
      } else if (e.key === '+' || e.key === '=') {
        setZoom((z) => Math.min(3.0, z + 0.15));
      } else if (e.key === '-') {
        setZoom((z) => Math.max(0.4, z - 0.15));
      } else if (e.key === '0') {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Scanpath playback animation
  useEffect(() => {
    if (!isPlayingScanpath || !analysisResult) {
      setAnimatedStep(100);
      return;
    }

    const totalSteps = analysisResult.scanpath.length;
    let current = 1;
    setAnimatedStep(1);

    const interval = setInterval(() => {
      current++;
      if (current > totalSteps) {
        clearInterval(interval);
        setAnimatedStep(totalSteps);
        onScanpathAnimationEnd?.();
      } else {
        setAnimatedStep(current);
      }
    }, 600);

    return () => clearInterval(interval);
  }, [isPlayingScanpath, analysisResult, onScanpathAnimationEnd]);

  // Wheel zoom handler
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((z) => Math.min(3.0, Math.max(0.4, Number((z * factor).toFixed(2)))));
  };

  // Pointer handlers for Drawing & Split-Dragging & Panning & Hover Inspection
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!glCanvasRef.current) return;
    const rect = glCanvasRef.current.getBoundingClientRect();
    const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const normY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    // Check if clicking near the split curtain divider (within 3% width)
    if (splitActive && Math.abs(normX - splitPosition) < 0.03) {
      setIsDraggingSplit(true);
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (isDrawingAOI) {
      setDragStart({ x: normX, y: normY });
      setCurrentDrag({ x: normX, y: normY });
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    // Panning when zoom > 1 or middle click or space/shift held
    if (e.button === 1 || zoom > 1 || e.shiftKey) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      setInitialPan(pan);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPanning && panStart) {
      const dx = (e.clientX - panStart.x) / zoom;
      const dy = (e.clientY - panStart.y) / zoom;
      setPan({ x: Math.round(initialPan.x + dx), y: Math.round(initialPan.y + dy) });
      return;
    }

    if (!glCanvasRef.current) return;
    const rect = glCanvasRef.current.getBoundingClientRect();
    const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const normY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    if (isDraggingSplit) {
      onSplitPositionChange(normX);
      return;
    }

    if (isDrawingAOI && dragStart) {
      setCurrentDrag({ x: normX, y: normY });
      return;
    }

    // Inspect HUD calculations using data-driven true percentiles
    if (isInspectMode && analysisResult && sortedGrid) {
      const gx = Math.floor(normX * analysisResult.grid_width);
      const gy = Math.floor(normY * analysisResult.grid_height);
      const idx = gy * analysisResult.grid_width + gx;
      const salVal = analysisResult.saliency_grid[idx] || 0;

      // Data-driven empirical percentile rank
      const rank = getPercentileRank(salVal, sortedGrid);
      const topPct = (100 - rank).toFixed(1);
      const maxVal = analysisResult.quantiles?.max || 0.00008;
      const normSal = Math.min(100, Math.round((salVal / maxVal) * 100));

      let zoneLabel = `Baseline (${rank.toFixed(0)}th percentile)`;
      if (rank >= 95) zoneLabel = `Top ${topPct}% Peak Hotspot`;
      else if (rank >= 75) zoneLabel = `Top ${topPct}% High Saliency`;
      else if (rank >= 50) zoneLabel = `Top ${topPct}% Above Average`;

      setHoverCoord({
        x: e.clientX,
        y: e.clientY,
        normX,
        normY,
      });

      setInspectData({
        saliency: normSal,
        percentile: zoneLabel,
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPanning) {
      setIsPanning(false);
      setPanStart(null);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      return;
    }

    if (isDraggingSplit) {
      setIsDraggingSplit(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      return;
    }

    if (isDrawingAOI && dragStart && currentDrag) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      const x1 = Math.min(dragStart.x, currentDrag.x);
      const x2 = Math.max(dragStart.x, currentDrag.x);
      const y1 = Math.min(dragStart.y, currentDrag.y);
      const y2 = Math.max(dragStart.y, currentDrag.y);

      if (x2 - x1 > 0.02 && y2 - y1 > 0.02) {
        const defaultLabel = `AOI Focus ${(analysisResult?.custom_aois.length || 0) + 1}`;
        onFinishDrawingAOI([x1, y1, x2, y2], defaultLabel);
      }
      setDragStart(null);
      setCurrentDrag(null);
    }
  };

  const handleMouseLeave = () => {
    setHoverCoord(null);
    setIsDraggingSplit(false);
  };

  const allAOIs = [
    ...(analysisResult?.auto_detected_aois || []),
    ...(analysisResult?.custom_aois || []),
  ];

  const visibleFixations = analysisResult?.scanpath.slice(0, animatedStep) || [];

  return (
    <div
      ref={containerRef}
      className="relative flex-1 bg-neutral-950/90 flex items-center justify-center overflow-hidden select-none p-4"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handleMouseLeave}
      onWheel={handleWheel}
      style={{
        cursor: isDraggingSplit
          ? 'ew-resize'
          : isDrawingAOI
          ? 'crosshair'
          : isPanning
          ? 'grabbing'
          : isInspectMode
          ? 'crosshair'
          : zoom > 1
          ? 'grab'
          : 'default',
        touchAction: 'none',
      }}
    >
      {/* Precision Studio Engineering Grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#26262615_1px,transparent_1px),linear-gradient(to_bottom,#26262615_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

      {/* Rendering Engine Fallback Indicator */}
      {!isWebGL && (
        <div className="absolute top-3 left-3 z-40">
          <Badge variant="outline" className="text-[10px] font-mono border-amber-500/40 text-amber-400 bg-amber-950/40">
            Rendering: 2D Canvas Fallback (WebGL2 Unavailable)
          </Badge>
        </div>
      )}

      {/* When no asset is loaded, show empty studio state */}
      {!imageElement && (
        <div className="flex flex-col items-center justify-center text-center p-8 border border-dashed border-border rounded-xl bg-card/40 max-w-md">
          <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground mb-3">
            <Crosshair className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Studio Canvas Ready</h3>
          <p className="text-xs text-muted-foreground mt-1 mb-4 leading-relaxed">
            Upload your design, ad creative, or packaging asset to generate predictive eye-tracking saliency maps.
          </p>
          <button
            onClick={onOpenUploadModal}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shadow-sm"
          >
            Load Asset & Metadata
          </button>
        </div>
      )}

      {/* Main Canvas Container */}
      {imageElement && (
        <div
          className="relative transition-transform duration-100 ease-out shadow-2xl rounded-md overflow-hidden border border-border"
          style={{
            transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
            maxWidth: thumbnailSimulator ? '160px' : '94%',
            maxHeight: thumbnailSimulator ? '160px' : '82vh',
          }}
        >
          {/* WebGL2 Canvas */}
          <canvas
            id="attentix-viewport-canvas"
            ref={glCanvasRef}
            className="block w-full h-auto object-contain max-h-[82vh]"
          />

          {/* SVG Vector Layer for Scanpaths, Fixations, and AOIs */}
          {analysisResult && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox={`0 0 ${analysisResult.dimensions.width} ${analysisResult.dimensions.height}`}
              preserveAspectRatio="none"
            >
              <defs>
                <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Saccadic Trajectory Bézier Curves */}
              {showScanpath && visibleFixations.length > 1 && (
                <g>
                  {visibleFixations.map((fix, idx) => {
                    if (idx === 0) return null;
                    const prev = visibleFixations[idx - 1];
                    const x1 = prev.x_norm * analysisResult.dimensions.width;
                    const y1 = prev.y_norm * analysisResult.dimensions.height;
                    const x2 = fix.x_norm * analysisResult.dimensions.width;
                    const y2 = fix.y_norm * analysisResult.dimensions.height;

                    const cx = (x1 + x2) / 2 + (y2 - y1) * 0.12;
                    const cy = (y1 + y2) / 2 - (x2 - x1) * 0.12;

                    return (
                      <g key={`saccade-${idx}`}>
                        <path
                          d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth="2"
                          strokeDasharray="4 3"
                          strokeOpacity="0.85"
                        />
                      </g>
                    );
                  })}
                </g>
              )}

              {/* Numbered Fixation Disks */}
              {showScanpath &&
                visibleFixations.map((fix) => {
                  const cx = fix.x_norm * analysisResult.dimensions.width;
                  const cy = fix.y_norm * analysisResult.dimensions.height;
                  const radius = Math.max(14, Math.min(30, fix.dwell_time_ms * 0.065));
                  const isCurrent = fix.order === visibleFixations.length;

                  return (
                    <g key={`fixation-${fix.order}`}>
                      {isCurrent && isPlayingScanpath && (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={radius * 1.4}
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth="1.5"
                          className="animate-ping"
                        />
                      )}
                      <circle cx={cx} cy={cy} r={radius} fill="#09090b" opacity="0.75" />
                      <circle
                        cx={cx}
                        cy={cy}
                        r={radius - 2}
                        fill={fix.order === 1 ? '#ef4444' : '#18181b'}
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                      <text
                        x={cx}
                        y={cy + 4}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontFamily="system-ui, sans-serif"
                        fontWeight="700"
                        fontSize={Math.max(11, radius * 0.7)}
                      >
                        {fix.order}
                      </text>
                    </g>
                  );
                })}

              {/* AOI Bounding Boxes */}
              {showAOIs &&
                allAOIs.map((aoi) => {
                  const [nx1, ny1, nx2, ny2] = aoi.bbox_norm;
                  const x = nx1 * analysisResult.dimensions.width;
                  const y = ny1 * analysisResult.dimensions.height;
                  const w = (nx2 - nx1) * analysisResult.dimensions.width;
                  const h = (ny2 - ny1) * analysisResult.dimensions.height;
                  const color = aoi.color || '#10b981';

                  return (
                    <g key={aoi.id}>
                      <rect
                        x={x}
                        y={y}
                        width={w}
                        height={h}
                        fill={color}
                        fillOpacity="0.10"
                        stroke={color}
                        strokeWidth="1.5"
                        strokeDasharray="4 2"
                        rx="3"
                      />
                      <g transform={`translate(${x}, ${Math.max(20, y - 4)})`}>
                        <rect
                          x="0"
                          y="-16"
                          width={Math.min(w, 220)}
                          height="18"
                          rx="2"
                          fill="#09090b"
                          stroke={color}
                          strokeWidth="1"
                        />
                        <text
                          x="5"
                          y="-3"
                          fill="#ffffff"
                          fontFamily="system-ui, sans-serif"
                          fontSize="10"
                          fontWeight="600"
                        >
                          {aoi.label.length > 20 ? `${aoi.label.slice(0, 20)}...` : aoi.label} ({aoi.attention_share_pct}%)
                        </text>
                      </g>
                    </g>
                  );
                })}

              {/* Dragging New AOI Bounding Box */}
              {isDrawingAOI && dragStart && currentDrag && (
                <g>
                  <rect
                    x={Math.min(dragStart.x, currentDrag.x) * analysisResult.dimensions.width}
                    y={Math.min(dragStart.y, currentDrag.y) * analysisResult.dimensions.height}
                    width={Math.abs(currentDrag.x - dragStart.x) * analysisResult.dimensions.width}
                    height={Math.abs(currentDrag.y - dragStart.y) * analysisResult.dimensions.height}
                    fill="#38bdf8"
                    fillOpacity="0.2"
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                    strokeDasharray="4 2"
                  />
                </g>
              )}
            </svg>
          )}

          {/* Split Screen Slider Visual Handle Bar */}
          {splitActive && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white cursor-ew-resize pointer-events-none"
              style={{ left: `${splitPosition * 100}%` }}
            >
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-neutral-900 border border-border flex items-center justify-center text-white shadow-lg pointer-events-auto cursor-ew-resize">
                <Split className="h-3 w-3" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating Cursor Inspection Tooltip HUD */}
      {isInspectMode && hoverCoord && inspectData && (
        <div
          className="fixed pointer-events-none z-50 bg-neutral-900/95 border border-border p-2.5 rounded shadow-xl text-xs space-y-1 backdrop-blur"
          style={{
            left: `${hoverCoord.x + 14}px`,
            top: `${hoverCoord.y + 14}px`,
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Attention Density:</span>
            <span className="font-mono font-bold text-foreground">{inspectData.saliency}%</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-[11px]">
            <span className="text-muted-foreground">Zone:</span>
            <span className="text-sky-400 font-medium">{inspectData.percentile}</span>
          </div>
          <div className="text-[10px] font-mono text-muted-foreground pt-0.5 border-t border-border/60">
            Coord: [{(hoverCoord.normX * 100).toFixed(1)}%, {(hoverCoord.normY * 100).toFixed(1)}%]
          </div>
        </div>
      )}

      {/* Viewport Zoom / Reset Controls */}
      {imageElement && (
        <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-card/90 backdrop-blur p-1 rounded-md border border-border shadow-md">
          <button
            onClick={() => setZoom((z) => Math.min(3.0, z + 0.15))}
            className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}
            className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
            title="Reset View (100%)"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
          <button
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
            title="Fit to Screen"
          >
            <Maximize2 className="h-3 w-3" />
          </button>
          <span className="text-[10px] font-mono text-muted-foreground px-1.5">
            {Math.round(zoom * 100)}%
          </span>
        </div>
      )}
    </div>
  );
};

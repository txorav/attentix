import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  AOIRegion,
  ColormapTheme,
  FixationPoint,
  LayerInspectorId,
  SaliencyTensorResult,
  VisualMode,
} from '../types/studio';
import { renderAttentionHeatmapRGBA } from '../engine/saliency-core';
import { calculateAOIMetrics } from '../engine/aoi-calculator';
import {
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  MousePointer,
  Square,
  Hand,
  Trash2,
  Footprints,
  Layers,
  HelpCircle,
} from 'lucide-react';

interface StudioCanvasProps {
  imageElement: HTMLImageElement | null;
  analysisResult: SaliencyTensorResult | null;
  visualMode: VisualMode;
  activeLayer?: LayerInspectorId;
  onChangeActiveLayer?: (layer: LayerInspectorId) => void;
  colormapTheme: ColormapTheme;
  heatmapOpacity: number;
  fogThreshold: number;
  splitPosition: number;
  scrubberTimeSec: number;
  aois: AOIRegion[];
  onUpdateAOIs: (aois: AOIRegion[]) => void;
  selectedAoiId: string | null;
  onSelectAoi: (id: string | null) => void;
  secondaryImageElement?: HTMLImageElement | null;
  showContours?: boolean;
  darkenBase?: number;
  onChangeVisualMode?: (mode: VisualMode) => void;
  showScanpathOverlay?: boolean;
  onToggleScanpathOverlay?: (show: boolean) => void;
  showAoiOverlay?: boolean;
  onToggleAoiOverlay?: (show: boolean) => void;
}

type CanvasTool = 'select' | 'draw_aoi' | 'pan';

export const StudioCanvas: React.FC<StudioCanvasProps> = ({
  imageElement,
  analysisResult,
  visualMode = 'heatmap',
  activeLayer = 'none',
  onChangeActiveLayer,
  colormapTheme = 'turbo',
  heatmapOpacity = 0.8,
  fogThreshold = 0.35,
  splitPosition = 0.5,
  scrubberTimeSec = 5.0,
  aois,
  onUpdateAOIs,
  selectedAoiId,
  onSelectAoi,
  secondaryImageElement,
  showContours = true,
  darkenBase = 0.38,
  onChangeVisualMode,
  showScanpathOverlay: propShowScanpathOverlay,
  onToggleScanpathOverlay,
  showAoiOverlay: propShowAoiOverlay,
  onToggleAoiOverlay,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Viewport transforms
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [activeTool, setActiveTool] = useState<CanvasTool>('select');

  // Layer Overlay Toggles (local fallback if parent doesn't control)
  const [localShowScanpath, setLocalShowScanpath] = useState<boolean>(true);
  const [localShowAoi, setLocalShowAoi] = useState<boolean>(true);

  const showScanpathOverlay = propShowScanpathOverlay ?? localShowScanpath;
  const showAoiOverlay = propShowAoiOverlay ?? localShowAoi;

  const handleToggleScanpath = (val: boolean) => {
    if (onToggleScanpathOverlay) onToggleScanpathOverlay(val);
    else setLocalShowScanpath(val);
  };

  const handleToggleAoi = (val: boolean) => {
    if (onToggleAoiOverlay) onToggleAoiOverlay(val);
    else setLocalShowAoi(val);
  };

  // Dragging & Interaction states
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // AOI Creation / Resizing state
  const [drawingBox, setDrawingBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  const [draggingAoi, setDraggingAoi] = useState<{
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  // Cursor Inspection HUD
  const [cursorPos, setCursorPos] = useState<{
    x: number;
    y: number;
    attentionPct: number;
  } | null>(null);

  // Fit to screen helper
  const handleFitToScreen = useCallback(() => {
    if (!containerRef.current || !imageElement) return;
    const rect = containerRef.current.getBoundingClientRect();
    const padding = 48;
    const availW = rect.width - padding;
    const availH = rect.height - padding;

    const scale = Math.min(availW / imageElement.naturalWidth, availH / imageElement.naturalHeight, 1.0);
    setZoom(Number(Math.max(0.2, scale).toFixed(2)));
    setPan({ x: 0, y: 0 });
  }, [imageElement]);

  useEffect(() => {
    if (imageElement) {
      handleFitToScreen();
    }
  }, [imageElement, handleFitToScreen]);

  // Main Render Pass: Direct Pixel Compositing into HTML5 Canvas via renderAttentionHeatmapRGBA & putImageData
  useEffect(() => {
    if (!canvasRef.current || !imageElement) return;
    const canvas = canvasRef.current;
    const width = imageElement.naturalWidth || imageElement.width;
    const height = imageElement.naturalHeight || imageElement.height;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (analysisResult) {
      // 1. Extract base image pixel buffer
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;
      tempCtx.drawImage(imageElement, 0, 0, width, height);
      const baseImageData = tempCtx.getImageData(0, 0, width, height);
      const baseRgba = new Uint8ClampedArray(baseImageData.data);

      // 2. Select active map and rendering mode
      let activeMap = analysisResult.saliencyMap;
      let activeMode: 'heatmap' | 'fog_of_war' | 'clutter' | 'heatmap_only' | 'original' = 'heatmap';
      let activeStructure = analysisResult.structureMap;

      // Layer Inspector: "Why is it hot here?" single-feature explanatory layers
      if (activeLayer === 'learned' && analysisResult.learnedMap) {
        activeMap = analysisResult.learnedMap;
      } else if (activeLayer === 'contrast' && analysisResult.contrastMap) {
        activeMap = analysisResult.contrastMap;
      } else if (activeLayer === 'saturation' && analysisResult.saturationMap) {
        activeMap = analysisResult.saturationMap;
      } else if (activeLayer === 'rarity' && analysisResult.uniquenessMap) {
        activeMap = analysisResult.uniquenessMap;
      } else if (activeLayer === 'cluster' && analysisResult.clusterMap) {
        activeMap = analysisResult.clusterMap;
      } else if (activeLayer === 'text' && analysisResult.textMap) {
        activeMap = analysisResult.textMap;
      } else if (activeLayer === 'shape' && analysisResult.shapeMap) {
        activeMap = analysisResult.shapeMap;
      } else if (activeLayer === 'faces' && analysisResult.facesMap) {
        activeMap = analysisResult.facesMap;
      } else if (visualMode === 'clutter') {
        activeMode = 'clutter';
      } else if (visualMode === 'fog_of_war') {
        activeMode = 'fog_of_war';
      } else if (visualMode === 'original') {
        activeMode = 'original';
      }

      // Render Attention Heatmap or Sub-Matrix RGBA buffer via saliency engine
      const compositedRgba = renderAttentionHeatmapRGBA(
        baseRgba,
        activeMap,
        analysisResult.width,
        analysisResult.height,
        {
          mode: activeMode,
          colormap: colormapTheme,
          opacity: heatmapOpacity,
          threshold: visualMode === 'fog_of_war' ? fogThreshold : 0.12,
          darkenBase: darkenBase ?? 0.38,
          showContours: showContours ?? true,
          structureMap: activeStructure,
        }
      );

      // 3. Put pixel-composited ImageData directly to Canvas
      const imageData = new ImageData(
        new Uint8ClampedArray(compositedRgba),
        analysisResult.width,
        analysisResult.height
      );
      ctx.putImageData(imageData, 0, 0);

      // 4. Handle Split A/B comparison wipe slider
      if (visualMode === 'split_ab' && secondaryImageElement) {
        const splitX = Math.round(width * splitPosition);
        ctx.save();
        ctx.beginPath();
        ctx.rect(splitX, 0, width - splitX, height);
        ctx.clip();
        ctx.drawImage(secondaryImageElement, 0, 0, width, height);
        ctx.restore();

        // Divider Line
        ctx.strokeStyle = '#00E599';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(splitX, 0);
        ctx.lineTo(splitX, height);
        ctx.stroke();

        // Divider Handle
        ctx.fillStyle = '#00E599';
        ctx.beginPath();
        ctx.arc(splitX, height / 2, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(imageElement, 0, 0, width, height);
    }
  }, [
    imageElement,
    analysisResult,
    visualMode,
    colormapTheme,
    heatmapOpacity,
    fogThreshold,
    splitPosition,
    secondaryImageElement,
    darkenBase,
    showContours,
  ]);

  // Mouse wheel cursor-centered zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
    setZoom((prev) => Math.max(0.25, Math.min(4.0, Number((prev * zoomFactor).toFixed(2)))));
  };

  // Convert client viewport coordinates to image pixel space
  const clientToImageCoords = (clientX: number, clientY: number) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    const x = Math.round((clientX - rect.left) * scaleX);
    const y = Math.round((clientY - rect.top) * scaleY);
    return {
      x: Math.max(0, Math.min(canvasRef.current.width, x)),
      y: Math.max(0, Math.min(canvasRef.current.height, y)),
    };
  };

  // Pointer Down handler
  const handlePointerDown = (e: React.PointerEvent) => {
    // Space or Middle-click or tool=pan initiates viewport pan
    if (e.button === 1 || activeTool === 'pan') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    if (e.button !== 0) return;

    const imgCoord = clientToImageCoords(e.clientX, e.clientY);

    if (activeTool === 'draw_aoi') {
      setDrawingBox({
        startX: imgCoord.x,
        startY: imgCoord.y,
        currentX: imgCoord.x,
        currentY: imgCoord.y,
      });
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    // Check if clicked inside existing AOI
    const clickedAoi = [...aois].reverse().find(
      (a) =>
        imgCoord.x >= a.x &&
        imgCoord.x <= a.x + a.width &&
        imgCoord.y >= a.y &&
        imgCoord.y <= a.y + a.height
    );

    if (clickedAoi) {
      onSelectAoi(clickedAoi.id);
      setDraggingAoi({
        id: clickedAoi.id,
        offsetX: imgCoord.x - clickedAoi.x,
        offsetY: imgCoord.y - clickedAoi.y,
      });
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } else {
      onSelectAoi(null);
    }
  };

  // Pointer Move handler
  const handlePointerMove = (e: React.PointerEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }

    const imgCoord = clientToImageCoords(e.clientX, e.clientY);

    // Update Inspection HUD
    if (analysisResult && imgCoord.x >= 0 && imgCoord.x < analysisResult.width && imgCoord.y >= 0 && imgCoord.y < analysisResult.height) {
      const idx = imgCoord.y * analysisResult.width + imgCoord.x;
      const att = Number(((analysisResult.saliencyMap[idx] || 0) * 100).toFixed(1));
      setCursorPos({ x: imgCoord.x, y: imgCoord.y, attentionPct: att });
    }

    // Active AOI Drawing
    if (drawingBox) {
      setDrawingBox((prev) => (prev ? { ...prev, currentX: imgCoord.x, currentY: imgCoord.y } : null));
      return;
    }

    // Active AOI Dragging with 60fps telemetry recalculation
    if (draggingAoi && analysisResult) {
      const targetAoi = aois.find((a) => a.id === draggingAoi.id);
      if (targetAoi) {
        const newX = Math.max(0, Math.min(analysisResult.width - targetAoi.width, imgCoord.x - draggingAoi.offsetX));
        const newY = Math.max(0, Math.min(analysisResult.height - targetAoi.height, imgCoord.y - draggingAoi.offsetY));

        const metrics = calculateAOIMetrics(
          { ...targetAoi, x: newX, y: newY },
          analysisResult.saliencyMap,
          analysisResult.width,
          analysisResult.height,
          analysisResult.fixations
        );

        onUpdateAOIs(
          aois.map((a) =>
            a.id === draggingAoi.id
              ? {
                  ...a,
                  x: newX,
                  y: newY,
                  shareOfAttention: metrics.shareOfAttention,
                  noticeability: metrics.noticeability,
                  ttffMs: metrics.ttffMs,
                }
              : a
          )
        );
      }
    }
  };

  // Pointer Up handler
  const handlePointerUp = (e: React.PointerEvent) => {
    if (isPanning) {
      setIsPanning(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      return;
    }

    if (drawingBox && analysisResult) {
      const x = Math.min(drawingBox.startX, drawingBox.currentX);
      const y = Math.min(drawingBox.startY, drawingBox.currentY);
      const w = Math.abs(drawingBox.currentX - drawingBox.startX);
      const h = Math.abs(drawingBox.currentY - drawingBox.startY);

      if (w > 12 && h > 12) {
        const metrics = calculateAOIMetrics(
          { x, y, width: w, height: h },
          analysisResult.saliencyMap,
          analysisResult.width,
          analysisResult.height,
          analysisResult.fixations
        );

        const newAoi: AOIRegion = {
          id: `aoi_custom_${Date.now()}`,
          label: `Custom Target ${aois.length + 1}`,
          x,
          y,
          width: w,
          height: h,
          color: '#00E599',
          shareOfAttention: metrics.shareOfAttention,
          noticeability: metrics.noticeability,
          ttffMs: metrics.ttffMs,
          semanticTag: 'Custom',
        };

        onUpdateAOIs([...aois, newAoi]);
        onSelectAoi(newAoi.id);
        setActiveTool('select');
      }

      setDrawingBox(null);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      return;
    }

    if (draggingAoi) {
      setDraggingAoi(null);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  // Delete selected AOI on Backspace / Delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedAoiId) {
        onUpdateAOIs(aois.filter((a) => a.id !== selectedAoiId));
        onSelectAoi(null);
      } else if (e.key === 'Escape') {
        onSelectAoi(null);
        setDrawingBox(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedAoiId, aois, onUpdateAOIs, onSelectAoi]);

  const selectedAoi = aois.find((a) => a.id === selectedAoiId);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 w-full h-full bg-[#08090E] overflow-hidden select-none flex items-center justify-center"
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        cursor:
          isPanning || activeTool === 'pan'
            ? 'grabbing'
            : activeTool === 'draw_aoi'
            ? 'crosshair'
            : 'default',
      }}
    >
      {/* Viewport Canvas Layer */}
      <div
        className="relative transition-transform duration-75 ease-out"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
        }}
      >
        <canvas
          id="attentix-viewport-canvas"
          ref={canvasRef}
          className="block shadow-2xl rounded-sm border border-white/10"
        />

        {/* SVG Interactive Overlays (Scanpath + AOIs simultaneously on top of live heatmap) */}
        {imageElement && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox={`0 0 ${imageElement.naturalWidth} ${imageElement.naturalHeight}`}
          >
            {/* 1. Gaze Scanpath Overlay */}
            {(showScanpathOverlay || visualMode === 'scanpath') &&
              analysisResult &&
              analysisResult.fixations &&
              analysisResult.fixations.length > 0 && (() => {
                const maxTime = visualMode === 'scanpath' ? (scrubberTimeSec ?? 5.0) * 1000 : Infinity;
                const activeFixations = analysisResult.fixations.filter((f) => f.ttffMs <= maxTime);
                return (
                  <g className="scanpath-layer" aria-label="Predicted Saccadic Scanpath">
                    {/* Saccade Trajectory Vectors */}
                    {activeFixations.map((f, i) => {
                      if (i === 0) return null;
                      const prev = activeFixations[i - 1];
                      return (
                        <g key={`saccade-${i}`}>
                          <line
                            x1={prev.x}
                            y1={prev.y}
                            x2={f.x}
                            y2={f.y}
                            stroke="#00E599"
                            strokeWidth={2.5}
                            strokeDasharray="6 3"
                            opacity={0.85}
                          />
                        </g>
                      );
                    })}

                    {/* Numbered Fixation Circles + Dwell Badges */}
                    {activeFixations.map((f) => (
                      <g key={`fixation-${f.order}`} transform={`translate(${f.x}, ${f.y})`}>
                        {/* Outer Foveal Radius Halo */}
                        <circle
                          r={Math.max(14, f.radius)}
                          fill="rgba(0, 229, 153, 0.12)"
                          stroke="#00E599"
                          strokeWidth={1.5}
                          strokeDasharray="4 2"
                        />
                        {/* Core Node */}
                        <circle
                          r={12}
                          fill="#11131C"
                          stroke="#00E599"
                          strokeWidth={2}
                        />
                        {/* Order Number */}
                        <text
                          textAnchor="middle"
                          dy=".35em"
                          fill="#00E599"
                          fontSize={11}
                          fontWeight="bold"
                          fontFamily="monospace"
                        >
                          {f.order}
                        </text>
                        {/* Predicted Fixation Label (Nominal, no fabricated duration) */}
                        <g transform={`translate(${16}, ${-10})`}>
                          <rect
                            x={0}
                            y={0}
                            width={32}
                            height={16}
                            rx={3}
                            fill="#11131C"
                            stroke="#00E599"
                            strokeWidth={0.8}
                            opacity={0.92}
                          />
                          <text
                            x={4}
                            y={11}
                            fill="#A1A1AA"
                            fontSize={8}
                            fontFamily="monospace"
                          >
                            #{f.order}
                          </text>
                        </g>
                      </g>
                    ))}
                  </g>
                );
              })()}

            {/* 2. Interactive AOI Bounding Boxes */}
            {showAoiOverlay &&
              aois.map((aoi) => {
                const isSelected = aoi.id === selectedAoiId;
                return (
                  <g key={aoi.id}>
                    {/* Bounding Box */}
                    <rect
                      x={aoi.x}
                      y={aoi.y}
                      width={aoi.width}
                      height={aoi.height}
                      fill={isSelected ? `${aoi.color}25` : `${aoi.color}10`}
                      stroke={aoi.color}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                      strokeDasharray={isSelected ? 'none' : '4 2'}
                    />

                    {/* Corner Handles for selected AOI */}
                    {isSelected && (
                      <>
                        <circle cx={aoi.x} cy={aoi.y} r={4} fill={aoi.color} />
                        <circle cx={aoi.x + aoi.width} cy={aoi.y} r={4} fill={aoi.color} />
                        <circle cx={aoi.x} cy={aoi.y + aoi.height} r={4} fill={aoi.color} />
                        <circle cx={aoi.x + aoi.width} cy={aoi.y + aoi.height} r={4} fill={aoi.color} />
                      </>
                    )}

                    {/* Floating Metric Badge */}
                    <g transform={`translate(${aoi.x}, ${Math.max(0, aoi.y - 24)})`}>
                      <rect
                        x={0}
                        y={0}
                        width={Math.max(120, aoi.label.length * 8 + 60)}
                        height={20}
                        rx={4}
                        fill="#11131C"
                        stroke={aoi.color}
                        strokeWidth={1}
                      />
                      <text
                        x={6}
                        y={14}
                        fill="#FFFFFF"
                        fontFamily="monospace"
                        fontSize={10}
                        fontWeight="600"
                      >
                        {aoi.label} • {aoi.shareOfAttention}%
                      </text>
                    </g>
                  </g>
                );
              })}

            {/* Currently Drawing Box Preview */}
            {drawingBox && (
              <rect
                x={Math.min(drawingBox.startX, drawingBox.currentX)}
                y={Math.min(drawingBox.startY, drawingBox.currentY)}
                width={Math.abs(drawingBox.currentX - drawingBox.startX)}
                height={Math.abs(drawingBox.currentY - drawingBox.startY)}
                fill="rgba(0, 229, 153, 0.2)"
                stroke="#00E599"
                strokeWidth={2}
                strokeDasharray="6 3"
              />
            )}
          </svg>
        )}
      </div>

      {/* Floating Canvas Toolbar */}
      <div className="absolute top-2.5 sm:top-4 left-2 sm:left-6 max-w-[calc(100vw-1rem)] sm:max-w-none overflow-x-auto z-20 flex items-center gap-1.5 p-1 bg-[#11131C]/90 backdrop-blur-md rounded-lg border border-white/10 shadow-xl">
        <button
          onClick={() => setActiveTool('select')}
          className={`p-2 rounded-md transition-colors ${
            activeTool === 'select'
              ? 'bg-[#00E599] text-[#08090E]'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
          title="Select / Drag Tool (V)"
        >
          <MousePointer className="w-4 h-4" />
        </button>
        <button
          onClick={() => setActiveTool('draw_aoi')}
          className={`p-2 rounded-md transition-colors ${
            activeTool === 'draw_aoi'
              ? 'bg-[#00E599] text-[#08090E]'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
          title="Draw Area of Interest (A)"
        >
          <Square className="w-4 h-4" />
        </button>
        <button
          onClick={() => setActiveTool('pan')}
          className={`p-2 rounded-md transition-colors ${
            activeTool === 'pan'
              ? 'bg-[#00E599] text-[#08090E]'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
          title="Pan Viewport (Space+Drag)"
        >
          <Hand className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-5 bg-white/10 mx-1" />

        {/* Scanpath Layer Toggle */}
        <button
          onClick={() => handleToggleScanpath(!showScanpathOverlay)}
          className={`p-2 rounded-md transition-colors ${
            showScanpathOverlay
              ? 'bg-[#00E599]/20 text-[#00E599] border border-[#00E599]/40'
              : 'text-zinc-500 hover:text-white hover:bg-white/5'
          }`}
          title="Toggle Gaze Scanpath Overlay"
        >
          <Footprints className="w-4 h-4" />
        </button>

        {/* AOI Layer Toggle */}
        <button
          onClick={() => handleToggleAoi(!showAoiOverlay)}
          className={`p-2 rounded-md transition-colors ${
            showAoiOverlay
              ? 'bg-[#00E599]/20 text-[#00E599] border border-[#00E599]/40'
              : 'text-zinc-500 hover:text-white hover:bg-white/5'
          }`}
          title="Toggle AOI Bounding Boxes"
        >
          <Layers className="w-4 h-4" />
        </button>

        {/* 5-Matrix Diagnostic Quick Switcher */}
        {onChangeVisualMode && (
          <>
            <div className="w-[1px] h-5 bg-white/10 mx-1" />
            <div className="flex items-center gap-1 bg-[#08090E] p-0.5 rounded border border-white/10 text-[10px] font-mono">
              <button
                onClick={() => onChangeVisualMode('heatmap')}
                className={`px-1.5 py-1 rounded transition-colors ${
                  visualMode === 'heatmap' ? 'bg-[#00E599] text-[#08090E] font-bold' : 'text-zinc-400 hover:text-white'
                }`}
                title="Unified Attention Heatmap (Fused 5-Matrix)"
              >
                HEAT
              </button>
              <button
                onClick={() => onChangeVisualMode('cognitive_load')}
                className={`px-1.5 py-1 rounded transition-colors ${
                  visualMode === 'cognitive_load' ? 'bg-[#00E599] text-[#08090E] font-bold' : 'text-zinc-400 hover:text-white'
                }`}
                title="Tri-Factor Cognitive Load Heatmap (Color + Shape + Text)"
              >
                COG
              </button>
              <button
                onClick={() => onChangeVisualMode('text_density')}
                className={`px-1.5 py-1 rounded transition-colors ${
                  visualMode === 'text_density' ? 'bg-[#00E599] text-[#08090E] font-bold' : 'text-zinc-400 hover:text-white'
                }`}
                title="Text & Typography Stroke Density Map"
              >
                TXT
              </button>
              <button
                onClick={() => onChangeVisualMode('shape_contour')}
                className={`px-1.5 py-1 rounded transition-colors ${
                  visualMode === 'shape_contour' ? 'bg-[#00E599] text-[#08090E] font-bold' : 'text-zinc-400 hover:text-white'
                }`}
                title="Shape & Contour Orientation Map"
              >
                SHP
              </button>
              <button
                onClick={() => onChangeVisualMode('cluster_mass')}
                className={`px-1.5 py-1 rounded transition-colors ${
                  visualMode === 'cluster_mass' ? 'bg-[#00E599] text-[#08090E] font-bold' : 'text-zinc-400 hover:text-white'
                }`}
                title="Color Uniqueness & Local Cluster Mass Map"
              >
                CLU
              </button>
              <button
                onClick={() => onChangeVisualMode('clutter')}
                className={`px-1.5 py-1 rounded transition-colors ${
                  visualMode === 'clutter' ? 'bg-[#00E599] text-[#08090E] font-bold' : 'text-zinc-400 hover:text-white'
                }`}
                title="Sobel Edge Orientation & Clutter Map"
              >
                STR
              </button>
            </div>
          </>
        )}

        <div className="w-[1px] h-5 bg-white/10 mx-1" />

        <button
          onClick={() => setZoom((z) => Math.min(4.0, Number((z * 1.2).toFixed(2))))}
          className="p-2 rounded-md text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          title="Zoom In (+)"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.25, Number((z * 0.8).toFixed(2))))}
          className="p-2 rounded-md text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          title="Zoom Out (-)"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleFitToScreen}
          className="p-2 rounded-md text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          title="Fit to Screen (0)"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            setZoom(1.0);
            setPan({ x: 0, y: 0 });
          }}
          className="p-2 rounded-md text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          title="Reset View"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {selectedAoi && (
          <>
            <div className="w-[1px] h-5 bg-white/10 mx-1" />
            <button
              onClick={() => {
                onUpdateAOIs(aois.filter((a) => a.id !== selectedAoi.id));
                onSelectAoi(null);
              }}
              className="p-2 rounded-md text-rose-400 hover:text-white hover:bg-rose-500/20 transition-colors"
              title="Delete Selected AOI (Del)"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Floating Bottom HUD Badge */}
      <div className="absolute bottom-4 left-6 z-20 flex items-center gap-3 px-3 py-1.5 bg-[#11131C]/90 backdrop-blur-md rounded-md border border-white/10 text-xs font-mono text-zinc-300 shadow-lg">
        <span className="text-zinc-500">ZOOM</span>
        <span className="text-emerald-400 font-semibold">{Math.round(zoom * 100)}%</span>
        {cursorPos && (
          <>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-500">X:</span> {cursorPos.x}
            <span className="text-zinc-500 ml-1">Y:</span> {cursorPos.y}
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-500">ATTN:</span>
            <span className="text-emerald-400 font-semibold">{cursorPos.attentionPct}%</span>
          </>
        )}
      </div>

      {/* Live Thermal Colorbar Legend (Percentile Rank Scale, Display Transfer Function Separate from saliencyRaw) */}
      <div className="absolute bottom-4 right-6 z-20 hidden md:flex items-center gap-2.5 px-3.5 py-2 bg-[#11131C]/90 backdrop-blur-md rounded-md border border-white/10 text-xs font-mono text-zinc-300 shadow-xl" title="Display uses percentile rank transfer function. AOIs and metrics are computed strictly on raw unclipped saliency tensors.">
        <span className="text-zinc-400 font-semibold text-[11px]">p50</span>
        <div
          className="w-36 h-2.5 rounded-full border border-white/20 shadow-inner"
          style={{
            background:
              colormapTheme === 'turbo'
                ? 'linear-gradient(to right, #30123b, #28bceb, #a4fc3c, #fb7e21, #7a0403)'
                : colormapTheme === 'inferno'
                ? 'linear-gradient(to right, #0a0723, #84206b, #e55c30, #fcffa4)'
                : colormapTheme === 'viridis'
                ? 'linear-gradient(to right, #440154, #31688e, #35b779, #fde725)'
                : 'linear-gradient(to right, #002080 0%, #00b4ff 22%, #00e676 45%, #ffe600 68%, #ff5a00 86%, #ff0f0f 96%, #fff5dc 100%)',
          }}
        />
        <span className="text-amber-400 font-semibold text-[11px]">p90</span>
        <span className="text-red-400 font-semibold text-[11px]">p99 (Peak Hotspot)</span>
      </div>
    </div>
  );
};

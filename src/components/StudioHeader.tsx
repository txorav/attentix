import React, { useState } from 'react';
import { DomainPreset, ViewportMode, ModelTier, ScriptDirection, ViewingDuration } from '../types/studio';
import { PROCEDURAL_STUDIO_SAMPLES } from '../data/procedural-samples';
import { StudioProject } from '../services/project-storage';
import {
  Globe,
  Upload,
  Download,
  Layers,
  Sparkles,
  Monitor,
  Tablet,
  Smartphone,
  ChevronDown,
  Loader2,
  FolderOpen,
  Plus,
  Trash2,
  Edit2,
  Check,
  BookOpen,
  Brain,
  Zap,
  FlaskConical,
  Rocket,
  Clock,
  Languages,
  SlidersHorizontal,
  Gem,
  Calculator,
  Binary,
  Archive,
  Cpu,
} from 'lucide-react';

interface StudioHeaderProps {
  domainPreset: DomainPreset;
  onChangeDomainPreset: (preset: DomainPreset) => void;
  modelTier: ModelTier;
  onChangeModelTier: (tier: ModelTier) => void;
  scriptDirection: ScriptDirection;
  onChangeScriptDirection: (dir: ScriptDirection) => void;
  viewingDuration: ViewingDuration;
  onChangeViewingDuration: (dur: ViewingDuration) => void;
  onSelectProceduralSample: (sampleId: string) => void;
  onCaptureUrl: (url: string, viewport: ViewportMode) => void;
  isCapturingUrl: boolean;
  onOpenUpload: () => void;
  onOpenExport: () => void;
  onOpenSpecs?: () => void;
  isAnalyzing: boolean;
  activeAssetTitle: string;
  projects: StudioProject[];
  activeProjectId: string | null;
  onSelectProject: (id: string) => void;
  onCreateProject: () => void;
  onDeleteProject: (id: string) => void;
  onRenameProject: (id: string, name: string) => void;
  lastSavedTime: number | null;
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({
  domainPreset,
  onChangeDomainPreset,
  modelTier,
  onChangeModelTier,
  scriptDirection,
  onChangeScriptDirection,
  viewingDuration,
  onChangeViewingDuration,
  onSelectProceduralSample,
  onCaptureUrl,
  isCapturingUrl,
  onOpenUpload,
  onOpenExport,
  onOpenSpecs,
  isAnalyzing,
  activeAssetTitle,
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  onRenameProject,
  lastSavedTime,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [viewport, setViewport] = useState<ViewportMode>('desktop');
  const [isUrlMenuOpen, setIsUrlMenuOpen] = useState(false);
  const [isSampleMenuOpen, setIsSampleMenuOpen] = useState(false);
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');

  const MODEL_META: Record<
    ModelTier,
    {
      label: string;
      labelShort: string;
      badge: string;
      icon: typeof Brain;
      description: string;
      mathWeight: string;
      bundleUrl?: string;
      isMathOnly?: boolean;
    }
  > = {
    low: {
      label: 'Low (Pure Math & Deterministic Vision Science)',
      labelShort: 'Low (Math)',
      badge: 'Zero Weights • Pure Math',
      icon: Calculator,
      description: '1 Core CPU • 0 MB VRAM • Pure Math (w_L = 0). Computes all 11 vision features (Itti-Koch contrast, Lab* opponency, Sobel/Gabor orientation, DoG, spectral residual) with zero neural overhead.',
      mathWeight: 'w_L = 0 (100% Closed-Form Math)',
      isMathOnly: true,
    },
    fast: {
      label: 'Fast (MobileNetV3 ONNX • Universal Bundle)',
      labelShort: 'Fast',
      badge: '84.2% AUC • 1 Pass',
      icon: Zap,
      description: '2 Threads • ~15 MB VRAM • 1 Pass (384×288) • 84.2% AUC. Distilled student model optimized for speed & battery efficiency (~15ms latency). Packaged in .attentix universal bundle.',
      mathWeight: 'w_L = 0.28 (Distilled ONNX)',
      bundleUrl: '/models/attentix_fast.attentix',
    },
    medium: {
      label: 'Medium (Standard Neural ONNX • Universal Bundle)',
      labelShort: 'Medium',
      badge: '90.8% AUC • 1 Pass + Edge',
      icon: Cpu,
      description: '4 Threads • ~35 MB VRAM • 1 Pass + Edge Refinement • 90.8% AUC. Balanced convolutional neural extractor with Sobel edge-guided spatial alignment. Packaged in .attentix universal bundle.',
      mathWeight: 'w_L = 0.35 (Standard ONNX)',
      bundleUrl: '/models/attentix_medium.attentix',
    },
    high: {
      label: 'High (Hybrid Neural • Industry Standard)',
      labelShort: 'High',
      badge: '95.2% AUC • 2 Foveal Passes',
      icon: Brain,
      description: 'Up to 8 Threads • ~65 MB VRAM • 2 Foveal Passes • 95.2% AUC. Reference ASPP model with 2-pass foveal refinement on key attention hotspots. Packaged in .attentix universal bundle.',
      mathWeight: 'w_L = 0.42 (Hybrid Neural)',
      bundleUrl: '/models/attentix_high.attentix',
    },
    max: {
      label: 'Max (Server-Class Deep Ensemble)',
      labelShort: 'Max',
      badge: '96.5% AUC • 3 Passes',
      icon: Rocket,
      description: 'All Cores • ~110 MB VRAM • 3-Pass Multi-Scale Pyramid • 96.5% AUC. Progressive multi-scale forward passes fusing global scene and zoomed affordances. Packaged in .attentix universal bundle.',
      mathWeight: 'w_L = 0.50 (Deep Ensemble)',
      bundleUrl: '/models/attentix_max.attentix',
    },
    ultra: {
      label: 'Ultra (Peak Multi-Pass Ensemble)',
      labelShort: 'Ultra',
      badge: '97.8% AUC • 5 Quadrants',
      icon: Gem,
      description: 'Maximum Saturation • ~160 MB VRAM • 5-Pass Quadrant Ensemble • 97.8% AUC. 5 parallel neural passes across full frame and 4 high-res overlapping foveal quadrants. Packaged in .attentix universal bundle.',
      mathWeight: 'w_L = 0.58 (Peak Precision)',
      bundleUrl: '/models/attentix_ultra.attentix',
    },
    hybrid: {
      label: 'High (Hybrid Neural • Industry Standard)',
      labelShort: 'High',
      badge: '95.2% AUC • ONNX',
      icon: Brain,
      description: 'High-capacity ASPP neural feature bank (ONNX WebGPU/WASM) + Vision Science. Packaged in .attentix universal bundle.',
      mathWeight: 'w_L = 0.42 (Hybrid Neural)',
      bundleUrl: '/models/attentix_high.attentix',
    },
    fast_browser: {
      label: 'Fast (MobileNetV3 ONNX • Universal Bundle)',
      labelShort: 'Fast',
      badge: '84.2% AUC • ONNX',
      icon: Zap,
      description: 'Distilled MobileNetV3 model for low-latency live preview. Packaged in .attentix universal bundle.',
      mathWeight: 'w_L = 0.28 (Distilled ONNX)',
      bundleUrl: '/models/attentix_fast.attentix',
    },
    hand_crafted: {
      label: 'Low (Pure Math & Deterministic Vision Science)',
      labelShort: 'Low (Math)',
      badge: 'Zero Weights • Pure Math',
      icon: Calculator,
      description: 'Pure empirical vision science baseline (I, C, O, SR, FT, U, P, CL, T, FA, S) with zero neural weights. Completely deterministic.',
      mathWeight: 'w_L = 0 (100% Closed-Form Math)',
      isMathOnly: true,
    },
    deep_ensemble: {
      label: 'Max (Server-Class Deep Ensemble)',
      labelShort: 'Max',
      badge: '94.5% AUC • ONNX',
      icon: Rocket,
      description: 'Multi-scale high-capacity neural feature extractor with amplified semantic saliency and layout hierarchy.',
      mathWeight: 'w_L = 0.38 (Deep Ensemble)',
      bundleUrl: '/models/attentix_max.attentix',
    },
  };

  const PRIMARY_MODEL_TIERS: ModelTier[] = ['low', 'fast', 'medium', 'high', 'max', 'ultra'];

  const currentModelMeta = MODEL_META[modelTier] || MODEL_META.high;
  const CurrentModelIcon = currentModelMeta.icon || Brain;

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput.trim()) {
      onCaptureUrl(urlInput.trim(), viewport);
      setIsUrlMenuOpen(false);
    }
  };

  const handleStartRename = (e: React.MouseEvent, proj: StudioProject) => {
    e.stopPropagation();
    setEditingProjectId(proj.id);
    setEditNameValue(proj.name);
  };

  const handleSaveRename = (e: React.FormEvent, projId: string) => {
    e.preventDefault();
    if (editNameValue.trim()) {
      onRenameProject(projId, editNameValue.trim());
    }
    setEditingProjectId(null);
  };

  return (
    <header className="h-14 bg-[#11131C] border-b border-white/10 px-4 flex items-center justify-between select-none z-30 relative">
      {/* Brand & Projects Dropdown */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#00E599]/10 border border-[#00E599]/40 flex items-center justify-center">
            <Layers className="w-4 h-4 text-[#00E599]" />
          </div>
          <span className="font-bold text-sm tracking-wide text-white">
            attentix <span className="text-[#00E599] text-xs font-mono font-normal ml-1">STUDIO</span>
          </span>
        </div>

        <div className="h-4 w-[1px] bg-white/10 mx-1" />

        {/* Project Selector Menu */}
        <div className="relative">
          <button
            onClick={() => setIsProjectMenuOpen(!isProjectMenuOpen)}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs transition-colors max-w-[240px] ${
              isProjectMenuOpen
                ? 'bg-[#00E599]/10 text-[#00E599] border-[#00E599]/40'
                : 'bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5 text-[#00E599] flex-shrink-0" />
            <span className="truncate font-medium">{activeAssetTitle}</span>
            {isAnalyzing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00E599] flex-shrink-0 ml-1" />
            ) : (
              <ChevronDown className="w-3 h-3 opacity-60 flex-shrink-0" />
            )}
          </button>

          {isProjectMenuOpen && (
            <div className="absolute top-full mt-2 left-0 w-80 bg-[#11131C] border border-white/15 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center justify-between px-2 py-1.5 border-b border-white/10 text-xs text-zinc-400">
                <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                  Projects ({projects.length})
                </span>
                <button
                  onClick={() => {
                    onCreateProject();
                    setIsProjectMenuOpen(false);
                  }}
                  className="flex items-center gap-1 text-[11px] text-[#00E599] hover:text-[#00E599]/80 font-medium transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Project</span>
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto py-1 space-y-1">
                {projects.map((proj) => {
                  const isActive = proj.id === activeProjectId;
                  const isEditing = editingProjectId === proj.id;

                  return (
                    <div
                      key={proj.id}
                      onClick={() => {
                        if (!isEditing) {
                          onSelectProject(proj.id);
                          setIsProjectMenuOpen(false);
                        }
                      }}
                      className={`group flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                        isActive
                          ? 'bg-white/10 text-white font-medium border border-[#00E599]/40'
                          : 'text-zinc-300 hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      {isEditing ? (
                        <form
                          onSubmit={(e) => handleSaveRename(e, proj.id)}
                          className="flex items-center gap-1.5 w-full"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            value={editNameValue}
                            onChange={(e) => setEditNameValue(e.target.value)}
                            className="flex-1 bg-[#08090E] border border-white/20 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-[#00E599]"
                            autoFocus
                          />
                          <button
                            type="submit"
                            className="p-1 rounded bg-[#00E599] text-[#08090E]"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </form>
                      ) : (
                        <>
                          <div className="flex flex-col min-w-0 pr-2">
                            <span className="truncate">{proj.name}</span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {proj.domainPreset} • {proj.aois.length} AOIs
                            </span>
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => handleStartRename(e, proj)}
                              className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white"
                              title="Rename project"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            {projects.length > 1 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteProject(proj.id);
                                }}
                                className="p-1 rounded hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400"
                                title="Delete project"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {lastSavedTime && (
                <div className="mt-1 pt-1.5 border-t border-white/10 px-2 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Auto-saved locally
                  </span>
                  <span>{new Date(lastSavedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Center Controls: URL Bar + Procedural Test Suite + Domain Preset */}
      <div className="flex items-center gap-2">
        {/* Domain Preset Selector */}
        <div className="flex items-center rounded-md bg-[#08090E] p-0.5 border border-white/10 text-xs">
          <button
            onClick={() => onChangeDomainPreset('ui_ux')}
            className={`px-2.5 py-1 rounded transition-colors ${
              domainPreset === 'ui_ux'
                ? 'bg-white/10 text-white font-medium shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            UI / UX
          </button>
          <button
            onClick={() => onChangeDomainPreset('advertising')}
            className={`px-2.5 py-1 rounded transition-colors ${
              domainPreset === 'advertising'
                ? 'bg-white/10 text-white font-medium shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Ad / Brand
          </button>
          <button
            onClick={() => onChangeDomainPreset('editorial_book')}
            className={`px-2.5 py-1 rounded transition-colors ${
              domainPreset === 'editorial_book'
                ? 'bg-white/10 text-white font-medium shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Editorial
          </button>
          <button
            onClick={() => onChangeDomainPreset('fine_art')}
            className={`px-2.5 py-1 rounded transition-colors ${
              domainPreset === 'fine_art'
                ? 'bg-white/10 text-white font-medium shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Fine Art
          </button>
        </div>

        {/* Website Capture Input Pill */}
        <div className="relative">
          <button
            onClick={() => setIsUrlMenuOpen(!isUrlMenuOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border transition-colors ${
              isUrlMenuOpen
                ? 'bg-[#00E599]/10 text-[#00E599] border-[#00E599]/40'
                : 'bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Analyze URL</span>
            <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
          </button>

          {isUrlMenuOpen && (
            <div className="absolute top-full mt-2 left-0 w-96 p-3 bg-[#11131C] border border-white/15 rounded-lg shadow-2xl z-50">
              <form onSubmit={handleUrlSubmit} className="space-y-3">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Enter live website URL</span>
                  <div className="flex items-center gap-1 bg-[#08090E] p-0.5 rounded border border-white/10">
                    <button
                      type="button"
                      onClick={() => setViewport('desktop')}
                      className={`p-1 rounded ${
                        viewport === 'desktop' ? 'bg-white/15 text-white' : 'text-zinc-500'
                      }`}
                      title="Desktop (1440px)"
                    >
                      <Monitor className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewport('tablet')}
                      className={`p-1 rounded ${
                        viewport === 'tablet' ? 'bg-white/15 text-white' : 'text-zinc-500'
                      }`}
                      title="Tablet (768px)"
                    >
                      <Tablet className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewport('mobile')}
                      className={`p-1 rounded ${
                        viewport === 'mobile' ? 'bg-white/15 text-white' : 'text-zinc-500'
                      }`}
                      title="Mobile (390px)"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://example.com"
                    className="flex-1 bg-[#08090E] border border-white/15 rounded px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#00E599]"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={isCapturingUrl || !urlInput.trim()}
                    className="px-3 py-1.5 bg-[#00E599] text-[#08090E] rounded text-xs font-semibold hover:bg-[#00E599]/90 disabled:opacity-50 flex items-center gap-1"
                  >
                    {isCapturingUrl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Fetch'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* 1-Click Procedural Studio Test Suite */}
        <div className="relative">
          <button
            onClick={() => setIsSampleMenuOpen(!isSampleMenuOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-xs text-zinc-300 border border-white/10 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Procedural Benchmarks</span>
            <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
          </button>

          {isSampleMenuOpen && (
            <div className="absolute top-full mt-2 left-0 w-64 bg-[#11131C] border border-white/15 rounded-lg shadow-2xl py-1.5 z-50">
              <div className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                1-Click Procedural Suite
              </div>
              {PROCEDURAL_STUDIO_SAMPLES.map((sample) => (
                <button
                  key={sample.id}
                  onClick={() => {
                    onSelectProceduralSample(sample.id);
                    setIsSampleMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-white/10 hover:text-white flex flex-col gap-0.5 transition-colors"
                >
                  <span className="font-medium">{sample.name}</span>
                  <span className="text-[10px] text-zinc-500">{sample.category} • {sample.width}x{sample.height}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Actions: Model Switcher, Upload, Model Specs & Export */}
      <div className="flex items-center gap-2">
        {/* Model Switcher Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setIsModelMenuOpen(!isModelMenuOpen);
              setIsUrlMenuOpen(false);
              setIsSampleMenuOpen(false);
              setIsProjectMenuOpen(false);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border transition-colors ${
              isModelMenuOpen
                ? 'bg-[#00E599]/15 text-[#00E599] border-[#00E599]/50 shadow-sm'
                : 'bg-white/5 text-zinc-200 border-white/10 hover:bg-white/10'
            }`}
            title="Configure Active Model Architecture, Viewing Duration, and Script Direction"
          >
            <CurrentModelIcon className="w-3.5 h-3.5 text-[#00E599]" />
            <span className="font-medium">{currentModelMeta.labelShort}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-zinc-300 font-mono">
              {scriptDirection.toUpperCase()} • {viewingDuration === '60s' || viewingDuration === '1m' ? '1 MIN' : viewingDuration}
            </span>
            <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
          </button>

          {isModelMenuOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsModelMenuOpen(false)}
              />

              {/* Menu Card */}
              <div className="absolute top-full mt-2 right-0 w-[440px] bg-[#11131C] border border-white/15 rounded-xl shadow-2xl p-3.5 z-50 animate-in fade-in zoom-in-95 duration-100 space-y-3.5 text-xs">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex items-center gap-1.5 font-medium text-white">
                    <SlidersHorizontal className="w-4 h-4 text-[#00E599]" />
                    <span>Model Architecture & Analysis Quality</span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500">Spec v2.4</span>
                </div>

                {/* 1. Architecture Selector */}
                <div className="space-y-1.5">
                  <div className="text-[10px] uppercase font-mono tracking-wider text-zinc-400">
                    Model Quality & Tier ({PRIMARY_MODEL_TIERS.length} Tiers)
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {PRIMARY_MODEL_TIERS.map((tierKey) => {
                      const meta = MODEL_META[tierKey];
                      const Icon = meta.icon;
                      const isSelected =
                        modelTier === tierKey ||
                        (tierKey === 'high' && modelTier === 'hybrid') ||
                        (tierKey === 'fast' && modelTier === 'fast_browser') ||
                        (tierKey === 'medium' && modelTier === 'hand_crafted') ||
                        (tierKey === 'max' && modelTier === 'deep_ensemble');

                      return (
                        <div
                          key={tierKey}
                          onClick={() => {
                            onChangeModelTier(tierKey);
                          }}
                          className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#00E599]/10 border-[#00E599]/60 shadow-sm'
                              : 'bg-[#08090E] border-white/10 hover:border-white/20 hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <Icon
                                className={`w-3.5 h-3.5 ${
                                  isSelected ? 'text-[#00E599]' : 'text-zinc-400'
                                }`}
                              />
                              <span className={`font-semibold ${isSelected ? 'text-white' : 'text-zinc-300'}`}>
                                {meta.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-zinc-400 font-mono">
                                {meta.badge}
                              </span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-[#00E599]" />}
                            </div>
                          </div>
                          <p className="text-[11px] text-zinc-400 leading-relaxed mb-1.5">
                            {meta.description}
                          </p>
                          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 pt-1 border-t border-white/5">
                            <div>
                              Weight: <span className="text-zinc-400">{meta.mathWeight}</span>
                            </div>
                            {meta.bundleUrl ? (
                              <a
                                href={meta.bundleUrl}
                                download
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 text-[10px] text-[#00E599] hover:underline bg-[#00E599]/10 px-1.5 py-0.5 rounded border border-[#00E599]/30"
                                title="Download .attentix Universal Bundle (ONNX + Jupyter Notebook + Benchmarks + Training Links)"
                              >
                                <Archive className="w-3 h-3" />
                                <span>.attentix Bundle</span>
                              </a>
                            ) : (
                              <span className="text-zinc-500 italic">Pure Deterministic Math</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Reading Direction Prior (LTR vs RTL) */}
                <div className="space-y-1.5 pt-1 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-400 flex items-center gap-1.5">
                      <Languages className="w-3.5 h-3.5 text-[#00E599]" />
                      Script Direction Bias (u_d)
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">Top-Left vs Top-Right</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onChangeScriptDirection('ltr')}
                      className={`px-3 py-2 rounded-lg border text-left transition-all ${
                        scriptDirection === 'ltr'
                          ? 'bg-[#00E599]/15 border-[#00E599] text-white font-medium'
                          : 'bg-[#08090E] border-white/10 text-zinc-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <div className="font-semibold text-xs flex items-center justify-between">
                        <span>LTR (Latin / Western)</span>
                        {scriptDirection === 'ltr' && <Check className="w-3 h-3 text-[#00E599]" />}
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-0.5 font-mono">Left-to-right reading flow</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeScriptDirection('rtl')}
                      className={`px-3 py-2 rounded-lg border text-left transition-all ${
                        scriptDirection === 'rtl'
                          ? 'bg-[#00E599]/15 border-[#00E599] text-white font-medium'
                          : 'bg-[#08090E] border-white/10 text-zinc-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <div className="font-semibold text-xs flex items-center justify-between">
                        <span>RTL (Arabic / Hebrew)</span>
                        {scriptDirection === 'rtl' && <Check className="w-3 h-3 text-[#00E599]" />}
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-0.5 font-mono">Right-to-left reading flow</div>
                    </button>
                  </div>
                </div>

                {/* 3. Viewing Duration Conditioning γ(d) Up to 1 Minute */}
                <div className="space-y-1.5 pt-1 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#00E599]" />
                      Analysis Exposure Duration γ(d)
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">Up to 1 Minute</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      {
                        id: '1s' as ViewingDuration,
                        label: '1s First Glance',
                        subtitle: 'Rapid visual scan',
                      },
                      {
                        id: '3s' as ViewingDuration,
                        label: '3s Standard Focus',
                        subtitle: 'Hero impression',
                      },
                      {
                        id: '5s' as ViewingDuration,
                        label: '5s Considered View',
                        subtitle: 'Headings & layout',
                      },
                      {
                        id: '7s' as ViewingDuration,
                        label: '7s Deep Scrutiny',
                        subtitle: 'Typographic reading',
                      },
                      {
                        id: '15s' as ViewingDuration,
                        label: '15s Detailed Layout',
                        subtitle: 'Card & flow study',
                      },
                      {
                        id: '30s' as ViewingDuration,
                        label: '30s Immersion',
                        subtitle: 'Secondary CTAs',
                      },
                      {
                        id: '60s' as ViewingDuration,
                        label: '60s (1 Min) Full',
                        subtitle: 'Exhaustive exploration',
                      },
                    ].map((dur) => {
                      const isSelected =
                        viewingDuration === dur.id ||
                        (dur.id === '60s' && viewingDuration === '1m');

                      return (
                        <button
                          key={dur.id}
                          type="button"
                          onClick={() => onChangeViewingDuration(dur.id)}
                          className={`p-2 rounded-lg border text-center transition-all ${
                            isSelected
                              ? 'bg-[#00E599]/15 border-[#00E599] text-white font-medium shadow-sm'
                              : 'bg-[#08090E] border-white/10 text-zinc-400 hover:text-white hover:bg-white/5'
                          } ${dur.id === '60s' ? 'col-span-3 sm:col-span-1 border-emerald-500/40 bg-emerald-500/5' : ''}`}
                        >
                          <div className="font-bold text-xs flex items-center justify-center gap-1">
                            <span>{dur.label}</span>
                            {isSelected && <Check className="w-3 h-3 text-[#00E599]" />}
                          </div>
                          <div className="text-[9px] text-zinc-500 font-mono mt-0.5">{dur.subtitle}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {onOpenSpecs && (
          <button
            onClick={onOpenSpecs}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-xs text-zinc-300 border border-white/10 transition-colors"
            title="Attentix: Mathematical Model of Visual Attention (Algorithm Spec)"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#00E599]" />
            <span>Model Spec</span>
          </button>
        )}

        <button
          onClick={onOpenUpload}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-xs text-zinc-300 border border-white/10 transition-colors"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload Asset</span>
        </button>

        <button
          onClick={onOpenExport}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[#00E599] hover:bg-[#00E599]/90 text-xs font-semibold text-[#08090E] transition-colors shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Telemetry</span>
        </button>
      </div>
    </header>
  );
};

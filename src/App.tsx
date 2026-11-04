import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AOIRegion,
  ColormapTheme,
  DomainPreset,
  ModelTier,
  ScriptDirection,
  ViewingDuration,
  SaliencyTensorResult,
  ViewportMode,
  VisualMode,
} from './types/studio';
import { executeSaliencyAnalysis } from './engine/saliency-client';
import { recalculateAllAOIs } from './engine/aoi-calculator';
import { captureWebsiteUrl } from './services/url-analyzer';
import { PROCEDURAL_STUDIO_SAMPLES } from './data/procedural-samples';
import {
  StudioProject,
  loadAllProjects,
  saveAllProjects,
  persistProject,
  removeProject,
  getActiveProjectId,
  setActiveProjectId,
  generateUniqueId,
} from './services/project-storage';
import { StudioHeader } from './components/StudioHeader';
import { StudioControlsRail } from './components/StudioControlsRail';
import { StudioCanvas } from './components/StudioCanvas';
import { StudioMetricsRail } from './components/StudioMetricsRail';
import { StudioUploadModal } from './components/StudioUploadModal';
import { StudioExportModal } from './components/StudioExportModal';
import { SpecsModal } from './components/SpecsModal';

export function App() {
  // Projects State
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [activeProjectId, setActiveId] = useState<string | null>(null);
  const [lastSavedTime, setLastSavedTime] = useState<number | null>(null);

  // Active Project Attributes
  const [domainPreset, setDomainPreset] = useState<DomainPreset>('ui_ux');
  const [modelTier, setModelTier] = useState<ModelTier>('hybrid');
  const [scriptDirection, setScriptDirection] = useState<ScriptDirection>('ltr');
  const [viewingDuration, setViewingDuration] = useState<ViewingDuration>('3s');
  const [activeAssetTitle, setActiveAssetTitle] = useState<string>('SaaS Landing Page UI');
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [secondaryImageElement, setSecondaryImageElement] = useState<HTMLImageElement | null>(null);

  // Analysis State
  const [analysisResult, setAnalysisResult] = useState<SaliencyTensorResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCapturingUrl, setIsCapturingUrl] = useState(false);
  const activeReqIdRef = useRef<number>(0);

  // Visual Controls State
  const [visualMode, setVisualMode] = useState<VisualMode>('heatmap');
  const [colormapTheme, setColormapTheme] = useState<ColormapTheme>('turbo');
  const [heatmapOpacity, setHeatmapOpacity] = useState<number>(0.8);
  const [fogThreshold, setFogThreshold] = useState<number>(0.35);
  const [splitPosition, setSplitPosition] = useState<number>(0.5);
  const [scrubberTimeSec, setScrubberTimeSec] = useState<number>(5.0);
  const [showContours, setShowContours] = useState<boolean>(true);

  // Areas of Interest (AOI)
  const [aois, setAois] = useState<AOIRegion[]>([]);
  const [selectedAoiId, setSelectedAoiId] = useState<string | null>(null);

  // Mobile Diagnostics Sheet Drawer
  const [isMobileMetricsOpen, setIsMobileMetricsOpen] = useState(false);

  // Modals
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isSpecsOpen, setIsSpecsOpen] = useState(false);

  // Helper to persist active state into active project
  const saveCurrentProjectState = useCallback(
    (overrides: Partial<StudioProject> = {}) => {
      if (!activeProjectId) return;
      setProjects((currentProjects) => {
        const idx = currentProjects.findIndex((p) => p.id === activeProjectId);
        if (idx === -1) return currentProjects;

        const updatedProject: StudioProject = {
          ...currentProjects[idx],
          name: overrides.name ?? activeAssetTitle,
          domainPreset: overrides.domainPreset ?? domainPreset,
          modelTier: overrides.modelTier ?? modelTier,
          scriptDirection: overrides.scriptDirection ?? scriptDirection,
          viewingDuration: overrides.viewingDuration ?? viewingDuration,
          aois: overrides.aois ?? aois,
          visualMode: overrides.visualMode ?? visualMode,
          colormapTheme: overrides.colormapTheme ?? colormapTheme,
          heatmapOpacity: overrides.heatmapOpacity ?? heatmapOpacity,
          fogThreshold: overrides.fogThreshold ?? fogThreshold,
          splitPosition: overrides.splitPosition ?? splitPosition,
          scrubberTimeSec: overrides.scrubberTimeSec ?? scrubberTimeSec,
          updatedAt: Date.now(),
          ...overrides,
        };

        const updatedList = [...currentProjects];
        updatedList[idx] = updatedProject;
        saveAllProjects(updatedList);
        setLastSavedTime(Date.now());
        return updatedList;
      });
    },
    [
      activeProjectId,
      activeAssetTitle,
      domainPreset,
      modelTier,
      scriptDirection,
      viewingDuration,
      aois,
      visualMode,
      colormapTheme,
      heatmapOpacity,
      fogThreshold,
      splitPosition,
      scrubberTimeSec,
    ]
  );

  // Runs saliency analysis on the currently loaded imageElement
  const triggerAnalysis = useCallback(
    async (
      img: HTMLImageElement,
      preset: DomainPreset,
      currentAois: AOIRegion[] = [],
      tier: ModelTier = modelTier,
      scriptDir: ScriptDirection = scriptDirection,
      duration: ViewingDuration = viewingDuration
    ) => {
      const reqId = ++activeReqIdRef.current;
      setIsAnalyzing(true);

      try {
        // Extract 32-bit RGBA pixel buffer on offscreen canvas
        const offCanvas = document.createElement('canvas');
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        offCanvas.width = w;
        offCanvas.height = h;

        const ctx = offCanvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('Failed to get 2D canvas context');

        ctx.drawImage(img, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);

        const result = await executeSaliencyAnalysis(imgData.data, w, h, {
          domainPreset: preset,
          modelTier: tier,
          scriptDirection: scriptDir,
          viewingDuration: duration,
        });

        // Guard against race conditions
        if (reqId === activeReqIdRef.current) {
          setAnalysisResult(result);

          // Re-integrate all active AOIs against the new tensor
          if (currentAois.length > 0) {
            const updated = recalculateAllAOIs(
              currentAois,
              result.saliencyMap,
              result.width,
              result.height,
              result.fixations
            );
            setAois(updated);
          }
        }
      } catch (err) {
        console.error('Saliency analysis failed:', err);
      } finally {
        if (reqId === activeReqIdRef.current) {
          setIsAnalyzing(false);
        }
      }
    },
    []
  );

  // Activates and renders a specific project
  const activateProject = useCallback(
    (project: StudioProject) => {
      setActiveId(project.id);
      setActiveProjectId(project.id);
      setActiveAssetTitle(project.name);
      setDomainPreset(project.domainPreset);
      setModelTier(project.modelTier || 'hybrid');
      setScriptDirection(project.scriptDirection || 'ltr');
      setViewingDuration(project.viewingDuration || '3s');
      setAois(project.aois || []);
      setSelectedAoiId(null);
      setVisualMode(project.visualMode || 'heatmap');
      setColormapTheme(project.colormapTheme || 'turbo');
      setHeatmapOpacity(project.heatmapOpacity ?? 0.7);
      setFogThreshold(project.fogThreshold ?? 0.35);
      setSplitPosition(project.splitPosition ?? 0.5);
      setScrubberTimeSec(project.scrubberTimeSec ?? 5.0);

      if (project.imageDataUrl) {
        const img = new Image();
        img.onload = () => {
          setImageElement(img);
          triggerAnalysis(
            img,
            project.domainPreset,
            project.aois || [],
            project.modelTier || 'hybrid',
            project.scriptDirection || 'ltr',
            project.viewingDuration || '3s'
          );
        };
        img.src = project.imageDataUrl;
      }
    },
    [triggerAnalysis]
  );

  // Initial load: restore saved projects from localStorage, or populate with defaults
  useEffect(() => {
    const saved = loadAllProjects();

    if (saved.length > 0) {
      setProjects(saved);
      const activeId = getActiveProjectId();
      const target = saved.find((p) => p.id === activeId) || saved[0];
      activateProject(target);
    } else {
      // First-time visit: generate default SaaS Landing Page sample project
      const sample = PROCEDURAL_STUDIO_SAMPLES[0];
      const dataUrl = sample.generateDataUrl();
      const initialWithMetrics: AOIRegion[] = sample.initialAOIs.map((a) => ({
        ...a,
        shareOfAttention: 0,
        noticeability: 1.0,
        ttffMs: null,
      }));

      const defaultProject: StudioProject = {
        id: generateUniqueId('proj'),
        name: sample.name,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        imageDataUrl: dataUrl,
        width: sample.width,
        height: sample.height,
        domainPreset: sample.domainPreset,
        aois: initialWithMetrics,
        visualMode: 'heatmap',
        colormapTheme: 'turbo',
        heatmapOpacity: 0.7,
        fogThreshold: 0.35,
        splitPosition: 0.5,
        scrubberTimeSec: 5.0,
      };

      persistProject(defaultProject);
      setProjects([defaultProject]);
      activateProject(defaultProject);
    }
  }, [activateProject]);

  // Load a procedural sample as a new project or active asset
  const loadProceduralSample = useCallback(
    (sampleId: string) => {
      const sample =
        PROCEDURAL_STUDIO_SAMPLES.find((s) => s.id === sampleId) || PROCEDURAL_STUDIO_SAMPLES[0];

      const dataUrl = sample.generateDataUrl();
      const initialWithMetrics: AOIRegion[] = sample.initialAOIs.map((a) => ({
        ...a,
        shareOfAttention: 0,
        noticeability: 1.0,
        ttffMs: null,
      }));

      const newProj: StudioProject = {
        id: generateUniqueId('proj'),
        name: sample.name,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        imageDataUrl: dataUrl,
        width: sample.width,
        height: sample.height,
        domainPreset: sample.domainPreset,
        aois: initialWithMetrics,
        visualMode: 'heatmap',
        colormapTheme: 'turbo',
        heatmapOpacity: 0.7,
        fogThreshold: 0.35,
        splitPosition: 0.5,
        scrubberTimeSec: 5.0,
      };

      persistProject(newProj);
      setProjects((prev) => [...prev, newProj]);
      activateProject(newProj);
    },
    [activateProject]
  );

  // Handle Domain Preset Change
  const handleChangeDomainPreset = (preset: DomainPreset) => {
    setDomainPreset(preset);
    saveCurrentProjectState({ domainPreset: preset });
    if (imageElement) {
      triggerAnalysis(imageElement, preset, aois, modelTier, scriptDirection, viewingDuration);
    }
  };

  // Handle Model Tier Change (Accurate Hybrid, Fast Browser, Empirical, Deep Ensemble)
  const handleChangeModelTier = (tier: ModelTier) => {
    setModelTier(tier);
    saveCurrentProjectState({ modelTier: tier });
    if (imageElement) {
      triggerAnalysis(imageElement, domainPreset, aois, tier, scriptDirection, viewingDuration);
    }
  };

  // Handle Script Direction Change (LTR vs RTL)
  const handleChangeScriptDirection = (dir: ScriptDirection) => {
    setScriptDirection(dir);
    saveCurrentProjectState({ scriptDirection: dir });
    if (imageElement) {
      triggerAnalysis(imageElement, domainPreset, aois, modelTier, dir, viewingDuration);
    }
  };

  // Handle Viewing Duration Change (1s vs 3s vs 7s)
  const handleChangeViewingDuration = (dur: ViewingDuration) => {
    setViewingDuration(dur);
    saveCurrentProjectState({ viewingDuration: dur });
    if (imageElement) {
      triggerAnalysis(imageElement, domainPreset, aois, modelTier, scriptDirection, dur);
    }
  };

  // Handle Website URL Capture
  const handleCaptureUrl = async (url: string, viewport: ViewportMode) => {
    setIsCapturingUrl(true);
    try {
      const { payload, aois: extractedAois } = await captureWebsiteUrl(url, viewport);

      const newProj: StudioProject = {
        id: generateUniqueId('proj'),
        name: new URL(payload.url).hostname || payload.url,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        imageDataUrl: payload.imageBase64,
        width: payload.width,
        height: payload.height,
        domainPreset: 'ui_ux',
        aois: extractedAois,
        visualMode: 'heatmap',
        colormapTheme: 'turbo',
        heatmapOpacity: 0.7,
        fogThreshold: 0.35,
        splitPosition: 0.5,
        scrubberTimeSec: 5.0,
      };

      persistProject(newProj);
      setProjects((prev) => [...prev, newProj]);
      activateProject(newProj);
    } catch (err) {
      console.error('Failed to capture website URL:', err);
    } finally {
      setIsCapturingUrl(false);
    }
  };

  // Handle User File Upload - Creates & Remembers Project
  const handleLoadUserImage = (img: HTMLImageElement, filename: string) => {
    // Generate safe storage data URL (max 1280px for local persistence quota)
    const storeCanvas = document.createElement('canvas');
    const maxDim = 1280;
    const scale = Math.min(1.0, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    storeCanvas.width = Math.round(img.naturalWidth * scale);
    storeCanvas.height = Math.round(img.naturalHeight * scale);

    const sctx = storeCanvas.getContext('2d');
    if (sctx) {
      sctx.drawImage(img, 0, 0, storeCanvas.width, storeCanvas.height);
    }
    const dataUrl = storeCanvas.toDataURL('image/jpeg', 0.88);

    const newProj: StudioProject = {
      id: generateUniqueId('proj'),
      name: filename.replace(/\.[^/.]+$/, '') || 'Uploaded Creative',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      imageDataUrl: dataUrl,
      width: img.naturalWidth,
      height: img.naturalHeight,
      domainPreset: domainPreset,
      aois: [],
      visualMode: 'heatmap',
      colormapTheme: 'turbo',
      heatmapOpacity: 0.7,
      fogThreshold: 0.35,
      splitPosition: 0.5,
      scrubberTimeSec: 5.0,
    };

    persistProject(newProj);
    setProjects((prev) => [...prev, newProj]);
    activateProject(newProj);
  };

  // AOI Updates from Canvas - Auto-saved to project
  const handleUpdateAOIs = (updatedAois: AOIRegion[]) => {
    setAois(updatedAois);
    saveCurrentProjectState({ aois: updatedAois });
  };

  const handleDeleteAoi = (id: string) => {
    const updated = aois.filter((a) => a.id !== id);
    setAois(updated);
    if (selectedAoiId === id) setSelectedAoiId(null);
    saveCurrentProjectState({ aois: updated });
  };

  // Project Management Actions
  const handleSelectProject = (id: string) => {
    const target = projects.find((p) => p.id === id);
    if (target) {
      activateProject(target);
    }
  };

  const handleCreateNewProject = () => {
    setIsUploadOpen(true);
  };

  const handleRenameProject = (id: string, newName: string) => {
    const updatedList = projects.map((p) =>
      p.id === id ? { ...p, name: newName, updatedAt: Date.now() } : p
    );
    setProjects(updatedList);
    saveAllProjects(updatedList);
    if (activeProjectId === id) {
      setActiveAssetTitle(newName);
    }
    setLastSavedTime(Date.now());
  };

  const handleDeleteProject = (id: string) => {
    const remaining = removeProject(id);
    setProjects(remaining);
    if (activeProjectId === id && remaining.length > 0) {
      activateProject(remaining[remaining.length - 1]);
    }
  };

  return (
    <div className="flex flex-col w-screen h-screen bg-[#08090E] text-zinc-100 overflow-hidden font-sans">
      {/* 1. Studio Top Navigation & Global Command Bar with Projects System */}
      <StudioHeader
        domainPreset={domainPreset}
        onChangeDomainPreset={handleChangeDomainPreset}
        modelTier={modelTier}
        onChangeModelTier={handleChangeModelTier}
        scriptDirection={scriptDirection}
        onChangeScriptDirection={handleChangeScriptDirection}
        viewingDuration={viewingDuration}
        onChangeViewingDuration={handleChangeViewingDuration}
        onSelectProceduralSample={loadProceduralSample}
        onCaptureUrl={handleCaptureUrl}
        isCapturingUrl={isCapturingUrl}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onOpenSpecs={() => setIsSpecsOpen(true)}
        isAnalyzing={isAnalyzing}
        activeAssetTitle={activeAssetTitle}
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={handleSelectProject}
        onCreateProject={handleCreateNewProject}
        onDeleteProject={handleDeleteProject}
        onRenameProject={handleRenameProject}
        lastSavedTime={lastSavedTime}
        onToggleMobileMetrics={() => setIsMobileMetricsOpen((v) => !v)}
      />

      {/* 2. Visual Mode Selector & Controls Bar */}
      <StudioControlsRail
        visualMode={visualMode}
        onChangeVisualMode={(m) => {
          setVisualMode(m);
          saveCurrentProjectState({ visualMode: m });
        }}
        colormapTheme={colormapTheme}
        onChangeColormapTheme={(t) => {
          setColormapTheme(t);
          saveCurrentProjectState({ colormapTheme: t });
        }}
        heatmapOpacity={heatmapOpacity}
        onChangeHeatmapOpacity={(o) => {
          setHeatmapOpacity(o);
          saveCurrentProjectState({ heatmapOpacity: o });
        }}
        fogThreshold={fogThreshold}
        onChangeFogThreshold={(f) => {
          setFogThreshold(f);
          saveCurrentProjectState({ fogThreshold: f });
        }}
        splitPosition={splitPosition}
        onChangeSplitPosition={(p) => {
          setSplitPosition(p);
          saveCurrentProjectState({ splitPosition: p });
        }}
        scrubberTimeSec={scrubberTimeSec}
        onChangeScrubberTimeSec={(s) => {
          setScrubberTimeSec(s);
          saveCurrentProjectState({ scrubberTimeSec: s });
        }}
        viewingDuration={viewingDuration}
        showContours={showContours}
        onChangeShowContours={setShowContours}
      />

      {/* 3. Main Workspace: Interactive Viewport + Right Telemetry Rail */}
      <main className="flex-1 flex overflow-hidden relative">
        <StudioCanvas
          imageElement={imageElement}
          analysisResult={analysisResult}
          visualMode={visualMode}
          colormapTheme={colormapTheme}
          heatmapOpacity={heatmapOpacity}
          fogThreshold={fogThreshold}
          splitPosition={splitPosition}
          scrubberTimeSec={scrubberTimeSec}
          aois={aois}
          onUpdateAOIs={handleUpdateAOIs}
          selectedAoiId={selectedAoiId}
          onSelectAoi={setSelectedAoiId}
          secondaryImageElement={secondaryImageElement}
          showContours={showContours}
          onChangeVisualMode={(m) => {
            setVisualMode(m);
            saveCurrentProjectState({ visualMode: m });
          }}
        />

        {/* Desktop Fixed Telemetry Rail */}
        <div className="hidden lg:block h-full">
          <StudioMetricsRail
            analysis={analysisResult}
            aois={aois}
            onSelectAoi={setSelectedAoiId}
            selectedAoiId={selectedAoiId}
            onDeleteAoi={handleDeleteAoi}
          />
        </div>

        {/* Mobile Slide-Over Telemetry Rail Drawer */}
        {isMobileMetricsOpen && (
          <div className="lg:hidden absolute inset-0 z-40 flex justify-end">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
              onClick={() => setIsMobileMetricsOpen(false)}
            />
            {/* Drawer Panel */}
            <div className="relative w-full max-w-sm sm:max-w-md h-full bg-[#11131C] border-l border-white/15 shadow-2xl z-10 animate-in slide-in-from-right duration-200">
              <StudioMetricsRail
                analysis={analysisResult}
                aois={aois}
                onSelectAoi={setSelectedAoiId}
                selectedAoiId={selectedAoiId}
                onDeleteAoi={handleDeleteAoi}
                onCloseMobile={() => setIsMobileMetricsOpen(false)}
              />
            </div>
          </div>
        )}
      </main>

      {/* 4. Modals */}
      <StudioUploadModal
        open={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onLoadImage={handleLoadUserImage}
      />

      <StudioExportModal
        open={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        analysis={analysisResult}
        aois={aois}
        domainPreset={domainPreset}
        activeAssetTitle={activeAssetTitle}
      />

      <SpecsModal
        open={isSpecsOpen}
        onClose={() => setIsSpecsOpen(false)}
      />
    </div>
  );
}

export default App;

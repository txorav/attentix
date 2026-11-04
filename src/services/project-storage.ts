import { AOIRegion, ColormapTheme, DomainPreset, ModelTier, ScriptDirection, ViewingDuration, VisualMode } from '../types/studio';

export interface StudioProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  imageDataUrl: string;
  width: number;
  height: number;
  domainPreset: DomainPreset;
  modelTier?: ModelTier;
  scriptDirection?: ScriptDirection;
  viewingDuration?: ViewingDuration;
  aois: AOIRegion[];
  visualMode: VisualMode;
  colormapTheme: ColormapTheme;
  heatmapOpacity: number;
  fogThreshold: number;
  splitPosition: number;
  scrubberTimeSec: number;
  metrics?: {
    clarityScore: number;
    cognitiveLoadScore: number;
  };
}

const STORAGE_PROJECTS_KEY = 'attentix_studio_projects';
const STORAGE_ACTIVE_ID_KEY = 'attentix_studio_active_id';

let idCounter = 0;
export function generateUniqueId(prefix = 'proj'): string {
  idCounter++;
  return `${prefix}_${Date.now()}_${idCounter}`;
}

/**
 * Loads all saved projects from localStorage
 */
export function loadAllProjects(): StudioProject[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed to load projects from storage:', err);
    return [];
  }
}

/**
 * Saves all projects to localStorage with quota-safety
 */
export function saveAllProjects(projects: StudioProject[]): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(STORAGE_PROJECTS_KEY, JSON.stringify(projects));
    return true;
  } catch (err) {
    console.warn('LocalStorage quota reached, pruning oldest project payloads:', err);
    try {
      // If quota exceeded, retain recent 10 projects and trim thumbnail sizes
      const trimmed = projects.slice(-10).map((p, idx) => {
        if (idx < projects.length - 2 && p.imageDataUrl.length > 50000) {
          return { ...p, imageDataUrl: '' }; // Drop heavy data url for older non-active projects
        }
        return p;
      });
      localStorage.setItem(STORAGE_PROJECTS_KEY, JSON.stringify(trimmed));
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Retrieves the currently active project ID
 */
export function getActiveProjectId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_ACTIVE_ID_KEY);
  } catch {
    return null;
  }
}

/**
 * Sets the currently active project ID
 */
export function setActiveProjectId(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_ACTIVE_ID_KEY, id);
  } catch {}
}

/**
 * Saves or updates a specific project
 */
export function persistProject(project: StudioProject): void {
  const all = loadAllProjects();
  const index = all.findIndex((p) => p.id === project.id);
  const updated = { ...project, updatedAt: Date.now() };

  if (index >= 0) {
    all[index] = updated;
  } else {
    all.push(updated);
  }

  saveAllProjects(all);
  setActiveProjectId(updated.id);
}

/**
 * Deletes a project by ID
 */
export function removeProject(id: string): StudioProject[] {
  const all = loadAllProjects();
  const filtered = all.filter((p) => p.id !== id);
  saveAllProjects(filtered);

  const activeId = getActiveProjectId();
  if (activeId === id) {
    const nextId = filtered.length > 0 ? filtered[filtered.length - 1].id : '';
    if (nextId) {
      setActiveProjectId(nextId);
    } else {
      localStorage.removeItem(STORAGE_ACTIVE_ID_KEY);
    }
  }

  return filtered;
}

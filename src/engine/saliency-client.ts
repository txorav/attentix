import { runSaliencyAnalysis, SaliencyOptions } from './saliency-engine';
import { SaliencyTensorResult } from '../types/studio';

let workerInstance: Worker | null = null;
const pendingRequests = new Map<
  string,
  {
    resolve: (res: SaliencyTensorResult) => void;
    reject: (err: any) => void;
  }
>();

function getWorker(): Worker | null {
  if (typeof window === 'undefined') return null;
  if (!workerInstance && typeof Worker !== 'undefined') {
    try {
      workerInstance = new Worker(
        new URL('../workers/saliency.worker.ts', import.meta.url),
        { type: 'module' }
      );

      workerInstance.onmessage = (e: MessageEvent) => {
        const { id, type, result, error } = e.data;
        const pending = pendingRequests.get(id);
        if (pending) {
          pendingRequests.delete(id);
          if (type === 'ANALYSIS_COMPLETE' && result) {
            pending.resolve(result);
          } else {
            pending.reject(new Error(error || 'Worker analysis failed'));
          }
        }
      };

      workerInstance.onerror = (err) => {
        console.warn('Saliency worker encountered an error, falling back to sync:', err);
        workerInstance = null;
      };
    } catch {
      workerInstance = null;
    }
  }
  return workerInstance;
}

/**
 * Executes visual attention saliency analysis via Web Worker with automatic synchronous fallback.
 */
let reqCounter = 0;
export async function executeSaliencyAnalysis(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  options: SaliencyOptions = {}
): Promise<SaliencyTensorResult> {
  const worker = getWorker();

  if (worker) {
    const id = `req_${Date.now()}_${++reqCounter}`;
    return new Promise<SaliencyTensorResult>((resolve) => {
      const fallbackTimer = setTimeout(() => {
        if (pendingRequests.has(id)) {
          pendingRequests.delete(id);
          console.warn('Worker timed out, executing synchronous fallback...');
          try {
            resolve(runSaliencyAnalysis(rgba, width, height, options));
          } catch (syncErr) {
            console.error('Synchronous fallback failed:', syncErr);
          }
        }
      }, 25000);

      pendingRequests.set(id, {
        resolve: (res) => {
          clearTimeout(fallbackTimer);
          resolve(res);
        },
        reject: (err) => {
          clearTimeout(fallbackTimer);
          console.warn('Worker rejected request, falling back to sync:', err);
          try {
            resolve(runSaliencyAnalysis(rgba, width, height, options));
          } catch {
            // ignore
          }
        },
      });

      try {
        worker.postMessage({
          id,
          type: 'RUN_ANALYSIS',
          rgba,
          width,
          height,
          options,
        });
      } catch (postErr) {
        clearTimeout(fallbackTimer);
        pendingRequests.delete(id);
        // Fallback to sync immediately
        resolve(runSaliencyAnalysis(rgba, width, height, options));
      }
    });
  }

  // Synchronous execution fallback (Node.js / unsupported worker envs)
  return runSaliencyAnalysis(rgba, width, height, options);
}

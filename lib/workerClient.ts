/**
 * Worker Client — typed wrapper for communicating with the annotation worker.
 *
 * Usage:
 *   const client = new WorkerClient();
 *   const smoothed = await client.smoothStroke(points, { tension: 0.5 });
 *   client.dispose();
 */

interface WorkerPoint {
  x: number;
  y: number;
  pressure?: number;
}

interface WorkerAnnotation {
  id: string;
  type: string;
  coordinates: WorkerPoint[];
  properties: Record<string, any>;
}

interface SmoothOptions {
  tension?: number;
  closed?: boolean;
}

type PendingResolve = (value: any) => void;
type PendingReject = (reason: any) => void;

export class WorkerClient {
  private worker: Worker | null = null;
  private pending = new Map<string, { resolve: PendingResolve; reject: PendingReject }>();
  private idCounter = 0;

  constructor() {
    if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(new URL('./annotationWorker.ts', import.meta.url), { type: 'module' });
        this.worker.onmessage = this.handleMessage;
        this.worker.onerror = this.handleError;
      } catch {
        // Workers not supported or blocked — fall back to inline
        this.worker = null;
      }
    }
  }

  get isAvailable(): boolean {
    return this.worker !== null;
  }

  async smoothStroke(points: WorkerPoint[], options: SmoothOptions = {}): Promise<WorkerPoint[]> {
    if (!this.worker) return points; // fallback: return raw
    return this.send({ type: 'smooth-stroke', points, options });
  }

  async hitTest(point: WorkerPoint, annotations: WorkerAnnotation[], threshold = 8): Promise<string | null> {
    if (!this.worker) return null;
    const result = await this.send({ type: 'hit-test', point, annotations, threshold });
    return result.hitId ?? null;
  }

  async simplify(points: WorkerPoint[], tolerance = 1): Promise<WorkerPoint[]> {
    if (!this.worker) return points;
    return this.send({ type: 'simplify', points, tolerance });
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    for (const [, { reject }] of this.pending) {
      reject(new Error('Worker disposed'));
    }
    this.pending.clear();
  }

  private send(msg: Record<string, any>): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = String(++this.idCounter);
      this.pending.set(id, { resolve, reject });
      this.worker!.postMessage({ ...msg, id });
    });
  }

  private handleMessage = (e: MessageEvent) => {
    const { id, type, ...data } = e.data;
    const handler = this.pending.get(id);
    if (!handler) return;
    this.pending.delete(id);

    if (type === 'error') {
      handler.reject(new Error(data.error));
    } else {
      handler.resolve(data);
    }
  };

  private handleError = (e: ErrorEvent) => {
    console.error('[WorkerClient] Worker error:', e.message);
  };
}

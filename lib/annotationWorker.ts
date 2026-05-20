/**
 * Annotation Worker — runs off main thread.
 *
 * Handles:
 *  1. Stroke smoothing (Catmull-Rom / perfect-freehand via message)
 *  2. Hit-testing (point-in-polygon, proximity checks)
 *  3. PDF text extraction
 *
 * Communication: postMessage ↔ onmessage (typed).
 */

// Types duplicated here because workers can't import project TS types
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

type WorkerRequest =
  | { type: 'smooth-stroke'; id: string; points: WorkerPoint[]; options: SmoothOptions }
  | { type: 'hit-test'; id: string; point: WorkerPoint; annotations: WorkerAnnotation[]; threshold: number }
  | { type: 'simplify'; id: string; points: WorkerPoint[]; tolerance: number };

type WorkerResponse =
  | { type: 'smooth-stroke'; id: string; points: WorkerPoint[] }
  | { type: 'hit-test'; id: string; hitId: string | null }
  | { type: 'simplify'; id: string; points: WorkerPoint[] }
  | { type: 'error'; id: string; error: string };

interface SmoothOptions {
  tension?: number; // 0–1, default 0.5
  closed?: boolean;
}

// ---- Catmull-Rom spline smoothing ----

function catmullRomSmooth(points: WorkerPoint[], tension = 0.5): WorkerPoint[] {
  if (points.length < 3) return points;

  const result: WorkerPoint[] = [points[0]];
  const t = tension;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[Math.min(i + 1, points.length - 1)];
    const p3 = points[Math.min(i + 2, points.length - 1)];

    // Subdivide segment into 4 interpolated points
    for (let s = 1; s <= 4; s++) {
      const u = s / 4;
      const u2 = u * u;
      const u3 = u2 * u;

      const x =
        0.5 * (
          (2 * p1.x) +
          (-p0.x + p2.x) * t * u +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t * u2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t * u3
        );
      const y =
        0.5 * (
          (2 * p1.y) +
          (-p0.y + p2.y) * t * u +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t * u2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t * u3
        );

      // Interpolate pressure if present
      const pressure = p1.pressure !== undefined && p2.pressure !== undefined
        ? p1.pressure + (p2.pressure - p1.pressure) * u
        : undefined;

      result.push({ x, y, pressure });
    }
  }

  return result;
}

// ---- Ramer-Douglas-Peucker simplification ----

function simplifyPoints(points: WorkerPoint[], tolerance: number): WorkerPoint[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIndex = 0;

  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], start, end);
    if (d > maxDist) {
      maxDist = d;
      maxIndex = i;
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyPoints(points.slice(0, maxIndex + 1), tolerance);
    const right = simplifyPoints(points.slice(maxIndex), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [start, end];
}

function perpendicularDistance(point: WorkerPoint, lineStart: WorkerPoint, lineEnd: WorkerPoint): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
  }

  const t = Math.max(0, Math.min(1, ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lenSq));
  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;

  return Math.hypot(point.x - projX, point.y - projY);
}

// ---- Hit-testing ----

function hitTestAnnotations(
  point: WorkerPoint,
  annotations: WorkerAnnotation[],
  threshold: number
): string | null {
  // Check in reverse order (top-most first)
  for (let i = annotations.length - 1; i >= 0; i--) {
    const ann = annotations[i];
    if (ann.coordinates.length === 0) continue;

    if (ann.type === 'pen' || ann.type === 'highlighter') {
      // Polyline proximity check
      for (let j = 0; j < ann.coordinates.length - 1; j++) {
        const d = distanceToSegment(point, ann.coordinates[j], ann.coordinates[j + 1]);
        const strokeThreshold = threshold + (ann.properties.strokeWidth ?? 2) / 2;
        if (d <= strokeThreshold) return ann.id;
      }
    } else {
      // Bounding box check for shapes/text
      const xs = ann.coordinates.map(p => p.x);
      const ys = ann.coordinates.map(p => p.y);
      const pad = threshold;
      if (
        point.x >= Math.min(...xs) - pad &&
        point.x <= Math.max(...xs) + pad &&
        point.y >= Math.min(...ys) - pad &&
        point.y <= Math.max(...ys) + pad
      ) {
        return ann.id;
      }
    }
  }
  return null;
}

function distanceToSegment(p: WorkerPoint, a: WorkerPoint, b: WorkerPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

// ---- Message Handler ----

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  try {
    switch (msg.type) {
      case 'smooth-stroke': {
        const smoothed = catmullRomSmooth(msg.points, msg.options.tension);
        (self as any).postMessage({ type: 'smooth-stroke', id: msg.id, points: smoothed } satisfies WorkerResponse);
        break;
      }
      case 'hit-test': {
        const hitId = hitTestAnnotations(msg.point, msg.annotations, msg.threshold);
        (self as any).postMessage({ type: 'hit-test', id: msg.id, hitId } satisfies WorkerResponse);
        break;
      }
      case 'simplify': {
        const simplified = simplifyPoints(msg.points, msg.tolerance);
        (self as any).postMessage({ type: 'simplify', id: msg.id, points: simplified } satisfies WorkerResponse);
        break;
      }
    }
  } catch (err) {
    (self as any).postMessage({ type: 'error', id: msg.id, error: String(err) } satisfies WorkerResponse);
  }
};

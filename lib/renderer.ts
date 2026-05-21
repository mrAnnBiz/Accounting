/**
 * Renderer Abstraction Layer
 *
 * Decouples annotation rendering from Konva. Implementations can be:
 *  - KonvaRenderer (current — React tree via react-konva)
 *  - Canvas2DRenderer (lightweight, for export / thumbnail)
 *  - SVGRenderer (for accessibility / printing)
 *  - WebGLRenderer (future — smartboard perf)
 *
 * The core app calls IRenderer; the concrete renderer translates to its backend.
 */

import type { Annotation, Point, AnnotationProperties } from '@/types/annotations';

// ---- Types shared across renderers ----

export interface RenderStyle {
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  opacity: number;
  dash?: number[];
  lineCap?: 'butt' | 'round' | 'square';
  lineJoin?: 'miter' | 'round' | 'bevel';
}

export interface RenderTransform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

export interface RenderLayerConfig {
  id: string;
  zIndex: number;
  opacity: number;
  visible: boolean;
}

export interface HitTestResult {
  annotationId: string | null;
  point: Point;
}

// ---- IRenderer interface ----

export interface IRenderer {
  /** Unique renderer name (for logging/debug). */
  readonly name: string;

  /** Initialize (attach to a DOM container). */
  init(container: HTMLElement, width: number, height: number): void;

  /** Resize the rendering surface. */
  resize(width: number, height: number): void;

  /** Clear all rendered content. */
  clear(): void;

  /** Render a set of annotations. */
  renderAnnotations(annotations: Annotation[], transform: RenderTransform): void;

  /** Render a single in-progress annotation (e.g. current stroke). */
  renderActiveAnnotation(points: Point[], style: RenderStyle): void;

  /** Render selection handles around an annotation. */
  renderSelectionHandles(annotation: Annotation): void;

  /** Clear only the active (in-progress) layer. */
  clearActive(): void;

  /** Hit-test a point against rendered annotations. */
  hitTest(point: Point, annotations: Annotation[]): HitTestResult;

  /** Export the current rendering to an image data URL. */
  toDataURL(mimeType?: string, quality?: number): string;

  /** Destroy the renderer and release resources. */
  dispose(): void;
}

// ---- Canvas2D Renderer (lightweight, for export / thumbnail) ----

export class Canvas2DRenderer implements IRenderer {
  readonly name = 'Canvas2D';
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private activeCanvas: HTMLCanvasElement | null = null;
  private activeCtx: CanvasRenderingContext2D | null = null;

  init(container: HTMLElement, width: number, height: number): void {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.ctx = this.canvas.getContext('2d');

    this.activeCanvas = document.createElement('canvas');
    this.activeCanvas.width = width;
    this.activeCanvas.height = height;
    this.activeCanvas.style.position = 'absolute';
    this.activeCanvas.style.top = '0';
    this.activeCanvas.style.left = '0';
    this.activeCtx = this.activeCanvas.getContext('2d');

    container.appendChild(this.canvas);
    container.appendChild(this.activeCanvas);
  }

  resize(width: number, height: number): void {
    if (this.canvas) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    if (this.activeCanvas) {
      this.activeCanvas.width = width;
      this.activeCanvas.height = height;
    }
  }

  clear(): void {
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  clearActive(): void {
    if (this.activeCtx && this.activeCanvas) {
      this.activeCtx.clearRect(0, 0, this.activeCanvas.width, this.activeCanvas.height);
    }
  }

  renderAnnotations(annotations: Annotation[], transform: RenderTransform): void {
    if (!this.ctx || !this.canvas) return;
    this.clear();
    this.ctx.save();
    this.ctx.translate(transform.x, transform.y);
    this.ctx.scale(transform.scaleX, transform.scaleY);
    this.ctx.rotate(transform.rotation);

    for (const ann of annotations) {
      this.renderSingleAnnotation(this.ctx, ann);
    }
    this.ctx.restore();
  }

  renderActiveAnnotation(points: Point[], style: RenderStyle): void {
    if (!this.activeCtx || !this.activeCanvas) return;
    this.clearActive();
    if (points.length < 2) return;

    this.activeCtx.save();
    this.activeCtx.strokeStyle = style.strokeColor;
    this.activeCtx.lineWidth = style.strokeWidth;
    this.activeCtx.globalAlpha = style.opacity;
    this.activeCtx.lineCap = style.lineCap ?? 'round';
    this.activeCtx.lineJoin = style.lineJoin ?? 'round';

    this.activeCtx.beginPath();
    this.activeCtx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      this.activeCtx.lineTo(points[i].x, points[i].y);
    }
    this.activeCtx.stroke();
    this.activeCtx.restore();
  }

  renderSelectionHandles(_annotation: Annotation): void {
    // Minimal implementation — handles drawn as small squares at bbox corners
  }

  hitTest(point: Point, annotations: Annotation[]): HitTestResult {
    // Simple bounding-box hit test
    for (let i = annotations.length - 1; i >= 0; i--) {
      const ann = annotations[i];
      if (ann.coordinates.length === 0) continue;
      const xs = ann.coordinates.map(p => p.x);
      const ys = ann.coordinates.map(p => p.y);
      const minX = Math.min(...xs) - 5;
      const maxX = Math.max(...xs) + 5;
      const minY = Math.min(...ys) - 5;
      const maxY = Math.max(...ys) + 5;
      if (point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY) {
        return { annotationId: ann.id, point };
      }
    }
    return { annotationId: null, point };
  }

  toDataURL(mimeType = 'image/png', quality = 1): string {
    return this.canvas?.toDataURL(mimeType, quality) ?? '';
  }

  dispose(): void {
    this.canvas?.remove();
    this.activeCanvas?.remove();
    this.canvas = null;
    this.activeCanvas = null;
    this.ctx = null;
    this.activeCtx = null;
  }

  private renderSingleAnnotation(ctx: CanvasRenderingContext2D, ann: Annotation): void {
    if (ann.coordinates.length === 0) return;
    const props = ann.properties;

    ctx.save();
    ctx.strokeStyle = props.color ?? '#000';
    ctx.lineWidth = props.strokeWidth ?? 2;
    ctx.globalAlpha = props.opacity ?? 1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (ann.type) {
      case 'pen':
      case 'highlighter': {
        ctx.beginPath();
        ctx.moveTo(ann.coordinates[0].x, ann.coordinates[0].y);
        for (let i = 1; i < ann.coordinates.length; i++) {
          ctx.lineTo(ann.coordinates[i].x, ann.coordinates[i].y);
        }
        ctx.stroke();
        break;
      }
      case 'rectangle': {
        const [p1, p2] = [ann.coordinates[0], ann.coordinates[ann.coordinates.length - 1]];
        if (p1 && p2) {
          ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
        }
        break;
      }
      case 'circle': {
        const [c1, c2] = [ann.coordinates[0], ann.coordinates[ann.coordinates.length - 1]];
        if (c1 && c2) {
          const rx = Math.abs(c2.x - c1.x) / 2;
          const ry = Math.abs(c2.y - c1.y) / 2;
          const cx = (c1.x + c2.x) / 2;
          const cy = (c1.y + c2.y) / 2;
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;
      }
      case 'arrow': {
        const start = ann.coordinates[0];
        const end = ann.coordinates[ann.coordinates.length - 1];
        if (start && end) {
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
          // Arrowhead
          const angle = Math.atan2(end.y - start.y, end.x - start.x);
          const headLen = 10;
          ctx.beginPath();
          ctx.moveTo(end.x, end.y);
          ctx.lineTo(end.x - headLen * Math.cos(angle - Math.PI / 6), end.y - headLen * Math.sin(angle - Math.PI / 6));
          ctx.moveTo(end.x, end.y);
          ctx.lineTo(end.x - headLen * Math.cos(angle + Math.PI / 6), end.y - headLen * Math.sin(angle + Math.PI / 6));
          ctx.stroke();
        }
        break;
      }
      case 'text': {
        const origin = ann.coordinates[0];
        if (origin && ann.properties.text) {
          ctx.fillStyle = props.color ?? '#000';
          ctx.font = `${props.fontSize ?? 14}px ${props.fontFamily ?? 'sans-serif'}`;
          ctx.fillText(ann.properties.text, origin.x, origin.y);
        }
        break;
      }
    }
    ctx.restore();
  }
}

// ---- Factory ----

export type RendererBackend = 'canvas2d' | 'konva' | 'svg' | 'webgl';

/**
 * Create a renderer instance. Currently only Canvas2D is built-in.
 * Konva is used via react-konva in AnnotationCanvas (React tree — not abstracted yet).
 */
export function createRenderer(backend: RendererBackend = 'canvas2d'): IRenderer {
  switch (backend) {
    case 'canvas2d':
      return new Canvas2DRenderer();
    default:
      return new Canvas2DRenderer();
  }
}

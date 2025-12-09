import { Point, PageInfo, Transform, CoordinateSystem } from '../types/annotations';

/**
 * Coordinate transformation utilities for PDF annotations
 * Handles conversion between PDF coordinate space and canvas coordinate space
 */
export class AnnotationCoordinateSystem implements CoordinateSystem {
  /**
   * Convert PDF coordinates to canvas coordinates
   * PDF uses bottom-left origin, canvas uses top-left origin
   * Note: canvasWidth/Height already include zoom, so scale is NOT multiplied here
   */
  pdfToCanvas(pdfPoint: Point, pageInfo: PageInfo): Point {
    const { pdfWidth, pdfHeight, canvasWidth, canvasHeight, offsetX, offsetY } = pageInfo;
    
    // Calculate the scaling factors (canvasWidth already includes zoom)
    const scaleX = canvasWidth / pdfWidth;
    const scaleY = canvasHeight / pdfHeight;
    
    // Convert PDF coordinate (bottom-left origin) to canvas coordinate (top-left origin)
    const canvasX = (pdfPoint.x * scaleX) + offsetX;
    const canvasY = (pdfHeight - pdfPoint.y) * scaleY + offsetY;
    
    return {
      x: canvasX,
      y: canvasY,
      pressure: pdfPoint.pressure
    };
  }

  /**
   * Convert canvas coordinates to PDF coordinates
   * Canvas uses top-left origin, PDF uses bottom-left origin
   * Note: canvasWidth/Height already include zoom, so scale is NOT used here
   */
  canvasToPdf(canvasPoint: Point, pageInfo: PageInfo): Point {
    const { pdfWidth, pdfHeight, canvasWidth, canvasHeight, offsetX, offsetY } = pageInfo;
    
    // Calculate the scaling factors (canvasWidth already includes zoom)
    const scaleX = canvasWidth / pdfWidth;
    const scaleY = canvasHeight / pdfHeight;
    
    // Remove offsets and scale (canvasWidth already includes zoom effects)
    const normalizedX = (canvasPoint.x - offsetX) / scaleX;
    const normalizedY = (canvasPoint.y - offsetY) / scaleY;
    
    // Convert canvas coordinate (top-left origin) to PDF coordinate (bottom-left origin)
    const pdfX = normalizedX;
    const pdfY = pdfHeight - normalizedY;
    
    return {
      x: pdfX,
      y: pdfY,
      pressure: canvasPoint.pressure
    };
  }

  /**
   * Transform a point with given transformation matrix
   */
  transformPoint(point: Point, transform: Transform): Point {
    return {
      x: point.x * transform.scaleX + transform.x,
      y: point.y * transform.scaleY + transform.y,
      pressure: point.pressure
    };
  }

  /**
   * Calculate the bounding box for a set of points
   */
  calculateBounds(points: Point[]): { x: number; y: number; width: number; height: number } {
    if (points.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    let minX = points[0].x;
    let maxX = points[0].x;
    let minY = points[0].y;
    let maxY = points[0].y;

    for (const point of points) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  /**
   * Check if a point is within a bounding box with tolerance
   */
  isPointInBounds(
    point: Point, 
    bounds: { x: number; y: number; width: number; height: number },
    tolerance: number = 5
  ): boolean {
    return (
      point.x >= bounds.x - tolerance &&
      point.x <= bounds.x + bounds.width + tolerance &&
      point.y >= bounds.y - tolerance &&
      point.y <= bounds.y + bounds.height + tolerance
    );
  }

  /**
   * Calculate distance between two points
   */
  distance(point1: Point, point2: Point): number {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate the shortest distance from a point to a line segment
   */
  distanceToLineSegment(point: Point, lineStart: Point, lineEnd: Point): number {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    
    if (lenSq !== 0) { // in case of 0 length line
      param = dot / lenSq;
    }

    let xx, yy;

    if (param < 0) {
      xx = lineStart.x;
      yy = lineStart.y;
    } else if (param > 1) {
      xx = lineEnd.x;
      yy = lineEnd.y;
    } else {
      xx = lineStart.x + param * C;
      yy = lineStart.y + param * D;
    }

    const dx = point.x - xx;
    const dy = point.y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Get page info from PDF.js page and current viewport
   */
  getPageInfo(
    pdfPage: any, // PDF.js page object
    canvas: HTMLCanvasElement,
    viewport: any, // PDF.js viewport
    panOffset: { x: number; y: number } = { x: 0, y: 0 }
  ): PageInfo {
    return {
      pdfWidth: pdfPage.getViewport({ scale: 1 }).width,
      pdfHeight: pdfPage.getViewport({ scale: 1 }).height,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      scale: viewport.scale,
      offsetX: panOffset.x,
      offsetY: panOffset.y
    };
  }

  /**
   * Normalize points for perfect-freehand library
   * Converts canvas points to perfect-freehand format
   */
  normalizePointsForDrawing(points: Point[]): number[][] {
    return points.map(point => [point.x, point.y, point.pressure || 0.5]);
  }

  /**
   * Denormalize points from perfect-freehand format
   */
  denormalizePointsFromDrawing(points: number[][]): Point[] {
    return points.map(point => ({
      x: point[0],
      y: point[1],
      pressure: point[2] || 0.5
    }));
  }
}

// Singleton instance
export const coordinateSystem = new AnnotationCoordinateSystem();

/**
 * Utility functions for common coordinate operations
 */
export const CoordinateUtils = {
  /**
   * Convert mouse/touch event to canvas point
   */
  eventToCanvasPoint(
    event: MouseEvent | TouchEvent,
    canvas: HTMLCanvasElement
  ): Point {
    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;

    if ('touches' in event && event.touches.length > 0) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else if ('clientX' in event) {
      clientX = event.clientX;
      clientY = event.clientY;
    } else {
      return { x: 0, y: 0 };
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
      pressure: this.getPressure(event)
    };
  },

  /**
   * Extract pressure information from pointer events
   */
  getPressure(event: MouseEvent | TouchEvent | PointerEvent): number {
    if ('pressure' in event && event.pressure > 0) {
      return event.pressure;
    }
    if ('force' in event && typeof event.force === 'number' && event.force > 0) {
      return event.force;
    }
    return 0.5; // Default pressure
  },

  /**
   * Smooth a path of points
   */
  smoothPath(points: Point[], smoothing: number = 0.5): Point[] {
    if (points.length < 3) return points;

    const smoothedPoints: Point[] = [points[0]];

    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];

      const smoothedX = curr.x + (prev.x + next.x - 2 * curr.x) * smoothing;
      const smoothedY = curr.y + (prev.y + next.y - 2 * curr.y) * smoothing;

      smoothedPoints.push({
        x: smoothedX,
        y: smoothedY,
        pressure: curr.pressure
      });
    }

    smoothedPoints.push(points[points.length - 1]);
    return smoothedPoints;
  },

  /**
   * Simplify a path by removing redundant points
   */
  simplifyPath(points: Point[], tolerance: number = 2): Point[] {
    if (points.length <= 2) return points;

    const simplified: Point[] = [points[0]];

    for (let i = 1; i < points.length - 1; i++) {
      const prev = simplified[simplified.length - 1];
      const curr = points[i];
      const distance = coordinateSystem.distance(prev, curr);

      if (distance >= tolerance) {
        simplified.push(curr);
      }
    }

    simplified.push(points[points.length - 1]);
    return simplified;
  }
};
import { 
  Annotation, 
  Point, 
  Bounds, 
  AnnotationSelection, 
  SelectionHandle,
  EditingState
} from '../types/annotations';
import { coordinateSystem } from './coordinates';

/**
 * Selection and editing utilities for annotations
 */
export class AnnotationSelectionManager {
  private static instance: AnnotationSelectionManager;

  public static getInstance(): AnnotationSelectionManager {
    if (!AnnotationSelectionManager.instance) {
      AnnotationSelectionManager.instance = new AnnotationSelectionManager();
    }
    return AnnotationSelectionManager.instance;
  }

  /**
   * Calculate bounding box for an annotation
   */
  getAnnotationBounds(annotation: Annotation): Bounds {
    if (annotation.coordinates.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    const bounds = coordinateSystem.calculateBounds(annotation.coordinates);
    
    // Add padding for selection handles
    const padding = 10;
    return {
      x: bounds.x - padding,
      y: bounds.y - padding,
      width: bounds.width + (padding * 2),
      height: bounds.height + (padding * 2)
    };
  }

  /**
   * Check if a point is within annotation bounds
   */
  isPointInAnnotation(point: Point, annotation: Annotation, tolerance: number = 5): boolean {
    const bounds = this.getAnnotationBounds(annotation);
    return coordinateSystem.isPointInBounds(point, bounds, tolerance);
  }

  /**
   * Find annotation at given point
   */
  findAnnotationAtPoint(point: Point, annotations: Annotation[]): Annotation | null {
    // Check from top to bottom (reverse order for proper z-index)
    for (let i = annotations.length - 1; i >= 0; i--) {
      const annotation = annotations[i];
      if (this.isPointInAnnotation(point, annotation)) {
        return annotation;
      }
    }
    return null;
  }

  /**
   * Generate selection handles for an annotation
   */
  generateSelectionHandles(annotation: Annotation): SelectionHandle[] {
    const bounds = this.getAnnotationBounds(annotation);
    const handles: SelectionHandle[] = [];

    // Corner handles for resizing
    handles.push(
      {
        id: 'top-left',
        type: 'corner',
        position: { x: bounds.x, y: bounds.y },
        cursor: 'nw-resize'
      },
      {
        id: 'top-right',
        type: 'corner',
        position: { x: bounds.x + bounds.width, y: bounds.y },
        cursor: 'ne-resize'
      },
      {
        id: 'bottom-left',
        type: 'corner',
        position: { x: bounds.x, y: bounds.y + bounds.height },
        cursor: 'sw-resize'
      },
      {
        id: 'bottom-right',
        type: 'corner',
        position: { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
        cursor: 'se-resize'
      }
    );

    // Edge handles for resizing
    handles.push(
      {
        id: 'top',
        type: 'edge',
        position: { x: bounds.x + bounds.width / 2, y: bounds.y },
        cursor: 'n-resize'
      },
      {
        id: 'bottom',
        type: 'edge',
        position: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height },
        cursor: 's-resize'
      },
      {
        id: 'left',
        type: 'edge',
        position: { x: bounds.x, y: bounds.y + bounds.height / 2 },
        cursor: 'w-resize'
      },
      {
        id: 'right',
        type: 'edge',
        position: { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 },
        cursor: 'e-resize'
      }
    );

    // Delete handle
    handles.push({
      id: 'delete',
      type: 'delete',
      position: { x: bounds.x + bounds.width + 5, y: bounds.y - 5 },
      cursor: 'pointer'
    });

    // Rotation handle (for shapes)
    if (['rectangle', 'circle', 'arrow', 'line'].includes(annotation.type)) {
      handles.push({
        id: 'rotate',
        type: 'rotate',
        position: { x: bounds.x + bounds.width / 2, y: bounds.y - 20 },
        cursor: 'grab'
      });
    }

    return handles;
  }

  /**
   * Create annotation selection object
   */
  createAnnotationSelection(annotation: Annotation): AnnotationSelection {
    return {
      annotationId: annotation.id,
      bounds: this.getAnnotationBounds(annotation),
      handles: this.generateSelectionHandles(annotation)
    };
  }

  /**
   * Check if point is within a selection handle
   */
  getHandleAtPoint(point: Point, selection: AnnotationSelection): SelectionHandle | null {
    const tolerance = 8; // Handle hit area
    
    for (const handle of selection.handles) {
      const distance = coordinateSystem.distance(point, handle.position);
      if (distance <= tolerance) {
        return handle;
      }
    }
    
    return null;
  }

  /**
   * Calculate new annotation coordinates after resize
   */
  resizeAnnotation(
    annotation: Annotation,
    handle: SelectionHandle,
    newPosition: Point,
    originalBounds: Bounds
  ): Point[] {
    const bounds = this.getAnnotationBounds(annotation);
    const deltaX = newPosition.x - handle.position.x;
    const deltaY = newPosition.y - handle.position.y;

    // Calculate scale factors based on handle type
    let scaleX = 1;
    let scaleY = 1;
    let offsetX = 0;
    let offsetY = 0;

    switch (handle.id) {
      case 'top-left':
        scaleX = (bounds.width - deltaX) / bounds.width;
        scaleY = (bounds.height - deltaY) / bounds.height;
        offsetX = deltaX;
        offsetY = deltaY;
        break;
      case 'top-right':
        scaleX = (bounds.width + deltaX) / bounds.width;
        scaleY = (bounds.height - deltaY) / bounds.height;
        offsetY = deltaY;
        break;
      case 'bottom-left':
        scaleX = (bounds.width - deltaX) / bounds.width;
        scaleY = (bounds.height + deltaY) / bounds.height;
        offsetX = deltaX;
        break;
      case 'bottom-right':
        scaleX = (bounds.width + deltaX) / bounds.width;
        scaleY = (bounds.height + deltaY) / bounds.height;
        break;
      case 'top':
        scaleY = (bounds.height - deltaY) / bounds.height;
        offsetY = deltaY;
        break;
      case 'bottom':
        scaleY = (bounds.height + deltaY) / bounds.height;
        break;
      case 'left':
        scaleX = (bounds.width - deltaX) / bounds.width;
        offsetX = deltaX;
        break;
      case 'right':
        scaleX = (bounds.width + deltaX) / bounds.width;
        break;
    }

    // Apply transformation to annotation coordinates
    return annotation.coordinates.map(point => ({
      x: (point.x - bounds.x) * scaleX + bounds.x + offsetX,
      y: (point.y - bounds.y) * scaleY + bounds.y + offsetY,
      pressure: point.pressure
    }));
  }

  /**
   * Move annotation by delta
   */
  moveAnnotation(annotation: Annotation, delta: Point): Point[] {
    return annotation.coordinates.map(point => ({
      x: point.x + delta.x,
      y: point.y + delta.y,
      pressure: point.pressure
    }));
  }

  /**
   * Check if annotation can be edited
   */
  canEditAnnotation(annotation: Annotation): boolean {
    // Text annotations can be edited inline
    if (annotation.type === 'text') return true;
    
    // Shapes can be resized and moved
    if (['rectangle', 'circle', 'arrow', 'line'].includes(annotation.type)) return true;
    
    // Pen and highlighter can be moved but not resized
    if (['pen', 'highlighter'].includes(annotation.type)) return true;
    
    return false;
  }

  /**
   * Get edit capabilities for annotation type
   */
  getEditCapabilities(annotationType: string) {
    const capabilities = {
      canMove: true,
      canResize: false,
      canRotate: false,
      canEditText: false,
      canChangeColor: true,
      canChangeOpacity: true,
      canChangeStroke: false
    };

    switch (annotationType) {
      case 'text':
        capabilities.canEditText = true;
        capabilities.canResize = true;
        break;
      case 'rectangle':
      case 'circle':
        capabilities.canResize = true;
        capabilities.canRotate = true;
        break;
      case 'arrow':
      case 'line':
        capabilities.canResize = true;
        capabilities.canRotate = true;
        break;
      case 'pen':
      case 'highlighter':
        capabilities.canChangeStroke = true;
        break;
    }

    return capabilities;
  }

  /**
   * Create default editing state
   */
  createDefaultEditingState(): EditingState {
    return {
      selectedAnnotation: null,
      editMode: 'none',
      dragStart: null,
      originalBounds: null,
      tempProperties: {}
    };
  }
}

// Export singleton instance
export const selectionManager = AnnotationSelectionManager.getInstance();
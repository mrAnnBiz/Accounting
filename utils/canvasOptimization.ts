import Konva from 'konva';

/**
 * Canvas optimization utilities for performance improvements
 * Based on research from ANNOTATION_SYSTEM_RESEARCH.md Phase 4 specifications
 */

export interface LayerArchitecture {
  backgroundLayer: Konva.Layer;
  annotationLayer: Konva.Layer;
  activeLayer: Konva.Layer;
}

export class CanvasOptimization {
  /**
   * Set up multi-layer architecture for optimal performance
   * - backgroundLayer: Static PDF content (no event listening)
   * - annotationLayer: Completed annotations (cached, no events)
   * - activeLayer: Currently drawing/editing annotations (event handling)
   */
  static setupLayers(stage: Konva.Stage): LayerArchitecture {
    // Clear existing layers
    stage.destroyChildren();

    // Background layer - PDF content, no interactions
    const backgroundLayer = new Konva.Layer({ 
      listening: false,  // No mouse events for performance
      hitGraphEnabled: false  // Disable hit detection
    });

    // Annotation layer - Completed annotations, cached for performance
    const annotationLayer = new Konva.Layer({ 
      listening: false,  // Completed annotations don't need events
      hitGraphEnabled: false
    });

    // Active layer - Current drawing/editing, full event handling
    const activeLayer = new Konva.Layer({
      listening: true,   // Full interaction support
      hitGraphEnabled: true
    });

    // Add layers in correct order
    stage.add(backgroundLayer);
    stage.add(annotationLayer);  
    stage.add(activeLayer);

    return { backgroundLayer, annotationLayer, activeLayer };
  }

  /**
   * Optimize layer for large datasets with caching and performance tweaks
   */
  static optimizeForLargeDatasets(layer: Konva.Layer): void {
    // Enable layer caching to avoid re-rendering static content
    layer.cache();
    
    // Disable hit detection for static layers
    layer.hitGraphEnabled(false);
    
    // Batch drawing operations to minimize redraws
    layer.listening(false);
    
    // Set optimal quality settings
    layer.imageSmoothingEnabled(false);
  }

  /**
   * Move annotation from active layer to cached annotation layer
   * Called when annotation is completed
   */
  static finalizeAnnotation(
    annotation: Konva.Shape | Konva.Group, 
    activeLayer: Konva.Layer, 
    annotationLayer: Konva.Layer
  ): void {
    // Remove from active layer
    annotation.remove();
    
    // Add to annotation layer
    annotationLayer.add(annotation);
    
    // Disable events on finalized annotation
    annotation.listening(false);
    
    // Batch draw for performance
    annotationLayer.batchDraw();
  }

  /**
   * Optimize stage for high-resolution displays
   */
  static optimizeForHighDPI(stage: Konva.Stage, pixelRatio: number = window.devicePixelRatio): void {
    const container = stage.container();
    const width = container.offsetWidth;
    const height = container.offsetHeight;

    // Set canvas size considering device pixel ratio
    stage.width(width * pixelRatio);
    stage.height(height * pixelRatio);
    
    // Scale stage to maintain visual size
    stage.scale({ x: pixelRatio, y: pixelRatio });
    
    // Set CSS size to maintain layout
    stage.getContent().style.width = width + 'px';
    stage.getContent().style.height = height + 'px';
  }

  /**
   * Implement selective redrawing for better performance
   */
  static setupSelectiveRedraw(layers: LayerArchitecture): void {
    const { backgroundLayer, annotationLayer, activeLayer } = layers;

    // Background rarely changes - minimize redraws
    backgroundLayer.listening(false);
    
    // Annotation layer caching with manual invalidation
    annotationLayer.cache();
    annotationLayer.listening(false);
    
    // Only redraw active layer by default
    activeLayer.on('draw', () => {
      // Custom redraw logic can be added here
    });
  }

  /**
   * Clean up resources to prevent memory leaks
   */
  static cleanup(stage: Konva.Stage): void {
    // Clear all layers
    stage.getLayers().forEach(layer => {
      layer.destroyChildren();
      layer.clearCache();
    });
    
    // Clear stage cache
    stage.clearCache();
    
    // Remove event listeners
    stage.off();
  }

  /**
   * Performance monitoring utilities
   */
  static createPerformanceMonitor() {
    let frameCount = 0;
    let lastTime = performance.now();
    
    return {
      tick: () => {
        frameCount++;
        const currentTime = performance.now();
        
        if (currentTime - lastTime >= 1000) {
          const fps = frameCount;
          console.log(`Canvas FPS: ${fps}`);
          frameCount = 0;
          lastTime = currentTime;
        }
      }
    };
  }
}

/**
 * Memory management utilities for large annotation datasets
 */
export class MemoryManager {
  private static annotationPool: (Konva.Shape | Konva.Group)[] = [];
  private static maxPoolSize = 100;

  /**
   * Object pooling for annotations to reduce GC pressure
   */
  static getPooledAnnotation<T extends Konva.Shape | Konva.Group>(constructor: new () => T): T {
    const pooled = this.annotationPool.pop() as T;
    if (pooled) {
      // Reset pooled object
      pooled.clearCache();
      return pooled;
    }
    return new constructor();
  }

  /**
   * Return annotation to pool for reuse
   */
  static returnToPool(annotation: Konva.Shape | Konva.Group): void {
    if (this.annotationPool.length < this.maxPoolSize) {
      annotation.remove();
      annotation.clearCache();
      this.annotationPool.push(annotation);
    } else {
      annotation.destroy();
    }
  }

  /**
   * Monitor memory usage and clean up when needed
   */
  static monitorMemoryUsage(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const used = memory.usedJSHeapSize / 1048576; // Convert to MB
      const limit = memory.jsHeapSizeLimit / 1048576;
      
      console.log(`Memory usage: ${used.toFixed(2)}MB / ${limit.toFixed(2)}MB`);
      
      // Trigger cleanup if memory usage is high
      if (used / limit > 0.8) {
        this.forceCleanup();
      }
    }
  }

  /**
   * Force garbage collection and cleanup
   */
  static forceCleanup(): void {
    // Clear annotation pool
    this.annotationPool.forEach(annotation => annotation.destroy());
    this.annotationPool = [];
    
    // Force garbage collection if available
    if ('gc' in window) {
      (window as any).gc();
    }
    
    console.log('Forced memory cleanup completed');
  }
}

export default CanvasOptimization;
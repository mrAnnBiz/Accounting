import React from 'react';

/**
 * Advanced annotation caching system for performance optimization
 * Phase 4: Implement caching for static annotations to reduce re-render costs
 */

export interface CachedAnnotation {
  id: string;
  pageNumber: number;
  type: string;
  data: any;
  lastModified: number;
  rendered: boolean;
  canvasCache?: ImageData | HTMLCanvasElement;
}

export interface CacheConfig {
  maxCacheSize: number;
  maxAge: number; // milliseconds
  preloadPages: number;
  enableCanvasCache: boolean;
}

export class AnnotationCache {
  private cache = new Map<string, CachedAnnotation>();
  private pageIndex = new Map<number, Set<string>>(); // pageNumber -> annotationIds
  private lruOrder: string[] = [];
  private config: CacheConfig;
  private hitCount = 0;
  private missCount = 0;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxCacheSize: 1000,
      maxAge: 30 * 60 * 1000, // 30 minutes
      preloadPages: 3,
      enableCanvasCache: true,
      ...config
    };
  }

  /**
   * Cache annotation with automatic eviction and LRU management
   */
  setAnnotation(annotation: CachedAnnotation): void {
    const key = this.getKey(annotation.id, annotation.pageNumber);
    
    // Remove from LRU if already exists
    this.removeLRU(key);
    
    // Add to front of LRU
    this.lruOrder.unshift(key);
    
    // Cache the annotation
    this.cache.set(key, {
      ...annotation,
      lastModified: Date.now()
    });
    
    // Update page index
    if (!this.pageIndex.has(annotation.pageNumber)) {
      this.pageIndex.set(annotation.pageNumber, new Set());
    }
    this.pageIndex.get(annotation.pageNumber)!.add(annotation.id);
    
    // Evict if over limit
    this.evictIfNeeded();
  }

  /**
   * Retrieve cached annotation
   */
  getAnnotation(id: string, pageNumber: number): CachedAnnotation | null {
    const key = this.getKey(id, pageNumber);
    const cached = this.cache.get(key);
    
    if (!cached) {
      this.missCount++;
      return null;
    }
    
    // Check expiry
    if (this.isExpired(cached)) {
      this.removeAnnotation(id, pageNumber);
      this.missCount++;
      return null;
    }
    
    // Update LRU
    this.updateLRU(key);
    this.hitCount++;
    
    return cached;
  }

  /**
   * Get all annotations for a page
   */
  getPageAnnotations(pageNumber: number): CachedAnnotation[] {
    const annotationIds = this.pageIndex.get(pageNumber);
    if (!annotationIds) return [];
    
    const annotations: CachedAnnotation[] = [];
    
    for (const id of annotationIds) {
      const annotation = this.getAnnotation(id, pageNumber);
      if (annotation) {
        annotations.push(annotation);
      }
    }
    
    return annotations;
  }

  /**
   * Remove annotation from cache
   */
  removeAnnotation(id: string, pageNumber: number): void {
    const key = this.getKey(id, pageNumber);
    
    // Remove from cache
    this.cache.delete(key);
    
    // Remove from LRU
    this.removeLRU(key);
    
    // Remove from page index
    const pageAnnotations = this.pageIndex.get(pageNumber);
    if (pageAnnotations) {
      pageAnnotations.delete(id);
      if (pageAnnotations.size === 0) {
        this.pageIndex.delete(pageNumber);
      }
    }
  }

  /**
   * Clear all annotations for a page
   */
  clearPageAnnotations(pageNumber: number): void {
    const annotationIds = this.pageIndex.get(pageNumber);
    if (!annotationIds) return;
    
    for (const id of annotationIds) {
      const key = this.getKey(id, pageNumber);
      this.cache.delete(key);
      this.removeLRU(key);
    }
    
    this.pageIndex.delete(pageNumber);
  }

  /**
   * Cache rendered canvas for annotation
   */
  cacheCanvas(id: string, pageNumber: number, canvas: HTMLCanvasElement): void {
    if (!this.config.enableCanvasCache) return;
    
    const annotation = this.getAnnotation(id, pageNumber);
    if (annotation) {
      // Clone canvas for caching
      const cacheCanvas = document.createElement('canvas');
      cacheCanvas.width = canvas.width;
      cacheCanvas.height = canvas.height;
      const ctx = cacheCanvas.getContext('2d')!;
      ctx.drawImage(canvas, 0, 0);
      
      annotation.canvasCache = cacheCanvas;
      this.setAnnotation(annotation);
    }
  }

  /**
   * Get cached canvas for annotation
   */
  getCachedCanvas(id: string, pageNumber: number): HTMLCanvasElement | null {
    if (!this.config.enableCanvasCache) return null;
    
    const annotation = this.getAnnotation(id, pageNumber);
    return (annotation?.canvasCache as HTMLCanvasElement) || null;
  }

  /**
   * Preload annotations for nearby pages
   */
  preloadAnnotations(currentPage: number, loadAnnotation: (id: string, page: number) => Promise<any>): void {
    const startPage = Math.max(1, currentPage - this.config.preloadPages);
    const endPage = currentPage + this.config.preloadPages;
    
    for (let page = startPage; page <= endPage; page++) {
      if (page === currentPage) continue;
      
      // Check if page annotations are already cached
      const pageAnnotations = this.pageIndex.get(page);
      if (!pageAnnotations || pageAnnotations.size === 0) {
        // Trigger preloading (implementation depends on data source)
        this.schedulePreload(page, loadAnnotation);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    hitRate: number;
    missRate: number;
    memoryUsage: number;
  } {
    const total = this.hitCount + this.missCount;
    return {
      size: this.cache.size,
      hitRate: total > 0 ? this.hitCount / total : 0,
      missRate: total > 0 ? this.missCount / total : 0,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  /**
   * Clear expired annotations
   */
  clearExpired(): number {
    let clearedCount = 0;
    const now = Date.now();
    
    for (const [key, annotation] of this.cache) {
      if (now - annotation.lastModified > this.config.maxAge) {
        this.removeAnnotation(annotation.id, annotation.pageNumber);
        clearedCount++;
      }
    }
    
    return clearedCount;
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.pageIndex.clear();
    this.lruOrder = [];
    this.hitCount = 0;
    this.missCount = 0;
  }

  // Private methods
  private getKey(id: string, pageNumber: number): string {
    return `${pageNumber}:${id}`;
  }

  private removeLRU(key: string): void {
    const index = this.lruOrder.indexOf(key);
    if (index !== -1) {
      this.lruOrder.splice(index, 1);
    }
  }

  private updateLRU(key: string): void {
    this.removeLRU(key);
    this.lruOrder.unshift(key);
  }

  private evictIfNeeded(): void {
    while (this.cache.size > this.config.maxCacheSize) {
      const oldestKey = this.lruOrder.pop();
      if (oldestKey) {
        const [pageStr, id] = oldestKey.split(':');
        this.removeAnnotation(id, parseInt(pageStr));
      }
    }
  }

  private isExpired(annotation: CachedAnnotation): boolean {
    return Date.now() - annotation.lastModified > this.config.maxAge;
  }

  private schedulePreload(page: number, loadAnnotation: (id: string, page: number) => Promise<any>): void {
    // Use requestIdleCallback for non-blocking preloading
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => {
        // Implementation would load annotations for the page
        console.log(`Preloading annotations for page ${page}`);
      });
    }
  }

  private estimateMemoryUsage(): number {
    let totalSize = 0;
    
    for (const annotation of this.cache.values()) {
      // Rough estimation of memory usage
      totalSize += JSON.stringify(annotation.data).length;
      
      if (annotation.canvasCache instanceof HTMLCanvasElement) {
        const canvas = annotation.canvasCache;
        totalSize += canvas.width * canvas.height * 4; // RGBA bytes
      }
    }
    
    return totalSize;
  }
}

/**
 * React hook for annotation caching
 */
export const useAnnotationCache = (config?: Partial<CacheConfig>) => {
  const cacheRef = React.useRef(new AnnotationCache(config));
  const [stats, setStats] = React.useState(cacheRef.current.getStats());

  React.useEffect(() => {
    const interval = setInterval(() => {
      // Clear expired annotations
      cacheRef.current.clearExpired();
      
      // Update stats
      setStats(cacheRef.current.getStats());
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  return {
    cache: cacheRef.current,
    stats
  };
};

/**
 * Higher-order component for annotation caching
 */
export function withAnnotationCache<P extends object>(
  Component: React.ComponentType<P & { cache: AnnotationCache }>
) {
  return function WrappedComponent(props: P) {
    const { cache } = useAnnotationCache();
    return React.createElement(Component, { ...props, cache } as P & { cache: AnnotationCache });
  };
}

export default AnnotationCache;
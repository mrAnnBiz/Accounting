import React, { useMemo, useCallback, useRef, useEffect } from 'react';

/**
 * Simplified virtualized PDF renderer for performance with large documents
 * Phase 4 specifications: Only render visible pages (simplified implementation)
 */

interface VirtualPageData {
  pageNumber: number;
  isVisible: boolean;
  isLoaded: boolean;
  height: number;
}

interface VirtualPDFRendererProps {
  totalPages: number;
  pageHeight: number;
  containerHeight: number;
  renderPage: (pageNumber: number) => React.ReactNode;
  onPageVisibilityChange?: (visiblePages: number[]) => void;
}

export const VirtualPDFRenderer: React.FC<VirtualPDFRendererProps> = ({
  totalPages,
  pageHeight,
  containerHeight,
  renderPage,
  onPageVisibilityChange
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [visibleRange, setVisibleRange] = React.useState({ start: 0, end: 2 });

  // Calculate visible pages based on scroll position
  const updateVisibleRange = useCallback(() => {
    const startIndex = Math.floor(scrollTop / pageHeight);
    const endIndex = Math.min(
      totalPages - 1,
      Math.ceil((scrollTop + containerHeight) / pageHeight) + 1
    );
    
    setVisibleRange({ start: Math.max(0, startIndex), end: endIndex });
    
    const visiblePages = [];
    for (let i = startIndex; i <= endIndex; i++) {
      if (i >= 0 && i < totalPages) {
        visiblePages.push(i + 1);
      }
    }
    
    onPageVisibilityChange?.(visiblePages);
  }, [scrollTop, pageHeight, containerHeight, totalPages, onPageVisibilityChange]);

  useEffect(() => {
    updateVisibleRange();
  }, [updateVisibleRange]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  // Create virtual items
  const virtualItems = useMemo(() => {
    const items = [];
    const totalHeight = totalPages * pageHeight;
    
    // Add spacer before visible items
    if (visibleRange.start > 0) {
      items.push(
        <div key="spacer-top" style={{ height: visibleRange.start * pageHeight }} />
      );
    }
    
    // Add visible items
    for (let i = visibleRange.start; i <= visibleRange.end; i++) {
      if (i < totalPages) {
        items.push(
          <VirtualPageWrapper
            key={i}
            pageNumber={i + 1}
            renderPage={renderPage}
            height={pageHeight}
          />
        );
      }
    }
    
    // Add spacer after visible items
    const remainingHeight = totalHeight - ((visibleRange.end + 1) * pageHeight);
    if (remainingHeight > 0) {
      items.push(
        <div key="spacer-bottom" style={{ height: remainingHeight }} />
      );
    }
    
    return items;
  }, [visibleRange, totalPages, pageHeight, renderPage]);

  return (
    <div
      ref={containerRef}
      style={{
        height: containerHeight,
        overflow: 'auto'
      }}
      onScroll={handleScroll}
    >
      {virtualItems}
    </div>
  );
};

/**
 * Individual page wrapper with lazy loading and unloading
 */
interface VirtualPageWrapperProps {
  pageNumber: number;
  renderPage: (pageNumber: number) => React.ReactNode;
  height?: number;
}

const VirtualPageWrapper: React.FC<VirtualPageWrapperProps> = ({
  pageNumber,
  renderPage,
  height = 600
}) => {
  const [isIntersecting, setIsIntersecting] = React.useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  // Intersection observer for precise visibility detection
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      {
        rootMargin: '100px', // Load pages 100px before they become visible
        threshold: 0.1
      }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={elementRef} className="virtual-page-wrapper" style={{ height }}>
      {isIntersecting ? renderPage(pageNumber) : <PagePlaceholder pageNumber={pageNumber} />}
    </div>
  );
};

/**
 * Placeholder component for non-visible pages
 */
const PagePlaceholder: React.FC<{ pageNumber: number }> = ({ pageNumber }) => (
  <div className="page-placeholder">
    <div className="placeholder-content">
      <span>Page {pageNumber}</span>
      <div className="loading-indicator">Loading...</div>
    </div>
  </div>
);

/**
 * Advanced virtualization manager for complex scenarios
 */
export class VirtualizationManager {
  private loadedPages = new Map<number, any>();
  private maxLoadedPages = 10; // Limit memory usage
  private lruOrder: number[] = [];

  /**
   * Load page with LRU cache management
   */
  loadPage(pageNumber: number, pageData: any): void {
    // Remove from LRU if already exists
    const existingIndex = this.lruOrder.indexOf(pageNumber);
    if (existingIndex !== -1) {
      this.lruOrder.splice(existingIndex, 1);
    }

    // Add to front of LRU
    this.lruOrder.unshift(pageNumber);
    this.loadedPages.set(pageNumber, pageData);

    // Evict oldest pages if over limit
    while (this.lruOrder.length > this.maxLoadedPages) {
      const oldestPage = this.lruOrder.pop()!;
      this.loadedPages.delete(oldestPage);
    }
  }

  /**
   * Get cached page data
   */
  getPage(pageNumber: number): any | null {
    return this.loadedPages.get(pageNumber) || null;
  }

  /**
   * Check if page is loaded
   */
  isPageLoaded(pageNumber: number): boolean {
    return this.loadedPages.has(pageNumber);
  }

  /**
   * Clear all loaded pages
   */
  clearCache(): void {
    this.loadedPages.clear();
    this.lruOrder = [];
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): { loadedPages: number; totalMemory: number } {
    return {
      loadedPages: this.loadedPages.size,
      totalMemory: this.lruOrder.length // Simplified metric
    };
  }
}

/**
 * Hook for managing virtualized PDF state
 */
export const useVirtualizedPDF = (totalPages: number) => {
  const [visiblePages, setVisiblePages] = React.useState<number[]>([]);
  const [loadedPages, setLoadedPages] = React.useState<Set<number>>(new Set());
  const virtualizationManager = useRef(new VirtualizationManager());

  const handlePageVisibilityChange = useCallback((pages: number[]) => {
    setVisiblePages(pages);
    
    // Load visible pages and nearby pages
    pages.forEach(pageNum => {
      if (!loadedPages.has(pageNum)) {
        setLoadedPages(prev => new Set([...prev, pageNum]));
      }
    });
  }, [loadedPages]);

  const unloadPage = useCallback((pageNumber: number) => {
    setLoadedPages(prev => {
      const newSet = new Set(prev);
      newSet.delete(pageNumber);
      return newSet;
    });
  }, []);

  const getPageLoadStatus = useCallback((pageNumber: number) => ({
    isVisible: visiblePages.includes(pageNumber),
    isLoaded: loadedPages.has(pageNumber)
  }), [visiblePages, loadedPages]);

  return {
    visiblePages,
    loadedPages,
    handlePageVisibilityChange,
    unloadPage,
    getPageLoadStatus,
    virtualizationManager: virtualizationManager.current
  };
};

// Utility functions
function areSetsEqual<T>(set1: Set<T>, set2: Set<T>): boolean {
  if (set1.size !== set2.size) return false;
  for (const item of set1) {
    if (!set2.has(item)) return false;
  }
  return true;
}

export default VirtualPDFRenderer;
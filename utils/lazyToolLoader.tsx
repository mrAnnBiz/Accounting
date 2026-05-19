import React, { Suspense, lazy } from 'react';
import { Annotation } from '../types/annotations';

/**
 * Lazy-loaded annotation tools for code splitting optimization
 * Phase 4: Add code splitting and lazy loading to reduce initial bundle size
 */

// Lazy load annotation tool components (placeholders for future implementation)
// Note: These components will be implemented in future phases
const PenTool = lazy(() => Promise.resolve({ default: () => <div>Pen Tool</div> }));
const HighlighterTool = lazy(() => Promise.resolve({ default: () => <div>Highlighter Tool</div> }));
const ShapeTool = lazy(() => Promise.resolve({ default: () => <div>Shape Tool</div> }));
const TextTool = lazy(() => Promise.resolve({ default: () => <div>Text Tool</div> }));
const EraserTool = lazy(() => Promise.resolve({ default: () => <div>Eraser Tool</div> }));
const SelectTool = lazy(() => Promise.resolve({ default: () => <div>Select Tool</div> }));

// Lazy load advanced features (placeholders for future implementation)
const AnnotationExport = lazy(() => Promise.resolve({ default: () => <div>Export Feature</div> }));
const AnnotationImport = lazy(() => Promise.resolve({ default: () => <div>Import Feature</div> }));
const AnnotationSearch = lazy(() => Promise.resolve({ default: () => <div>Search Feature</div> }));
const AnnotationHistory = lazy(() => Promise.resolve({ default: () => <div>History Feature</div> }));

/**
 * Loading fallback component
 */
const ToolLoadingFallback: React.FC<{ toolName?: string }> = ({ toolName = 'Tool' }) => (
  <div className="tool-loading-fallback">
    <div className="loading-spinner" />
    <span>Loading {toolName}...</span>
  </div>
);

/**
 * Lazy tool wrapper with error boundary
 */
interface LazyToolWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  toolName?: string;
}

const LazyToolWrapper: React.FC<LazyToolWrapperProps> = ({ 
  children, 
  fallback,
  toolName 
}) => (
  <Suspense fallback={fallback || <ToolLoadingFallback toolName={toolName} />}>
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  </Suspense>
);

/**
 * Error boundary for lazy-loaded components
 */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="tool-error-fallback">
          <h3>Tool Failed to Load</h3>
          <p>Please refresh the page to try again.</p>
          <details>
            <summary>Error Details</summary>
            <pre>{this.state.error?.stack}</pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Tool registry with lazy loading
 */
export interface ToolConfig {
  id: string;
  name: string;
  icon: string;
  component: React.LazyExoticComponent<any>;
  preload?: boolean;
  dependencies?: string[];
}

export const TOOL_REGISTRY: ToolConfig[] = [
  {
    id: 'pen',
    name: 'Pen',
    icon: 'pen',
    component: PenTool,
    preload: true // Core tool - preload
  },
  {
    id: 'highlighter',
    name: 'Highlighter', 
    icon: 'highlighter',
    component: HighlighterTool,
    preload: true // Core tool - preload
  },
  {
    id: 'shape',
    name: 'Shapes',
    icon: 'shapes',
    component: ShapeTool,
    preload: false
  },
  {
    id: 'text',
    name: 'Text',
    icon: 'text',
    component: TextTool,
    preload: false
  },
  {
    id: 'eraser',
    name: 'Eraser',
    icon: 'eraser',
    component: EraserTool,
    preload: false
  },
  {
    id: 'select',
    name: 'Select',
    icon: 'select',
    component: SelectTool,
    preload: false
  }
];

/**
 * Feature registry for advanced functionality
 */
export const FEATURE_REGISTRY = {
  export: {
    name: 'Export Annotations',
    component: AnnotationExport,
    preload: false
  },
  import: {
    name: 'Import Annotations',
    component: AnnotationImport,
    preload: false
  },
  search: {
    name: 'Search Annotations',
    component: AnnotationSearch,
    preload: false
  },
  history: {
    name: 'Annotation History',
    component: AnnotationHistory,
    preload: false
  }
};

/**
 * Tool loader with preloading support
 */
export class ToolLoader {
  private static preloadedTools = new Set<string>();
  private static loadingPromises = new Map<string, Promise<any>>();

  /**
   * Preload core tools on application start
   */
  static async preloadCoreTools(): Promise<void> {
    const coreTools = TOOL_REGISTRY.filter(tool => tool.preload);
    
    const preloadPromises = coreTools.map(tool => 
      this.preloadTool(tool.id)
    );
    
    await Promise.all(preloadPromises);
    console.log('Core annotation tools preloaded');
  }

  /**
   * Preload specific tool
   */
  static async preloadTool(toolId: string): Promise<void> {
    if (this.preloadedTools.has(toolId)) return;
    
    const tool = TOOL_REGISTRY.find(t => t.id === toolId);
    if (!tool) return;
    
    // Check if already loading
    if (this.loadingPromises.has(toolId)) {
      await this.loadingPromises.get(toolId);
      return;
    }
    
    // Start loading
    const loadPromise = Promise.resolve(); // Simplified for now
    this.loadingPromises.set(toolId, loadPromise);
    
    try {
      await loadPromise;
      this.preloadedTools.add(toolId);
      console.log(`Tool ${toolId} preloaded`);
    } catch (error) {
      console.error(`Failed to preload tool ${toolId}:`, error);
    } finally {
      this.loadingPromises.delete(toolId);
    }
  }

  /**
   * Preload tool on hover (predictive loading)
   */
  static preloadOnHover(toolId: string): void {
    // Use requestIdleCallback for non-blocking preloading
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => {
        this.preloadTool(toolId);
      });
    } else {
      setTimeout(() => this.preloadTool(toolId), 0);
    }
  }

  /**
   * Get tool loading status
   */
  static getLoadingStatus(toolId: string): {
    isPreloaded: boolean;
    isLoading: boolean;
  } {
    return {
      isPreloaded: this.preloadedTools.has(toolId),
      isLoading: this.loadingPromises.has(toolId)
    };
  }
}

/**
 * Dynamic tool loader component
 */
interface DynamicToolProps {
  toolId: string;
  annotations: Annotation[];
  onAnnotationChange: (annotations: Annotation[]) => void;
  [key: string]: any;
}

export const DynamicTool: React.FC<DynamicToolProps> = ({ 
  toolId, 
  ...props 
}) => {
  const tool = TOOL_REGISTRY.find(t => t.id === toolId);
  
  if (!tool) {
    return <div>Tool not found: {toolId}</div>;
  }

  const ToolComponent = tool.component;
  
  return (
    <LazyToolWrapper toolName={tool.name}>
      <ToolComponent />
    </LazyToolWrapper>
  );
};

/**
 * Hook for managing tool loading
 */
export const useToolLoader = () => {
  const [loadingTools, setLoadingTools] = React.useState<Set<string>>(new Set());
  
  const loadTool = React.useCallback(async (toolId: string) => {
    setLoadingTools(prev => new Set([...prev, toolId]));
    
    try {
      await ToolLoader.preloadTool(toolId);
    } finally {
      setLoadingTools(prev => {
        const newSet = new Set(prev);
        newSet.delete(toolId);
        return newSet;
      });
    }
  }, []);

  const preloadOnHover = React.useCallback((toolId: string) => {
    ToolLoader.preloadOnHover(toolId);
  }, []);

  return {
    loadingTools,
    loadTool,
    preloadOnHover,
    getLoadingStatus: ToolLoader.getLoadingStatus
  };
};

/**
 * Bundle size analyzer
 */
export class BundleAnalyzer {
  /**
   * Estimate chunk sizes for tools
   */
  static async analyzeToolSizes(): Promise<Map<string, number>> {
    const sizes = new Map<string, number>();
    
    // This would integrate with webpack-bundle-analyzer in production
    for (const tool of TOOL_REGISTRY) {
      try {
        // Simplified estimation for now
        sizes.set(tool.id, 1000); // Placeholder size
      } catch {
        sizes.set(tool.id, 0);
      }
    }
    
    return sizes;
  }

  /**
   * Get loading priorities based on usage patterns
   */
  static getLoadingPriorities(): { high: string[]; medium: string[]; low: string[] } {
    return {
      high: ['pen', 'highlighter'], // Most used tools
      medium: ['text', 'select'], // Moderately used
      low: ['shape', 'eraser'] // Less frequently used
    };
  }
}

export default DynamicTool;
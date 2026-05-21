'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { AnnotationCanvas } from '@/components/AnnotationCanvas';
import { AnnotationPropertiesEditor } from '@/components/AnnotationPropertiesEditor';
import { 
  Annotation, 
  AnnotationType, 
  AnnotationTool,
  AnnotationProperties,
  PageInfo,
  DEFAULT_ANNOTATION_PROPERTIES,
} from '@/types/annotations';
import { PDFSelection } from '@/components/PDFSelection';

import { useAnnotationCache } from '@/utils/annotationCache';
import { useVirtualizedPDF } from '@/components/VirtualPDFRenderer';
import { ToolLoader } from '@/utils/lazyToolLoader';
import PerformanceMonitor, { PerformanceIndicator } from '@/components/PerformanceMonitor';
import TouchGestureHandler, { useMobileOptimization, MobileOptimizer } from '@/components/TouchGestureHandler';

import CambridgeReferencePanel from '@/components/CambridgeReferencePanel';
import { createStorageManager } from '@/utils/advancedStorage';
import { PDFAnnotationExporter } from '../utils/pdfExporter';

import { toolPreferencesManager } from '@/utils/toolPreferences';

// Architecture modules (Phase 1)
import { getService } from '@/lib/bootstrap';
import { ServiceTokens } from '@/lib/serviceContainer';
import { type SettingsManager } from '@/lib/settingsManager';
import { type SessionTracker } from '@/lib/sessionTracker';
import { type FeatureFlagManager } from '@/lib/featureFlags';

// Extracted hooks
import { usePDFEngine } from '@/hooks/usePDFEngine';
import { useAnnotations } from '@/hooks/useAnnotations';
import { useStylusInput } from '@/hooks/useStylusInput';

// ============================================
// CONSTANTS
// ============================================
const CACHE_CLEANUP_INTERVAL = 60000;
const DEFAULT_PAGE_WIDTH = 595;
const DEFAULT_PAGE_HEIGHT = 842;

export default function EnhancedPDFViewerScrollable() {
  const searchParams = useSearchParams();
  const paperParam = searchParams.get('paper');
  const urlParam = searchParams.get('url');

  // ============================================
  // EXTRACTED HOOKS
  // ============================================
  const pdf = usePDFEngine({ paperParam, urlParam });
  const annotations = useAnnotations({ paperParam, totalPages: pdf.totalPages });

  // ============================================
  // SETTINGS & SESSION (from lib/ modules)
  // ============================================
  const settingsManager = useRef(getService<SettingsManager>(ServiceTokens.SettingsManager)).current;
  const sessionTracker = useRef(getService<SessionTracker>(ServiceTokens.SessionTracker)).current;
  const featureFlags = useRef(getService<FeatureFlagManager>(ServiceTokens.FeatureFlags)).current;
  const adaptiveConfig = settingsManager.getAdaptive();
  const [adaptiveButtonSize, setAdaptiveButtonSize] = useState(adaptiveConfig.buttonSize.toolbar);
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);

  // Local UI state
  const [linkedMarkingScheme, setLinkedMarkingScheme] = useState<string | null>(null);
  const [linkedInsertPaper, setLinkedInsertPaper] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<AnnotationTool>('pan');
  const [toolProperties, setToolProperties] = useState(DEFAULT_ANNOTATION_PROPERTIES.pen);

  // Handle tool selection with preferences
  const handleToolSelect = useCallback((tool: AnnotationTool) => {
    setSelectedTool(tool);
    
    settingsManager.updateSession({ activeToolSelection: tool });

    // Load preferences for the selected tool
    const toolPrefs = settingsManager.getToolPreferences(tool);
    if (toolPrefs && Object.keys(toolPrefs).length > 0) {
      setToolProperties(prev => ({
        ...prev,
        ...toolPrefs
      }));
    } else {
      const preferences = toolPreferencesManager.getPreferences(tool);
      if (preferences && Object.keys(preferences).length > 0) {
        setToolProperties(prev => ({
          ...prev,
          ...preferences
        }));
      }
    }

    // Track tool usage in session
    if (paperParam && tool !== 'pan' && tool !== 'select') {
      sessionTracker.trackAnnotationCreated(paperParam, pdf.displayPageNum, tool as AnnotationType);
    }
  }, [settingsManager, paperParam, pdf.displayPageNum, sessionTracker]);

  // Handle tool property changes and save to preferences
  const handleToolPropertiesChange = useCallback((properties: any) => {
    setToolProperties(properties);
    
    if (selectedTool && selectedTool !== 'pan' && selectedTool !== 'select' && selectedTool !== 'eraser') {
      settingsManager.updateToolPreferences(selectedTool, properties);
      toolPreferencesManager.updatePreferences(selectedTool, properties);
    }
  }, [selectedTool, settingsManager]);

  // Phase 4: Performance optimization state
  const { cache: annotationCache, stats: cacheStats } = useAnnotationCache({
    maxCacheSize: 1000,
    maxAge: 30 * 60 * 1000,
    enableCanvasCache: true
  });
  const { visiblePages, handlePageVisibilityChange } = useVirtualizedPDF(pdf.totalPages);
  const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(
    featureFlags.isEnabled('ui.performanceMonitor')
  );
  
  // Mobile optimization hooks
  const { isMobile, isTablet } = useMobileOptimization();

  // iPad touch/stylus handling
  const { isStylus } = useStylusInput({ containerRef: pdf.containerRef });

  // Phase 6: Advanced features state
  const [referencePanelVisible, setReferencePanelVisible] = useState(false);
  const [storageManager] = useState(() => createStorageManager({
    primaryProvider: 'indexedDB',
    syncInterval: 5 * 60 * 1000, // 5 minutes
    conflictResolution: 'latest',
    maxVersionHistory: 10
  }));
  const [pdfExporter] = useState(() => new PDFAnnotationExporter());
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // ============================================
  // SETTINGS SYNC & DEVICE DETECTION
  // ============================================
  useEffect(() => {
    const handleDeviceChange = () => {
      settingsManager.recomputeAdaptive();
      setAdaptiveButtonSize(settingsManager.getAdaptive().buttonSize.toolbar);
    };

    window.addEventListener('resize', handleDeviceChange);
    return () => window.removeEventListener('resize', handleDeviceChange);
  }, [settingsManager]);

  // ============================================
  // SESSION TRACKING
  // ============================================
  useEffect(() => {
    if (!paperParam) return;
    sessionTracker.startTracking(paperParam);
    return () => { sessionTracker.endTracking(paperParam); };
  }, [paperParam, sessionTracker]);

  useEffect(() => {
    if (paperParam) {
      sessionTracker.trackPageView(paperParam, pdf.displayPageNum);
      settingsManager.updateSession({ currentPage: pdf.displayPageNum, currentZoomLevel: pdf.zoom });
    }
  }, [pdf.displayPageNum, pdf.zoom, paperParam, settingsManager, sessionTracker]);

  // ============================================
  // AUTO-SAVE FUNCTIONALITY
  // ============================================
  useEffect(() => {
    const coreSettings = settingsManager.getCore();
    if (!coreSettings.autoSaveEnabled || !paperParam) return;

    if (autoSaveTimer) clearInterval(autoSaveTimer);

    const timer = setInterval(() => {
      annotations.saveDocument();
    }, coreSettings.autoSaveIntervalMs);

    setAutoSaveTimer(timer);
    return () => { if (timer) clearInterval(timer); };
  }, [paperParam, annotations.annotationDocument, settingsManager]);

  // Initialize annotations when PDF is loaded
  useEffect(() => {
    if (pdf.totalPages > 0) {
      annotations.initializeAnnotationDocument();
    }
  }, [pdf.totalPages, paperParam, urlParam]);

  useEffect(() => {
    annotations.ensureAllPages();
  }, [pdf.totalPages]);

  // Phase 4: Performance optimization initialization
  useEffect(() => {
    let cacheCleanup: NodeJS.Timeout | null = null;

    ToolLoader.preloadCoreTools().catch(() => {});
    cacheCleanup = setInterval(() => annotationCache.clearExpired(), CACHE_CLEANUP_INTERVAL);

    return () => { if (cacheCleanup) clearInterval(cacheCleanup); };
  }, [annotationCache]);

  // Mobile optimization effects
  useEffect(() => {
    const canvasElements = document.querySelectorAll('canvas');
    canvasElements.forEach(canvas => {
      if (isMobile || isTablet) {
        MobileOptimizer.optimizeCanvasForMobile(canvas as HTMLCanvasElement);
        MobileOptimizer.enableHardwareAcceleration(canvas as HTMLElement);
      }
    });
  }, [isMobile, isTablet]);

  // Handle mobile gestures
  const handleMobileGesture = useCallback((gesture: any) => {
    switch (gesture.type) {
      case 'pinch':
        // Pinch zoom handled by usePDFEngine
        break;
      case 'tap':
        break;
      case 'long-press':
        break;
    }
  }, [selectedTool]);

  // Phase 6: Advanced storage functions
  const handleSaveSession = useCallback(async () => {
    if (!paperParam) return;
    try {
      const allAnnotations: any[] = [];
      Object.entries(annotations.pageAnnotations).forEach(([pageNum, pageState]) => {
        pageState.annotations.forEach(annotation => {
          allAnnotations.push({ ...annotation, page: parseInt(pageNum) });
        });
      });
      const sessionId = await storageManager.saveSession(paperParam, allAnnotations as Annotation[]);
      setCurrentSessionId(sessionId);
    } catch (err) {
      console.error('Failed to save session:', err);
    }
  }, [paperParam, annotations.pageAnnotations, storageManager]);

  const handleExportPDF = useCallback(async () => {
    if (!paperParam || !pdf.pdfDocRef.current) return;

    try {
      const pdfUrl = urlParam
        ? decodeURIComponent(urlParam)
        : `/api/pdf-proxy?paper=${encodeURIComponent(paperParam)}`;

      const response = await fetch(pdfUrl);
      if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.status}`);
      const pdfArrayBuffer = await response.arrayBuffer();
      if (pdfArrayBuffer.byteLength === 0) throw new Error('PDF file is empty');

      await pdfExporter.initialize(new Uint8Array(pdfArrayBuffer));

      const annotationsByPageWithInfo: { [pageNumber: number]: { annotations: Annotation[], pageInfo: PageInfo } } = {};
      Object.entries(annotations.pageAnnotations).forEach(([pageNum, pageState]) => {
        annotationsByPageWithInfo[parseInt(pageNum)] = {
          annotations: pageState.annotations,
          pageInfo: pageState.pageInfo,
        };
      });

      const exportResult = await pdfExporter.exportToPDFWithPageInfo(annotationsByPageWithInfo, {
        includeAnnotations: true,
        includeMetadata: true,
        quality: 'high',
        format: 'pdf',
      });

      const pdfBytes = exportResult.data;
      if (pdfBytes && typeof pdfBytes !== 'string') {
        const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `annotated_${paperParam}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to export PDF:', msg);
      alert(`Failed to export PDF: ${msg}`);
    }
  }, [paperParam, urlParam, annotations.pageAnnotations, pdfExporter, pdf.pdfDocRef]);

  const handleReferenceFileSelect = useCallback((file: any) => {
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('paper', file.filename);
    newUrl.searchParams.set('url', file.url);
    window.location.href = newUrl.toString();
  }, []);

  // Update page info when pages are rendered or zoom changes
  const updatePageInfo = useCallback((pageNum: number) => {
    pdf.getPageInfo(pageNum).then(info => {
      if (info) annotations.updatePageInfo(pageNum, info);
    });
  }, [pdf, annotations]);

  // Update page info after each render
  useEffect(() => {
    for (let i = 1; i <= pdf.totalPages; i++) {
      if (pdf.pageCanvasesRef.current[i]?.rendered) {
        updatePageInfo(i);
      }
    }
  }, [pdf.zoom, pdf.totalPages]);

  // Annotation property change handler
  const handleAnnotationPropertyChange = async (properties: Partial<AnnotationProperties>) => {
    if (!annotations.selectedAnnotationId) return;
    const currentAnnotation = getSelectedAnnotation();
    if (!currentAnnotation) return;

    const updatedProperties = { ...currentAnnotation.properties, ...properties };
    await annotations.updateAnnotation(
      annotations.selectedAnnotationId,
      { properties: updatedProperties, lastModified: new Date().toISOString() },
      pdf.displayPageNum
    );
  };

  const getSelectedAnnotation = () => {
    if (!annotations.selectedAnnotationId) return null;
    return getCurrentPageAnnotations().find(ann => ann.id === annotations.selectedAnnotationId) || null;
  };

  // Delegate to hook
  const getCurrentPageAnnotations = () => {
    return annotations.pageAnnotations[pdf.displayPageNum]?.annotations || [];
  };

  const getCurrentPageInfo = () => {
    return annotations.pageAnnotations[pdf.displayPageNum]?.pageInfo || {
      pdfWidth: DEFAULT_PAGE_WIDTH,
      pdfHeight: DEFAULT_PAGE_HEIGHT,
      canvasWidth: 0,
      canvasHeight: 0,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    };
  };

  const getTotalAnnotationCount = () => {
    return Object.values(annotations.pageAnnotations).reduce(
      (total, page) => total + page.annotations.length, 0
    );
  };

  // ============================================
  // RENDER SECTION
  // ============================================

  // Show PDF selection if no paper specified (moved here to respect Rules of Hooks)
  if (!paperParam) {
    return <PDFSelection />;
  }

  if (pdf.loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (pdf.error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-xl font-bold text-red-600 mb-2">Error Loading PDF</h2>
          <p className="text-gray-600">{pdf.error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-40">
        <Navbar />
      </div>

      {/* Tools Toolbar */}
      <div className="fixed top-12 left-0 right-0 z-35 bg-white border-b border-gray-200">
        <div className="h-10 px-3 flex items-center justify-between gap-2 overflow-x-auto">
          
          {/* Left: Annotation Tools */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <div className="w-px h-5 bg-gray-300"></div>
            {(['pen', 'highlighter', 'eraser', 'rectangle', 'circle', 'arrow', 'text'] as AnnotationTool[]).map(tool => {
              const toolIcons: Record<string, string> = {
                pen: '✎', highlighter: '▬', eraser: '⌫', rectangle: '▢', circle: '●', arrow: '↗', text: 'T',
              };
              return (
                <button
                  key={tool}
                  onClick={() => handleToolSelect(tool)}
                  className={`w-9 h-9 rounded-md transition-all flex items-center justify-center font-semibold text-sm flex-shrink-0 ${
                    selectedTool === tool
                      ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700 border border-blue-700'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400 shadow-sm'
                  }`}
                  title={tool.charAt(0).toUpperCase() + tool.slice(1)}
                >
                  {toolIcons[tool]}
                </button>
              );
            })}

            <div className="w-px h-5 bg-gray-300"></div>
            <button onClick={annotations.undo} disabled={!annotations.canUndo} className="w-9 h-9 flex items-center justify-center rounded-md border border-gray-300 text-sm font-bold hover:bg-gray-50 hover:border-gray-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md flex-shrink-0" title="Undo">↩</button>
            <button onClick={annotations.redo} disabled={!annotations.canRedo} className="w-9 h-9 flex items-center justify-center rounded-md border border-gray-300 text-sm font-bold hover:bg-gray-50 hover:border-gray-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md flex-shrink-0" title="Redo">↪</button>
            <div className="w-px h-5 bg-gray-300"></div>
            <button onClick={handleSaveSession} className="px-3 h-9 text-xs font-semibold bg-green-600 text-white rounded-md hover:bg-green-700 transition-all shadow-sm hover:shadow-md flex-shrink-0" title="Save Session">Save</button>
            <button onClick={handleExportPDF} className="px-3 h-9 text-xs font-semibold bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0" disabled={!paperParam || !pdf.pdfDocRef.current} title="Export PDF">Export</button>
          </div>

          {/* Right: Navigation & Zoom Controls */}
          <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
            <div className="w-px h-5 bg-gray-300"></div>
            <button onClick={pdf.prevPage} disabled={pdf.displayPageNum <= 1} className="w-9 h-9 flex items-center justify-center rounded-md border border-gray-300 text-sm font-bold hover:bg-gray-50 hover:border-gray-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md flex-shrink-0" title="Previous Page">‹</button>
            <input type="number" value={pdf.displayPageNum} onChange={(e) => { const page = parseInt(e.target.value); if (page >= 1 && page <= pdf.totalPages) pdf.goToPage(page); }} className="w-12 h-9 px-1.5 text-xs font-semibold border border-gray-300 rounded-md text-center focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 flex-shrink-0" min="1" max={pdf.totalPages} />
            <span className="text-xs font-semibold text-gray-600 flex-shrink-0">/{pdf.totalPages}</span>
            <button onClick={pdf.nextPage} disabled={pdf.displayPageNum >= pdf.totalPages} className="w-9 h-9 flex items-center justify-center rounded-md border border-gray-300 text-sm font-bold hover:bg-gray-50 hover:border-gray-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md flex-shrink-0" title="Next Page">›</button>
            <div className="w-px h-5 bg-gray-300 mx-0.5"></div>
            <button onClick={pdf.zoomOut} disabled={pdf.zoom <= 50} className="w-9 h-9 flex items-center justify-center rounded-md border border-gray-300 text-sm font-bold hover:bg-gray-50 hover:border-gray-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md flex-shrink-0" title="Zoom Out">−</button>
            <span className="text-xs font-semibold text-gray-700 w-10 text-center flex-shrink-0">{pdf.zoom}%</span>
            <button onClick={pdf.zoomIn} disabled={pdf.zoom >= 200} className="w-9 h-9 flex items-center justify-center rounded-md border border-gray-300 text-sm font-bold hover:bg-gray-50 hover:border-gray-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md flex-shrink-0" title="Zoom In">+</button>
            <button onClick={pdf.resetZoom} className="w-9 h-9 flex items-center justify-center rounded-md border border-gray-300 text-sm font-bold hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm hover:shadow-md flex-shrink-0" title="Reset Zoom">↺</button>
            <div className="w-px h-5 bg-gray-300 mx-0.5"></div>
            <button onClick={() => setShowPerformanceMonitor(!showPerformanceMonitor)} className={`w-9 h-9 flex items-center justify-center rounded-md text-sm font-bold transition-all shadow-sm hover:shadow-md flex-shrink-0 ${showPerformanceMonitor ? 'bg-blue-600 text-white border border-blue-600 hover:bg-blue-700' : 'border border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400'}`} title="Performance">◈</button>
            <button onClick={() => setReferencePanelVisible(!referencePanelVisible)} className="w-9 h-9 flex items-center justify-center rounded-md border border-gray-300 text-sm font-bold hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm hover:shadow-md flex-shrink-0" title="Reference Panel">☰</button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="fixed top-20 left-0 right-0 bottom-0 overflow-hidden bg-gray-100">
        <div
          ref={pdf.containerRef}
          className={`flex-1 overflow-auto bg-gray-200 pdf-viewer-container annotation-mode ${isStylus ? 'stylus-mode' : ''}`}
          style={{ height: 'calc(100vh - 80px)' }}
        >
          <div className="py-4">
            {Array.from({ length: pdf.totalPages }, (_, i) => i + 1).map((pageNum) => {
              const pageCanvas = pdf.pageCanvasesRef.current[pageNum];
              const pageAnns = annotations.pageAnnotations[pageNum]?.annotations || [];
              const pageInfo = annotations.pageAnnotations[pageNum]?.pageInfo || getCurrentPageInfo();
              
              return (
                <div key={pageNum} id={`page-${pageNum}`} className="relative mb-4 mx-auto bg-white shadow-lg" style={{ width: 'fit-content', minHeight: '400px' }}>
                  {pageCanvas?.rendered && (() => {
                    const pdfCanvas = pageCanvas.pdfCanvas;
                    const canvasWidth = pdfCanvas?.offsetWidth || pageCanvas.pdfCanvas.width || 0;
                    const canvasHeight = pdfCanvas?.offsetHeight || pageCanvas.pdfCanvas.height || 0;
                    
                    return (
                      <AnnotationCanvas
                        key={`canvas-${pageNum}-${pageInfo.scale}-${canvasWidth}-${canvasHeight}`}
                        width={canvasWidth}
                        height={canvasHeight}
                        pageInfo={pageInfo}
                        annotations={pageAnns}
                        selectedTool={selectedTool}
                        isDrawing={false}
                        onAnnotationCreate={(annotation) => annotations.createAnnotation(annotation, pageNum)}
                        onAnnotationUpdate={(annotationId, updates) => annotations.updateAnnotation(annotationId, updates, pageNum)}
                        onAnnotationDelete={(annotationId) => annotations.deleteAnnotation(annotationId, pageNum)}
                        onAnnotationSelect={annotations.setSelectedAnnotationId}
                        selectedAnnotationId={annotations.selectedAnnotationId}
                        toolProperties={toolProperties}
                      />
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Annotation Properties Editor */}
      {annotations.selectedAnnotationId && (
        <AnnotationPropertiesEditor
          selectedAnnotation={getSelectedAnnotation()}
          onPropertyChange={handleAnnotationPropertyChange}
          onClose={() => annotations.setSelectedAnnotationId(null)}
        />
      )}

      {/* Performance Monitor */}
      {showPerformanceMonitor && (
        <PerformanceMonitor
          cache={annotationCache}
          visiblePages={visiblePages}
          totalAnnotations={getTotalAnnotationCount()}
          isVisible={showPerformanceMonitor}
        />
      )}

      {!showPerformanceMonitor && (
        <PerformanceIndicator
          fps={60}
          memoryUsage={50}
          cacheHitRate={cacheStats.hitRate * 100}
        />
      )}

      {/* Touch Gesture Handler */}
      <TouchGestureHandler onGesture={handleMobileGesture} onAnnotationTouch={() => {}} enablePalmRejection={true}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      </TouchGestureHandler>

      {/* Cambridge Reference Panel */}
      <CambridgeReferencePanel
        currentPaper={paperParam || undefined}
        onFileSelect={handleReferenceFileSelect}
        isVisible={referencePanelVisible}
        onToggle={() => setReferencePanelVisible(!referencePanelVisible)}
        onClose={() => setReferencePanelVisible(false)}
        linkedMarkingScheme={linkedMarkingScheme}
        linkedInsertPaper={linkedInsertPaper}
        onMarkingSchemeChange={setLinkedMarkingScheme}
        onInsertPaperChange={setLinkedInsertPaper}
      />
    </>
  );
}
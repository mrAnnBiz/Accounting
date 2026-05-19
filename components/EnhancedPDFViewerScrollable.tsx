'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import * as pdfjsLib from 'pdfjs-dist';
import { v4 as uuidv4 } from 'uuid';
import Navbar from '@/components/Navbar';
import TopToolbarEdge from '@/components/TopToolbarEdge';
import { AnnotationCanvas } from '@/components/AnnotationCanvas';
import { AnnotationToolbar } from '@/components/AnnotationToolbar';
import { AnnotationPropertiesEditor } from '@/components/AnnotationPropertiesEditor';
import { 
  Annotation, 
  AnnotationDocument, 
  AnnotationType, 
  AnnotationTool,
  AnnotationProperties,
  PageInfo,
  DEFAULT_ANNOTATION_PROPERTIES,
  DEFAULT_SETTINGS
} from '@/types/annotations';
import { coordinateSystem } from '@/utils/coordinates';
import { annotationStorage } from '@/utils/storage';
import { PDFSelection } from '@/components/PDFSelection';

// Phase 4: Performance Optimization Imports
import CanvasOptimization, { MemoryManager, LayerArchitecture } from '@/utils/canvasOptimization';
import AnnotationCache, { useAnnotationCache } from '@/utils/annotationCache';
import VirtualPDFRenderer, { useVirtualizedPDF } from '@/components/VirtualPDFRenderer';
import { ToolLoader } from '@/utils/lazyToolLoader';
import PerformanceMonitor, { PerformanceIndicator } from '@/components/PerformanceMonitor';
import TouchGestureHandler, { useMobileOptimization, MobileOptimizer } from '@/components/TouchGestureHandler';
import MobileAnnotationToolbar from '@/components/MobileAnnotationToolbar';

// Phase 6: Advanced Features Imports
import CambridgeReferencePanel from '@/components/CambridgeReferencePanel';
import { AdvancedStorageManager, createStorageManager } from '@/utils/advancedStorage';
import { PDFAnnotationExporter } from '../utils/pdfExporter';
import { PDFAnnotationTester, createTestRunner } from '@/utils/testingValidation';
import { toolPreferencesManager } from '@/utils/toolPreferences';

if (typeof window !== 'undefined') {
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

// ============================================
// CONSTANTS
// ============================================
const VIEWPORT_BUFFER_PX = 200;  // Buffer for page visibility detection
const SCROLL_THROTTLE_MS = 50;   // Scroll event throttle
const ZOOM_DEBOUNCE_MS = 150;    // Zoom change debounce
const INITIAL_PAGES_TO_RENDER = 3;  // Pages to render on initial load
const MEMORY_CHECK_INTERVAL = 30000;  // Memory monitoring interval
const CACHE_CLEANUP_INTERVAL = 60000;  // Cache cleanup interval
const DEFAULT_PAGE_WIDTH = 595;  // A4 PDF width in points
const DEFAULT_PAGE_HEIGHT = 842; // A4 PDF height in points
const LONG_PRESS_THRESHOLD_MS = 500; // Threshold for long press detection (iPad context menu)
const POINTER_VELOCITY_THRESHOLD = 2; // Velocity threshold to differentiate stylus from finger (pixels/ms)

// ============================================
// TYPES
// ============================================

interface PageCanvas {
  pdfCanvas: HTMLCanvasElement;
  rendered: boolean;
}

interface PageAnnotationState {
  annotations: Annotation[];
  pageInfo: PageInfo;
}

export default function EnhancedPDFViewerScrollable() {
  const searchParams = useSearchParams();
  const paperParam = searchParams.get('paper');
  const urlParam = searchParams.get('url');

  // Constants for PDF rendering quality
  const EXTRACTION_QUALITY = 2.0;
  const DISPLAY_QUALITY = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

  // Original PDF state
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [displayPageNum, setDisplayPageNum] = useState(1);
  const [linkedMarkingScheme, setLinkedMarkingScheme] = useState<string | null>(null);
  const [linkedInsertPaper, setLinkedInsertPaper] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Annotation state
  const [annotationDocument, setAnnotationDocument] = useState<AnnotationDocument | null>(null);
  const [selectedTool, setSelectedTool] = useState<AnnotationTool>('pan');
  const [toolProperties, setToolProperties] = useState(DEFAULT_ANNOTATION_PROPERTIES.pen);

  // Handle tool selection with preferences
  const handleToolSelect = useCallback((tool: AnnotationTool) => {
    setSelectedTool(tool);
    // Load preferences for the selected tool
    const preferences = toolPreferencesManager.getPreferences(tool);
    if (preferences && Object.keys(preferences).length > 0) {
      setToolProperties(prev => ({
        ...prev,
        ...preferences
      }));
    }
  }, []);

  // Handle tool property changes and save to preferences
  const handleToolPropertiesChange = useCallback((properties: any) => {
    setToolProperties(properties);
    // Save preferences for current tool
    if (selectedTool && selectedTool !== 'pan' && selectedTool !== 'select' && selectedTool !== 'eraser') {
      toolPreferencesManager.updatePreferences(selectedTool, properties);
    }
  }, [selectedTool]);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [pageAnnotations, setPageAnnotations] = useState<{ [pageNum: number]: PageAnnotationState }>({});
  const [isAnnotationMode, setIsAnnotationMode] = useState(false);

  // Phase 4: Performance optimization state
  const { cache: annotationCache, stats: cacheStats } = useAnnotationCache({
    maxCacheSize: 1000,
    maxAge: 30 * 60 * 1000, // 30 minutes
    enableCanvasCache: true
  });
  const { visiblePages, handlePageVisibilityChange } = useVirtualizedPDF(totalPages);
  const [layerArchitecture, setLayerArchitecture] = useState<LayerArchitecture | null>(null);
  const [performanceMode, setPerformanceMode] = useState<'standard' | 'performance' | 'memory'>('standard');
  const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(process.env.NODE_ENV === 'development');
  
  // Mobile optimization hooks
  const { isMobile, isTablet, orientation, isTouch } = useMobileOptimization();
  const [mobileToolbarVisible, setMobileToolbarVisible] = useState(isMobile || isTablet);

  // iPad touch/stylus handling state
  const [isStylus, setIsStylus] = useState(false);
  const [lastTouchPoint, setLastTouchPoint] = useState({ x: 0, y: 0, time: 0 });
  const [longPressTimeoutRef] = useState<React.MutableRefObject<NodeJS.Timeout | null>>({ current: null });
  const [touchStartTimeRef] = useState<React.MutableRefObject<number>>({ current: 0 });

  // Phase 6: Advanced features state
  const [referencePanelVisible, setReferencePanelVisible] = useState(false);
  const [storageManager] = useState(() => createStorageManager({
    primaryProvider: 'indexedDB',
    syncInterval: 5 * 60 * 1000, // 5 minutes
    conflictResolution: 'latest',
    maxVersionHistory: 10
  }));
  const [pdfExporter] = useState(() => new PDFAnnotationExporter());
  const [testRunner] = useState(() => createTestRunner(storageManager));
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Refs
  const pdfDocRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageCanvasesRef = useRef<{ [pageNum: number]: PageCanvas }>({});
  const currentPageRef = useRef(0);
  const pageRenderedZoomRef = useRef<{ [pageNum: number]: number }>({});
  const canvasScaleRef = useRef<{ [pageNum: number]: number }>({});
  const zoomDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Parse paper information from paperParam
  const parsePaperInfo = (paperParam: string) => {
    // Expected format: "9706_s23_qp_32"
    const parts = paperParam.split('_');
    if (parts.length >= 4) {
      return {
        subject: parts[0],
        series: parts[1],
        paperType: parts[2],
        paperNumber: parts[3]
      };
    }
    return {
      subject: 'unknown',
      series: 'unknown',
      paperType: 'qp',
      paperNumber: '1'
    };
  };

  // Load or create annotation document
  const initializeAnnotationDocument = async () => {
    if (!paperParam || totalPages === 0) return;

    try {
      let document = await annotationStorage.loadAnnotationDocument(paperParam);
      
      if (!document) {
        // Create new annotation document
        const paperInfo = parsePaperInfo(paperParam);
        document = annotationStorage.createAnnotationDocument(
          paperParam,
          totalPages,
          paperInfo
        );
        await annotationStorage.saveAnnotationDocument(document);
      }

      setAnnotationDocument(document);

      // Initialize page annotations state
      const pageAnnotationsState: { [pageNum: number]: PageAnnotationState } = {};
      document.annotations.forEach((page, index) => {
        pageAnnotationsState[index + 1] = {
          annotations: page.annotations,
          pageInfo: {
            pdfWidth: page.pageSize.width,
            pdfHeight: page.pageSize.height,
            canvasWidth: 0, // Will be updated when page renders
            canvasHeight: 0,
            scale: 1,
            offsetX: 0,
            offsetY: 0
          }
        };
      });
      setPageAnnotations(pageAnnotationsState);
    } catch (error) {
      console.error('Failed to initialize annotation document:', error);
    }
  };

  // Function to check if page is visible
  const isPageVisible = (pageNum: number): boolean => {
    const pageElement = document.getElementById(`page-${pageNum}`);
    if (!pageElement || !containerRef.current) return false;

    const containerRect = containerRef.current.getBoundingClientRect();
    const pageRect = pageElement.getBoundingClientRect();

    const buffer = VIEWPORT_BUFFER_PX;
    return (
      pageRect.bottom > containerRect.top - buffer &&
      pageRect.top < containerRect.bottom + buffer
    );
  };

  // Function to update current page based on viewport
  const updateCurrentPage = () => {
    if (!containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const containerCenter = containerRect.top + containerRect.height / 2;

    let closestPage = 1;
    let minDistance = Infinity;

    for (let i = 1; i <= totalPages; i++) {
      const pageElement = document.getElementById(`page-${i}`);
      if (pageElement) {
        const pageRect = pageElement.getBoundingClientRect();
        const pageCenter = pageRect.top + pageRect.height / 2;
        const distance = Math.abs(pageCenter - containerCenter);

        if (distance < minDistance) {
          minDistance = distance;
          closestPage = i;
        }
      }
    }

    if (closestPage !== displayPageNum) {
      setDisplayPageNum(closestPage);
    }

    currentPageRef.current = closestPage;
  };

  // Paper param check moved after all hooks (see render section below)
  // to avoid violating Rules of Hooks

  // Load PDF document
  useEffect(() => {
    // Skip loading if no paper param
    if (!paperParam) return;

    const loadPDF = async () => {
      try {
        setLoading(true);
        setError(null);

        // Use direct URL for demo, or proxy for Cambridge papers
        const pdfUrl = urlParam 
          ? decodeURIComponent(urlParam)
          : `/api/pdf-proxy?paper=${encodeURIComponent(paperParam!)}`;
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdfDoc = await loadingTask.promise;

        pdfDocRef.current = pdfDoc;
        setTotalPages(pdfDoc.numPages);
      } catch (err) {
        console.error('Error loading PDF:', err);
        setError(`Failed to load PDF: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    loadPDF();
  }, [paperParam, urlParam]);

  // Initialize annotations when PDF is loaded
  useEffect(() => {
    if (totalPages > 0) {
      initializeAnnotationDocument();
    }
  }, [totalPages, paperParam, urlParam]);

  // Ensure pageAnnotations is initialized for all pages
  useEffect(() => {
    if (totalPages > 0 && Object.keys(pageAnnotations).length === 0) {
      const initialPageAnnotations: { [pageNum: number]: PageAnnotationState } = {};
      for (let i = 1; i <= totalPages; i++) {
        if (!initialPageAnnotations[i]) {
          initialPageAnnotations[i] = {
            annotations: [],
            pageInfo: {
              pdfWidth: DEFAULT_PAGE_WIDTH,
              pdfHeight: DEFAULT_PAGE_HEIGHT,
              canvasWidth: 0,
              canvasHeight: 0,
              scale: 1,
              offsetX: 0,
              offsetY: 0
            }
          };
        }
      }
      setPageAnnotations(initialPageAnnotations);
    }
  }, [totalPages]);

  // Phase 4: Performance optimization initialization
  useEffect(() => {
    let memoryMonitor: NodeJS.Timeout | null = null;
    let cacheCleanup: NodeJS.Timeout | null = null;

    const initializePerformanceOptimizations = async () => {
      try {
        // Preload core annotation tools
        await ToolLoader.preloadCoreTools();
        
        // Initialize memory monitoring
        memoryMonitor = setInterval(() => {
          MemoryManager.monitorMemoryUsage();
        }, MEMORY_CHECK_INTERVAL);
        
        // Clear expired cache entries
        cacheCleanup = setInterval(() => {
          annotationCache.clearExpired();
        }, CACHE_CLEANUP_INTERVAL);
        
        console.log('Performance optimizations initialized');
      } catch (error) {
        console.error('Failed to initialize performance optimizations:', error);
      }
    };

    initializePerformanceOptimizations();

    // Cleanup function
    return () => {
      if (memoryMonitor) clearInterval(memoryMonitor);
      if (cacheCleanup) clearInterval(cacheCleanup);
    };
  }, [annotationCache]);

  // Mobile optimization effects
  useEffect(() => {
    // Show mobile toolbar on touch devices
    setMobileToolbarVisible(isMobile || isTablet);
    
    // Optimize canvas for mobile
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
        if (gesture.scale && gesture.scale !== 1) {
          const newZoom = Math.max(25, Math.min(500, zoom * gesture.scale));
          setZoom(newZoom);
        }
        break;
      case 'tap':
        if (selectedTool !== 'pan' && isAnnotationMode) {
          // Handle annotation tap
        }
        break;
      case 'long-press':
        // Show context menu or tool selector
        setMobileToolbarVisible(true);
        break;
    }
  }, [zoom, selectedTool, isAnnotationMode]);

  // Detect if input is from Apple Pencil/Stylus vs finger
  const detectStylusInput = useCallback((event: PointerEvent | TouchEvent) => {
    if ('pointerType' in event) {
      // Pointer Events API - more reliable for stylus detection
      const pointerEvent = event as PointerEvent;
      return pointerEvent.pointerType === 'pen';
    } else if ('touches' in event) {
      // Fallback: Touch events - check for pressure (stylus typically has pressure)
      const touchEvent = event as TouchEvent;
      if (touchEvent.touches.length > 0) {
        const touch = touchEvent.touches[0];
        // Check for pressure attribute (Apple Pencil has pressure)
        return (touch as any).force !== undefined && (touch as any).force > 0.5;
      }
    }
    return false;
  }, []);

  // Handle touch/pointer down - detect stylus and prevent long-press context menu
  const handlePointerDown = useCallback((event: PointerEvent | TouchEvent) => {
    const isStylusInput = detectStylusInput(event);
    setIsStylus(isStylusInput);
    
    touchStartTimeRef.current = Date.now();
    
    // Get the position
    let x = 0, y = 0;
    if ('touches' in event && event.touches.length > 0) {
      x = event.touches[0].clientX;
      y = event.touches[0].clientY;
    } else if ('clientX' in event) {
      x = (event as PointerEvent).clientX;
      y = (event as PointerEvent).clientY;
    }
    
    setLastTouchPoint({ x, y, time: Date.now() });
    
    // Clear any existing long-press timeout
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
    }
    
    // Set long-press timeout only for stylus (to prevent iOS context menu interference)
    if (isStylusInput) {
      longPressTimeoutRef.current = setTimeout(() => {
        // Long press detected on stylus - don't show context menu on pen
        // This is handled by the annotation system
      }, LONG_PRESS_THRESHOLD_MS);
    }
  }, [detectStylusInput, longPressTimeoutRef, touchStartTimeRef]);

  // Handle touch/pointer up - clear timeouts
  const handlePointerUp = useCallback(() => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    setIsStylus(false);
  }, [longPressTimeoutRef]);

  // Handle pointer move - detect velocity for input differentiation
  const handlePointerMove = useCallback((event: PointerEvent | TouchEvent) => {
    let x = 0, y = 0;
    if ('touches' in event && event.touches.length > 0) {
      x = event.touches[0].clientX;
      y = event.touches[0].clientY;
    } else if ('clientX' in event) {
      x = (event as PointerEvent).clientX;
      y = (event as PointerEvent).clientY;
    }
    
    const deltaX = x - lastTouchPoint.x;
    const deltaY = y - lastTouchPoint.y;
    const deltaTime = Date.now() - lastTouchPoint.time;
    
    if (deltaTime > 0) {
      const velocity = Math.sqrt(deltaX * deltaX + deltaY * deltaY) / deltaTime;
      // Stylus typically has lower velocity for precise writing
      // Finger scrolling typically has higher velocity
      if (velocity > POINTER_VELOCITY_THRESHOLD && !isAnnotationMode) {
        // High velocity = likely finger scroll - allow scrolling when annotations OFF
        // This is handled by allowing default scroll behavior
      }
    }
    
    setLastTouchPoint({ x, y, time: Date.now() });
  }, [lastTouchPoint, isAnnotationMode]);

  // Phase 6: Advanced storage functions
  const handleSaveSession = useCallback(async () => {
    if (!paperParam) return;
    
    try {
      // Convert pageAnnotations structure to flat array with page numbers
      const allAnnotations: any[] = [];
      Object.entries(pageAnnotations).forEach(([pageNum, pageState]) => {
        pageState.annotations.forEach(annotation => {
          allAnnotations.push({
            ...annotation,
            page: parseInt(pageNum) // Add page number for storage
          });
        });
      });
      const sessionId = await storageManager.saveSession(paperParam, allAnnotations as Annotation[]);
      setCurrentSessionId(sessionId);
      console.log('Session saved:', sessionId);
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  }, [paperParam, pageAnnotations, storageManager]);

  const handleLoadSession = useCallback(async (sessionId: string) => {
    try {
      const session = await storageManager.loadSession(sessionId);
      if (session) {
        // Group annotations by page
        const annotationsByPage: { [pageNum: number]: PageAnnotationState } = {};
        
        session.annotations.forEach((annotation: any) => {
          const pageNum = annotation.page || 1; // Default to page 1 if no page specified
          if (!annotationsByPage[pageNum]) {
            annotationsByPage[pageNum] = {
              annotations: [],
              pageInfo: {
                pdfWidth: 0,
                pdfHeight: 0,
                canvasWidth: 0,
                canvasHeight: 0,
                scale: 1,
                offsetX: 0,
                offsetY: 0
              }
            };
          }
          // Remove the page property before adding to page-specific array
          const { page, ...cleanAnnotation } = annotation;
          annotationsByPage[pageNum].annotations.push(cleanAnnotation as Annotation);
        });
        
        setPageAnnotations(annotationsByPage);
        setCurrentSessionId(sessionId);
        console.log('Session loaded:', sessionId);
      }
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  }, [storageManager]);

  const handleExportPDF = useCallback(async () => {
    if (!paperParam || !pdfDocRef.current) {
      console.error('Missing required data for PDF export: paperParam or pdfDocRef');
      return;
    }
    
    try {
      // Use provided urlParam or construct from paperParam via API proxy
      const pdfUrl = urlParam 
        ? decodeURIComponent(urlParam)
        : `/api/pdf-proxy?paper=${encodeURIComponent(paperParam)}`;
      
      console.log('Fetching PDF for export from:', pdfUrl);
      const response = await fetch(pdfUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
      }
      const pdfArrayBuffer = await response.arrayBuffer();
      
      if (pdfArrayBuffer.byteLength === 0) {
        throw new Error('PDF file is empty');
      }
      
      // Initialize exporter with PDF data
      await pdfExporter.initialize(new Uint8Array(pdfArrayBuffer));
      
      // Group annotations by page with their page info for proper coordinate conversion
      const annotationsByPageWithInfo: { [pageNumber: number]: { annotations: Annotation[], pageInfo: PageInfo } } = {};
      Object.entries(pageAnnotations).forEach(([pageNum, pageState]) => {
        const pageNumber = parseInt(pageNum);
        annotationsByPageWithInfo[pageNumber] = {
          annotations: pageState.annotations,
          pageInfo: pageState.pageInfo
        };
      });
      
      const exportResult = await pdfExporter.exportToPDFWithPageInfo(annotationsByPageWithInfo, {
        includeAnnotations: true,
        includeMetadata: true,
        quality: 'high',
        format: 'pdf'
      });
      
      // Download the exported PDF
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
        
        console.log('PDF exported successfully');
      } else {
        throw new Error('Invalid PDF data received');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to export PDF:', errorMessage);
      // Optionally, you could set an error state here to show to the user
      alert(`Failed to export PDF: ${errorMessage}`);
    }
  }, [paperParam, urlParam, pageAnnotations, pdfExporter]);

  const handleReferenceFileSelect = useCallback((file: any) => {
    // Navigate to selected reference file
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('paper', file.filename);
    newUrl.searchParams.set('url', file.url);
    window.location.href = newUrl.toString();
  }, []);

  const handleRunTests = useCallback(async () => {
    console.log('Running comprehensive tests...');
    const results = await testRunner.runAllTests();
    console.log('Test results:', results);
  }, [testRunner]);

  // Update page info when pages are rendered or zoom changes
  const updatePageInfo = (pageNum: number) => {
    const pageElement = document.getElementById(`page-${pageNum}`);
    const canvas = pageCanvasesRef.current[pageNum]?.pdfCanvas;
    
    if (!pageElement || !canvas || !pdfDocRef.current) return;

    pdfDocRef.current.getPage(pageNum).then((page: any) => {
      const viewport = page.getViewport({ scale: 1 });
      const zoomFraction = zoom / 100;
      
      // CRITICAL FIX: Account for actual canvas rendering scale
      // Canvas is rendered at EXTRACTION_QUALITY * DISPLAY_QUALITY scale
      // But displayed at CSS size (offsetWidth), which matches viewport at zoom level
      const renderScale = EXTRACTION_QUALITY * DISPLAY_QUALITY * zoomFraction;
      
      // The actual canvas pixel dimensions (not CSS display size)
      const canvasPixelWidth = viewport.width * renderScale;
      const canvasPixelHeight = viewport.height * renderScale;
      
      // The CSS display dimensions (what we see on screen)
      const canvasDisplayWidth = canvas.offsetWidth || viewport.width * zoomFraction;
      const canvasDisplayHeight = canvas.offsetHeight || viewport.height * zoomFraction;
      
      // For annotation coordinates, we use display dimensions (what user sees)
      // But scale factor accounts for the rendering resolution
      const pageInfo: PageInfo = {
        pdfWidth: viewport.width,
        pdfHeight: viewport.height,
        canvasWidth: canvasDisplayWidth,
        canvasHeight: canvasDisplayHeight,
        scale: zoomFraction,
        offsetX: 0,
        offsetY: 0
      };

      setPageAnnotations(prev => ({
        ...prev,
        [pageNum]: {
          ...(prev[pageNum] || { annotations: [] }),
          pageInfo
        }
      }));
    });
  };

  // Render a single page
  const renderPage = async (pageNum: number, forceRerender = false) => {
    if (!pdfDocRef.current) return;

    const existingCanvas = pageCanvasesRef.current[pageNum];
    
    if (existingCanvas?.rendered && 
        pageRenderedZoomRef.current[pageNum] === zoom && 
        !forceRerender) {
      return;
    }

    try {
      const page = await pdfDocRef.current.getPage(pageNum);
      const viewport = page.getViewport({ scale: EXTRACTION_QUALITY });

      const canvas = existingCanvas?.pdfCanvas || document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const scale = (zoom / 100) * DISPLAY_QUALITY;
      const displayWidth = viewport.width / EXTRACTION_QUALITY * scale;
      const displayHeight = viewport.height / EXTRACTION_QUALITY * scale;

      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;
      canvas.style.position = 'relative';
      canvas.style.zIndex = '1';

      canvasScaleRef.current[pageNum] = EXTRACTION_QUALITY / scale;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;

      pageCanvasesRef.current[pageNum] = {
        pdfCanvas: canvas,
        rendered: true,
      };

      pageRenderedZoomRef.current[pageNum] = zoom;

      const pageContainer = document.getElementById(`page-${pageNum}`);
      if (pageContainer) {
        const existingCanvases = pageContainer.querySelectorAll('canvas');
        existingCanvases.forEach((existingCanvas) => {
          if (existingCanvas !== canvas) {
            existingCanvas.remove();
          }
        });
        
        if (!pageContainer.contains(canvas)) {
          pageContainer.appendChild(canvas);
        }
      }

      // Update page info for annotations after rendering
      setTimeout(() => updatePageInfo(pageNum), 100);

    } catch (error) {
      console.error(`Error rendering page ${pageNum}:`, error);
    }
  };

  // Annotation handlers
  const handleAnnotationCreateForPage = async (annotation: Annotation, pageNum: number) => {
    if (!annotationDocument) return;

    try {
      await annotationStorage.addAnnotation(
        annotationDocument.pdfId, 
        pageNum, 
        annotation
      );

      // Update local state - safely handle missing page
      setPageAnnotations(prev => {
        const updated = { ...prev };
        if (!updated[pageNum]) {
          updated[pageNum] = {
            annotations: [annotation],
            pageInfo: {
              pdfWidth: DEFAULT_PAGE_WIDTH,
              pdfHeight: DEFAULT_PAGE_HEIGHT,
              canvasWidth: 0,
              canvasHeight: 0,
              scale: 1,
              offsetX: 0,
              offsetY: 0
            }
          };
        } else {
          updated[pageNum] = {
            ...updated[pageNum],
            annotations: [...(updated[pageNum].annotations || []), annotation]
          };
        }
        return updated;
      });

      console.log('Annotation created for page:', pageNum, annotation);
    } catch (error) {
      console.error('Failed to create annotation:', error);
    }
  };

  const handleAnnotationUpdateForPage = async (annotationId: string, updates: Partial<Annotation>, pageNum: number) => {
    if (!annotationDocument) return;

    try {
      await annotationStorage.updateAnnotation(
        annotationDocument.pdfId,
        pageNum,
        annotationId,
        updates
      );

      // Update local state - safely handle missing page
      setPageAnnotations(prev => {
        if (!prev[pageNum] || !prev[pageNum].annotations) return prev;
        return {
          ...prev,
          [pageNum]: {
            ...prev[pageNum],
            annotations: prev[pageNum].annotations.map(ann =>
              ann.id === annotationId ? { ...ann, ...updates } : ann
            )
          }
        };
      });

      console.log('Annotation updated for page:', pageNum, annotationId);
    } catch (error) {
      console.error('Failed to update annotation:', error);
    }
  };

  const handleAnnotationDeleteForPage = async (annotationId: string, pageNum: number) => {
    if (!annotationDocument) return;

    // Check if annotation exists in local state first
    const pageState = pageAnnotations[pageNum];
    if (!pageState || !pageState.annotations.some(ann => ann.id === annotationId)) {
      console.warn(`Annotation ${annotationId} not found in local state for page ${pageNum} - already deleted`);
      return;
    }

    try {
      await annotationStorage.removeAnnotation(
        annotationDocument.pdfId,
        pageNum,
        annotationId
      );

      // Update local state - safely handle missing page
      setPageAnnotations(prev => {
        if (!prev[pageNum] || !prev[pageNum].annotations) return prev;
        return {
          ...prev,
          [pageNum]: {
            ...prev[pageNum],
            annotations: prev[pageNum].annotations.filter(ann => ann.id !== annotationId)
          }
        };
      });

      // Clear selection if deleted annotation was selected
      if (selectedAnnotationId === annotationId) {
        setSelectedAnnotationId(null);
      }

      console.log('Annotation deleted for page:', pageNum, annotationId);
    } catch (error) {
      console.error('Failed to delete annotation:', error);
    }
  };

  const handleAnnotationUpdate = async (annotationId: string, updates: Partial<Annotation>) => {
    if (!annotationDocument) return;

    try {
      await annotationStorage.updateAnnotation(
        annotationDocument.pdfId,
        displayPageNum,
        annotationId,
        updates
      );

      // Update local state
      setPageAnnotations(prev => ({
        ...prev,
        [displayPageNum]: {
          ...prev[displayPageNum],
          annotations: prev[displayPageNum].annotations.map(ann =>
            ann.id === annotationId ? { ...ann, ...updates } : ann
          )
        }
      }));

      console.log('Annotation updated:', annotationId);
    } catch (error) {
      console.error('Failed to update annotation:', error);
    }
  };

  const handleClearAllAnnotations = async () => {
    if (!annotationDocument || !confirm('Are you sure you want to clear all annotations on this page?')) return;

    try {
      const currentAnnotations = pageAnnotations[displayPageNum]?.annotations || [];
      const currentPageInfo = pageAnnotations[displayPageNum]?.pageInfo;
      
      for (const annotation of currentAnnotations) {
        await annotationStorage.removeAnnotation(
          annotationDocument.pdfId,
          displayPageNum,
          annotation.id
        );
      }

      // Update local state - safely preserve pageInfo and structure
      setPageAnnotations(prev => {
        const updated = { ...prev };
        if (!updated[displayPageNum]) {
          updated[displayPageNum] = {
            annotations: [],
            pageInfo: currentPageInfo || {
              pdfWidth: DEFAULT_PAGE_WIDTH,
              pdfHeight: DEFAULT_PAGE_HEIGHT,
              canvasWidth: 0,
              canvasHeight: 0,
              scale: 1,
              offsetX: 0,
              offsetY: 0
            }
          };
        } else {
          updated[displayPageNum] = {
            ...updated[displayPageNum],
            annotations: []
          };
        }
        return updated;
      });

      console.log('All annotations cleared for page', displayPageNum);
    } catch (error) {
      console.error('Failed to clear annotations:', error);
    }
  };

  const handleExportAnnotations = async () => {
    if (!annotationDocument) return;

    try {
      const jsonData = await annotationStorage.exportToJson(annotationDocument.pdfId);
      
      // Create download link
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${annotationDocument.pdfId}_annotations.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('Annotations exported');
    } catch (error) {
      console.error('Failed to export annotations:', error);
    }
  };

  const handleAnnotationPropertyChange = async (properties: Partial<AnnotationProperties>) => {
    if (!selectedAnnotationId) return;

    try {
      const currentAnnotation = getSelectedAnnotation();
      if (!currentAnnotation) return;

      const updatedProperties = {
        ...currentAnnotation.properties,
        ...properties
      };

      await handleAnnotationUpdate(selectedAnnotationId, { 
        properties: updatedProperties,
        lastModified: new Date().toISOString()
      });
      console.log('Annotation properties updated');
    } catch (error) {
      console.error('Failed to update annotation properties:', error);
    }
  };

  const getSelectedAnnotation = () => {
    if (!selectedAnnotationId) return null;
    return getCurrentPageAnnotations().find(ann => ann.id === selectedAnnotationId) || null;
  };

  // Handle window resize (DevTools, orientation change, etc)
  useEffect(() => {
    let resizeTimeout: NodeJS.Timeout | null = null;

    const handleResize = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        // Always re-render the current page being viewed
        if (currentPageRef.current) {
          renderPage(currentPageRef.current, true);
        }
        
        // Also re-render all visible pages
        for (let i = 1; i <= totalPages; i++) {
          if (i !== currentPageRef.current && isPageVisible(i)) {
            renderPage(i, true); // Force re-render
          }
        }
      }, 300); // Debounce resize events
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeout) clearTimeout(resizeTimeout);
    };
  }, [totalPages]);

  // Setup scroll listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let scrollTimeout: NodeJS.Timeout | null = null;
    const throttledScroll = () => {
      if (scrollTimeout) return;
      
      scrollTimeout = setTimeout(() => {
        updateCurrentPage();
        
        for (let i = 1; i <= totalPages; i++) {
          if (isPageVisible(i)) {
            renderPage(i);
          }
        }
        scrollTimeout = null;
      }, SCROLL_THROTTLE_MS);
    };

    container.addEventListener('scroll', throttledScroll);
    return () => {
      container.removeEventListener('scroll', throttledScroll);
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };
  }, [totalPages, zoom]);

  // Setup pointer events for iPad stylus/touch differentiation
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Prevent context menu on long press (iOS stylus)
    const handleContextMenu = (e: Event) => {
      if (isStylus) {
        e.preventDefault();
      }
    };

    // Allow touch move default behavior for scrolling
    const handleTouchMove = (e: TouchEvent) => {
      // Allow finger scrolling when annotations are OFF or when using 2+ touches (pan)
      if (!isAnnotationMode || e.touches.length > 1) {
        // Don't prevent default - allow native scroll/pan
      } else if (isAnnotationMode && e.touches.length === 1 && isStylus) {
        // Single stylus touch during annotation mode - allow annotation drawing
        // Don't prevent default to let annotation canvas handle it
      }
    };

    container.addEventListener('contextmenu', handleContextMenu);
    container.addEventListener('pointerdown', handlePointerDown as any);
    container.addEventListener('pointermove', handlePointerMove as any);
    container.addEventListener('pointerup', handlePointerUp);
    container.addEventListener('touchmove', handleTouchMove);

    return () => {
      container.removeEventListener('contextmenu', handleContextMenu);
      container.removeEventListener('pointerdown', handlePointerDown as any);
      container.removeEventListener('pointermove', handlePointerMove as any);
      container.removeEventListener('pointerup', handlePointerUp);
      container.removeEventListener('touchmove', handleTouchMove);
    };
  }, [isAnnotationMode, isStylus, handlePointerDown, handlePointerUp, handlePointerMove]);

  // Handle zoom changes - update all visible pages and their pageInfo
  useEffect(() => {
    if (zoomDebounceRef.current) {
      clearTimeout(zoomDebounceRef.current);
    }

    zoomDebounceRef.current = setTimeout(() => {
      // First update pageInfo for all visible pages to reflect new zoom
      for (let i = 1; i <= totalPages; i++) {
        if (isPageVisible(i)) {
          // Update pageInfo immediately to reflect zoom change
          updatePageInfo(i);
          // Then re-render the page
          renderPage(i, true);
        }
      }
    }, ZOOM_DEBOUNCE_MS);

    return () => {
      if (zoomDebounceRef.current) {
        clearTimeout(zoomDebounceRef.current);
      }
    };
  }, [zoom, totalPages]);

  // Initial render
  useEffect(() => {
    if (totalPages > 0) {
      setTimeout(() => {
        for (let i = 1; i <= Math.min(INITIAL_PAGES_TO_RENDER, totalPages); i++) {
          renderPage(i);
        }
        updateCurrentPage();
      }, 100);
    }
  }, [totalPages]);

  // Navigation functions
  const goToPage = (pageNum: number) => {
    if (pageNum < 1 || pageNum > totalPages) return;
    
    const pageElement = document.getElementById(`page-${pageNum}`);
    if (pageElement && containerRef.current) {
      pageElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
    }
  };

  const nextPage = () => {
    if (displayPageNum < totalPages) {
      goToPage(displayPageNum + 1);
    }
  };

  const prevPage = () => {
    if (displayPageNum > 1) {
      goToPage(displayPageNum - 1);
    }
  };

  const zoomIn = () => {
    setZoom(Math.min(200, zoom + 25));
  };

  const zoomOut = () => {
    setZoom(Math.max(50, zoom - 25));
  };

  const resetZoom = () => {
    setZoom(100);
  };

  const toggleAnnotationMode = () => {
    setIsAnnotationMode(!isAnnotationMode);
    if (!isAnnotationMode) {
      handleToolSelect('pen'); // Default to pen when entering annotation mode
    } else {
      handleToolSelect('pan'); // Default to pan when exiting annotation mode
    }
  };

  const getCurrentPageAnnotations = () => {
    return pageAnnotations[displayPageNum]?.annotations || [];
  };

  const getCurrentPageInfo = () => {
    return pageAnnotations[displayPageNum]?.pageInfo || {
      pdfWidth: DEFAULT_PAGE_WIDTH,
      pdfHeight: DEFAULT_PAGE_HEIGHT,
      canvasWidth: 0,
      canvasHeight: 0,
      scale: 1,
      offsetX: 0,
      offsetY: 0
    };
  };

  const getTotalAnnotationCount = () => {
    return Object.values(pageAnnotations).reduce(
      (total, page) => total + page.annotations.length, 
      0
    );
  };

  // ============================================
  // RENDER SECTION
  // ============================================

  // Show PDF selection if no paper specified (moved here to respect Rules of Hooks)
  if (!paperParam) {
    return <PDFSelection />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-xl font-bold text-red-600 mb-2">Error Loading PDF</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-40">
        <Navbar />
      </div>

      {/* Collapsible Tools Toolbar - 40px height */}
      <div className="fixed top-12 left-0 right-0 z-35 bg-white border-b border-gray-200">
        <div className="h-10 px-3 flex items-center justify-center gap-2">
          {/* Center: Tools */}
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={toggleAnnotationMode}
              className={`px-3 h-8 rounded text-sm font-medium transition-colors ${
                isAnnotationMode 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              {isAnnotationMode ? 'Annotations: ON' : 'Enable'}
            </button>

            {isAnnotationMode && (
              <>
                <div className="w-px h-4 bg-gray-300"></div>
                {(['pen', 'highlighter', 'eraser', 'rectangle', 'circle', 'arrow', 'text'] as AnnotationTool[]).map(tool => {
                  const toolIcons: Record<string, string> = {
                    pen: '✎', highlighter: '▍', eraser: '⌫', rectangle: '▢',
                    circle: '○', arrow: '↗', text: 'T'
                  };
                  return (
                    <button
                      key={tool}
                      onClick={() => handleToolSelect(tool)}
                      className={`w-8 h-8 text-sm rounded transition-colors flex items-center justify-center ${
                        selectedTool === tool
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      title={tool.charAt(0).toUpperCase() + tool.slice(1)}
                    >
                      {toolIcons[tool]}
                    </button>
                  );
                })}

                <div className="w-px h-4 bg-gray-300"></div>
                <button
                  onClick={handleSaveSession}
                  className="px-3 h-8 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
                  title="Save Session"
                >
                  Save
                </button>
                <button
                  onClick={handleExportPDF}
                  className="px-3 h-8 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
                  disabled={!paperParam || !pdfDocRef.current}
                  title="Export PDF"
                >
                  Export
                </button>
              </>
            )}
          </div>

          {/* Right: Page Number and Controls */}
          <div className="absolute right-3 flex items-center gap-1">
            <button
              onClick={prevPage}
              disabled={displayPageNum <= 1}
              className="w-8 h-8 flex items-center justify-center rounded border border-gray-300 text-sm hover:bg-gray-100 disabled:opacity-50"
              title="Previous"
            >
              ‹
            </button>

            <input
              type="number"
              value={displayPageNum}
              onChange={(e) => {
                const page = parseInt(e.target.value);
                if (page >= 1 && page <= totalPages) goToPage(page);
              }}
              className="w-14 h-8 px-1 text-sm border border-gray-300 rounded text-center"
              min="1"
              max={totalPages}
            />

            <span className="text-sm text-gray-600">/ {totalPages}</span>

            <button
              onClick={nextPage}
              disabled={displayPageNum >= totalPages}
              className="w-8 h-8 flex items-center justify-center rounded border border-gray-300 text-sm hover:bg-gray-100 disabled:opacity-50"
              title="Next"
            >
              ›
            </button>

            <div className="w-px h-4 bg-gray-300 mx-1"></div>

            <button
              onClick={zoomOut}
              disabled={zoom <= 50}
              className="w-8 h-8 flex items-center justify-center rounded border border-gray-300 text-sm hover:bg-gray-100 disabled:opacity-50"
              title="Zoom Out"
            >
              −
            </button>

            <span className="text-sm text-gray-600 w-10 text-center">{zoom}%</span>

            <button
              onClick={zoomIn}
              disabled={zoom >= 200}
              className="w-8 h-8 flex items-center justify-center rounded border border-gray-300 text-sm hover:bg-gray-100 disabled:opacity-50"
              title="Zoom In"
            >
              +
            </button>

            <button
              onClick={resetZoom}
              className="w-8 h-8 flex items-center justify-center rounded border border-gray-300 text-sm hover:bg-gray-100"
              title="Reset Zoom"
            >
              ↺
            </button>

            <div className="w-px h-4 bg-gray-300 mx-1"></div>

            <button
              onClick={() => setShowPerformanceMonitor(!showPerformanceMonitor)}
              className={`w-8 h-8 flex items-center justify-center rounded text-sm ${
                showPerformanceMonitor
                  ? 'bg-blue-100 border border-blue-400 text-blue-600'
                  : 'border border-gray-300 hover:bg-gray-100'
              }`}
              title="Performance"
            >
              ◈
            </button>

            <button
              onClick={() => setReferencePanelVisible(!referencePanelVisible)}
              className="w-8 h-8 flex items-center justify-center rounded border border-gray-300 text-sm hover:bg-gray-100"
              title="Reference Panel"
            >
              ☰
            </button>
          </div>
        </div>
      </div>

      {/* Main content with adjusted top padding */}
      <div className="fixed top-20 left-0 right-0 bottom-0 overflow-hidden bg-gray-100">
        {/* PDF Viewer Container */}
        <div 
          ref={containerRef}
          className={`flex-1 overflow-auto bg-gray-200 pdf-viewer-container ${
            isAnnotationMode ? 'annotation-mode' : ''
          } ${isStylus ? 'stylus-mode' : ''}`}
          style={{ height: 'calc(100vh - 80px)' }}
        >
          <div className="py-4">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
              const pageCanvas = pageCanvasesRef.current[pageNum];
              const currentPageAnnotations = pageAnnotations[pageNum]?.annotations || [];
              const currentPageInfo = pageAnnotations[pageNum]?.pageInfo || getCurrentPageInfo();
              
              return (
                <div
                  key={pageNum}
                  id={`page-${pageNum}`}
                  className="relative mb-4 mx-auto bg-white shadow-lg"
                  style={{
                    width: 'fit-content',
                    minHeight: '400px',
                  }}
                >
                  {/* Page number overlay removed - navigation handled in top toolbar */}

                  {/* Annotation Canvas Overlay */}
                  {isAnnotationMode && pageCanvas?.rendered && (() => {
                    // Get the actual PDF canvas dimensions at render time
                    const pdfCanvas = pageCanvas.pdfCanvas;
                    const canvasWidth = pdfCanvas?.offsetWidth || pageCanvas.pdfCanvas.width || 0;
                    const canvasHeight = pdfCanvas?.offsetHeight || pageCanvas.pdfCanvas.height || 0;
                    
                    return (
                      <AnnotationCanvas
                        key={`canvas-${pageNum}-${currentPageInfo.scale}-${canvasWidth}-${canvasHeight}`}
                        width={canvasWidth}
                        height={canvasHeight}
                        pageInfo={currentPageInfo}
                        annotations={currentPageAnnotations}
                        selectedTool={selectedTool}
                        isDrawing={false}
                        onAnnotationCreate={(annotation) => handleAnnotationCreateForPage(annotation, pageNum)}
                        onAnnotationUpdate={(annotationId, updates) => handleAnnotationUpdateForPage(annotationId, updates, pageNum)}
                        onAnnotationDelete={(annotationId) => handleAnnotationDeleteForPage(annotationId, pageNum)}
                        onAnnotationSelect={setSelectedAnnotationId}
                        selectedAnnotationId={selectedAnnotationId}
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

      {/* Old ReferencePanel removed - functionality moved to CambridgeReferencePanel */}

      {/* Annotation Properties Editor */}
      {isAnnotationMode && (
        <AnnotationPropertiesEditor
          selectedAnnotation={getSelectedAnnotation()}
          onPropertyChange={handleAnnotationPropertyChange}
          onClose={() => setSelectedAnnotationId(null)}
        />
      )}

      {/* Phase 4: Performance Monitor */}
      {showPerformanceMonitor && (
        <PerformanceMonitor
          cache={annotationCache}
          visiblePages={visiblePages}
          totalAnnotations={getTotalAnnotationCount()}
          isVisible={showPerformanceMonitor}
        />
      )}

      {/* Performance Indicator for Production */}
      {!showPerformanceMonitor && (
        <PerformanceIndicator
          fps={60} // Would be tracked in real-time
          memoryUsage={50} // Would be tracked in real-time
          cacheHitRate={cacheStats.hitRate * 100}
        />
      )}

      {/* Annotation Properties Editor */}
      {isAnnotationMode && (
        <AnnotationPropertiesEditor
          selectedAnnotation={getSelectedAnnotation()}
          onPropertyChange={handleAnnotationPropertyChange}
          onClose={() => setSelectedAnnotationId(null)}
        />
      )}

      {/* Phase 4: Performance Monitor */}
      {showPerformanceMonitor && (
        <PerformanceMonitor
          cache={annotationCache}
          visiblePages={visiblePages}
          totalAnnotations={getTotalAnnotationCount()}
          isVisible={showPerformanceMonitor}
        />
      )}

      {/* Performance Indicator for Production */}
      {!showPerformanceMonitor && (
        <PerformanceIndicator
          fps={60} // Would be tracked in real-time
          memoryUsage={50} // Would be tracked in real-time
          cacheHitRate={cacheStats.hitRate * 100}
        />
      )}

      {/* Mobile Touch Gesture Handler */}
      <TouchGestureHandler
        onGesture={handleMobileGesture}
        onAnnotationTouch={(point, pressure) => {
          // Handle annotation drawing on mobile
          if (selectedTool !== 'pan' && isAnnotationMode) {
            // Implementation would integrate with annotation system
          }
        }}
        enablePalmRejection={true}
        enableAnnotationMode={isAnnotationMode}
      >
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      </TouchGestureHandler>

      {/* Mobile Annotation Toolbar - DISABLED FOR NOW */}
      {/* Commented out bottom toolbar as it conflicts with top toolbar on tablets
      {mobileToolbarVisible && isMobile && !isTablet && (
        <MobileAnnotationToolbar
          selectedTool={selectedTool}
          onToolSelect={setSelectedTool}
          toolProperties={toolProperties}
          onPropertiesChange={setToolProperties}
          onToggleAnnotationMode={() => setIsAnnotationMode(!isAnnotationMode)}
          isAnnotationMode={isAnnotationMode}
          annotations={getCurrentPageAnnotations()}
          onExport={() => {
            // Export functionality
            console.log('Export annotations');
          }}
          onClear={() => {
            // Clear annotations
            const currentPageState = pageAnnotations[displayPageNum];
            if (currentPageState) {
              setPageAnnotations(prev => ({
                ...prev,
                [displayPageNum]: {
                  ...currentPageState,
                  annotations: []
                }
              }));
            }
          }}
        />
      )}
      */}

      {/* Phase 7: 3-Tab Cambridge Reference Panel with PDF Viewer */}
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
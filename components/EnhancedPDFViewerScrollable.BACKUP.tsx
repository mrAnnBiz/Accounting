'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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

    const buffer = 200;
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

  // Show PDF selection if no paper specified
  if (!paperParam) {
    return <PDFSelection />;
  }

  // Load PDF document
  useEffect(() => {

    const loadPDF = async () => {
      try {
        setLoading(true);
        setError(null);

        // Use direct URL for demo, or proxy for Cambridge papers
        const pdfUrl = urlParam 
          ? decodeURIComponent(urlParam)
          : `/api/pdf-proxy?paper=${encodeURIComponent(paperParam)}`;
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

  // Phase 4: Performance optimization initialization
  useEffect(() => {
    const initializePerformanceOptimizations = async () => {
      try {
        // Preload core annotation tools
        await ToolLoader.preloadCoreTools();
        
        // Initialize memory monitoring
        const memoryMonitor = setInterval(() => {
          MemoryManager.monitorMemoryUsage();
        }, 30000); // Check every 30 seconds
        
        // Clear expired cache entries
        const cacheCleanup = setInterval(() => {
          annotationCache.clearExpired();
        }, 60000); // Clean every minute
        
        console.log('Performance optimizations initialized');
        
        return () => {
          clearInterval(memoryMonitor);
          clearInterval(cacheCleanup);
        };
      } catch (error) {
        console.error('Failed to initialize performance optimizations:', error);
      }
    };

    initializePerformanceOptimizations();
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
    if (!paperParam || !pdfDocRef.current || !urlParam) {
      console.error('Missing required data for PDF export');
      return;
    }
    
    try {
      console.log('Fetching PDF from URL:', urlParam);
      const response = await fetch(urlParam);
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
      }
      const pdfArrayBuffer = await response.arrayBuffer();
      
      if (pdfArrayBuffer.byteLength === 0) {
        throw new Error('PDF file is empty');
      }
      
      // Initialize exporter with PDF data
      await pdfExporter.initialize(new Uint8Array(pdfArrayBuffer));
      
      // Group annotations by page (from pageAnnotations structure)
      const annotationsByPage: { [pageNumber: number]: Annotation[] } = {};
      Object.entries(pageAnnotations).forEach(([pageNum, pageState]) => {
        const pageNumber = parseInt(pageNum);
        annotationsByPage[pageNumber] = pageState.annotations;
      });
      
      const exportResult = await pdfExporter.exportToPDF(annotationsByPage, {
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
      console.error('Failed to export PDF:', error);
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
      const scale = zoom / 100;
      
      const pageInfo: PageInfo = {
        pdfWidth: viewport.width,
        pdfHeight: viewport.height,
        canvasWidth: canvas.offsetWidth,
        canvasHeight: canvas.offsetHeight,
        scale: scale,
        offsetX: 0,
        offsetY: 0
      };

      setPageAnnotations(prev => ({
        ...prev,
        [pageNum]: {
          ...prev[pageNum],
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
  const handleAnnotationCreate = async (annotation: Annotation) => {
    if (!annotationDocument) return;

    try {
      await annotationStorage.addAnnotation(
        annotationDocument.pdfId, 
        displayPageNum, 
        annotation
      );

      // Update local state
      setPageAnnotations(prev => ({
        ...prev,
        [displayPageNum]: {
          ...prev[displayPageNum],
          annotations: [...prev[displayPageNum].annotations, annotation]
        }
      }));

      console.log('Annotation created:', annotation);
    } catch (error) {
      console.error('Failed to create annotation:', error);
    }
  };

  const handleAnnotationCreateForPage = async (annotation: Annotation, pageNum: number) => {
    if (!annotationDocument) return;

    try {
      await annotationStorage.addAnnotation(
        annotationDocument.pdfId, 
        pageNum, 
        annotation
      );

      // Update local state
      setPageAnnotations(prev => ({
        ...prev,
        [pageNum]: {
          ...prev[pageNum],
          annotations: [...prev[pageNum].annotations, annotation]
        }
      }));

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

      // Update local state
      setPageAnnotations(prev => ({
        ...prev,
        [pageNum]: {
          ...prev[pageNum],
          annotations: prev[pageNum].annotations.map(ann =>
            ann.id === annotationId ? { ...ann, ...updates } : ann
          )
        }
      }));

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

      // Update local state
      setPageAnnotations(prev => ({
        ...prev,
        [pageNum]: {
          ...prev[pageNum],
          annotations: prev[pageNum].annotations.filter(ann => ann.id !== annotationId)
        }
      }));

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

  const handleAnnotationDelete = async (annotationId: string) => {
    if (!annotationDocument) return;

    try {
      await annotationStorage.removeAnnotation(
        annotationDocument.pdfId,
        displayPageNum,
        annotationId
      );

      // Update local state
      setPageAnnotations(prev => ({
        ...prev,
        [displayPageNum]: {
          ...prev[displayPageNum],
          annotations: prev[displayPageNum].annotations.filter(ann => ann.id !== annotationId)
        }
      }));

      // Clear selection if deleted annotation was selected
      if (selectedAnnotationId === annotationId) {
        setSelectedAnnotationId(null);
      }

      console.log('Annotation deleted:', annotationId);
    } catch (error) {
      console.error('Failed to delete annotation:', error);
    }
  };

  const handleClearAllAnnotations = async () => {
    if (!annotationDocument || !confirm('Are you sure you want to clear all annotations on this page?')) return;

    try {
      const currentAnnotations = pageAnnotations[displayPageNum]?.annotations || [];
      
      for (const annotation of currentAnnotations) {
        await annotationStorage.removeAnnotation(
          annotationDocument.pdfId,
          displayPageNum,
          annotation.id
        );
      }

      // Update local state
      setPageAnnotations(prev => ({
        ...prev,
        [displayPageNum]: {
          ...prev[displayPageNum],
          annotations: []
        }
      }));

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
      }, 50);
    };

    container.addEventListener('scroll', throttledScroll);
    return () => {
      container.removeEventListener('scroll', throttledScroll);
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };
  }, [totalPages, zoom]);

  // Handle zoom changes
  useEffect(() => {
    if (zoomDebounceRef.current) {
      clearTimeout(zoomDebounceRef.current);
    }

    zoomDebounceRef.current = setTimeout(() => {
      for (let i = 1; i <= totalPages; i++) {
        if (isPageVisible(i)) {
          renderPage(i, true);
        }
      }
    }, 150);

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
        for (let i = 1; i <= Math.min(3, totalPages); i++) {
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
      pdfWidth: 595,
      pdfHeight: 842,
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
      <div className="h-screen flex flex-col bg-gray-100">
        <Navbar />
      
      <TopToolbarEdge
        displayPageNum={displayPageNum}
        totalPages={totalPages}
        zoom={zoom}
        onPrevPage={prevPage}
        onNextPage={nextPage}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onResetZoom={resetZoom}
        onGoToPage={goToPage}
        onTogglePanel={() => setReferencePanelVisible(!referencePanelVisible)}
        onTogglePerformance={() => setShowPerformanceMonitor(!showPerformanceMonitor)}
        showPerformanceMonitor={showPerformanceMonitor}
      />

      {/* Main Toolbar */}
      <div className="px-4 py-2 bg-white border-b flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={toggleAnnotationMode}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              isAnnotationMode 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {isAnnotationMode ? 'Annotation Mode: ON' : 'Enable Annotations'}
          </button>

          {/* Always visible action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveSession}
              className="px-3 py-1 bg-gray-500 text-white rounded-md hover:bg-gray-600 text-sm"
              title="Save Session"
            >
              Save
            </button>
            
            <button
              onClick={handleExportPDF}
              className="px-3 py-1 bg-gray-500 text-white rounded-md hover:bg-gray-600 text-sm"
              title="Export PDF with Annotations"
            >
              Export PDF
            </button>
            
            <button
              onClick={() => setReferencePanelVisible(!referencePanelVisible)}
              className={`px-3 py-1 rounded-md text-sm transition-colors ${
                referencePanelVisible
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-500 text-white hover:bg-gray-600'
              }`}
              title="Cambridge Reference Panel"
            >
              References
            </button>
          </div>
        </div>
        
        {currentSessionId && (
          <div className="text-sm text-gray-600">
            Session: {currentSessionId.slice(-8)}
          </div>
        )}
      </div>

      <div className="flex-1 flex relative">
        {/* Annotation Toolbar */}
        {isAnnotationMode && (
          <AnnotationToolbar
            selectedTool={selectedTool}
            onToolSelect={handleToolSelect}
            toolProperties={toolProperties}
            onToolPropertiesChange={handleToolPropertiesChange}
            onClearAll={handleClearAllAnnotations}
            onExport={handleExportAnnotations}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onZoomReset={resetZoom}
            zoom={zoom}
          />
        )}

        {/* PDF Viewer Container */}
        <div 
          ref={containerRef}
          className="flex-1 overflow-auto bg-gray-200"
          style={{ height: 'calc(100vh - 140px)' }}
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
                  {isAnnotationMode && pageCanvas?.rendered && (
                    <AnnotationCanvas
                      width={pageCanvas.pdfCanvas.offsetWidth}
                      height={pageCanvas.pdfCanvas.offsetHeight}
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
                  )}
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

        {/* Mobile Annotation Toolbar */}
        {mobileToolbarVisible && (isMobile || isTablet) && (
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
      </div>

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
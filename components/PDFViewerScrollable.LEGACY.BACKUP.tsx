'use client';

import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import * as pdfjsLib from 'pdfjs-dist';
import Navbar from '@/components/Navbar';
import TopToolbarEdge from '@/components/TopToolbarEdge';
// import ReferencePanel from '@/components/ReferencePanel'; // Removed - functionality moved to CambridgeReferencePanel

if (typeof window !== 'undefined') {
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

interface PageCanvas {
  pdfCanvas: HTMLCanvasElement;
  rendered: boolean;
}

export default function PDFViewerScrollable() {
  const searchParams = useSearchParams();
  const paperParam = searchParams.get('paper');

  // Constants for PDF rendering quality
  const EXTRACTION_QUALITY = 2.0; // Extract PDF at 2x for sharp rendering
  const DISPLAY_QUALITY = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

  // State
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [displayPageNum, setDisplayPageNum] = useState(1);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [linkedMarkingScheme, setLinkedMarkingScheme] = useState<string | null>(null);
  const [linkedInsertPaper, setLinkedInsertPaper] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const pdfDocRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageCanvasesRef = useRef<{ [pageNum: number]: PageCanvas }>({});
  const currentPageRef = useRef(0);
  const pageRenderedZoomRef = useRef<{ [pageNum: number]: number }>({});
  const canvasScaleRef = useRef<{ [pageNum: number]: number }>({}); // Track scale factor (internal/display) for each page
  const zoomDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Function to check if page is visible
  const isPageVisible = (pageNum: number): boolean => {
    const pageElement = document.getElementById(`page-${pageNum}`);
    if (!pageElement || !containerRef.current) return false;

    const containerRect = containerRef.current.getBoundingClientRect();
    const pageRect = pageElement.getBoundingClientRect();

    // Check if page is within viewport with some buffer
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

  // Load PDF document
  useEffect(() => {
    if (!paperParam) {
      setError('No paper specified');
      setLoading(false);
      return;
    }

    const loadPDF = async () => {
      try {
        setLoading(true);
        setError(null);

        const pdfUrl = `/api/pdf-proxy?paper=${encodeURIComponent(paperParam)}`;
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
  }, [paperParam]);

  // Render a single page
  const renderPage = async (pageNum: number, forceRerender = false) => {
    if (!pdfDocRef.current) return;

    const existingCanvas = pageCanvasesRef.current[pageNum];
    
    // Skip if already rendered at correct zoom and not forcing rerender
    if (existingCanvas?.rendered && 
        pageRenderedZoomRef.current[pageNum] === zoom && 
        !forceRerender) {
      return;
    }

    try {
      const page = await pdfDocRef.current.getPage(pageNum);
      const viewport = page.getViewport({ scale: EXTRACTION_QUALITY });

      // Create or reuse canvas
      const canvas = existingCanvas?.pdfCanvas || document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) return;

      // Set canvas dimensions for high-DPI rendering
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Calculate display size
      const scale = (zoom / 100) * DISPLAY_QUALITY;
      const displayWidth = viewport.width / EXTRACTION_QUALITY * scale;
      const displayHeight = viewport.height / EXTRACTION_QUALITY * scale;

      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;

      // Store the scale factor for this page
      canvasScaleRef.current[pageNum] = EXTRACTION_QUALITY / scale;

      // Render PDF page
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;

      // Update page canvas reference
      pageCanvasesRef.current[pageNum] = {
        pdfCanvas: canvas,
        rendered: true,
      };

      pageRenderedZoomRef.current[pageNum] = zoom;

      // Add canvas to DOM if not already there
      const pageContainer = document.getElementById(`page-${pageNum}`);
      if (pageContainer) {
        // Clear any existing canvas elements to prevent duplicates
        const existingCanvases = pageContainer.querySelectorAll('canvas');
        existingCanvases.forEach((existingCanvas) => {
          if (existingCanvas !== canvas) {
            existingCanvas.remove();
          }
        });
        
        // Only add if not already in DOM
        if (!pageContainer.contains(canvas)) {
          pageContainer.appendChild(canvas);
        }
      }

    } catch (error) {
      console.error(`Error rendering page ${pageNum}:`, error);
    }
  };

  // Handle scroll events - inlined in useEffect for better performance

  // Setup scroll listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Use a throttled scroll handler to avoid excessive rerenders
    let scrollTimeout: NodeJS.Timeout | null = null;
    const throttledScroll = () => {
      if (scrollTimeout) return;
      
      scrollTimeout = setTimeout(() => {
        updateCurrentPage();
        
        // Render visible pages
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
  }, [totalPages]);

  // Handle zoom changes with debouncing
  useEffect(() => {
    if (zoomDebounceRef.current) {
      clearTimeout(zoomDebounceRef.current);
    }

    zoomDebounceRef.current = setTimeout(() => {
      // Re-render all visible pages at new zoom level
      for (let i = 1; i <= totalPages; i++) {
        if (isPageVisible(i)) {
          renderPage(i, true); // Force rerender
        }
      }
    }, 150);

    return () => {
      if (zoomDebounceRef.current) {
        clearTimeout(zoomDebounceRef.current);
      }
    };
  }, [zoom, totalPages]);

  // Initial render of visible pages
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
        onTogglePanel={() => setIsPanelOpen(!isPanelOpen)}
      />

      <div className="flex-1 flex relative">
        {/* PDF Viewer Container */}
        <div 
          ref={containerRef}
          className="flex-1 overflow-auto bg-gray-200"
          style={{ height: 'calc(100vh - 120px)' }}
        >
          <div className="py-4">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <div
                key={pageNum}
                id={`page-${pageNum}`}
                className="relative mb-4 mx-auto bg-white shadow-lg"
                style={{
                  width: 'fit-content',
                  minHeight: '400px',
                }}
              >
                {/* Page number overlay */}
                <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm z-10">
                  Page {pageNum}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Reference Panel - Removed, functionality moved to CambridgeReferencePanel */}
        {/*
        <ReferencePanel
          isOpen={isPanelOpen}
          onClose={() => setIsPanelOpen(false)}
          linkedMarkingScheme={linkedMarkingScheme}
          linkedInsertPaper={linkedInsertPaper}
          onMarkingSchemeChange={setLinkedMarkingScheme}
          onInsertPaperChange={setLinkedInsertPaper}
        />
        */}
      </div>
    </div>
  );
}

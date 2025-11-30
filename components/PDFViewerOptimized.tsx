'use client';

import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { ChevronRight, Pen, Trash2, X, RotateCcw, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
if (typeof window !== 'undefined') {
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

interface DrawingState {
  [pageNum: number]: string[]; // Array of canvas states (for undo/redo)
}

export default function PDFViewerOptimized() {
  const searchParams = useSearchParams();
  const paperParam = searchParams.get('paper');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<{ [key: number]: HTMLCanvasElement }>({});
  const pdfCanvasRefs = useRef<{ [key: number]: HTMLCanvasElement }>({});
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#ff0000');
  const [brushSize, setBrushSize] = useState(3);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set());
  const [showMarkingScheme, setShowMarkingScheme] = useState(false);
  const [showInsertPaper, setShowInsertPaper] = useState(false);
  const [linkedMarkingScheme, setLinkedMarkingScheme] = useState<string | null>(null);
  const [linkedInsertPaper, setLinkedInsertPaper] = useState<string | null>(null);
  const [toolbarPos, setToolbarPos] = useState({ x: 32, y: 32 });
  const [panelPos, setPanelPos] = useState({ x: 32, y: 150 });
  const [isDraggingToolbar, setIsDraggingToolbar] = useState(false);
  const [isDraggingPanel, setIsDraggingPanel] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  const pdfDocRef = useRef<any>(null);
  const currentPageRef = useRef<number>(1);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const renderingRef = useRef<{ [key: number]: boolean }>({});
  
  // Drawing history for undo/redo
  const drawingHistoryRef = useRef<DrawingState>({});
  const historyIndexRef = useRef<{ [pageNum: number]: number }>({});

  // Generate linked paper names (e.g., 9706-s23-qp-42.pdf -> 9706-s23-ms-42.pdf)
  const generateLinkedPapers = () => {
    if (!paperParam) return;

    const parts = paperParam.split('-');
    if (parts.length < 4) return;

    const [code, session, type, component] = parts;
    const componentClean = component.replace('.pdf', '');

    const msName = `${code}-${session}-ms-${componentClean}.pdf`;
    const inName = `${code}-${session}-in-${componentClean}.pdf`;

    setLinkedMarkingScheme(msName);
    setLinkedInsertPaper(inName);
  };

  // Initialize linked papers on load
  useEffect(() => {
    generateLinkedPapers();
  }, [paperParam]);

  // Drag handlers for toolbar
  const handleToolbarMouseDown = (e: React.MouseEvent) => {
    setIsDraggingToolbar(true);
    setDragOffset({
      x: e.clientX - toolbarPos.x,
      y: e.clientY - toolbarPos.y,
    });
  };

  // Drag handlers for reference panel
  const handlePanelMouseDown = (e: React.MouseEvent) => {
    setIsDraggingPanel(true);
    setDragOffset({
      x: e.clientX - panelPos.x,
      y: e.clientY - panelPos.y,
    });
  };

  // Handle mouse move for dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingToolbar) {
        setToolbarPos({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y,
        });
      }
      if (isDraggingPanel) {
        setPanelPos({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDraggingToolbar(false);
      setIsDraggingPanel(false);
    };

    if (isDraggingToolbar || isDraggingPanel) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDraggingToolbar, isDraggingPanel, dragOffset]);

  // Load annotations from localStorage
  const loadAnnotations = () => {
    if (!paperParam) return {};
    const key = `pdf_annotations_${paperParam}`;
    return JSON.parse(localStorage.getItem(key) || '{}');
  };

  // Save annotations to localStorage
  const saveToStorage = (pageNum: number) => {
    const canvas = canvasRefs.current[pageNum];
    if (!canvas) return;

    const key = `pdf_annotations_${paperParam}`;
    let saved = JSON.parse(localStorage.getItem(key) || '{}');
    
    // Store the full history for this page
    saved[pageNum] = {
      history: drawingHistoryRef.current[pageNum] || [canvas.toDataURL()],
      index: historyIndexRef.current[pageNum] || 0,
    };
    
    localStorage.setItem(key, JSON.stringify(saved));
  };

  // Initialize drawing history for a page
  const initializeDrawingHistory = (pageNum: number) => {
    if (!drawingHistoryRef.current[pageNum]) {
      drawingHistoryRef.current[pageNum] = [''];
      historyIndexRef.current[pageNum] = 0;
    }
  };

  // Add to drawing history (for undo)
  const addToHistory = (pageNum: number) => {
    const canvas = canvasRefs.current[pageNum];
    if (!canvas) return;

    initializeDrawingHistory(pageNum);
    
    // Capture the current canvas state
    const canvasState = canvas.toDataURL('image/png');
    
    // Only add if it's different from the last state (avoid duplicate empty strokes)
    const lastState = drawingHistoryRef.current[pageNum][historyIndexRef.current[pageNum]];
    if (canvasState === lastState) return;
    
    // Remove any redo history
    drawingHistoryRef.current[pageNum] = drawingHistoryRef.current[pageNum].slice(
      0,
      historyIndexRef.current[pageNum] + 1
    );

    // Add new state
    drawingHistoryRef.current[pageNum].push(canvasState);
    historyIndexRef.current[pageNum] = drawingHistoryRef.current[pageNum].length - 1;

    // Limit history to 50 states per page
    if (drawingHistoryRef.current[pageNum].length > 50) {
      drawingHistoryRef.current[pageNum].shift();
      historyIndexRef.current[pageNum]--;
    }

    // Save to localStorage
    saveToStorage(pageNum);
  };

  // Undo
  const undo = (pageNum: number) => {
    initializeDrawingHistory(pageNum);
    const history = drawingHistoryRef.current[pageNum];
    const currentIndex = historyIndexRef.current[pageNum];

    if (currentIndex > 0) {
      historyIndexRef.current[pageNum]--;
      restoreFromHistory(pageNum, historyIndexRef.current[pageNum]);
    }
  };

  // Redo
  const redo = (pageNum: number) => {
    initializeDrawingHistory(pageNum);
    const history = drawingHistoryRef.current[pageNum];
    const currentIndex = historyIndexRef.current[pageNum];

    if (currentIndex < history.length - 1) {
      historyIndexRef.current[pageNum]++;
      restoreFromHistory(pageNum, historyIndexRef.current[pageNum]);
    }
  };

  // Restore from history
  const restoreFromHistory = (pageNum: number, index: number) => {
    const canvas = canvasRefs.current[pageNum];
    if (!canvas) return;

    const history = drawingHistoryRef.current[pageNum];
    if (!history || !history[index]) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      saveToStorage(pageNum);
    };
    img.src = history[index];
  };

  // Clear page
  const clearPage = (pageNum: number) => {
    const canvas = canvasRefs.current[pageNum];
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      initializeDrawingHistory(pageNum);
      historyIndexRef.current[pageNum] = 0;
      drawingHistoryRef.current[pageNum] = [''];
      
      // Remove from localStorage
      const key = `pdf_annotations_${paperParam}`;
      let saved = JSON.parse(localStorage.getItem(key) || '{}');
      delete saved[pageNum];
      localStorage.setItem(key, JSON.stringify(saved));
    }
  };

  // Load PDF
  useEffect(() => {
    const loadPDF = async () => {
      if (!paperParam) return;

      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/past-papers/${paperParam}`);
        if (!response.ok) throw new Error('PDF not found');

        const arrayBuffer = await response.arrayBuffer();
        const pdf = await (pdfjsLib as any).getDocument({ data: arrayBuffer }).promise;
        pdfDocRef.current = pdf;
        setTotalPages(pdf.numPages);

        // Load saved annotations into history
        const saved = loadAnnotations();
        Object.entries(saved).forEach(([pageNum, data]) => {
          const num = parseInt(pageNum);
          const pageData = data as any;
          
          // Check if it's the new format (with history and index)
          if (pageData.history && Array.isArray(pageData.history)) {
            drawingHistoryRef.current[num] = pageData.history;
            historyIndexRef.current[num] = pageData.index || 0;
          } else if (typeof pageData === 'string') {
            // Fallback for old format (single string)
            drawingHistoryRef.current[num] = [pageData];
            historyIndexRef.current[num] = 0;
          }
        });

        setIsLoading(false);
        setTimeout(() => setupIntersectionObserver(), 100);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load PDF');
        setIsLoading(false);
      }
    };

    loadPDF();
  }, [paperParam]);

  const setupIntersectionObserver = () => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageNum = parseInt(entry.target.getAttribute('data-page') || '0');
            if (pageNum > 0 && !renderedPages.has(pageNum)) {
              renderPage(pageNum);
              setRenderedPages((prev) => new Set([...prev, pageNum]));
            }
          }
        });
      },
      { rootMargin: '500px' }
    );

    const pageElements = document.querySelectorAll('[data-page]');
    pageElements.forEach((el) => observerRef.current?.observe(el));
  };

  const renderPage = async (pageNum: number) => {
    // Skip if already rendering or rendered
    if (renderingRef.current[pageNum] || renderedPages.has(pageNum)) return;
    
    const pdfDoc = pdfDocRef.current;
    if (!pdfDoc) return;

    // Mark as rendering
    renderingRef.current[pageNum] = true;

    await new Promise(resolve => setTimeout(resolve, 10));

    const pdfCanvas = pdfCanvasRefs.current[pageNum];
    const drawCanvas = canvasRefs.current[pageNum];
    
    if (!pdfCanvas || !drawCanvas) {
      renderingRef.current[pageNum] = false;
      return;
    }

    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });

      pdfCanvas.width = viewport.width;
      pdfCanvas.height = viewport.height;
      drawCanvas.width = viewport.width;
      drawCanvas.height = viewport.height;

      const ctx = pdfCanvas.getContext('2d');
      if (!ctx) {
        renderingRef.current[pageNum] = false;
        return;
      }

      await page.render({
        canvasContext: ctx,
        viewport: viewport,
      }).promise;

      // Restore saved annotations
      initializeDrawingHistory(pageNum);
      if (drawingHistoryRef.current[pageNum] && drawingHistoryRef.current[pageNum][0]) {
        const img = new Image();
        img.onload = () => {
          const drawCtx = drawCanvas.getContext('2d');
          if (drawCtx) {
            drawCtx.drawImage(img, 0, 0);
          }
          renderingRef.current[pageNum] = false;
        };
        img.onerror = () => {
          renderingRef.current[pageNum] = false;
        };
        img.src = drawingHistoryRef.current[pageNum][0];
      } else {
        renderingRef.current[pageNum] = false;
      }
    } catch (err) {
      console.error(`Error rendering page ${pageNum}:`, err);
      renderingRef.current[pageNum] = false;
    }
  };

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    let clientX = 0, clientY = 0, pressure = 1;

    if ('touches' in e) {
      const touch = e.touches[0];
      if (!touch) return { x: 0, y: 0, pressure: 1 };
      clientX = touch.clientX;
      clientY = touch.clientY;
      if ('force' in touch) {
        pressure = (touch as any).force || 1;
      }
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
      pressure,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>, pageNum: number) => {
    setIsDrawing(true);
    currentPageRef.current = pageNum;

    const canvas = e.currentTarget as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);

    if ('touches' in e) e.preventDefault();
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = e.currentTarget as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y, pressure } = getCoordinates(e);

    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize * pressure;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineTo(x, y);
    ctx.stroke();

    if ('touches' in e) e.preventDefault();
  };

  const stopDrawing = (e?: React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);

    // Small delay to ensure canvas rendering is complete before capturing
    setTimeout(() => {
      addToHistory(currentPageRef.current);
    }, 10);

    if (e && 'touches' in e) e.preventDefault();
  };

  useEffect(() => {
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, []);

  if (!paperParam) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-12 text-center">
          <p className="text-gray-600">No paper selected</p>
        </div>
      </div>
    );
  }

  const currentPage = currentPageRef.current;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 w-full">
          <div className="flex items-center gap-2 text-gray-600 mb-4">
            <Link href="/" className="hover:text-blue-600">
              Home
            </Link>
            <ChevronRight size={16} />
            <Link href="/past-papers" className="hover:text-blue-600">
              Past Papers
            </Link>
            <ChevronRight size={16} />
            <span className="text-gray-900 font-medium">Viewer</span>
          </div>
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900 truncate">{paperParam}</h1>
            <Link
              href="/past-papers"
              className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 flex-shrink-0"
            >
              <X size={20} />
              Close
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-900">
              <p className="font-semibold">Error: {error}</p>
            </div>
          )}

          {isLoading && (
            <div className="mb-6 p-8 bg-white border border-gray-200 rounded-lg text-center">
              <p className="text-gray-600">Loading PDF pages...</p>
            </div>
          )}

          {!isLoading && !error && (
            <div ref={scrollContainerRef} className="space-y-8">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <div key={pageNum} data-page={pageNum} className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="mb-3 text-sm font-medium text-gray-700">Page {pageNum} of {totalPages}</div>
                  <div
                    className="inline-block"
                    style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}
                  >
                    <div className="relative inline-block">
                      {renderedPages.has(pageNum) ? (
                        <>
                          <canvas
                            ref={(ref) => {
                              if (ref) pdfCanvasRefs.current[pageNum] = ref;
                            }}
                            className="block"
                            style={{ pointerEvents: 'none' }}
                          />
                          <canvas
                            ref={(ref) => {
                              if (ref) canvasRefs.current[pageNum] = ref;
                            }}
                            onMouseDown={(e) => startDrawing(e, pageNum)}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            onTouchStart={(e) => startDrawing(e, pageNum)}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                            onTouchCancel={stopDrawing}
                            className="absolute top-0 left-0 cursor-crosshair touch-none"
                            style={{
                              backgroundColor: 'transparent',
                              pointerEvents: 'auto',
                            }}
                          />
                        </>
                      ) : (
                        <div className="w-96 h-96 bg-gray-100 rounded flex items-center justify-center text-gray-400">
                          Loading page...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Floating Toolbar - Compact Horizontal Bar */}
        {!isLoading && totalPages > 0 && (
          <div
            className="fixed bg-white rounded-full shadow-lg border border-gray-200 p-3 flex flex-row gap-2 z-50 cursor-move hover:shadow-xl transition-shadow items-center"
            style={{
              left: `${toolbarPos.x}px`,
              top: `${toolbarPos.y}px`,
              width: 'auto',
            }}
            onMouseDown={handleToolbarMouseDown}
          >
            {/* Drag Handle */}
            <div className="flex items-center justify-center gap-1 text-gray-400 select-none px-2">
              <div className="w-1 h-1 rounded-full bg-gray-300"></div>
              <div className="w-1 h-1 rounded-full bg-gray-300"></div>
            </div>

            <div className="w-px h-6 bg-gray-200"></div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setZoom(Math.max(50, zoom - 10))}
                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                title="Zoom out"
              >
                <ZoomOut size={16} className="text-gray-600" />
              </button>
              <span className="w-8 text-center text-xs text-gray-700 font-medium">{zoom}%</span>
              <button
                onClick={() => setZoom(Math.min(200, zoom + 10))}
                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                title="Zoom in"
              >
                <ZoomIn size={16} className="text-gray-600" />
              </button>
            </div>

            <div className="w-px h-6 bg-gray-200"></div>

            {/* Color Picker */}
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-8 h-8 border border-gray-300 rounded-full cursor-pointer"
              title="Pen color"
            />

            {/* Brush Size Controls with +/- Buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setBrushSize(Math.max(1, brushSize - 1));
                }}
                className="p-1 hover:bg-gray-100 rounded transition-colors text-gray-600 font-bold text-sm"
                title="Decrease brush size"
              >
                −
              </button>
              <div className="relative group">
                <div className="w-5 h-5 rounded border border-gray-300 bg-gray-50 flex items-center justify-center">
                  <div
                    className="rounded-full bg-gray-600"
                    style={{
                      width: `${brushSize * 1.5}px`,
                      height: `${brushSize * 1.5}px`,
                      maxWidth: '16px',
                      maxHeight: '16px',
                    }}
                  ></div>
                </div>
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-gray-900 text-white text-xs py-1 px-2 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  {brushSize}px
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setBrushSize(Math.min(15, brushSize + 1));
                }}
                className="p-1 hover:bg-gray-100 rounded transition-colors text-gray-600 font-bold text-sm"
                title="Increase brush size"
              >
                +
              </button>
            </div>

            <div className="w-px h-6 bg-gray-200"></div>

            {/* Undo/Redo */}
            <button
              onClick={() => undo(currentPage)}
              className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
              title="Undo"
            >
              <RotateCcw size={16} className="text-gray-600" />
            </button>
            <button
              onClick={() => redo(currentPage)}
              className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
              title="Redo"
            >
              <RotateCw size={16} className="text-gray-600" />
            </button>

            <div className="w-px h-6 bg-gray-200"></div>

            {/* Clear */}
            <button
              onClick={() => clearPage(currentPage)}
              className="p-1.5 hover:bg-red-50 rounded-full transition-colors"
              title="Clear page"
            >
              <Trash2 size={16} className="text-red-600" />
            </button>

            {/* Pen Indicator */}
            <div className="flex items-center gap-1 px-2 text-xs text-blue-600">
              <Pen size={14} />
            </div>
          </div>
        )}

        {/* Linked Papers Panel - Compact */}
        {!isLoading && totalPages > 0 && (linkedMarkingScheme || linkedInsertPaper) && (
          <div
            className="fixed bg-white rounded-xl shadow-lg border border-gray-200 p-3 flex flex-col gap-2 z-50 cursor-move hover:shadow-xl transition-shadow"
            style={{
              left: `${panelPos.x}px`,
              top: `${panelPos.y}px`,
              width: '180px',
            }}
            onMouseDown={handlePanelMouseDown}
          >
            {/* Drag Handle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center justify-center gap-1 text-gray-400 select-none">
                <div className="w-1 h-1 rounded-full bg-gray-300"></div>
                <div className="w-1 h-1 rounded-full bg-gray-300"></div>
              </div>
              <span className="text-xs font-semibold text-gray-900">Ref</span>
            </div>
            
            {/* Marking Scheme Toggle */}
            {linkedMarkingScheme && (
              <button
                onClick={() => setShowMarkingScheme(!showMarkingScheme)}
                className="w-full px-2 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded text-xs font-medium transition-colors border border-amber-200"
              >
                📋 MS
              </button>
            )}

            {/* Insert Paper Toggle */}
            {linkedInsertPaper && (
              <button
                onClick={() => setShowInsertPaper(!showInsertPaper)}
                className="w-full px-2 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-900 rounded text-xs font-medium transition-colors border border-blue-200"
              >
                📄 IP
              </button>
            )}
          </div>
        )}

        {/* Marking Scheme Side Panel */}
        {showMarkingScheme && linkedMarkingScheme && (
          <div className="fixed top-0 right-0 h-screen w-96 bg-white shadow-xl z-40 overflow-hidden flex flex-col border-l border-gray-200">
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 border-b border-amber-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Marking Scheme</h3>
              <button
                onClick={() => setShowMarkingScheme(false)}
                className="p-1 hover:bg-amber-100 rounded transition-colors"
              >
                <X size={20} className="text-gray-600" />
              </button>
            </div>
            <iframe
              src={`/past-papers/${linkedMarkingScheme}`}
              className="flex-1 w-full"
              title="Marking Scheme"
            />
          </div>
        )}

        {/* Insert Paper Side Panel */}
        {showInsertPaper && linkedInsertPaper && (
          <div className="fixed top-0 right-0 h-screen w-96 bg-white shadow-xl z-40 overflow-hidden flex flex-col border-l border-gray-200">
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-4 border-b border-blue-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Insert Paper</h3>
              <button
                onClick={() => setShowInsertPaper(false)}
                className="p-1 hover:bg-blue-100 rounded transition-colors"
              >
                <X size={20} className="text-gray-600" />
              </button>
            </div>
            <iframe
              src={`/past-papers/${linkedInsertPaper}`}
              className="flex-1 w-full"
              title="Insert Paper"
            />
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { ChevronRight, ZoomIn, ZoomOut, Pen, Trash2, X } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
if (typeof window !== 'undefined') {
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

interface PageAnnotations {
  [pageNum: number]: string; // Base64 canvas data
}

export default function PDFViewerContent() {
  const searchParams = useSearchParams();
  const paperParam = searchParams.get('paper');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<{ [key: number]: HTMLCanvasElement }>({});
  const pdfCanvasRefs = useRef<{ [key: number]: HTMLCanvasElement }>({});
  const [isDrawing, setIsDrawing] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [color, setColor] = useState('#ff0000');
  const [brushSize, setBrushSize] = useState(3);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<PageAnnotations>({});
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set());
  const pdfDocRef = useRef<any>(null);
  const currentDrawingPageRef = useRef<number>(1);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Save annotations to localStorage
  const saveAnnotations = (pageNum: number, canvasData: string) => {
    const key = `pdf_annotations_${paperParam}`;
    let saved = JSON.parse(localStorage.getItem(key) || '{}');
    saved[pageNum] = canvasData;
    localStorage.setItem(key, JSON.stringify(saved));
  };

  // Load annotations from localStorage
  const loadAnnotations = () => {
    if (!paperParam) return {};
    const key = `pdf_annotations_${paperParam}`;
    return JSON.parse(localStorage.getItem(key) || '{}');
  };

  // Load PDF and set up lazy rendering with intersection observer
  useEffect(() => {
    const loadPDF = async () => {
      if (!paperParam) return;

      try {
        setIsLoading(true);
        setError(null);

        // Fetch PDF from public folder
        const response = await fetch(`/past-papers/${paperParam}`);
        if (!response.ok) throw new Error('PDF not found');

        const arrayBuffer = await response.arrayBuffer();
        const pdf = await (pdfjsLib as any).getDocument({ data: arrayBuffer }).promise;
        pdfDocRef.current = pdf;
        setTotalPages(pdf.numPages);

        // Load saved annotations
        const saved = loadAnnotations();
        setAnnotations(saved);

        setIsLoading(false);

        // Set up intersection observer after pages are rendered
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

    // Observe all page elements
    const pageElements = document.querySelectorAll('[data-page]');
    pageElements.forEach((el) => observerRef.current?.observe(el));
  };

  useEffect(() => {
    // Cleanup observer on unmount
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, []);

  const renderPage = async (pageNum: number) => {
    const pdfDoc = pdfDocRef.current;
    if (!pdfDoc) return;

    // Wait for refs to be attached
    await new Promise(resolve => setTimeout(resolve, 10));

    const pdfCanvas = pdfCanvasRefs.current[pageNum];
    const drawCanvas = canvasRefs.current[pageNum];
    
    if (!pdfCanvas || !drawCanvas) {
      console.warn(`Canvas refs not found for page ${pageNum}`);
      return;
    }

    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });

      // Set canvas dimensions
      pdfCanvas.width = viewport.width;
      pdfCanvas.height = viewport.height;
      drawCanvas.width = viewport.width;
      drawCanvas.height = viewport.height;

      // Render PDF to pdfCanvas
      const ctx = pdfCanvas.getContext('2d');
      if (!ctx) return;

      await page.render({
        canvasContext: ctx,
        viewport: viewport,
      }).promise;

      // Restore saved annotations to drawing canvas
      const savedData = annotations[pageNum];
      if (savedData) {
        const img = new Image();
        img.onload = () => {
          const drawCtx = drawCanvas.getContext('2d');
          if (drawCtx) {
            drawCtx.drawImage(img, 0, 0);
          }
        };
        img.src = savedData;
      }
    } catch (err) {
      console.error(`Error rendering page ${pageNum}:`, err);
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
    const canvas = e.currentTarget as HTMLCanvasElement;
    setIsDrawing(true);
    currentDrawingPageRef.current = pageNum;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);

    if ('touches' in e) {
      e.preventDefault();
    }
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

    if ('touches' in e) {
      e.preventDefault();
    }
  };

  const stopDrawing = (e?: React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);

    // Save current page annotations
    const canvas = canvasRefs.current[currentDrawingPageRef.current];
    if (canvas) {
      const canvasData = canvas.toDataURL();
      saveAnnotations(currentDrawingPageRef.current, canvasData);
      
      // Update state so annotations persist on page reload
      setAnnotations(prev => ({
        ...prev,
        [currentDrawingPageRef.current]: canvasData
      }));
    }

    if (e && 'touches' in e) {
      e.preventDefault();
    }
  };

  const clearCanvas = (pageNum: number) => {
    const canvas = canvasRefs.current[pageNum];
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Remove from saved annotations
      const key = `pdf_annotations_${paperParam}`;
      let saved = JSON.parse(localStorage.getItem(key) || '{}');
      delete saved[pageNum];
      localStorage.setItem(key, JSON.stringify(saved));
      
      // Update state
      setAnnotations(prev => {
        const updated = { ...prev };
        delete updated[pageNum];
        return updated;
      });
    }
  };

  const clearAllPages = () => {
    if (confirm('Clear annotations on all pages?')) {
      for (let i = 1; i <= totalPages; i++) {
        clearCanvas(i);
      }
      localStorage.removeItem(`pdf_annotations_${paperParam}`);
      setAnnotations({});
    }
  };

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

      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-auto flex flex-col">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
          {/* Toolbar - Sticky */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 flex flex-wrap gap-4 items-center sticky top-0 z-50">
            {/* Zoom */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoom(Math.max(50, zoom - 10))}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
                title="Zoom out"
              >
                <ZoomOut size={20} className="text-gray-600" />
              </button>
              <span className="w-12 text-center text-gray-700 font-medium">{zoom}%</span>
              <button
                onClick={() => setZoom(Math.min(200, zoom + 10))}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
                title="Zoom in"
              >
                <ZoomIn size={20} className="text-gray-600" />
              </button>
            </div>

            <div className="w-px h-6 bg-gray-200"></div>

            {/* Drawing Tools */}
            <div className="flex items-center gap-2">
              <Pen size={20} className="text-gray-600" />
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-12 h-8 border border-gray-300 rounded cursor-pointer"
                title="Select color"
              />
              <label className="text-sm text-gray-600">Size:</label>
              <input
                type="range"
                min="1"
                max="15"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-24"
                title="Brush size"
              />
            </div>

            <div className="w-px h-6 bg-gray-200"></div>

            {/* Actions */}
            <button
              onClick={clearAllPages}
              className="px-4 py-2 hover:bg-gray-100 rounded transition-colors flex items-center gap-2 text-gray-700 font-medium"
              title="Clear all annotations"
            >
              <Trash2 size={18} />
              Clear All
            </button>
          </div>

          {/* Error State */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-900">
              <p className="font-semibold">Error: {error}</p>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="mb-6 p-8 bg-white border border-gray-200 rounded-lg text-center">
              <p className="text-gray-600">Loading PDF pages...</p>
            </div>
          )}

          {/* All PDF Pages - Scrollable */}
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
                          {/* PDF Canvas */}
                          <canvas
                            ref={(ref) => {
                              if (ref) pdfCanvasRefs.current[pageNum] = ref;
                            }}
                            className="block"
                            style={{ pointerEvents: 'none', display: 'block' }}
                          />
                          {/* Drawing Canvas (on top) */}
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
                  {renderedPages.has(pageNum) && (
                    <button
                      onClick={() => clearCanvas(pageNum)}
                      className="mt-3 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
                    >
                      Clear this page
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Instructions */}
          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-900">
            <p className="font-semibold mb-2">Annotation Instructions</p>
            <ul className="text-sm space-y-1 list-disc list-inside">
              <li>Select color and brush size from the toolbar</li>
              <li>Click and drag to draw annotations on any page</li>
              <li>iPad Apple Pencil with pressure support</li>
              <li>Scroll to view all pages in one view</li>
              <li><strong>✓ Auto-saved:</strong> Your annotations are automatically saved in your browser</li>
              <li>When you return to this paper, your work will still be here</li>
              <li>Use "Clear this page" to clear individual pages</li>
              <li>Use "Clear All" to clear all pages at once</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

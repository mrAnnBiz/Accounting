'use client';

import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { ChevronRight, Download, ZoomIn, ZoomOut, Pen, Trash2, X } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
if (typeof window !== 'undefined') {
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

export default function PDFViewerContent() {
  const searchParams = useSearchParams();
  const paperParam = searchParams.get('paper');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [color, setColor] = useState('#ff0000');
  const [brushSize, setBrushSize] = useState(3);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pdfDocRef = useRef<any>(null);

  // Load and render PDF
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

        // Render first page
        await renderPage(pdf, 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load PDF');
      } finally {
        setIsLoading(false);
      }
    };

    loadPDF();
  }, [paperParam]);

  const renderPage = async (pdf: any, pageNum: number) => {
    if (!pdfCanvasRef.current) return;

    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });

      pdfCanvasRef.current.width = viewport.width;
      pdfCanvasRef.current.height = viewport.height;

      const ctx = pdfCanvasRef.current.getContext('2d');
      if (!ctx) return;

      await page.render({
        canvasContext: ctx,
        viewport: viewport,
      }).promise;

      // Initialize drawing canvas with same dimensions
      if (canvasRef.current) {
        canvasRef.current.width = viewport.width;
        canvasRef.current.height = viewport.height;
        const drawCtx = canvasRef.current.getContext('2d');
        if (drawCtx) {
          drawCtx.fillStyle = 'transparent';
          drawCtx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      }

      setCurrentPage(pageNum);
    } catch (err) {
      setError('Failed to render page');
    }
  };

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return { x: 0, y: 0, pressure: 1 };

    const rect = canvasRef.current.getBoundingClientRect();
    let clientX = 0, clientY = 0, pressure = 1;

    if ('touches' in e) {
      const touch = e.touches[0];
      if (!touch) return { x: 0, y: 0, pressure: 1 };
      clientX = touch.clientX;
      clientY = touch.clientY;
      // iPad Pencil pressure support
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

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    setIsDrawing(true);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);

    // Prevent default to enable smooth iPad drawing
    if ('touches' in e) {
      e.preventDefault();
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y, pressure } = getCoordinates(e);

    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize * pressure;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineTo(x, y);
    ctx.stroke();

    // Prevent default to enable smooth iPad drawing
    if ('touches' in e) {
      e.preventDefault();
    }
  };

  const stopDrawing = (e?: React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(false);
    if (e && 'touches' in e) {
      e.preventDefault();
    }
  };

  const clearCanvas = () => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  };

  const downloadAnnotations = () => {
    const pdfCanvas = pdfCanvasRef.current;
    const drawCanvas = canvasRef.current;
    if (!pdfCanvas || !drawCanvas) return;

    // Create merged canvas
    const mergedCanvas = document.createElement('canvas');
    mergedCanvas.width = pdfCanvas.width;
    mergedCanvas.height = pdfCanvas.height;
    const mergedCtx = mergedCanvas.getContext('2d');
    if (!mergedCtx) return;

    // Draw PDF first
    mergedCtx.drawImage(pdfCanvas, 0, 0);
    // Draw annotations on top
    mergedCtx.drawImage(drawCanvas, 0, 0);

    const link = document.createElement('a');
    link.download = `${paperParam}-annotated.png`;
    link.href = mergedCanvas.toDataURL('image/png', 0.95);
    link.click();
  };

  const goToNextPage = async () => {
    if (currentPage < totalPages && pdfDocRef.current) {
      await renderPage(pdfDocRef.current, currentPage + 1);
      clearCanvas();
    }
  };

  const goToPreviousPage = async () => {
    if (currentPage > 1 && pdfDocRef.current) {
      await renderPage(pdfDocRef.current, currentPage - 1);
      clearCanvas();
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
            <Link href="/" className="hover:text-purple-600">
              Home
            </Link>
            <ChevronRight size={16} />
            <Link href="/past-papers" className="hover:text-purple-600">
              Past Papers
            </Link>
            <ChevronRight size={16} />
            <span className="text-gray-900 font-medium">Viewer</span>
          </div>
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900 truncate">{paperParam}</h1>
            <Link
              href="/past-papers"
              className="text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1 flex-shrink-0"
            >
              <X size={20} />
              Close
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Toolbar - Sticky */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 flex flex-wrap gap-4 items-center sticky top-0 z-40">
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
              onClick={clearCanvas}
              className="px-4 py-2 hover:bg-gray-100 rounded transition-colors flex items-center gap-2 text-gray-700 font-medium"
              title="Clear all annotations"
            >
              <Trash2 size={18} />
              Clear
            </button>
            <button
              onClick={downloadAnnotations}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors flex items-center gap-2 font-medium"
              title="Download annotated page"
            >
              <Download size={18} />
              Download
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
              <p className="text-gray-600">Loading PDF...</p>
            </div>
          )}

          {/* PDF + Drawing Canvas */}
          {!isLoading && !error && (
            <>
              <div
                ref={containerRef}
                className="bg-white rounded-lg border border-gray-200 inline-block"
                style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}
              >
                <div className="relative">
                  {/* PDF Canvas */}
                  <canvas
                    ref={pdfCanvasRef}
                    className="absolute top-0 left-0 z-10"
                    style={{ pointerEvents: 'none', display: 'block' }}
                  />
                  {/* Drawing Canvas (on top) */}
                  <canvas
                    ref={canvasRef}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    onTouchCancel={stopDrawing}
                    className="relative z-20 cursor-crosshair touch-none block"
                    style={{
                      backgroundColor: 'transparent',
                    }}
                  />
                </div>
              </div>

              {/* Page Navigation */}
              {totalPages > 0 && (
                <div className="mt-6 flex items-center justify-center gap-4">
                  <button
                    onClick={goToPreviousPage}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-gray-700 font-medium">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={goToNextPage}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}

              {/* Instructions */}
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-900">
                <p className="font-semibold mb-2">Annotation Instructions</p>
                <ul className="text-sm space-y-1 list-disc list-inside">
                  <li>Select color and brush size from the toolbar</li>
                  <li>Click and drag to draw annotations</li>
                  <li>iPad Apple Pencil with pressure support</li>
                  <li>Clear or download your annotated page</li>
                  <li>Navigate pages using Previous/Next buttons</li>
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

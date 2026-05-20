'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PageInfo } from '@/types/annotations';
import { eventBus } from '@/lib/eventBus';

const EXTRACTION_QUALITY = 2.0;
const DISPLAY_QUALITY = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
const VIEWPORT_BUFFER_PX = 200;
const SCROLL_THROTTLE_MS = 50;
const ZOOM_DEBOUNCE_MS = 150;
const INITIAL_PAGES_TO_RENDER = 3;

interface PageCanvas {
  pdfCanvas: HTMLCanvasElement;
  rendered: boolean;
}

interface UsePDFEngineOptions {
  paperParam: string | null;
  urlParam: string | null;
}

export function usePDFEngine({ paperParam, urlParam }: UsePDFEngineOptions) {
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [displayPageNum, setDisplayPageNum] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pdfDocRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageCanvasesRef = useRef<{ [pageNum: number]: PageCanvas }>({});
  const currentPageRef = useRef(0);
  const pageRenderedZoomRef = useRef<{ [pageNum: number]: number }>({});
  const canvasScaleRef = useRef<{ [pageNum: number]: number }>({});
  const zoomDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Load PDF document
  useEffect(() => {
    if (!paperParam) return;

    const loadPDF = async () => {
      try {
        setLoading(true);
        setError(null);

        const pdfUrl = urlParam
          ? decodeURIComponent(urlParam)
          : `/api/pdf-proxy?paper=${encodeURIComponent(paperParam!)}`;
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdfDoc = await loadingTask.promise;

        pdfDocRef.current = pdfDoc;
        setTotalPages(pdfDoc.numPages);

        eventBus.emit('document:loaded', { pdfId: paperParam, totalPages: pdfDoc.numPages });
      } catch (err) {
        console.error('Error loading PDF:', err);
        setError(`Failed to load PDF: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    loadPDF();
  }, [paperParam, urlParam]);

  // Check if page is visible
  const isPageVisible = useCallback((pageNum: number): boolean => {
    const pageElement = document.getElementById(`page-${pageNum}`);
    if (!pageElement || !containerRef.current) return false;

    const containerRect = containerRef.current.getBoundingClientRect();
    const pageRect = pageElement.getBoundingClientRect();

    const buffer = VIEWPORT_BUFFER_PX;
    return (
      pageRect.bottom > containerRect.top - buffer &&
      pageRect.top < containerRect.bottom + buffer
    );
  }, []);

  // Update current page based on viewport center
  const updateCurrentPage = useCallback(() => {
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
  }, [totalPages, displayPageNum]);

  // Get page info for annotation coordinate mapping
  const getPageInfo = useCallback((pageNum: number): Promise<PageInfo | null> => {
    if (!pdfDocRef.current) return Promise.resolve(null);

    const canvas = pageCanvasesRef.current[pageNum]?.pdfCanvas;
    if (!canvas) return Promise.resolve(null);

    return pdfDocRef.current.getPage(pageNum).then((page: any) => {
      const viewport = page.getViewport({ scale: 1 });
      const zoomFraction = zoom / 100;
      const canvasDisplayWidth = canvas.offsetWidth || viewport.width * zoomFraction;
      const canvasDisplayHeight = canvas.offsetHeight || viewport.height * zoomFraction;

      return {
        pdfWidth: viewport.width,
        pdfHeight: viewport.height,
        canvasWidth: canvasDisplayWidth,
        canvasHeight: canvasDisplayHeight,
        scale: zoomFraction,
        offsetX: 0,
        offsetY: 0,
      } as PageInfo;
    });
  }, [zoom]);

  // Render a single page
  const renderPage = useCallback(async (pageNum: number, forceRerender = false) => {
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

      await page.render({ canvasContext: context, viewport }).promise;

      pageCanvasesRef.current[pageNum] = { pdfCanvas: canvas, rendered: true };
      pageRenderedZoomRef.current[pageNum] = zoom;

      const pageContainer = document.getElementById(`page-${pageNum}`);
      if (pageContainer) {
        const existing = pageContainer.querySelectorAll('canvas');
        existing.forEach((c) => { if (c !== canvas) c.remove(); });
        if (!pageContainer.contains(canvas)) pageContainer.appendChild(canvas);
      }
    } catch (err) {
      console.error(`Error rendering page ${pageNum}:`, err);
    }
  }, [zoom]);

  // Resize handler — re-render visible pages
  useEffect(() => {
    let resizeTimeout: NodeJS.Timeout | null = null;
    const handleResize = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (currentPageRef.current) renderPage(currentPageRef.current, true);
        for (let i = 1; i <= totalPages; i++) {
          if (i !== currentPageRef.current && isPageVisible(i)) renderPage(i, true);
        }
      }, 300);
    };
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); if (resizeTimeout) clearTimeout(resizeTimeout); };
  }, [totalPages, renderPage, isPageVisible]);

  // Scroll handler — lazy render visible pages
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let scrollTimeout: NodeJS.Timeout | null = null;
    const throttledScroll = () => {
      if (scrollTimeout) return;
      scrollTimeout = setTimeout(() => {
        updateCurrentPage();
        for (let i = 1; i <= totalPages; i++) {
          if (isPageVisible(i)) renderPage(i);
        }
        scrollTimeout = null;
      }, SCROLL_THROTTLE_MS);
    };

    container.addEventListener('scroll', throttledScroll);
    return () => { container.removeEventListener('scroll', throttledScroll); if (scrollTimeout) clearTimeout(scrollTimeout); };
  }, [totalPages, zoom, updateCurrentPage, isPageVisible, renderPage]);

  // Zoom change handler
  useEffect(() => {
    if (zoomDebounceRef.current) clearTimeout(zoomDebounceRef.current);
    zoomDebounceRef.current = setTimeout(() => {
      for (let i = 1; i <= totalPages; i++) {
        if (isPageVisible(i)) renderPage(i, true);
      }
    }, ZOOM_DEBOUNCE_MS);
    return () => { if (zoomDebounceRef.current) clearTimeout(zoomDebounceRef.current); };
  }, [zoom, totalPages, isPageVisible, renderPage]);

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
  }, [totalPages, renderPage, updateCurrentPage]);

  // Navigation
  const goToPage = useCallback((pageNum: number) => {
    if (pageNum < 1 || pageNum > totalPages) return;
    const el = document.getElementById(`page-${pageNum}`);
    if (el && containerRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [totalPages]);

  const nextPage = useCallback(() => { if (displayPageNum < totalPages) goToPage(displayPageNum + 1); }, [displayPageNum, totalPages, goToPage]);
  const prevPage = useCallback(() => { if (displayPageNum > 1) goToPage(displayPageNum - 1); }, [displayPageNum, goToPage]);

  const zoomIn = useCallback(() => setZoom(z => Math.min(200, z + 25)), []);
  const zoomOut = useCallback(() => setZoom(z => Math.max(50, z - 25)), []);
  const resetZoom = useCallback(() => setZoom(100), []);

  return {
    totalPages,
    zoom,
    displayPageNum,
    loading,
    error,
    pdfDocRef,
    containerRef,
    pageCanvasesRef,
    isPageVisible,
    getPageInfo,
    renderPage,
    goToPage,
    nextPage,
    prevPage,
    zoomIn,
    zoomOut,
    resetZoom,
  };
}

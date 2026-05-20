/**
 * PDF Engine — Pure PDF loading, rendering, and page management.
 *
 * Extracted from EnhancedPDFViewerScrollable to decouple PDF concerns
 * from annotation logic. This module handles only PDF operations.
 */

import * as pdfjsLib from 'pdfjs-dist';

if (typeof window !== 'undefined') {
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

// ---- Types ----

export interface PDFPageMeta {
  pageNum: number;
  width: number;   // PDF points (1/72 inch)
  height: number;
  rotation: number;
}

export interface RenderOptions {
  /** Scale for extraction quality (internal resolution). Default 2. */
  extractionScale: number;
  /** Device pixel ratio for display. Default window.devicePixelRatio. */
  displayDPR: number;
  /** Zoom percentage (100 = 1:1). */
  zoom: number;
}

export interface RenderResult {
  canvas: HTMLCanvasElement;
  displayWidth: number;
  displayHeight: number;
}

const DEFAULT_RENDER_OPTIONS: RenderOptions = {
  extractionScale: 2.0,
  displayDPR: typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1,
  zoom: 100,
};

// ---- PDFEngine class ----

export class PDFEngine {
  private doc: any = null; // pdfjsLib.PDFDocumentProxy
  private pageCache = new Map<number, any>(); // pageNum -> PDFPageProxy

  get isLoaded(): boolean {
    return this.doc !== null;
  }

  get numPages(): number {
    return this.doc?.numPages ?? 0;
  }

  /**
   * Load a PDF from a URL.
   */
  async load(url: string): Promise<void> {
    this.dispose();
    const loadingTask = pdfjsLib.getDocument(url);
    this.doc = await loadingTask.promise;
  }

  /**
   * Load a PDF from raw bytes.
   */
  async loadBytes(data: Uint8Array): Promise<void> {
    this.dispose();
    const loadingTask = pdfjsLib.getDocument({ data });
    this.doc = await loadingTask.promise;
  }

  /**
   * Get metadata for a page (cached).
   */
  async getPageMeta(pageNum: number): Promise<PDFPageMeta> {
    const page = await this.getPage(pageNum);
    const vp = page.getViewport({ scale: 1 });
    return { pageNum, width: vp.width, height: vp.height, rotation: page.rotate };
  }

  /**
   * Render a page to a canvas element.
   */
  async renderPage(
    pageNum: number,
    opts: Partial<RenderOptions> = {}
  ): Promise<RenderResult> {
    const { extractionScale, displayDPR, zoom } = { ...DEFAULT_RENDER_OPTIONS, ...opts };
    const page = await this.getPage(pageNum);
    const viewport = page.getViewport({ scale: extractionScale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');

    await page.render({ canvasContext: ctx, viewport }).promise;

    // Compute CSS display size
    const displayScale = (zoom / 100) * displayDPR;
    const displayWidth = viewport.width / extractionScale * displayScale;
    const displayHeight = viewport.height / extractionScale * displayScale;

    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    return { canvas, displayWidth, displayHeight };
  }

  /**
   * Extract text content from a page (for search).
   */
  async getTextContent(pageNum: number): Promise<string> {
    const page = await this.getPage(pageNum);
    const content = await page.getTextContent();
    return content.items.map((item: any) => item.str).join(' ');
  }

  /**
   * Get the underlying PDFDocumentProxy (for advanced use).
   */
  getDocument(): any {
    return this.doc;
  }

  /**
   * Clean up resources.
   */
  dispose(): void {
    if (this.doc) {
      this.doc.destroy();
      this.doc = null;
    }
    this.pageCache.clear();
  }

  private async getPage(pageNum: number): Promise<any> {
    if (!this.doc) throw new Error('No PDF loaded');
    if (pageNum < 1 || pageNum > this.doc.numPages) {
      throw new Error(`Page ${pageNum} out of range (1..${this.doc.numPages})`);
    }

    let page = this.pageCache.get(pageNum);
    if (!page) {
      page = await this.doc.getPage(pageNum);
      this.pageCache.set(pageNum, page);
    }
    return page;
  }
}

export default PDFEngine;

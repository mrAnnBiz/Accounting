/**
 * Simplified PDF Export system for embedding annotations directly into PDF files
 * Phase 6: Advanced features with PDF-lib integration
 */

import { PDFDocument, PDFPage, rgb, StandardFonts, Color } from 'pdf-lib';
import { Annotation, Point } from '../types/annotations';

export interface ExportOptions {
  includeAnnotations?: boolean;
  includeMetadata?: boolean;
  quality?: 'low' | 'medium' | 'high';
  format?: 'pdf' | 'json' | 'csv';
  filename?: string;
}

export interface ExportResult {
  success: boolean;
  data?: Uint8Array | string;
  filename: string;
  metadata?: {
    annotationCount: number;
    fileSize: number;
    exportTime: number;
  };
  error?: string;
}

export class PDFAnnotationExporter {
  private pdfDoc: PDFDocument | null = null;
  private originalPdfBytes: Uint8Array | null = null;

  /**
   * Initialize exporter with original PDF data
   */
  async initialize(pdfBytes: Uint8Array): Promise<void> {
    try {
      this.originalPdfBytes = pdfBytes;
      this.pdfDoc = await PDFDocument.load(pdfBytes);
    } catch (error) {
      throw new Error(`Failed to load PDF: ${error}`);
    }
  }

  /**
   * Export annotations to PDF with embedded annotations
   */
  async exportToPDF(
    annotations: { [pageNumber: number]: Annotation[] },
    options: ExportOptions = {
      includeAnnotations: true,
      includeMetadata: true,
      quality: 'high',
      format: 'pdf'
    }
  ): Promise<ExportResult> {
    if (!this.pdfDoc) {
      throw new Error('PDF document not initialized');
    }

    const startTime = performance.now();

    try {
      const exportDoc = await PDFDocument.create();
      const pages = this.pdfDoc.getPages();

      // Copy all pages from original PDF
      const copiedPages = await exportDoc.copyPages(this.pdfDoc, pages.map((_, i) => i));
      copiedPages.forEach(page => exportDoc.addPage(page));

      let totalAnnotations = 0;

      // Add annotations to each page
      for (const [pageNum, pageAnnotations] of Object.entries(annotations)) {
        const pageIndex = parseInt(pageNum) - 1; // Convert to 0-based index
        if (pageIndex >= 0 && pageIndex < copiedPages.length) {
          const page = copiedPages[pageIndex];
          
          for (const annotation of pageAnnotations) {
            await this.addAnnotationToPage(page, annotation);
            totalAnnotations++;
          }
        }
      }

      // Add metadata if requested
      if (options.includeMetadata) {
        exportDoc.setTitle('Annotated PDF Document');
        exportDoc.setSubject('PDF with embedded annotations');
        exportDoc.setCreator('PDF Annotation System');
        exportDoc.setProducer('Cambridge PDF Annotation Tool');
        exportDoc.setCreationDate(new Date());
        exportDoc.setModificationDate(new Date());
      }

      const pdfBytes = await exportDoc.save();
      const exportTime = performance.now() - startTime;

      return {
        success: true,
        data: pdfBytes,
        filename: options.filename || 'annotated_document.pdf',
        metadata: {
          annotationCount: totalAnnotations,
          fileSize: pdfBytes.length,
          exportTime
        }
      };

    } catch (error) {
      return {
        success: false,
        filename: options.filename || 'export_failed.pdf',
        error: `Export failed: ${error}`
      };
    }
  }

  /**
   * Add a single annotation to a PDF page
   */
  private async addAnnotationToPage(page: PDFPage, annotation: Annotation): Promise<void> {
    try {
      const pageSize = page.getSize();
      const color = this.parseColor(annotation.properties.color);

      // Get first coordinate point for position
      const coords = annotation.coordinates[0] || { x: 0, y: 0 };
      
      // Transform coordinates from canvas to PDF space
      const pdfX = coords.x;
      const pdfY = pageSize.height - coords.y; // Flip Y coordinate

      switch (annotation.type) {
        case 'pen':
          await this.drawPenAnnotation(page, annotation, color);
          break;
        
        case 'highlighter':
          await this.drawHighlighterAnnotation(page, annotation, color);
          break;
        
        case 'rectangle':
          await this.drawRectangleAnnotation(page, annotation, color);
          break;
        
        case 'circle':
          await this.drawCircleAnnotation(page, annotation, color);
          break;
        
        case 'text':
          await this.drawTextAnnotation(page, annotation, color, pdfX, pdfY);
          break;
        
        default:
          console.warn(`Unsupported annotation type: ${annotation.type}`);
      }
    } catch (error) {
      console.error(`Failed to add annotation ${annotation.id}:`, error);
    }
  }

  /**
   * Draw pen annotation (simplified version)
   */
  private async drawPenAnnotation(page: PDFPage, annotation: Annotation, color: Color): Promise<void> {
    // For pen annotations, we'll draw simple lines between coordinate points
    if (annotation.coordinates.length < 2) return;

    const pageSize = page.getSize();
    
    page.drawLine({
      start: { 
        x: annotation.coordinates[0].x, 
        y: pageSize.height - annotation.coordinates[0].y 
      },
      end: { 
        x: annotation.coordinates[annotation.coordinates.length - 1].x, 
        y: pageSize.height - annotation.coordinates[annotation.coordinates.length - 1].y 
      },
      color: color,
      thickness: annotation.properties.strokeWidth || 2
    });
  }

  /**
   * Draw highlighter annotation
   */
  private async drawHighlighterAnnotation(page: PDFPage, annotation: Annotation, color: Color): Promise<void> {
    if (annotation.coordinates.length < 2) return;

    const pageSize = page.getSize();
    const start = annotation.coordinates[0];
    const end = annotation.coordinates[annotation.coordinates.length - 1];

    page.drawRectangle({
      x: Math.min(start.x, end.x),
      y: pageSize.height - Math.max(start.y, end.y),
      width: Math.abs(end.x - start.x) || 100,
      height: Math.abs(end.y - start.y) || 20,
      color: color,
      opacity: annotation.properties.opacity || 0.3
    });
  }

  /**
   * Draw rectangle annotation
   */
  private async drawRectangleAnnotation(page: PDFPage, annotation: Annotation, color: Color): Promise<void> {
    if (annotation.coordinates.length < 2) return;

    const pageSize = page.getSize();
    const start = annotation.coordinates[0];
    const end = annotation.coordinates[annotation.coordinates.length - 1];

    page.drawRectangle({
      x: Math.min(start.x, end.x),
      y: pageSize.height - Math.max(start.y, end.y),
      width: Math.abs(end.x - start.x) || 100,
      height: Math.abs(end.y - start.y) || 50,
      borderColor: color,
      borderWidth: annotation.properties.strokeWidth || 2
    });
  }

  /**
   * Draw circle annotation
   */
  private async drawCircleAnnotation(page: PDFPage, annotation: Annotation, color: Color): Promise<void> {
    if (annotation.coordinates.length < 2) return;

    const pageSize = page.getSize();
    const start = annotation.coordinates[0];
    const end = annotation.coordinates[annotation.coordinates.length - 1];
    const radius = Math.min(Math.abs(end.x - start.x), Math.abs(end.y - start.y)) / 2 || 25;

    page.drawCircle({
      x: start.x,
      y: pageSize.height - start.y,
      size: radius,
      borderColor: color,
      borderWidth: annotation.properties.strokeWidth || 2
    });
  }

  /**
   * Draw text annotation
   */
  private async drawTextAnnotation(
    page: PDFPage, 
    annotation: Annotation, 
    color: Color, 
    x: number, 
    y: number
  ): Promise<void> {
    const text = annotation.properties.text || 'Text annotation';
    const fontSize = annotation.properties.fontSize || 12;
    
    try {
      const font = await page.doc.embedFont(StandardFonts.Helvetica);
      
      page.drawText(text, {
        x: x,
        y: y,
        size: fontSize,
        font: font,
        color: color
      });
    } catch (error) {
      console.error('Failed to draw text annotation:', error);
    }
  }

  /**
   * Parse color string to PDF-lib Color object
   */
  private parseColor(colorString: string): Color {
    // Remove # if present
    const hex = colorString.replace('#', '');
    
    // Parse RGB values
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;
    
    return rgb(r, g, b);
  }

  /**
   * Export annotations as JSON
   */
  async exportToJSON(
    annotations: { [pageNumber: number]: Annotation[] },
    options: ExportOptions = {}
  ): Promise<ExportResult> {
    try {
      const exportData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        annotations: annotations,
        metadata: {
          totalAnnotations: Object.values(annotations).flat().length,
          pages: Object.keys(annotations).length
        }
      };

      const jsonString = JSON.stringify(exportData, null, 2);
      
      return {
        success: true,
        data: jsonString,
        filename: options.filename || 'annotations.json',
        metadata: {
          annotationCount: exportData.metadata.totalAnnotations,
          fileSize: jsonString.length,
          exportTime: 0
        }
      };
    } catch (error) {
      return {
        success: false,
        filename: options.filename || 'export_failed.json',
        error: `JSON export failed: ${error}`
      };
    }
  }
}

export default PDFAnnotationExporter;
/**
 * Simplified PDF Export system for embedding annotations directly into PDF files
 * Phase 6: Advanced features with PDF-lib integration
 */

import { PDFDocument, PDFPage, rgb, StandardFonts, Color } from 'pdf-lib';
import { Annotation, Point, PageInfo } from '../types/annotations';
import { coordinateSystem } from './coordinates';

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
   * Export annotations to PDF with proper coordinate conversion using PageInfo
   */
  async exportToPDFWithPageInfo(
    annotationsWithPageInfo: { [pageNumber: number]: { annotations: Annotation[], pageInfo: PageInfo } },
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

      // Add annotations to each page (no conversion needed - already in PDF coordinates)
      for (const [pageNum, { annotations }] of Object.entries(annotationsWithPageInfo)) {
        const pageIndex = parseInt(pageNum) - 1; // Convert to 0-based index
        if (pageIndex >= 0 && pageIndex < copiedPages.length && annotations.length > 0) {
          const page = copiedPages[pageIndex];
          
          for (const annotation of annotations) {
            // Annotations are already stored in PDF coordinates - use directly
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
   * Convert annotation coordinates from canvas space to PDF space
   */
  private convertAnnotationCoordinates(annotation: Annotation, pageInfo: PageInfo): Annotation {
    // Convert all coordinate points from canvas to PDF space
    const convertedCoordinates = annotation.coordinates.map(point => 
      coordinateSystem.canvasToPdf(point, pageInfo)
    );

    return {
      ...annotation,
      coordinates: convertedCoordinates
    };
  }

  /**
   * Add a single annotation to a PDF page
   * Annotations are already in PDF coordinate space
   */
  private async addAnnotationToPage(page: PDFPage, annotation: Annotation): Promise<void> {
    try {
      const color = this.parseColor(annotation.properties.color);

      // Get first coordinate point for position (already in PDF space)
      const coords = annotation.coordinates[0] || { x: 0, y: 0 };
      
      const pdfX = coords.x;
      const pdfY = coords.y;

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
   * Draw pen annotation with smooth strokes using all coordinate points
   * Coordinates are already in PDF space, no Y-axis flip needed
   */
  private async drawPenAnnotation(page: PDFPage, annotation: Annotation, color: Color): Promise<void> {
    // Use strokePoints if available (these are the full smooth path), otherwise use coordinates
    const points = (annotation.properties.strokePoints as Point[]) || annotation.coordinates;
    
    if (points.length < 2) return;

    const thickness = annotation.properties.strokeWidth || 2;
    
    // Draw smooth curves between points using quadratic bezier curves
    // Coordinates are already in PDF space with proper origin
    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      
      page.drawLine({
        start: { 
          x: current.x, 
          y: current.y 
        },
        end: { 
          x: next.x, 
          y: next.y 
        },
        color: color,
        thickness: thickness
      });
    }
  }

  /**
   * Draw highlighter annotation using all coordinate points for accurate coverage
   * Coordinates are already in PDF space
   */
  private async drawHighlighterAnnotation(page: PDFPage, annotation: Annotation, color: Color): Promise<void> {
    // Use strokePoints if available, otherwise use coordinates
    const points = (annotation.properties.strokePoints as Point[]) || annotation.coordinates;
    
    if (points.length < 2) return;

    const thickness = annotation.properties.strokeWidth || 15; // Highlighters are thicker
    const opacity = annotation.properties.opacity || 0.3;
    
    // Draw thick lines between all points to create continuous highlight effect
    // Coordinates are already in PDF space
    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      
      page.drawLine({
        start: { 
          x: current.x, 
          y: current.y 
        },
        end: { 
          x: next.x, 
          y: next.y 
        },
        color: color,
        thickness: thickness,
        opacity: opacity
      });
    }
  }

  /**
   * Draw rectangle annotation
   * Coordinates are already in PDF space
   */
  private async drawRectangleAnnotation(page: PDFPage, annotation: Annotation, color: Color): Promise<void> {
    if (annotation.coordinates.length < 2) return;

    const start = annotation.coordinates[0];
    const end = annotation.coordinates[annotation.coordinates.length - 1];

    page.drawRectangle({
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x) || 100,
      height: Math.abs(end.y - start.y) || 50,
      borderColor: color,
      borderWidth: annotation.properties.strokeWidth || 2
    });
  }

  /**
   * Draw circle annotation
   * Coordinates are already in PDF space
   */
  private async drawCircleAnnotation(page: PDFPage, annotation: Annotation, color: Color): Promise<void> {
    if (annotation.coordinates.length < 2) return;

    const start = annotation.coordinates[0];
    const end = annotation.coordinates[annotation.coordinates.length - 1];
    const radius = Math.min(Math.abs(end.x - start.x), Math.abs(end.y - start.y)) / 2 || 25;

    page.drawCircle({
      x: start.x,
      y: start.y,
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
'use client';

import { useState, useCallback, useRef } from 'react';
import type { Annotation, AnnotationDocument, AnnotationType, PageInfo } from '@/types/annotations';
import { annotationStorage } from '@/utils/storage';
import { eventBus } from '@/lib/eventBus';
import { getService } from '@/lib/bootstrap';
import { ServiceTokens } from '@/lib/serviceContainer';
import {
  UndoManager,
  AddAnnotationCommand,
  RemoveAnnotationCommand,
  UpdateAnnotationCommand,
  ClearPageCommand,
} from '@/lib/undoManager';
import { migrateDocument } from '@/lib/schemaMigration';

const DEFAULT_PAGE_WIDTH = 595;
const DEFAULT_PAGE_HEIGHT = 842;

export interface PageAnnotationState {
  annotations: Annotation[];
  pageInfo: PageInfo;
}

interface UseAnnotationsOptions {
  paperParam: string | null;
  totalPages: number;
}

export function useAnnotations({ paperParam, totalPages }: UseAnnotationsOptions) {
  const [annotationDocument, setAnnotationDocument] = useState<AnnotationDocument | null>(null);
  const [pageAnnotations, setPageAnnotations] = useState<{ [pageNum: number]: PageAnnotationState }>({});
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const undoManager = useRef(getService<UndoManager>(ServiceTokens.UndoManager)).current;

  const defaultPageInfo: PageInfo = {
    pdfWidth: DEFAULT_PAGE_WIDTH,
    pdfHeight: DEFAULT_PAGE_HEIGHT,
    canvasWidth: 0,
    canvasHeight: 0,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  };

  // Parse paper information from paperParam
  const parsePaperInfo = (param: string) => {
    const parts = param.split('_');
    if (parts.length >= 4) {
      return { subject: parts[0], series: parts[1], paperType: parts[2], paperNumber: parts[3] };
    }
    return { subject: 'unknown', series: 'unknown', paperType: 'qp', paperNumber: '1' };
  };

  // Initialize annotation document from storage
  const initializeAnnotationDocument = useCallback(async () => {
    if (!paperParam || totalPages === 0) return;

    try {
      let doc = await annotationStorage.loadAnnotationDocument(paperParam);

      if (!doc) {
        const paperInfo = parsePaperInfo(paperParam);
        doc = annotationStorage.createAnnotationDocument(paperParam, totalPages, paperInfo);
        await annotationStorage.saveAnnotationDocument(doc);
      } else {
        // Run schema migration on loaded documents
        const { document: migrated, migrationsApplied } = migrateDocument(doc as unknown as Record<string, unknown>);
        if (migrationsApplied.length > 0) {
          doc = migrated as unknown as AnnotationDocument;
          await annotationStorage.saveAnnotationDocument(doc);
        }
      }

      setAnnotationDocument(doc);

      const state: { [pageNum: number]: PageAnnotationState } = {};
      doc.annotations.forEach((page, index) => {
        state[index + 1] = {
          annotations: page.annotations,
          pageInfo: {
            pdfWidth: page.pageSize.width,
            pdfHeight: page.pageSize.height,
            canvasWidth: 0,
            canvasHeight: 0,
            scale: 1,
            offsetX: 0,
            offsetY: 0,
          },
        };
      });
      setPageAnnotations(state);
    } catch (err) {
      console.error('Failed to initialize annotation document:', err);
    }
  }, [paperParam, totalPages]);

  // Ensure all pages have initial state
  const ensureAllPages = useCallback(() => {
    if (totalPages > 0 && Object.keys(pageAnnotations).length === 0) {
      const initial: { [pageNum: number]: PageAnnotationState } = {};
      for (let i = 1; i <= totalPages; i++) {
        initial[i] = { annotations: [], pageInfo: defaultPageInfo };
      }
      setPageAnnotations(initial);
    }
  }, [totalPages, pageAnnotations]);

  // Update page info for a specific page
  const updatePageInfo = useCallback((pageNum: number, pageInfo: PageInfo) => {
    setPageAnnotations(prev => ({
      ...prev,
      [pageNum]: { ...(prev[pageNum] || { annotations: [] }), pageInfo },
    }));
  }, []);

  // ---- Raw state operations (used by both forward and undo) ----

  const rawAddAnnotation = useCallback((pageNum: number, annotation: unknown) => {
    const ann = annotation as Annotation;
    setPageAnnotations(prev => {
      const existing = prev[pageNum];
      if (!existing) {
        return { ...prev, [pageNum]: { annotations: [ann], pageInfo: defaultPageInfo } };
      }
      return { ...prev, [pageNum]: { ...existing, annotations: [...existing.annotations, ann] } };
    });
  }, []);

  const rawRemoveAnnotation = useCallback((pageNum: number, annotationId: string) => {
    setPageAnnotations(prev => {
      if (!prev[pageNum]?.annotations) return prev;
      return {
        ...prev,
        [pageNum]: {
          ...prev[pageNum],
          annotations: prev[pageNum].annotations.filter(a => a.id !== annotationId),
        },
      };
    });
  }, []);

  const rawUpdateAnnotation = useCallback((pageNum: number, annotationId: string, state: Record<string, unknown>) => {
    setPageAnnotations(prev => {
      if (!prev[pageNum]?.annotations) return prev;
      return {
        ...prev,
        [pageNum]: {
          ...prev[pageNum],
          annotations: prev[pageNum].annotations.map(a => a.id === annotationId ? { ...a, ...state } : a),
        },
      };
    });
  }, []);

  const rawSetPageAnnotations = useCallback((pageNum: number, annotations: unknown[]) => {
    setPageAnnotations(prev => ({
      ...prev,
      [pageNum]: { ...prev[pageNum], annotations: annotations as Annotation[] },
    }));
  }, []);

  // ---- CRUD operations (go through UndoManager) ----

  const createAnnotation = useCallback(async (annotation: Annotation, pageNum: number) => {
    if (!annotationDocument) return;
    try {
      await annotationStorage.addAnnotation(annotationDocument.pdfId, pageNum, annotation);
      const cmd = new AddAnnotationCommand(pageNum, annotation, rawAddAnnotation, rawRemoveAnnotation);
      undoManager.execute(cmd);
      eventBus.emit('annotation:created', { pageNum, annotation });
    } catch (err) {
      console.error('Failed to create annotation:', err);
    }
  }, [annotationDocument, undoManager, rawAddAnnotation, rawRemoveAnnotation]);

  const updateAnnotation = useCallback(async (annotationId: string, updates: Partial<Annotation>, pageNum: number) => {
    if (!annotationDocument) return;
    try {
      // Capture previous state for undo
      const currentAnn = pageAnnotations[pageNum]?.annotations.find(a => a.id === annotationId);
      const previousState = currentAnn ? { ...currentAnn } : {};

      await annotationStorage.updateAnnotation(annotationDocument.pdfId, pageNum, annotationId, updates);
      const cmd = new UpdateAnnotationCommand(
        pageNum, annotationId,
        previousState as Record<string, unknown>,
        updates as Record<string, unknown>,
        rawUpdateAnnotation
      );
      undoManager.execute(cmd);
      eventBus.emit('annotation:updated', { pageNum, annotationId, updates });
    } catch (err) {
      console.error('Failed to update annotation:', err);
    }
  }, [annotationDocument, pageAnnotations, undoManager, rawUpdateAnnotation]);

  const deleteAnnotation = useCallback(async (annotationId: string, pageNum: number) => {
    if (!annotationDocument) return;

    const pageState = pageAnnotations[pageNum];
    const annotation = pageState?.annotations.find(a => a.id === annotationId);
    if (!annotation) return;

    try {
      await annotationStorage.removeAnnotation(annotationDocument.pdfId, pageNum, annotationId);
      const cmd = new RemoveAnnotationCommand(pageNum, annotation, rawAddAnnotation, rawRemoveAnnotation);
      undoManager.execute(cmd);
      eventBus.emit('annotation:deleted', { pageNum, annotationId });

      if (selectedAnnotationId === annotationId) setSelectedAnnotationId(null);
    } catch (err) {
      console.error('Failed to delete annotation:', err);
    }
  }, [annotationDocument, pageAnnotations, selectedAnnotationId, undoManager, rawAddAnnotation, rawRemoveAnnotation]);

  const clearPageAnnotations = useCallback(async (pageNum: number) => {
    if (!annotationDocument || !confirm('Are you sure you want to clear all annotations on this page?')) return;

    try {
      const current = pageAnnotations[pageNum]?.annotations || [];
      for (const annotation of current) {
        await annotationStorage.removeAnnotation(annotationDocument.pdfId, pageNum, annotation.id);
      }
      const cmd = new ClearPageCommand(pageNum, [...current], rawSetPageAnnotations);
      undoManager.execute(cmd);
      eventBus.emit('annotation:cleared', { pageNum });
    } catch (err) {
      console.error('Failed to clear annotations:', err);
    }
  }, [annotationDocument, pageAnnotations, undoManager, rawSetPageAnnotations]);

  const exportAnnotations = useCallback(async () => {
    if (!annotationDocument) return;
    try {
      const jsonData = await annotationStorage.exportToJson(annotationDocument.pdfId);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${annotationDocument.pdfId}_annotations.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      eventBus.emit('document:exported', { pdfId: annotationDocument.pdfId, format: 'json' });
    } catch (err) {
      console.error('Failed to export annotations:', err);
    }
  }, [annotationDocument]);

  const saveDocument = useCallback(async () => {
    if (!annotationDocument) return;
    try {
      await annotationStorage.saveAnnotationDocument(annotationDocument);
      eventBus.emit('document:saved', { pdfId: annotationDocument.pdfId });
    } catch (err) {
      console.error('Auto-save failed:', err);
    }
  }, [annotationDocument]);

  const undo = useCallback(() => undoManager.undo(), [undoManager]);
  const redo = useCallback(() => undoManager.redo(), [undoManager]);

  return {
    annotationDocument,
    pageAnnotations,
    selectedAnnotationId,
    setSelectedAnnotationId,
    initializeAnnotationDocument,
    ensureAllPages,
    updatePageInfo,
    createAnnotation,
    updateAnnotation,
    deleteAnnotation,
    clearPageAnnotations,
    exportAnnotations,
    saveDocument,
    undo,
    redo,
    canUndo: undoManager.canUndo(),
    canRedo: undoManager.canRedo(),
  };
}

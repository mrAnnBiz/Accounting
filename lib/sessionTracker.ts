/**
 * Session Tracker — Standalone module
 * Extracted from EnhancedPDFViewerScrollable.tsx (A1)
 * 
 * Tracks student activity during practice sessions for analytics.
 */

import { eventBus } from './eventBus';

export interface SessionMetrics {
  paperId: string;
  startTime: number;
  pageViewedSequence: { page: number; timestamp: number }[];
  annotationsByPage: Record<number, { tool: string; timestamp: number }[]>;
  toolUsageStats: Record<string, number>;
  zoomEvents: { zoom: number; timestamp: number }[];
}

export interface SessionSummary {
  paperId: string;
  duration: number;
  pagesViewed: number;
  totalAnnotations: number;
  toolUsageStats: Record<string, number>;
  averageTimePerPage: number;
}

export class SessionTracker {
  private sessions = new Map<string, SessionMetrics>();

  startTracking(paperId: string): void {
    this.sessions.set(paperId, {
      paperId,
      startTime: Date.now(),
      pageViewedSequence: [],
      annotationsByPage: {},
      toolUsageStats: {},
      zoomEvents: [],
    });
    eventBus.emit('session:started', { sessionId: paperId, paperId });
  }

  trackPageView(paperId: string, pageNum: number): void {
    const metrics = this.sessions.get(paperId);
    if (!metrics) return;
    metrics.pageViewedSequence.push({ page: pageNum, timestamp: Date.now() });
    eventBus.emit('session:page-changed', { pageNum });
  }

  trackAnnotationCreated(paperId: string, pageNum: number, toolType: string): void {
    const metrics = this.sessions.get(paperId);
    if (!metrics) return;

    if (!metrics.annotationsByPage[pageNum]) {
      metrics.annotationsByPage[pageNum] = [];
    }
    metrics.annotationsByPage[pageNum].push({ tool: toolType, timestamp: Date.now() });
    metrics.toolUsageStats[toolType] = (metrics.toolUsageStats[toolType] || 0) + 1;
  }

  trackZoom(paperId: string, zoom: number): void {
    const metrics = this.sessions.get(paperId);
    if (!metrics) return;
    metrics.zoomEvents.push({ zoom, timestamp: Date.now() });
    eventBus.emit('session:zoom-changed', { zoom });
  }

  getMetrics(paperId: string): SessionMetrics | null {
    return this.sessions.get(paperId) ?? null;
  }

  getSummary(paperId: string): SessionSummary | null {
    const metrics = this.sessions.get(paperId);
    if (!metrics) return null;

    const duration = Date.now() - metrics.startTime;
    const totalAnnotations = Object.values(metrics.annotationsByPage)
      .reduce((sum, arr) => sum + arr.length, 0);

    return {
      paperId,
      duration,
      pagesViewed: metrics.pageViewedSequence.length,
      totalAnnotations,
      toolUsageStats: metrics.toolUsageStats,
      averageTimePerPage: metrics.pageViewedSequence.length > 0
        ? duration / metrics.pageViewedSequence.length
        : 0,
    };
  }

  endTracking(paperId: string): SessionSummary | null {
    const summary = this.getSummary(paperId);
    this.sessions.delete(paperId);
    if (summary) {
      eventBus.emit('session:ended', { sessionId: paperId, summary });
    }
    return summary;
  }

  dispose(): void {
    this.sessions.clear();
  }
}

export default SessionTracker;

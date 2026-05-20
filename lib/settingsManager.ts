/**
 * Settings Manager — Standalone module
 * Extracted from EnhancedPDFViewerScrollable.tsx (A1)
 * 
 * Three-layer architecture:
 * 1. Core — Persistent user preferences (sync across devices)
 * 2. Session — Temporary state (cleared on browser close)
 * 3. Adaptive — Computed at runtime from device caps (never stored)
 */

import { v4 as uuidv4 } from 'uuid';
import { eventBus } from './eventBus';
import { DeviceDetector } from './deviceDetector';

// ---- Types ----

export interface CoreSettings {
  penColor: string;
  penSize: number;
  penOpacity: number;
  highlighterColor: string;
  highlighterOpacity: number;
  autoSaveEnabled: boolean;
  autoSaveIntervalMs: number;
  defaultExportFormat: 'pdf' | 'json';
  darkModeEnabled: boolean;
  defaultZoomLevel: number;
  toolPreferences: Record<string, Record<string, unknown>>;
  studyPreferences: {
    showMarkingSchemeByDefault: boolean;
    highlightQuestionBoundaries: boolean;
    groupAnnotationsByQuestion: boolean;
    enableAnnotationNotes: boolean;
  };
  version: string;
  lastSyncTime: number;
}

export interface SessionState {
  sessionId: string;
  currentPage: number;
  currentZoomLevel: number;
  scrollPosition: { top: number; left: number };
  selectedAnnotationId: string | null;
  activeToolSelection: string;
  viewportSize: { width: number; height: number };
  lastActivityTime: number;
  sessionStartTime: number;
  paperSpecificState: Record<string, {
    lastViewedPage: number;
    lastZoomLevel: number;
    timeSpent: number;
    completionPercentage: number;
  }>;
}

export interface AdaptiveConfig {
  device: string;
  screenSize: { width: number; height: number };
  pointerType: string;
  touchEnabled: boolean;
  isPressureSensitive: boolean;
  minTouchTargetSize: number;
  buttonSize: { toolbar: number; controls: number; text: number };
  canvasRenderingQuality: 'low' | 'medium' | 'high';
  palmRejectionEnabled: boolean;
}

// ---- Constants ----

const SETTINGS_VERSION = '1.0';
const CORE_STORAGE_KEY = 'anneruth_settings_core';
const SESSION_STORAGE_KEY = 'anneruth_settings_session';
const AUTO_SAVE_INTERVAL_MS = 30_000;

// ---- Manager ----

export class SettingsManager {
  private core: CoreSettings;
  private session: SessionState;
  private adaptive: AdaptiveConfig;

  constructor() {
    this.core = this.loadCore();
    this.session = this.loadSession();
    this.adaptive = this.computeAdaptive();
  }

  // ---- Core Settings ----

  getCore(): Readonly<CoreSettings> {
    return this.core;
  }

  updateCore(updates: Partial<CoreSettings>): void {
    this.core = { ...this.core, ...updates, lastSyncTime: Date.now() };
    this.saveCore();
    eventBus.emit('settings:core-updated', { changes: updates });
  }

  getToolPreferences(tool: string): Record<string, unknown> {
    return this.core.toolPreferences[tool] ?? {};
  }

  updateToolPreferences(tool: string, prefs: Record<string, unknown>): void {
    this.updateCore({
      toolPreferences: {
        ...this.core.toolPreferences,
        [tool]: prefs,
      },
    });
  }

  // ---- Session State ----

  getSession(): Readonly<SessionState> {
    return this.session;
  }

  updateSession(updates: Partial<SessionState>): void {
    this.session = { ...this.session, ...updates, lastActivityTime: Date.now() };
    this.saveSession();
    eventBus.emit('settings:session-updated', { changes: updates });
  }

  trackPaperActivity(paperId: string, pageNum: number, timeSpent: number): void {
    const existing = this.session.paperSpecificState[paperId] ?? {
      lastViewedPage: pageNum,
      lastZoomLevel: this.session.currentZoomLevel,
      timeSpent: 0,
      completionPercentage: 0,
    };

    this.session.paperSpecificState[paperId] = {
      ...existing,
      lastViewedPage: pageNum,
      timeSpent: existing.timeSpent + timeSpent,
    };
    this.saveSession();
  }

  // ---- Adaptive Config ----

  getAdaptive(): Readonly<AdaptiveConfig> {
    return this.adaptive;
  }

  recomputeAdaptive(): void {
    this.adaptive = this.computeAdaptive();
    eventBus.emit('settings:device-changed', { device: this.adaptive.device });
  }

  // ---- Persistence ----

  private loadCore(): CoreSettings {
    try {
      const raw = localStorage.getItem(CORE_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return this.getDefaultCore();
  }

  private saveCore(): void {
    try {
      localStorage.setItem(CORE_STORAGE_KEY, JSON.stringify(this.core));
    } catch { /* ignore */ }
  }

  private loadSession(): SessionState {
    try {
      const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return this.createNewSession();
  }

  private saveSession(): void {
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(this.session));
    } catch { /* ignore */ }
  }

  private getDefaultCore(): CoreSettings {
    return {
      penColor: '#FF0000',
      penSize: 2,
      penOpacity: 1,
      highlighterColor: '#FFFF00',
      highlighterOpacity: 0.3,
      autoSaveEnabled: true,
      autoSaveIntervalMs: AUTO_SAVE_INTERVAL_MS,
      defaultExportFormat: 'pdf',
      darkModeEnabled: false,
      defaultZoomLevel: 100,
      toolPreferences: {},
      studyPreferences: {
        showMarkingSchemeByDefault: true,
        highlightQuestionBoundaries: true,
        groupAnnotationsByQuestion: true,
        enableAnnotationNotes: true,
      },
      version: SETTINGS_VERSION,
      lastSyncTime: Date.now(),
    };
  }

  private createNewSession(): SessionState {
    const screen = typeof window !== 'undefined'
      ? { width: window.innerWidth, height: window.innerHeight }
      : { width: 1920, height: 1080 };

    return {
      sessionId: uuidv4(),
      currentPage: 1,
      currentZoomLevel: 100,
      scrollPosition: { top: 0, left: 0 },
      selectedAnnotationId: null,
      activeToolSelection: 'pen',
      viewportSize: screen,
      lastActivityTime: Date.now(),
      sessionStartTime: Date.now(),
      paperSpecificState: {},
    };
  }

  private computeAdaptive(): AdaptiveConfig {
    const caps = DeviceDetector.getCapabilities();
    const sizing = DeviceDetector.getUISizing(caps.device);

    return {
      device: caps.device,
      screenSize: caps.screenSize,
      pointerType: caps.pointerType,
      touchEnabled: caps.touchEnabled,
      isPressureSensitive: caps.isPressureSensitive,
      minTouchTargetSize: sizing.minTouchTarget,
      buttonSize: {
        toolbar: sizing.toolbarButtonSize,
        controls: sizing.controlSize,
        text: sizing.fontSize,
      },
      canvasRenderingQuality: caps.device === 'desktop' ? 'high' : 'medium',
      palmRejectionEnabled: caps.palmRejectionEnabled,
    };
  }

  // ---- Export / Import ----

  exportSettings(): string {
    return JSON.stringify({
      core: this.core,
      exportTime: new Date().toISOString(),
      version: SETTINGS_VERSION,
    }, null, 2);
  }

  importSettings(json: string): boolean {
    try {
      const data = JSON.parse(json);
      if (data.core && data.version === SETTINGS_VERSION) {
        this.updateCore(data.core);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  dispose(): void {
    // Nothing to clean up currently
  }
}

export default SettingsManager;

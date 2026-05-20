/**
 * Feature Flag System — Configuration-driven feature gating
 * 
 * Supports: environment-based defaults, runtime overrides, localStorage persistence.
 * Usage: schools get stable features, beta testers get experimental ones.
 */

import { eventBus } from './eventBus';

export interface FeatureFlag {
  name: string;
  description: string;
  defaultEnabled: boolean;
  /** Override groups: 'beta', 'school', 'premium', 'dev' */
  enabledFor: string[];
}

/** All known feature flags. Add new ones here. */
const FLAG_DEFINITIONS: Record<string, FeatureFlag> = {
  // Drawing features
  'drawing.realtimeSmoothing': {
    name: 'Real-time Stroke Smoothing',
    description: 'Catmull-Rom interpolation during drawing (not just on pointer-up)',
    defaultEnabled: false,
    enabledFor: ['beta', 'dev'],
  },
  'drawing.pixelEraser': {
    name: 'Pixel Eraser',
    description: 'Erase portions of strokes instead of whole strokes',
    defaultEnabled: false,
    enabledFor: ['beta', 'dev'],
  },
  'drawing.tiltAzimuth': {
    name: 'Apple Pencil Tilt/Azimuth',
    description: 'Use stylus tilt for shading width variation',
    defaultEnabled: false,
    enabledFor: ['beta', 'dev'],
  },
  'drawing.pencilDoubleTap': {
    name: 'Apple Pencil Double-Tap',
    description: 'Toggle eraser/last tool on Pencil 2 double-tap',
    defaultEnabled: false,
    enabledFor: ['beta'],
  },
  'drawing.strokeStabilizer': {
    name: 'Stroke Stabilizer',
    description: 'Moving-average smoothing for shaky hands',
    defaultEnabled: false,
    enabledFor: ['beta'],
  },
  'drawing.lassoSelect': {
    name: 'Lasso Select',
    description: 'Freeform selection tool for grouping/moving annotations',
    defaultEnabled: false,
    enabledFor: ['beta', 'dev'],
  },
  'drawing.snapToGrid': {
    name: 'Snap to Grid',
    description: 'Hold-to-straighten for lines and shapes',
    defaultEnabled: false,
    enabledFor: [],
  },
  'drawing.zoomToWrite': {
    name: 'Zoom-to-Write Window',
    description: 'Magnified writing area for precise small annotations',
    defaultEnabled: false,
    enabledFor: [],
  },

  // Platform features
  'platform.cloudSync': {
    name: 'Cloud Sync',
    description: 'Sync annotations across devices via cloud',
    defaultEnabled: false,
    enabledFor: ['premium'],
  },
  'platform.collaboration': {
    name: 'Real-time Collaboration',
    description: 'Shared annotation sessions',
    defaultEnabled: false,
    enabledFor: [],
  },
  'platform.fileUpload': {
    name: 'File Upload',
    description: 'Upload custom PDFs/images for annotation',
    defaultEnabled: false,
    enabledFor: ['beta', 'premium'],
  },
  'platform.offlineMode': {
    name: 'Offline Mode',
    description: 'Full offline-first with Service Worker caching',
    defaultEnabled: false,
    enabledFor: ['beta'],
  },
  'platform.i18n': {
    name: 'Multi-Language UI',
    description: 'Translated interface strings',
    defaultEnabled: false,
    enabledFor: [],
  },

  // UI modes
  'ui.smartboardMode': {
    name: 'Smartboard Mode',
    description: 'Large touch targets, simplified toolbar for classroom displays',
    defaultEnabled: false,
    enabledFor: ['school'],
  },
  'ui.examMode': {
    name: 'Exam Mode',
    description: 'Timer, restricted tools, auto-submit',
    defaultEnabled: false,
    enabledFor: [],
  },
  'ui.darkMode': {
    name: 'Dark Mode',
    description: 'Dark color scheme',
    defaultEnabled: false,
    enabledFor: ['beta', 'dev'],
  },
  'ui.performanceMonitor': {
    name: 'Performance Monitor',
    description: 'Show FPS/memory overlay in dev mode',
    defaultEnabled: false,
    enabledFor: ['dev'],
  },

  // Infrastructure
  'infra.webWorkers': {
    name: 'Web Workers',
    description: 'Off-main-thread PDF rendering and stroke processing',
    defaultEnabled: false,
    enabledFor: ['beta', 'dev'],
  },
  'infra.multiLayerCanvas': {
    name: 'Multi-Layer Canvas',
    description: 'Konva multi-layer architecture for performance',
    defaultEnabled: false,
    enabledFor: ['beta', 'dev'],
  },
} as const;

const STORAGE_KEY = 'anneruth_feature_flags';
const USERGROUP_KEY = 'anneruth_user_group';

export class FeatureFlagManager {
  private overrides = new Map<string, boolean>();
  private userGroups: string[] = [];

  constructor() {
    this.loadOverrides();
    this.loadUserGroups();
  }

  /**
   * Check if a feature flag is enabled.
   */
  isEnabled(flag: string): boolean {
    // Runtime override takes precedence
    if (this.overrides.has(flag)) {
      return this.overrides.get(flag)!;
    }

    const definition = FLAG_DEFINITIONS[flag];
    if (!definition) return false;

    // Check user group membership
    for (const group of this.userGroups) {
      if (definition.enabledFor.includes(group)) {
        return true;
      }
    }

    return definition.defaultEnabled;
  }

  /**
   * Set a runtime override for a flag.
   */
  setOverride(flag: string, enabled: boolean): void {
    this.overrides.set(flag, enabled);
    this.saveOverrides();
    eventBus.emit('feature:flag-changed', { flag, enabled });
  }

  /**
   * Remove a runtime override, reverting to default behavior.
   */
  clearOverride(flag: string): void {
    this.overrides.delete(flag);
    this.saveOverrides();
    eventBus.emit('feature:flag-changed', { flag, enabled: this.isEnabled(flag) });
  }

  /**
   * Set the user's group memberships.
   */
  setUserGroups(groups: string[]): void {
    this.userGroups = groups;
    this.saveUserGroups();
  }

  /**
   * Get all flags with their current state.
   */
  getAllFlags(): { flag: string; enabled: boolean; definition: FeatureFlag }[] {
    return Object.entries(FLAG_DEFINITIONS).map(([flag, definition]) => ({
      flag,
      enabled: this.isEnabled(flag),
      definition,
    }));
  }

  /**
   * Get the definition for a given flag.
   */
  getDefinition(flag: string): FeatureFlag | undefined {
    return FLAG_DEFINITIONS[flag];
  }

  private loadOverrides(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        for (const [key, value] of Object.entries(parsed)) {
          if (typeof value === 'boolean') {
            this.overrides.set(key, value);
          }
        }
      }
    } catch {
      // Ignore storage errors
    }
  }

  private saveOverrides(): void {
    try {
      const obj: Record<string, boolean> = {};
      for (const [key, value] of this.overrides) {
        obj[key] = value;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch {
      // Ignore storage errors
    }
  }

  private loadUserGroups(): void {
    try {
      const stored = localStorage.getItem(USERGROUP_KEY);
      if (stored) {
        this.userGroups = JSON.parse(stored);
      }
    } catch {
      // Ignore storage errors
    }

    // Auto-detect dev environment
    if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
      if (!this.userGroups.includes('dev')) {
        this.userGroups.push('dev');
      }
    }
  }

  private saveUserGroups(): void {
    try {
      localStorage.setItem(USERGROUP_KEY, JSON.stringify(this.userGroups));
    } catch {
      // Ignore storage errors
    }
  }
}

export const featureFlags = new FeatureFlagManager();
export default FeatureFlagManager;

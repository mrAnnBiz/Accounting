import { AnnotationTool, AnnotationProperties } from '@/types/annotations';

export interface ToolPreferences {
  [key: string]: Partial<AnnotationProperties>;
}

export const DEFAULT_TOOL_PREFERENCES: ToolPreferences = {
  pen: {
    color: '#000000',
    strokeWidth: 2,
    opacity: 1.0
  },
  highlighter: {
    color: '#FFFF00',
    strokeWidth: 8,
    opacity: 0.4
  },
  rectangle: {
    color: '#FF0000',
    strokeWidth: 2,
    opacity: 1.0,
    fillColor: 'transparent'
  },
  circle: {
    color: '#0000FF',
    strokeWidth: 2,
    opacity: 1.0,
    fillColor: 'transparent'
  },
  arrow: {
    color: '#008000',
    strokeWidth: 2,
    opacity: 1.0
  },
  line: {
    color: '#000000',
    strokeWidth: 2,
    opacity: 1.0
  },
  text: {
    color: '#000000',
    fontSize: 14,
    fontFamily: 'Arial',
    opacity: 1.0
  }
};

class ToolPreferencesManager {
  private static instance: ToolPreferencesManager;
  private preferences: ToolPreferences;
  private storageKey = 'annotation-tool-preferences';

  private constructor() {
    this.preferences = this.loadPreferences();
  }

  public static getInstance(): ToolPreferencesManager {
    if (!ToolPreferencesManager.instance) {
      ToolPreferencesManager.instance = new ToolPreferencesManager();
    }
    return ToolPreferencesManager.instance;
  }

  private loadPreferences(): ToolPreferences {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to ensure all tools have preferences
        return { ...DEFAULT_TOOL_PREFERENCES, ...parsed };
      }
    } catch (error) {
      console.warn('Failed to load tool preferences:', error);
    }
    return { ...DEFAULT_TOOL_PREFERENCES };
  }

  private savePreferences(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.preferences));
    } catch (error) {
      console.warn('Failed to save tool preferences:', error);
    }
  }

  public getPreferences(tool: AnnotationTool): Partial<AnnotationProperties> {
    return this.preferences[tool] || DEFAULT_TOOL_PREFERENCES[tool] || {};
  }

  public updatePreferences(tool: AnnotationTool, properties: Partial<AnnotationProperties>): void {
    this.preferences[tool] = {
      ...this.preferences[tool],
      ...properties
    };
    this.savePreferences();
  }

  public resetPreferences(tool?: AnnotationTool): void {
    if (tool) {
      this.preferences[tool] = { ...DEFAULT_TOOL_PREFERENCES[tool] };
    } else {
      this.preferences = { ...DEFAULT_TOOL_PREFERENCES };
    }
    this.savePreferences();
  }

  public getAllPreferences(): ToolPreferences {
    return { ...this.preferences };
  }
}

export const toolPreferencesManager = ToolPreferencesManager.getInstance();
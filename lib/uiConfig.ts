/**
 * Configuration-Driven UI — Defines what's visible in each mode
 * 
 * Instead of hardcoded toolbar JSX, modes define what tools/panels are shown.
 * Schools can customize without touching component code.
 */

export interface UIConfig {
  name: string;
  description: string;

  toolbar: {
    visible: boolean;
    tools: string[];          // Tool IDs to show
    position: 'top' | 'left' | 'right' | 'bottom' | 'floating';
    compact: boolean;
  };

  panels: {
    referencePanel: boolean;
    propertiesPanel: boolean;
    performanceMonitor: boolean;
    pageNavigator: boolean;
    searchBar: boolean;
  };

  canvas: {
    maxZoom: number;
    minZoom: number;
    defaultZoom: number;
    showGrid: boolean;
    showPageNumbers: boolean;
  };

  interaction: {
    enableKeyboardShortcuts: boolean;
    enableTouchGestures: boolean;
    enableRightClick: boolean;
    enableDragScroll: boolean;
  };

  /** Button sizing override */
  sizing: {
    toolbarButtonSize: number;
    controlSize: number;
    fontSize: number;
  };
}

/** All available built-in tool IDs */
export const TOOL_IDS = {
  PEN: 'pen',
  HIGHLIGHTER: 'highlighter',
  ERASER: 'eraser',
  SELECT: 'select',
  TEXT: 'text',
  RECTANGLE: 'rectangle',
  CIRCLE: 'circle',
  LINE: 'line',
  ARROW: 'arrow',
  PAN: 'pan',
  LASSO: 'lasso',         // Future
  RULER: 'ruler',          // Future
  PROTRACTOR: 'protractor', // Future
} as const;

// ---- Built-in Presets ----

export const UI_PRESETS: Record<string, UIConfig> = {
  student: {
    name: 'Student Mode',
    description: 'Full annotation tools for study sessions',
    toolbar: {
      visible: true,
      tools: ['pen', 'highlighter', 'eraser', 'text', 'select', 'rectangle', 'circle', 'arrow', 'pan'],
      position: 'top',
      compact: false,
    },
    panels: {
      referencePanel: true,
      propertiesPanel: true,
      performanceMonitor: false,
      pageNavigator: true,
      searchBar: true,
    },
    canvas: { maxZoom: 300, minZoom: 25, defaultZoom: 100, showGrid: false, showPageNumbers: true },
    interaction: { enableKeyboardShortcuts: true, enableTouchGestures: true, enableRightClick: true, enableDragScroll: true },
    sizing: { toolbarButtonSize: 32, controlSize: 28, fontSize: 12 },
  },

  teacher: {
    name: 'Teacher Mode',
    description: 'Marking tools with reference panels',
    toolbar: {
      visible: true,
      tools: ['pen', 'highlighter', 'text', 'select', 'eraser', 'pan'],
      position: 'top',
      compact: false,
    },
    panels: {
      referencePanel: true,
      propertiesPanel: true,
      performanceMonitor: false,
      pageNavigator: true,
      searchBar: true,
    },
    canvas: { maxZoom: 300, minZoom: 25, defaultZoom: 100, showGrid: false, showPageNumbers: true },
    interaction: { enableKeyboardShortcuts: true, enableTouchGestures: true, enableRightClick: true, enableDragScroll: true },
    sizing: { toolbarButtonSize: 32, controlSize: 28, fontSize: 12 },
  },

  smartboard: {
    name: 'Smartboard Mode',
    description: 'Large touch targets for classroom interactive displays',
    toolbar: {
      visible: true,
      tools: ['pen', 'highlighter', 'eraser', 'text', 'pan'],
      position: 'left',
      compact: false,
    },
    panels: {
      referencePanel: false,
      propertiesPanel: false,
      performanceMonitor: false,
      pageNavigator: true,
      searchBar: false,
    },
    canvas: { maxZoom: 200, minZoom: 50, defaultZoom: 100, showGrid: false, showPageNumbers: true },
    interaction: { enableKeyboardShortcuts: false, enableTouchGestures: true, enableRightClick: false, enableDragScroll: true },
    sizing: { toolbarButtonSize: 64, controlSize: 56, fontSize: 18 },
  },

  exam: {
    name: 'Exam Mode',
    description: 'Restricted tools, no distractions',
    toolbar: {
      visible: true,
      tools: ['pen', 'highlighter', 'eraser'],
      position: 'top',
      compact: true,
    },
    panels: {
      referencePanel: false,
      propertiesPanel: false,
      performanceMonitor: false,
      pageNavigator: true,
      searchBar: false,
    },
    canvas: { maxZoom: 200, minZoom: 50, defaultZoom: 100, showGrid: false, showPageNumbers: true },
    interaction: { enableKeyboardShortcuts: true, enableTouchGestures: true, enableRightClick: false, enableDragScroll: true },
    sizing: { toolbarButtonSize: 36, controlSize: 28, fontSize: 12 },
  },

  minimal: {
    name: 'Minimal Mode',
    description: 'Reading-only with basic highlighting',
    toolbar: {
      visible: true,
      tools: ['highlighter', 'pan'],
      position: 'top',
      compact: true,
    },
    panels: {
      referencePanel: false,
      propertiesPanel: false,
      performanceMonitor: false,
      pageNavigator: true,
      searchBar: false,
    },
    canvas: { maxZoom: 200, minZoom: 50, defaultZoom: 100, showGrid: false, showPageNumbers: true },
    interaction: { enableKeyboardShortcuts: true, enableTouchGestures: true, enableRightClick: false, enableDragScroll: true },
    sizing: { toolbarButtonSize: 32, controlSize: 28, fontSize: 12 },
  },
};

/**
 * Get a UI config by name, with optional overrides.
 */
export function getUIConfig(preset: string, overrides?: Partial<UIConfig>): UIConfig {
  const base = UI_PRESETS[preset] ?? UI_PRESETS.student;
  if (!overrides) return base;

  return {
    ...base,
    ...overrides,
    toolbar: { ...base.toolbar, ...overrides.toolbar },
    panels: { ...base.panels, ...overrides.panels },
    canvas: { ...base.canvas, ...overrides.canvas },
    interaction: { ...base.interaction, ...overrides.interaction },
    sizing: { ...base.sizing, ...overrides.sizing },
  };
}

export default UIConfig;

/**
 * Modular Tool System — Plugin architecture for annotation tools
 * 
 * Each tool implements ITool. New tools can be added without touching core.
 * The ToolRegistry manages lifecycle and provides the active tool to the canvas.
 */

import { eventBus } from './eventBus';

// ---- Types ----

export interface ToolPoint {
  x: number;
  y: number;
  pressure?: number;
  tiltX?: number;
  tiltY?: number;
  twist?: number;
}

export interface ToolContext {
  /** Canvas dimensions */
  canvasWidth: number;
  canvasHeight: number;
  /** Current zoom level (1.0 = 100%) */
  zoom: number;
  /** Current page number */
  pageNum: number;
  /** Pointer type that initiated the action */
  pointerType: 'pen' | 'mouse' | 'touch';
}

export interface ToolProperties {
  color: string;
  opacity: number;
  strokeWidth: number;
  [key: string]: unknown;
}

export interface ToolResult {
  /** The annotation data to persist (null if tool didn't produce output, e.g. eraser) */
  annotation: {
    type: string;
    coordinates: ToolPoint[];
    properties: Record<string, unknown>;
  } | null;
  /** IDs of annotations to delete (eraser) */
  deletedAnnotationIds?: string[];
  /** IDs of annotations to update (move/resize) */
  updatedAnnotations?: { id: string; updates: Record<string, unknown> }[];
}

// ---- Tool Interface ----

export interface ITool {
  /** Unique tool identifier */
  readonly id: string;
  /** Display name */
  readonly name: string;
  /** Tool category for grouping in UI */
  readonly category: 'draw' | 'shape' | 'edit' | 'navigate';
  /** CSS cursor to use when this tool is active */
  readonly cursor: string;
  /** Keyboard shortcut (single key) */
  readonly shortcut?: string;
  /** Default properties */
  readonly defaults: ToolProperties;

  /** Called when pointer/pen goes down */
  onPointerDown(point: ToolPoint, context: ToolContext, properties: ToolProperties): void;
  /** Called on each pointer move while drawing */
  onPointerMove(point: ToolPoint, context: ToolContext, properties: ToolProperties): void;
  /** Called when pointer is released. Returns the completed annotation data. */
  onPointerUp(context: ToolContext, properties: ToolProperties): ToolResult;
  /** Called to cancel the current action (e.g. ESC pressed) */
  onCancel(): void;

  /** Render live preview during drawing (returns Konva-compatible props or null) */
  getLivePreview(): { type: string; props: Record<string, unknown> } | null;
}

// ---- Tool Registry ----

export class ToolRegistry {
  private tools = new Map<string, ITool>();
  private activeTool: ITool | null = null;
  private activeProperties: ToolProperties = { color: '#000000', opacity: 1, strokeWidth: 2 };

  /**
   * Register a tool. Overwrites if ID already exists.
   */
  register(tool: ITool): void {
    this.tools.set(tool.id, tool);
  }

  /**
   * Unregister a tool by ID.
   */
  unregister(toolId: string): void {
    if (this.activeTool?.id === toolId) {
      this.activeTool = null;
    }
    this.tools.delete(toolId);
  }

  /**
   * Get a tool by ID.
   */
  get(toolId: string): ITool | undefined {
    return this.tools.get(toolId);
  }

  /**
   * Get all registered tools.
   */
  getAll(): ITool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools by category.
   */
  getByCategory(category: ITool['category']): ITool[] {
    return this.getAll().filter(t => t.category === category);
  }

  /**
   * Set the active tool. Emits event.
   */
  setActive(toolId: string, properties?: Partial<ToolProperties>): void {
    const previousTool = this.activeTool?.id ?? 'none';
    const tool = this.tools.get(toolId);

    // Cancel current tool action if switching
    if (this.activeTool && this.activeTool.id !== toolId) {
      this.activeTool.onCancel();
    }

    this.activeTool = tool ?? null;

    if (tool) {
      this.activeProperties = { ...tool.defaults, ...properties };
    }

    eventBus.emit('tool:selected', { tool: toolId, previousTool });
  }

  /**
   * Get the active tool (or null if none).
   */
  getActive(): ITool | null {
    return this.activeTool;
  }

  /**
   * Get/set properties for the active tool.
   */
  getProperties(): ToolProperties {
    return this.activeProperties;
  }

  setProperties(properties: Partial<ToolProperties>): void {
    this.activeProperties = { ...this.activeProperties, ...properties };
    if (this.activeTool) {
      eventBus.emit('tool:properties-changed', {
        tool: this.activeTool.id,
        properties: this.activeProperties,
      });
    }
  }

  /**
   * Find tool by keyboard shortcut.
   */
  findByShortcut(key: string): ITool | undefined {
    return this.getAll().find(t => t.shortcut?.toLowerCase() === key.toLowerCase());
  }

  /**
   * Get keyboard shortcut map.
   */
  getShortcutMap(): Record<string, string> {
    const map: Record<string, string> = {};
    for (const tool of this.getAll()) {
      if (tool.shortcut) {
        map[tool.shortcut] = tool.id;
      }
    }
    return map;
  }

  dispose(): void {
    if (this.activeTool) {
      this.activeTool.onCancel();
    }
    this.tools.clear();
    this.activeTool = null;
  }
}

export const toolRegistry = new ToolRegistry();
export default ToolRegistry;

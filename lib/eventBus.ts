/**
 * Event Bus — Pub/Sub system for decoupled communication
 * 
 * Replaces prop-drilling. Any module can emit/listen without importing each other.
 * Used by: storage, analytics, cloud sync, collaboration, native bridge, UI updates.
 */

type EventCallback<T = unknown> = (payload: T) => void;
type UnsubscribeFn = () => void;

interface EventSubscription {
  callback: EventCallback<any>;
  once: boolean;
  priority: number;
}

/** All known event types in the system. Extend this as features are added. */
export interface EventMap {
  // Annotation lifecycle
  'annotation:created': { pageNum: number; annotation: unknown };
  'annotation:updated': { pageNum: number; annotationId: string; updates: unknown };
  'annotation:deleted': { pageNum: number; annotationId: string };
  'annotation:cleared': { pageNum: number };
  'annotation:cleared-all': {};

  // Document lifecycle
  'document:loaded': { pdfId: string; totalPages: number };
  'document:saved': { pdfId: string };
  'document:exported': { pdfId: string; format: string };
  'document:schema-migrated': { pdfId: string; fromVersion: string; toVersion: string };

  // Tool state
  'tool:selected': { tool: string; previousTool: string };
  'tool:properties-changed': { tool: string; properties: unknown };

  // Input state
  'input:state-changed': { from: string; to: string; trigger: string };
  'input:stylus-detected': { pressure: number };
  'input:gesture': { type: string; data: unknown };

  // Session
  'session:started': { sessionId: string; paperId: string };
  'session:ended': { sessionId: string; summary: unknown };
  'session:page-changed': { pageNum: number };
  'session:zoom-changed': { zoom: number };

  // Storage
  'storage:save-started': { key: string };
  'storage:save-completed': { key: string };
  'storage:save-failed': { key: string; error: string };
  'storage:quota-warning': { usedPercent: number };

  // Settings
  'settings:core-updated': { changes: unknown };
  'settings:session-updated': { changes: unknown };
  'settings:device-changed': { device: string };

  // Platform
  'platform:online': {};
  'platform:offline': {};
  'platform:visibility-changed': { visible: boolean };
  'platform:resize': { width: number; height: number };

  // Feature flags
  'feature:flag-changed': { flag: string; enabled: boolean };

  // Undo/Redo
  'history:push': { command: unknown };
  'history:undo': { command: unknown };
  'history:redo': { command: unknown };
  'history:cleared': {};
}

class EventBus {
  private listeners = new Map<string, EventSubscription[]>();
  private debugMode = false;

  /**
   * Subscribe to an event.
   * Returns an unsubscribe function.
   */
  on<K extends keyof EventMap>(
    event: K,
    callback: EventCallback<EventMap[K]>,
    options?: { priority?: number }
  ): UnsubscribeFn {
    return this.addListener(event, callback, false, options?.priority ?? 0);
  }

  /**
   * Subscribe to an event, auto-unsubscribe after first fire.
   */
  once<K extends keyof EventMap>(
    event: K,
    callback: EventCallback<EventMap[K]>
  ): UnsubscribeFn {
    return this.addListener(event, callback, true, 0);
  }

  /**
   * Emit an event to all subscribers.
   */
  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    if (this.debugMode) {
      console.debug(`[EventBus] ${String(event)}`, payload);
    }

    const subs = this.listeners.get(event as string);
    if (!subs || subs.length === 0) return;

    // Sort by priority (higher first), execute
    const sorted = [...subs].sort((a, b) => b.priority - a.priority);
    const toRemove: EventSubscription[] = [];

    for (const sub of sorted) {
      try {
        sub.callback(payload);
        if (sub.once) toRemove.push(sub);
      } catch (err) {
        console.error(`[EventBus] Error in handler for "${String(event)}":`, err);
      }
    }

    // Clean up one-shot listeners
    if (toRemove.length > 0) {
      const remaining = subs.filter(s => !toRemove.includes(s));
      if (remaining.length === 0) {
        this.listeners.delete(event as string);
      } else {
        this.listeners.set(event as string, remaining);
      }
    }
  }

  /**
   * Remove all listeners for a specific event, or all events.
   */
  off<K extends keyof EventMap>(event?: K): void {
    if (event) {
      this.listeners.delete(event as string);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Enable debug logging for all events.
   */
  setDebug(enabled: boolean): void {
    this.debugMode = enabled;
  }

  /**
   * Get listener count for diagnostics.
   */
  listenerCount(event?: keyof EventMap): number {
    if (event) {
      return this.listeners.get(event as string)?.length ?? 0;
    }
    let total = 0;
    for (const subs of this.listeners.values()) {
      total += subs.length;
    }
    return total;
  }

  private addListener(
    event: string,
    callback: EventCallback<any>,
    once: boolean,
    priority: number
  ): UnsubscribeFn {
    const sub: EventSubscription = { callback, once, priority };
    const existing = this.listeners.get(event);
    if (existing) {
      existing.push(sub);
    } else {
      this.listeners.set(event, [sub]);
    }

    return () => {
      const subs = this.listeners.get(event);
      if (subs) {
        const idx = subs.indexOf(sub);
        if (idx !== -1) subs.splice(idx, 1);
        if (subs.length === 0) this.listeners.delete(event);
      }
    };
  }
}

/** Singleton event bus instance for the application */
export const eventBus = new EventBus();
export default EventBus;

/**
 * Input Finite State Machine
 * 
 * Replaces string-based 'idle' | 'scrolling' | 'annotating' with a proper FSM.
 * Handles: stylus+finger combos, multi-user touch (smartboard), keyboard+mouse,
 * and native input APIs without impossible states.
 */

import { eventBus } from './eventBus';

export type InputState =
  | 'idle'
  | 'drawing'       // Pen/highlighter/shape actively being drawn
  | 'erasing'       // Eraser actively deleting
  | 'scrolling'     // Finger/mouse scroll in progress
  | 'pinching'      // Two-finger zoom/pan
  | 'selecting'     // Lasso or tap-select in progress
  | 'dragging'      // Moving/resizing a selected annotation
  | 'textEditing'   // Inline text editor is open
  | 'longPress';    // Long-press detected, waiting for context menu

export type InputEvent =
  | 'POINTER_DOWN_PEN'
  | 'POINTER_DOWN_MOUSE'
  | 'POINTER_DOWN_TOUCH'
  | 'POINTER_MOVE'
  | 'POINTER_UP'
  | 'PINCH_START'
  | 'PINCH_END'
  | 'LONG_PRESS_DETECTED'
  | 'LONG_PRESS_CANCEL'
  | 'TEXT_EDIT_START'
  | 'TEXT_EDIT_END'
  | 'SELECT_START'
  | 'SELECT_END'
  | 'DRAG_START'
  | 'DRAG_END'
  | 'ESC'
  | 'TOOL_CHANGE';

export type ActiveTool = 'pen' | 'highlighter' | 'eraser' | 'select' | 'text' | 'shape' | 'pan' | 'none';

interface Transition {
  from: InputState | '*';
  event: InputEvent;
  to: InputState;
  guard?: (context: InputContext) => boolean;
  action?: (context: InputContext) => void;
}

export interface InputContext {
  activeTool: ActiveTool;
  pointerType: 'pen' | 'mouse' | 'touch' | 'unknown';
  pressure: number;
  touchCount: number;
  isStylus: boolean;
}

const TRANSITIONS: Transition[] = [
  // === From IDLE ===
  // Pen/stylus down → draw (if drawing tool) or erase (if eraser) or select
  { from: 'idle', event: 'POINTER_DOWN_PEN', to: 'drawing',
    guard: (ctx) => ['pen', 'highlighter', 'shape'].includes(ctx.activeTool) },
  { from: 'idle', event: 'POINTER_DOWN_PEN', to: 'erasing',
    guard: (ctx) => ctx.activeTool === 'eraser' },
  { from: 'idle', event: 'POINTER_DOWN_PEN', to: 'selecting',
    guard: (ctx) => ctx.activeTool === 'select' },
  { from: 'idle', event: 'POINTER_DOWN_PEN', to: 'idle',
    guard: (ctx) => ctx.activeTool === 'text' },
  
  // Mouse down → same as pen
  { from: 'idle', event: 'POINTER_DOWN_MOUSE', to: 'drawing',
    guard: (ctx) => ['pen', 'highlighter', 'shape'].includes(ctx.activeTool) },
  { from: 'idle', event: 'POINTER_DOWN_MOUSE', to: 'erasing',
    guard: (ctx) => ctx.activeTool === 'eraser' },
  { from: 'idle', event: 'POINTER_DOWN_MOUSE', to: 'selecting',
    guard: (ctx) => ctx.activeTool === 'select' },
  { from: 'idle', event: 'POINTER_DOWN_MOUSE', to: 'scrolling',
    guard: (ctx) => ctx.activeTool === 'pan' || ctx.activeTool === 'none' },

  // Touch always scrolls (finger = scroll, pencil = draw)
  { from: 'idle', event: 'POINTER_DOWN_TOUCH', to: 'scrolling' },

  // Pinch always zooms, from idle
  { from: 'idle', event: 'PINCH_START', to: 'pinching' },

  // Text editing
  { from: 'idle', event: 'TEXT_EDIT_START', to: 'textEditing' },

  // Drag selected annotation
  { from: 'idle', event: 'DRAG_START', to: 'dragging' },

  // Long press
  { from: 'idle', event: 'LONG_PRESS_DETECTED', to: 'longPress' },

  // === From DRAWING ===
  { from: 'drawing', event: 'POINTER_UP', to: 'idle' },
  { from: 'drawing', event: 'ESC', to: 'idle' },
  // If a second finger touches during drawing, cancel and scroll
  { from: 'drawing', event: 'PINCH_START', to: 'pinching' },

  // === From ERASING ===
  { from: 'erasing', event: 'POINTER_UP', to: 'idle' },
  { from: 'erasing', event: 'ESC', to: 'idle' },

  // === From SCROLLING ===
  { from: 'scrolling', event: 'POINTER_UP', to: 'idle' },
  { from: 'scrolling', event: 'PINCH_START', to: 'pinching' },

  // === From PINCHING ===
  { from: 'pinching', event: 'PINCH_END', to: 'idle' },
  { from: 'pinching', event: 'POINTER_UP', to: 'idle' },

  // === From SELECTING ===
  { from: 'selecting', event: 'POINTER_UP', to: 'idle' },
  { from: 'selecting', event: 'SELECT_END', to: 'idle' },
  { from: 'selecting', event: 'DRAG_START', to: 'dragging' },
  { from: 'selecting', event: 'ESC', to: 'idle' },

  // === From DRAGGING ===
  { from: 'dragging', event: 'POINTER_UP', to: 'idle' },
  { from: 'dragging', event: 'DRAG_END', to: 'idle' },
  { from: 'dragging', event: 'ESC', to: 'idle' },

  // === From TEXT EDITING ===
  { from: 'textEditing', event: 'TEXT_EDIT_END', to: 'idle' },
  { from: 'textEditing', event: 'ESC', to: 'idle' },

  // === From LONG PRESS ===
  { from: 'longPress', event: 'POINTER_UP', to: 'idle' },
  { from: 'longPress', event: 'LONG_PRESS_CANCEL', to: 'idle' },

  // === Universal: tool change resets to idle ===
  { from: '*', event: 'TOOL_CHANGE', to: 'idle' },
];

export class InputFSM {
  private state: InputState = 'idle';
  private context: InputContext = {
    activeTool: 'pen',
    pointerType: 'unknown',
    pressure: 0,
    touchCount: 0,
    isStylus: false,
  };
  private listeners: ((state: InputState, prevState: InputState) => void)[] = [];

  getState(): InputState {
    return this.state;
  }

  getContext(): Readonly<InputContext> {
    return { ...this.context };
  }

  /**
   * Update context without triggering a transition.
   */
  updateContext(updates: Partial<InputContext>): void {
    Object.assign(this.context, updates);
  }

  /**
   * Send an event to the FSM. Returns the new state.
   */
  send(event: InputEvent, contextUpdates?: Partial<InputContext>): InputState {
    if (contextUpdates) {
      Object.assign(this.context, contextUpdates);
    }

    const prevState = this.state;

    // Find matching transition (specific state first, then wildcard)
    const transition =
      TRANSITIONS.find(t => t.from === this.state && t.event === event && (!t.guard || t.guard(this.context))) ||
      TRANSITIONS.find(t => t.from === '*' && t.event === event && (!t.guard || t.guard(this.context)));

    if (!transition) {
      // No valid transition — stay in current state (this is not an error)
      return this.state;
    }

    this.state = transition.to;

    if (transition.action) {
      transition.action(this.context);
    }

    if (prevState !== this.state) {
      // Notify listeners
      for (const listener of this.listeners) {
        listener(this.state, prevState);
      }

      // Emit to event bus
      eventBus.emit('input:state-changed', {
        from: prevState,
        to: this.state,
        trigger: event,
      });
    }

    return this.state;
  }

  /**
   * Force state (escape hatch for edge cases).
   */
  forceState(state: InputState): void {
    const prev = this.state;
    this.state = state;
    if (prev !== state) {
      for (const listener of this.listeners) {
        listener(state, prev);
      }
    }
  }

  /**
   * Subscribe to state changes. Returns unsubscribe function.
   */
  onStateChange(listener: (state: InputState, prevState: InputState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  /**
   * Check if the FSM is in a state that allows drawing.
   */
  canDraw(): boolean {
    return this.state === 'idle' || this.state === 'drawing';
  }

  /**
   * Check if the FSM is in a state that allows scrolling.
   */
  canScroll(): boolean {
    return this.state === 'idle' || this.state === 'scrolling' || this.state === 'pinching';
  }

  /**
   * Map a PointerEvent to the appropriate FSM event.
   */
  static pointerEventToFSMEvent(
    type: 'down' | 'up' | 'move',
    pointerType: string
  ): InputEvent | null {
    if (type === 'up') return 'POINTER_UP';
    if (type === 'move') return 'POINTER_MOVE';
    if (type === 'down') {
      switch (pointerType) {
        case 'pen': return 'POINTER_DOWN_PEN';
        case 'mouse': return 'POINTER_DOWN_MOUSE';
        case 'touch': return 'POINTER_DOWN_TOUCH';
        default: return 'POINTER_DOWN_MOUSE';
      }
    }
    return null;
  }
}

export const inputFSM = new InputFSM();
export default InputFSM;

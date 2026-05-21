/**
 * Command-Pattern Undo/Redo System
 * 
 * Replaces full-state-copy undoStack with delta operations.
 * Each action is a Command with execute/undo. Memory-efficient (stores only changes).
 * Commands are serializable — enables collaborative OT/CRDT later.
 */

import { eventBus } from './eventBus';

// ---- Command Types ----

export interface UndoableCommand {
  /** Unique type identifier */
  type: string;
  /** Human-readable description (for debug/UI) */
  description: string;
  /** Timestamp of when command was executed */
  timestamp: number;
  /** Page this command affects (null = document-level) */
  pageNum: number | null;

  /** Apply the command (forward) */
  execute(): void;
  /** Reverse the command */
  undo(): void;
}

// ---- Concrete Commands ----

export class AddAnnotationCommand implements UndoableCommand {
  type = 'add-annotation';
  description: string;
  timestamp = Date.now();
  pageNum: number;

  constructor(
    pageNum: number,
    private annotation: { id: string },
    private addFn: (pageNum: number, annotation: unknown) => void,
    private removeFn: (pageNum: number, annotationId: string) => void
  ) {
    this.pageNum = pageNum;
    this.description = `Add ${(annotation as Record<string, unknown>).type ?? 'annotation'} on page ${pageNum}`;
  }

  execute(): void {
    this.addFn(this.pageNum, this.annotation);
  }

  undo(): void {
    this.removeFn(this.pageNum, this.annotation.id);
  }
}

export class RemoveAnnotationCommand implements UndoableCommand {
  type = 'remove-annotation';
  description: string;
  timestamp = Date.now();
  pageNum: number;

  constructor(
    pageNum: number,
    private annotation: { id: string },
    private addFn: (pageNum: number, annotation: unknown) => void,
    private removeFn: (pageNum: number, annotationId: string) => void
  ) {
    this.pageNum = pageNum;
    this.description = `Remove annotation on page ${pageNum}`;
  }

  execute(): void {
    this.removeFn(this.pageNum, this.annotation.id);
  }

  undo(): void {
    this.addFn(this.pageNum, this.annotation);
  }
}

export class UpdateAnnotationCommand implements UndoableCommand {
  type = 'update-annotation';
  description: string;
  timestamp = Date.now();
  pageNum: number;

  constructor(
    pageNum: number,
    private annotationId: string,
    private previousState: Record<string, unknown>,
    private newState: Record<string, unknown>,
    private updateFn: (pageNum: number, annotationId: string, state: Record<string, unknown>) => void
  ) {
    this.pageNum = pageNum;
    this.description = `Update annotation on page ${pageNum}`;
  }

  execute(): void {
    this.updateFn(this.pageNum, this.annotationId, this.newState);
  }

  undo(): void {
    this.updateFn(this.pageNum, this.annotationId, this.previousState);
  }
}

export class ClearPageCommand implements UndoableCommand {
  type = 'clear-page';
  description: string;
  timestamp = Date.now();
  pageNum: number;

  constructor(
    pageNum: number,
    private clearedAnnotations: { id: string }[],
    private setPageAnnotationsFn: (pageNum: number, annotations: unknown[]) => void
  ) {
    this.pageNum = pageNum;
    this.description = `Clear page ${pageNum} (${clearedAnnotations.length} annotations)`;
  }

  execute(): void {
    this.setPageAnnotationsFn(this.pageNum, []);
  }

  undo(): void {
    this.setPageAnnotationsFn(this.pageNum, this.clearedAnnotations);
  }
}

export class BatchCommand implements UndoableCommand {
  type = 'batch';
  description: string;
  timestamp = Date.now();
  pageNum: number | null;

  constructor(
    private commands: UndoableCommand[],
    description?: string
  ) {
    this.description = description ?? `Batch (${commands.length} operations)`;
    this.pageNum = commands[0]?.pageNum ?? null;
  }

  execute(): void {
    for (const cmd of this.commands) {
      cmd.execute();
    }
  }

  undo(): void {
    // Undo in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo();
    }
  }
}

// ---- Undo Manager ----

export interface UndoManagerOptions {
  maxHistorySize?: number;
}

export class UndoManager {
  private undoStack: UndoableCommand[] = [];
  private redoStack: UndoableCommand[] = [];
  private maxHistorySize: number;

  constructor(options?: UndoManagerOptions) {
    this.maxHistorySize = options?.maxHistorySize ?? 200;
  }

  /**
   * Execute a command and push it onto the undo stack.
   */
  execute(command: UndoableCommand): void {
    command.execute();
    this.undoStack.push(command);

    // Clear redo stack (new action branch)
    this.redoStack = [];

    // Enforce max history size
    if (this.undoStack.length > this.maxHistorySize) {
      this.undoStack.shift();
    }

    eventBus.emit('history:push', { command });
  }

  /**
   * Undo the last command.
   */
  undo(): UndoableCommand | null {
    const command = this.undoStack.pop();
    if (!command) return null;

    command.undo();
    this.redoStack.push(command);

    eventBus.emit('history:undo', { command });
    return command;
  }

  /**
   * Redo the last undone command.
   */
  redo(): UndoableCommand | null {
    const command = this.redoStack.pop();
    if (!command) return null;

    command.execute();
    this.undoStack.push(command);

    eventBus.emit('history:redo', { command });
    return command;
  }

  /**
   * Clear all history.
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    eventBus.emit('history:cleared', {});
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  getUndoCount(): number {
    return this.undoStack.length;
  }

  getRedoCount(): number {
    return this.redoStack.length;
  }

  /**
   * Get description of the next undo action (for tooltip).
   */
  peekUndo(): string | null {
    return this.undoStack.length > 0
      ? this.undoStack[this.undoStack.length - 1].description
      : null;
  }

  /**
   * Get description of the next redo action (for tooltip).
   */
  peekRedo(): string | null {
    return this.redoStack.length > 0
      ? this.redoStack[this.redoStack.length - 1].description
      : null;
  }

  dispose(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}

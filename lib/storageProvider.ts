/**
 * Abstract Storage Layer — IStorageProvider interface
 * 
 * All storage backends implement this interface.
 * Consumers code against the interface, not the implementation.
 * Implementations: LocalStorageProvider, IndexedDBProvider, CloudProvider, SQLiteProvider (native).
 */

import { eventBus } from './eventBus';
import { migrateDocument, needsMigration, CURRENT_SCHEMA_VERSION } from './schemaMigration';

// ---- Core Types ----

export interface AnnotationDocumentV2 {
  pdfId: string;
  version: string;

  // Auth-ready fields (A9)
  userId: string | null;
  workspaceId: string | null;
  sharedWith: string[];
  deviceId: string | null;

  pdfMetadata: {
    subject: string;
    series: string;
    paperType: string;
    paperNumber: string;
    totalPages: number;
  };

  annotations: AnnotationPageData[];

  syncMetadata: {
    lastSyncedAt: string | null;
    syncVersion: number;
    isDirty: boolean;
  };

  created: string;
  lastModified: string;
}

export interface AnnotationPageData {
  pageNumber: number;
  pageSize: { width: number; height: number };
  annotations: AnnotationData[];
}

export interface AnnotationData {
  id: string;
  type: string;
  coordinates: { x: number; y: number; pressure?: number }[];
  properties: Record<string, unknown>;
  timestamp: string;
  lastModified: string;
}

export interface StorageInfo {
  used: number;
  quota: number;
  available: number;
  percentage: number;
}

// ---- Interface ----

export interface IStorageProvider {
  readonly name: string;

  /** Initialize the storage backend (open DB, etc.) */
  initialize(): Promise<void>;

  /** Save a full annotation document */
  saveDocument(doc: AnnotationDocumentV2): Promise<void>;

  /** Load a document by PDF ID. Returns null if not found. */
  loadDocument(pdfId: string): Promise<AnnotationDocumentV2 | null>;

  /** Delete a document by PDF ID */
  deleteDocument(pdfId: string): Promise<void>;

  /** List all stored document IDs */
  listDocuments(): Promise<string[]>;

  /** Get storage usage info */
  getStorageInfo(): Promise<StorageInfo>;

  /** Cleanup old documents (optional, some backends don't need it) */
  cleanup?(maxAgeDays: number): Promise<number>;

  /** Export all data (for backup/migration) */
  exportAll?(): Promise<AnnotationDocumentV2[]>;

  /** Import data (from backup/migration) */
  importAll?(docs: AnnotationDocumentV2[]): Promise<void>;

  /** Dispose resources */
  dispose?(): void;
}

// ---- LocalStorage Implementation ----

const LS_PREFIX = 'anneruth_doc_';

export class LocalStorageProvider implements IStorageProvider {
  readonly name = 'localStorage';

  async initialize(): Promise<void> {
    // Nothing to initialize
  }

  async saveDocument(doc: AnnotationDocumentV2): Promise<void> {
    const key = LS_PREFIX + doc.pdfId;
    const serialized = JSON.stringify(doc);
    const size = new Blob([serialized]).size;

    const info = await this.getStorageInfo();
    if (info.available < size) {
      eventBus.emit('storage:quota-warning', { usedPercent: info.percentage });
      throw new Error('Insufficient localStorage space');
    }

    localStorage.setItem(key, serialized);
    eventBus.emit('storage:save-completed', { key: doc.pdfId });
  }

  async loadDocument(pdfId: string): Promise<AnnotationDocumentV2 | null> {
    const raw = localStorage.getItem(LS_PREFIX + pdfId);
    if (!raw) return null;

    let doc = JSON.parse(raw);

    // Auto-migrate if needed
    if (needsMigration(doc)) {
      const { document: migrated, migrationsApplied } = migrateDocument(doc);
      doc = migrated;
      // Save migrated version back
      localStorage.setItem(LS_PREFIX + pdfId, JSON.stringify(doc));
      if (migrationsApplied.length > 0) {
        eventBus.emit('document:schema-migrated', {
          pdfId,
          fromVersion: (JSON.parse(raw).version as string) || '1.0',
          toVersion: CURRENT_SCHEMA_VERSION,
        });
      }
    }

    return doc as AnnotationDocumentV2;
  }

  async deleteDocument(pdfId: string): Promise<void> {
    localStorage.removeItem(LS_PREFIX + pdfId);
  }

  async listDocuments(): Promise<string[]> {
    const ids: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(LS_PREFIX)) {
        ids.push(key.slice(LS_PREFIX.length));
      }
    }
    return ids;
  }

  async getStorageInfo(): Promise<StorageInfo> {
    let used = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        used += (localStorage.getItem(key)?.length ?? 0) * 2; // UTF-16
      }
    }
    const quota = 5 * 1024 * 1024; // ~5MB typical
    return {
      used,
      quota,
      available: Math.max(0, quota - used),
      percentage: Math.round((used / quota) * 100),
    };
  }

  async cleanup(maxAgeDays: number): Promise<number> {
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    let removed = 0;
    const ids = await this.listDocuments();
    for (const id of ids) {
      const doc = await this.loadDocument(id);
      if (doc && new Date(doc.lastModified).getTime() < cutoff) {
        await this.deleteDocument(id);
        removed++;
      }
    }
    return removed;
  }
}

// ---- IndexedDB Implementation ----

const IDB_NAME = 'AnneruthAnnotations';
const IDB_VERSION = 1;
const IDB_STORE = 'documents';

export class IndexedDBProvider implements IStorageProvider {
  readonly name = 'indexedDB';
  private db: IDBDatabase | null = null;

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(IDB_NAME, IDB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          const store = db.createObjectStore(IDB_STORE, { keyPath: 'pdfId' });
          store.createIndex('lastModified', 'lastModified', { unique: false });
          store.createIndex('userId', 'userId', { unique: false });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
      };
    });
  }

  async saveDocument(doc: AnnotationDocumentV2): Promise<void> {
    const db = this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const request = store.put(doc);
      request.onsuccess = () => {
        eventBus.emit('storage:save-completed', { key: doc.pdfId });
        resolve();
      };
      request.onerror = () => reject(new Error(`Failed to save: ${request.error?.message}`));
    });
  }

  async loadDocument(pdfId: string): Promise<AnnotationDocumentV2 | null> {
    const db = this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const request = store.get(pdfId);

      request.onsuccess = () => {
        let doc = request.result || null;
        if (doc && needsMigration(doc)) {
          const { document: migrated, migrationsApplied } = migrateDocument(doc);
          doc = migrated;
          // Save migrated version back (fire & forget)
          if (migrationsApplied.length > 0) {
            this.saveDocument(doc as AnnotationDocumentV2).catch(() => {});
            eventBus.emit('document:schema-migrated', {
              pdfId,
              fromVersion: (request.result?.version as string) || '1.0',
              toVersion: CURRENT_SCHEMA_VERSION,
            });
          }
        }
        resolve(doc as AnnotationDocumentV2 | null);
      };
      request.onerror = () => reject(new Error(`Failed to load: ${request.error?.message}`));
    });
  }

  async deleteDocument(pdfId: string): Promise<void> {
    const db = this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const request = store.delete(pdfId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to delete: ${request.error?.message}`));
    });
  }

  async listDocuments(): Promise<string[]> {
    const db = this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const request = store.getAllKeys();
      request.onsuccess = () => resolve(request.result as string[]);
      request.onerror = () => reject(new Error(`Failed to list: ${request.error?.message}`));
    });
  }

  async getStorageInfo(): Promise<StorageInfo> {
    if (navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate();
      return {
        used: estimate.usage ?? 0,
        quota: estimate.quota ?? 0,
        available: (estimate.quota ?? 0) - (estimate.usage ?? 0),
        percentage: estimate.quota ? Math.round(((estimate.usage ?? 0) / estimate.quota) * 100) : 0,
      };
    }
    return { used: 0, quota: 0, available: 0, percentage: 0 };
  }

  async cleanup(maxAgeDays: number): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString();
    const db = this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const index = store.index('lastModified');
      const range = IDBKeyRange.upperBound(cutoff);
      const request = index.openCursor(range);
      let removed = 0;

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          removed++;
          cursor.continue();
        } else {
          resolve(removed);
        }
      };
      request.onerror = () => reject(new Error(`Cleanup failed: ${request.error?.message}`));
    });
  }

  dispose(): void {
    this.db?.close();
    this.db = null;
  }

  private getDB(): IDBDatabase {
    if (!this.db) throw new Error('IndexedDB not initialized. Call initialize() first.');
    return this.db;
  }
}

// ---- Factory ----

export type StorageBackend = 'localStorage' | 'indexedDB';

export function createStorageProvider(backend: StorageBackend): IStorageProvider {
  switch (backend) {
    case 'indexedDB':
      return new IndexedDBProvider();
    case 'localStorage':
      return new LocalStorageProvider();
    default:
      return new LocalStorageProvider();
  }
}

/**
 * Create a new AnnotationDocumentV2 with current schema version.
 */
export function createAnnotationDocumentV2(
  pdfId: string,
  totalPages: number,
  pdfMetadata: { subject: string; series: string; paperType: string; paperNumber: string }
): AnnotationDocumentV2 {
  const now = new Date().toISOString();
  return {
    pdfId,
    version: CURRENT_SCHEMA_VERSION,
    userId: null,
    workspaceId: null,
    sharedWith: [],
    deviceId: null,
    pdfMetadata: { ...pdfMetadata, totalPages },
    annotations: Array.from({ length: totalPages }, (_, i) => ({
      pageNumber: i + 1,
      pageSize: { width: 595, height: 842 },
      annotations: [],
    })),
    syncMetadata: {
      lastSyncedAt: null,
      syncVersion: 0,
      isDirty: true,
    },
    created: now,
    lastModified: now,
  };
}

import { Annotation } from '../types/annotations';

/**
 * Advanced storage system with cloud sync capabilities
 * Phase 6: Advanced storage features with conflict resolution
 */

export interface StorageProvider {
  name: string;
  save: (key: string, data: any) => Promise<void>;
  load: (key: string) => Promise<any>;
  delete: (key: string) => Promise<void>;
  list: (prefix?: string) => Promise<string[]>;
  sync?: () => Promise<void>;
}

export interface AnnotationSession {
  id: string;
  paperFilename: string;
  annotations: Annotation[];
  metadata: {
    created: Date;
    modified: Date;
    version: number;
    deviceId?: string;
    userId?: string;
  };
  checksum: string;
}

export interface SyncConflict {
  sessionId: string;
  local: AnnotationSession;
  remote: AnnotationSession;
  type: 'version' | 'concurrent' | 'deleted';
}

export interface StorageConfig {
  providers: StorageProvider[];
  primaryProvider: string;
  syncInterval?: number;
  conflictResolution: 'manual' | 'latest' | 'merge';
  maxVersionHistory: number;
  compressionEnabled: boolean;
}

// Local Storage Provider
export class LocalStorageProvider implements StorageProvider {
  name = 'localStorage';

  async save(key: string, data: any): Promise<void> {
    try {
      const serialized = JSON.stringify(data);
      localStorage.setItem(key, serialized);
    } catch (error) {
      console.error('LocalStorage save failed:', error);
      throw new Error('Storage quota exceeded');
    }
  }

  async load(key: string): Promise<any> {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error('LocalStorage load failed:', error);
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    localStorage.removeItem(key);
  }

  async list(prefix?: string): Promise<string[]> {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (!prefix || key.startsWith(prefix))) {
        keys.push(key);
      }
    }
    return keys;
  }
}

// IndexedDB Provider
export class IndexedDBProvider implements StorageProvider {
  name = 'indexedDB';
  private dbName = 'PdfAnnotations';
  private version = 1;
  private db: IDBDatabase | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };
      
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('annotations')) {
          const store = db.createObjectStore('annotations', { keyPath: 'id' });
          store.createIndex('paperFilename', 'paperFilename', { unique: false });
          store.createIndex('modified', 'modified', { unique: false });
        }
      };
    });
  }

  async save(key: string, data: any): Promise<void> {
    const db = await this.getDB();
    const transaction = db.transaction(['annotations'], 'readwrite');
    const store = transaction.objectStore('annotations');
    
    return new Promise((resolve, reject) => {
      const request = store.put({ id: key, data, modified: new Date() });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async load(key: string): Promise<any> {
    const db = await this.getDB();
    const transaction = db.transaction(['annotations'], 'readonly');
    const store = transaction.objectStore('annotations');
    
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result?.data || null);
    });
  }

  async delete(key: string): Promise<void> {
    const db = await this.getDB();
    const transaction = db.transaction(['annotations'], 'readwrite');
    const store = transaction.objectStore('annotations');
    
    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async list(prefix?: string): Promise<string[]> {
    const db = await this.getDB();
    const transaction = db.transaction(['annotations'], 'readonly');
    const store = transaction.objectStore('annotations');
    
    return new Promise((resolve, reject) => {
      const request = store.getAllKeys();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const keys = request.result.map(k => k.toString());
        resolve(prefix ? keys.filter(k => k.startsWith(prefix)) : keys);
      };
    });
  }
}

// Cloud Storage Provider (Generic implementation)
export class CloudStorageProvider implements StorageProvider {
  name = 'cloud';
  private apiEndpoint: string;
  private authToken: string;

  constructor(apiEndpoint: string, authToken: string) {
    this.apiEndpoint = apiEndpoint;
    this.authToken = authToken;
  }

  private async request(method: string, path: string, data?: any): Promise<any> {
    const response = await fetch(`${this.apiEndpoint}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Cloud storage ${method} failed: ${response.statusText}`);
    }

    return response.json();
  }

  async save(key: string, data: any): Promise<void> {
    await this.request('PUT', `/annotations/${key}`, data);
  }

  async load(key: string): Promise<any> {
    try {
      return await this.request('GET', `/annotations/${key}`);
    } catch (error) {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    await this.request('DELETE', `/annotations/${key}`);
  }

  async list(prefix?: string): Promise<string[]> {
    const params = prefix ? `?prefix=${encodeURIComponent(prefix)}` : '';
    const result = await this.request('GET', `/annotations${params}`);
    return result.keys || [];
  }

  async sync(): Promise<void> {
    // Implement sync logic
    console.log('Cloud sync initiated');
  }
}

// Main Storage Manager
export class AdvancedStorageManager {
  private providers: Map<string, StorageProvider> = new Map();
  private config: StorageConfig;
  private sessionCache: Map<string, AnnotationSession> = new Map();
  private syncInProgress = false;

  constructor(config: StorageConfig) {
    this.config = config;
    
    // Initialize providers
    config.providers.forEach(provider => {
      this.providers.set(provider.name, provider);
    });

    // Start sync timer if configured
    if (config.syncInterval) {
      setInterval(() => this.syncAll(), config.syncInterval);
    }
  }

  private getPrimaryProvider(): StorageProvider {
    const provider = this.providers.get(this.config.primaryProvider);
    if (!provider) {
      throw new Error(`Primary provider ${this.config.primaryProvider} not found`);
    }
    return provider;
  }

  private generateChecksum(data: any): string {
    // Simple checksum - in production use crypto.subtle or similar
    return btoa(JSON.stringify(data)).slice(-16);
  }

  private generateSessionId(paperFilename: string): string {
    return `session_${paperFilename}_${Date.now()}`;
  }

  // Save annotation session
  async saveSession(paperFilename: string, annotations: Annotation[], userId?: string): Promise<string> {
    const sessionId = this.generateSessionId(paperFilename);
    
    const session: AnnotationSession = {
      id: sessionId,
      paperFilename,
      annotations,
      metadata: {
        created: new Date(),
        modified: new Date(),
        version: 1,
        deviceId: this.getDeviceId(),
        userId
      },
      checksum: this.generateChecksum({ annotations })
    };

    // Save to primary provider
    const provider = this.getPrimaryProvider();
    await provider.save(`session_${sessionId}`, session);
    
    // Cache locally
    this.sessionCache.set(sessionId, session);

    // Background sync to other providers
    this.backgroundSync(sessionId, session);

    return sessionId;
  }

  // Load annotation session
  async loadSession(sessionId: string): Promise<AnnotationSession | null> {
    // Check cache first
    if (this.sessionCache.has(sessionId)) {
      return this.sessionCache.get(sessionId)!;
    }

    // Load from primary provider
    const provider = this.getPrimaryProvider();
    const session = await provider.load(`session_${sessionId}`);
    
    if (session) {
      this.sessionCache.set(sessionId, session);
    }

    return session;
  }

  // Load all sessions for a paper
  async loadSessionsForPaper(paperFilename: string): Promise<AnnotationSession[]> {
    const provider = this.getPrimaryProvider();
    const keys = await provider.list('session_');
    
    const sessions: AnnotationSession[] = [];
    
    for (const key of keys) {
      const session = await provider.load(key);
      if (session && session.paperFilename === paperFilename) {
        sessions.push(session);
      }
    }

    return sessions.sort((a, b) => 
      new Date(b.metadata.modified).getTime() - new Date(a.metadata.modified).getTime()
    );
  }

  // Update existing session
  async updateSession(sessionId: string, annotations: Annotation[]): Promise<void> {
    const existingSession = await this.loadSession(sessionId);
    if (!existingSession) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const updatedSession: AnnotationSession = {
      ...existingSession,
      annotations,
      metadata: {
        ...existingSession.metadata,
        modified: new Date(),
        version: existingSession.metadata.version + 1
      },
      checksum: this.generateChecksum({ annotations })
    };

    const provider = this.getPrimaryProvider();
    await provider.save(`session_${sessionId}`, updatedSession);
    
    this.sessionCache.set(sessionId, updatedSession);
    this.backgroundSync(sessionId, updatedSession);
  }

  // Export annotations to different formats
  async exportAnnotations(sessionId: string, format: 'json' | 'csv' | 'pdf'): Promise<Blob> {
    const session = await this.loadSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    switch (format) {
      case 'json':
        return new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
      
      case 'csv':
        const csvContent = this.convertToCSV(session.annotations);
        return new Blob([csvContent], { type: 'text/csv' });
      
      case 'pdf':
        // This would integrate with the PDFAnnotationExporter
        throw new Error('PDF export not implemented in storage manager');
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  // Import annotations from backup
  async importAnnotations(data: string | ArrayBuffer, format: 'json'): Promise<string> {
    let sessionData: AnnotationSession;

    try {
      if (format === 'json') {
        const jsonData = typeof data === 'string' ? data : new TextDecoder().decode(data);
        sessionData = JSON.parse(jsonData);
      } else {
        throw new Error(`Unsupported import format: ${format}`);
      }

      // Generate new session ID
      const newSessionId = this.generateSessionId(sessionData.paperFilename);
      sessionData.id = newSessionId;
      sessionData.metadata.created = new Date();
      sessionData.metadata.modified = new Date();

      const provider = this.getPrimaryProvider();
      await provider.save(`session_${newSessionId}`, sessionData);
      
      this.sessionCache.set(newSessionId, sessionData);

      return newSessionId;
    } catch (error) {
      throw new Error(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Sync all providers
  async syncAll(): Promise<SyncConflict[]> {
    if (this.syncInProgress) return [];
    
    this.syncInProgress = true;
    const conflicts: SyncConflict[] = [];

    try {
      const primaryProvider = this.getPrimaryProvider();
      const primaryKeys = await primaryProvider.list('session_');

      for (const [name, provider] of this.providers) {
        if (name === this.config.primaryProvider || !provider.sync) continue;

        try {
          await provider.sync();
          
          // Compare sessions and detect conflicts
          const remoteKeys = await provider.list('session_');
          const sessionConflicts = await this.detectConflicts(primaryProvider, provider, primaryKeys, remoteKeys);
          conflicts.push(...sessionConflicts);
          
        } catch (error) {
          console.error(`Sync failed for provider ${name}:`, error);
        }
      }

      // Handle conflicts based on configuration
      await this.resolveConflicts(conflicts);

    } finally {
      this.syncInProgress = false;
    }

    return conflicts;
  }

  private async backgroundSync(sessionId: string, session: AnnotationSession): Promise<void> {
    // Sync to other providers in background
    for (const [name, provider] of this.providers) {
      if (name !== this.config.primaryProvider) {
        try {
          await provider.save(`session_${sessionId}`, session);
        } catch (error) {
          console.warn(`Background sync failed for provider ${name}:`, error);
        }
      }
    }
  }

  private async detectConflicts(
    primaryProvider: StorageProvider,
    remoteProvider: StorageProvider,
    primaryKeys: string[],
    remoteKeys: string[]
  ): Promise<SyncConflict[]> {
    const conflicts: SyncConflict[] = [];
    const allKeys = new Set([...primaryKeys, ...remoteKeys]);

    for (const key of allKeys) {
      const localSession = await primaryProvider.load(key);
      const remoteSession = await remoteProvider.load(key);

      if (localSession && remoteSession) {
        if (localSession.checksum !== remoteSession.checksum) {
          conflicts.push({
            sessionId: key,
            local: localSession,
            remote: remoteSession,
            type: localSession.metadata.version !== remoteSession.metadata.version ? 'version' : 'concurrent'
          });
        }
      } else if (!localSession && remoteSession) {
        // Remote has data, local doesn't
        await primaryProvider.save(key, remoteSession);
      } else if (localSession && !remoteSession) {
        // Local has data, remote doesn't
        await remoteProvider.save(key, localSession);
      }
    }

    return conflicts;
  }

  private async resolveConflicts(conflicts: SyncConflict[]): Promise<void> {
    for (const conflict of conflicts) {
      switch (this.config.conflictResolution) {
        case 'latest':
          const latest = new Date(conflict.local.metadata.modified) > new Date(conflict.remote.metadata.modified) 
            ? conflict.local : conflict.remote;
          await this.forceSaveToAll(conflict.sessionId, latest);
          break;

        case 'merge':
          const merged = this.mergeAnnotations(conflict.local, conflict.remote);
          await this.forceSaveToAll(conflict.sessionId, merged);
          break;

        case 'manual':
          // Emit event for manual resolution
          console.warn('Manual conflict resolution required for:', conflict.sessionId);
          break;
      }
    }
  }

  private mergeAnnotations(local: AnnotationSession, remote: AnnotationSession): AnnotationSession {
    // Simple merge strategy - combine annotations and use latest metadata
    const mergedAnnotations = [...local.annotations];
    
    // Add remote annotations that don't exist locally (by ID)
    const localIds = new Set(local.annotations.map(a => a.id));
    remote.annotations.forEach(annotation => {
      if (!localIds.has(annotation.id)) {
        mergedAnnotations.push(annotation);
      }
    });

    return {
      ...local,
      annotations: mergedAnnotations,
      metadata: {
        ...local.metadata,
        modified: new Date(),
        version: Math.max(local.metadata.version, remote.metadata.version) + 1
      },
      checksum: this.generateChecksum({ annotations: mergedAnnotations })
    };
  }

  private async forceSaveToAll(sessionId: string, session: AnnotationSession): Promise<void> {
    for (const provider of this.providers.values()) {
      try {
        await provider.save(sessionId, session);
      } catch (error) {
        console.error(`Failed to save to provider ${provider.name}:`, error);
      }
    }
    
    this.sessionCache.set(sessionId, session);
  }

  private convertToCSV(annotations: Annotation[]): string {
    const headers = ['ID', 'Type', 'Coordinates', 'Color', 'Text', 'Created', 'LastModified'];
    const rows = annotations.map(annotation => [
      annotation.id,
      annotation.type,
      annotation.coordinates.map(coord => `${coord.x},${coord.y}`).join(';'),
      annotation.properties.color || '',
      annotation.properties.text || '',
      annotation.timestamp,
      annotation.lastModified
    ]);

    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
  }

  private getDeviceId(): string {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = 'device_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  }

  // Cleanup old versions
  async cleanupOldVersions(): Promise<void> {
    const provider = this.getPrimaryProvider();
    const keys = await provider.list('session_');
    
    // Group sessions by paper
    const sessionsByPaper: Map<string, AnnotationSession[]> = new Map();
    
    for (const key of keys) {
      const session = await provider.load(key);
      if (session) {
        const paperSessions = sessionsByPaper.get(session.paperFilename) || [];
        paperSessions.push(session);
        sessionsByPaper.set(session.paperFilename, paperSessions);
      }
    }

    // Keep only the latest versions within the limit
    for (const [paper, sessions] of sessionsByPaper) {
      const sorted = sessions.sort((a, b) => 
        new Date(b.metadata.modified).getTime() - new Date(a.metadata.modified).getTime()
      );

      if (sorted.length > this.config.maxVersionHistory) {
        const toDelete = sorted.slice(this.config.maxVersionHistory);
        for (const session of toDelete) {
          await provider.delete(`session_${session.id}`);
          this.sessionCache.delete(session.id);
        }
      }
    }
  }
}

// Factory function for creating storage manager
export function createStorageManager(config?: Partial<StorageConfig>): AdvancedStorageManager {
  const defaultConfig: StorageConfig = {
    providers: [
      new LocalStorageProvider(),
      new IndexedDBProvider()
    ],
    primaryProvider: 'indexedDB',
    syncInterval: 5 * 60 * 1000, // 5 minutes
    conflictResolution: 'latest',
    maxVersionHistory: 10,
    compressionEnabled: false
  };

  const finalConfig = { ...defaultConfig, ...config };
  return new AdvancedStorageManager(finalConfig);
}
import { 
  AnnotationDocument, 
  AnnotationPage, 
  Annotation, 
  AnnotationSettings,
  DEFAULT_SETTINGS,
  STORAGE_KEYS,
  StorageInfo
} from '../types/annotations';

/**
 * LocalStorage-based annotation persistence
 * Handles saving, loading, and managing annotation documents
 */
export class AnnotationStorage {
  private static instance: AnnotationStorage;

  public static getInstance(): AnnotationStorage {
    if (!AnnotationStorage.instance) {
      AnnotationStorage.instance = new AnnotationStorage();
    }
    return AnnotationStorage.instance;
  }

  /**
   * Save annotation document to localStorage
   */
  async saveAnnotationDocument(document: AnnotationDocument): Promise<void> {
    try {
      const key = `${STORAGE_KEYS.ANNOTATIONS}${document.pdfId}`;
      const serialized = JSON.stringify(document);
      
      // Check storage quota before saving
      const storageInfo = this.getStorageInfo();
      const estimatedSize = new Blob([serialized]).size;
      
      if (storageInfo.available < estimatedSize) {
        throw new Error('Insufficient storage space');
      }
      
      localStorage.setItem(key, serialized);
      console.log(`Saved annotations for ${document.pdfId}`);
    } catch (error) {
      console.error('Failed to save annotation document:', error);
      throw error;
    }
  }

  /**
   * Load annotation document from localStorage
   */
  async loadAnnotationDocument(pdfId: string): Promise<AnnotationDocument | null> {
    try {
      const key = `${STORAGE_KEYS.ANNOTATIONS}${pdfId}`;
      const serialized = localStorage.getItem(key);
      
      if (!serialized) {
        return null;
      }
      
      const document = JSON.parse(serialized) as AnnotationDocument;
      
      // Validate document structure
      if (!this.validateAnnotationDocument(document)) {
        console.warn(`Invalid annotation document format for ${pdfId}`);
        return null;
      }
      
      return document;
    } catch (error) {
      console.error('Failed to load annotation document:', error);
      return null;
    }
  }

  /**
   * Create a new annotation document
   */
  createAnnotationDocument(
    pdfId: string,
    totalPages: number,
    pdfMetadata: {
      subject: string;
      series: string;
      paperType: string;
      paperNumber: string;
    }
  ): AnnotationDocument {
    const now = new Date().toISOString();
    
    return {
      pdfId,
      pdfMetadata: {
        ...pdfMetadata,
        totalPages
      },
      annotations: Array.from({ length: totalPages }, (_, index) => ({
        pageNumber: index + 1,
        pageSize: { width: 595, height: 842 }, // A4 default
        annotations: []
      })),
      created: now,
      lastModified: now,
      version: '1.0'
    };
  }

  /**
   * Add annotation to specific page
   */
  async addAnnotation(pdfId: string, pageNumber: number, annotation: Annotation): Promise<void> {
    const document = await this.loadAnnotationDocument(pdfId);
    if (!document) {
      throw new Error(`No annotation document found for ${pdfId}`);
    }

    const pageIndex = pageNumber - 1;
    if (pageIndex < 0 || pageIndex >= document.annotations.length) {
      throw new Error(`Invalid page number: ${pageNumber}`);
    }

    document.annotations[pageIndex].annotations.push(annotation);
    document.lastModified = new Date().toISOString();
    
    await this.saveAnnotationDocument(document);
  }

  /**
   * Update existing annotation
   */
  async updateAnnotation(
    pdfId: string, 
    pageNumber: number, 
    annotationId: string, 
    updatedAnnotation: Partial<Annotation>
  ): Promise<void> {
    const document = await this.loadAnnotationDocument(pdfId);
    if (!document) {
      throw new Error(`No annotation document found for ${pdfId}`);
    }

    const pageIndex = pageNumber - 1;
    const page = document.annotations[pageIndex];
    const annotationIndex = page.annotations.findIndex(a => a.id === annotationId);
    
    if (annotationIndex === -1) {
      throw new Error(`Annotation ${annotationId} not found on page ${pageNumber}`);
    }

    // Update annotation
    page.annotations[annotationIndex] = {
      ...page.annotations[annotationIndex],
      ...updatedAnnotation,
      lastModified: new Date().toISOString()
    };
    
    document.lastModified = new Date().toISOString();
    await this.saveAnnotationDocument(document);
  }

  /**
   * Remove annotation from page
   */
  async removeAnnotation(pdfId: string, pageNumber: number, annotationId: string): Promise<void> {
    const document = await this.loadAnnotationDocument(pdfId);
    if (!document) {
      throw new Error(`No annotation document found for ${pdfId}`);
    }

    const pageIndex = pageNumber - 1;
    const page = document.annotations[pageIndex];
    const annotationIndex = page.annotations.findIndex(a => a.id === annotationId);
    
    if (annotationIndex === -1) {
      // Annotation already deleted - this is not an error, just log it
      console.warn(`Annotation ${annotationId} not found on page ${pageNumber} - already deleted`);
      return;
    }

    page.annotations.splice(annotationIndex, 1);
    document.lastModified = new Date().toISOString();
    
    await this.saveAnnotationDocument(document);
  }

  /**
   * Get all annotations for a specific page
   */
  async getPageAnnotations(pdfId: string, pageNumber: number): Promise<Annotation[]> {
    const document = await this.loadAnnotationDocument(pdfId);
    if (!document) {
      return [];
    }

    const pageIndex = pageNumber - 1;
    if (pageIndex < 0 || pageIndex >= document.annotations.length) {
      return [];
    }

    return document.annotations[pageIndex].annotations;
  }

  /**
   * List all saved annotation documents
   */
  listAnnotationDocuments(): string[] {
    const keys: string[] = [];
    const prefix = STORAGE_KEYS.ANNOTATIONS;
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keys.push(key.substring(prefix.length));
      }
    }
    
    return keys;
  }

  /**
   * Delete annotation document
   */
  async deleteAnnotationDocument(pdfId: string): Promise<void> {
    const key = `${STORAGE_KEYS.ANNOTATIONS}${pdfId}`;
    localStorage.removeItem(key);
    console.log(`Deleted annotations for ${pdfId}`);
  }

  /**
   * Export annotation document as JSON
   */
  async exportToJson(pdfId: string): Promise<string> {
    const document = await this.loadAnnotationDocument(pdfId);
    if (!document) {
      throw new Error(`No annotation document found for ${pdfId}`);
    }
    
    return JSON.stringify(document, null, 2);
  }

  /**
   * Import annotation document from JSON
   */
  async importFromJson(jsonString: string): Promise<void> {
    try {
      const document = JSON.parse(jsonString) as AnnotationDocument;
      
      if (!this.validateAnnotationDocument(document)) {
        throw new Error('Invalid annotation document format');
      }
      
      await this.saveAnnotationDocument(document);
    } catch (error) {
      console.error('Failed to import annotation document:', error);
      throw error;
    }
  }

  /**
   * Get storage usage information
   */
  getStorageInfo(): StorageInfo {
    let used = 0;
    
    // Calculate used space
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        if (value) {
          used += new Blob([key + value]).size;
        }
      }
    }
    
    // Estimate quota (5MB is typical for localStorage)
    const quota = 5 * 1024 * 1024;
    const available = quota - used;
    const percentage = (used / quota) * 100;
    
    return {
      used,
      quota,
      available,
      percentage
    };
  }

  /**
   * Clean up old annotation documents
   */
  async cleanup(daysOld: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const documentIds = this.listAnnotationDocuments();
    let deletedCount = 0;
    
    for (const pdfId of documentIds) {
      const document = await this.loadAnnotationDocument(pdfId);
      if (document && new Date(document.lastModified) < cutoffDate) {
        await this.deleteAnnotationDocument(pdfId);
        deletedCount++;
      }
    }
    
    console.log(`Cleaned up ${deletedCount} old annotation documents`);
    return deletedCount;
  }

  /**
   * Save user settings
   */
  saveSettings(settings: AnnotationSettings): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  /**
   * Load user settings
   */
  loadSettings(): AnnotationSettings {
    try {
      const serialized = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (serialized) {
        const settings = JSON.parse(serialized) as AnnotationSettings;
        return { ...DEFAULT_SETTINGS, ...settings };
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
    
    return DEFAULT_SETTINGS;
  }

  /**
   * Validate annotation document structure
   */
  private validateAnnotationDocument(document: any): document is AnnotationDocument {
    return (
      document &&
      typeof document.pdfId === 'string' &&
      typeof document.version === 'string' &&
      Array.isArray(document.annotations) &&
      document.pdfMetadata &&
      typeof document.created === 'string' &&
      typeof document.lastModified === 'string'
    );
  }
}

// Export singleton instance
export const annotationStorage = AnnotationStorage.getInstance();
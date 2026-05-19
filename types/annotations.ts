// Annotation system type definitions

export interface Point {
  x: number;
  y: number;
  pressure?: number; // For pen input
}

export type AnnotationType = 
  | 'pen' 
  | 'highlighter' 
  | 'rectangle' 
  | 'circle' 
  | 'arrow' 
  | 'line'
  | 'text'
  | 'reference-marker';

export type AnnotationTool = AnnotationType | 'pan' | 'select' | 'eraser';

export interface AnnotationProperties {
  // Common properties
  color: string;
  opacity: number;
  
  // Stroke properties
  strokeWidth?: number;
  strokeStyle?: 'solid' | 'dashed';
  
  // Text properties
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  textAlign?: 'left' | 'center' | 'right';
  lineHeight?: number;
  letterSpacing?: number;
  
  // Shape properties
  fillColor?: string;
  borderRadius?: number;
  
  // Pen-specific properties
  pressure?: number[];
  strokePoints?: Point[];
  
  // Reference properties
  referenceId?: string;
  referenceType?: 'marking-scheme' | 'formula-sheet';
  
  // Selection and editing states
  isSelected?: boolean;
  isEditing?: boolean;
  isDragging?: boolean;
}

export interface Annotation {
  id: string;              // UUID
  type: AnnotationType;
  coordinates: Point[];    // PDF coordinate system
  properties: AnnotationProperties;
  timestamp: string;       // Creation time
  lastModified: string;    // Last edit time
}

export interface AnnotationPage {
  pageNumber: number;
  pageSize: { width: number; height: number };
  annotations: Annotation[];
}

export interface AnnotationDocument {
  pdfId: string;           // Cambridge format: "9706_s23_qp_32"
  pdfMetadata: {
    subject: string;       // "9706"
    series: string;        // "s23"
    paperType: string;     // "qp"
    paperNumber: string;   // "32"
    totalPages: number;
  };
  annotations: AnnotationPage[];
  created: string;         // ISO timestamp
  lastModified: string;    // ISO timestamp
  version: string;         // Schema version
}

export interface PageInfo {
  pdfWidth: number;        // Original PDF page width
  pdfHeight: number;       // Original PDF page height
  canvasWidth: number;     // Rendered canvas width
  canvasHeight: number;    // Rendered canvas height
  scale: number;           // Current zoom level
  offsetX: number;         // Pan offset X
  offsetY: number;         // Pan offset Y
}

export interface Transform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
}

export interface CoordinateSystem {
  pdfToCanvas(pdfPoint: Point, pageInfo: PageInfo): Point;
  canvasToPdf(canvasPoint: Point, pageInfo: PageInfo): Point;
  transformPoint(point: Point, transform: Transform): Point;
}

export interface StorageInfo {
  used: number;
  quota: number;
  available: number;
  percentage: number;
}

export interface ReferenceAnnotation extends Annotation {
  referenceLink: {
    targetDocument: string;    // Related file
    targetPage: number;        // Page in reference
    linkType: 'marking-scheme' | 'formula' | 'insert';
  };
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Tool configuration for different paper types
export const PAPER_TYPE_CONFIG = {
  'qp': { // Question Papers
    recommendedTools: ['pen', 'highlighter', 'text'] as AnnotationType[],
    referencePanel: true,
    exportFormats: ['pdf', 'json']
  },
  'ms': { // Marking Schemes
    recommendedTools: ['highlighter', 'text'] as AnnotationType[],
    referencePanel: false,
    readOnly: true
  },
  'in': { // Insert Sheets
    recommendedTools: ['highlighter'] as AnnotationType[],
    referencePanel: false,
    readOnly: true
  }
} as const;

// Default annotation properties
export const DEFAULT_ANNOTATION_PROPERTIES: Record<AnnotationType, AnnotationProperties> = {
  pen: {
    color: '#000000',
    opacity: 1,
    strokeWidth: 2,
    strokeStyle: 'solid'
  },
  highlighter: {
    color: '#FFFF00',
    opacity: 0.3,
    strokeWidth: 10
  },
  rectangle: {
    color: '#FF0000',
    opacity: 1,
    strokeWidth: 2,
    strokeStyle: 'solid',
    fillColor: 'transparent'
  },
  circle: {
    color: '#FF0000',
    opacity: 1,
    strokeWidth: 2,
    strokeStyle: 'solid',
    fillColor: 'transparent'
  },
  arrow: {
    color: '#FF0000',
    opacity: 1,
    strokeWidth: 2,
    strokeStyle: 'solid'
  },
  line: {
    color: '#000000',
    opacity: 1,
    strokeWidth: 2,
    strokeStyle: 'solid'
  },
  text: {
    color: '#000000',
    opacity: 1,
    fontSize: 14,
    fontFamily: 'Arial',
    fontWeight: 'normal',
    fontStyle: 'normal',
    textAlign: 'left',
    lineHeight: 1.2,
    text: ''
  },
  'reference-marker': {
    color: '#0066FF',
    opacity: 0.7,
    strokeWidth: 3
  }
};

// Storage configuration
export const STORAGE_KEYS = {
  ANNOTATIONS: 'cambridge_annotations_',
  SETTINGS: 'annotation_settings',
  EXPORT_HISTORY: 'export_history'
} as const;

export interface AnnotationSettings {
  defaultPenColor: string;
  defaultPenSize: number;
  defaultHighlighterOpacity: number;
  autoSave: boolean;
  autoSaveInterval: number; // milliseconds
}

export const DEFAULT_SETTINGS: AnnotationSettings = {
  defaultPenColor: '#000000',
  defaultPenSize: 2,
  defaultHighlighterOpacity: 0.3,
  autoSave: true,
  autoSaveInterval: 30000 // 30 seconds
};

// Selection and editing interfaces
export interface AnnotationSelection {
  annotationId: string;
  bounds: Bounds;
  handles: SelectionHandle[];
}

export interface SelectionHandle {
  id: string;
  type: 'corner' | 'edge' | 'rotate' | 'delete';
  position: Point;
  cursor: string;
}

export interface EditingState {
  selectedAnnotation: Annotation | null;
  editMode: 'none' | 'move' | 'resize' | 'rotate' | 'text-edit';
  dragStart: Point | null;
  originalBounds: Bounds | null;
  tempProperties: Partial<AnnotationProperties>;
}

export interface TextEditingState {
  isTextEditing: boolean;
  editingAnnotationId?: string;
  editorPosition?: Point;
  initialText?: string;
}

export interface AnnotationEvent {
  type: 'select' | 'deselect' | 'move' | 'resize' | 'delete' | 'property-change';
  annotation: Annotation;
  previousState?: Annotation;
  newProperties?: Partial<AnnotationProperties>;
}
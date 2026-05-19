import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, ChevronLeft, X } from 'lucide-react';

/**
 * Cambridge Reference Panel - Responsive sidebar for viewing related exam documents
 * Features: 3-tab system (MS/IN/QP), auto-detection of related files, built-in PDF viewer with zoom
 * Responsive: 500px on desktop, proportionate on tablet, full width on mobile
 * Architecture: Modular components with separated concerns
 */

// ============================================
// TYPE DEFINITIONS
// ============================================

interface CambridgeFile {
  id: string;
  filename: string;
  type: 'qp' | 'ms' | 'in' | 'sf';
  typeName: string;
  subject: string;
  series: string;
  paper: string;
  url: string;
  size?: number;
  lastModified?: Date;
}

interface ReferenceGroup {
  subject: string;
  series: string;
  paper: string;
  files: CambridgeFile[];
  current?: string;
}

interface CambridgeReferencePanelProps {
  currentPaper?: string;
  onFileSelect: (file: CambridgeFile) => void;
  isVisible: boolean;
  onToggle: () => void;
  onClose?: () => void;
  linkedMarkingScheme?: string | null;
  linkedInsertPaper?: string | null;
  onMarkingSchemeChange?: (scheme: string | null) => void;
  onInsertPaperChange?: (paper: string | null) => void;
}

interface TabButtonProps {
  type: 'ms' | 'in' | 'qp';
  isActive: boolean;
  onClick: () => void;
}

interface PanelHeaderProps {
  currentParsed: Partial<CambridgeFile> | null;
  onClose: () => void;
}

interface PDFViewerProps {
  file: CambridgeFile;
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

interface TabContentProps {
  loading: boolean;
  currentFile: CambridgeFile | undefined;
  activeTab: string;
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

// ============================================
// CONSTANTS
// ============================================

const FILE_TYPE_CONFIG = {
  qp: { name: 'Question Paper', icon: '❓', color: '#3B82F6', description: 'Exam questions' },
  ms: { name: 'Marking Scheme', icon: '✅', color: '#10B981', description: 'Answer guidelines' },
  in: { name: 'Insert', icon: '📎', color: '#8B5CF6', description: 'Additional materials' },
  sf: { name: 'Source Booklet', icon: '📋', color: '#F59E0B', description: 'Source materials' }
};

const TAB_TYPES: Array<'ms' | 'in' | 'qp'> = ['ms', 'in', 'qp'];

// ============================================
// SUB-COMPONENTS
// ============================================

/**
 * Panel Header - Displays title, paper info, and close button
 */
const PanelHeader: React.FC<PanelHeaderProps> = ({ currentParsed, onClose }) => (
  <div className="panel-header">
    <div className="header-content">
      <h2>Related Documents</h2>
      {currentParsed && (
        <p className="paper-info">
          Subject {currentParsed.subject} • {currentParsed.series?.toUpperCase()} • Paper {currentParsed.paper}
        </p>
      )}
    </div>
    <button className="close-btn" onClick={onClose} title="Close panel">
      <X size={18} />
    </button>
  </div>
);

/**
 * Tab Button - Individual tab for MS/IN/QP selection
 */
const TabButton: React.FC<TabButtonProps> = ({ type, isActive, onClick }) => {
  const config = FILE_TYPE_CONFIG[type];
  const tabLabel = type.toUpperCase();
  
  return (
    <button
      className={`tab ${isActive ? 'active' : ''}`}
      onClick={onClick}
      title={config.name}
      aria-label={`Switch to ${config.name}`}
      aria-current={isActive ? 'page' : undefined}
    >
      <span className="tab-icon">{config.icon}</span>
      <span className="tab-label">{tabLabel}</span>
    </button>
  );
};

/**
 * Tab Navigation - Container for all tab buttons
 */
const TabNavigation: React.FC<{
  activeTab: 'ms' | 'in' | 'qp';
  onTabChange: (tab: 'ms' | 'in' | 'qp') => void;
}> = ({ activeTab, onTabChange }) => (
  <div className="panel-tabs">
    {TAB_TYPES.map(tabType => (
      <TabButton
        key={tabType}
        type={tabType}
        isActive={activeTab === tabType}
        onClick={() => onTabChange(tabType)}
      />
    ))}
  </div>
);

/**
 * Zoom Controls - Zoom in/out/reset buttons with level display
 */
const ZoomControls: React.FC<{
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}> = ({ zoomLevel, onZoomIn, onZoomOut, onZoomReset }) => (
  <div className="zoom-controls">
    <button 
      onClick={onZoomOut} 
      disabled={zoomLevel <= 50} 
      title="Zoom Out"
      aria-label="Zoom out"
    >
      <ZoomOut size={16} />
    </button>
    <span className="zoom-level">{zoomLevel}%</span>
    <button 
      onClick={onZoomIn} 
      disabled={zoomLevel >= 200} 
      title="Zoom In"
      aria-label="Zoom in"
    >
      <ZoomIn size={16} />
    </button>
    <button 
      onClick={onZoomReset} 
      title="Reset Zoom"
      aria-label="Reset zoom to 100%"
    >
      <RotateCcw size={16} />
    </button>
  </div>
);

/**
 * PDF Viewer - Iframe-based PDF rendering with zoom controls
 */
const PDFViewerComponent: React.FC<PDFViewerProps> = ({
  file,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}) => (
  <div className="pdf-viewer-container">
    <ZoomControls
      zoomLevel={zoomLevel}
      onZoomIn={onZoomIn}
      onZoomOut={onZoomOut}
      onZoomReset={onZoomReset}
    />
    <div className="pdf-frame">
      <iframe
        src={`${file.url}#zoom=${zoomLevel}&toolbar=0&navpanes=0&scrollbar=1`}
        className="pdf-iframe"
        title={file.typeName}
        aria-label={`PDF viewer for ${file.typeName}`}
      />
    </div>
  </div>
);

/**
 * Tab Content - Displays loading state, PDF viewer, or empty state
 */
const TabContent: React.FC<TabContentProps> = ({
  loading,
  currentFile,
  activeTab,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}) => {
  if (loading) {
    return (
      <div className="loading-state">
        <p>Loading documents...</p>
      </div>
    );
  }

  if (!currentFile) {
    return (
      <div className="no-document">
        <p>No {activeTab.toUpperCase()} document available</p>
        <p className="help-text">Or file not found at: /papers/..._{activeTab}_*.pdf</p>
        <p className="help-text" style={{marginTop: '8px', fontSize: '11px'}}>
          Try switching to another tab or open a different paper
        </p>
      </div>
    );
  }

  return (
    <PDFViewerComponent
      file={currentFile}
      zoomLevel={zoomLevel}
      onZoomIn={onZoomIn}
      onZoomOut={onZoomOut}
      onZoomReset={onZoomReset}
    />
  );
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Parse Cambridge exam paper filename into components
 * Regex pattern: SUBJECT_SERIES_TYPE_PAPER.pdf (e.g., 9706_s23_qp_32.pdf)
 */
const parseCambridgeFilename = (filename: string): Partial<CambridgeFile> | null => {
  const match = filename.match(/^(\d{4})_([smw]\d{2})_(qp|ms|in|sf)_(\w+)\.pdf$/i);
  
  if (!match) return null;
  
  const [, subject, series, type, paper] = match;
  const fileType = type.toLowerCase() as 'qp' | 'ms' | 'in' | 'sf';
  
  return {
    subject,
    series,
    paper,
    type: fileType,
    typeName: FILE_TYPE_CONFIG[fileType]?.name || type.toUpperCase()
  };
};

/**
 * Generate related files (MS, IN, QP) from a current paper
 */
const generateRelatedFiles = (currentPaper: string, parsed: Partial<CambridgeFile>): CambridgeFile[] => {
  return [
    {
      id: 'ms',
      filename: `${parsed.subject}_${parsed.series}_ms_${parsed.paper}.pdf`,
      subject: parsed.subject!,
      series: parsed.series!,
      paper: parsed.paper!,
      type: 'ms',
      typeName: 'Marking Scheme',
      url: `/papers/${parsed.subject}_${parsed.series}_ms_${parsed.paper}.pdf`
    },
    {
      id: 'in',
      filename: `${parsed.subject}_${parsed.series}_in_${parsed.paper}.pdf`,
      subject: parsed.subject!,
      series: parsed.series!,
      paper: parsed.paper!,
      type: 'in',
      typeName: 'Insert',
      url: `/papers/${parsed.subject}_${parsed.series}_in_${parsed.paper}.pdf`
    },
    {
      id: 'qp',
      filename: currentPaper,
      subject: parsed.subject!,
      series: parsed.series!,
      paper: parsed.paper!,
      type: 'qp',
      typeName: 'Question Paper',
      url: `/papers/${currentPaper}`
    }
  ];
};

// ============================================
// MAIN COMPONENT
// ============================================

export const CambridgeReferencePanel: React.FC<CambridgeReferencePanelProps> = ({
  currentPaper,
  onFileSelect,
  isVisible,
  onToggle,
  onClose,
  linkedMarkingScheme,
  linkedInsertPaper,
  onMarkingSchemeChange,
  onInsertPaperChange
}) => {
  // ============================================
  // STATE
  // ============================================

  const [availableFiles, setAvailableFiles] = useState<CambridgeFile[]>([]);
  const [activeTab, setActiveTab] = useState<'ms' | 'in' | 'qp'>('ms');
  const [loading, setLoading] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [currentParsed, setCurrentParsed] = useState<Partial<CambridgeFile> | null>(null);

  // ============================================
  // EFFECTS
  // ============================================

  /**
   * Load related files when current paper changes
   * Generates MS, IN, QP variants from the current paper filename
   */
  useEffect(() => {
    const loadRelatedFiles = async () => {
      console.log('[CambridgeReferencePanel] currentPaper:', currentPaper);
      
      if (!currentPaper) {
        setAvailableFiles([]);
        setCurrentParsed(null);
        return;
      }

      setLoading(true);
      
      try {
        const parsed = parseCambridgeFilename(currentPaper);
        console.log('[CambridgeReferencePanel] Parsed filename:', parsed);
        
        if (!parsed) {
          console.log('[CambridgeReferencePanel] Failed to parse filename');
          setAvailableFiles([]);
          setCurrentParsed(null);
          return;
        }

        setCurrentParsed(parsed);
        const relatedFiles = generateRelatedFiles(currentPaper, parsed);
        console.log('[CambridgeReferencePanel] Generated related files:', relatedFiles);
        setAvailableFiles(relatedFiles);
        
      } catch (error) {
        console.error('Failed to load related files:', error);
        setAvailableFiles([]);
        setCurrentParsed(null);
      } finally {
        setLoading(false);
      }
    };

    loadRelatedFiles();
  }, [currentPaper]);

  // ============================================
  // MEMOIZED SELECTORS
  // ============================================

  /**
   * Get current tab's file - memoized to prevent unnecessary re-renders
   */
  const currentTabFile = useMemo(() => {
    return availableFiles.find(file => file.type === activeTab);
  }, [availableFiles, activeTab]);

  // ============================================
  // HANDLERS
  // ============================================

  /**
   * Zoom level management callbacks
   */
  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev + 10, 200));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev - 10, 50));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoomLevel(100);
  }, []);

  /**
   * Panel toggle - provides true toggle behavior for ChevronLeft button
   */
  const handleToggle = useCallback(() => {
    onToggle();
  }, [onToggle]);

  /**
   * Panel close - X button handler with fallback to toggle if no onClose provided
   */
  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    } else {
      onToggle();
    }
  }, [onClose, onToggle]);

  /**
   * Tab change - switch between MS/IN/QP tabs
   */
  const handleTabChange = useCallback((tab: 'ms' | 'in' | 'qp') => {
    setActiveTab(tab);
  }, []);

  // ============================================
  // RENDER
  // ============================================

  return (
    <>
      {/* Toggle Button - Opens/closes the reference panel */}
      <button
        onClick={handleToggle}
        className={`fixed top-36 z-30 bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-l transition-all duration-300 ${
          isVisible ? 'right-[500px] lg:right-[500px] md:right-[40vw]' : 'right-0'
        }`}
        title={isVisible ? 'Close reference panel' : 'Open reference panel'}
        aria-label={isVisible ? 'Close reference panel' : 'Open reference panel'}
        aria-expanded={isVisible}
      >
        <ChevronLeft 
          size={20} 
          style={{ 
            transform: isVisible ? 'rotateY(180deg)' : 'none',
            transition: 'transform 0.2s ease'
          }} 
        />
      </button>

      {/* Reference Panel Container */}
      <div className={`cambridge-reference-panel ${isVisible ? 'visible' : 'hidden'}`}>
        {/* Header Section - Title and close button */}
        <PanelHeader 
          currentParsed={currentParsed} 
          onClose={handleClose} 
        />
        
        {/* Tab Navigation - MS / IN / QP tabs */}
        <TabNavigation 
          activeTab={activeTab} 
          onTabChange={handleTabChange} 
        />
        
        {/* Content Area - PDF viewer or empty state */}
        <div className="panel-content">
          <TabContent
            loading={loading}
            currentFile={currentTabFile}
            activeTab={activeTab}
            zoomLevel={zoomLevel}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onZoomReset={handleZoomReset}
          />
        </div>

        {/* Styling - Scoped CSS for the reference panel */}
        <style jsx>{`
          .cambridge-reference-panel {
            position: fixed;
            top: 0;
            right: 0;
            width: 500px;
            height: 100vh;
            background: white;
            border-left: 1px solid #E5E7EB;
            box-shadow: -4px 0 20px rgba(0, 0, 0, 0.1);
            z-index: 25;
            transform: translateX(100%);
            transition: transform 0.3s ease;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }

          .cambridge-reference-panel.visible {
            transform: translateX(0);
          }

          /* ---- Panel Header ---- */
          .panel-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            padding: 16px;
            border-bottom: 1px solid #E5E7EB;
            background: #F9FAFB;
            flex-shrink: 0;
          }

          .header-content {
            flex: 1;
          }

          .panel-header h2 {
            margin: 0 0 4px 0;
            font-size: 18px;
            color: #1F2937;
            font-weight: 600;
          }

          .paper-info {
            margin: 0;
            font-size: 12px;
            color: #6B7280;
            font-weight: 400;
          }

          .close-btn {
            background: none;
            border: none;
            cursor: pointer;
            color: #6B7280;
            padding: 6px;
            border-radius: 4px;
            transition: all 0.2s ease;
            flex-shrink: 0;
          }

          .close-btn:hover {
            color: #1F2937;
            background: #E5E7EB;
          }

          /* ---- Tab Navigation ---- */
          .panel-tabs {
            display: flex;
            border-bottom: 1px solid #E5E7EB;
            background: #F9FAFB;
            flex-shrink: 0;
          }

          .tab {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            padding: 12px 8px;
            border: none;
            background: none;
            cursor: pointer;
            color: #6B7280;
            border-bottom: 3px solid transparent;
            transition: all 0.2s ease;
            font-family: inherit;
          }

          .tab.active {
            color: #3B82F6;
            border-bottom-color: #3B82F6;
            background: white;
          }

          .tab:hover:not(.active) {
            background: rgba(59, 130, 246, 0.05);
            color: #374151;
          }

          .tab-icon {
            font-size: 18px;
            line-height: 1;
          }

          .tab-label {
            font-size: 12px;
            font-weight: 600;
          }

          /* ---- Panel Content ---- */
          .panel-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
            overflow: hidden;
          }

          /* ---- PDF Viewer Container ---- */
          .pdf-viewer-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            height: 100%;
            min-height: 0;
          }

          /* ---- Zoom Controls ---- */
          .zoom-controls {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 12px;
            border-bottom: 1px solid #E5E7EB;
            background: #F9FAFB;
            flex-shrink: 0;
          }

          .zoom-controls button {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            border: 1px solid #D1D5DB;
            background: white;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
            color: #374151;
            font-family: inherit;
            padding: 0;
          }

          .zoom-controls button:hover:not(:disabled) {
            background: #F3F4F6;
            border-color: #9CA3AF;
            color: #1F2937;
          }

          .zoom-controls button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .zoom-level {
            font-size: 14px;
            font-weight: 500;
            color: #374151;
            min-width: 50px;
            text-align: center;
          }

          /* ---- PDF Frame ---- */
          .pdf-frame {
            flex: 1;
            overflow: hidden;
            position: relative;
            background: #f5f5f5;
            min-height: 0;
          }

          .pdf-iframe {
            width: 100%;
            height: 100%;
            border: none;
            display: block;
            background: white;
            min-height: 100%;
          }

          /* ---- Empty States ---- */
          .loading-state,
          .no-document {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 40px 20px;
            color: #6B7280;
          }

          .loading-state p,
          .no-document p {
            margin: 0;
            font-size: 14px;
            line-height: 1.5;
          }

          .help-text {
            font-size: 13px;
            margin-top: 8px;
            color: #9CA3AF;
          }

          /* ---- Responsive Design ---- */
          /* Laptop with drawing pad: 500px (default) */
          /* Tablet: 40-50% width */
          @media (max-width: 1024px) {
            .cambridge-reference-panel {
              width: 50vw;
              max-width: 500px;
            }

            .tab-label {
              display: none;
            }
          }

          /* iPad Landscape: 45% width */
          @media (max-width: 1024px) and (orientation: landscape) {
            .cambridge-reference-panel {
              width: 45vw;
            }
          }

          /* iPad/Tablet: 50% width */
          @media (max-width: 768px) {
            .cambridge-reference-panel {
              width: 50vw;
              max-width: 100%;
            }

            .tab-label {
              display: none;
            }

            .zoom-controls button {
              width: 36px;
              height: 36px;
            }
          }

          /* Mobile: Full width */
          @media (max-width: 480px) {
            .cambridge-reference-panel {
              width: 100vw;
            }

            .tab {
              padding: 10px 6px;
            }

            .tab-icon {
              font-size: 16px;
            }

            .panel-header {
              padding: 12px;
            }

            .panel-header h2 {
              font-size: 16px;
            }

            .paper-info {
              font-size: 11px;
            }

            .zoom-controls button {
              width: 40px;
              height: 40px;
            }

            .zoom-level {
              font-size: 13px;
            }
          }

          /* Touch device optimizations (iPad, touch laptop) */
          @media (hover: none) and (pointer: coarse) {
            .zoom-controls button {
              width: 40px;
              height: 40px;
            }

            .tab {
              padding: 14px 8px;
            }

            .close-btn {
              padding: 8px;
            }
          }

          /* Landscape orientation on small devices */
          @media (max-height: 600px) {
            .panel-header {
              padding: 12px;
            }

            .panel-header h2 {
              font-size: 16px;
            }

            .tab {
              padding: 10px 6px;
            }
          }
        `}</style>
      </div>
    </>
  );
};

export default CambridgeReferencePanel;
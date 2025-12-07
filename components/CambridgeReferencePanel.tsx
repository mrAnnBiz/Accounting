import React, { useState, useEffect, useMemo } from 'react';

/**
 * Cambridge-specific reference panel system
 * Auto-detects related files (Marking Schemes, Inserts, Source Forms)
 * Phase 6: Reference panel integration with cross-document linking
 */

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
  onAnnotationLink?: (sourceFile: string, targetFile: string, annotation: any) => void;
  isVisible: boolean;
  onToggle: () => void;
}

const FILE_TYPE_CONFIG = {
  qp: { name: 'Question Paper', icon: '❓', color: '#3B82F6', description: 'Exam questions' },
  ms: { name: 'Marking Scheme', icon: '✅', color: '#10B981', description: 'Answer guidelines' },
  in: { name: 'Insert', icon: '📎', color: '#8B5CF6', description: 'Additional materials' },
  sf: { name: 'Source Booklet', icon: '📋', color: '#F59E0B', description: 'Source materials' }
};

export const CambridgeReferencePanel: React.FC<CambridgeReferencePanelProps> = ({
  currentPaper,
  onFileSelect,
  onAnnotationLink,
  isVisible,
  onToggle
}) => {
  const [availableFiles, setAvailableFiles] = useState<CambridgeFile[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<ReferenceGroup | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'related' | 'search' | 'bookmarks'>('related');
  const [bookmarkedFiles, setBookmarkedFiles] = useState<string[]>([]);

  // Parse Cambridge filename
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

  // Load available Cambridge files
  useEffect(() => {
    const loadAvailableFiles = async () => {
      setLoading(true);
      
      try {
        // In a real implementation, this would fetch from your file system or API
        // For now, we'll simulate with common Cambridge files
        const simulatedFiles: CambridgeFile[] = [
          {
            id: '1',
            filename: '9706_s23_qp_32.pdf',
            subject: '9706',
            series: 's23',
            paper: '32',
            type: 'qp',
            typeName: 'Question Paper',
            url: '/papers/9706_s23_qp_32.pdf'
          },
          {
            id: '2',
            filename: '9706_s23_ms_32.pdf',
            subject: '9706',
            series: 's23',
            paper: '32',
            type: 'ms',
            typeName: 'Marking Scheme',
            url: '/papers/9706_s23_ms_32.pdf'
          },
          {
            id: '3',
            filename: '9706_s23_in_32.pdf',
            subject: '9706',
            series: 's23',
            paper: '32',
            type: 'in',
            typeName: 'Insert',
            url: '/papers/9706_s23_in_32.pdf'
          }
        ];
        
        setAvailableFiles(simulatedFiles);
        
        // Auto-select related files if current paper is available
        if (currentPaper) {
          const currentParsed = parseCambridgeFilename(currentPaper);
          if (currentParsed) {
            const relatedFiles = simulatedFiles.filter(file => 
              file.subject === currentParsed.subject &&
              file.series === currentParsed.series &&
              file.paper === currentParsed.paper
            );
            
            if (relatedFiles.length > 0) {
              setSelectedGroup({
                subject: currentParsed.subject!,
                series: currentParsed.series!,
                paper: currentParsed.paper!,
                files: relatedFiles,
                current: currentPaper
              });
            }
          }
        }
        
      } catch (error) {
        console.error('Failed to load Cambridge files:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAvailableFiles();
  }, [currentPaper]);

  // Group files by subject, series, and paper
  const groupedFiles = useMemo(() => {
    const groups: { [key: string]: ReferenceGroup } = {};
    
    availableFiles.forEach(file => {
      const key = `${file.subject}_${file.series}_${file.paper}`;
      
      if (!groups[key]) {
        groups[key] = {
          subject: file.subject,
          series: file.series,
          paper: file.paper,
          files: []
        };
      }
      
      groups[key].files.push(file);
    });
    
    return Object.values(groups);
  }, [availableFiles]);

  // Filter files based on search
  const filteredFiles = useMemo(() => {
    if (!searchQuery) return availableFiles;
    
    return availableFiles.filter(file =>
      file.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      file.typeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      FILE_TYPE_CONFIG[file.type].description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [availableFiles, searchQuery]);

  const handleFileSelect = (file: CambridgeFile) => {
    onFileSelect(file);
  };

  const handleBookmark = (fileId: string) => {
    setBookmarkedFiles(prev => 
      prev.includes(fileId) 
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    );
  };

  const RelatedFilesTab = () => (
    <div className="reference-content">
      {selectedGroup ? (
        <div className="file-group">
          <div className="group-header">
            <h3>Related Files</h3>
            <div className="group-info">
              <span className="subject-badge">Subject {selectedGroup.subject}</span>
              <span className="series-badge">{selectedGroup.series.toUpperCase()}</span>
              <span className="paper-badge">Paper {selectedGroup.paper}</span>
            </div>
          </div>
          
          <div className="file-list">
            {selectedGroup.files.map(file => (
              <div
                key={file.id}
                className={`file-item ${file.filename === currentPaper ? 'current' : ''}`}
                onClick={() => handleFileSelect(file)}
              >
                <div className="file-icon" style={{ color: FILE_TYPE_CONFIG[file.type].color }}>
                  {FILE_TYPE_CONFIG[file.type].icon}
                </div>
                <div className="file-details">
                  <div className="file-name">{file.filename}</div>
                  <div className="file-description">
                    {FILE_TYPE_CONFIG[file.type].description}
                  </div>
                </div>
                <div className="file-actions">
                  <button
                    className={`bookmark-btn ${bookmarkedFiles.includes(file.id) ? 'bookmarked' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBookmark(file.id);
                    }}
                  >
                    {bookmarkedFiles.includes(file.id) ? '⭐' : '☆'}
                  </button>
                  {file.filename === currentPaper && (
                    <span className="current-indicator">Current</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="no-selection">
          <p>No related files found for current paper</p>
          <button onClick={() => setActiveTab('search')}>Search Files</button>
        </div>
      )}
    </div>
  );

  const SearchTab = () => (
    <div className="reference-content">
      <div className="search-section">
        <input
          type="text"
          placeholder="Search Cambridge files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>
      
      <div className="file-list">
        {filteredFiles.map(file => (
          <div
            key={file.id}
            className="file-item"
            onClick={() => handleFileSelect(file)}
          >
            <div className="file-icon" style={{ color: FILE_TYPE_CONFIG[file.type].color }}>
              {FILE_TYPE_CONFIG[file.type].icon}
            </div>
            <div className="file-details">
              <div className="file-name">{file.filename}</div>
              <div className="file-description">
                {FILE_TYPE_CONFIG[file.type].description}
              </div>
            </div>
            <div className="file-actions">
              <button
                className={`bookmark-btn ${bookmarkedFiles.includes(file.id) ? 'bookmarked' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleBookmark(file.id);
                }}
              >
                {bookmarkedFiles.includes(file.id) ? '⭐' : '☆'}
              </button>
            </div>
          </div>
        ))}
        
        {filteredFiles.length === 0 && searchQuery && (
          <div className="no-results">
            <p>No files found matching "{searchQuery}"</p>
          </div>
        )}
      </div>
    </div>
  );

  const BookmarksTab = () => {
    const bookmarked = availableFiles.filter(file => bookmarkedFiles.includes(file.id));
    
    return (
      <div className="reference-content">
        {bookmarked.length > 0 ? (
          <div className="file-list">
            {bookmarked.map(file => (
              <div
                key={file.id}
                className="file-item"
                onClick={() => handleFileSelect(file)}
              >
                <div className="file-icon" style={{ color: FILE_TYPE_CONFIG[file.type].color }}>
                  {FILE_TYPE_CONFIG[file.type].icon}
                </div>
                <div className="file-details">
                  <div className="file-name">{file.filename}</div>
                  <div className="file-description">
                    {FILE_TYPE_CONFIG[file.type].description}
                  </div>
                </div>
                <div className="file-actions">
                  <button
                    className="bookmark-btn bookmarked"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBookmark(file.id);
                    }}
                  >
                    ⭐
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-bookmarks">
            <p>No bookmarked files</p>
            <p>Bookmark files by clicking the star icon</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`cambridge-reference-panel ${isVisible ? 'visible' : 'hidden'}`}>
      <div className="panel-header">
        <h2>Reference Panel</h2>
        <button className="close-btn" onClick={onToggle}>×</button>
      </div>
      
      <div className="panel-tabs">
        <button
          className={`tab ${activeTab === 'related' ? 'active' : ''}`}
          onClick={() => setActiveTab('related')}
        >
          Related Files
        </button>
        <button
          className={`tab ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
        >
          Search
        </button>
        <button
          className={`tab ${activeTab === 'bookmarks' ? 'active' : ''}`}
          onClick={() => setActiveTab('bookmarks')}
        >
          Bookmarks ({bookmarkedFiles.length})
        </button>
      </div>
      
      {loading ? (
        <div className="loading-state">
          <p>Loading Cambridge files...</p>
        </div>
      ) : (
        <div className="tab-content">
          {activeTab === 'related' && <RelatedFilesTab />}
          {activeTab === 'search' && <SearchTab />}
          {activeTab === 'bookmarks' && <BookmarksTab />}
        </div>
      )}

      <style jsx>{`
        .cambridge-reference-panel {
          position: fixed;
          top: 0;
          right: 0;
          width: 400px;
          height: 100vh;
          background: white;
          border-left: 1px solid #E5E7EB;
          box-shadow: -4px 0 20px rgba(0, 0, 0, 0.1);
          z-index: 1000;
          transform: translateX(100%);
          transition: transform 0.3s ease;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .cambridge-reference-panel.visible {
          transform: translateX(0);
        }

        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          border-bottom: 1px solid #E5E7EB;
          background: #F9FAFB;
        }

        .panel-header h2 {
          margin: 0;
          font-size: 18px;
          color: #1F2937;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #6B7280;
          padding: 4px;
        }

        .close-btn:hover {
          color: #1F2937;
        }

        .panel-tabs {
          display: flex;
          border-bottom: 1px solid #E5E7EB;
          background: #F9FAFB;
        }

        .tab {
          flex: 1;
          padding: 12px 16px;
          border: none;
          background: none;
          cursor: pointer;
          font-size: 14px;
          color: #6B7280;
          border-bottom: 2px solid transparent;
        }

        .tab.active {
          color: #3B82F6;
          border-bottom-color: #3B82F6;
          background: white;
        }

        .tab:hover {
          background: rgba(59, 130, 246, 0.05);
        }

        .tab-content {
          flex: 1;
          overflow-y: auto;
        }

        .reference-content {
          padding: 16px;
        }

        .group-header {
          margin-bottom: 16px;
        }

        .group-header h3 {
          margin: 0 0 8px 0;
          font-size: 16px;
          color: #1F2937;
        }

        .group-info {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .subject-badge,
        .series-badge,
        .paper-badge {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
        }

        .subject-badge {
          background: #DBEAFE;
          color: #1E40AF;
        }

        .series-badge {
          background: #D1FAE5;
          color: #065F46;
        }

        .paper-badge {
          background: #FEF3C7;
          color: #92400E;
        }

        .file-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .file-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border: 1px solid #E5E7EB;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .file-item:hover {
          border-color: #D1D5DB;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        .file-item.current {
          border-color: #3B82F6;
          background: #EFF6FF;
        }

        .file-icon {
          font-size: 24px;
          min-width: 32px;
          text-align: center;
        }

        .file-details {
          flex: 1;
          min-width: 0;
        }

        .file-name {
          font-weight: 500;
          color: #1F2937;
          margin-bottom: 2px;
        }

        .file-description {
          font-size: 12px;
          color: #6B7280;
        }

        .file-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .bookmark-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 16px;
          color: #D1D5DB;
          padding: 4px;
        }

        .bookmark-btn:hover,
        .bookmark-btn.bookmarked {
          color: #FCD34D;
        }

        .current-indicator {
          font-size: 11px;
          background: #3B82F6;
          color: white;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 500;
        }

        .search-section {
          margin-bottom: 16px;
        }

        .search-input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #D1D5DB;
          border-radius: 6px;
          font-size: 14px;
        }

        .search-input:focus {
          outline: none;
          border-color: #3B82F6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .no-selection,
        .no-results,
        .no-bookmarks,
        .loading-state {
          text-align: center;
          padding: 40px 20px;
          color: #6B7280;
        }

        .no-selection button {
          margin-top: 16px;
          padding: 8px 16px;
          background: #3B82F6;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }

        @media (max-width: 768px) {
          .cambridge-reference-panel {
            width: 100%;
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
};

export default CambridgeReferencePanel;
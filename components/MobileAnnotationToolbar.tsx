import React, { useState, useEffect, useRef } from 'react';
import { AnnotationTool, AnnotationProperties } from '@/types/annotations';
import { useMobileOptimization } from './TouchGestureHandler';

/**
 * Mobile-optimized annotation toolbar
 * Responsive design with touch-friendly controls
 */

interface MobileToolbarProps {
  selectedTool: AnnotationTool;
  onToolSelect: (tool: AnnotationTool) => void;
  toolProperties: AnnotationProperties;
  onPropertiesChange: (properties: AnnotationProperties) => void;
  onToggleAnnotationMode: () => void;
  isAnnotationMode: boolean;
  annotations: any[];
  onExport: () => void;
  onClear: () => void;
}

interface ToolConfig {
  id: AnnotationTool;
  name: string;
  icon: string;
  color: string;
  category: 'drawing' | 'shapes' | 'text' | 'utility';
}

const MOBILE_TOOLS: ToolConfig[] = [
  { id: 'pan', name: 'Pan', icon: '✋', color: '#6B7280', category: 'utility' },
  { id: 'pen', name: 'Pen', icon: '✏️', color: '#3B82F6', category: 'drawing' },
  { id: 'highlighter', name: 'Highlight', icon: '🖍️', color: '#FBBF24', category: 'drawing' },
  { id: 'rectangle', name: 'Rectangle', icon: '⬜', color: '#10B981', category: 'shapes' },
  { id: 'circle', name: 'Circle', icon: '⭕', color: '#8B5CF6', category: 'shapes' },
  { id: 'line', name: 'Line', icon: '📏', color: '#F59E0B', category: 'shapes' },
  { id: 'arrow', name: 'Arrow', icon: '➡️', color: '#EF4444', category: 'shapes' },
  { id: 'text', name: 'Text', icon: '🅰️', color: '#6366F1', category: 'text' },
];

const PRESET_COLORS = [
  '#000000', '#FF0000', '#00FF00', '#0000FF',
  '#FFFF00', '#FF00FF', '#00FFFF', '#FFFFFF',
  '#808080', '#800000', '#008000', '#000080',
  '#808000', '#800080', '#008080', '#C0C0C0'
];

export const MobileAnnotationToolbar: React.FC<MobileToolbarProps> = ({
  selectedTool,
  onToolSelect,
  toolProperties,
  onPropertiesChange,
  onToggleAnnotationMode,
  isAnnotationMode,
  annotations,
  onExport,
  onClear
}) => {
  const { isMobile, isTablet, orientation } = useMobileOptimization();
  const [isExpanded, setIsExpanded] = useState(false);
  const [activePanel, setActivePanel] = useState<'tools' | 'colors' | 'settings' | null>(null);
  const [toolbarPosition, setToolbarPosition] = useState<'bottom' | 'side'>('bottom');
  
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Adjust toolbar position based on device and orientation
  useEffect(() => {
    if (orientation === 'landscape' && isTablet) {
      setToolbarPosition('side');
    } else {
      setToolbarPosition('bottom');
    }
  }, [orientation, isTablet]);

  // Group tools by category for better mobile organization
  const toolsByCategory = React.useMemo(() => {
    return MOBILE_TOOLS.reduce((acc, tool) => {
      if (!acc[tool.category]) acc[tool.category] = [];
      acc[tool.category].push(tool);
      return acc;
    }, {} as Record<string, ToolConfig[]>);
  }, []);

  const handleToolSelect = (tool: AnnotationTool) => {
    onToolSelect(tool);
    if (tool !== 'pan' && !isAnnotationMode) {
      onToggleAnnotationMode();
    }
    setIsExpanded(false);
    setActivePanel(null);
  };

  const handleColorChange = (color: string) => {
    onPropertiesChange({ ...toolProperties, color });
  };

  const handleSizeChange = (size: number) => {
    onPropertiesChange({ ...toolProperties, strokeWidth: size });
  };

  const handleOpacityChange = (opacity: number) => {
    onPropertiesChange({ ...toolProperties, opacity });
  };

  const togglePanel = (panel: 'tools' | 'colors' | 'settings') => {
    setActivePanel(activePanel === panel ? null : panel);
    if (!isExpanded) setIsExpanded(true);
  };

  const QuickToolSelector = () => (
    <div className="quick-tools">
      {['pan', 'pen', 'highlighter', 'text'].map(tool => {
        const toolConfig = MOBILE_TOOLS.find(t => t.id === tool);
        if (!toolConfig) return null;
        
        return (
          <button
            key={tool}
            className={`quick-tool-btn ${selectedTool === tool ? 'active' : ''}`}
            onClick={() => handleToolSelect(tool as AnnotationTool)}
            style={{ 
              backgroundColor: selectedTool === tool ? toolConfig.color : 'transparent',
              color: selectedTool === tool ? 'white' : toolConfig.color
            }}
          >
            <span className="tool-icon">{toolConfig.icon}</span>
            {!isMobile && <span className="tool-name">{toolConfig.name}</span>}
          </button>
        );
      })}
    </div>
  );

  const ToolPanel = () => (
    <div className="tool-panel">
      {Object.entries(toolsByCategory).map(([category, tools]) => (
        <div key={category} className="tool-category">
          <h4 className="category-title">{category.charAt(0).toUpperCase() + category.slice(1)}</h4>
          <div className="category-tools">
            {tools.map(tool => (
              <button
                key={tool.id}
                className={`tool-btn ${selectedTool === tool.id ? 'active' : ''}`}
                onClick={() => handleToolSelect(tool.id)}
                style={{ 
                  backgroundColor: selectedTool === tool.id ? tool.color : 'transparent',
                  borderColor: tool.color
                }}
              >
                <span className="tool-icon">{tool.icon}</span>
                <span className="tool-name">{tool.name}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const ColorPanel = () => (
    <div className="color-panel">
      <div className="current-color">
        <div 
          className="current-color-display"
          style={{ backgroundColor: toolProperties.color }}
        />
        <span>Current Color</span>
      </div>
      <div className="color-grid">
        {PRESET_COLORS.map(color => (
          <button
            key={color}
            className={`color-btn ${toolProperties.color === color ? 'active' : ''}`}
            style={{ backgroundColor: color }}
            onClick={() => handleColorChange(color)}
          />
        ))}
      </div>
      <div className="custom-color">
        <input
          type="color"
          value={toolProperties.color}
          onChange={(e) => handleColorChange(e.target.value)}
          className="color-picker"
        />
        <span>Custom Color</span>
      </div>
    </div>
  );

  const SettingsPanel = () => (
    <div className="settings-panel">
      <div className="setting-group">
        <label>Stroke Width</label>
        <div className="size-controls">
          {[1, 2, 4, 8, 16].map(size => (
            <button
              key={size}
              className={`size-btn ${toolProperties.strokeWidth === size ? 'active' : ''}`}
              onClick={() => handleSizeChange(size)}
            >
              <div 
                className="size-preview"
                style={{ 
                  width: `${Math.min(size * 2, 20)}px`,
                  height: `${Math.min(size * 2, 20)}px`,
                  backgroundColor: toolProperties.color 
                }}
              />
              {size}px
            </button>
          ))}
        </div>
      </div>
      
      <div className="setting-group">
        <label>Opacity</label>
        <input
          type="range"
          min="0.1"
          max="1"
          step="0.1"
          value={toolProperties.opacity}
          onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
          className="opacity-slider"
        />
        <span>{Math.round(toolProperties.opacity * 100)}%</span>
      </div>
    </div>
  );

  const ActionButtons = () => (
    <div className="action-buttons">
      <button
        className={`action-btn annotation-toggle ${isAnnotationMode ? 'active' : ''}`}
        onClick={onToggleAnnotationMode}
      >
        <span className="btn-icon">{isAnnotationMode ? '📝' : '👀'}</span>
        <span className="btn-text">{isAnnotationMode ? 'Annotate' : 'View'}</span>
      </button>
      
      {annotations.length > 0 && (
        <>
          <button className="action-btn export-btn" onClick={onExport}>
            <span className="btn-icon">📤</span>
            <span className="btn-text">Export</span>
          </button>
          
          <button className="action-btn clear-btn" onClick={onClear}>
            <span className="btn-icon">🗑️</span>
            <span className="btn-text">Clear</span>
          </button>
        </>
      )}
    </div>
  );

  return (
    <div 
      ref={toolbarRef}
      className={`mobile-annotation-toolbar ${toolbarPosition} ${isExpanded ? 'expanded' : 'collapsed'} ${orientation}`}
    >
      {/* Main toolbar controls */}
      <div className="toolbar-main">
        <QuickToolSelector />
        
        <div className="toolbar-controls">
          <button
            className={`control-btn ${activePanel === 'tools' ? 'active' : ''}`}
            onClick={() => togglePanel('tools')}
          >
            <span className="btn-icon">🛠️</span>
            {!isMobile && <span className="btn-text">Tools</span>}
          </button>
          
          <button
            className={`control-btn ${activePanel === 'colors' ? 'active' : ''}`}
            onClick={() => togglePanel('colors')}
          >
            <span className="btn-icon">🎨</span>
            {!isMobile && <span className="btn-text">Colors</span>}
          </button>
          
          <button
            className={`control-btn ${activePanel === 'settings' ? 'active' : ''}`}
            onClick={() => togglePanel('settings')}
          >
            <span className="btn-icon">⚙️</span>
            {!isMobile && <span className="btn-text">Settings</span>}
          </button>
        </div>
        
        <ActionButtons />
        
        <button
          className="expand-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span className="toggle-icon">{isExpanded ? '▼' : '▲'}</span>
        </button>
      </div>

      {/* Expandable panels */}
      {activePanel && (
        <div className="toolbar-panel">
          {activePanel === 'tools' && <ToolPanel />}
          {activePanel === 'colors' && <ColorPanel />}
          {activePanel === 'settings' && <SettingsPanel />}
        </div>
      )}

      <style jsx>{`
        .mobile-annotation-toolbar {
          position: fixed;
          z-index: 1000;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          transition: all 0.3s ease;
        }

        .mobile-annotation-toolbar.bottom {
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          width: calc(100% - 40px);
          max-width: 600px;
        }

        .mobile-annotation-toolbar.side {
          top: 50%;
          right: 20px;
          transform: translateY(-50%);
          width: 320px;
          max-height: calc(100vh - 40px);
          overflow-y: auto;
        }

        .toolbar-main {
          display: flex;
          align-items: center;
          padding: 12px;
          gap: 8px;
        }

        .quick-tools {
          display: flex;
          gap: 6px;
        }

        .quick-tool-btn, .control-btn, .action-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 8px 12px;
          border: 2px solid transparent;
          border-radius: 8px;
          background: transparent;
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 14px;
          min-height: 40px;
        }

        .quick-tool-btn:hover, .control-btn:hover, .action-btn:hover {
          background: rgba(0, 0, 0, 0.05);
        }

        .quick-tool-btn.active {
          border-color: currentColor;
        }

        .toolbar-controls {
          display: flex;
          gap: 4px;
          margin-left: auto;
        }

        .action-buttons {
          display: flex;
          gap: 4px;
        }

        .annotation-toggle.active {
          background: #3B82F6;
          color: white;
        }

        .expand-toggle {
          padding: 8px;
          background: none;
          border: none;
          cursor: pointer;
          color: #6B7280;
        }

        .toolbar-panel {
          border-top: 1px solid #E5E7EB;
          padding: 16px;
          max-height: 300px;
          overflow-y: auto;
        }

        .tool-category {
          margin-bottom: 16px;
        }

        .category-title {
          font-size: 12px;
          font-weight: 600;
          color: #6B7280;
          margin: 0 0 8px 0;
          text-transform: uppercase;
        }

        .category-tools {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
          gap: 8px;
        }

        .tool-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 12px 8px;
          border: 2px solid #E5E7EB;
          border-radius: 8px;
          background: white;
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 12px;
        }

        .tool-btn:hover {
          border-color: #D1D5DB;
        }

        .tool-btn.active {
          color: white;
        }

        .color-panel {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .current-color {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .current-color-display {
          width: 24px;
          height: 24px;
          border-radius: 4px;
          border: 2px solid #E5E7EB;
        }

        .color-grid {
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          gap: 4px;
        }

        .color-btn {
          width: 32px;
          height: 32px;
          border: 2px solid #E5E7EB;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .color-btn:hover, .color-btn.active {
          border-color: #3B82F6;
          transform: scale(1.1);
        }

        .custom-color {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .color-picker {
          width: 40px;
          height: 40px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .settings-panel {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .setting-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .setting-group label {
          font-size: 14px;
          font-weight: 600;
          color: #374151;
        }

        .size-controls {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .size-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 8px;
          border: 2px solid #E5E7EB;
          border-radius: 4px;
          background: white;
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 11px;
        }

        .size-btn:hover, .size-btn.active {
          border-color: #3B82F6;
          background: #EFF6FF;
        }

        .size-preview {
          border-radius: 50%;
        }

        .opacity-slider {
          width: 100%;
          height: 6px;
          border-radius: 3px;
          background: #E5E7EB;
          outline: none;
          cursor: pointer;
        }

        .btn-icon {
          font-size: 16px;
        }

        .btn-text {
          font-size: 12px;
          font-weight: 500;
        }

        @media (max-width: 480px) {
          .mobile-annotation-toolbar.bottom {
            width: calc(100% - 20px);
            bottom: 10px;
          }
          
          .toolbar-main {
            padding: 8px;
            gap: 4px;
          }
          
          .btn-text {
            display: none;
          }
          
          .quick-tool-btn, .control-btn, .action-btn {
            padding: 8px;
            min-height: 36px;
          }
        }
      `}</style>
    </div>
  );
};

export default MobileAnnotationToolbar;
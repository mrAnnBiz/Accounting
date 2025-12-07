import React, { useState, useRef, useEffect } from 'react';
import { AnnotationTool, AnnotationType, DEFAULT_ANNOTATION_PROPERTIES } from '../types/annotations';

interface AnnotationToolbarProps {
  selectedTool: AnnotationTool;
  onToolSelect: (tool: AnnotationTool) => void;
  toolProperties: any;
  onToolPropertiesChange: (properties: any) => void;
  onClearAll?: () => void;
  onExport?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
  zoom?: number;
}

export const AnnotationToolbar: React.FC<AnnotationToolbarProps> = ({
  selectedTool,
  onToolSelect,
  toolProperties,
  onToolPropertiesChange,
  onClearAll,
  onExport,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  zoom = 100
}) => {
  const [isPropertiesExpanded, setIsPropertiesExpanded] = useState(false);
  const [hoveredTool, setHoveredTool] = useState<string | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Close properties panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target as Node)) {
        setIsPropertiesExpanded(false);
      }
    };

    if (isPropertiesExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isPropertiesExpanded]);

  const tools: { id: AnnotationTool; label: string; icon: string; cursor?: string }[] = [
    { id: 'pan', label: 'Pan', icon: '↔', cursor: 'grab' },
    { id: 'select', label: 'Select', icon: '⤴', cursor: 'default' },
    { id: 'pen', label: 'Pen', icon: '✎', cursor: 'crosshair' },
    { id: 'highlighter', label: 'Highlighter', icon: '▍', cursor: 'crosshair' },
    { id: 'eraser', label: 'Eraser', icon: '⌫', cursor: 'pointer' },
    { id: 'rectangle', label: 'Rectangle', icon: '▢', cursor: 'crosshair' },
    { id: 'circle', label: 'Circle', icon: '○', cursor: 'crosshair' },
    { id: 'arrow', label: 'Arrow', icon: '↗', cursor: 'crosshair' },
    { id: 'line', label: 'Line', icon: '╱', cursor: 'crosshair' },
    { id: 'text', label: 'Text', icon: 'T', cursor: 'text' }
  ];

  const zoomActions = [
    { id: 'zoom-in', label: 'Zoom In', icon: '+' },
    { id: 'zoom-out', label: 'Zoom Out', icon: '−' }
  ];

  const colors = [
    '#000000', '#FF0000', '#00FF00', '#0000FF',
    '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500'
  ];

  const strokeWidths = [1, 2, 3, 5, 8, 12];

  const handleColorChange = (color: string) => {
    onToolPropertiesChange({ ...toolProperties, color });
  };

  const handleStrokeWidthChange = (strokeWidth: number) => {
    onToolPropertiesChange({ ...toolProperties, strokeWidth });
  };

  const handleOpacityChange = (opacity: number) => {
    onToolPropertiesChange({ ...toolProperties, opacity });
  };

  const getCurrentProperties = () => {
    if (selectedTool === 'pan' || selectedTool === 'select') return null;
    return {
      ...DEFAULT_ANNOTATION_PROPERTIES[selectedTool as AnnotationType],
      ...toolProperties
    };
  };

  const currentProps = getCurrentProperties();

  return (
    <div className="annotation-toolbar" ref={toolbarRef} style={toolbarStyle}>
      {/* Main Tools Section */}
      <div className="main-tools" style={mainToolsStyle}>
        {tools.map(tool => (
          <button
            key={tool.id}
            onClick={() => onToolSelect(tool.id)}
            onMouseEnter={() => setHoveredTool(tool.id)}
            onMouseLeave={() => setHoveredTool(null)}
            style={{
              ...mainToolButtonStyle,
              ...(selectedTool === tool.id ? selectedMainToolStyle : 
                  hoveredTool === tool.id ? hoveredMainToolStyle : {}),
              cursor: tool.cursor || 'pointer'
            }}
            title={tool.label}
          >
            <div style={toolIconStyle}>{tool.icon}</div>
            <div style={toolLabelStyle}>{tool.label}</div>
          </button>
        ))}
      </div>

      {/* Divider */}
      <div style={dividerStyle}></div>

      {/* Zoom Controls */}
      <div className="zoom-controls" style={zoomControlsStyle}>
        <button
          onClick={onZoomOut}
          style={zoomButtonStyle}
          title="Zoom Out"
          disabled={!onZoomOut}
        >
          <div style={zoomIconStyle}>−</div>
        </button>
        <div style={zoomDisplayStyle}>{zoom}%</div>
        <button
          onClick={onZoomIn}
          style={zoomButtonStyle}
          title="Zoom In"
          disabled={!onZoomIn}
        >
          <div style={zoomIconStyle}>+</div>
        </button>

      </div>

      {/* Divider */}
      <div style={dividerStyle}></div>

      {/* Actions */}
      <div className="toolbar-actions" style={actionsStyle}>
        <button
          onClick={() => setIsPropertiesExpanded(!isPropertiesExpanded)}
          style={{
            ...actionButtonStyle,
            ...(isPropertiesExpanded ? selectedActionStyle : {})
          }}
          title="Properties"
        >
          <div style={actionIconStyle}>⚙</div>
          <div style={actionLabelStyle}>Props</div>
        </button>
        {onClearAll && (
          <button
            onClick={onClearAll}
            style={actionButtonStyle}
            title="Clear All"
          >
            <div style={actionIconStyle}>✕</div>
            <div style={actionLabelStyle}>Clear</div>
          </button>
        )}
        {onExport && (
          <button
            onClick={onExport}
            style={actionButtonStyle}
            title="Export"
          >
            <div style={actionIconStyle}>↓</div>
            <div style={actionLabelStyle}>Export</div>
          </button>
        )}
      </div>

      {/* Properties Panel - Expandable */}
      {isPropertiesExpanded && (
        <div className="properties-panel" style={propertiesPanelStyle}>

          {/* Additional Tools */}
          <div className="additional-tools-section" style={sectionStyle}>
            <div className="section-label" style={labelStyle}>More Tools</div>
            <div className="additional-tools-grid" style={additionalToolsGridStyle}>
              {tools.slice(6).map(tool => (
                <button
                  key={tool.id}
                  onClick={() => onToolSelect(tool.id)}
                  style={{
                    ...additionalToolButtonStyle,
                    ...(selectedTool === tool.id ? selectedToolStyle : {})
                  }}
                  title={tool.label}
                >
                  <div style={toolIconStyle}>{tool.icon}</div>
                  <div style={toolLabelStyle}>{tool.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Properties Panel */}
          {currentProps && (
            <div className="properties-section" style={sectionStyle}>
              <div className="section-label" style={labelStyle}>Properties</div>
              
              {/* Color Selection */}
              <div className="property-group" style={propertyGroupStyle}>
                <label style={propertyLabelStyle}>Color:</label>
                <div className="color-grid" style={colorGridStyle}>
                  {colors.map(color => (
                    <button
                      key={color}
                      onClick={() => handleColorChange(color)}
                      style={{
                        ...colorButtonStyle,
                        backgroundColor: color,
                        ...(currentProps.color === color ? selectedColorStyle : {})
                      }}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              {/* Stroke Width */}
              {currentProps.strokeWidth !== undefined && (
                <div className="property-group" style={propertyGroupStyle}>
                  <label style={propertyLabelStyle}>
                    Stroke Width: {currentProps.strokeWidth}px
                  </label>
                  <div className="stroke-grid" style={strokeGridStyle}>
                    {strokeWidths.map(width => (
                      <button
                        key={width}
                        onClick={() => handleStrokeWidthChange(width)}
                        style={{
                          ...strokeButtonStyle,
                          ...(currentProps.strokeWidth === width ? selectedStrokeStyle : {})
                        }}
                        title={`${width}px`}
                      >
                        <div 
                          style={{
                            width: '20px',
                            height: `${width}px`,
                            backgroundColor: '#000',
                            borderRadius: `${width / 2}px`
                          }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Opacity */}
              {currentProps.opacity !== undefined && (
                <div className="property-group" style={propertyGroupStyle}>
                  <label style={propertyLabelStyle}>
                    Opacity: {Math.round(currentProps.opacity * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={currentProps.opacity}
                    onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
                    style={sliderStyle}
                  />
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="actions-section" style={sectionStyle}>
            <div className="section-label" style={labelStyle}>Actions</div>
            <div className="action-buttons" style={actionButtonsStyle}>
              {onClearAll && (
                <button
                  onClick={onClearAll}
                  style={actionButtonStyle}
                  title="Clear all annotations"
                >
                  🗑️ Clear All
                </button>
              )}
              {onExport && (
                <button
                  onClick={onExport}
                  style={actionButtonStyle}
                  title="Export annotations"
                >
                  💾 Export
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Styles - Horizontal Main Toolbar
const toolbarStyle: React.CSSProperties = {
  position: 'fixed',
  top: '120px',
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  backgroundColor: '#1f2937', // Darker background
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: '#374151',
  borderRadius: '12px',
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)', // Enhanced shadow
  zIndex: 1000,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: '12px',
  padding: '8px 16px'
};

const mainToolsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '4px'
};

const mainToolButtonStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  width: '56px',
  height: '48px',
  padding: '6px',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'transparent',
  borderRadius: '8px',
  backgroundColor: 'transparent',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  fontSize: '16px',
  color: '#d1d5db' // Light gray for dark theme
};

const selectedMainToolStyle: React.CSSProperties = {
  backgroundColor: '#3b82f6',
  borderColor: '#3b82f6',
  color: 'white',
  boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)'
};

const hoveredMainToolStyle: React.CSSProperties = {
  backgroundColor: '#374151',
  borderColor: '#4b5563',
  color: '#f9fafb'
};

const dividerStyle: React.CSSProperties = {
  width: '1px',
  height: '36px',
  backgroundColor: '#4b5563',
  margin: '0 4px'
};

const zoomControlsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px'
};

const zoomButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: '#4b5563',
  borderRadius: '6px',
  backgroundColor: '#374151',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  fontSize: '14px',
  fontWeight: 'bold',
  color: '#d1d5db'
};

const zoomIconStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 'bold'
};

const zoomDisplayStyle: React.CSSProperties = {
  minWidth: '45px',
  textAlign: 'center',
  fontSize: '12px',
  fontWeight: '500',
  color: '#f3f4f6',
  margin: '0 4px'
};

const zoomResetStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: '500'
};

const actionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '4px'
};

const selectedActionStyle: React.CSSProperties = {
  backgroundColor: '#f3f4f6',
  borderColor: '#d1d5db'
};

const actionIconStyle: React.CSSProperties = {
  fontSize: '14px',
  marginBottom: '2px'
};

const actionLabelStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: '500'
};

const propertiesPanelStyle: React.CSSProperties = {
  position: 'absolute',
  top: '60px',
  left: '50%',
  transform: 'translateX(-50%)',
  width: '320px',
  backgroundColor: 'white',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: '#e0e0e0',
  borderRadius: '12px',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  padding: '16px',
  maxHeight: '400px',
  overflowY: 'auto'
};

const additionalToolsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '6px'
};

const additionalToolButtonStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '6px 4px',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: '#ddd',
  borderRadius: '4px',
  backgroundColor: 'white',
  cursor: 'pointer',
  transition: 'all 0.2s',
  fontSize: '10px'
};



const toggleButtonStyle: React.CSSProperties = {
  background: 'none',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: '#ddd',
  borderRadius: '4px',
  fontSize: '12px',
  cursor: 'pointer',
  padding: '4px 8px',
  transition: 'all 0.2s'
};

const contentStyle: React.CSSProperties = {
  padding: '16px'
};

const sectionStyle: React.CSSProperties = {
  marginBottom: '20px'
};

const labelStyle: React.CSSProperties = {
  fontWeight: 'bold',
  marginBottom: '8px',
  display: 'block',
  color: '#333'
};



const toolButtonStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '8px 4px',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: '#ddd',
  borderRadius: '4px',
  backgroundColor: 'white',
  cursor: 'pointer',
  transition: 'all 0.2s',
  fontSize: '12px'
};

const selectedToolStyle: React.CSSProperties = {
  backgroundColor: '#007bff',
  color: 'white',
  borderColor: '#007bff'
};

const toolIconStyle: React.CSSProperties = {
  fontSize: '16px',
  marginBottom: '2px'
};

const toolLabelStyle: React.CSSProperties = {
  fontSize: '10px'
};

const propertyGroupStyle: React.CSSProperties = {
  marginBottom: '12px'
};

const propertyLabelStyle: React.CSSProperties = {
  fontSize: '12px',
  marginBottom: '4px',
  display: 'block',
  color: '#555'
};

const colorGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: '4px'
};

const colorButtonStyle: React.CSSProperties = {
  width: '30px',
  height: '30px',
  borderWidth: '2px',
  borderStyle: 'solid',
  borderColor: '#ddd',
  borderRadius: '4px',
  cursor: 'pointer',
  transition: 'all 0.2s'
};

const selectedColorStyle: React.CSSProperties = {
  borderColor: '#007bff',
  transform: 'scale(1.1)'
};

const strokeGridStyle: React.CSSProperties = {
  display: 'flex',
  gap: '4px',
  flexWrap: 'wrap'
};

const strokeButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '40px',
  height: '30px',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: '#ddd',
  borderRadius: '4px',
  backgroundColor: 'white',
  cursor: 'pointer',
  transition: 'all 0.2s'
};

const selectedStrokeStyle: React.CSSProperties = {
  backgroundColor: '#007bff',
  borderColor: '#007bff'
};

const sliderStyle: React.CSSProperties = {
  width: '100%',
  marginTop: '4px'
};

const actionButtonsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px'
};

const actionButtonStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: '#4b5563',
  borderRadius: '4px',
  backgroundColor: '#374151',
  color: '#d1d5db',
  cursor: 'pointer',
  fontSize: '12px',
  transition: 'all 0.2s',
  flex: 1,
  textAlign: 'center'
};
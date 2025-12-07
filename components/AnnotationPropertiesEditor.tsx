import React, { useState, useEffect } from 'react';
import { Annotation, AnnotationProperties } from '../types/annotations';
import { selectionManager } from '../utils/selection';

interface AnnotationPropertiesEditorProps {
  selectedAnnotation: Annotation | null;
  onPropertyChange: (properties: Partial<AnnotationProperties>) => void;
  onClose: () => void;
}

export const AnnotationPropertiesEditor: React.FC<AnnotationPropertiesEditorProps> = ({
  selectedAnnotation,
  onPropertyChange,
  onClose
}) => {
  const [localProperties, setLocalProperties] = useState<Partial<AnnotationProperties>>({});

  useEffect(() => {
    if (selectedAnnotation) {
      setLocalProperties(selectedAnnotation.properties);
    }
  }, [selectedAnnotation]);

  if (!selectedAnnotation) return null;

  const capabilities = selectionManager.getEditCapabilities(selectedAnnotation.type);
  const props = selectedAnnotation.properties;

  const handlePropertyUpdate = (key: string, value: any) => {
    const newProperties = { ...localProperties, [key]: value };
    setLocalProperties(newProperties);
    onPropertyChange(newProperties);
  };

  const colors = [
    '#000000', '#FF0000', '#00FF00', '#0000FF',
    '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500',
    '#800080', '#008000', '#800000', '#008080'
  ];

  return (
    <div style={editorStyle}>
      <div style={headerStyle}>
        <h3 style={titleStyle}>Edit {selectedAnnotation.type} Annotation</h3>
        <button onClick={onClose} style={closeButtonStyle}>✕</button>
      </div>

      <div style={contentStyle}>
        {/* Color Selection */}
        {capabilities.canChangeColor && (
          <div style={sectionStyle}>
            <label style={labelStyle}>Color:</label>
            <div style={colorGridStyle}>
              {colors.map(color => (
                <button
                  key={color}
                  onClick={() => handlePropertyUpdate('color', color)}
                  style={{
                    ...colorButtonStyle,
                    backgroundColor: color,
                    ...(props.color === color ? selectedColorStyle : {})
                  }}
                  title={color}
                />
              ))}
            </div>
          </div>
        )}

        {/* Stroke Width */}
        {capabilities.canChangeStroke && props.strokeWidth !== undefined && (
          <div style={sectionStyle}>
            <label style={labelStyle}>
              Stroke Width: {props.strokeWidth}px
            </label>
            <input
              type="range"
              min="1"
              max="20"
              value={props.strokeWidth}
              onChange={(e) => handlePropertyUpdate('strokeWidth', parseInt(e.target.value))}
              style={sliderStyle}
            />
          </div>
        )}

        {/* Opacity */}
        {capabilities.canChangeOpacity && props.opacity !== undefined && (
          <div style={sectionStyle}>
            <label style={labelStyle}>
              Opacity: {Math.round(props.opacity * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={props.opacity}
              onChange={(e) => handlePropertyUpdate('opacity', parseFloat(e.target.value))}
              style={sliderStyle}
            />
          </div>
        )}

        {/* Text Content */}
        {capabilities.canEditText && props.text !== undefined && (
          <div style={sectionStyle}>
            <label style={labelStyle}>Text:</label>
            <textarea
              value={props.text}
              onChange={(e) => handlePropertyUpdate('text', e.target.value)}
              style={textareaStyle}
              placeholder="Enter text..."
              rows={3}
            />
          </div>
        )}

        {/* Font Size */}
        {capabilities.canEditText && props.fontSize !== undefined && (
          <div style={sectionStyle}>
            <label style={labelStyle}>
              Font Size: {props.fontSize}px
            </label>
            <input
              type="range"
              min="8"
              max="72"
              value={props.fontSize}
              onChange={(e) => handlePropertyUpdate('fontSize', parseInt(e.target.value))}
              style={sliderStyle}
            />
          </div>
        )}

        {/* Font Family */}
        {capabilities.canEditText && props.fontFamily !== undefined && (
          <div style={sectionStyle}>
            <label style={labelStyle}>Font Family:</label>
            <select
              value={props.fontFamily}
              onChange={(e) => handlePropertyUpdate('fontFamily', e.target.value)}
              style={selectStyle}
            >
              <option value="Arial">Arial</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Courier New">Courier New</option>
              <option value="Helvetica">Helvetica</option>
              <option value="Georgia">Georgia</option>
              <option value="Verdana">Verdana</option>
              <option value="Trebuchet MS">Trebuchet MS</option>
              <option value="Comic Sans MS">Comic Sans MS</option>
            </select>
          </div>
        )}

        {/* Font Weight and Style */}
        {capabilities.canEditText && (
          <div style={sectionStyle}>
            <label style={labelStyle}>Font Style:</label>
            <div style={fontStyleButtonsStyle}>
              <button
                onClick={() => handlePropertyUpdate('fontWeight', props.fontWeight === 'bold' ? 'normal' : 'bold')}
                style={{
                  ...styleButtonStyle,
                  ...(props.fontWeight === 'bold' ? activeStyleButtonStyle : {})
                }}
                title="Bold"
              >
                B
              </button>
              <button
                onClick={() => handlePropertyUpdate('fontStyle', props.fontStyle === 'italic' ? 'normal' : 'italic')}
                style={{
                  ...styleButtonStyle,
                  fontStyle: 'italic',
                  ...(props.fontStyle === 'italic' ? activeStyleButtonStyle : {})
                }}
                title="Italic"
              >
                I
              </button>
            </div>
          </div>
        )}

        {/* Text Alignment */}
        {capabilities.canEditText && (
          <div style={sectionStyle}>
            <label style={labelStyle}>Text Alignment:</label>
            <div style={alignmentButtonsStyle}>
              {(['left', 'center', 'right'] as const).map(alignment => (
                <button
                  key={alignment}
                  onClick={() => handlePropertyUpdate('textAlign', alignment)}
                  style={{
                    ...alignmentButtonStyle,
                    ...(props.textAlign === alignment ? activeAlignmentStyle : {})
                  }}
                  title={alignment}
                >
                  {alignment === 'left' ? '◀' : alignment === 'center' ? '▬' : '▶'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Line Height */}
        {capabilities.canEditText && props.lineHeight !== undefined && (
          <div style={sectionStyle}>
            <label style={labelStyle}>
              Line Height: {props.lineHeight?.toFixed(1) || '1.2'}
            </label>
            <input
              type="range"
              min="1"
              max="3"
              step="0.1"
              value={props.lineHeight || 1.2}
              onChange={(e) => handlePropertyUpdate('lineHeight', parseFloat(e.target.value))}
              style={sliderStyle}
            />
          </div>
        )}

        {/* Fill Color for Shapes */}
        {['rectangle', 'circle'].includes(selectedAnnotation.type) && (
          <div style={sectionStyle}>
            <label style={labelStyle}>Fill:</label>
            <div style={fillOptionsStyle}>
              <button
                onClick={() => handlePropertyUpdate('fillColor', 'transparent')}
                style={{
                  ...fillButtonStyle,
                  ...(props.fillColor === 'transparent' ? selectedFillStyle : {})
                }}
              >
                None
              </button>
              {colors.slice(0, 6).map(color => (
                <button
                  key={color}
                  onClick={() => handlePropertyUpdate('fillColor', color)}
                  style={{
                    ...colorButtonStyle,
                    backgroundColor: color,
                    ...(props.fillColor === color ? selectedColorStyle : {})
                  }}
                  title={`Fill: ${color}`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Annotation Info */}
        <div style={infoSectionStyle}>
          <div style={infoItemStyle}>
            <strong>Created:</strong> {new Date(selectedAnnotation.timestamp).toLocaleString()}
          </div>
          <div style={infoItemStyle}>
            <strong>Modified:</strong> {new Date(selectedAnnotation.lastModified).toLocaleString()}
          </div>
          <div style={infoItemStyle}>
            <strong>Type:</strong> {selectedAnnotation.type}
          </div>
        </div>
      </div>
    </div>
  );
};

// Styles
const editorStyle: React.CSSProperties = {
  position: 'fixed',
  top: '120px',
  right: '20px',
  width: '280px',
  backgroundColor: 'white',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: '#ccc',
  borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  zIndex: 1001,
  fontFamily: 'Arial, sans-serif',
  fontSize: '14px'
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  backgroundColor: '#f8f9fa',
  borderBottom: '1px solid #eee',
  borderRadius: '8px 8px 0 0'
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '16px',
  fontWeight: 'bold',
  color: '#333'
};

const closeButtonStyle: React.CSSProperties = {
  background: 'none',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: '#ddd',
  borderRadius: '50%',
  width: '24px',
  height: '24px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '12px',
  color: '#666'
};

const contentStyle: React.CSSProperties = {
  padding: '16px',
  maxHeight: '400px',
  overflowY: 'auto'
};

const sectionStyle: React.CSSProperties = {
  marginBottom: '16px'
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '6px',
  fontWeight: 'bold',
  fontSize: '12px',
  color: '#555'
};

const colorGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(6, 1fr)',
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

const sliderStyle: React.CSSProperties = {
  width: '100%',
  marginTop: '4px'
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: '#ddd',
  borderRadius: '4px',
  fontSize: '14px',
  fontFamily: 'Arial, sans-serif',
  resize: 'vertical'
};

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: '#ddd',
  borderRadius: '4px',
  fontSize: '14px',
  backgroundColor: 'white'
};

const fillOptionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '4px',
  alignItems: 'center'
};

const fillButtonStyle: React.CSSProperties = {
  padding: '4px 8px',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: '#ddd',
  borderRadius: '4px',
  backgroundColor: 'white',
  cursor: 'pointer',
  fontSize: '12px'
};

const selectedFillStyle: React.CSSProperties = {
  backgroundColor: '#007bff',
  color: 'white',
  borderColor: '#007bff'
};

const infoSectionStyle: React.CSSProperties = {
  marginTop: '16px',
  paddingTop: '12px',
  borderTop: '1px solid #eee'
};

const infoItemStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#666',
  marginBottom: '4px'
};

// Text formatting styles
const fontStyleButtonsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '4px'
};

const styleButtonStyle: React.CSSProperties = {
  width: '32px',
  height: '32px',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: '#ddd',
  borderRadius: '4px',
  backgroundColor: 'white',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 'bold',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.2s'
};

const activeStyleButtonStyle: React.CSSProperties = {
  backgroundColor: '#007bff',
  borderColor: '#007bff',
  color: 'white'
};

const alignmentButtonsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '4px'
};

const alignmentButtonStyle: React.CSSProperties = {
  width: '32px',
  height: '32px',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: '#ddd',
  borderRadius: '4px',
  backgroundColor: 'white',
  cursor: 'pointer',
  fontSize: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.2s'
};

const activeAlignmentStyle: React.CSSProperties = {
  backgroundColor: '#007bff',
  borderColor: '#007bff',
  color: 'white'
};
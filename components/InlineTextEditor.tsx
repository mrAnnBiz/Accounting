import React, { useState, useRef, useEffect } from 'react';
import { Annotation, AnnotationProperties } from '../types/annotations';

interface InlineTextEditorProps {
  annotation: Annotation;
  position: { x: number; y: number };
  onSave: (text: string, properties: Partial<AnnotationProperties>) => void;
  onCancel: () => void;
  initialText?: string;
}

export const InlineTextEditor: React.FC<InlineTextEditorProps> = ({
  annotation,
  position,
  onSave,
  onCancel,
  initialText = ''
}) => {
  const [text, setText] = useState(initialText || annotation?.properties?.text || '');
  const [fontSize, setFontSize] = useState(annotation?.properties?.fontSize || 14);
  const [fontFamily, setFontFamily] = useState(annotation?.properties?.fontFamily || 'Arial');
  const [color, setColor] = useState(annotation?.properties?.color || '#000000');
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, []);

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.max(32, textareaRef.current.scrollHeight) + 'px';
    }
  }, [text]);

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    } else if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'b':
          e.preventDefault();
          setIsBold(!isBold);
          break;
        case 'i':
          e.preventDefault();
          setIsItalic(!isItalic);
          break;
      }
    }
  };

  // Handle click outside to save
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        handleSave();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [text]);

  const handleSave = () => {
    if (text.trim()) {
      const updatedProperties: Partial<AnnotationProperties> = {
        text: text.trim(),
        fontSize,
        fontFamily,
        color,
        // Add font weight and style
        fontWeight: isBold ? 'bold' : 'normal',
        fontStyle: isItalic ? 'italic' : 'normal'
      };
      onSave(text.trim(), updatedProperties);
    } else {
      onCancel();
    }
  };

  const fontFamilies = [
    'Arial', 'Times New Roman', 'Helvetica', 'Courier New', 
    'Georgia', 'Verdana', 'Trebuchet MS', 'Comic Sans MS'
  ];

  const colors = [
    '#000000', '#FF0000', '#00FF00', '#0000FF',
    '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500',
    '#800080', '#008000', '#800000', '#008080'
  ];

  const getFontStyle = () => {
    return {
      fontSize: `${fontSize}px`,
      fontFamily: fontFamily,
      color: color,
      fontWeight: isBold ? 'bold' : 'normal',
      fontStyle: isItalic ? 'italic' : 'normal'
    };
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        zIndex: 2000,
        minWidth: '200px',
        maxWidth: '400px'
      }}
    >
      {/* Text Input */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          ...textInputStyle,
          ...getFontStyle(),
          width: '100%',
          minHeight: '32px',
          resize: 'none',
          overflow: 'hidden'
        }}
        placeholder="Enter text..."
      />

      {/* Formatting Controls */}
      <div style={controlsStyle}>
        {/* Font Size */}
        <div style={controlGroupStyle}>
          <input
            type="range"
            min="8"
            max="72"
            value={fontSize}
            onChange={(e) => setFontSize(parseInt(e.target.value))}
            style={sliderStyle}
            title={`Font Size: ${fontSize}px`}
          />
          <span style={labelStyle}>{fontSize}px</span>
        </div>

        {/* Font Family */}
        <select
          value={fontFamily}
          onChange={(e) => setFontFamily(e.target.value)}
          style={selectStyle}
        >
          {fontFamilies.map(font => (
            <option key={font} value={font}>{font}</option>
          ))}
        </select>

        {/* Text Formatting */}
        <div style={formatButtonsStyle}>
          <button
            onClick={() => setIsBold(!isBold)}
            style={{
              ...formatButtonStyle,
              ...(isBold ? activeFormatButtonStyle : {})
            }}
            title="Bold (Ctrl+B)"
          >
            B
          </button>
          <button
            onClick={() => setIsItalic(!isItalic)}
            style={{
              ...formatButtonStyle,
              ...(isItalic ? activeFormatButtonStyle : {})
            }}
            title="Italic (Ctrl+I)"
          >
            I
          </button>
        </div>

        {/* Color Picker */}
        <div style={colorPickerStyle}>
          {colors.slice(0, 6).map(clr => (
            <button
              key={clr}
              onClick={() => setColor(clr)}
              style={{
                ...colorButtonStyle,
                backgroundColor: clr,
                ...(color === clr ? selectedColorStyle : {})
              }}
              title={clr}
            />
          ))}
        </div>

        {/* Action Buttons */}
        <div style={actionButtonsStyle}>
          <button
            onClick={handleSave}
            style={saveButtonStyle}
            title="Save (Enter)"
          >
            ✓
          </button>
          <button
            onClick={onCancel}
            style={cancelButtonStyle}
            title="Cancel (Esc)"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Keyboard Shortcuts Help */}
      <div style={helpStyle}>
        Enter: Save • Esc: Cancel • Ctrl+B: Bold • Ctrl+I: Italic
      </div>
    </div>
  );
};

// Styles
const textInputStyle: React.CSSProperties = {
  borderWidth: '2px',
  borderStyle: 'solid',
  borderColor: '#2563eb',
  borderRadius: '4px',
  padding: '8px',
  outline: 'none',
  backgroundColor: 'white',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
};

const controlsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  backgroundColor: 'white',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: '#e0e0e0',
  borderRadius: '0 0 8px 8px',
  padding: '8px',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  flexWrap: 'wrap'
};

const controlGroupStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px'
};

const sliderStyle: React.CSSProperties = {
  width: '60px'
};

const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#666',
  minWidth: '30px'
};

const selectStyle: React.CSSProperties = {
  fontSize: '11px',
  padding: '2px 4px',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: '#ddd',
  borderRadius: '3px',
  backgroundColor: 'white'
};

const formatButtonsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '2px'
};

const formatButtonStyle: React.CSSProperties = {
  width: '24px',
  height: '24px',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: '#ddd',
  borderRadius: '3px',
  backgroundColor: 'white',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: 'bold',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const activeFormatButtonStyle: React.CSSProperties = {
  backgroundColor: '#2563eb',
  borderColor: '#2563eb',
  color: 'white'
};

const colorPickerStyle: React.CSSProperties = {
  display: 'flex',
  gap: '2px'
};

const colorButtonStyle: React.CSSProperties = {
  width: '20px',
  height: '20px',
  borderWidth: '2px',
  borderStyle: 'solid',
  borderColor: '#ddd',
  borderRadius: '3px',
  cursor: 'pointer'
};

const selectedColorStyle: React.CSSProperties = {
  borderColor: '#2563eb',
  transform: 'scale(1.1)'
};

const actionButtonsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '4px',
  marginLeft: 'auto'
};

const saveButtonStyle: React.CSSProperties = {
  width: '28px',
  height: '24px',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: '#22c55e',
  borderRadius: '3px',
  backgroundColor: '#22c55e',
  color: 'white',
  cursor: 'pointer',
  fontSize: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const cancelButtonStyle: React.CSSProperties = {
  width: '28px',
  height: '24px',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: '#ef4444',
  borderRadius: '3px',
  backgroundColor: '#ef4444',
  color: 'white',
  cursor: 'pointer',
  fontSize: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const helpStyle: React.CSSProperties = {
  fontSize: '10px',
  color: '#666',
  textAlign: 'center',
  marginTop: '4px',
  padding: '4px',
  backgroundColor: '#f8f9fa',
  borderRadius: '4px'
};
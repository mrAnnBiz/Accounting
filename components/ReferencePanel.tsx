'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, X } from 'lucide-react';

interface ReferencePanelProps {
  linkedMarkingScheme: string | null;
  linkedInsertPaper: string | null;
  isOpen: boolean;
  onToggle?: () => void;
  onClose?: () => void;
  onMarkingSchemeChange?: (scheme: string | null) => void;
  onInsertPaperChange?: (paper: string | null) => void;
}

export default function ReferencePanel({
  linkedMarkingScheme,
  linkedInsertPaper,
  isOpen,
  onToggle,
  onClose,
  onMarkingSchemeChange,
  onInsertPaperChange,
}: ReferencePanelProps) {
  const [activeTab, setActiveTab] = useState<'ms' | 'ip'>('ms');
  const [panelWidth, setPanelWidth] = useState(384); // Default w-96 = 384px
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  // Load saved panel width on mount
  useEffect(() => {
    const savedWidth = localStorage.getItem('referencePanelWidth');
    if (savedWidth) {
      setPanelWidth(parseInt(savedWidth));
    }
  }, []);

  // Handle mouse resize - proper click+hold+drag
  useEffect(() => {
    const handle = resizeHandleRef.current;
    if (!handle) return;

    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      startXRef.current = e.clientX;
      startWidthRef.current = panelWidth;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const deltaX = startXRef.current - e.clientX;
      const newWidth = startWidthRef.current + deltaX;
      const clampedWidth = Math.max(300, Math.min(800, newWidth));
      setPanelWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      if (!isResizing) return;
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem('referencePanelWidth', panelWidth.toString());
    };

    handle.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      handle.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, panelWidth]);

  // Handle touch resize - touch+drag for touchscreen
  useEffect(() => {
    const handle = resizeHandleRef.current;
    if (!handle) return;

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const touch = e.touches[0];
      setIsResizing(true);
      startXRef.current = touch.clientX;
      startWidthRef.current = panelWidth;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isResizing || e.touches.length === 0) return;
      e.preventDefault();
      
      const touch = e.touches[0];
      const deltaX = startXRef.current - touch.clientX;
      const newWidth = startWidthRef.current + deltaX;
      const clampedWidth = Math.max(300, Math.min(800, newWidth));
      setPanelWidth(clampedWidth);
    };

    const handleTouchEnd = () => {
      if (!isResizing) return;
      setIsResizing(false);
      localStorage.setItem('referencePanelWidth', panelWidth.toString());
    };

    handle.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      handle.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isResizing, panelWidth]);

  const pdfUrl =
    activeTab === 'ms' && linkedMarkingScheme
      ? `/past-papers/${linkedMarkingScheme}`
      : activeTab === 'ip' && linkedInsertPaper
      ? `/past-papers/${linkedInsertPaper}`
      : null;

  return (
    <>
      {/* Toggle button (fixed on right side) */}
      <button
        onClick={onClose || onToggle}
        className="fixed right-0 top-36 z-30 bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-l transition"
        title={isOpen ? 'Close panel' : 'Open reference'}
      >
        <ChevronLeft size={20} style={{ transform: isOpen ? 'rotateY(180deg)' : 'none' }} />
      </button>

      {/* Slide-out panel */}
      <div
        ref={panelRef}
        className={`fixed right-0 top-16 bottom-0 bg-white border-l border-gray-300 shadow-lg transition-all duration-300 z-25 flex flex-col overflow-hidden ${
          isOpen ? '' : 'w-0'
        }`}
        style={{
          width: isOpen ? `${panelWidth}px` : '0px',
        }}
      >
        {/* Resize handle - wider touch target */}
        <div
          ref={resizeHandleRef}
          className={`absolute left-0 top-0 bottom-0 w-3 bg-transparent hover:bg-blue-500/30 cursor-col-resize transition touch-none ${
            isResizing ? 'bg-blue-500/50' : ''
          }`}
          title="Drag to resize panel"
        >
          {/* Visual indicator line */}
          <div className={`absolute left-0 top-0 bottom-0 w-1 ${isResizing ? 'bg-blue-500' : 'bg-gray-300'}`} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 ml-3">
          <h3 className="font-semibold text-gray-800">Reference</h3>
          <button
            onClick={onClose || onToggle}
            className="p-1 hover:bg-gray-100 rounded transition"
          >
            <X size={18} className="text-gray-600" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-3 border-b border-gray-200 bg-gray-50 ml-3">
          <button
            onClick={() => setActiveTab('ms')}
            className={`flex-1 px-3 py-2 rounded font-medium transition ${
              activeTab === 'ms'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            📋 Marking Scheme
          </button>
          <button
            onClick={() => setActiveTab('ip')}
            className={`flex-1 px-3 py-2 rounded font-medium transition ${
              activeTab === 'ip'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            📄 Insert Paper
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto ml-3">
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="w-full h-full border-none"
              title={activeTab === 'ms' ? 'Marking Scheme' : 'Insert Paper'}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              {activeTab === 'ms' && linkedMarkingScheme === null
                ? 'No marking scheme available'
                : activeTab === 'ip' && linkedInsertPaper === null
                ? 'No insert paper available'
                : 'Loading...'}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

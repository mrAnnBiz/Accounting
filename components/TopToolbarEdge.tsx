'use client';

import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Home,
  Menu,
  Activity,
} from 'lucide-react';
import { AnnotationTool } from '../types/annotations';

interface TopToolbarEdgeProps {
  displayPageNum: number;
  totalPages: number;
  zoom: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onGoToPage: (page: number) => void;
  onTogglePanel: () => void;
  onTogglePerformance?: () => void;
  showPerformanceMonitor?: boolean;
  selectedTool?: AnnotationTool;
  onToolSelect?: (tool: AnnotationTool) => void;
  isAnnotationMode?: boolean;
  onToggleAnnotationMode?: () => void;
}

export default function TopToolbarEdge({
  displayPageNum,
  totalPages,
  zoom,
  onPrevPage,
  onNextPage,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onGoToPage,
  onTogglePanel,
  onTogglePerformance,
  showPerformanceMonitor = false,
  selectedTool = 'pen',
  onToolSelect,
  isAnnotationMode = false,
  onToggleAnnotationMode,
}: TopToolbarEdgeProps) {
  const [showPageInput, setShowPageInput] = useState(false);
  const [pageInputValue, setPageInputValue] = useState('');

  const handlePageInputSubmit = () => {
    const pageNum = parseInt(pageInputValue);
    if (pageNum >= 1 && pageNum <= totalPages) {
      onGoToPage(pageNum);
    }
    setShowPageInput(false);
    setPageInputValue('');
  };

  const handlePageInputKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handlePageInputSubmit();
    } else if (e.key === 'Escape') {
      setShowPageInput(false);
      setPageInputValue('');
    }
  };

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      <div className="flex items-center justify-between px-3 py-1.5 gap-2 flex-wrap">
        {/* Left: Navigation Controls */}
        <div className="flex items-center space-x-3">
          {/* Previous Page */}
          <button
            onClick={onPrevPage}
            disabled={displayPageNum <= 1}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Previous Page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {/* Page Navigation */}
          <div className="flex items-center space-x-2">
            {showPageInput ? (
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  value={pageInputValue}
                  onChange={(e) => setPageInputValue(e.target.value)}
                  onKeyDown={handlePageInputKeyPress}
                  onBlur={handlePageInputSubmit}
                  className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                  min="1"
                  max={totalPages}
                  autoFocus
                />
                <span className="text-sm text-gray-600">of {totalPages}</span>
              </div>
            ) : (
              <button
                onClick={() => {
                  setShowPageInput(true);
                  setPageInputValue(displayPageNum.toString());
                }}
                className="px-3 py-1 text-sm border border-gray-200 rounded hover:bg-gray-50 transition-colors"
                title="Click to go to page"
              >
                Page {displayPageNum} of {totalPages}
              </button>
            )}
          </div>

          {/* Next Page */}
          <button
            onClick={onNextPage}
            disabled={displayPageNum >= totalPages}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Next Page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Center: Zoom Controls */}
        <div className="flex items-center space-x-1">
          <button
            onClick={onZoomOut}
            disabled={zoom <= 50}
            className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Zoom Out"
          >
            <ZoomIn className="h-3 w-3 rotate-180" />
          </button>

          <button
            onClick={onResetZoom}
            className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 transition-colors min-w-[50px]"
            title="Reset Zoom"
          >
            {zoom}%
          </button>

          <button
            onClick={onZoomIn}
            disabled={zoom >= 200}
            className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="h-3 w-3" />
          </button>
        </div>

        {/* Center-Right: Annotation Tools (when in annotation mode) */}
        {isAnnotationMode && onToolSelect && (
          <div className="flex items-center space-x-1 border-l border-gray-200 pl-2">
            {(['pen', 'highlighter', 'eraser', 'rectangle', 'circle', 'arrow', 'text'] as AnnotationTool[]).map(tool => {
              const toolIcons: Record<string, string> = {
                pen: '✎', highlighter: '▍', eraser: '⌫', rectangle: '▢',
                circle: '○', arrow: '↗', line: '╱', text: 'T'
              };
              return (
                <button
                  key={tool}
                  onClick={() => onToolSelect(tool)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    selectedTool === tool
                      ? 'bg-blue-100 border border-blue-400 text-blue-600'
                      : 'border border-gray-200 hover:bg-gray-50'
                  }`}
                  title={tool.charAt(0).toUpperCase() + tool.slice(1)}
                >
                  {toolIcons[tool]}
                </button>
              );
            })}
          </div>
        )}

        {/* Right: Additional Controls */}
        <div className="flex items-center space-x-1 border-l border-gray-200 pl-2">
          {onTogglePerformance && (
            <button
              onClick={onTogglePerformance}
              className={`p-1.5 rounded border border-gray-200 hover:bg-gray-50 transition-colors ${
                showPerformanceMonitor ? 'bg-blue-100 border-blue-300 text-blue-600' : ''
              }`}
              title="Toggle Performance Monitor"
            >
              <Activity className="h-3 w-3" />
            </button>
          )}
          <button
            onClick={onTogglePanel}
            className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 transition-colors"
            title="Toggle Reference Panel"
          >
            <Menu className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

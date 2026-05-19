import React, { useState, useEffect, useRef } from 'react';
import AnnotationCache from '@/utils/annotationCache';
import { MemoryManager } from '@/utils/canvasOptimization';

/**
 * Performance monitoring component for Phase 4 optimizations
 * Tracks FPS, memory usage, cache statistics, and render performance
 */

interface PerformanceStats {
  fps: number;
  memoryUsage: number;
  cacheHitRate: number;
  visiblePages: number;
  totalAnnotations: number;
  renderTime: number;
  lastUpdate: number;
}

interface PerformanceMonitorProps {
  cache: AnnotationCache;
  visiblePages: number[];
  totalAnnotations: number;
  isVisible?: boolean;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  cache,
  visiblePages = [],
  totalAnnotations = 0,
  isVisible = false
}) => {
  const [stats, setStats] = useState<PerformanceStats>({
    fps: 0,
    memoryUsage: 0,
    cacheHitRate: 0,
    visiblePages: 0,
    totalAnnotations: 0,
    renderTime: 0,
    lastUpdate: Date.now()
  });
  
  const [isExpanded, setIsExpanded] = useState(false);
  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef(performance.now());
  const renderStartRef = useRef(0);

  // FPS monitoring
  useEffect(() => {
    let animationFrame: number;
    
    const updateFPS = () => {
      frameCountRef.current++;
      const now = performance.now();
      
      if (now - lastFrameTimeRef.current >= 1000) {
        const fps = frameCountRef.current;
        frameCountRef.current = 0;
        lastFrameTimeRef.current = now;
        
        setStats(prev => ({
          ...prev,
          fps,
          lastUpdate: now
        }));
      }
      
      animationFrame = requestAnimationFrame(updateFPS);
    };
    
    animationFrame = requestAnimationFrame(updateFPS);
    
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  // Performance stats monitoring
  useEffect(() => {
    const interval = setInterval(() => {
      const cacheStats = cache.getStats();
      const renderEndTime = performance.now();
      const renderTime = renderStartRef.current > 0 ? renderEndTime - renderStartRef.current : 0;
      
      // Memory usage estimation
      let memoryUsage = 0;
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        memoryUsage = memory.usedJSHeapSize / 1048576; // Convert to MB
      }
      
      setStats(prev => ({
        ...prev,
        memoryUsage,
        cacheHitRate: cacheStats.hitRate * 100,
        visiblePages: visiblePages.length,
        totalAnnotations,
        renderTime,
        lastUpdate: Date.now()
      }));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [cache, visiblePages.length, totalAnnotations]);

  // Track render start time
  const trackRenderStart = () => {
    renderStartRef.current = performance.now();
  };

  useEffect(() => {
    trackRenderStart();
  });

  if (!isVisible) return null;

  return (
    <div className="performance-monitor">
      <button
        className="performance-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        📊 Performance {isExpanded ? '▼' : '▶'}
      </button>
      
      {isExpanded && (
        <div className="performance-details">
          <div className="performance-grid">
            <div className="stat-group">
              <h4>Rendering</h4>
              <div className="stat-item">
                <span className="stat-label">FPS:</span>
                <span className={`stat-value ${getFPSClass(stats.fps)}`}>
                  {stats.fps}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Render Time:</span>
                <span className="stat-value">
                  {stats.renderTime.toFixed(1)}ms
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Visible Pages:</span>
                <span className="stat-value">
                  {stats.visiblePages}
                </span>
              </div>
            </div>
            
            <div className="stat-group">
              <h4>Memory</h4>
              <div className="stat-item">
                <span className="stat-label">Usage:</span>
                <span className={`stat-value ${getMemoryClass(stats.memoryUsage)}`}>
                  {stats.memoryUsage.toFixed(1)}MB
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Annotations:</span>
                <span className="stat-value">
                  {stats.totalAnnotations}
                </span>
              </div>
            </div>
            
            <div className="stat-group">
              <h4>Cache</h4>
              <div className="stat-item">
                <span className="stat-label">Hit Rate:</span>
                <span className={`stat-value ${getCacheClass(stats.cacheHitRate)}`}>
                  {stats.cacheHitRate.toFixed(1)}%
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Cache Size:</span>
                <span className="stat-value">
                  {cache.getStats().size}
                </span>
              </div>
            </div>
          </div>
          
          <div className="performance-actions">
            <button
              className="action-button"
              onClick={() => {
                cache.clear();
                MemoryManager.forceCleanup();
              }}
            >
              🗑️ Clear Cache
            </button>
            <button
              className="action-button"
              onClick={() => {
                if ('gc' in window) {
                  (window as any).gc();
                }
              }}
            >
              🔄 Force GC
            </button>
          </div>
        </div>
      )}
      
      <style jsx>{`
        .performance-monitor {
          position: fixed;
          top: 100px;
          right: 20px;
          background: rgba(0, 0, 0, 0.9);
          color: white;
          padding: 10px;
          border-radius: 8px;
          font-family: monospace;
          font-size: 12px;
          z-index: 1000;
          min-width: 200px;
        }
        
        .performance-toggle {
          background: transparent;
          border: 1px solid #666;
          color: white;
          padding: 5px 10px;
          border-radius: 4px;
          cursor: pointer;
          width: 100%;
          text-align: left;
        }
        
        .performance-toggle:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        
        .performance-details {
          margin-top: 10px;
        }
        
        .performance-grid {
          display: grid;
          gap: 15px;
        }
        
        .stat-group h4 {
          margin: 0 0 8px 0;
          color: #aaa;
          border-bottom: 1px solid #444;
          padding-bottom: 4px;
        }
        
        .stat-item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
        }
        
        .stat-label {
          color: #ccc;
        }
        
        .stat-value {
          font-weight: bold;
        }
        
        .stat-value.good {
          color: #4ade80;
        }
        
        .stat-value.warning {
          color: #fbbf24;
        }
        
        .stat-value.bad {
          color: #f87171;
        }
        
        .performance-actions {
          margin-top: 15px;
          display: flex;
          gap: 10px;
        }
        
        .action-button {
          background: #374151;
          border: 1px solid #6b7280;
          color: white;
          padding: 5px 8px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 11px;
        }
        
        .action-button:hover {
          background: #4b5563;
        }
      `}</style>
    </div>
  );
};

// Utility functions for color coding stats
function getFPSClass(fps: number): string {
  if (fps >= 50) return 'good';
  if (fps >= 30) return 'warning';
  return 'bad';
}

function getMemoryClass(memory: number): string {
  if (memory < 50) return 'good';
  if (memory < 100) return 'warning';
  return 'bad';
}

function getCacheClass(hitRate: number): string {
  if (hitRate >= 80) return 'good';
  if (hitRate >= 60) return 'warning';
  return 'bad';
}

/**
 * Lightweight performance indicator for production
 */
export const PerformanceIndicator: React.FC<{
  fps: number;
  memoryUsage: number;
  cacheHitRate: number;
}> = ({ fps, memoryUsage, cacheHitRate }) => {
  const getIndicatorColor = () => {
    const fpsGood = fps >= 30;
    const memoryGood = memoryUsage < 100;
    const cacheGood = cacheHitRate >= 60;
    
    if (fpsGood && memoryGood && cacheGood) return '#4ade80';
    if (!fpsGood || !memoryGood || !cacheGood) return '#fbbf24';
    return '#f87171';
  };

  return (
    <div
      className="performance-indicator"
      title={`FPS: ${fps}, Memory: ${memoryUsage.toFixed(1)}MB, Cache: ${cacheHitRate.toFixed(1)}%`}
      style={{
        position: 'fixed',
        top: '80px',
        right: '20px',
        width: '12px',
        height: '12px',
        borderRadius: '50%',
        backgroundColor: getIndicatorColor(),
        zIndex: 1000,
        boxShadow: '0 0 8px rgba(0,0,0,0.3)'
      }}
    />
  );
};

export default PerformanceMonitor;
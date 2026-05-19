import React, { useCallback, useRef, useState, useEffect } from 'react';

/**
 * Mobile touch gesture handler for PDF annotation system
 * Handles multi-touch gestures, zoom, pan, and palm rejection
 */

export interface TouchGesture {
  type: 'tap' | 'double-tap' | 'pinch' | 'pan' | 'long-press';
  startPoint: { x: number; y: number };
  currentPoint: { x: number; y: number };
  scale?: number;
  rotation?: number;
  velocity?: { x: number; y: number };
  touches: number;
}

interface TouchGestureHandlerProps {
  onGesture: (gesture: TouchGesture) => void;
  onAnnotationTouch?: (point: { x: number; y: number }, pressure: number) => void;
  enablePalmRejection?: boolean;
  enableAnnotationMode?: boolean;
  children: React.ReactNode;
}

interface TouchState {
  touches: TouchList | null;
  startTime: number;
  lastTouchTime: number;
  startDistance: number;
  lastScale: number;
  startPoints: { x: number; y: number }[];
  isAnnotating: boolean;
  palmRejected: boolean;
}

export const TouchGestureHandler: React.FC<TouchGestureHandlerProps> = ({
  onGesture,
  onAnnotationTouch,
  enablePalmRejection = true,
  enableAnnotationMode = false,
  children
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStateRef = useRef<TouchState>({
    touches: null,
    startTime: 0,
    lastTouchTime: 0,
    startDistance: 0,
    lastScale: 1,
    startPoints: [],
    isAnnotating: false,
    palmRejected: false
  });
  
  const [isGestureActive, setIsGestureActive] = useState(false);
  const [palmDetected, setPalmDetected] = useState(false);

  // Palm rejection algorithm
  const detectPalmTouch = useCallback((touch: Touch): boolean => {
    if (!enablePalmRejection) return false;
    
    // Check for large touch area (palm typically has larger contact area)
    const touchArea = (touch as any).radiusX ? 
      Math.PI * (touch as any).radiusX * (touch as any).radiusY : 0;
    
    // Palm rejection based on touch size and force
    const isPalmSize = touchArea > 150; // Adjust threshold based on testing
    const isPalmForce = (touch as any).force && (touch as any).force > 0.8;
    
    return isPalmSize || isPalmForce;
  }, [enablePalmRejection]);

  // Calculate distance between two touch points
  const getTouchDistance = useCallback((touches: TouchList): number => {
    if (touches.length < 2) return 0;
    
    const touch1 = touches[0];
    const touch2 = touches[1];
    
    return Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) +
      Math.pow(touch2.clientY - touch1.clientY, 2)
    );
  }, []);

  // Get center point of multiple touches
  const getTouchCenter = useCallback((touches: TouchList): { x: number; y: number } => {
    if (touches.length === 0) return { x: 0, y: 0 };
    
    let x = 0;
    let y = 0;
    
    for (let i = 0; i < touches.length; i++) {
      x += touches[i].clientX;
      y += touches[i].clientY;
    }
    
    return {
      x: x / touches.length,
      y: y / touches.length
    };
  }, []);

  // Handle touch start
  const handleTouchStart = useCallback((e: TouchEvent) => {
    e.preventDefault();
    
    const touches = e.touches;
    const currentTime = Date.now();
    
    // Palm rejection check
    const hasPalm = Array.from(touches).some(touch => detectPalmTouch(touch));
    if (hasPalm) {
      setPalmDetected(true);
      touchStateRef.current.palmRejected = true;
      return;
    }
    
    setPalmDetected(false);
    touchStateRef.current.palmRejected = false;
    
    const touchState = touchStateRef.current;
    touchState.touches = touches;
    touchState.startTime = currentTime;
    touchState.lastTouchTime = currentTime;
    touchState.startDistance = getTouchDistance(touches);
    touchState.lastScale = 1;
    touchState.startPoints = Array.from(touches).map(touch => ({
      x: touch.clientX,
      y: touch.clientY
    }));
    
    setIsGestureActive(true);
    
    // Single touch - potential annotation or tap
    if (touches.length === 1 && enableAnnotationMode) {
      touchState.isAnnotating = true;
      const touch = touches[0];
      onAnnotationTouch?.({
        x: touch.clientX,
        y: touch.clientY
      }, (touch as any).force || 0.5);
    }
  }, [detectPalmTouch, getTouchDistance, onAnnotationTouch, enableAnnotationMode]);

  // Handle touch move
  const handleTouchMove = useCallback((e: TouchEvent) => {
    e.preventDefault();
    
    const touchState = touchStateRef.current;
    if (touchState.palmRejected) return;
    
    const touches = e.touches;
    const currentTime = Date.now();
    
    // Continue annotation drawing for single touch
    if (touches.length === 1 && touchState.isAnnotating && enableAnnotationMode) {
      const touch = touches[0];
      onAnnotationTouch?.({
        x: touch.clientX,
        y: touch.clientY
      }, (touch as any).force || 0.5);
      return;
    }
    
    // Multi-touch gestures
    if (touches.length >= 2) {
      touchState.isAnnotating = false;
      
      const currentDistance = getTouchDistance(touches);
      const currentCenter = getTouchCenter(touches);
      const startCenter = getTouchCenter({
        length: touchState.startPoints.length,
        0: { clientX: touchState.startPoints[0]?.x || 0, clientY: touchState.startPoints[0]?.y || 0 },
        1: { clientX: touchState.startPoints[1]?.x || 0, clientY: touchState.startPoints[1]?.y || 0 }
      } as any);
      
      // Pinch to zoom
      if (currentDistance > 0 && touchState.startDistance > 0) {
        const scale = currentDistance / touchState.startDistance;
        
        onGesture({
          type: 'pinch',
          startPoint: startCenter,
          currentPoint: currentCenter,
          scale: scale,
          touches: touches.length
        });
        
        touchState.lastScale = scale;
      }
    }
    
    touchState.lastTouchTime = currentTime;
  }, [getTouchDistance, getTouchCenter, onGesture, onAnnotationTouch, enableAnnotationMode]);

  // Handle touch end
  const handleTouchEnd = useCallback((e: TouchEvent) => {
    e.preventDefault();
    
    const touchState = touchStateRef.current;
    if (touchState.palmRejected) {
      touchStateRef.current.palmRejected = false;
      setPalmDetected(false);
      return;
    }
    
    const currentTime = Date.now();
    const duration = currentTime - touchState.startTime;
    const remainingTouches = e.touches.length;
    
    // End annotation drawing
    if (touchState.isAnnotating) {
      touchState.isAnnotating = false;
    }
    
    // Detect gesture types based on duration and touches
    if (remainingTouches === 0) {
      setIsGestureActive(false);
      
      const startPoint = touchState.startPoints[0] || { x: 0, y: 0 };
      const lastTouch = e.changedTouches[0];
      const currentPoint = {
        x: lastTouch.clientX,
        y: lastTouch.clientY
      };
      
      // Long press detection
      if (duration > 500) {
        onGesture({
          type: 'long-press',
          startPoint,
          currentPoint,
          touches: 1
        });
      }
      // Double tap detection (simplified)
      else if (duration < 300) {
        onGesture({
          type: 'tap',
          startPoint,
          currentPoint,
          touches: 1
        });
      }
    }
    
    // Reset touch state if no touches remaining
    if (remainingTouches === 0) {
      touchState.touches = null;
      touchState.startPoints = [];
    }
  }, [onGesture]);

  // Set up event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: false });
    
    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return (
    <div 
      ref={containerRef}
      className={`touch-gesture-handler ${isGestureActive ? 'gesture-active' : ''} ${palmDetected ? 'palm-detected' : ''}`}
      style={{
        touchAction: 'none', // Prevent default browser touch handling
        userSelect: 'none'
      }}
    >
      {children}
      
      {/* Visual feedback for gestures */}
      {palmDetected && (
        <div className="palm-rejection-indicator">
          <div className="palm-warning">
            Palm detected - Touch ignored
          </div>
        </div>
      )}
      
      {isGestureActive && (
        <div className="gesture-indicator">
          <div className="gesture-feedback">
            Touch gesture active
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Hook for managing mobile-specific settings
 */
export const useMobileOptimization = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
      const isMobileWidth = width <= 768;
      
      setIsMobile(isMobileUA || isMobileWidth);
      setIsTablet(width >= 768 && width <= 1024);
      setOrientation(width > height ? 'landscape' : 'portrait');
    };
    
    checkMobile();
    
    window.addEventListener('resize', checkMobile);
    window.addEventListener('orientationchange', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('orientationchange', checkMobile);
    };
  }, []);
  
  return {
    isMobile,
    isTablet,
    orientation,
    isTouch: 'ontouchstart' in window
  };
};

/**
 * Mobile performance optimization utilities
 */
export const MobileOptimizer = {
  /**
   * Optimize canvas for mobile devices
   */
  optimizeCanvasForMobile: (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Reduce canvas resolution on mobile for better performance
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    
    canvas.style.width = canvas.width + 'px';
    canvas.style.height = canvas.height + 'px';
    
    canvas.width *= pixelRatio;
    canvas.height *= pixelRatio;
    
    ctx.scale(pixelRatio, pixelRatio);
    
    // Optimize rendering settings
    ctx.imageSmoothingEnabled = false; // Faster rendering
    ctx.globalCompositeOperation = 'source-over';
  },
  
  /**
   * Debounce touch events for better performance
   */
  createTouchDebouncer: (callback: Function, delay: number = 16) => {
    let timeoutId: NodeJS.Timeout;
    let lastCall = 0;
    
    return (...args: any[]) => {
      const now = Date.now();
      
      if (now - lastCall >= delay) {
        callback.apply(null, args);
        lastCall = now;
      } else {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          callback.apply(null, args);
          lastCall = Date.now();
        }, delay - (now - lastCall));
      }
    };
  },
  
  /**
   * Enable hardware acceleration
   */
  enableHardwareAcceleration: (element: HTMLElement) => {
    element.style.transform = 'translateZ(0)';
    element.style.willChange = 'transform';
  }
};

export default TouchGestureHandler;
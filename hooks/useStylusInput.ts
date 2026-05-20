'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

const LONG_PRESS_THRESHOLD_MS = 500;

interface UseStylusInputOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function useStylusInput({ containerRef }: UseStylusInputOptions) {
  const [isStylus, setIsStylus] = useState(false);
  const [lastTouchPoint, setLastTouchPoint] = useState({ x: 0, y: 0, time: 0 });
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartTimeRef = useRef<number>(0);

  const detectStylusInput = useCallback((event: PointerEvent | TouchEvent) => {
    if ('pointerType' in event) {
      return (event as PointerEvent).pointerType === 'pen';
    } else if ('touches' in event) {
      const touchEvent = event as TouchEvent;
      if (touchEvent.touches.length > 0) {
        const touch = touchEvent.touches[0];
        return (touch as any).force !== undefined && (touch as any).force > 0.5;
      }
    }
    return false;
  }, []);

  const handlePointerDown = useCallback((event: PointerEvent | TouchEvent) => {
    const isStylusInput = detectStylusInput(event);
    setIsStylus(isStylusInput);
    touchStartTimeRef.current = Date.now();

    let x = 0, y = 0;
    if ('touches' in event && event.touches.length > 0) {
      x = event.touches[0].clientX;
      y = event.touches[0].clientY;
    } else if ('clientX' in event) {
      x = (event as PointerEvent).clientX;
      y = (event as PointerEvent).clientY;
    }

    setLastTouchPoint({ x, y, time: Date.now() });

    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
    }

    if (isStylusInput) {
      longPressTimeoutRef.current = setTimeout(() => {
        // Long press on stylus — handled by annotation system
      }, LONG_PRESS_THRESHOLD_MS);
    }
  }, [detectStylusInput]);

  const handlePointerUp = useCallback(() => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    setIsStylus(false);
  }, []);

  const handlePointerMove = useCallback((event: PointerEvent | TouchEvent) => {
    let x = 0, y = 0;
    if ('touches' in event && event.touches.length > 0) {
      x = event.touches[0].clientX;
      y = event.touches[0].clientY;
    } else if ('clientX' in event) {
      x = (event as PointerEvent).clientX;
      y = (event as PointerEvent).clientY;
    }

    setLastTouchPoint({ x, y, time: Date.now() });
  }, []);

  // Attach/detach pointer events on the container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleContextMenu = (e: Event) => {
      if (isStylus) e.preventDefault();
    };

    const handleTouchMove = (_e: TouchEvent) => {
      // Allow default scrolling behavior
    };

    container.addEventListener('contextmenu', handleContextMenu);
    container.addEventListener('pointerdown', handlePointerDown as any);
    container.addEventListener('pointermove', handlePointerMove as any);
    container.addEventListener('pointerup', handlePointerUp);
    container.addEventListener('touchmove', handleTouchMove);

    return () => {
      container.removeEventListener('contextmenu', handleContextMenu);
      container.removeEventListener('pointerdown', handlePointerDown as any);
      container.removeEventListener('pointermove', handlePointerMove as any);
      container.removeEventListener('pointerup', handlePointerUp);
      container.removeEventListener('touchmove', handleTouchMove);
    };
  }, [containerRef, isStylus, handlePointerDown, handlePointerUp, handlePointerMove]);

  return { isStylus };
}

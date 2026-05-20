/**
 * Device Detector — Standalone module
 * Extracted from EnhancedPDFViewerScrollable.tsx (A1)
 * 
 * Detects device type, capabilities, and interaction preferences.
 */

export type DeviceType = 'desktop' | 'ipad' | 'tablet' | 'mobile' | 'hybrid';
export type PointerType = 'mouse' | 'touch' | 'pen' | 'unknown';

export interface DeviceCapabilities {
  device: DeviceType;
  pointerType: PointerType;
  screenSize: { width: number; height: number };
  pixelRatio: number;
  touchEnabled: boolean;
  isPressureSensitive: boolean;
  supportsGestures: boolean;
  supportsHover: boolean;
  supportsKeyboard: boolean;
  stylusDetectionEnabled: boolean;
  palmRejectionEnabled: boolean;
  maxTouchPoints: number;
}

export class DeviceDetector {
  private static cache: DeviceCapabilities | null = null;

  static detectDevice(): DeviceType {
    if (typeof window === 'undefined') return 'desktop';

    const ua = navigator.userAgent.toLowerCase();
    const isIpad = /ipad/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (isIpad) return 'ipad';

    const isMobile = /android.*mobile|iphone|ipod|blackberry|opera mini|iemobile/i.test(ua);
    if (isMobile) return 'mobile';

    const isTablet = /android(?!.*mobile)|tablet/i.test(ua);
    if (isTablet) return 'tablet';

    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const hasFinePointer = window.matchMedia('(pointer:fine)').matches;
    if (hasTouch && hasFinePointer) return 'hybrid'; // Surface-like device

    return 'desktop';
  }

  static getScreenSize(): { width: number; height: number } {
    if (typeof window === 'undefined') return { width: 1920, height: 1080 };
    return {
      width: window.innerWidth || document.documentElement.clientWidth,
      height: window.innerHeight || document.documentElement.clientHeight,
    };
  }

  static getCapabilities(): DeviceCapabilities {
    if (this.cache) return this.cache;

    if (typeof window === 'undefined') {
      return this.getServerDefaults();
    }

    const device = this.detectDevice();
    const touchEnabled = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    this.cache = {
      device,
      pointerType: this.detectPointerType(),
      screenSize: this.getScreenSize(),
      pixelRatio: window.devicePixelRatio || 1,
      touchEnabled,
      isPressureSensitive: 'PointerEvent' in window,
      supportsGestures: touchEnabled,
      supportsHover: window.matchMedia('(hover:hover)').matches,
      supportsKeyboard: true,
      stylusDetectionEnabled: 'PointerEvent' in window,
      palmRejectionEnabled: touchEnabled,
      maxTouchPoints: navigator.maxTouchPoints || 0,
    };

    return this.cache;
  }

  static invalidateCache(): void {
    this.cache = null;
  }

  /**
   * Get recommended UI sizing based on device.
   */
  static getUISizing(device?: DeviceType) {
    const d = device ?? this.detectDevice();
    const isCompact = d === 'mobile';
    const isLarge = d === 'ipad' || d === 'tablet';

    return {
      toolbarButtonSize: isCompact ? 36 : isLarge ? 44 : 32,
      controlSize: isCompact ? 28 : isLarge ? 36 : 28,
      fontSize: isCompact ? 12 : isLarge ? 14 : 12,
      minTouchTarget: isCompact ? 44 : isLarge ? 44 : 32,
      scrollBehavior: 'smooth' as const,
    };
  }

  /**
   * Detect if the current pointer event is from a stylus.
   */
  static isStylusEvent(event: PointerEvent): boolean {
    return event.pointerType === 'pen';
  }

  /**
   * Detect if the current pointer event is from a finger touch.
   */
  static isTouchEvent(event: PointerEvent): boolean {
    return event.pointerType === 'touch';
  }

  private static detectPointerType(): PointerType {
    if (typeof window === 'undefined') return 'mouse';
    const device = this.detectDevice();
    if (device === 'ipad' || device === 'tablet' || device === 'mobile') return 'touch';
    if ('PointerEvent' in window) return 'pen';
    return 'mouse';
  }

  private static getServerDefaults(): DeviceCapabilities {
    return {
      device: 'desktop',
      pointerType: 'mouse',
      screenSize: { width: 1920, height: 1080 },
      pixelRatio: 1,
      touchEnabled: false,
      isPressureSensitive: false,
      supportsGestures: false,
      supportsHover: true,
      supportsKeyboard: true,
      stylusDetectionEnabled: false,
      palmRejectionEnabled: false,
      maxTouchPoints: 0,
    };
  }
}

export default DeviceDetector;

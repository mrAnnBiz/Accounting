/**
 * Accessibility (a11y) Foundation
 *
 * ARIA landmarks, keyboard navigation, focus management, reduced-motion,
 * high-contrast detection, and screen-reader announcements.
 */

// ---- Focus Trap ----

/**
 * Traps focus inside an element (for modals/panels).
 * Returns a cleanup function.
 */
export function trapFocus(container: HTMLElement): () => void {
  const focusable = container.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  function handleKeydown(e: KeyboardEvent) {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  }

  container.addEventListener('keydown', handleKeydown);
  first?.focus();
  return () => container.removeEventListener('keydown', handleKeydown);
}

// ---- Live Region (screen reader announcements) ----

let liveRegion: HTMLElement | null = null;

function ensureLiveRegion(): HTMLElement {
  if (liveRegion && document.body.contains(liveRegion)) return liveRegion;
  liveRegion = document.createElement('div');
  liveRegion.setAttribute('role', 'status');
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');
  Object.assign(liveRegion.style, {
    position: 'absolute',
    width: '1px',
    height: '1px',
    overflow: 'hidden',
    clip: 'rect(0 0 0 0)',
    whiteSpace: 'nowrap',
  });
  document.body.appendChild(liveRegion);
  return liveRegion;
}

/**
 * Announce a message to screen readers via an ARIA live region.
 */
export function announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const region = ensureLiveRegion();
  region.setAttribute('aria-live', priority);
  // Clear then set — forces re-announcement of same message
  region.textContent = '';
  requestAnimationFrame(() => {
    region.textContent = message;
  });
}

// ---- Keyboard Navigation ----

export type ShortcutHandler = (e: KeyboardEvent) => void;

interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: ShortcutHandler;
  description: string;
}

class KeyboardManager {
  private shortcuts: Shortcut[] = [];
  private active = false;

  register(shortcut: Shortcut): () => void {
    this.shortcuts.push(shortcut);
    this.ensureListener();
    return () => {
      this.shortcuts = this.shortcuts.filter(s => s !== shortcut);
    };
  }

  private ensureListener() {
    if (this.active) return;
    this.active = true;
    document.addEventListener('keydown', this.handleKeydown);
  }

  private handleKeydown = (e: KeyboardEvent) => {
    // Don't intercept when typing in an input
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    for (const s of this.shortcuts) {
      const ctrlMatch = !!s.ctrl === (e.ctrlKey || e.metaKey);
      const shiftMatch = !!s.shift === e.shiftKey;
      const altMatch = !!s.alt === e.altKey;
      if (e.key.toLowerCase() === s.key.toLowerCase() && ctrlMatch && shiftMatch && altMatch) {
        e.preventDefault();
        s.handler(e);
        return;
      }
    }
  };

  /** List all registered shortcuts (for help dialog). */
  getShortcuts(): { key: string; modifiers: string; description: string }[] {
    return this.shortcuts.map(s => {
      const mods: string[] = [];
      if (s.ctrl) mods.push('Ctrl');
      if (s.shift) mods.push('Shift');
      if (s.alt) mods.push('Alt');
      return { key: s.key, modifiers: mods.join('+'), description: s.description };
    });
  }

  dispose() {
    document.removeEventListener('keydown', this.handleKeydown);
    this.shortcuts = [];
    this.active = false;
  }
}

export const keyboardManager = new KeyboardManager();

// ---- Media Query Helpers ----

/**
 * Whether the user prefers reduced motion.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Whether the user is in high-contrast mode.
 */
export function prefersHighContrast(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(forced-colors: active)').matches;
}

/**
 * Whether the user prefers dark mode.
 */
export function prefersDarkMode(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// ---- Skip Link ----

/**
 * Injects a visually-hidden "Skip to content" link.
 * Call once in app root.
 */
export function injectSkipLink(targetId = 'main-content'): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('a11y-skip-link')) return;
  const link = document.createElement('a');
  link.id = 'a11y-skip-link';
  link.href = `#${targetId}`;
  link.textContent = 'Skip to content';
  Object.assign(link.style, {
    position: 'absolute',
    top: '-40px',
    left: '0',
    background: '#000',
    color: '#fff',
    padding: '8px',
    zIndex: '10000',
    transition: 'top 0.2s',
  });
  link.addEventListener('focus', () => { link.style.top = '0'; });
  link.addEventListener('blur', () => { link.style.top = '-40px'; });
  document.body.prepend(link);
}

// ---- Roving TabIndex ----

/**
 * Manages roving tabindex for a group of elements (e.g. toolbar buttons).
 * Arrow keys move focus; only one item is tab-focusable at a time.
 */
export function rovingTabIndex(container: HTMLElement, selector: string): () => void {
  const items = Array.from(container.querySelectorAll<HTMLElement>(selector));
  if (items.length === 0) return () => {};

  items.forEach((el, i) => el.setAttribute('tabindex', i === 0 ? '0' : '-1'));

  let current = 0;

  function handleKeydown(e: KeyboardEvent) {
    let next = current;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      next = (current + 1) % items.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      next = (current - 1 + items.length) % items.length;
    } else if (e.key === 'Home') {
      next = 0;
    } else if (e.key === 'End') {
      next = items.length - 1;
    } else {
      return;
    }

    e.preventDefault();
    items[current].setAttribute('tabindex', '-1');
    items[next].setAttribute('tabindex', '0');
    items[next].focus();
    current = next;
  }

  container.addEventListener('keydown', handleKeydown);
  return () => container.removeEventListener('keydown', handleKeydown);
}

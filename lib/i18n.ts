/**
 * i18n Foundation — String externalization plumbing
 * 
 * Lightweight i18n without a heavy library. All UI strings go through t().
 * Translations can be loaded lazily. RTL support included.
 */

type TranslationDict = Record<string, string>;

const DEFAULT_LOCALE = 'en';

/** English strings — the source of truth. Other locales override these. */
const EN_STRINGS: TranslationDict = {
  // Navigation
  'nav.brand': 'Anneruth',
  'nav.study_notes': 'Study Notes',
  'nav.past_papers': 'Past Papers',

  // Tools
  'tool.pen': 'Pen',
  'tool.highlighter': 'Highlighter',
  'tool.eraser': 'Eraser',
  'tool.select': 'Select',
  'tool.text': 'Text',
  'tool.rectangle': 'Rectangle',
  'tool.circle': 'Circle',
  'tool.line': 'Line',
  'tool.arrow': 'Arrow',
  'tool.pan': 'Pan / Scroll',
  'tool.lasso': 'Lasso Select',
  'tool.ruler': 'Ruler',

  // Toolbar actions
  'action.undo': 'Undo',
  'action.redo': 'Redo',
  'action.clear_page': 'Clear This Page',
  'action.clear_all': 'Clear All Pages',
  'action.export_pdf': 'Export PDF',
  'action.save': 'Save',
  'action.zoom_in': 'Zoom In',
  'action.zoom_out': 'Zoom Out',

  // Panels
  'panel.reference': 'Reference Panel',
  'panel.properties': 'Properties',
  'panel.marking_scheme': 'Marking Scheme',
  'panel.insert_paper': 'Insert Paper',
  'panel.question_paper': 'Question Paper',

  // Properties
  'prop.color': 'Color',
  'prop.stroke_width': 'Stroke Width',
  'prop.opacity': 'Opacity',
  'prop.font_size': 'Font Size',
  'prop.font_family': 'Font Family',

  // Pages
  'page.of': 'of',
  'page.go_to': 'Go to page',

  // Landing page
  'landing.title': 'Cambridge Accounting',
  'landing.subtitle': 'Past Papers & Annotation Platform',
  'landing.papers_count': '929+ Papers',
  'landing.levels': '2 Levels',
  'landing.ipad_ready': 'iPad Ready',
  'landing.get_started': 'Get Started',
  'landing.view_papers': 'View Past Papers',

  // Status messages
  'status.loading': 'Loading...',
  'status.saving': 'Saving...',
  'status.saved': 'Saved',
  'status.error': 'Error',
  'status.offline': 'Offline',
  'status.online': 'Online',
  'status.syncing': 'Syncing...',

  // Errors
  'error.pdf_load_failed': 'Failed to load PDF',
  'error.save_failed': 'Failed to save annotations',
  'error.export_failed': 'Failed to export PDF',
  'error.storage_full': 'Storage is full',

  // Accessibility
  'a11y.toolbar': 'Annotation Toolbar',
  'a11y.canvas': 'PDF Annotation Canvas',
  'a11y.page_navigator': 'Page Navigator',
  'a11y.close': 'Close',
  'a11y.open': 'Open',
};

/** RTL locale codes */
const RTL_LOCALES = new Set(['ar', 'he', 'fa', 'ur']);

class I18nManager {
  private locale: string = DEFAULT_LOCALE;
  private strings: TranslationDict = { ...EN_STRINGS };
  private loadedLocales = new Set<string>([DEFAULT_LOCALE]);
  private listeners: (() => void)[] = [];

  /**
   * Get the current locale.
   */
  getLocale(): string {
    return this.locale;
  }

  /**
   * Check if current locale is RTL.
   */
  isRTL(): boolean {
    return RTL_LOCALES.has(this.locale.split('-')[0]);
  }

  /**
   * Set the active locale. Loads translations if available.
   */
  async setLocale(locale: string): Promise<void> {
    this.locale = locale;

    if (locale === DEFAULT_LOCALE) {
      this.strings = { ...EN_STRINGS };
    } else if (!this.loadedLocales.has(locale)) {
      // Future: dynamically import locale files
      // const translations = await import(`@/locales/${locale}.json`);
      // this.strings = { ...EN_STRINGS, ...translations };
      // this.loadedLocales.add(locale);

      // For now, fall back to English
      this.strings = { ...EN_STRINGS };
    }

    // Update document direction
    if (typeof document !== 'undefined') {
      document.documentElement.dir = this.isRTL() ? 'rtl' : 'ltr';
      document.documentElement.lang = locale;
    }

    this.notifyListeners();
  }

  /**
   * Translate a key. Returns the key itself if not found (for debugging).
   */
  t(key: string, params?: Record<string, string | number>): string {
    let str = this.strings[key] ?? EN_STRINGS[key] ?? key;

    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(`{{${k}}}`, String(v));
      }
    }

    return str;
  }

  /**
   * Register translations for a locale.
   */
  registerTranslations(locale: string, translations: TranslationDict): void {
    if (locale === this.locale) {
      this.strings = { ...EN_STRINGS, ...translations };
    }
    this.loadedLocales.add(locale);
  }

  /**
   * Subscribe to locale changes.
   */
  onChange(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Get all available string keys (for tooling).
   */
  getAllKeys(): string[] {
    return Object.keys(EN_STRINGS);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const i18n = new I18nManager();

/** Shorthand translation function */
export const t = (key: string, params?: Record<string, string | number>): string => i18n.t(key, params);

export default I18nManager;

/**
 * Service Container — Lightweight Dependency Injection
 * 
 * Replaces getInstance() singletons. Enables:
 * - Swappable implementations (test mocks, platform-specific, online/offline)
 * - Lazy instantiation
 * - Lifecycle management (dispose on unmount)
 * - Type-safe service resolution
 */

/** Token to identify a service. Use string literals for simplicity. */
export type ServiceToken = string;

/** Factory function that creates a service instance */
type ServiceFactory<T> = () => T;

interface ServiceRegistration<T = unknown> {
  factory: ServiceFactory<T>;
  instance: T | null;
  singleton: boolean;
  tags: string[];
}

interface Disposable {
  dispose(): void;
}

function isDisposable(obj: unknown): obj is Disposable {
  return typeof obj === 'object' && obj !== null && 'dispose' in obj && typeof (obj as Disposable).dispose === 'function';
}

// ---- Well-known service tokens ----
export const ServiceTokens = {
  // Storage
  StorageProvider: 'StorageProvider',
  AnnotationStorage: 'AnnotationStorage',
  SettingsStorage: 'SettingsStorage',

  // Core engines
  EventBus: 'EventBus',
  PDFEngine: 'PDFEngine',
  AnnotationEngine: 'AnnotationEngine',
  CoordinateSystem: 'CoordinateSystem',

  // Managers
  SettingsManager: 'SettingsManager',
  SessionTracker: 'SessionTracker',
  DeviceDetector: 'DeviceDetector',
  ToolPreferences: 'ToolPreferences',
  SelectionManager: 'SelectionManager',
  UndoManager: 'UndoManager',
  InputFSM: 'InputFSM',
  ToolRegistry: 'ToolRegistry',

  // Rendering
  Renderer: 'Renderer',
  CanvasOptimizer: 'CanvasOptimizer',

  // Platform
  PlatformBridge: 'PlatformBridge',
  FeatureFlags: 'FeatureFlags',
  I18n: 'I18n',

  // Infrastructure
  Logger: 'Logger',
  Analytics: 'Analytics',
  PDFExporter: 'PDFExporter',
  TestRunner: 'TestRunner',
} as const;

class ServiceContainer {
  private registry = new Map<ServiceToken, ServiceRegistration>();

  /**
   * Register a singleton service. Created once on first resolve, reused after.
   */
  registerSingleton<T>(token: ServiceToken, factory: ServiceFactory<T>, tags: string[] = []): this {
    this.registry.set(token, { factory, instance: null, singleton: true, tags });
    return this;
  }

  /**
   * Register a transient service. New instance every resolve.
   */
  registerTransient<T>(token: ServiceToken, factory: ServiceFactory<T>, tags: string[] = []): this {
    this.registry.set(token, { factory, instance: null, singleton: false, tags });
    return this;
  }

  /**
   * Register a pre-existing instance directly.
   */
  registerInstance<T>(token: ServiceToken, instance: T, tags: string[] = []): this {
    this.registry.set(token, { factory: () => instance, instance, singleton: true, tags });
    return this;
  }

  /**
   * Resolve a service by token. Throws if not registered.
   */
  resolve<T>(token: ServiceToken): T {
    const registration = this.registry.get(token);
    if (!registration) {
      throw new Error(`[ServiceContainer] Service not registered: "${token}"`);
    }

    if (registration.singleton) {
      if (registration.instance === null) {
        registration.instance = registration.factory();
      }
      return registration.instance as T;
    }

    return registration.factory() as T;
  }

  /**
   * Check if a service is registered.
   */
  has(token: ServiceToken): boolean {
    return this.registry.has(token);
  }

  /**
   * Get all services with a specific tag.
   */
  resolveByTag<T>(tag: string): T[] {
    const results: T[] = [];
    for (const [, registration] of this.registry) {
      if (registration.tags.includes(tag)) {
        if (registration.singleton) {
          if (registration.instance === null) {
            registration.instance = registration.factory();
          }
          results.push(registration.instance as T);
        } else {
          results.push(registration.factory() as T);
        }
      }
    }
    return results;
  }

  /**
   * Replace a service registration (for testing or runtime swaps).
   */
  override<T>(token: ServiceToken, factory: ServiceFactory<T>): this {
    const existing = this.registry.get(token);
    if (existing) {
      // Dispose old instance if applicable
      if (existing.instance && isDisposable(existing.instance)) {
        existing.instance.dispose();
      }
      existing.factory = factory as ServiceFactory<unknown>;
      existing.instance = null;
    } else {
      this.registerSingleton(token, factory);
    }
    return this;
  }

  /**
   * Dispose all singleton instances and clear the registry.
   */
  dispose(): void {
    for (const [, registration] of this.registry) {
      if (registration.instance && isDisposable(registration.instance)) {
        registration.instance.dispose();
      }
    }
    this.registry.clear();
  }

  /**
   * Diagnostic: list all registered services.
   */
  listServices(): { token: string; singleton: boolean; instantiated: boolean; tags: string[] }[] {
    const result: { token: string; singleton: boolean; instantiated: boolean; tags: string[] }[] = [];
    for (const [token, reg] of this.registry) {
      result.push({
        token,
        singleton: reg.singleton,
        instantiated: reg.instance !== null,
        tags: reg.tags,
      });
    }
    return result;
  }
}

/** Global application service container */
export const container = new ServiceContainer();
export default ServiceContainer;

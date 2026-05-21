/**
 * Bootstrap — Registers all services into the DI container.
 * Call `bootstrapServices()` once at app startup (in layout.tsx or a provider).
 */

import { container, ServiceTokens } from './serviceContainer';
import { eventBus } from './eventBus';

import { SettingsManager } from './settingsManager';
import { SessionTracker } from './sessionTracker';
import { UndoManager } from './undoManager';
import { toolRegistry } from './toolRegistry';
import { InputFSM, inputFSM } from './inputFSM';
import { featureFlags } from './featureFlags';
import { createStorageProvider, type IStorageProvider } from './storageProvider';
import { createPlatformBridge } from './platform';
import { i18n } from './i18n';
import { DeviceDetector } from './deviceDetector';

let bootstrapped = false;

export function bootstrapServices(): void {
  if (bootstrapped) return;
  bootstrapped = true;

  // --- Singletons that are already instantiated ---
  container.registerInstance(ServiceTokens.EventBus, eventBus);
  container.registerInstance(ServiceTokens.InputFSM, inputFSM);
  container.registerInstance(ServiceTokens.ToolRegistry, toolRegistry);
  container.registerInstance(ServiceTokens.FeatureFlags, featureFlags);
  container.registerInstance(ServiceTokens.I18n, i18n);

  // --- Device detector (static class, register as value) ---
  container.registerInstance(ServiceTokens.DeviceDetector, DeviceDetector);

  // --- Settings manager ---
  container.registerSingleton(ServiceTokens.SettingsManager, () => new SettingsManager());

  // --- Session tracker ---
  container.registerSingleton(ServiceTokens.SessionTracker, () => new SessionTracker());

  // --- Undo manager ---
  container.registerSingleton(ServiceTokens.UndoManager, () => new UndoManager({ maxHistorySize: 200 }));

  // --- Storage provider (IndexedDB primary, localStorage fallback) ---
  container.registerSingleton(ServiceTokens.StorageProvider, () => {
    try {
      return createStorageProvider('indexedDB');
    } catch {
      return createStorageProvider('localStorage');
    }
  });

  // --- Platform bridge ---
  container.registerSingleton(ServiceTokens.PlatformBridge, () => createPlatformBridge());
}

/**
 * Convenience: resolve a service by token.
 */
export function getService<T>(token: string): T {
  if (!bootstrapped) bootstrapServices();
  return container.resolve<T>(token);
}

/**
 * Reset for testing — clears all registrations.
 */
export function resetBootstrap(): void {
  bootstrapped = false;
  container.dispose();
}

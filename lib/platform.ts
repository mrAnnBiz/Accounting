/**
 * Platform Abstraction Layer (PAL) — A21
 * 
 * Interfaces for platform-specific capabilities.
 * Web implementation uses browser APIs. Native implementations use
 * Tauri/Capacitor/Electron-specific APIs. Feature code goes through PAL —
 * zero platform-specific code in business logic.
 */

// ---- File System ----

export interface IPlatformFileSystem {
  /** Pick a file using OS file picker. Returns file data or null if cancelled. */
  pickFile(options: { accept?: string[]; multiple?: boolean }): Promise<PlatformFile[]>;
  /** Save a file using OS save dialog. */
  saveFile(data: Uint8Array, options: { suggestedName: string; mimeType: string }): Promise<boolean>;
  /** Read a file from a known path (native only, web uses pickFile). */
  readFile?(path: string): Promise<Uint8Array>;
  /** Check if a file exists (native only). */
  fileExists?(path: string): Promise<boolean>;
}

export interface PlatformFile {
  name: string;
  size: number;
  mimeType: string;
  data: Uint8Array | Blob;
}

// ---- Share Sheet ----

export interface IPlatformShare {
  /** Check if native sharing is available */
  canShare(): boolean;
  /** Share data via OS share sheet */
  share(options: { title?: string; text?: string; url?: string; files?: File[] }): Promise<boolean>;
}

// ---- Haptics ----

export interface IPlatformHaptics {
  /** Light haptic feedback (e.g. tool selection) */
  light(): void;
  /** Medium haptic feedback (e.g. annotation created) */
  medium(): void;
  /** Heavy haptic feedback (e.g. error) */
  heavy(): void;
  /** Selection haptic (iOS-specific) */
  selection(): void;
}

// ---- Notifications ----

export interface IPlatformNotifications {
  /** Request notification permission */
  requestPermission(): Promise<boolean>;
  /** Show a local notification */
  show(options: { title: string; body: string; icon?: string }): Promise<void>;
}

// ---- Biometric Auth ----

export interface IPlatformBiometrics {
  /** Check if biometric auth is available on this device */
  isAvailable(): Promise<boolean>;
  /** Authenticate the user */
  authenticate(reason: string): Promise<boolean>;
}

// ---- Native Menu ----

export interface IPlatformMenu {
  /** Set the native app menu (macOS/Windows menu bar) */
  setMenu?(items: PlatformMenuItem[]): void;
  /** Show a context menu at a position */
  showContextMenu(items: PlatformMenuItem[], position: { x: number; y: number }): Promise<string | null>;
}

export interface PlatformMenuItem {
  id: string;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  separator?: boolean;
  children?: PlatformMenuItem[];
}

// ---- Clipboard ----

export interface IPlatformClipboard {
  /** Copy text to clipboard */
  copyText(text: string): Promise<void>;
  /** Read text from clipboard */
  readText(): Promise<string>;
  /** Copy image to clipboard */
  copyImage?(imageData: Blob): Promise<void>;
}

// ---- Camera / Scanner ----

export interface IPlatformCamera {
  /** Check if camera is available */
  isAvailable(): boolean;
  /** Capture a photo */
  capturePhoto?(): Promise<PlatformFile | null>;
  /** Scan a document (iOS/Android document scanner) */
  scanDocument?(): Promise<PlatformFile[]>;
}

// ---- Combined Platform Bridge ----

export interface IPlatformBridge {
  readonly platform: 'web' | 'ios' | 'android' | 'macos' | 'windows' | 'linux';
  readonly fileSystem: IPlatformFileSystem;
  readonly share: IPlatformShare;
  readonly haptics: IPlatformHaptics;
  readonly notifications: IPlatformNotifications;
  readonly biometrics: IPlatformBiometrics;
  readonly menu: IPlatformMenu;
  readonly clipboard: IPlatformClipboard;
  readonly camera: IPlatformCamera;
}

// ---- Web Implementation ----

class WebFileSystem implements IPlatformFileSystem {
  async pickFile(options: { accept?: string[]; multiple?: boolean }): Promise<PlatformFile[]> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = options.multiple ?? false;
      if (options.accept) input.accept = options.accept.join(',');

      input.onchange = async () => {
        const files: PlatformFile[] = [];
        if (input.files) {
          for (const file of Array.from(input.files)) {
            files.push({
              name: file.name,
              size: file.size,
              mimeType: file.type,
              data: file,
            });
          }
        }
        resolve(files);
      };

      input.oncancel = () => resolve([]);
      input.click();
    });
  }

  async saveFile(data: Uint8Array, options: { suggestedName: string; mimeType: string }): Promise<boolean> {
    try {
      // Try File System Access API first (Chrome)
      if ('showSaveFilePicker' in window) {
        const handle = await (window as unknown as { showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
          suggestedName: options.suggestedName,
          types: [{ accept: { [options.mimeType]: [] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(data as unknown as BufferSource);
        await writable.close();
        return true;
      }

      // Fallback: create download link
      const blob = new Blob([data as BlobPart], { type: options.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = options.suggestedName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return true;
    } catch {
      return false;
    }
  }
}

class WebShare implements IPlatformShare {
  canShare(): boolean {
    return 'share' in navigator;
  }

  async share(options: { title?: string; text?: string; url?: string; files?: File[] }): Promise<boolean> {
    try {
      if (navigator.share) {
        await navigator.share(options);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}

class WebHaptics implements IPlatformHaptics {
  private vibrate(ms: number): void {
    if ('vibrate' in navigator) {
      navigator.vibrate(ms);
    }
  }
  light(): void { this.vibrate(10); }
  medium(): void { this.vibrate(25); }
  heavy(): void { this.vibrate(50); }
  selection(): void { this.vibrate(5); }
}

class WebNotifications implements IPlatformNotifications {
  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
  }

  async show(options: { title: string; body: string; icon?: string }): Promise<void> {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(options.title, { body: options.body, icon: options.icon });
    }
  }
}

class WebBiometrics implements IPlatformBiometrics {
  async isAvailable(): Promise<boolean> {
    // Web Authentication API (FIDO2)
    return typeof window !== 'undefined' && 'PublicKeyCredential' in window;
  }

  async authenticate(_reason: string): Promise<boolean> {
    // Web doesn't have direct biometric auth — falls back to WebAuthn
    return false;
  }
}

class WebMenu implements IPlatformMenu {
  async showContextMenu(_items: PlatformMenuItem[], _position: { x: number; y: number }): Promise<string | null> {
    // Web uses custom React context menus — native menu not applicable
    return null;
  }
}

class WebClipboard implements IPlatformClipboard {
  async copyText(text: string): Promise<void> {
    await navigator.clipboard.writeText(text);
  }

  async readText(): Promise<string> {
    return navigator.clipboard.readText();
  }

  async copyImage(imageData: Blob): Promise<void> {
    if ('ClipboardItem' in window) {
      await navigator.clipboard.write([
        new ClipboardItem({ [imageData.type]: imageData }),
      ]);
    }
  }
}

class WebCamera implements IPlatformCamera {
  isAvailable(): boolean {
    return 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices;
  }
}

/** Web platform implementation */
export class WebPlatformBridge implements IPlatformBridge {
  readonly platform = 'web' as const;
  readonly fileSystem = new WebFileSystem();
  readonly share = new WebShare();
  readonly haptics = new WebHaptics();
  readonly notifications = new WebNotifications();
  readonly biometrics = new WebBiometrics();
  readonly menu = new WebMenu();
  readonly clipboard = new WebClipboard();
  readonly camera = new WebCamera();
}

/** Create the appropriate platform bridge */
export function createPlatformBridge(): IPlatformBridge {
  // Future: detect Tauri/Capacitor/Electron and return native bridges
  return new WebPlatformBridge();
}

# Anneruth Platform — Engineering TODO

> Priority: Architecture first, features second.
> Future scope: multi-subject, cloud storage, user accounts, uploaded files, multi-device, multi-lingual, school smartboards, native apps (iPad/Mac/Windows/Surface/Android).

---

## Phase 1: Architecture Cleanup (DO FIRST)

### Core Decomposition
- [x] **A1. Decompose god component** — Extracted `usePDFEngine` (286 lines), `useAnnotations` (286 lines), `useStylusInput` (107 lines) hooks + `BootstrapProvider`. Component: 1484→544 lines. Services resolved from DI container.
- [x] **A5. Delete dead code** — Removed: velocity detection stubs, unused getAdaptive* helpers, handleExportSettings/handleImportSettings, inputState, testRunner, MEMORY_CHECK_INTERVAL, 2 BACKUP files, duplicated PerformanceMonitor blocks, commented-out mobile toolbar.
- [x] **A8. Separate PDF engine from annotation engine** — PDF loading/rendering in `usePDFEngine`, annotation CRUD/state in `useAnnotations`. Decoupled via event bus.

### Canvas & Rendering
- [ ] **A2. Implement multi-layer canvas** — Wire up the existing `canvasOptimization.ts` layer architecture (background/annotation/active) into `AnnotationCanvas.tsx`. Currently single-layer.
- [ ] **A13. Renderer abstraction layer** — `renderer.ts` created (IRenderer, Canvas2DRenderer, SVG stub). Not wired — Konva still hardcoded in AnnotationCanvas.
- [ ] **A12. Web Worker for heavy computation** — `workerClient.ts` + `annotationWorker.ts` created. Not wired — WorkerClient not imported anywhere.

### Data & Storage
- [ ] **A3. Switch primary storage to IndexedDB** — `storageProvider.ts` IStorageProvider interface done. IndexedDB registered in bootstrap. Components still use localStorage via `annotationStorage`.
- [x] **A7. Abstract storage layer** — `IStorageProvider` interface with localStorage, IndexedDB, cloud implementations defined in `storageProvider.ts`. Registered in DI container.
- [x] **A4. Command-pattern undo/redo** — `UndoManager` with Add/Remove/Update/Clear/Batch commands wired into `useAnnotations`. Undo/redo buttons in toolbar. Delta-based, memory-efficient.
- [x] **A9. Auth-ready data model** — `AnnotationDocumentV2` in `storageProvider.ts` with `userId`, `workspaceId`, `sharedWith[]`, `deviceId`. Schema migration v1→v2 auto-upgrades on load.
- [x] **A15. Document schema versioning + migrations** — `migrateDocument()` runs on every document load in `useAnnotations.initializeAnnotationDocument()`. v1→v2 migration active.

### Systems & Patterns
- [ ] **A6. Modular tool system** — `toolRegistry.ts` ITool interface + ToolRegistry created. Registered in bootstrap. Toolbar still hardcoded in JSX — no tools registered.
- [x] **A11. Event bus / pub-sub system** — `eventBus.ts` wired into `usePDFEngine`, `useAnnotations`, `UndoManager`. 20+ event types. Active pub/sub replacing prop-drilling.
- [ ] **A16. Finite state machine for input** — `inputFSM.ts` with 9 states + transitions created. Registered in bootstrap. Not wired — `useStylusInput` doesn't use FSM yet.
- [x] **A18. Service container / dependency injection** — `ServiceContainer` with 30+ tokens. `bootstrap.ts` registers all services. Component resolves `SettingsManager`, `SessionTracker`, `FeatureFlags`, `UndoManager` from container via `getService()`.
- [x] **A14. Feature flag system** — `FeatureFlagManager` with 16 flags, user groups, localStorage persistence. Wired: `showPerformanceMonitor` uses `ui.performanceMonitor` flag. Auto-detects dev environment.
- [ ] **A17. Configuration-driven UI** — `uiConfig.ts` with 4 presets (student/teacher/smartboard/exam) created. Not wired — toolbar hardcoded.

### Cross-Platform & Infrastructure
- [ ] **A10. i18n foundation** — `i18n.ts` with I18nManager, EN_STRINGS (80+ strings), RTL support created. Registered in bootstrap. Not wired — zero strings using t().
- [x] **A19. Offline-first with Service Worker** — `swRegistration.ts` called from `BootstrapProvider`. Service Worker registered on startup. `queueOfflineRequest()` available but not called from CRUD yet.
- [ ] **A20. Accessibility (a11y) foundation** — `a11y.ts` with `trapFocus()`, `announce()`, `KeyboardManager` created. Not wired — zero a11y attributes in components.
- [ ] **A21. Platform abstraction layer (PAL)** — `platform.ts` with 10 interfaces (file system, haptics, camera, biometric, etc.) created. Not wired — no implementations active.

---

## Phase 2: Drawing Quality (Industry Standard)

- [ ] **D1. Real-time stroke smoothing** — Apply Catmull-Rom/Bezier interpolation during `handlePointerMove`, not just on pointer-up. Eliminates jagged-then-snap feel.
- [ ] **D2. Pixel eraser** — Add eraser mode that removes portions of strokes (split stroke at erase point). Current: whole-stroke deletion only.
- [ ] **D3. Implement resize/rotate** — `editMode === 'resize'` is stubbed with `console.log`. Wire up proportional + free transform with handles.
- [ ] **D4. Apple Pencil tilt/azimuth** — Read `tiltX`, `tiltY`, `twist` from PointerEvent. Use for shading width variation.
- [ ] **D5. Apple Pencil double-tap** — Detect Pencil 2 double-tap to toggle eraser/last tool.
- [ ] **D6. Stroke stabilizer** — Moving-average or predictive smoothing for shaky hands (accessibility + smartboard use).
- [ ] **D7. Lasso select** — Freeform selection tool for grouping, moving, copying annotations.
- [ ] **D8. Copy/paste annotations** — Clipboard support for annotation objects within and across pages.
- [ ] **D9. Snap-to-grid / straight line assist** — Hold-to-straighten for lines, shapes, and arrows.
- [ ] **D10. Zoom-to-write window** — Magnified writing area for precise small annotations (GoodNotes-style).

---

## Phase 3: Platform Expansion (Future)

- [ ] **P1. User accounts & auth** — OAuth + email/password. JWT sessions. Role-based access (student/teacher/admin).
- [ ] **P2. Cloud storage & sync** — Real-time sync with conflict resolution. Offline-first with queue.
- [ ] **P3. Multi-subject paper system** — Generalize Cambridge parser for all subjects. Dynamic paper index.
- [ ] **P4. File upload & management** — User uploads PDFs/images. File organizer with folders, tags, search.
- [ ] **P5. Multi-device compatibility** — Responsive redesign. PWA support. Session handoff between devices.
- [ ] **P6. Multi-lingual UI** — Wire translations into i18n foundation from A10. RTL support.
- [ ] **P7. School smartboard mode** — Large touch targets, simplified toolbar, presenter view, shared whiteboard.
- [ ] **P8. Security hardening** — CSRF, rate limiting, input sanitization on uploads, encrypted storage, audit logs.
- [ ] **P9. Memory/state cloud retrieval** — Sync annotations, preferences, session history across devices/accounts.
- [ ] **P10. Collaboration** — Real-time shared annotation sessions (teacher marking student work).

---

*Phase 1 unblocks everything. Don't skip it.*

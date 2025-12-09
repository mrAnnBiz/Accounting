# Anneruth - Cambridge Accounting Platform

## Project Summary

A modern Next.js 16 web application for Cambridge IGCSE and A-Level Accounting exam preparation. The platform provides **929+ past papers** with an advanced PDF annotation system, supporting both desktop and iPad (Apple Pencil) usage.

**Project Status**: Production-ready with comprehensive annotation system and optimized performance architecture.

---

## Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | Next.js 16.0.7 (App Router, Turbopack) |
| **Frontend** | React 19, TypeScript 5 |
| **Styling** | Tailwind CSS 4 |
| **PDF Rendering** | pdfjs-dist 5.4, react-pdf 10.2 |
| **Canvas/Drawing** | Konva 10, react-konva 19, perfect-freehand |
| **PDF Export** | pdf-lib 1.17, jspdf |
| **Linting** | Biome 2.2 |
| **Deployment** | Vercel |

---

## Project Structure

```
acc/
├── app/                    # Next.js App Router
│   ├── page.tsx           # Landing page
│   ├── past-papers/       # Paper browsing & viewer
│   ├── notes/             # Study notes
│   └── api/               # API routes (search-papers, pdf-proxy)
├── components/            # 16 React components
├── lib/                   # Core libraries (parser, search)
├── utils/                 # Utilities (storage, cache, export)
├── types/                 # TypeScript definitions
└── public/papers/         # 929+ PDF files
```

---

## Core Features

### 1. Past Paper Management
- **929+ Cambridge papers** (IGCSE 0452, A-Level 9706)
- Cambridge filename parser (`9706_s23_qp_32.pdf`)
- Smart search with natural language queries
- Filter by grade, year, series, component, document type

### 2. PDF Viewer
- High-quality rendering with pdfjs-dist
- Zoom controls (50%-200%)
- Page navigation with editable input
- Scrollable multi-page view

### 3. Annotation Tools
| Tool | Description |
|------|-------------|
| Pen | Freehand with pressure sensitivity |
| Highlighter | Semi-transparent highlighting |
| Shapes | Rectangle, Circle, Arrow, Line |
| Text | Inline text annotations |
| Eraser | Remove annotations |
| Select | Move & resize annotations |

### 4. Reference Panel
- 3-tab system: MS (Marking Scheme), IN (Insert), QP (Question Paper)
- Auto-detects related documents
- Built-in PDF viewer with zoom

### 5. Performance Optimizations
- LRU annotation caching (30-min TTL)
- Multi-layer canvas architecture
- Virtual rendering (visible pages only)
- Real-time performance monitoring

### 6. Mobile Support
- Touch gestures (pinch zoom, pan)
- Palm rejection for Apple Pencil
- Mobile-optimized toolbar

---

## Key Components

| Component | Purpose |
|-----------|---------|
| `EnhancedPDFViewerScrollable` | Main PDF viewer (1,222 lines) |
| `AnnotationCanvas` | Konva drawing canvas (879 lines) |
| `CambridgeReferencePanel` | MS/IN/QP reference panel |
| `TouchGestureHandler` | Mobile gesture support |
| `PerformanceMonitor` | Dev performance dashboard |
| `TopToolbarEdge` | Navigation & zoom controls |

---

## Data Storage

### Annotation Document Structure
```typescript
{
  pdfId: "9706_s23_qp_32",
  pdfMetadata: { subject, series, paperType, paperNumber, totalPages },
  annotations: AnnotationPage[],
  created: ISO timestamp,
  lastModified: ISO timestamp
}
```

- LocalStorage-based persistence
- Per-document storage with quota management
- Export/import capabilities

---

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/api/search-papers?q=` | Natural language search |
| `/api/search-papers?exact=` | Exact paper lookup |
| `/api/search-papers?subject=` | Papers by subject |
| `/api/pdf-proxy` | Serve PDF files |

---

## Utility Modules

| Module | Purpose |
|--------|---------|
| `cambridge-parser.ts` | Parse Cambridge filenames |
| `pdf-search.ts` | Search & filter papers |
| `coordinates.ts` | PDF ↔ Canvas conversion |
| `pdfExporter.ts` | Export annotations to PDF |
| `annotationCache.ts` | LRU caching |
| `storage.ts` | Annotation persistence |

---

## Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run start        # Production server
npm run lint         # Biome linting
npm run format       # Biome formatting
```

---

## Statistics

- **Components**: 16
- **Utility modules**: 10
- **PDF files**: 929+
- **Subjects**: IGCSE 0452, A-Level 9706
- **Main viewer**: 1,222 lines

---

## Technical Research Documentation

### ASR.md (1,798 lines)
Comprehensive technical research document covering:
- **Library Analysis**: Detailed evaluation of PDF.js, Konva.js, Perfect-freehand, PDF-lib
- **Architecture Design**: Component structure and data schemas
- **Cambridge Integration**: Filename parsing and PDF organization
- **Performance Considerations**: Optimization strategies and implementation details
- **Stack Comparison**: Matrix analysis of alternative technologies
- **Implementation Roadmap**: Development phases and technical requirements

### DCF.md (395 lines) 
Critical fixes and debugging log:
- **Annotation System Fixes**: Resolution of drawing tools functionality
- **PDF Export Errors**: "No PDF header found" debugging and fixes
- **UI/UX Improvements**: Toolbar reorganization and styling consistency
- **Touch Interaction**: Canvas event handling enhancements
- **Coordinate System**: PDF-to-canvas coordinate conversion fixes
- **Tool Preferences**: localStorage-based settings persistence

## Development History

### Major Milestones
1. **Phase 1-3**: Core PDF viewer, annotation tools, storage system
2. **Phase 4**: Performance optimizations (caching, virtualization) 
3. **Phase 6**: Advanced features (PDF export, testing framework)
4. **Phase 7**: Streamlined reference panel with 3-tab system
5. **Critical Fixes**: Complete annotation system debugging and resolution

### Known Issues & Improvements
- **iPad Hover Detection**: Preventing unintended drawings from pen proximity
- **Perfect-freehand Tuning**: Reducing excessive drawing adjustments
- **Touch Scrolling**: Enable finger scrolling during annotation mode
- **Highlighter Rendering**: Maintaining thickness after stroke completion
- **Pan Tool Evaluation**: Assessing utility and potential removal

---

*Last updated: December 8, 2025*  
*Total codebase documentation: 2,193+ lines of technical analysis*

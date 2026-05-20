# Page Identification & Page Navigation System

**Component**: `EnhancedPDFViewerScrollable.tsx`  
**Status**: Production-Ready  
**Date**: December 11, 2025

---

## Overview

The application uses a **1-indexed, DOM-based page identification system** where each page is rendered with a unique HTML element ID (`page-{pageNum}`) and tracked in memory via React state variables. The system uses both automatic scroll detection and user navigation for page tracking.

---

## Page Identification Mechanism

### Primary Identifier: HTML Element ID

Each rendered page has a unique DOM identifier:

```typescript
id={`page-${pageNum}`}
```

**Examples**:
- First page: `id="page-1"`
- Second page: `id="page-2"`
- Last page: `id="page-123"` (for 123-page PDF)

This ID is used for:
- Direct navigation via `document.getElementById()`
- Visibility detection via `getBoundingClientRect()`
- Annotation canvas targeting
- Page reference in console logs

---

## Core State Variables

### 1. `totalPages` (number)
**Purpose**: Total number of pages in the PDF

```typescript
const [totalPages, setTotalPages] = useState(0);
```

**How it's set**:
```typescript
// In PDF loading effect (line 915)
const pdfDoc = await loadingTask.promise;
setTotalPages(pdfDoc.numPages);  // Gets from PDF.js library
```

**Range**: 0 (initial) → actual page count (e.g., 50, 100, 200)

---

### 2. `displayPageNum` (number)
**Purpose**: Currently displayed/active page number for navigation UI

```typescript
const [displayPageNum, setDisplayPageNum] = useState(1);
```

**Update Sources**:
1. **Automatic**: `updateCurrentPage()` function (scroll-based detection)
2. **User Action**: `goToPage()` function (navigation buttons, direct input)
3. **Session Tracking**: Updated when page changes

**Range**: 1 → totalPages

**Constraints**:
```typescript
// In nextPage()
if (displayPageNum < totalPages) {
  goToPage(displayPageNum + 1);
}

// In prevPage()
if (displayPageNum > 1) {
  goToPage(displayPageNum - 1);
}

// In goToPage()
if (pageNum < 1 || pageNum > totalPages) return;
```

---

### 3. `pageAnnotations` (object)
**Purpose**: Stores annotations and page info for each page

```typescript
const [pageAnnotations, setPageAnnotations] = useState<{
  [pageNum: number]: PageAnnotationState
}>({});
```

**Structure** (per page):
```typescript
interface PageAnnotationState {
  annotations: Annotation[];      // All annotations on this page
  pageInfo: PageInfo;              // Canvas info, dimensions, scale
}

interface PageInfo {
  pdfWidth: number;               // Original PDF width
  pdfHeight: number;              // Original PDF height
  canvasWidth: number;            // Display canvas width (zoomed)
  canvasHeight: number;           // Display canvas height (zoomed)
  scale: number;                  // Zoom fraction (1.0 = 100%)
  offsetX: number;                // Horizontal offset
  offsetY: number;                // Vertical offset
}
```

**Example** (for page 3 at 150% zoom):
```typescript
pageAnnotations[3] = {
  annotations: [
    { id: 'ann-001', type: 'pen', coordinates: [...], ... },
    { id: 'ann-002', type: 'highlighter', coordinates: [...], ... }
  ],
  pageInfo: {
    pdfWidth: 612,
    pdfHeight: 792,
    canvasWidth: 520,               // Zoomed: 347 * 1.5
    canvasHeight: 713,              // Zoomed: 528 * 1.5
    scale: 1.5,                     // 150% zoom
    offsetX: 0,
    offsetY: 0
  }
}
```

---

## Page Detection System

### Automatic Page Detection (Scroll-Based)

**Function**: `updateCurrentPage()` (Line 862-894)

```typescript
const updateCurrentPage = () => {
  if (!containerRef.current) return;

  // 1. Find container center (viewport center)
  const containerRect = containerRef.current.getBoundingClientRect();
  const containerCenter = containerRect.top + containerRect.height / 2;

  // 2. Loop through all pages, find closest to viewport center
  let closestPage = 1;
  let minDistance = Infinity;

  for (let i = 1; i <= totalPages; i++) {
    const pageElement = document.getElementById(`page-${i}`);
    if (pageElement) {
      const pageRect = pageElement.getBoundingClientRect();
      const pageCenter = pageRect.top + pageRect.height / 2;
      const distance = Math.abs(pageCenter - containerCenter);

      if (distance < minDistance) {
        minDistance = distance;
        closestPage = i;
      }
    }
  }

  // 3. Update if different from current
  if (closestPage !== displayPageNum) {
    setDisplayPageNum(closestPage);
  }

  currentPageRef.current = closestPage;
};
```

**Trigger Points**:
- Scroll events (debounced)
- Window resize
- Manual navigation

**How It Works**:
1. Gets the **center point** of the visible viewport
2. Calculates **center point of each page**
3. Finds the page **closest to viewport center**
4. Updates `displayPageNum` if it changed

**Example Flow**:
```
User scrolls down
    ↓
updateCurrentPage() called
    ↓
Container center = 400px
    ↓
Page 1 center = 200px → distance = 200px
Page 2 center = 600px → distance = 200px  ← Closest!
Page 3 center = 1000px → distance = 600px
    ↓
displayPageNum = 2
    ↓
UI updates to show "Page 2 of 50"
```

---

## Manual Navigation System

### Navigation Controls (Toolbar)

**Location**: Top toolbar, right side (lines 2050-2080)

```
[‹ Previous] [Page Input: 5] [Next ›]
  disabled   1-50 editable   disabled
```

### Previous Button: `prevPage()`

```typescript
const prevPage = () => {
  if (displayPageNum > 1) {
    goToPage(displayPageNum - 1);
  }
};
```

**Behavior**:
- Jumps to page N-1
- Disabled when on page 1
- Triggers scroll-to-page animation

### Next Button: `nextPage()`

```typescript
const nextPage = () => {
  if (displayPageNum < totalPages) {
    goToPage(displayPageNum + 1);
  }
};
```

**Behavior**:
- Jumps to page N+1
- Disabled when on last page
- Triggers scroll-to-page animation

### Direct Page Input

**Behavior**:
```typescript
onChange={(e) => {
  const page = parseInt(e.target.value);
  if (page >= 1 && page <= totalPages) goToPage(page);
}}
```

**Features**:
- User types page number
- Validates range (1 to totalPages)
- Direct jump to page

---

## Go-To-Page Function: `goToPage()`

**Location**: Lines 1831-1841

```typescript
const goToPage = (pageNum: number) => {
  if (pageNum < 1 || pageNum > totalPages) return;
  
  const pageElement = document.getElementById(`page-${pageNum}`);
  if (pageElement && containerRef.current) {
    setDisplayPageNum(pageNum);
    
    pageElement.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  }
};
```

**Steps**:
1. **Validates** page number (1 to totalPages)
2. **Gets** page element by ID: `page-{pageNum}`
3. **Updates** `displayPageNum` state
4. **Smoothly scrolls** page into view (centered)

**Example Usage**:
```typescript
goToPage(5);    // Jump to page 5
goToPage(100);  // Jump to page 100
goToPage(0);    // Returns early (invalid)
goToPage(101);  // Returns early if < totalPages (invalid)
```

---

## Page Visibility Detection

### Function: `isPageVisible()`

**Location**: Lines 849-861

```typescript
const isPageVisible = (pageNum: number): boolean => {
  const pageElement = document.getElementById(`page-${pageNum}`);
  if (!pageElement || !containerRef.current) return false;

  const containerRect = containerRef.current.getBoundingClientRect();
  const pageRect = pageElement.getBoundingClientRect();

  const buffer = VIEWPORT_BUFFER_PX;  // 200px
  return (
    pageRect.bottom > containerRect.top - buffer &&
    pageRect.top < containerRect.bottom + buffer
  );
};
```

**Purpose**: Determines if a page should be rendered

**Constants**:
```typescript
const VIEWPORT_BUFFER_PX = 200;  // Pre-load 200px above/below viewport
```

**Logic**:
- Page is visible if within viewport ± 200px buffer
- Buffer allows pre-loading pages before scrolling to them
- Performance optimization (virtual rendering)

---

## Page Rendering Process

### Render Page: `renderPage()`

**Location**: Lines 1397-1449

```typescript
const renderPage = async (pageNum: number, forceRerender = false) => {
  if (!pdfDocRef.current) return;

  // 1. Check if already rendered at current zoom
  const existingCanvas = pageCanvasesRef.current[pageNum];
  if (existingCanvas?.rendered && 
      pageRenderedZoomRef.current[pageNum] === zoom && 
      !forceRerender) {
    return;  // Already rendered, skip
  }

  try {
    // 2. Get page from PDF document
    const page = await pdfDocRef.current.getPage(pageNum);
    const viewport = page.getViewport({ scale: EXTRACTION_QUALITY });

    // 3. Create canvas
    const canvas = existingCanvas?.pdfCanvas || document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    // 4. Set canvas dimensions
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // 5. Render PDF page to canvas
    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };

    await page.render(renderContext).promise;

    // 6. Store reference
    pageCanvasesRef.current[pageNum] = {
      pdfCanvas: canvas,
      rendered: true,
    };

    // 7. Update page info
    setTimeout(() => updatePageInfo(pageNum), 100);
  } catch (error) {
    console.error(`Failed to render page ${pageNum}:`, error);
  }
};
```

**Caching Strategy**:
- Stores rendered canvas in `pageCanvasesRef.current[pageNum]`
- Skips re-rendering if:
  - Already rendered
  - Same zoom level as cached version
  - Not force-rerendered
- Updates on zoom changes or explicit force

---

## Page Information Update: `updatePageInfo()`

**Location**: Lines 1339-1380

**Purpose**: Calculates canvas dimensions accounting for zoom and rendering scale

```typescript
const updatePageInfo = (pageNum: number) => {
  // 1. Get page element and canvas
  const pageElement = document.getElementById(`page-${pageNum}`);
  const canvas = pageCanvasesRef.current[pageNum]?.pdfCanvas;
  
  // 2. Get PDF page from document
  const page = await pdfDocRef.current.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1 });
  const zoomFraction = zoom / 100;
  
  // 3. Calculate rendering scale
  const renderScale = EXTRACTION_QUALITY * DISPLAY_QUALITY * zoomFraction;
  
  // 4. Calculate dimensions
  const canvasDisplayWidth = canvas.offsetWidth || viewport.width * zoomFraction;
  const canvasDisplayHeight = canvas.offsetHeight || viewport.height * zoomFraction;
  
  // 5. Create PageInfo object
  const pageInfo: PageInfo = {
    pdfWidth: viewport.width,
    pdfHeight: viewport.height,
    canvasWidth: canvasDisplayWidth,
    canvasHeight: canvasDisplayHeight,
    scale: zoomFraction,
    offsetX: 0,
    offsetY: 0
  };

  // 6. Store in state
  setPageAnnotations(prev => ({
    ...prev,
    [pageNum]: {
      ...(prev[pageNum] || { annotations: [] }),
      pageInfo
    }
  }));
};
```

**Used For**:
- Annotation coordinate calculations
- Canvas sizing
- Zoom level tracking

---

## Page Rendering in JSX (lines 2150-2195)

```typescript
{Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
  const pageCanvas = pageCanvasesRef.current[pageNum];
  const currentPageAnnotations = pageAnnotations[pageNum]?.annotations || [];
  const currentPageInfo = pageAnnotations[pageNum]?.pageInfo || getCurrentPageInfo();
  
  return (
    <div
      key={pageNum}
      id={`page-${pageNum}`}  // ← Unique ID for page detection
      className="relative mb-4 mx-auto bg-white shadow-lg"
    >
      {/* Annotation Canvas */}
      {pageCanvas?.rendered && (
        <AnnotationCanvas
          width={currentPageInfo.canvasWidth}
          height={currentPageInfo.canvasHeight}
          pageInfo={currentPageInfo}
          annotations={currentPageAnnotations}
          // ... handlers for this page
        />
      )}
    </div>
  );
})}
```

**Loop Process**:
1. Creates array from 1 to totalPages: `[1, 2, 3, ..., N]`
2. Maps each page number to JSX element
3. Assigns unique ID: `page-{pageNum}`
4. Loads annotations for that page
5. Renders annotation canvas

---

## Session Tracking & Page Views

### Track Page View

**Location**: Lines 966-975

```typescript
useEffect(() => {
  if (paperParam) {
    examSessionTracker.trackPageView(paperParam, displayPageNum);
    
    // Update session state with current page
    settingsManager.updateSessionState({
      currentPage: displayPageNum,
      currentZoomLevel: zoom
    });
  }
}, [displayPageNum, zoom, paperParam, settingsManager, examSessionTracker]);
```

**Data Collected**:
```typescript
// From ExamSessionTracker
trackPageView(paperId: string, pageNum: number) {
  const metrics = this.getMetrics(paperId);
  metrics.pageViews.push({
    page: pageNum,
    timestamp: new Date().toISOString(),
    duration: 0
  });
}
```

**Used For**:
- Track which pages user viewed
- Calculate time spent per page
- Analyze exam practice patterns

---

## Annotation Handling by Page

### Create Annotation on Page

```typescript
const handleAnnotationCreateForPage = (annotation: Annotation, pageNum: number) => {
  setPageAnnotations(prev => ({
    ...prev,
    [pageNum]: {
      ...(prev[pageNum] || { annotations: [], pageInfo: getCurrentPageInfo() }),
      annotations: [...(prev[pageNum]?.annotations || []), annotation]
    }
  }));
};
```

### Update Annotation on Page

```typescript
const handleAnnotationUpdateForPage = (
  annotationId: string,
  updates: Partial<Annotation>,
  pageNum: number
) => {
  setPageAnnotations(prev => ({
    ...prev,
    [pageNum]: {
      ...(prev[pageNum]),
      annotations: (prev[pageNum]?.annotations || []).map(ann =>
        ann.id === annotationId ? { ...ann, ...updates } : ann
      )
    }
  }));
};
```

### Delete Annotation on Page

```typescript
const handleAnnotationDeleteForPage = (
  annotationId: string,
  pageNum: number
) => {
  setPageAnnotations(prev => ({
    ...prev,
    [pageNum]: {
      ...(prev[pageNum]),
      annotations: (prev[pageNum]?.annotations || []).filter(
        ann => ann.id !== annotationId
      )
    }
  }));
};
```

---

## Constants & Configuration

```typescript
const VIEWPORT_BUFFER_PX = 200;           // Pre-load buffer
const EXTRACTION_QUALITY = 2;             // 2x canvas resolution
const DISPLAY_QUALITY = 1.5;              // Display scaling factor
const POINTER_VELOCITY_THRESHOLD = 0.5;   // Scroll detection
const DEFAULT_PAGE_WIDTH = 595;           // Standard PDF width
const DEFAULT_PAGE_HEIGHT = 842;          // Standard PDF height
```

---

## Page Numbering Examples

### 50-Page PDF

```
Input PDF: 50 pages
          ↓
After Load: totalPages = 50
          ↓
Valid Range: 1-50
          ↓
Display Examples:
  - User scrolls to middle → displayPageNum = 25, UI: "Page 25 of 50"
  - User clicks next → displayPageNum = 26
  - User types 50 → displayPageNum = 50
  - User types 51 → Invalid (ignored)
```

### 200-Page PDF

```
totalPages = 200
displayPageNum ∈ [1, 200]

Navigation Examples:
  - Page 1 → click next → Page 2
  - Page 199 → click next → Page 200
  - Page 200 → next button disabled
  - Page 1 → previous button disabled
```

---

## Key Characteristics

| Feature | Implementation |
|---------|-----------------|
| **Page Numbering** | 1-based (1 to totalPages) |
| **Identification** | DOM ID + React state |
| **Current Page** | Closest to viewport center |
| **Updates** | Automatic (scroll) or manual (buttons/input) |
| **Caching** | Per-page canvas cache |
| **Performance** | Virtual rendering (200px buffer) |
| **Annotations** | Stored per-page in state |
| **Session Tracking** | Page views + duration logged |

---

## Data Flow Diagram

```
PDF Loaded
    ↓
pdfDoc.numPages
    ↓
setTotalPages(n)
    ↓
Render Pages 1-n:
    ├─ <div id="page-1"> ... </div>
    ├─ <div id="page-2"> ... </div>
    ├─ <div id="page-3"> ... </div>
    └─ <div id="page-n"> ... </div>
    ↓
User Scrolls / Navigates
    ↓
updateCurrentPage() OR goToPage(n)
    ↓
setDisplayPageNum(n)
    ↓
UI Updates:
    ├─ "Page {displayPageNum} of {totalPages}"
    ├─ Load annotations[n]
    ├─ Show AnnotationCanvas
    └─ Track pageView(n)
```

---

## Common Operations

### Jump to Page 5 in 100-page PDF
```typescript
goToPage(5);  // → page-5 scroll into view
```

### Get All Annotations on Current Page
```typescript
const currentAnnotations = pageAnnotations[displayPageNum]?.annotations || [];
```

### Update Zoom and Re-render Page 10
```typescript
setZoom(150);  // Triggers re-render
// renderPage(10, forceRerender=true) called automatically
```

### Get Page Info for Annotation Coordinates
```typescript
const pageInfo = pageAnnotations[displayPageNum]?.pageInfo;
// Use pageInfo.scale for coordinate calculations
```

---

## Summary

The page identification system is:
- **Simple**: 1-based numbering, DOM IDs, React state
- **Robust**: Validates all page numbers, handles edge cases
- **Performant**: Virtual rendering with 200px buffer, canvas caching
- **Trackable**: Session metrics per page
- **Flexible**: Supports both automatic and manual navigation

All pages are identified by their sequential number (1 to N), rendered with unique DOM IDs, and managed through React state for annotations, visibility, and tracking.

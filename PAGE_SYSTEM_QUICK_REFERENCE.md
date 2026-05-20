# Page System - Quick Reference

## Core Concept
**Pages are identified by 1-based numbers (1, 2, 3, ... N) stored in React state and DOM element IDs.**

---

## Key State Variables

| Variable | Type | Purpose | Range |
|----------|------|---------|-------|
| `totalPages` | number | Total pages in PDF | 0-∞ |
| `displayPageNum` | number | Currently displayed page | 1 to totalPages |
| `pageAnnotations[n]` | object | Annotations on page n | All pages |

---

## How It Works

### 1. PDF Loads
```
PDF → pdfDoc.numPages → setTotalPages(numPages)
```

### 2. Pages Render (1-indexed)
```
Array.from({ length: totalPages }, (_, i) => i + 1)
  ↓
[1, 2, 3, ..., N]
  ↓
Each maps to: <div id={`page-${pageNum}`}> ... </div>
```

### 3. User Navigation
```
Click "Next" → goToPage(displayPageNum + 1)
  ↓
document.getElementById(`page-${newPageNum}`)
  ↓
scrollIntoView()
  ↓
setDisplayPageNum(newPageNum)
```

### 4. Automatic Detection
```
User scrolls
  ↓
updateCurrentPage() called
  ↓
Find page closest to viewport center
  ↓
setDisplayPageNum(closestPage)
```

---

## Page Navigation

### Previous/Next Buttons
```typescript
nextPage():     displayPageNum + 1 (if < totalPages)
prevPage():     displayPageNum - 1 (if > 1)
goToPage(n):    Jump to page n (with validation)
```

### Direct Input
```
User types: 25
  ↓
Validates: 1 <= 25 <= totalPages
  ↓
goToPage(25)
```

---

## DOM Structure

```html
<div className="flex-1 overflow-auto">
  <div id="page-1" className="relative mb-4">
    <canvas ... /> <!-- PDF rendered here -->
    <AnnotationCanvas ... /> <!-- Annotations here -->
  </div>
  
  <div id="page-2" className="relative mb-4">
    <canvas ... />
    <AnnotationCanvas ... />
  </div>
  
  <!-- ... pages 3 to N ... -->
  
  <div id="page-N" className="relative mb-4">
    <canvas ... />
    <AnnotationCanvas ... />
  </div>
</div>
```

---

## Identifying a Page

### By Element ID
```typescript
const pageElement = document.getElementById(`page-${pageNum}`);
```

### By State Variable
```typescript
const currentPage = displayPageNum;  // Number: 1 to totalPages
```

### By Annotation Storage
```typescript
const annotations = pageAnnotations[pageNum]?.annotations;
const pageInfo = pageAnnotations[pageNum]?.pageInfo;
```

---

## Page Detection Algorithm

```
1. Get viewport center position
2. For each page 1 to totalPages:
   - Get page center position
   - Calculate distance from viewport center
3. Find page with minimum distance
4. If different from displayPageNum, update it
```

**Result**: Always shows the page closest to viewport center

---

## Pagination Example

### 200-Page PDF Scenario

```
totalPages = 200
displayPageNum = 45

┌─────────────────────┐
│  Previous Button: ✓  │  (enabled, go to 44)
│  Page Input: [45___] │  (editable 1-200)
│  Next Button: ✓      │  (enabled, go to 46)
└─────────────────────┘

UI shows: "Page 45 of 200"

Annotations stored in:
  pageAnnotations[45].annotations[]
  pageAnnotations[45].pageInfo { scale, width, height, ... }
```

---

## Page-Specific Operations

### Get Current Page Annotations
```typescript
const current = pageAnnotations[displayPageNum]?.annotations || [];
```

### Add Annotation to Page
```typescript
const newAnnotation = { id, type, coordinates, properties, ... };
setPageAnnotations(prev => ({
  ...prev,
  [pageNum]: {
    annotations: [...(prev[pageNum]?.annotations || []), newAnnotation],
    pageInfo: prev[pageNum]?.pageInfo
  }
}));
```

### Get Page Info for Zoom Calculations
```typescript
const { canvasWidth, canvasHeight, scale } = 
  pageAnnotations[pageNum]?.pageInfo || {};
```

---

## Zoom & Re-rendering

### When User Zooms
```
setZoom(150)  // 150%
  ↓
Triggers effect
  ↓
For visible pages:
  - Call renderPage(pageNum, forceRerender=true)
  - Call updatePageInfo(pageNum)
  ↓
pageAnnotations[n].pageInfo.scale updated to 1.5
```

---

## Session Tracking

### Track Page Views
```typescript
useEffect(() => {
  examSessionTracker.trackPageView(paperParam, displayPageNum);
  
  settingsManager.updateSessionState({
    currentPage: displayPageNum,
    currentZoomLevel: zoom
  });
}, [displayPageNum, zoom, ...]);
```

### Result Stored
```typescript
metrics.pageViews = [
  { page: 1, timestamp: "...", duration: 45 },
  { page: 2, timestamp: "...", duration: 32 },
  { page: 3, timestamp: "...", duration: 78 },
  // ... etc
]
```

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| User types 0 | Validation rejects (1 to totalPages only) |
| User types 301 on 100-page PDF | Validation rejects |
| User on page 1, clicks Previous | Button disabled |
| User on page N, clicks Next | Button disabled |
| PDF has 1 page | Both buttons disabled |
| Invalid page in state | Default to getCurrentPageInfo() |

---

## Performance Optimizations

### Virtual Rendering
```typescript
const VIEWPORT_BUFFER_PX = 200;  // Load 200px above/below viewport

const isPageVisible = (pageNum) => {
  // True if within viewport ± buffer
};
```

### Canvas Caching
```typescript
pageCanvasesRef.current[pageNum] = {
  pdfCanvas: canvas,
  rendered: true,
  zoom: 100  // Only re-render if zoom changes
};
```

### Debounced Detection
```typescript
// updateCurrentPage() called on scroll (debounced)
// Updates displayPageNum only if changed
```

---

## Constants

```typescript
VIEWPORT_BUFFER_PX = 200      // Pre-load buffer
EXTRACTION_QUALITY = 2        // Canvas resolution multiplier
DISPLAY_QUALITY = 1.5         // Display scaling
DEFAULT_PAGE_WIDTH = 595      // Letter paper width
DEFAULT_PAGE_HEIGHT = 842     // Letter paper height
```

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Page number doesn't update | Scroll detection not working | Check if containerRef is attached |
| Page shows blank | Canvas render failed | Check browser console for errors |
| Annotations on wrong page | pageNum parameter wrong | Verify handleAnnotationCreateForPage(ann, pageNum) |
| Zoom doesn't update | updatePageInfo() not called | Check if updatePageInfo() runs after setZoom() |

---

## Summary

- **Pages**: 1-indexed, sequential (1 to N)
- **ID**: `page-${pageNum}` in DOM
- **State**: `displayPageNum` tracks current, `pageAnnotations[n]` stores data
- **Detection**: Automatic (viewport center) or manual (navigation)
- **Updates**: Instant on navigation, automatic on scroll
- **Performance**: Virtual rendering, caching, debouncing

Pages are simple, reliable, and optimized for scrolling and annotation workflows.

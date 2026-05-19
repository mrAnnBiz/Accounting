import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Stage, Layer, Line, Rect, Circle, Text, Arrow } from 'react-konva';
import Konva from 'konva';
import { getStroke } from 'perfect-freehand';
import { v4 as uuidv4 } from 'uuid';
import { 
  Annotation, 
  AnnotationType, 
  AnnotationTool, 
  Point, 
  PageInfo,
  DEFAULT_ANNOTATION_PROPERTIES,
  EditingState,
  AnnotationSelection,
  SelectionHandle,
  TextEditingState,
  AnnotationProperties
} from '../types/annotations';
import { coordinateSystem, CoordinateUtils } from '../utils/coordinates';
import { selectionManager } from '../utils/selection';
import { SelectionHandles } from './SelectionHandles';
import { InlineTextEditor } from './InlineTextEditor';

interface AnnotationCanvasProps {
  width: number;
  height: number;
  pageInfo: PageInfo;
  annotations: Annotation[];
  selectedTool: AnnotationTool;
  isDrawing: boolean;
  onAnnotationCreate: (annotation: Annotation) => void;
  onAnnotationUpdate: (annotationId: string, updates: Partial<Annotation>) => void;
  onAnnotationDelete: (annotationId: string) => void;
  onAnnotationSelect: (annotationId: string | null) => void;
  selectedAnnotationId: string | null;
  toolProperties: any; // Tool-specific properties
}

export const AnnotationCanvas: React.FC<AnnotationCanvasProps> = ({
  width,
  height,
  pageInfo,
  annotations,
  selectedTool,
  isDrawing,
  onAnnotationCreate,
  onAnnotationUpdate,
  onAnnotationDelete,
  onAnnotationSelect,
  selectedAnnotationId,
  toolProperties
}) => {
  const stageRef = useRef<Konva.Stage>(null);
  const layerRef = useRef<Konva.Layer>(null);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const [isCurrentlyDrawing, setIsCurrentlyDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [tempAnnotation, setTempAnnotation] = useState<Annotation | null>(null);
  
  // Eraser state
  const [isErasing, setIsErasing] = useState(false);
  const [erasedAnnotations, setErasedAnnotations] = useState<Set<string>>(new Set());
  
  // Selection and editing state
  const [editingState, setEditingState] = useState<EditingState>(selectionManager.createDefaultEditingState());
  const [currentSelection, setCurrentSelection] = useState<AnnotationSelection | null>(null);
  
  // Text editing state
  const [textEditingState, setTextEditingState] = useState<TextEditingState>({
    isTextEditing: false
  });

  // Update selection when selected annotation changes
  useEffect(() => {
    if (selectedAnnotationId) {
      const annotation = annotations.find(a => a.id === selectedAnnotationId);
      if (annotation) {
        const selection = selectionManager.createAnnotationSelection(annotation);
        setCurrentSelection(selection);
        setEditingState(prev => ({ ...prev, selectedAnnotation: annotation }));
      }
    } else {
      setCurrentSelection(null);
      setEditingState(prev => ({ ...prev, selectedAnnotation: null, editMode: 'none' }));
    }
  }, [selectedAnnotationId, annotations]);

  // Find annotation at a specific point
  const findAnnotationAtPoint = useCallback((canvasPoint: Point): Annotation | null => {
    // Check annotations in reverse order (top to bottom)
    for (let i = annotations.length - 1; i >= 0; i--) {
      const annotation = annotations[i];
      
      // Skip annotations that have already been erased in current session
      if (erasedAnnotations.has(annotation.id)) {
        continue;
      }
      
      const canvasCoords = annotation.coordinates.map(point => 
        coordinateSystem.pdfToCanvas(point, pageInfo)
      );
      
      // Simple hit detection based on annotation type
      switch (annotation.type) {
        case 'pen':
        case 'highlighter':
          // Improved hit detection for pen/highlighter strokes
          if (annotation.properties.strokePoints && Array.isArray(annotation.properties.strokePoints)) {
            const strokePoints = annotation.properties.strokePoints as Point[];
            const canvasStrokePoints = strokePoints.map(point => 
              coordinateSystem.pdfToCanvas(point, pageInfo)
            );
            const tolerance = Math.max(annotation.properties.strokeWidth || 2, 15);
            
            // Check distance to line segments for better accuracy
            for (let i = 0; i < canvasStrokePoints.length - 1; i++) {
              const p1 = canvasStrokePoints[i];
              const p2 = canvasStrokePoints[i + 1];
              if (coordinateSystem.distanceToLineSegment) {
                const distToSegment = coordinateSystem.distanceToLineSegment(canvasPoint, p1, p2);
                if (distToSegment <= tolerance) {
                  return annotation;
                }
              } else {
                // Fallback to point distance if distanceToLineSegment not available
                if (coordinateSystem.distance(canvasPoint, p1) <= tolerance || 
                    coordinateSystem.distance(canvasPoint, p2) <= tolerance) {
                  return annotation;
                }
              }
            }
          } else {
            // Fallback for legacy coordinates
            const tolerance = Math.max(annotation.properties.strokeWidth || 2, 15);
            if (canvasCoords.some(coord => 
              coordinateSystem.distance(canvasPoint, coord) <= tolerance
            )) {
              return annotation;
            }
          }
          break;
        case 'rectangle':
          if (canvasCoords.length >= 2) {
            const [start, end] = canvasCoords;
            const minX = Math.min(start.x, end.x);
            const maxX = Math.max(start.x, end.x);
            const minY = Math.min(start.y, end.y);
            const maxY = Math.max(start.y, end.y);
            const strokeWidth = annotation.properties.strokeWidth || 2;
            const tolerance = Math.max(strokeWidth / 2, 3);
            
            // Check if point is inside rectangle or near its border
            const isInside = canvasPoint.x >= minX && canvasPoint.x <= maxX &&
                            canvasPoint.y >= minY && canvasPoint.y <= maxY;
            const isNearBorder = (canvasPoint.x >= minX - tolerance && canvasPoint.x <= maxX + tolerance &&
                                 canvasPoint.y >= minY - tolerance && canvasPoint.y <= maxY + tolerance) &&
                                !isInside;
            
            if (isInside || isNearBorder) {
              return annotation;
            }
          }
          break;
        case 'circle':
          if (canvasCoords.length >= 2) {
            const [center, edge] = canvasCoords;
            const radius = coordinateSystem.distance(center, edge);
            const distanceToCenter = coordinateSystem.distance(canvasPoint, center);
            const strokeWidth = annotation.properties.strokeWidth || 2;
            const tolerance = Math.max(strokeWidth / 2, 3);
            
            // Check if point is inside circle or near its border
            if (distanceToCenter <= radius + tolerance) {
              return annotation;
            }
          }
          break;
        case 'text':
          if (canvasCoords.length >= 1) {
            const textPos = canvasCoords[0];
            // Better text bounds calculation based on font properties
            const fontSize = annotation.properties.fontSize || 14;
            const text = annotation.properties.text || '';
            // Approximate character width based on font size (more accurate than fixed 8px)
            const charWidth = fontSize * 0.6; // Typical character width ratio
            const textWidth = Math.max(text.length * charWidth, fontSize * 2); // Minimum clickable area
            const textHeight = fontSize * 1.2; // Include line height
            
            // Add padding for easier clicking
            const padding = 4;
            if (canvasPoint.x >= textPos.x - padding && 
                canvasPoint.x <= textPos.x + textWidth + padding &&
                canvasPoint.y >= textPos.y - padding && 
                canvasPoint.y <= textPos.y + textHeight + padding) {
              return annotation;
            }
          }
          break;
        case 'line':
        case 'arrow':
          if (canvasCoords.length >= 2) {
            const [start, end] = canvasCoords;
            const strokeWidth = annotation.properties.strokeWidth || 2;
            const tolerance = Math.max(strokeWidth, 8); // More generous tolerance for lines
            const distToLine = coordinateSystem.distanceToLineSegment(canvasPoint, start, end);
            
            if (distToLine <= tolerance) {
              return annotation;
            }
          }
          break;
      }
    }
    return null;
  }, [annotations, coordinateSystem, pageInfo, erasedAnnotations]);

  // Handle text editing
  const handleTextDoubleClick = useCallback((annotation: Annotation) => {
    if (annotation.type !== 'text') return;
    
    const canvasCoords = coordinateSystem.pdfToCanvas(annotation.coordinates[0], pageInfo);
    setTextEditingState({
      isTextEditing: true,
      editingAnnotationId: annotation.id,
      editorPosition: canvasCoords,
      initialText: annotation.properties.text || ''
    });
  }, [pageInfo]);

  const handleTextSave = useCallback((text: string, properties: Partial<AnnotationProperties>) => {
    if (textEditingState.editingAnnotationId) {
      const existingAnnotation = annotations.find(a => a.id === textEditingState.editingAnnotationId);
      if (existingAnnotation) {
        onAnnotationUpdate(textEditingState.editingAnnotationId, {
          properties: {
            ...existingAnnotation.properties,
            ...properties,
            text
          },
          lastModified: new Date().toISOString()
        });
      }
    }
    setTextEditingState({ isTextEditing: false });
  }, [textEditingState.editingAnnotationId, onAnnotationUpdate, annotations]);

  const handleTextCancel = useCallback(() => {
    setTextEditingState({ isTextEditing: false });
  }, []);

  // Handle selection and editing interactions
  const handleStageClick = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    if (!stageRef.current) return;

    const pointerPos = stageRef.current.getPointerPosition();
    if (!pointerPos) return;

    const clickPoint: Point = { x: pointerPos.x, y: pointerPos.y };

    // Close text editor if clicking elsewhere
    if (textEditingState.isTextEditing) {
      setTextEditingState({ isTextEditing: false });
      return;
    }

    if (selectedTool === 'select') {
      // Find annotation at click point
      const clickedAnnotation = selectionManager.findAnnotationAtPoint(clickPoint, annotations);
      
      if (clickedAnnotation) {
        onAnnotationSelect(clickedAnnotation.id);
      } else {
        onAnnotationSelect(null);
      }
      return;
    }

    // Handle text annotation creation (removed duplicate logic - handled in handlePointerDown)

    // Clear selection when clicking elsewhere (unless drawing)
    if (!isCurrentlyDrawing && selectedAnnotationId && !currentSelection) {
      onAnnotationSelect(null);
    }
  }, [selectedTool, annotations, selectedAnnotationId, currentSelection, isCurrentlyDrawing, onAnnotationSelect]);

  // Handle selection handle interactions
  const handleSelectionHandleMouseDown = useCallback((handle: SelectionHandle, e: any) => {
    e.cancelBubble = true;
    
    if (!currentSelection || !editingState.selectedAnnotation) return;

    if (handle.type === 'delete') {
      onAnnotationDelete(currentSelection.annotationId);
      setCurrentSelection(null);
      onAnnotationSelect(null);
      return;
    }

    const stage = stageRef.current;
    if (!stage) return;

    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;

    setEditingState(prev => ({
      ...prev,
      editMode: handle.type === 'corner' || handle.type === 'edge' ? 'resize' : 
                handle.type === 'rotate' ? 'rotate' : 'move',
      dragStart: { x: pointerPos.x, y: pointerPos.y },
      originalBounds: currentSelection.bounds
    }));
  }, [currentSelection, editingState.selectedAnnotation, onAnnotationDelete, onAnnotationSelect]);

  // Handle selection bounds dragging (for moving)
  const handleSelectionBoundsMouseDown = useCallback((e: any) => {
    e.cancelBubble = true;
    
    if (!currentSelection || !editingState.selectedAnnotation) return;

    const stage = stageRef.current;
    if (!stage) return;

    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;

    setEditingState(prev => ({
      ...prev,
      editMode: 'move',
      dragStart: { x: pointerPos.x, y: pointerPos.y },
      originalBounds: currentSelection.bounds
    }));
  }, [currentSelection, editingState.selectedAnnotation]);

  // Handle mouse/touch events for drawing and editing
  const handlePointerDown = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    
    // Handle stage clicks for selection
    if (selectedTool === 'select') {
      handleStageClick(e);
      return;
    }

    if (selectedTool === 'pan') {
      return;
    }

    if (selectedTool === 'eraser') {
      // Start erasing mode - delete any annotation touched
      const stage = e.target.getStage();
      if (!stage) return;
      
      const pointerPos = stage.getPointerPosition();
      if (!pointerPos) return;

      setIsErasing(true);
      setErasedAnnotations(new Set());
      
      // Find and delete annotation at start position
      const clickedAnnotation = findAnnotationAtPoint(pointerPos);
      if (clickedAnnotation) {
        onAnnotationDelete(clickedAnnotation.id);
        setErasedAnnotations(prev => new Set(prev).add(clickedAnnotation.id));
      }
      return;
    }
    
    const stage = e.target.getStage();
    if (!stage) return;

    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;

    // Clear any existing selection when starting to draw
    onAnnotationSelect(null);

    const point: Point = {
      x: pointerPos.x,
      y: pointerPos.y,
      pressure: e.evt.pressure || 0.5
    };

    setIsCurrentlyDrawing(true);
    setStartPoint(point);

    if (selectedTool === 'pen' || selectedTool === 'highlighter') {
      setCurrentPath([point]);
    } else if (['rectangle', 'circle', 'line', 'arrow'].includes(selectedTool)) {
      // For shapes, create temporary annotation
      const tempId = `temp-${Date.now()}`;
      const newAnnotation: Annotation = {
        id: tempId,
        type: selectedTool as AnnotationType,
        coordinates: [point],
        properties: {
          ...DEFAULT_ANNOTATION_PROPERTIES[selectedTool as AnnotationType],
          ...toolProperties
        },
        timestamp: new Date().toISOString(),
        lastModified: new Date().toISOString()
      };
      setTempAnnotation(newAnnotation);
    } else if (selectedTool === 'text') {
      // For text tool, immediately create a text annotation and start editing
      const pdfPoint = coordinateSystem.canvasToPdf(point, pageInfo);
      const textAnnotation: Annotation = {
        id: uuidv4(),
        type: 'text',
        coordinates: [pdfPoint],
        properties: {
          ...DEFAULT_ANNOTATION_PROPERTIES.text,
          ...toolProperties,
          text: ''
        },
        timestamp: new Date().toISOString(),
        lastModified: new Date().toISOString()
      };

      onAnnotationCreate(textAnnotation);
      
      // Start text editing immediately
      setTextEditingState({
        isTextEditing: true,
        editingAnnotationId: textAnnotation.id,
        editorPosition: point,
        initialText: ''
      });

      setIsCurrentlyDrawing(false);
    }
  }, [selectedTool, toolProperties, handleStageClick, onAnnotationSelect]);

  const handlePointerMove = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;

    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;

    const point: Point = {
      x: pointerPos.x,
      y: pointerPos.y,
      pressure: e.evt.pressure || 0.5
    };

    // Handle editing mode (moving/resizing selected annotation)
    if (editingState.editMode !== 'none' && editingState.dragStart && editingState.selectedAnnotation) {
      const delta = {
        x: point.x - editingState.dragStart.x,
        y: point.y - editingState.dragStart.y
      };

      if (editingState.editMode === 'move') {
        // Move annotation
        const newCoordinates = selectionManager.moveAnnotation(editingState.selectedAnnotation, delta);
        onAnnotationUpdate(editingState.selectedAnnotation.id, { coordinates: newCoordinates });
      } else if (editingState.editMode === 'resize' && currentSelection && editingState.originalBounds) {
        // Resize annotation (implementation depends on specific requirements)
        console.log('Resize mode - to be implemented');
      }
      return;
    }

    // Handle eraser drag
    if (isErasing && selectedTool === 'eraser') {
      const clickedAnnotation = findAnnotationAtPoint(point);
      if (clickedAnnotation && !erasedAnnotations.has(clickedAnnotation.id)) {
        onAnnotationDelete(clickedAnnotation.id);
        setErasedAnnotations(prev => new Set(prev).add(clickedAnnotation.id));
      }
      return;
    }

    // Handle drawing mode
    if (!isCurrentlyDrawing || selectedTool === 'pan' || selectedTool === 'select') return;

    if (selectedTool === 'pen' || selectedTool === 'highlighter') {
      setCurrentPath(prev => [...prev, point]);
    } else if (tempAnnotation && startPoint) {
      // Update temporary annotation for shapes
      const updatedAnnotation = {
        ...tempAnnotation,
        coordinates: [startPoint, point]
      };
      setTempAnnotation(updatedAnnotation);
    }
  }, [isCurrentlyDrawing, selectedTool, tempAnnotation, startPoint, editingState, currentSelection, onAnnotationUpdate, isErasing, erasedAnnotations, findAnnotationAtPoint, onAnnotationDelete]);

  const handlePointerUp = useCallback(() => {
    // Reset eraser state
    if (isErasing) {
      setIsErasing(false);
      setErasedAnnotations(new Set());
      return;
    }

    // Reset editing state
    if (editingState.editMode !== 'none') {
      setEditingState(prev => ({
        ...prev,
        editMode: 'none',
        dragStart: null,
        originalBounds: null
      }));
      return;
    }

    if (!isCurrentlyDrawing) return;

    setIsCurrentlyDrawing(false);

    if (selectedTool === 'pen' || selectedTool === 'highlighter') {
      if (currentPath.length > 1) {
        // Convert canvas coordinates to PDF coordinates
        const pdfCoordinates = currentPath.map(point => 
          coordinateSystem.canvasToPdf(point, pageInfo)
        );

        // Convert full currentPath to PDF coordinates for strokePoints
        const pdfStrokePoints = currentPath.map(point => 
          coordinateSystem.canvasToPdf(point, pageInfo)
        );

        const annotation: Annotation = {
          id: uuidv4(),
          type: selectedTool as AnnotationType,
          coordinates: pdfCoordinates,
          properties: {
            ...DEFAULT_ANNOTATION_PROPERTIES[selectedTool as AnnotationType],
            ...toolProperties,
            strokePoints: pdfStrokePoints // Store full stroke path as PDF coordinates
          },
          timestamp: new Date().toISOString(),
          lastModified: new Date().toISOString()
        };

        onAnnotationCreate(annotation);
      }
      setCurrentPath([]);
    } else if (tempAnnotation && startPoint) {
      // Finalize shape annotation
      if (tempAnnotation.coordinates.length >= 2) {
        const pdfCoordinates = tempAnnotation.coordinates.map(point => 
          coordinateSystem.canvasToPdf(point, pageInfo)
        );

        const finalAnnotation: Annotation = {
          ...tempAnnotation,
          id: uuidv4(),
          coordinates: pdfCoordinates
        };

        onAnnotationCreate(finalAnnotation);
      }
      setTempAnnotation(null);
    }

    setStartPoint(null);
  }, [
    editingState,
    isCurrentlyDrawing, 
    selectedTool, 
    currentPath, 
    tempAnnotation, 
    startPoint, 
    pageInfo, 
    toolProperties, 
    onAnnotationCreate,
    isErasing
  ]);

  // Render annotation based on type
  const renderAnnotation = (annotation: Annotation, isTemp = false) => {
    const key = isTemp ? 'temp' : annotation.id;
    // For temporary annotations, coordinates are already in canvas space
    // For saved annotations, convert from PDF to canvas coordinates
    const canvasCoords = isTemp 
      ? annotation.coordinates 
      : annotation.coordinates.map(point => coordinateSystem.pdfToCanvas(point, pageInfo));
    const props = annotation.properties;
    const isSelected = annotation.id === selectedAnnotationId;

    switch (annotation.type) {
      case 'pen':
      case 'highlighter':
        if (props.strokePoints) {
          // Use perfect-freehand for smooth pen strokes
          const strokeOptions = {
            size: props.strokeWidth || 2,
            thinning: 0.5,
            smoothing: 0.5,
            streamline: 0.5,
            easing: (t: number) => t,
            start: { taper: 0, easing: (t: number) => t },
            end: { taper: 100, easing: (t: number) => --t * t * t + 1 }
          };

          // Convert PDF strokePoints to canvas coordinates for rendering
          const canvasStrokePoints = (props.strokePoints as Point[]).map(point => 
            coordinateSystem.pdfToCanvas(point, pageInfo)
          );
          
          const strokePoints = coordinateSystem.normalizePointsForDrawing(canvasStrokePoints);
          const stroke = getStroke(strokePoints, strokeOptions);
          
          // Safety check for empty stroke
          if (!stroke || stroke.length === 0) {
            return null;
          }

          // Convert stroke to SVG path
          const pathData = stroke.reduce(
            (acc, point, i, arr) => {
              const [x0, y0] = point;
              if (i === 0) {
                return `M ${x0},${y0}`;
              }
              const [x1, y1] = arr[i - 1];
              const cpx = (x0 + x1) / 2;
              const cpy = (y0 + y1) / 2;
              return `${acc} Q ${x1},${y1} ${cpx},${cpy}`;
            },
            ''
          );

          return (
            <Line
              key={key}
              points={stroke.flat()}
              stroke={props.color}
              strokeWidth={1}  // Add thin stroke for visibility
              fill={props.color}
              opacity={props.opacity}
              listening={!isTemp}
              onClick={() => !isTemp && onAnnotationSelect(annotation.id)}
              shadowColor={isSelected ? '#0066FF' : undefined}
              shadowBlur={isSelected ? 4 : 0}
              shadowOffset={isSelected ? { x: 0, y: 0 } : undefined}
            />
          );
        } else {
          // Fallback to simple line
          return (
            <Line
              key={key}
              points={canvasCoords.flatMap(p => [p.x, p.y])}
              stroke={props.color}
              strokeWidth={props.strokeWidth || 2}
              opacity={props.opacity}
              lineCap="round"
              lineJoin="round"
              listening={!isTemp}
              onClick={() => !isTemp && onAnnotationSelect(annotation.id)}
              shadowColor={isSelected ? '#0066FF' : undefined}
              shadowBlur={isSelected ? 4 : 0}
              shadowOffset={isSelected ? { x: 0, y: 0 } : undefined}
            />
          );
        }

      case 'rectangle':
        if (canvasCoords.length >= 2) {
          const [start, end] = canvasCoords;
          const width = Math.abs(end.x - start.x);
          const height = Math.abs(end.y - start.y);
          const x = Math.min(start.x, end.x);
          const y = Math.min(start.y, end.y);

          return (
            <Rect
              key={key}
              x={x}
              y={y}
              width={width}
              height={height}
              stroke={props.color}
              strokeWidth={props.strokeWidth || 2}
              fill={props.fillColor === 'transparent' ? undefined : props.fillColor}
              opacity={props.opacity}
              listening={!isTemp}
              onClick={() => !isTemp && onAnnotationSelect(annotation.id)}
              shadowColor={isSelected ? '#0066FF' : undefined}
              shadowBlur={isSelected ? 4 : 0}
              shadowOffset={isSelected ? { x: 0, y: 0 } : undefined}
            />
          );
        }
        break;

      case 'circle':
        if (canvasCoords.length >= 2) {
          const [start, end] = canvasCoords;
          const radius = coordinateSystem.distance(start, end);
          
          return (
            <Circle
              key={key}
              x={start.x}
              y={start.y}
              radius={radius}
              stroke={props.color}
              strokeWidth={props.strokeWidth || 2}
              fill={props.fillColor === 'transparent' ? undefined : props.fillColor}
              opacity={props.opacity}
              listening={!isTemp}
              onClick={() => !isTemp && onAnnotationSelect(annotation.id)}
              shadowColor={isSelected ? '#0066FF' : undefined}
              shadowBlur={isSelected ? 4 : 0}
              shadowOffset={isSelected ? { x: 0, y: 0 } : undefined}
            />
          );
        }
        break;

      case 'line':
        if (canvasCoords.length >= 2) {
          const [start, end] = canvasCoords;
          
          return (
            <Line
              key={key}
              points={[start.x, start.y, end.x, end.y]}
              stroke={props.color}
              strokeWidth={props.strokeWidth || 2}
              opacity={props.opacity}
              lineCap="round"
              listening={!isTemp}
              onClick={() => !isTemp && onAnnotationSelect(annotation.id)}
              shadowColor={isSelected ? '#0066FF' : undefined}
              shadowBlur={isSelected ? 4 : 0}
              shadowOffset={isSelected ? { x: 0, y: 0 } : undefined}
            />
          );
        }
        break;

      case 'arrow':
        if (canvasCoords.length >= 2) {
          const [start, end] = canvasCoords;
          
          return (
            <Arrow
              key={key}
              points={[start.x, start.y, end.x, end.y]}
              stroke={props.color}
              strokeWidth={props.strokeWidth || 2}
              fill={props.color}
              opacity={props.opacity}
              pointerLength={10}
              pointerWidth={10}
              listening={!isTemp}
              onClick={() => !isTemp && onAnnotationSelect(annotation.id)}
              shadowColor={isSelected ? '#0066FF' : undefined}
              shadowBlur={isSelected ? 4 : 0}
              shadowOffset={isSelected ? { x: 0, y: 0 } : undefined}
            />
          );
        }
        break;

      case 'text':
        if (canvasCoords.length >= 1 && props.text) {
          const position = canvasCoords[0];
          
          return (
            <Text
              key={key}
              x={position.x}
              y={position.y}
              text={props.text}
              fontSize={props.fontSize || 14}
              fontFamily={props.fontFamily || 'Arial'}
              fontStyle={props.fontWeight ? `${props.fontWeight} ${props.fontStyle || 'normal'}` : props.fontStyle || 'normal'}
              fill={props.color}
              opacity={props.opacity}
              align={props.textAlign || 'left'}
              lineHeight={props.lineHeight || 1.2}
              letterSpacing={props.letterSpacing || 0}
              listening={!isTemp}
              onClick={() => !isTemp && onAnnotationSelect(annotation.id)}
              onDblClick={() => !isTemp && handleTextDoubleClick(annotation)}
              shadowColor={isSelected ? '#0066FF' : undefined}
              shadowBlur={isSelected ? 4 : 0}
              shadowOffset={isSelected ? { x: 0, y: 0 } : undefined}
            />
          );
        }
        break;
    }

    return null;
  };

  // Get cursor style based on selected tool
  const getCursorStyle = () => {
    switch (selectedTool) {
      case 'pan': return 'grab';
      case 'select': return 'default';
      case 'pen': return 'crosshair';
      case 'highlighter': return 'crosshair';
      case 'eraser': return 'pointer';
      case 'rectangle': return 'crosshair';
      case 'circle': return 'crosshair';
      case 'arrow': return 'crosshair';
      case 'line': return 'crosshair';
      case 'text': return 'text';
      default: return 'default';
    }
  };

  return (
    <div style={{ 
      position: 'absolute', 
      top: 0, 
      left: 0, 
      width: width,
      height: height,
      pointerEvents: 'auto',
      cursor: getCursorStyle(),
      zIndex: 10
    }}>
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ 
          cursor: getCursorStyle(),
          touchAction: 'none'
        }}
      >
        <Layer ref={layerRef}>
          {/* Render existing annotations */}
          {annotations.map(annotation => renderAnnotation(annotation))}
          
          {/* Render temporary annotation while drawing */}
          {tempAnnotation && renderAnnotation(tempAnnotation, true)}
          
          {/* Render current path for pen/highlighter */}
          {isCurrentlyDrawing && (selectedTool === 'pen' || selectedTool === 'highlighter') && currentPath.length > 1 && (
            <Line
              points={currentPath.flatMap(p => [p.x, p.y])}
              stroke={toolProperties?.color || DEFAULT_ANNOTATION_PROPERTIES[selectedTool].color}
              strokeWidth={toolProperties?.strokeWidth || DEFAULT_ANNOTATION_PROPERTIES[selectedTool].strokeWidth}
              opacity={toolProperties?.opacity || DEFAULT_ANNOTATION_PROPERTIES[selectedTool].opacity}
              lineCap="round"
              lineJoin="round"
              listening={false}
            />
          )}

          {/* Render selection handles */}
          {currentSelection && selectedTool === 'select' && (
            <SelectionHandles
              selection={currentSelection}
              onHandleMouseDown={handleSelectionHandleMouseDown}
              onBoundsMouseDown={handleSelectionBoundsMouseDown}
            />
          )}
        </Layer>
      </Stage>
      
      {/* Render inline text editor when editing text */}
      {textEditingState.isTextEditing && textEditingState.editingAnnotationId && textEditingState.editorPosition && (() => {
        const editingAnnotation = annotations.find(a => a.id === textEditingState.editingAnnotationId);
        return editingAnnotation ? (
          <InlineTextEditor
            annotation={editingAnnotation}
            position={textEditingState.editorPosition}
            onSave={handleTextSave}
            onCancel={handleTextCancel}
            initialText={textEditingState.initialText}
          />
        ) : null;
      })()}
    </div>
  );
};
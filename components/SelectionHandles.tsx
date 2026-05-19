import React from 'react';
import { Rect, Circle, Group, Line } from 'react-konva';
import { AnnotationSelection, SelectionHandle } from '../types/annotations';

interface SelectionHandlesProps {
  selection: AnnotationSelection;
  onHandleMouseDown: (handle: SelectionHandle, e: any) => void;
  onBoundsMouseDown: (e: any) => void;
}

export const SelectionHandles: React.FC<SelectionHandlesProps> = ({
  selection,
  onHandleMouseDown,
  onBoundsMouseDown
}) => {
  const handleSize = 8;
  const strokeWidth = 2;
  const selectionColor = '#007bff';
  const handleColor = '#ffffff';

  return (
    <Group>
      {/* Selection bounds rectangle */}
      <Rect
        x={selection.bounds.x}
        y={selection.bounds.y}
        width={selection.bounds.width}
        height={selection.bounds.height}
        stroke={selectionColor}
        strokeWidth={1}
        fill="transparent"
        dash={[5, 5]}
        listening={true}
        onMouseDown={onBoundsMouseDown}
        cursor="move"
      />

      {/* Selection handles */}
      {selection.handles.map(handle => {
        if (handle.type === 'delete') {
          return (
            <Group key={handle.id}>
              {/* Delete button background */}
              <Circle
                x={handle.position.x}
                y={handle.position.y}
                radius={10}
                fill="#ff4757"
                stroke="#ffffff"
                strokeWidth={2}
                listening={true}
                onMouseDown={(e) => onHandleMouseDown(handle, e)}
                cursor={handle.cursor}
              />
              {/* Delete X icon */}
              <Group>
                <Line
                  points={[
                    handle.position.x - 4,
                    handle.position.y - 4,
                    handle.position.x + 4,
                    handle.position.y + 4
                  ]}
                  stroke="#ffffff"
                  strokeWidth={2}
                  listening={false}
                />
                <Line
                  points={[
                    handle.position.x + 4,
                    handle.position.y - 4,
                    handle.position.x - 4,
                    handle.position.y + 4
                  ]}
                  stroke="#ffffff"
                  strokeWidth={2}
                  listening={false}
                />
              </Group>
            </Group>
          );
        }

        if (handle.type === 'rotate') {
          return (
            <Group key={handle.id}>
              {/* Rotation handle line */}
              <Line
                points={[
                  selection.bounds.x + selection.bounds.width / 2,
                  selection.bounds.y,
                  handle.position.x,
                  handle.position.y
                ]}
                stroke={selectionColor}
                strokeWidth={1}
                listening={false}
              />
              {/* Rotation handle */}
              <Circle
                x={handle.position.x}
                y={handle.position.y}
                radius={handleSize / 2}
                fill={handleColor}
                stroke={selectionColor}
                strokeWidth={strokeWidth}
                listening={true}
                onMouseDown={(e) => onHandleMouseDown(handle, e)}
                cursor={handle.cursor}
              />
              {/* Rotation icon */}
              <Group>
                <Circle
                  x={handle.position.x}
                  y={handle.position.y}
                  radius={3}
                  stroke={selectionColor}
                  strokeWidth={1}
                  listening={false}
                />
              </Group>
            </Group>
          );
        }

        // Regular resize handles
        const isCorner = handle.type === 'corner';
        
        return (
          <Group key={handle.id}>
            {isCorner ? (
              <Rect
                x={handle.position.x - handleSize / 2}
                y={handle.position.y - handleSize / 2}
                width={handleSize}
                height={handleSize}
                fill={handleColor}
                stroke={selectionColor}
                strokeWidth={strokeWidth}
                listening={true}
                onMouseDown={(e) => onHandleMouseDown(handle, e)}
                cursor={handle.cursor}
              />
            ) : (
              <Circle
                x={handle.position.x}
                y={handle.position.y}
                radius={handleSize / 2}
                fill={handleColor}
                stroke={selectionColor}
                strokeWidth={strokeWidth}
                listening={true}
                onMouseDown={(e) => onHandleMouseDown(handle, e)}
                cursor={handle.cursor}
              />
            )}
          </Group>
        );
      })}
    </Group>
  );
};

interface MultiSelectionProps {
  selections: AnnotationSelection[];
  onHandleMouseDown: (handle: SelectionHandle, selection: AnnotationSelection, e: any) => void;
  onBoundsMouseDown: (selection: AnnotationSelection, e: any) => void;
}

export const MultiSelectionHandles: React.FC<MultiSelectionProps> = ({
  selections,
  onHandleMouseDown,
  onBoundsMouseDown
}) => {
  return (
    <Group>
      {selections.map(selection => (
        <SelectionHandles
          key={selection.annotationId}
          selection={selection}
          onHandleMouseDown={(handle, e) => onHandleMouseDown(handle, selection, e)}
          onBoundsMouseDown={(e) => onBoundsMouseDown(selection, e)}
        />
      ))}
    </Group>
  );
};
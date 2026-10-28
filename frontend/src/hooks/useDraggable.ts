"use client";

import { useCallback, useRef, useState } from "react";

export interface UseDraggableReturn {
  position: { x: number; y: number };
  onMouseDown: (e: React.MouseEvent) => void;
  isDragging: boolean;
}

export function useDraggable({
  initialPosition = { x: 20, y: 20 },
  bounds,
  onDrag,
}: {
  initialPosition?: { x: number; y: number };
  bounds?: { minX: number; minY: number; maxX: number; maxY: number };
  onDrag?: (pos: { x: number; y: number }) => void;
} = {}): UseDraggableReturn {
  const [position, setPosition] = useState({
    x: initialPosition.x,
    y: initialPosition.y,
  });
  const isDraggingRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Chỉ kéo khi nhấn chuột trái
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      isDraggingRef.current = true;
      startRef.current = {
        x: e.clientX,
        y: e.clientY,
        posX: position.x,
        posY: position.y,
      };
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [position]
  );

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      let newX = startRef.current.posX + (e.clientX - startRef.current.x);
      let newY = startRef.current.posY + (e.clientY - startRef.current.y);
      if (bounds) {
        newX = Math.min(Math.max(newX, bounds.minX), bounds.maxX);
        newY = Math.min(Math.max(newY, bounds.minY), bounds.maxY);
      }
      setPosition({ x: newX, y: newY });
      onDrag?.({ x: newX, y: newY });
    },
    [bounds, onDrag]
  );

  const onMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  }, []);

  return { position, onMouseDown, isDragging: isDraggingRef.current };
}

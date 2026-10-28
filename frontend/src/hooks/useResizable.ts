"use client";

import { useCallback, useRef, useState } from "react";

export interface UseResizableReturn {
  size: { width: number; height: number };
  onResizeMouseDown: (e: React.MouseEvent) => void;
  isResizing: boolean;
}

export function useResizable({
  initialSize = { width: 320, height: 400 },
  minWidth = 200,
  minHeight = 200,
  maxWidth,
  maxHeight,
  onResize,
}: {
  initialSize?: { width: number; height: number };
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  onResize?: (size: { width: number; height: number }) => void;
} = {}): UseResizableReturn {
  const [size, setSize] = useState({ width: initialSize.width, height: initialSize.height });
  const isResizingRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0, width: 0, height: 0 });

  const onResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      isResizingRef.current = true;
      startRef.current = {
        x: e.clientX,
        y: e.clientY,
        width: size.width,
        height: size.height,
      };
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [size]
  );

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      let newWidth = startRef.current.width + (e.clientX - startRef.current.x);
      let newHeight = startRef.current.height + (e.clientY - startRef.current.y);
      if (minWidth !== undefined) newWidth = Math.max(newWidth, minWidth);
      if (minHeight !== undefined) newHeight = Math.max(newHeight, minHeight);
      if (maxWidth !== undefined) newWidth = Math.min(newWidth, maxWidth);
      if (maxHeight !== undefined) newHeight = Math.min(newHeight, maxHeight);
      setSize({ width: newWidth, height: newHeight });
      onResize?.({ width: newWidth, height: newHeight });
    },
    [minWidth, minHeight, maxWidth, maxHeight, onResize]
  );

  const onMouseUp = useCallback(() => {
    isResizingRef.current = false;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  }, []);

  return { size, onResizeMouseDown: onResizeMouseDown, isResizing: isResizingRef.current };
}

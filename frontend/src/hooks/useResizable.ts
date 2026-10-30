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
  handleEdge = "right",
}: {
  initialSize?: { width: number; height: number };
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  onResize?: (size: { width: number; height: number }) => void;
  /** Which edge the drag handle sits on.
   *  - `'right'` (default): handle is on the right edge (or bottom-right
   *    corner); dragging right widens. Used by the Sidebar and the map
   *    floating panel.
   *  - `'left'`: handle is on the LEFT edge of a RIGHT-anchored panel
   *    (e.g. the Chỉ đường routing panel is pinned with `right-4`);
   *    dragging the left edge rightwards NARROWS the panel, so the width
   *    delta is inverted. */
  handleEdge?: "left" | "right";
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
      const deltaX = e.clientX - startRef.current.x;
      const deltaY = e.clientY - startRef.current.y;
      // A left-edge handle (right-anchored panel) widens when the mouse moves
      // LEFT, so its width delta is inverted versus the default right-edge handle.
      let newWidth = startRef.current.width + (handleEdge === "left" ? -deltaX : deltaX);
      let newHeight = startRef.current.height + deltaY;
      if (minWidth !== undefined) newWidth = Math.max(newWidth, minWidth);
      if (minHeight !== undefined) newHeight = Math.max(newHeight, minHeight);
      if (maxWidth !== undefined) newWidth = Math.min(newWidth, maxWidth);
      if (maxHeight !== undefined) newHeight = Math.min(newHeight, maxHeight);
      setSize({ width: newWidth, height: newHeight });
      onResize?.({ width: newWidth, height: newHeight });
    },
    [handleEdge, minWidth, minHeight, maxWidth, maxHeight, onResize]
  );

  const onMouseUp = useCallback(() => {
    isResizingRef.current = false;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  }, []);

  return { size, onResizeMouseDown: onResizeMouseDown, isResizing: isResizingRef.current };
}

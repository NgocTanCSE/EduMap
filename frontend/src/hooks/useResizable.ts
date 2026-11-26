"use client";
import { useCallback, useEffect, useRef, useState } from "react";
export interface UseResizableReturn {
    size: {
        width: number;
        height: number;
    };
    onResizeMouseDown: (e: React.MouseEvent) => void;
    isResizing: boolean;
}
const findTouch = (list: TouchList, id: number | null) => {
    if (id === null)
        return null;
    for (let i = 0; i < list.length; i++) {
        if (list[i].identifier === id)
            return list[i];
    }
    return null;
};
const activeDragTouch = { id: null as number | null };
export function useResizable({ initialSize = { width: 320, height: 400 }, minWidth = 200, minHeight = 200, maxWidth, maxHeight, onResize, handleEdge = "right", }: {
    initialSize?: {
        width: number;
        height: number;
    };
    minWidth?: number;
    minHeight?: number;
    maxWidth?: number;
    maxHeight?: number;
    onResize?: (size: {
        width: number;
        height: number;
    }) => void;
    handleEdge?: "left" | "right";
} = {}): UseResizableReturn {
    const [size, setSize] = useState({ width: initialSize.width, height: initialSize.height });
    const sizeRef = useRef(size);
    sizeRef.current = size;
    const isResizingRef = useRef(false);
    const startRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
    const touchIdRef = useRef<number | null>(null);
    useEffect(() => {
        if (typeof window === "undefined")
            return;
        setSize((prev) => ({ ...prev, width: Math.min(prev.width, Math.max(0, window.innerWidth - 64)) }));
    }, []);
    const applyDelta = useCallback((deltaX: number, deltaY: number) => {
        let newWidth = startRef.current.width + (handleEdge === "left" ? -deltaX : deltaX);
        let newHeight = startRef.current.height + deltaY;
        if (minWidth !== undefined)
            newWidth = Math.max(newWidth, minWidth);
        if (minHeight !== undefined)
            newHeight = Math.max(newHeight, minHeight);
        if (typeof window !== "undefined")
            newWidth = Math.min(newWidth, Math.max(0, window.innerWidth - 64));
        if (maxWidth !== undefined)
            newWidth = Math.min(newWidth, maxWidth);
        if (maxHeight !== undefined)
            newHeight = Math.min(newHeight, maxHeight);
        setSize({ width: newWidth, height: newHeight });
        onResize?.({ width: newWidth, height: newHeight });
    }, [handleEdge, minWidth, minHeight, maxWidth, maxHeight, onResize]);
    const onMouseMove = useCallback((e: MouseEvent) => {
        if (!isResizingRef.current)
            return;
        applyDelta(e.clientX - startRef.current.x, e.clientY - startRef.current.y);
    }, [applyDelta]);
    const onMouseUp = useCallback(() => {
        isResizingRef.current = false;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
    }, [onMouseMove]);
    const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button !== 0)
            return;
        e.preventDefault();
        e.stopPropagation();
        isResizingRef.current = true;
        startRef.current = {
            x: e.clientX,
            y: e.clientY,
            width: sizeRef.current.width,
            height: sizeRef.current.height,
        };
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    }, [onMouseMove, onMouseUp]);
    const onTouchMove = useCallback((e: TouchEvent) => {
        if (!isResizingRef.current)
            return;
        const touch = findTouch(e.touches, touchIdRef.current) ?? findTouch(e.changedTouches, touchIdRef.current);
        if (!touch)
            return;
        e.preventDefault();
        applyDelta(touch.clientX - startRef.current.x, touch.clientY - startRef.current.y);
    }, [applyDelta]);
    const onTouchEnd = useCallback((e: TouchEvent) => {
        if (!isResizingRef.current)
            return;
        if (!findTouch(e.changedTouches, touchIdRef.current))
            return;
        isResizingRef.current = false;
        touchIdRef.current = null;
        activeDragTouch.id = null;
        document.removeEventListener("touchmove", onTouchMove);
        document.removeEventListener("touchend", onTouchEnd);
        document.removeEventListener("touchcancel", onTouchEnd);
    }, [onTouchMove]);
    const onTouchStart = useCallback((e: TouchEvent) => {
        if (isResizingRef.current || activeDragTouch.id !== null)
            return;
        const touch = e.touches[0];
        if (!touch)
            return;
        const target = touch.target instanceof Element ? touch.target : null;
        if (!target || !target.closest(".cursor-col-resize"))
            return;
        e.preventDefault();
        isResizingRef.current = true;
        touchIdRef.current = touch.identifier;
        activeDragTouch.id = touch.identifier;
        startRef.current = {
            x: touch.clientX,
            y: touch.clientY,
            width: sizeRef.current.width,
            height: sizeRef.current.height,
        };
        document.addEventListener("touchmove", onTouchMove, { passive: false });
        document.addEventListener("touchend", onTouchEnd);
        document.addEventListener("touchcancel", onTouchEnd);
    }, [onTouchMove, onTouchEnd]);
    useEffect(() => {
        document.addEventListener("touchstart", onTouchStart);
        return () => {
            document.removeEventListener("touchstart", onTouchStart);
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
            document.removeEventListener("touchmove", onTouchMove);
            document.removeEventListener("touchend", onTouchEnd);
            document.removeEventListener("touchcancel", onTouchEnd);
            if (touchIdRef.current !== null && activeDragTouch.id === touchIdRef.current)
                activeDragTouch.id = null;
            touchIdRef.current = null;
            isResizingRef.current = false;
        };
    }, [onTouchStart, onTouchMove, onTouchEnd, onMouseMove, onMouseUp]);
    return { size, onResizeMouseDown: onResizeMouseDown, isResizing: isResizingRef.current };
}

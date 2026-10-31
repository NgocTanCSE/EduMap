"use client";

import React, { createContext, useContext, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface DockContextType {
  mouseX: number | null;
  setMouseX: (x: number | null) => void;
}

const DockContext = createContext<DockContextType>({
  mouseX: null,
  setMouseX: () => {},
});

export interface DockProps {
  className?: string;
  children: React.ReactNode;
  direction?: "bottom" | "top" | "middle";
}

export function Dock({ className, children, direction = "bottom" }: DockProps) {
  const [mouseX, setMouseX] = useState<number | null>(null);
  const dockRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (dockRef.current) {
      setMouseX(e.clientX);
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setMouseX(null);
  }, []);

  return (
    <DockContext.Provider value={{ mouseX, setMouseX }}>
      <div
        ref={dockRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={cn(
          "flex h-14 items-center gap-2 rounded-full border border-border/80 bg-card/85 px-3 py-1.5 shadow-pop backdrop-blur-xl transition-all duration-200",
          direction === "middle" && "items-center",
          direction === "top" && "items-start",
          direction === "bottom" && "items-end",
          className
        )}
      >
        {children}
      </div>
    </DockContext.Provider>
  );
}

export interface DockIconProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: number;
  magnification?: number;
  distance?: number;
  children: React.ReactNode;
}

export function DockIcon({
  size = 40,
  magnification = 56,
  distance = 120,
  className,
  children,
  ...props
}: DockIconProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { mouseX } = useContext(DockContext);

  let currentSize = size;
  if (mouseX !== null && ref.current) {
    const rect = ref.current.getBoundingClientRect();
    const iconCenterX = rect.left + rect.width / 2;
    const dist = Math.abs(mouseX - iconCenterX);

    if (dist < distance) {
      const factor = (distance - dist) / distance;
      currentSize = size + (magnification - size) * Math.sin((factor * Math.PI) / 2);
    }
  }

  return (
    <div
      ref={ref}
      style={{
        width: `${currentSize}px`,
        height: `${currentSize}px`,
      }}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full transition-all duration-150 ease-out",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export default Dock;


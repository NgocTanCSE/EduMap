"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface TextAnimateProps {
  text?: string;
  children?: string;
  className?: string;
  type?: "words" | "letters";
  delay?: number;
  as?: React.ElementType;
}

export function TextAnimate({
  text,
  children,
  className,
  type = "words",
  delay = 0.04,
  as: Component = "span",
}: TextAnimateProps) {
  const content = text ?? children ?? "";
  const items = type === "words" ? content.split(" ") : content.split("");

  return (
    <Component className={cn("inline-flex flex-wrap", className)}>
      {items.map((item, index) => (
        <span
          key={index}
          className={cn(
            "inline-block animate-slide-up",
            type === "words" && index < items.length - 1 && "mr-[0.28em]"
          )}
          style={{
            animationDelay: `${index * delay}s`,
            animationFillMode: "backwards",
          }}
        >
          {item}
        </span>
      ))}
    </Component>
  );
}

export default TextAnimate;

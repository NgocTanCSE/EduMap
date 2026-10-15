import * as React from "react";
import { cn } from "../../lib/utils";

/* Desert Dusk amber/sage palette — replaces AI generic Unsplash placeholders */
const PALETTE = [
  "#4B3F72",
  "#E07A5F",
  "#81B29A",
  "#F2CC94",
  "#6B5D7B",
  "#A3D4CA",
  "#C4A484",
  "#5A7D7C",
];

/**
 * Image with a deterministic branded fallback (seeded color from the title's
 * first letter) — used instead of `images.unsplash.com/...` stock placeholders.
 */
export default function Thumb({
  src,
  alt,
  aspect = "16/10",
  className,
}: {
  src?: string;
  alt: string;
  aspect?: string;
  className?: string;
}) {
  const bg = React.useMemo(() => {
    let h = 0;
    for (let i = 0; i < alt.length; i++) h = (h * 31 + alt.charCodeAt(i)) | 0;
    return PALETTE[Math.abs(h) % PALETTE.length];
  }, [alt]);

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={cn("w-full h-full object-cover rounded-lg", className)}
        style={{ aspectRatio: aspect }}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex items-center justify-center font-semibold text-white/85 rounded-lg",
        className
      )}
      style={{ aspectRatio: aspect, backgroundColor: bg }}
    >
      {alt?.charAt(0) || "\u00b7"}
    </div>
  );
}

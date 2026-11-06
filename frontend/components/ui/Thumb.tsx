import * as React from "react";
import { cn } from "@/src/lib/utils";
import { avatarInitials, placeholderColors } from "@/src/lib/illustrations";
export default function Thumb({ src, fallbackSrc, alt, aspect = "16/10", className, }: {
    src?: string;
    fallbackSrc?: string;
    alt: string;
    aspect?: string;
    className?: string;
}) {
    const [from, to] = React.useMemo(() => placeholderColors(alt), [alt]);
    const initials = React.useMemo(() => avatarInitials(alt), [alt]);
    const [current, setCurrent] = React.useState(src || "");
    React.useEffect(() => setCurrent(src || ""), [src]);
    const fb = fallbackSrc || "/images/default-content.svg";
    if (current) {
        return (<img src={current} alt={alt} className={cn("w-full h-full object-cover rounded-lg", className)} style={{ aspectRatio: aspect }} onError={() => setCurrent((prev) => (prev && prev !== fb ? fb || "" : ""))}/>);
    }
    return (<div className={cn("relative flex w-full flex-col items-center justify-center overflow-hidden rounded-lg text-white", className)} style={{
            aspectRatio: aspect,
            backgroundImage: `radial-gradient(circle at 18% 12%, rgba(255,255,255,0.16), transparent 42%), radial-gradient(circle at 84% 88%, rgba(0,0,0,0.24), transparent 46%), linear-gradient(135deg, ${from}, ${to})`,
        }} role="img" aria-label={alt}>
      <span className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full border border-white/10"/>
      <span className="pointer-events-none absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-white/5"/>
      <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/10 text-xl font-bold tracking-wide text-white/95 backdrop-blur-sm">
        {initials}
      </span>
      <span className="mt-3 line-clamp-2 max-w-[85%] text-center text-xs font-semibold leading-snug text-white/80">
        {alt}
      </span>
    </div>);
}

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Map as MapIcon,
  MessageSquareText,
  LayoutGrid,
  Search,
  ArrowUp,
  SlidersHorizontal,
  ChevronDown,
  Sparkles,
  BookOpen,
  User,
} from "lucide-react";
import { Dock, DockIcon } from "./Dock";
import AnimatedThemeToggler from "./AnimatedThemeToggler";
import { cn } from "@/lib/utils";

export interface QuickDockProps {
  className?: string;
}

export function QuickDock({ className }: QuickDockProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(pathname?.startsWith("/map") ?? false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Show scroll-to-top button when user scrolls down
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (collapsed) {
    return (
      <div className={cn("fixed bottom-5 right-5 z-40 transition-all duration-300", className)}>
        <button
          onClick={() => setCollapsed(false)}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border/80 bg-card/90 text-primary shadow-pop backdrop-blur-xl transition-all duration-200 hover:scale-105 hover:bg-card"
          title="Mở thanh tùy chỉnh nhanh (Dock)"
          aria-label="Mở thanh tùy chỉnh nhanh"
        >
          <SlidersHorizontal className="h-5 w-5" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 transition-all duration-300",
        className
      )}
    >
      <Dock className="shadow-pop border border-border/80 bg-card/90 backdrop-blur-xl">
        {/* Animated Theme Toggler */}
        <DockIcon>
          <AnimatedThemeToggler size="sm" className="border-0 bg-transparent shadow-none hover:bg-secondary/80" />
        </DockIcon>

        <div className="h-6 w-px bg-border/60 mx-0.5" />

        {/* AI Chat Shortcut */}
        <DockIcon>
          <Link
            href="/ai-chat"
            className={cn(
              "flex h-full w-full items-center justify-center rounded-full transition-colors",
              pathname === "/ai-chat"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
            title="Trò chuyện AI (EduMap Assistant)"
          >
            <MessageSquareText className="h-5 w-5" />
          </Link>
        </DockIcon>

        {/* Map Hub Shortcut */}
        <DockIcon>
          <Link
            href="/map"
            className={cn(
              "flex h-full w-full items-center justify-center rounded-full transition-colors",
              pathname === "/map"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
            title="Bản đồ giáo dục Biên Hòa (/map)"
          >
            <MapIcon className="h-5 w-5" />
          </Link>
        </DockIcon>

        {/* Features Hub Shortcut */}
        <DockIcon>
          <Link
            href="/features"
            className={cn(
              "flex h-full w-full items-center justify-center rounded-full transition-colors",
              pathname === "/features"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
            title="Trung tâm tính năng (/features)"
          >
            <LayoutGrid className="h-5 w-5" />
          </Link>
        </DockIcon>

        {/* Library Shortcut */}
        <DockIcon>
          <Link
            href="/library"
            className={cn(
              "flex h-full w-full items-center justify-center rounded-full transition-colors",
              pathname === "/library"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
            title="Thư viện học liệu (/library)"
          >
            <BookOpen className="h-5 w-5" />
          </Link>
        </DockIcon>

        {/* Profile Shortcut */}
        <DockIcon>
          <Link
            href="/profile"
            className={cn(
              "flex h-full w-full items-center justify-center rounded-full transition-colors",
              pathname === "/profile"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
            title="Hồ sơ cá nhân (/profile)"
          >
            <User className="h-5 w-5" />
          </Link>
        </DockIcon>

        {/* Scroll to Top (when scrolled) */}
        {showScrollTop && (
          <DockIcon>
            <button
              onClick={scrollToTop}
              className="flex h-full w-full items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              title="Cuộn lên đầu trang"
            >
              <ArrowUp className="h-5 w-5" />
            </button>
          </DockIcon>
        )}

        <div className="h-6 w-px bg-border/60 mx-0.5" />

        {/* Collapse button */}
        <DockIcon>
          <button
            onClick={() => setCollapsed(true)}
            className="flex h-full w-full items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            title="Thu gọn Dock"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </DockIcon>
      </Dock>
    </div>
  );
}

export default QuickDock;

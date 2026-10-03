'use client';
import React from 'react';
import { usePathname } from 'next/navigation';
import { EduMapWordmark } from '@/components/ui/Logo';

export default function Footer() {
  const pathname = usePathname();
  // Footer does not render on full-screen map or auth pages
  if (pathname === '/map' || pathname?.startsWith('/map') || pathname?.startsWith('/auth')) return null;

  return (
    <footer className="border-t border-border bg-card py-12 px-4 mt-auto">
      <div className="mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Brand */}
        <div className="space-y-4">
          <EduMapWordmark className="text-lg font-bold tracking-tight" iconClassName="h-6 w-6" />
          <p className="text-sm text-muted-foreground leading-relaxed">
            Bản đồ Giáo dục Thông minh EduMap 2.0. Nền tảng tra cứu học tập địa lý, kết nối Mentorship, chia sẻ tài liệu và quản trị cộng đồng học tập toàn diện.
          </p>
        </div>

        {/* Explore Links */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold tracking-wider uppercase text-muted-foreground/60">Khám phá</h4>
          <ul className="space-y-2 text-sm text-muted-foreground/80">
            <li><a href="/map" className="hover:text-primary transition-colors">Bản đồ số</a></li>
            <li><a href="/library" className="hover:text-primary transition-colors">Thư viện điện tử</a></li>
            <li><a href="/mentor" className="hover:text-primary transition-colors">Kết nối Mentors</a></li>
            <li><a href="/scholarships" className="hover:text-primary transition-colors">Cổng học bổng</a></li>
          </ul>
        </div>

        {/* Community Links */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold tracking-wider uppercase text-muted-foreground/60">Cộng đồng</h4>
          <ul className="space-y-2 text-sm text-muted-foreground/80">
            <li><a href="/community" className="hover:text-primary transition-colors">Học nhóm &amp; Diễn đàn</a></li>
            <li><a href="/green" className="hover:text-primary transition-colors">Thử thách Campus Xanh</a></li>
            <li><a href="/marketplace" className="hover:text-primary transition-colors">Chợ tài liệu &amp; Sách cũ</a></li>
            <li><a href="/donate" className="hover:text-primary transition-colors">Quyên góp gây quỹ</a></li>
          </ul>
        </div>

        {/* AI & Career Links */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold tracking-wider uppercase text-muted-foreground/60">Định hướng &amp; AI</h4>
          <ul className="space-y-2 text-sm text-muted-foreground/80">
            <li><a href="/ai-chat" className="hover:text-primary transition-colors">Hỏi đáp AI Assistant</a></li>
            <li><a href="/career" className="hover:text-primary transition-colors">Bản đồ nghề nghiệp</a></li>
            <li><a href="/analytics" className="hover:text-primary transition-colors">Báo cáo &amp; Xu hướng</a></li>
            <li><a href="/certificates" className="hover:text-primary transition-colors">Blockchain E-Portfolio</a></li>
          </ul>
        </div>
      </div>

      <div className="mx-auto max-w-7xl border-t border-border mt-8 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground/60">
        <p>&copy; 2026 EduMap. Thiết kế bởi Lê Ngọc Tân.</p>
        <div className="flex gap-4">
          <a href="#" className="hover:text-foreground transition-colors">Điều khoản</a>
          <a href="#" className="hover:text-foreground transition-colors">Bảo mật</a>
          <a href="#" className="hover:text-foreground transition-colors">Liên hệ</a>
        </div>
      </div>
    </footer>
  );
}

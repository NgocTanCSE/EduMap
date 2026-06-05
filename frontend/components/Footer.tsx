import React from 'react';

export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-card py-12 px-4 mt-auto">
      <div className="mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Brand */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-yellow-600 text-white font-extrabold">🎓</span>
            <span>Edu<span className="text-yellow-500">Map</span></span>
          </div>
          <p className="text-xs text-foreground/50 leading-relaxed">
            Bản đồ Giáo dục Thông minh EduMap 2.0. Nền tảng tra cứu học tập địa lý, kết nối Mentorship, chia sẻ tài liệu và quản trị cộng đồng học tập toàn diện.
          </p>
        </div>

        {/* Explore Links */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold tracking-wider uppercase text-foreground/40">Khám phá</h4>
          <ul className="space-y-2 text-xs text-foreground/75">
            <li><a href="/map" className="hover:text-yellow-500 transition-colors">Bản đồ số</a></li>
            <li><a href="/library" className="hover:text-yellow-500 transition-colors">Thư viện điện tử</a></li>
            <li><a href="/mentor" className="hover:text-yellow-500 transition-colors">Kết nối Mentors</a></li>
            <li><a href="/scholarships" className="hover:text-yellow-500 transition-colors">Cổng học bổng</a></li>
          </ul>
        </div>

        {/* Community Links */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold tracking-wider uppercase text-foreground/40">Cộng đồng</h4>
          <ul className="space-y-2 text-xs text-foreground/75">
            <li><a href="/community" className="hover:text-yellow-500 transition-colors">Học nhóm & Diễn đàn</a></li>
            <li><a href="/green" className="hover:text-yellow-500 transition-colors">Thử thách Campus Xanh</a></li>
            <li><a href="/marketplace" className="hover:text-yellow-500 transition-colors">Chợ tài liệu & Sách cũ</a></li>
            <li><a href="/donate" className="hover:text-yellow-500 transition-colors">Quyên góp gây quỹ</a></li>
          </ul>
        </div>

        {/* AI & Career Links */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold tracking-wider uppercase text-foreground/40">Định hướng & AI</h4>
          <ul className="space-y-2 text-xs text-foreground/75">
            <li><a href="/ai-chat" className="hover:text-yellow-500 transition-colors">Hỏi đáp AI Assistant</a></li>
            <li><a href="/career" className="hover:text-yellow-500 transition-colors">Bản đồ nghề nghiệp</a></li>
            <li><a href="/analytics" className="hover:text-yellow-500 transition-colors">Báo cáo & Xu hướng</a></li>
            <li><a href="/certificates" className="hover:text-yellow-500 transition-colors">Blockchain E-Portfolio</a></li>
          </ul>
        </div>
      </div>

      <div className="mx-auto max-w-7xl border-t border-white/5 mt-8 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-foreground/40">
        <p>© 2026 EduMap. Thiết kế Storefront bởi Lê Ngọc Tân.</p>
        <div className="flex gap-4">
          <a href="#" className="hover:text-foreground transition-colors">Điều khoản</a>
          <a href="#" className="hover:text-foreground transition-colors">Bảo mật</a>
          <a href="#" className="hover:text-foreground transition-colors">Liên hệ</a>
        </div>
      </div>
    </footer>
  );
}

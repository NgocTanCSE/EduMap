import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { 
  Map as MapIcon, 
  MessageSquare, 
  Library, 
  Target, 
  ShieldCheck, 
  Zap, 
  Users, 
  Award, 
  Globe, 
  Sparkles,
  BookOpen,
  HeartHandshake,
  Building2,
  GraduationCap,
  LayoutDashboard,
  ShieldAlert,
  ArrowRight,
  BookmarkCheck,
  CheckCircle,
  HelpCircle,
  FileText
} from 'lucide-react';

export default function Home() {
  const storefrontSections = [
    {
      title: "🌍 Khám phá & Định vị Không gian",
      desc: "Hệ thống định vị thông minh giúp bạn tìm kiếm mọi địa điểm và hỗ trợ học tập quanh khu vực.",
      color: "from-blue-500/20 to-cyan-500/20 border-blue-500/30",
      items: [
        { name: "Bản đồ Tương tác", href: "/map", desc: "Tìm trường học, thư viện, stem-labs, trạm wifi miễn phí bằng bán kính địa lý PostGIS ST_DWithin.", icon: MapIcon },
        { name: "Thư viện Tài liệu", href: "/library", desc: "Kho tài liệu điện tử, đề thi thử, podcast học thuật chia sẻ hoàn toàn miễn phí.", icon: Library },
        { name: "Kết nối Mentors", href: "/mentor", desc: "Đặt lịch tư vấn 1-on-1 trực tiếp, hỗ trợ họp trực tuyến call video WebRTC tiện lợi.", icon: Users },
        { name: "Cổng Học bổng", href: "/scholarships", desc: "Hệ thống gợi ý & kiểm tra tự động điều kiện ứng tuyển học bổng toàn cầu.", icon: GraduationCap },
        { name: "Cơ hội Thực tập", href: "/internships", desc: "Kết nối thực tế doanh nghiệp với các tin đăng tuyển dụng thực tập sinh uy tín.", icon: Building2 },
      ]
    },
    {
      title: "🌱 Cộng đồng Kết nối & Hành động Xanh",
      desc: "Tham gia thảo luận nhóm học tập, chia sẻ giáo trình và đóng góp các hoạt động bảo vệ môi trường campus.",
      color: "from-emerald-500/20 to-green-500/20 border-emerald-500/30",
      items: [
        { name: "Diễn đàn Học tập", href: "/community", desc: "Tìm đồng đội dự án học tập, tham gia diễn đàn thảo luận nhóm học tập sôi nổi.", icon: Globe },
        { name: "Green Campus", href: "/green", desc: "Sân chơi đổi rác tái chế lấy Green Points, thử thách xanh bảo vệ môi trường campus.", icon: Sparkles },
        { name: "Trao đổi Sách cũ", href: "/marketplace", desc: "Chợ chia sẻ tài liệu cũ, trao đổi giáo trình đã qua sử dụng và đồ dùng học tập.", icon: BookOpen },
        { name: "Quyên góp Đồng hành", href: "/donate", desc: "Đồng hành và gây quỹ thiện nguyện giúp đỡ trẻ em nghèo vùng sâu khó khăn học tập.", icon: HeartHandshake },
      ]
    },
    {
      title: "🤖 Trí tuệ Nhân tạo AI & Định hướng Lộ trình",
      desc: "Công nghệ AI định hướng sự nghiệp, phân tích thị trường lao động và cấp chứng chỉ số Blockchain uy tín.",
      color: "from-violet-500/20 to-purple-500/20 border-violet-500/30",
      items: [
        { name: "AI Chatbot Assistant", href: "/ai-chat", desc: "Trợ lý ảo thông minh giải đáp kiến thức và định hướng học tập tự động 24/7.", icon: MessageSquare },
        { name: "Lộ trình Nghề nghiệp", href: "/career", desc: "Làm trắc nghiệm gợi ý ngành nghề phù hợp & vẽ sơ đồ phát triển kỹ năng chi tiết.", icon: Target },
        { name: "Dự báo & Xu hướng", href: "/analytics", desc: "Xem báo cáo biểu đồ trực quan, phân tích nhu cầu tuyển dụng các ngành nghề hot.", icon: LayoutDashboard },
        { name: "Chứng chỉ Portfolio", href: "/certificates", desc: "Tự động cấp chứng nhận Blockchain E-Portfolio uy tín chứng minh năng lực cá nhân.", icon: Award },
      ]
    }
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background/95 to-background text-foreground pb-24">
      {/* Top Banner Hero Showcase */}
      <div className="relative overflow-hidden py-24 px-4 sm:px-6 lg:px-8 border-b border-white/5 bg-gradient-to-r from-blue-600/10 via-purple-600/5 to-transparent">
        <div className="mx-auto max-w-7xl text-center space-y-8 relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 text-blue-500 text-sm font-semibold border border-blue-500/20 shadow-sm animate-pulse mb-4">
            ✨ Phiên bản Storefront Hệ thống Đồng bộ Chức năng
          </div>
          
          <h1 className="text-4xl sm:text-6xl md:text-8xl font-black tracking-tight leading-none">
            Mọi Chức năng Học tập <br />
            <span className="bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 bg-clip-text text-transparent">
              Trong Tầm tay Bạn
            </span>
          </h1>

          <p className="mx-auto max-w-3xl text-lg sm:text-xl text-foreground/70 leading-relaxed">
            EduMap Storefront là cổng thông tin tổng hợp giúp bạn tiếp cận trực tiếp tất cả 18 tính năng giáo dục thông minh. Khám phá bản đồ, kết nối mentor, chia sẻ tài liệu và nhận chứng chỉ blockchain của riêng bạn.
          </p>

          {/* Quick CTAs */}
          <div className="flex flex-wrap gap-4 justify-center pt-6">
            <a href="/map">
              <button className="h-12 px-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-base font-medium shadow-lg shadow-blue-500/25 active:scale-95 transition-all flex items-center gap-2">
                Trải nghiệm Bản đồ <ArrowRight className="w-5 h-5" />
              </button>
            </a>
            <a href="/ai-chat">
              <button className="h-12 px-8 rounded-full border border-white/10 hover:bg-white/5 text-foreground text-base font-medium active:scale-95 transition-all flex items-center gap-2">
                Hỏi Trợ lý AI <MessageSquare className="w-5 h-5 text-blue-500" />
              </button>
            </a>
          </div>
        </div>

        {/* Decorative Blurred Orbs */}
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-72 h-72 rounded-full bg-blue-500/10 blur-3xl pointer-events-none"></div>
        <div className="absolute top-1/3 right-1/4 -translate-y-1/2 w-96 h-96 rounded-full bg-purple-500/10 blur-3xl pointer-events-none"></div>
      </div>

      {/* Stats Board */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-8 relative z-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 sm:p-8 rounded-3xl border border-white/10 bg-zinc-900/60 backdrop-blur-xl shadow-xl">
          <div className="text-center md:border-r border-white/5 py-2">
            <div className="text-3xl sm:text-4xl font-extrabold text-blue-500">100+</div>
            <div className="text-xs sm:text-sm text-foreground/50 font-medium mt-1">Ghim PostGIS Đã Seed</div>
          </div>
          <div className="text-center md:border-r border-white/5 py-2">
            <div className="text-3xl sm:text-4xl font-extrabold text-emerald-500">100+</div>
            <div className="text-xs sm:text-sm text-foreground/50 font-medium mt-1">Học liệu Đã Nạp</div>
          </div>
          <div className="text-center md:border-r border-white/5 py-2">
            <div className="text-3xl sm:text-4xl font-extrabold text-indigo-500">100+</div>
            <div className="text-xs sm:text-sm text-foreground/50 font-medium mt-1">Tài khoản & Nhóm Học</div>
          </div>
          <div className="text-center py-2">
            <div className="text-3xl sm:text-4xl font-extrabold text-violet-500">100%</div>
            <div className="text-xs sm:text-sm text-foreground/50 font-medium mt-1">PostgreSQL & PostGIS Sẵn sàng</div>
          </div>
        </div>
      </div>

      {/* Storefront Feature Grid Showcase */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-24 space-y-16">
        {storefrontSections.map((section, idx) => (
          <div key={idx} className="space-y-6">
            <div className="border-l-4 border-blue-500 pl-4 space-y-1">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{section.title}</h2>
              <p className="text-sm sm:text-base text-foreground/60 max-w-4xl">{section.desc}</p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {section.items.map((item, itemIdx) => {
                const IconComponent = item.icon;
                return (
                  <a 
                    key={itemIdx}
                    href={item.href}
                    className={`flex flex-col justify-between p-6 rounded-3xl border border-white/5 bg-zinc-900/40 hover:bg-zinc-900/90 transition-all hover:shadow-lg hover:scale-[1.02] group bg-gradient-to-br ${section.color}`}
                  >
                    <div className="space-y-4">
                      <span className="flex w-12 h-12 items-center justify-center rounded-2xl bg-white/5 text-foreground border border-white/10 group-hover:bg-blue-600 group-hover:text-white transition-all group-hover:rotate-6">
                        <IconComponent className="w-6 h-6" />
                      </span>
                      <div className="space-y-1">
                        <h3 className="text-lg font-bold tracking-tight group-hover:text-blue-500 transition-colors">
                          {item.name}
                        </h3>
                        <p className="text-sm text-foreground/65 leading-relaxed">
                          {item.desc}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-xs font-semibold text-blue-500 mt-6 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span>Truy cập chức năng</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
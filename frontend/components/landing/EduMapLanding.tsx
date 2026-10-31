'use client';

import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  BookOpen,
  Briefcase,
  Building2,
  Check,
  Compass,
  Flame,
  GraduationCap,
  LayoutDashboard,
  Map as MapIcon,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
  Wifi,
  X,
  type LucideIcon,
} from 'lucide-react';
import { EduMapLogo } from '@/components/ui/Logo';
import { TextAnimate } from '@/components/ui/magic/TextAnimate';
import { cn } from '@/lib/utils';
import styles from './landing.module.css';

type HeroTab = {
  id: string;
  label: string;
  path: string;
  Icon: LucideIcon;
  kicker: string;
};

const NAV_LINKS = [
  { href: '#gioi-thieu', label: 'Giới thiệu' },
  { href: '#so-lieu', label: 'Số liệu hệ sinh thái' },
  { href: '#tinh-nang', label: 'Tính năng' },
  { href: '#bat-dau', label: 'Bắt đầu' },
];

const HERO_TABS: HeroTab[] = [
  {
    id: 'map',
    label: 'Bản đồ giáo dục',
    path: '/map',
    Icon: MapIcon,
    kicker: '184+ Điểm trường & Trạm WiFi',
  },
  {
    id: 'career',
    label: 'Lộ trình nghề nghiệp',
    path: '/career',
    Icon: Compass,
    kicker: '85+ Lộ trình chuẩn STEM',
  },
  {
    id: 'ai',
    label: 'Trợ lý AI chuyên sâu',
    path: '/ai-chat',
    Icon: Sparkles,
    kicker: 'Hỏi đáp học bổng & Tuyển sinh',
  },
  {
    id: 'dashboard',
    label: 'EduPass cá nhân',
    path: '/dashboard',
    Icon: LayoutDashboard,
    kicker: 'Thẻ thông hành số hóa',
  },
];

const ECOSYSTEM_METRICS = [
  {
    value: '184+',
    label: 'Điểm trường & Đào tạo',
    desc: 'Bao phủ từ Mầm non đến Đại học tại Biên Hòa',
    icon: Building2,
  },
  {
    value: '45+',
    label: 'Thư viện & Không gian STEM',
    desc: 'Hơn 120.000 đầu sách số & phòng máy tính',
    icon: BookOpen,
  },
  {
    value: '120+',
    label: 'Suất học bổng Đồng Nai',
    desc: 'Học bổng khuyến tài & hỗ trợ doanh nghiệp 2026',
    icon: Award,
  },
  {
    value: '35+',
    label: 'Trạm WiFi công cộng',
    desc: 'Tốc độ 150 Mbps tại công viên & nhà văn hóa',
    icon: Wifi,
  },
  {
    value: '85+',
    label: 'Lộ trình nghề nghiệp',
    desc: 'Kết nối việc làm tại các KCN Biên Hòa & Amata',
    icon: Briefcase,
  },
  {
    value: '100%',
    label: 'Miễn phí & Nguồn mở',
    desc: 'Dữ liệu kiểm chứng từ Sở GD&ĐT Đồng Nai',
    icon: ShieldCheck,
  },
];

const INTRO_STEPS = [
  {
    number: '01',
    title: 'Khám phá',
    text: 'Tìm trường học, thư viện, phòng lab STEM và trạm WiFi công cộng quanh bạn.',
  },
  {
    number: '02',
    title: 'Định hướng',
    text: 'Hiểu rõ kỹ năng, nghề nghiệp và lộ trình phù hợp với mục tiêu tuyển dụng.',
  },
  {
    number: '03',
    title: 'Kết nối',
    text: 'Hỏi AI, tìm mentor 1-1 và mở ra cơ hội học tập, thực tập tại Đồng Nai.',
  },
];

const FEATURES_DATA = [
  {
    id: 'map',
    question: 'Học ở đâu quanh Biên Hòa?',
    kicker: 'GIS & ĐỊA ĐIỂM HỌC TẬP',
    title: 'Bản đồ số Giáo dục Biên Hòa',
    subtitle: '184+ Trường học, Thư viện & Trạm WiFi',
    badge: 'Thời gian thực',
    description:
      'Tích hợp toàn bộ mạng lưới trường học, thư viện số, không gian STEM và điểm WiFi miễn phí. Tra cứu bán kính di chuyển và cảnh báo ngập úng mùa mưa.',
    tags: ['Bán kính 1-10 km', 'Chỉ đường tối ưu', 'Cảnh báo ngập lụt', 'OpenStreetMap'],
    points: [
      'Tìm trường học & thư viện gần nhất theo vị trí GPS thực tế',
      'Xem giờ mở cửa, phòng máy tính và chất lượng đường truyền internet',
    ],
    metric: '184 điểm trường · 35 trạm WiFi 150Mbps',
    Icon: MapIcon,
    href: '/map',
  },
  {
    id: 'career',
    question: 'Học kỹ năng nào để có việc làm tại KCN?',
    kicker: 'ĐỊNH HƯỚNG TƯƠNG LAI',
    title: 'Lộ trình nghề nghiệp & Việc làm KCN',
    subtitle: '85+ Lộ trình chuẩn hóa kết nối doanh nghiệp',
    badge: 'Dự báo 2026',
    description:
      'Kết nối nhu cầu nhân lực tại các khu công nghiệp Biên Hòa, Amata và Long Thành với các lộ trình từng bước rõ ràng, kèm cơ hội thực tập và kết nối Mentor 1-1.',
    tags: ['85+ Lộ trình STEM', 'Việc làm KCN Biên Hòa', 'Cố vấn 1-1', 'Tham chiếu lương'],
    points: [
      'Lộ trình kỹ năng từng bước từ kiến thức nền tảng đến đồ án thực tế',
      'Bảng lương tham chiếu và cơ hội thực tập tại doanh nghiệp công nghệ',
    ],
    metric: '1.200+ Vị trí việc làm & thực tập liên kết',
    Icon: Compass,
    href: '/career',
  },
  {
    id: 'ai',
    question: 'Hỏi ai khi gặp khó về tuyển sinh & học bổng?',
    kicker: 'TRÍ TUỆ NHÂN TẠO CHUYÊN SÂU',
    title: 'Trợ lý AI học tập & Săn học bổng',
    subtitle: 'Mô hình RAG chuyên sâu tuyển sinh Việt Nam',
    badge: '100% Tiếng Việt',
    description:
      'Trợ lý ảo được tinh chỉnh chuyên sâu về quy chế tuyển sinh, học bổng Đồng Nai và giáo trình quốc tế. Trả lời tự nhiên bằng tiếng Việt và hỗ trợ Offline không cần mạng.',
    tags: ['RAG Tiếng Việt', '120+ Học bổng 2026', 'Offline Tutor', 'Dịch thuật học thuật'],
    points: [
      'Tư vấn chọn ngành và tìm học bổng phù hợp theo năng lực, hoàn cảnh',
      'Chế độ Offline Tutor chạy trực tiếp trên máy không gián đoạn',
    ],
    metric: '120+ Gói học bổng · Phản hồi < 500ms',
    Icon: Sparkles,
    href: '/ai-chat',
  },
  {
    id: 'dashboard',
    question: 'Theo dõi chứng chỉ & lộ trình ra sao?',
    kicker: 'HÀNH TRÌNH HỌC TẬP SỐ',
    title: 'Thẻ EduPass & Bảng điều khiển số',
    subtitle: 'Đồng bộ không gian học tập & Chứng chỉ',
    badge: 'Định danh số',
    description:
      'Thẻ học tập điện tử EduMap Digital Pass định danh duy nhất. Tích hợp hồ sơ năng lực số, theo dõi mục tiêu học tập hàng ngày và đồng bộ với các trạm thư viện liên kết.',
    tags: ['EduPass Digital ID', 'Giờ học & XP', 'Lịch hẹn Mentor', 'Ví chứng chỉ'],
    points: [
      'Check-in tại các trạm thư viện liên kết qua thẻ định danh số hóa',
      'Theo dõi mục tiêu học tập, chuỗi ngày streak và điểm tích lũy',
    ],
    metric: '14 Trạm thư viện tích hợp · Bảo mật 100%',
    Icon: LayoutDashboard,
    href: '/dashboard',
  },
];

export default function EduMapLanding() {
  const [activeTab, setActiveTab] = useState('map');
  const [mobileOpen, setMobileOpen] = useState(false);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  const active = HERO_TABS.find((tab) => tab.id === activeTab) ?? HERO_TABS[0];

  useEffect(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduce || !('IntersectionObserver' in window)) {
      items.forEach((item) => item.classList.add(styles.revealed));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add(styles.revealed);
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.1 },
    );

    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileOpen]);

  const closeDrawer = () => {
    setMobileOpen(false);
    menuButtonRef.current?.focus();
  };

  const onTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % HERO_TABS.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + HERO_TABS.length) % HERO_TABS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = HERO_TABS.length - 1;
    else return;

    event.preventDefault();
    setActiveTab(HERO_TABS[next].id);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#main">
        Chuyển tới nội dung
      </a>

      {/* ── TOP NAVIGATION ────────────────────────────────────────────── */}
      <header className={styles.nav}>
        <div className={styles.navInner}>
          <Link href="/" className={styles.brand} aria-label="EduMap — trang chủ">
            <EduMapLogo className={styles.brandIcon} />
            <span>
              Edu<span className={styles.brandAccent}>Map</span>
            </span>
          </Link>

          <nav className={styles.navLinks} aria-label="Điều hướng chính">
            {NAV_LINKS.map((link) => (
              <a key={link.href} className={styles.navLink} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Link
              href="/map"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border/80 bg-card px-3.5 text-xs font-semibold text-foreground shadow-xs transition-all hover:bg-secondary"
            >
              <MapIcon className="h-3.5 w-3.5 text-primary" />
              Mở bản đồ
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-xs transition-all hover:bg-primary/90"
            >
              Đăng nhập
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <button
            ref={menuButtonRef}
            type="button"
            className={styles.menuButton}
            aria-label="Mở menu điều hướng"
            aria-expanded={mobileOpen}
            aria-controls="landing-mobile-menu"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* ── MOBILE DRAWER ─────────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          id="landing-mobile-menu"
          className={styles.drawer}
          role="dialog"
          aria-modal="true"
          aria-label="Menu điều hướng EduMap"
        >
          <div className={styles.drawerTop}>
            <Link href="/" className={styles.brand} onClick={closeDrawer}>
              <EduMapLogo className={styles.brandIcon} />
              <span>
                Edu<span className={styles.brandAccent}>Map</span>
              </span>
            </Link>
            <button
              type="button"
              className={styles.drawerClose}
              aria-label="Đóng menu"
              onClick={closeDrawer}
              autoFocus
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className={styles.drawerNav} aria-label="Điều hướng di động">
            {NAV_LINKS.map((link) => (
              <a key={link.href} className={styles.drawerLink} href={link.href} onClick={closeDrawer}>
                {link.label}
                <span aria-hidden="true">→</span>
              </a>
            ))}
          </nav>

          <div className="mt-6 space-y-3 px-6">
            <Link
              href="/map"
              onClick={closeDrawer}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-semibold text-foreground shadow-xs"
            >
              <MapIcon className="h-4 w-4 text-primary" /> Khám phá bản đồ
            </Link>
            <Link
              href="/auth/login"
              onClick={closeDrawer}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-xs"
            >
              Đăng nhập ngay <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <p className={styles.drawerNote}>
            EduMap · Bản đồ giáo dục thông minh Biên Hòa, Đồng Nai.
          </p>
        </div>
      )}

      <main id="main">
        {/* ── HERO SECTION ────────────────────────────────────────────── */}
        <section className={styles.hero}>
          <div className={styles.heroPanel}>
            <div className={styles.heroCopy}>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-card/85 px-4 py-1.5 text-xs font-semibold text-primary shadow-xs">
                <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
                <TextAnimate text="Bản đồ số giáo dục thông minh Biên Hòa 2026" type="words" delay={0.03} />
              </div>

              {/* Title with Metallic Gradient Shimmer */}
              <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl leading-[1.08] text-center">
                <TextAnimate text="Khám phá tri thức." type="words" delay={0.04} />
                <br />
                <span className="bg-gradient-to-r from-primary via-amber-500 to-primary bg-[length:200%_auto] bg-clip-text text-transparent animate-shimmer">
                  <TextAnimate text="Định hướng tương lai." type="words" delay={0.07} />
                </span>
              </h1>

              {/* Centered Lede (Feedback 4: "chữ bị lệch" fixed with mx-auto text-center) */}
              <p className="mt-5 max-w-2xl mx-auto text-center text-base sm:text-lg text-muted-foreground leading-relaxed">
                EduMap kết nối bản đồ giáo dục hơn 184 điểm trường, mạng lưới thư viện số, lộ trình nghề nghiệp chuẩn
                STEM và trợ lý AI thông minh — tất cả trên cùng một nền tảng mở dành riêng cho Biên Hòa, Đồng Nai.
              </p>

              <div className="mt-7 flex flex-wrap items-center justify-center gap-3.5">
                <Link
                  href="/auth/login"
                  className="inline-flex h-12 items-center gap-2 rounded-2xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-orvel transition-all hover:bg-primary/90 hover:scale-[1.01] active:scale-[0.98]"
                >
                  Khám phá miễn phí ngay
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
                <Link
                  href="/map"
                  className="inline-flex h-12 items-center gap-2 rounded-2xl border border-border/80 bg-card/85 backdrop-blur-sm px-5 text-sm font-semibold text-foreground shadow-xs transition-colors hover:bg-secondary"
                >
                  <MapIcon className="h-4 w-4 text-primary" />
                  Xem bản đồ trực tuyến
                </Link>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5 font-medium">
                  <Check className="h-4 w-4 text-emerald-600" /> Miễn phí 100%
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <Check className="h-4 w-4 text-emerald-600" /> Không cần cài đặt
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <Check className="h-4 w-4 text-emerald-600" /> Dữ liệu kiểm chứng
                </span>
              </div>
            </div>

            {/* ── INTERACTIVE LIVE PREVIEW STAGE ─────── */}
            <div className={styles.stage}>
              {/* Tab Selector */}
              <div className={styles.tabs} role="tablist" aria-label="Xem sản phẩm EduMap">
                {HERO_TABS.map((tab, index) => {
                  const Icon = tab.Icon;
                  const selected = tab.id === active.id;
                  return (
                    <button
                      key={tab.id}
                      ref={(node) => {
                        tabRefs.current[index] = node;
                      }}
                      type="button"
                      role="tab"
                      id={`landing-tab-${tab.id}`}
                      aria-selected={selected}
                      aria-controls={`landing-panel-${tab.id}`}
                      tabIndex={selected ? 0 : -1}
                      className={`${styles.tab} ${selected ? styles.tabActive : ''}`}
                      onClick={() => setActiveTab(tab.id)}
                      onKeyDown={(event) => onTabKeyDown(event, index)}
                    >
                      <Icon className={styles.tabIcon} aria-hidden="true" />
                      <div className="flex flex-col text-left">
                        <span className={styles.tabLabel}>{tab.label}</span>
                        <span className="hidden text-[10px] opacity-65 lg:inline-block">{tab.kicker}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Live Simulated Viewport */}
              <div
                className="overflow-hidden rounded-[26px] border border-border/80 bg-card shadow-orvel"
                id={`landing-panel-${active.id}`}
                role="tabpanel"
                aria-labelledby={`landing-tab-${active.id}`}
              >
                {/* Browser Frame Header */}
                <div className="flex h-10 items-center justify-between border-b border-border/70 bg-secondary/50 px-4">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-3 py-0.5 text-[11px] font-mono text-muted-foreground shadow-xs">
                    <span className="text-emerald-600 font-bold">https://</span>
                    <span>edumap.vn{active.path}</span>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    Live Demo
                  </span>
                </div>

                {/* Simulated Content Area */}
                <div className="min-h-[380px] p-5 sm:p-7">
                  {/* TAB 1: BẢN ĐỒ SIMULATION */}
                  {active.id === 'map' && (
                    <div className="space-y-4">
                      {/* Search Bar */}
                      <div className="flex items-center gap-2 rounded-2xl border border-border/80 bg-secondary/40 p-2 shadow-xs">
                        <Search className="ml-2 h-4 w-4 text-muted-foreground" />
                        <input
                          type="text"
                          readOnly
                          value="Trường học, thư viện, lab, trạm wifi tại TP. Biên Hòa..."
                          className="w-full bg-transparent text-xs text-foreground outline-none font-medium"
                        />
                        <span className="rounded-xl bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground shrink-0">
                          184 Điểm
                        </span>
                      </div>

                      {/* Filter Pills */}
                      <div className="flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-primary/15 border border-primary/30 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                          Tất cả (184)
                        </span>
                        <span className="rounded-full bg-secondary border border-border px-2.5 py-0.5 text-[11px] text-muted-foreground">
                          Đại học & CĐ (8)
                        </span>
                        <span className="rounded-full bg-secondary border border-border px-2.5 py-0.5 text-[11px] text-muted-foreground">
                          THPT (32)
                        </span>
                        <span className="rounded-full bg-secondary border border-border px-2.5 py-0.5 text-[11px] text-muted-foreground">
                          Thư viện & STEM (24)
                        </span>
                        <span className="rounded-full bg-secondary border border-border px-2.5 py-0.5 text-[11px] text-muted-foreground">
                          WiFi công cộng (42)
                        </span>
                      </div>

                      {/* Map POI Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div className="rounded-xl border border-primary/40 bg-primary/5 p-3.5 space-y-1.5 transition-all hover:bg-primary/10">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                              <GraduationCap className="h-3.5 w-3.5" /> Đại học Đồng Nai (DNU)
                            </span>
                            <span className="rounded-md bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold px-1.5 py-0.5">
                              ● Đang mở cửa
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Đường Lê Quý Đôn, P. Tân Hiệp · Bán kính 1.2 km · Tuyến Bus 01, 05
                          </p>
                          <div className="flex items-center gap-2 pt-1 text-[10px] text-foreground/70">
                            <span>32 Chuyên ngành đào tạo</span>
                            <span>·</span>
                            <span>Phòng máy tính 200 chỗ</span>
                          </div>
                        </div>

                        <div className="rounded-xl border border-border/80 bg-secondary/40 p-3.5 space-y-1.5 transition-all hover:bg-secondary/70">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                              <Building2 className="h-3.5 w-3.5 text-primary" /> THPT Chuyên Lương Thế Vinh
                            </span>
                            <span className="rounded-md bg-primary/15 text-primary text-[10px] font-bold px-1.5 py-0.5">
                              Chuẩn QG
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Đường Lê Quý Đôn, P. Tân Hiệp · Bán kính 1.4 km · Phòng Lab STEM hiện đại
                          </p>
                          <div className="flex items-center gap-2 pt-1 text-[10px] text-foreground/70">
                            <span>Thư viện số 15.000 đầu sách</span>
                            <span>·</span>
                            <span>WiFi học sinh 100Mbps</span>
                          </div>
                        </div>

                        <div className="rounded-xl border border-border/80 bg-secondary/40 p-3.5 space-y-1.5 transition-all hover:bg-secondary/70">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                              <BookOpen className="h-3.5 w-3.5 text-primary" /> Thư viện Tỉnh Đồng Nai
                            </span>
                            <span className="rounded-md bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold px-1.5 py-0.5">
                              ● Mở 07:30 - 17:00
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Đường CMT8, P. Quang Vinh · 120.000+ sách số · Phòng đọc máy tính miễn phí
                          </p>
                          <div className="flex items-center gap-2 pt-1 text-[10px] text-foreground/70">
                            <span>Đăng ký thẻ EduPass miễn phí</span>
                            <span>·</span>
                            <span>Khu tự học yên tĩnh</span>
                          </div>
                        </div>

                        <div className="rounded-xl border border-border/80 bg-secondary/40 p-3.5 space-y-1.5 transition-all hover:bg-secondary/70">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                              <Wifi className="h-3.5 w-3.5 text-primary" /> Trạm WiFi Công viên Quyết Thắng
                            </span>
                            <span className="rounded-md bg-accent/15 text-accent text-[10px] font-bold px-1.5 py-0.5">
                              Miễn phí 24/7
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Đường 30/4, P. Quyết Thắng · Băng thông 150 Mbps · Kết nối tức thì không mật khẩu
                          </p>
                          <div className="flex items-center gap-2 pt-1 text-[10px] text-foreground/70">
                            <span>Phủ sóng bán kính 300m</span>
                            <span>·</span>
                            <span>Phục vụ học sinh ôn tập</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground border-t border-border/60">
                        <span className="flex items-center gap-1.5">
                          <ShieldCheck className="h-4 w-4 text-primary" /> Dữ liệu định vị GIS cập nhật trực tiếp theo chuẩn OSM
                        </span>
                        <Link href="/map" className="font-semibold text-primary hover:underline flex items-center gap-1">
                          Mở bản đồ đầy đủ <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: NGHỀ NGHIỆP SIMULATION */}
                  {active.id === 'career' && (
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-border/80 bg-secondary/30 p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-primary uppercase tracking-wider">
                            Lộ trình mẫu chuẩn
                          </span>
                          <span className="rounded-full bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5">
                            Cần tuyển cao tại Biên Hòa
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-foreground">
                          Kỹ sư Trí tuệ Nhân tạo & Khoa học Dữ liệu (AI Engineer)
                        </h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Lộ trình 4 giai đoạn chuẩn hóa kết nối nhu cầu tuyển dụng tại các khu công nghiệp Biên Hòa, Amata và Long Thành.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                        <div className="rounded-xl border border-emerald-600/40 bg-emerald-600/5 p-3 space-y-1">
                          <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400">
                            Giai đoạn 01
                          </span>
                          <p className="text-xs font-bold text-foreground">Toán & Python cơ bản</p>
                          <span className="text-[10px] text-muted-foreground block">Hoàn thành 100% ✓</span>
                        </div>
                        <div className="rounded-xl border border-primary/40 bg-primary/10 p-3 space-y-1">
                          <span className="text-[10px] font-bold uppercase text-primary">Giai đoạn 02</span>
                          <p className="text-xs font-bold text-foreground">Giải thuật & Machine Learning</p>
                          <span className="text-[10px] text-primary block">Đang học · Tiến độ 80%</span>
                        </div>
                        <div className="rounded-xl border border-border bg-secondary/40 p-3 space-y-1">
                          <span className="text-[10px] font-bold uppercase text-muted-foreground">Giai đoạn 03</span>
                          <p className="text-xs font-bold text-foreground">Deep Learning & LLM</p>
                          <span className="text-[10px] text-muted-foreground block">Mục tiêu Q4/2026</span>
                        </div>
                        <div className="rounded-xl border border-border bg-secondary/40 p-3 space-y-1">
                          <span className="text-[10px] font-bold uppercase text-muted-foreground">Giai đoạn 04</span>
                          <p className="text-xs font-bold text-foreground">Thực tập Doanh nghiệp</p>
                          <span className="text-[10px] text-muted-foreground block">FPT / Amata Hub</span>
                        </div>
                      </div>

                      <div className="rounded-xl border border-border/80 bg-card p-3 space-y-2">
                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                          Cơ hội thực tập & việc làm mở tại Đồng Nai
                        </span>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <div className="flex-1 rounded-lg border border-border/60 bg-secondary/40 p-2.5">
                            <p className="text-xs font-bold text-foreground">AI Engineer Intern — FPT Software Biên Hòa</p>
                            <p className="text-[11px] text-muted-foreground">Lương 12 - 18 tr/tháng · KCN Biên Hòa 2 · Nhận sinh viên năm 3-4</p>
                          </div>
                          <div className="flex-1 rounded-lg border border-border/60 bg-secondary/40 p-2.5">
                            <p className="text-xs font-bold text-foreground">Junior Data Analyst — Amata Tech Hub</p>
                            <p className="text-[11px] text-muted-foreground">Lương 10 - 15 tr/tháng · KCN Amata · Yêu cầu SQL & Python</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: TRỢ LÝ AI SIMULATION */}
                  {active.id === 'ai' && (
                    <div className="space-y-3 font-sans">
                      <div className="flex justify-end">
                        <div className="max-w-[85%] rounded-2xl rounded-tr-xs bg-primary px-4 py-2.5 text-xs font-medium text-primary-foreground shadow-xs">
                          Em là học sinh lớp 12 tại TP. Biên Hòa, có những học bổng công nghệ nào phù hợp trong năm 2026?
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                          <Sparkles className="h-4 w-4" />
                        </div>
                        <div className="max-w-[90%] rounded-2xl rounded-tl-xs border border-border/80 bg-secondary/40 p-4 space-y-2.5 text-xs text-foreground shadow-xs">
                          <p className="font-semibold text-primary">
                            EduMap AI đã phân tích hồ sơ và đề xuất 3 học bổng trọng điểm tại Đồng Nai:
                          </p>
                          <div className="space-y-1.5 text-muted-foreground">
                            <p>
                              <strong className="text-foreground">1. Học bổng Khuyến tài Tỉnh Đồng Nai:</strong> Hỗ trợ 100% học phí khối ngành STEM & Công nghệ. Hạn nộp: 30/08/2026.
                            </p>
                            <p>
                              <strong className="text-foreground">2. Quỹ Ươm mầm Tài năng Trẻ Amata:</strong> Tài trợ 25.000.000 VNĐ/năm + cơ hội thực tập có lương tại doanh nghiệp FDI.
                            </p>
                            <p>
                              <strong className="text-foreground">3. Suất học bổng Hợp tác ĐH Đồng Nai:</strong> Dành cho học sinh đạt giải HSG cấp tỉnh.
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            <span className="rounded-lg border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                              Hồ sơ mẫu (.pdf)
                            </span>
                            <span className="rounded-lg border border-border bg-card px-2 py-0.5 text-[10px] text-foreground">
                              Lộ trình ôn thi
                            </span>
                            <span className="rounded-lg border border-border bg-card px-2 py-0.5 text-[10px] text-foreground">
                              Đặt lịch Mentor 1-1
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: DASHBOARD & EDUPASS SIMULATION */}
                  {active.id === 'dashboard' && (
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                      <div className="sm:col-span-6 rounded-2xl border border-primary/30 bg-gradient-to-br from-card via-secondary/60 to-card p-5 space-y-3 shadow-xs relative overflow-hidden">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-lg bg-primary/20 flex items-center justify-center font-bold text-xs text-primary">
                              ED
                            </div>
                            <span className="text-xs font-bold text-foreground">EduMap Digital Pass</span>
                          </div>
                          <div className="h-5 w-8 rounded bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-[9px] font-mono font-bold text-amber-700 dark:text-amber-300">
                            CHIP
                          </div>
                        </div>

                        <div className="space-y-1">
                          <p className="text-[10px] font-mono uppercase text-muted-foreground">Chủ thẻ học tập</p>
                          <p className="text-sm font-extrabold text-foreground">Nguyễn Văn An</p>
                          <p className="text-[11px] text-muted-foreground">Lớp 12 Tin · THPT Chuyên Lương Thế Vinh</p>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-border/60 text-[10px] text-muted-foreground font-mono">
                          <span>Mã: EDM-BH-88429</span>
                          <span className="text-emerald-600 font-bold">● Thư viện liên kết</span>
                        </div>
                      </div>

                      <div className="sm:col-span-6 grid grid-cols-2 gap-2.5">
                        <div className="rounded-xl border border-border/80 bg-secondary/40 p-3 space-y-1">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">Điểm tích lũy</span>
                          <p className="text-xl font-black text-foreground font-mono">1.450 XP</p>
                          <span className="text-[10px] text-amber-600 font-semibold">Hạng 3 tuần này</span>
                        </div>
                        <div className="rounded-xl border border-border/80 bg-secondary/40 p-3 space-y-1">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">Giờ học thư viện</span>
                          <p className="text-xl font-black text-foreground font-mono">48.5 h</p>
                          <span className="text-[10px] text-emerald-600 font-semibold">+14% tháng này</span>
                        </div>
                        <div className="rounded-xl border border-border/80 bg-secondary/40 p-3 space-y-1">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">Kỹ năng STEM</span>
                          <p className="text-xl font-black text-foreground font-mono">12 / 16</p>
                          <span className="text-[10px] text-muted-foreground">Đã xác thực</span>
                        </div>
                        <div className="rounded-xl border border-border/80 bg-secondary/40 p-3 space-y-1">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">Chuỗi học tập</span>
                          <p className="text-xl font-black text-foreground font-mono flex items-center gap-1">
                            18 <Flame className="h-4 w-4 text-rose-500 inline" />
                          </p>
                          <span className="text-[10px] text-rose-600 font-semibold">Streak ngày liên tục</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── ECOSYSTEM METRICS COUNTER BAR ───────── */}
        <section id="so-lieu" className="px-4 py-8 sm:px-6 lg:px-8 max-w-[1400px] mx-auto w-full">
          <div className={cn(styles.orvelCard, "p-6 sm:p-8 space-y-6")} data-reveal>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-border/60">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  Quy mô nền tảng số
                </span>
                <h3 className="text-lg sm:text-xl font-extrabold text-foreground">
                  Chỉ số hệ sinh thái giáo dục EduMap Biên Hòa
                </h3>
              </div>
              <span className="rounded-full bg-card/80 border border-border/80 px-3 py-1 text-xs font-semibold text-muted-foreground shadow-xs">
                Cập nhật niên khóa 2026
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {ECOSYSTEM_METRICS.map((metric, i) => {
                const Icon = metric.icon;
                return (
                  <div
                    key={metric.label}
                    className="rounded-2xl border border-border/70 bg-card/65 backdrop-blur-sm p-4 space-y-2 transition-all hover:bg-card/90 hover:-translate-y-0.5 shadow-xs"
                    style={{ '--reveal-delay': `${i * 60}ms` } as CSSProperties}
                  >
                    <div className="h-8 w-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="text-2xl sm:text-3xl font-black text-foreground font-mono tracking-tight">
                      {metric.value}
                    </p>
                    <p className="text-xs font-bold text-foreground leading-snug">{metric.label}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{metric.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── INTRO SECTION (Feedback 2: Reverted back to clean 3-step columns) ── */}
        <section id="gioi-thieu" className={`${styles.section} ${styles.intro}`}>
          <div className={styles.sectionInner}>
            <div className={styles.introHead} data-reveal>
              <p className={styles.sectionEyebrow}>Một nền tảng, một hành trình</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                <TextAnimate text="Không chỉ là bản đồ." type="words" delay={0.04} />
                <br />
                <span className="bg-gradient-to-r from-primary via-amber-500 to-primary bg-[length:200%_auto] bg-clip-text text-transparent animate-shimmer">
                  <TextAnimate text="Là nơi bạn bắt đầu." type="words" delay={0.06} />
                </span>
              </h2>
              <p className={styles.sectionLede}>
                EduMap gom không gian học tập, nghề nghiệp và trí tuệ nhân tạo vào một trải nghiệm liền mạch —
                để bạn không phải bắt đầu từ con số không.
              </p>
            </div>

            <div className={styles.steps}>
              {INTRO_STEPS.map((step, index) => (
                <div
                  key={step.number}
                  className={`${styles.step} ${styles.reveal}`}
                  data-reveal
                  style={{ '--reveal-delay': `${index * 90}ms` } as CSSProperties}
                >
                  <p className={styles.stepNumber}>{step.number}</p>
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                  <p className={styles.stepText}>{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CORE FEATURES SECTION (Feedback 1: Compact, smaller cards) ── */}
        <section id="tinh-nang" className={`${styles.section} ${styles.features}`}>
          <div className={styles.sectionInner}>
            <div className={styles.featuresHead}>
              <div data-reveal className="space-y-1.5">
                <p className={styles.sectionEyebrow}>Hệ sinh thái tính năng</p>
                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                  <TextAnimate text="Bốn trụ cột cốt lõi." type="words" delay={0.04} />
                  <br />
                  <span className="bg-gradient-to-r from-primary via-amber-500 to-primary bg-[length:200%_auto] bg-clip-text text-transparent animate-shimmer">
                    <TextAnimate text="Một hành trình liền mạch." type="words" delay={0.06} />
                  </span>
                </h2>
              </div>
            </div>

            {/* Journey Summary Banner (Clean, no clutter icons) */}
            <div className={cn(styles.orvelCardCompact, "p-4 sm:p-5 mb-6")} data-reveal>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <p className="text-xs sm:text-sm text-foreground leading-snug">
                  <strong className="text-primary font-bold">Hành trình khép kín:</strong> Học ở đâu quanh Biên Hòa · Học kỹ năng nào để có việc làm · Hỏi ai khi gặp khó · Theo dõi chứng chỉ & học bổng ra sao.
                </p>
                <span className="shrink-0 self-start md:self-auto rounded-lg bg-card/80 border border-border/70 px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
                  4 Phân hệ đồng bộ
                </span>
              </div>
            </div>

            {/* Compact Bento Grid — 4 Tidy, Clean Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {FEATURES_DATA.map((feature, index) => {
                const Icon = feature.Icon;
                return (
                  <article
                    key={feature.id}
                    className={cn(styles.orvelCardCompact, "flex flex-col justify-between p-5 sm:p-6")}
                    data-reveal
                    style={{ '--reveal-delay': `${index * 70}ms` } as CSSProperties}
                  >
                    <div className="space-y-3.5">
                      {/* Compact Header: Single Icon + Title + Status Badge */}
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-card/85 text-primary shadow-xs">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-primary block leading-none mb-1">
                              {feature.kicker}
                            </span>
                            <h3 className="text-base sm:text-lg font-extrabold text-foreground tracking-tight leading-tight">
                              {feature.title}
                            </h3>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full bg-emerald-600/15 border border-emerald-600/25 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                          {feature.badge}
                        </span>
                      </div>

                      {/* Question Chip (Clean, no emoji) */}
                      <div className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs text-foreground">
                        <span className="font-semibold text-primary">Trọng tâm:</span>
                        <span>{feature.question}</span>
                      </div>

                      {/* Concise Description */}
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                        {feature.description}
                      </p>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1">
                        {feature.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-md border border-border/60 bg-card/70 px-2 py-0.5 text-[11px] font-medium text-foreground/80"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      {/* 2 Concise Points (Clean bullet list, no icon clutter) */}
                      <div className="rounded-xl border border-border/60 bg-card/50 p-2.5 space-y-1">
                        {feature.points.map((pt) => (
                          <div key={pt} className="flex items-start gap-2 text-xs text-foreground/85 leading-relaxed">
                            <span className="text-primary font-bold select-none leading-none mt-1">•</span>
                            <span>{pt}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Compact Footer */}
                    <div className="flex items-center justify-between pt-3 mt-4 border-t border-border/60">
                      <span className="text-[11px] font-medium text-muted-foreground font-mono">
                        {feature.metric}
                      </span>
                      <Link
                        href={feature.href}
                        className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                      >
                        Khám phá
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── FINAL CTA & SOFT LIGHT FOOTER ───────────── */}
        <section id="bat-dau" className={styles.ctaSection}>
          <div className={styles.ctaPanel}>
            <div className={styles.ctaGlowPrimary} aria-hidden="true" />
            <div className={styles.ctaGlowAccent} aria-hidden="true" />

            <div className={styles.ctaContent} data-reveal>
              <div className="inline-flex items-center rounded-full border border-primary/20 bg-card/80 px-3 py-1 text-xs font-semibold text-primary shadow-xs">
                <span>Bắt đầu hành trình giáo dục số</span>
              </div>

              <h2 className={styles.ctaTitle}>
                Tương lai của bạn
                <br />
                <span className="bg-gradient-to-r from-primary via-amber-500 to-primary bg-[length:200%_auto] bg-clip-text text-transparent animate-shimmer">
                  bắt đầu từ một điểm trên bản đồ.
                </span>
              </h2>

              <p className={styles.ctaText}>
                Một tài khoản EduMap mở ra bản đồ học tập 184 điểm trường, mạng lưới thư viện số, lộ trình nghề nghiệp
                chuẩn STEM và trợ lý AI thông minh — hoàn toàn miễn phí cho học sinh, sinh viên và nhà giáo dục tại Biên Hòa, Đồng Nai.
              </p>

              <div className={styles.ctaActions}>
                <Link href="/auth/login" className={styles.primaryCta}>
                  Khám phá ngay
                  <ArrowRight className={styles.ctaArrow} size={18} aria-hidden="true" />
                </Link>
              </div>

              <p className={styles.ctaNote}>
                Miễn phí 100% · Không yêu cầu thẻ tín dụng · Đăng nhập nhanh bằng Google
              </p>
            </div>

            {/* Soft, Warm Footer Row */}
            <div className={styles.footerRow}>
              <Link href="/" className={styles.footerBrand} aria-label="EduMap — trang chủ">
                <EduMapLogo className={styles.footerBrandIcon} />
                <span>
                  Edu<span className={styles.brandAccent}>Map</span>
                </span>
              </Link>

              <nav className={styles.footerNav} aria-label="Liên kết chân trang">
                {NAV_LINKS.map((link) => (
                  <a key={link.href} className={styles.footerLink} href={link.href}>
                    {link.label}
                  </a>
                ))}
                <Link href="/map" className={styles.footerLink}>
                  Bản đồ
                </Link>
                <Link href="/career" className={styles.footerLink}>
                  Nghề nghiệp
                </Link>
                <Link href="/ai-chat" className={styles.footerLink}>
                  Trợ lý AI
                </Link>
              </nav>

              <div className={styles.footerCopy}>
                © 2026 EduMap. Nền tảng Bản đồ số Giáo dục & Định hướng Nghề nghiệp Biên Hòa, Đồng Nai. Dữ liệu công khai có nguồn kiểm chứng từ Sở GD&ĐT Đồng Nai.
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export const translations = {
  vi: {
    common: {
      search: "Tìm kiếm...",
      loading: "Đang tải...",
      error: "Đã có lỗi xảy ra",
      home: "Trang chủ",
      map: "Bản đồ",
      mentor: "Cố vấn",
      library: "Thư viện",
      community: "Cộng đồng",
      login: "Đăng nhập",
      register: "Đăng ký",
    },
    home: {
      title: "EduMap Biên Hòa",
      subtitle: "Bản đồ Giáo dục Thông minh & Kết nối tri thức",
      getStarted: "Bắt đầu khám phá",
    },
    map: {
      title: "Bản đồ học tập",
      filters: "Bộ lọc",
      heatmap: "Bản đồ nhiệt",
    }
  },
  en: {
    common: {
      search: "Search...",
      loading: "Loading...",
      error: "An error occurred",
      home: "Home",
      map: "Map",
      mentor: "Mentor",
      library: "Library",
      community: "Community",
      login: "Login",
      register: "Register",
    },
    home: {
      title: "EduMap Bien Hoa",
      subtitle: "Smart Education Map & Knowledge Connection",
      getStarted: "Start Exploring",
    },
    map: {
      title: "Educational Map",
      filters: "Filters",
      heatmap: "Heatmap",
    }
  }
};

export type Language = 'vi' | 'en';
export type TranslationKey = keyof typeof translations.vi;

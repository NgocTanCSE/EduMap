export const ariaLabels = {
  navigation: {
    main: 'Điều hướng chính',
    mobile: 'Điều hướng di động',
    footer: 'Điều hướng chân trang',
    sidebar: 'Thanh bên',
  },
  actions: {
    search: 'Tìm kiếm',
    filter: 'Lọc',
    sort: 'Sắp xếp',
    close: 'Đóng',
    open: 'Mở',
    menu: 'Menu',
    back: 'Quay lại',
    next: 'Tiếp theo',
    previous: 'Trước đó',
    submit: 'Gửi',
    cancel: 'Hủy',
    save: 'Lưu',
    delete: 'Xóa',
    edit: 'Chỉnh sửa',
    view: 'Xem thêm',
    like: 'Thích',
    share: 'Chia sẻ',
    bookmark: 'Đánh dấu',
    download: 'Tải xuống',
    upload: 'Tải lên',
  },
  status: {
    loading: 'Đang tải...',
    success: 'Thành công',
    error: 'Lỗi',
    empty: 'Không có dữ liệu',
    offline: 'Không có kết nối',
  },
  forms: {
    required: 'Bắt buộc',
    optional: 'Không bắt buộc',
    invalid: 'Dữ liệu không hợp lệ',
    email: 'Địa chỉ email',
    password: 'Mật khẩu',
    name: 'Họ và tên',
    phone: 'Số điện thoại',
    address: 'Địa chỉ',
    search: 'Tìm kiếm',
  },
} as const;

export const keyboardShortcuts = {
  escape: 'Escape',
  enter: 'Enter',
  space: ' ',
  arrowUp: 'ArrowUp',
  arrowDown: 'ArrowDown',
  arrowLeft: 'ArrowLeft',
  arrowRight: 'ArrowRight',
  tab: 'Tab',
  home: 'Home',
  end: 'End',
} as const;

export const focusStyles = {
  default: 'focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-[#0a0a0a]',
  inset: 'focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-inset',
  visible: 'focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]',
} as const;

export const srOnly = 'sr-only';

export const skipLink = 'skip-to-content';

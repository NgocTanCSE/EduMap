// Mock data for EduMap map points (schools, libraries, wifi, parks)
// Used by the test-app mock server — NOT in production Docker/HF deployment.

export interface MockMapPoint {
  id: string;
  name: string;
  name_vi?: string;
  lat: number;
  lng: number;
  category: 'school' | 'university' | 'library' | 'wifi' | 'park' | 'innovation_space';
  address?: string;
  website?: string;
  phone?: string;
  description?: string;
  type?: string;
  level?: string;
}

export const mockSchools: MockMapPoint[] = [
  {
    id: 'school-001',
    name: 'Trường Mầm Non Bình Trưng Đông',
    name_vi: 'Trường Mầm Non Bình Trưng Đông',
    lat: 10.7894062,
    lng: 106.7721717,
    category: 'school',
    address: 'Phường Bình Trưng Đông, TP. Hồ Chí Minh',
    type: 'kindergarten',
    level: 'Mầm non',
  },
  {
    id: 'school-002',
    name: 'Trường PTNT HOA - Trường Quốc tế Việt Úc',
    lat: 10.772764,
    lng: 106.658505,
    category: 'school',
    address: '330 Nguyễn Trãi, Quận 1, TP. Hồ Chí Minh',
    type: 'international',
    level: 'Quốc tế',
  },
  {
    id: 'university-001',
    name: 'Đại học Công nghệ Đồng Nai (DNTU)',
    lat: 10.7725,
    lng: 106.7630,
    category: 'university',
    address: 'Đường Nguyễn Văn Cừ, TP. Biên Hòa, Đồng Nai',
    website: 'https://www.dntu.edu.vn',
    phone: '0251 3823888',
    type: 'university',
    level: 'Đại học',
    description: 'Trường đại học kỹ thuật lớn nhất tỉnh Đồng Nai',
  },
  {
    id: 'school-003',
    name: 'Trường Trung học Phổ thông Lê Quý Đôn',
    lat: 10.778,
    lng: 106.775,
    category: 'school',
    address: 'TP. Biên Hòa, Đồng Nai',
    type: 'high_school',
    level: 'THPT',
  },
  {
    id: 'library-001',
    name: 'Thư viện Tỉnh Đồng Nai',
    lat: 10.7705,
    lng: 106.7673,
    category: 'library',
    address: 'Số 23 Lê Duẩn, TP. Biên Hòa, Đồng Nai',
    description: 'Thư viện tỉnh cung cấp dịch vụ lưu trữ và tra cứu sách',
  },
  {
    id: 'wifi-001',
    name: 'WiFi DNTU Campus',
    lat: 10.7725,
    lng: 106.7630,
    category: 'wifi',
    address: 'Khuôn viên Đại học Công nghệ Đồng Nai',
    description: 'WiFi miễn phí 500Mbps cho sinh viên',
  },
  {
    id: 'wifi-002',
    name: 'WiFi Công viên Biên Hòa',
    lat: 10.7745,
    lng: 106.7710,
    category: 'wifi',
    address: 'Công viên Biên Hòa, P. Tân Phong, TP. Biên Hòa',
    description: 'WiFi công cộng tại công viên',
  },
  {
    id: 'park-001',
    name: 'Công viên Biên Hùng',
    lat: 10.7735,
    lng: 106.7680,
    category: 'park',
    address: 'Phường Tân Phong, TP. Biên Hòa, Đồng Nai',
    description: 'Khu công viên xanh rộng với khu vực tập thể dục',
  },
  {
    id: 'innovation-001',
    name: 'Trung tâm Đổi mới sáng tạo DNTU',
    lat: 10.7730,
    lng: 106.7625,
    category: 'innovation_space',
    address: 'Khuôn viên Đại học Công nghệ Đồng Nai',
    description: 'Nơi kết nối startup và công nghệ',
  },
  {
    id: 'school-004',
    name: 'Trường Mầm Non Hoàng Diệu',
    lat: 10.7765,
    lng: 106.7650,
    category: 'school',
    address: 'P. Mỹ Phước, TP. Biên Hòa, Đồng Nai',
    type: 'kindergarten',
    level: 'Mầm non',
  },
];

// Mock data for EduMap AI chatbot
// Used by the test-app mock server — NOT in production Docker/HF deployment.

export const mockAiChat = {
  history: [
    {
      id: 'msg-001',
      role: 'user',
      content: 'Tôi muốn tìm trường học ở Biên Hòa',
      timestamp: '2025-01-15T10:00:00Z',
    },
    {
      id: 'msg-002',
      role: 'assistant',
      content: 'Bạn có thể tìm thấy các trường học ở Biên Hòa trên bản đồ. Để xem danh sách chi tiết, hãy truy cập trang Bản đồ và lọc theo danh mục "Trường học".',
      timestamp: '2025-01-15T10:00:03Z',
    },
  ],

  getResponse(message: string): { content: string; role: string } {
    const lower = (message || '').toLowerCase();

    if (lower.includes('trường học') || lower.includes('school')) {
      return {
        role: 'assistant',
        content: 'Trường học ở Biên Hòa, Đồng Nai:\n\n1. Trường Mầm Non Bình Trưng Đông\n2. Trường PTNT HOA - Trường Quốc tế Việt Úc\n3. Trường THCS Lê Quý Đôn\n4. Trường THPT Lê Quý Đôn\n5. Trường Mầm Non Hoàng Diệu\n\nBạn có thể xem vị trí chính xác trên bản đồ.',
      };
    }

    if (lower.includes('wifi') || lower.includes('internet')) {
      return {
        role: 'assistant',
        content: 'Các điểm WiFi miễn phí ở Biên Hòa:\n\n1. WiFi DNTU Campus - 500Mbps\n2. WiFi Công viên Biên Hòa\n\nBạn có thể tìm kiếm trên bản đồ bằng cách lọc "WiFi".',
      };
    }

    if (lower.includes('học bổng') || lower.includes('scholarship')) {
      return {
        role: 'assistant',
        content: 'Hiện tại có các học bổng sau:\n- Học bổng Xêm DNTU (500 USD)\n- Học bổng Toạn quộc Uớc (1000 USD)\n\nLiên hệ phòng Đào tạo để biết thêm chi tiết.',
      };
    }

    if (lower.includes('thực tập') || lower.includes('internship')) {
      return {
        role: 'assistant',
        content: 'Cơ hội thực tập:\n1. Frontend Developer (Internship) tại EduMap\n2. Data Analyst tại Công ty TNHH Dữ liệu Việt\n\nBạn có thể xem chi tiết trong mục "Việc làm" → "Thực tập".',
      };
    }

    return {
      role: 'assistant',
      content: 'Xin chào! Tôi là AI Assistant của EduMap. Tôi có thể giúp bạn:\n\n- Tìm kiếm trường học, thư viện, WiFi\n- Gợi ý lộ trình học tập và việc làm\n- Trả lời thắc mắc về học bổng\n- Phân tích dữ liệu bản đồ\n\nBạn cần hỗ trợ gì hôm nay?',
    };
  },
};

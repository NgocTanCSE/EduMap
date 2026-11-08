/* Seed data for the frontend mock layer — realistic Vietnamese education content. */
export interface MockDb {
    version: number;
    generated_at: string;
    pois: Array<Record<string, any>>;
    featuredPins: Array<Record<string, any>>;
    learningSpots: Array<Record<string, any>>;
    scholarships: Array<Record<string, any>>;
    scholarshipApplications: Array<Record<string, any>>;
    jobs: Array<Record<string, any>>;
    jobApplications: Array<Record<string, any>>;
    careerPaths: Array<Record<string, any>>;
    userSkills: Array<Record<string, any>>;
    userCareers: Array<Record<string, any>>;
    internships: Array<Record<string, any>>;
    internshipApplications: Array<Record<string, any>>;
    events: Array<Record<string, any>>;
    eventRegistrations: Array<Record<string, any>>;
    opportunities: Array<Record<string, any>>;
    libraryResources: Array<Record<string, any>>;
    mentors: Array<Record<string, any>>;
    mentorBookings: Array<Record<string, any>>;
    communityPosts: Array<Record<string, any>>;
    communityComments: Array<Record<string, any>>;
    communityGroups: Array<Record<string, any>>;
    wifiLocations: Array<Record<string, any>>;
    greenChallenges: Array<Record<string, any>>;
    greenActivities: Array<Record<string, any>>;
    surveys: Array<Record<string, any>>;
    surveyResponses: Array<Record<string, any>>;
    stemLabs: Array<Record<string, any>>;
    stemBookings: Array<Record<string, any>>;
    summerCampaigns: Array<Record<string, any>>;
    summerRegistrations: Array<Record<string, any>>;
    volunteerActivities: Array<Record<string, any>>;
    donationCampaigns: Array<Record<string, any>>;
    donationDonors: Array<Record<string, any>>;
    sharedItems: Array<Record<string, any>>;
    shareRequests: Array<Record<string, any>>;
    hackathons: Array<Record<string, any>>;
    hackathonTeams: Array<Record<string, any>>;
    notifications: Array<Record<string, any>>;
    bookmarks: Array<Record<string, any>>;
    files: Array<Record<string, any>>;
    cart: Array<Record<string, any>>;
    orders: Array<Record<string, any>>;
    businessProfiles: Array<Record<string, any>>;
    intlPrograms: Array<Record<string, any>>;
    alumni: Array<Record<string, any>>;
    exchangeResources: Array<Record<string, any>>;
    exchangeRequests: Array<Record<string, any>>;
    exchangeMatches: Array<Record<string, any>>;
    sponsorNeeds: Array<Record<string, any>>;
    sponsorProfiles: Array<Record<string, any>>;
    impactMatches: Array<Record<string, any>>;
    knowledgeNodes: Array<Record<string, any>>;
    knowledgeEdges: Array<Record<string, any>>;
    knowledgeReviews: Array<Record<string, any>>;
    certificates: Array<Record<string, any>>;
    roles: Array<Record<string, any>>;
    auditLogs: Array<Record<string, any>>;
    adminUsers: Array<Record<string, any>>;
    notificationsReadAt: Record<string, string>;
    aiHistory: Array<Record<string, any>>;
    tutorHistory: Array<Record<string, any>>;
}

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.now();
const iso = (offsetDays: number): string => new Date(NOW + offsetDays * DAY).toISOString();
const dateOnly = (offsetDays: number): string => iso(offsetDays).slice(0, 10);
const AVATAR = 'https://ui-avatars.com/api/?background=0f766e&color=ffffff&name=';

const provenance = (url: string, verified = '2026-11-08') => `Nguồn chính thức: ${url} · Kiểm chứng: ${verified}`;

export function createSeed(): MockDb {
    return {
        version: 3,
        generated_at: new Date().toISOString(),

        pois: [
            { id: 'poi-1', name: 'Trường Đại học Công nghệ Đồng Nai (DNTU)', category: 'university', lat: 10.9753, lng: 106.8452, address: 'Số 1 Nguyễn Khuyến, P. Trảng Dài, Biên Hoà, Đồng Nai', description: 'Cơ sở giáo dục đại học đa ngành tại Biên Hoà.', rating_avg: 4.4, rating_count: 214, source: 'Bản đồ giáo dục EduMap', verified: true },
            { id: 'poi-2', name: 'Trường THPT Chuyên Lương Thế Vinh', category: 'school', lat: 10.9508, lng: 106.8302, address: 'Số 2 Lê Quý Đôn, P. Quyết Thắng, Biên Hoà', description: 'Trường THPT chuyên của tỉnh Đồng Nai.', rating_avg: 4.6, rating_count: 168, source: 'Bản đồ giáo dục EduMap', verified: true },
            { id: 'poi-3', name: 'Thư viện tỉnh Đồng Nai', category: 'library', lat: 10.9576, lng: 106.8186, address: 'Số 1 Hưng Đạo Vương, P. Trung Dũng, Biên Hoà', description: 'Thư viện công cộng có phòng đọc và wifi miễn phí.', rating_avg: 4.3, rating_count: 96, source: 'Bản đồ giáo dục EduMap', verified: true },
            { id: 'poi-4', name: 'Trường THCS Nguyễn Trãi', category: 'school', lat: 10.9465, lng: 106.8188, address: 'P. Thanh Bình, Biên Hoà, Đồng Nai', description: 'Trường THCS trọng điểm của thành phố Biên Hoà.', rating_avg: 4.2, rating_count: 74, source: 'Bản đồ giáo dục EduMap', verified: true },
            { id: 'poi-5', name: 'Trường Đại học Quốc gia TP.HCM', category: 'university', lat: 10.8701, lng: 106.8032, address: 'P. Linh Trung, TP. Thủ Đức, TP.HCM', description: 'Hệ thống đại học nghiên cứu trọng điểm phía Nam.', rating_avg: 4.7, rating_count: 512, source: 'Bản đồ giáo dục EduMap', verified: true },
            { id: 'poi-6', name: 'Trường Đại học Bách khoa Hà Nội', category: 'university', lat: 21.0048, lng: 105.8432, address: 'Số 1 Đại Cồ Việt, Hai Bà Trưng, Hà Nội', description: 'Trường đại học kỹ thuật hàng đầu Việt Nam.', rating_avg: 4.8, rating_count: 640, source: 'Bản đồ giáo dục EduMap', verified: true },
            { id: 'poi-7', name: 'Trường Đại học Bách khoa - ĐH Đà Nẵng', category: 'university', lat: 16.0757, lng: 108.1524, address: 'Số 54 Nguyễn Lương Bằng, Liên Chiểu, Đà Nẵng', description: 'Cơ sở đào tạo kỹ thuật tại miền Trung.', rating_avg: 4.5, rating_count: 287, source: 'Bản đồ giáo dục EduMap', verified: true },
            { id: 'poi-8', name: 'Trường Đại học Cần Thơ', category: 'university', lat: 10.0306, lng: 105.7685, address: 'Khu II, đường 3/2, Ninh Kiều, Cần Thơ', description: 'Trung tâm đào tạo lớn nhất Đồng bằng sông Cửu Long.', rating_avg: 4.5, rating_count: 402, source: 'Bản đồ giáo dục EduMap', verified: true },
            { id: 'poi-9', name: 'Trường THPT Lê Quý Đôn (TP.HCM)', category: 'school', lat: 10.7789, lng: 106.6931, address: 'Số 110 Nguyễn Thị Minh Khai, Q.3, TP.HCM', description: 'Trường THPT lâu đời tại trung tâm TP.HCM.', rating_avg: 4.4, rating_count: 130, source: 'Bản đồ giáo dục EduMap', verified: true },
            { id: 'poi-10', name: 'Thư viện Tổng hợp TP.HCM', category: 'library', lat: 10.7809, lng: 106.6992, address: 'Số 69 Lý Tự Trọng, Q.1, TP.HCM', description: 'Thư viện công cộng lớn với kho tài liệu mở.', rating_avg: 4.6, rating_count: 212, source: 'Bản đồ giáo dục EduMap', verified: true },
            { id: 'poi-11', name: 'Nhà sách FAHASA Biên Hoà', category: 'bookstore', lat: 10.9591, lng: 106.8325, address: 'Trung tâm thương mại Biên Hoà, Đồng Nai', description: 'Nhà sách có khu tự học và giáo trình.', rating_avg: 4.1, rating_count: 58, source: 'Bản đồ giáo dục EduMap', verified: false },
            { id: 'poi-12', name: 'Phòng STEM Trường Thực hành Sư phạm DNTU', category: 'stem', lat: 10.9761, lng: 106.8472, address: 'Trảng Dài, Biên Hoà, Đồng Nai', description: 'Phòng thí nghiệm STEM mở cho học sinh đăng ký.', rating_avg: 4.5, rating_count: 41, source: 'Bản đồ giáo dục EduMap', verified: true },
            { id: 'poi-13', name: 'Trung tâm Học liệu DNTU', category: 'library', lat: 10.9748, lng: 106.8461, address: 'Trảng Dài, Biên Hoà, Đồng Nai', description: 'Học liệu số và phòng đọc mở cho sinh viên.', rating_avg: 4.3, rating_count: 33, source: 'Bản đồ giáo dục EduMap', verified: true },
            { id: 'poi-14', name: 'Cà phê Học tập An Nhiên', category: 'cafe', lat: 10.9521, lng: 106.8421, address: 'P. Tân Tiến, Biên Hoà, Đồng Nai', description: 'Không gian yên tĩnh, có ổ điện và wifi miễn phí.', rating_avg: 4.2, rating_count: 87, source: 'Cộng đồng EduMap', verified: false },
            { id: 'poi-15', name: 'Công viên Bửu Long', category: 'park', lat: 10.9633, lng: 106.7952, address: 'Bửu Long, Biên Hoà, Đồng Nai', description: 'Không gian xanh cho hoạt động nhóm và câu lạc bộ.', rating_avg: 4.4, rating_count: 152, source: 'Cộng đồng EduMap', verified: true },
            { id: 'poi-16', name: 'Trường THPT Nguyễn Trãi (Hà Nội)', category: 'school', lat: 21.0132, lng: 105.8048, address: 'Ba Đình, Hà Nội', description: 'Trường THPT công lập tại trung tâm Hà Nội.', rating_avg: 4.3, rating_count: 61, source: 'Bản đồ giáo dục EduMap', verified: true },
            { id: 'poi-17', name: 'Wifi công cộng Phố đi bộ Nguyễn Huệ', category: 'wifi', lat: 10.7743, lng: 106.7038, address: 'Q.1, TP.HCM', description: 'Wifi miễn phí do thành phố cung cấp.', rating_avg: 4.0, rating_count: 44, source: 'Cộng đồng EduMap', verified: false },
            { id: 'poi-18', name: 'Trường Cao đẳng Công nghệ cao Đồng An', category: 'college', lat: 10.9231, lng: 106.7728, address: 'Thuận An, Bình Dương', description: 'Cao đẳng kỹ thuật gần khu công nghiệp.', rating_avg: 4.0, rating_count: 22, source: 'Bản đồ giáo dục EduMap', verified: false },
            { id: 'poi-19', name: 'Trung tâm Ngoại ngữ Đồng Nai', category: 'learning_center', lat: 10.9551, lng: 106.8261, address: 'P. Tân Phong, Biên Hoà, Đồng Nai', description: 'Đào tạo tiếng Anh, tiếng Nhật và luyện thi IELTS.', rating_avg: 4.1, rating_count: 39, source: 'Cộng đồng EduMap', verified: false },
            { id: 'poi-20', name: 'Trường THCS Trần Hưng Đạo', category: 'school', lat: 10.9422, lng: 106.8235, address: 'P. Tân Tiến, Biên Hoà, Đồng Nai', description: 'Trường THCS tại trung tâm Biên Hoà.', rating_avg: 4.0, rating_count: 27, source: 'Bản đồ giáo dục EduMap', verified: true },
            { id: 'poi-21', name: 'Trường Đại học Tôn Đức Thắng', category: 'university', lat: 10.7326, lng: 106.6994, address: 'Q.7, TP.HCM', description: 'Đại học trẻ với nhiều chương trình quốc tế.', rating_avg: 4.4, rating_count: 305, source: 'Bản đồ giáo dục EduMap', verified: true },
            { id: 'poi-22', name: 'Trường Đại học FPT Hà Nội', category: 'university', lat: 21.0139, lng: 105.5258, address: 'Khu công nghệ cao Hoà Lạc, Hà Nội', description: 'Đào tạo CNTT và quản trị theo mô hình doanh nghiệp.', rating_avg: 4.3, rating_count: 198, source: 'Bản đồ giáo dục EduMap', verified: true },
            { id: 'poi-23', name: 'Thư viện Đà Nẵng', category: 'library', lat: 16.0544, lng: 108.2022, address: 'Quận Hải Châu, Đà Nẵng', description: 'Thư viện công cộng với phòng học nhóm.', rating_avg: 4.3, rating_count: 71, source: 'Bản đồ giáo dục EduMap', verified: true },
            { id: 'poi-24', name: 'Phòng Lab AI - Đại học Bách khoa Hà Nội', category: 'lab', lat: 21.0055, lng: 105.8424, address: 'Hai Bà Trưng, Hà Nội', description: 'Phòng nghiên cứu AI mở cho sinh viên liên kết.', rating_avg: 4.7, rating_count: 35, source: 'Bản đồ giáo dục EduMap', verified: true },
            { id: 'poi-25', name: 'Unicode Library cơ sở Cần Thơ', category: 'library', lat: 10.0324, lng: 105.7712, address: 'Ninh Kiều, Cần Thơ', description: 'Không gian đọc hiện đại tại miền Tây.', rating_avg: 4.2, rating_count: 18, source: 'Cộng đồng EduMap', verified: false },
        ],

        featuredPins: [
            { id: 'pin-stem-dntu', name: 'Phòng STEM DNTU', category: 'stem', lat: 10.9761, lng: 106.8472, description: 'Đăng ký sử dụng phòng thí nghiệm STEM tại DNTU.', address: 'Trảng Dài, Biên Hoà', featureLink: '/stem', is_verified: true, status: 'active' },
            { id: 'pin-green-buulong', name: 'Ngày hội Xanh Bửu Long', category: 'green', lat: 10.9633, lng: 106.7952, description: 'Nhặt rác và trồng cây tại Công viên Bửu Long.', featureLink: '/green', points: 120, carbon_saved_kg: 18, participants_count: 84, status: 'active' },
            { id: 'pin-summer-bienhoa', name: 'Chiến dịch Mùa hè xanh Đồng Nai 2026', category: 'summer', lat: 10.9451, lng: 106.8241, description: 'Tình nguyện dạy học hè cho học sinh Biên Hoà.', featureLink: '/summer', participants_count: 120, status: 'upcoming' },
            { id: 'pin-wifi-thuvien', name: 'Wifi miễn phí Thư viện Đồng Nai', category: 'wifi', lat: 10.9576, lng: 106.8186, description: 'SSID ThuvienDongNai — miễn phí, tốc độ 45 Mbps.', featureLink: '/wifi', is_verified: true, is_free: true, speed_label: 'Nhanh' },
            { id: 'pin-donate-anh-sang', name: 'Quỹ Ánh Sáng Học Đường', category: 'donate', lat: 10.9701, lng: 106.8391, description: 'Quyên góp học bổng cho học sinh khó khăn Đồng Nai.', featureLink: '/donate', current_amount: 182000000, target_amount: 300000000, status: 'active' },
            { id: 'pin-market-sach', name: 'Chợ sách cũ Biên Hoà', category: 'market', lat: 10.9604, lng: 106.8302, description: 'Trao đổi và mượn sách giáo trình cũ.', featureLink: '/marketplace', status: 'active' },
        ],

        learningSpots: [
            { id: 'spot-1', name: 'Thư viện tỉnh Đồng Nai', type: 'library', address: 'Số 1 Hưng Đạo Vương, Biên Hoà', description: 'Phòng đọc yên tĩnh, wifi miễn phí, máy lạnh.', has_wifi: true, has_power_outlets: true, quietness: 5, rating_avg: 4.6, total_capacity: 220, amenities: ['wifi', 'ổ điện', 'máy lạnh', 'chỗ đậu xe'], location: { type: 'Point', coordinates: [106.8186, 10.9576] } },
            { id: 'spot-2', name: 'Trung tâm Học liệu DNTU', type: 'library', address: 'Trảng Dài, Biên Hoà', description: 'Không gian học nhóm và phòng đọc cá nhân.', has_wifi: true, has_power_outlets: true, quietness: 4, rating_avg: 4.4, total_capacity: 180, amenities: ['wifi', 'phòng nhóm', 'máy in'], location: { type: 'Point', coordinates: [106.8461, 10.9748] } },
            { id: 'spot-3', name: 'Cà phê Học tập An Nhiên', type: 'cafe', address: 'P. Tân Tiến, Biên Hoà', description: 'Quán cà phê yên tĩnh phù hợp học cá nhân.', has_wifi: true, has_power_outlets: true, quietness: 3, rating_avg: 4.2, total_capacity: 45, amenities: ['wifi', 'ổ điện', 'đồ uống'], location: { type: 'Point', coordinates: [106.8421, 10.9521] } },
            { id: 'spot-4', name: 'Nhà sách FAHASA Biên Hoà', type: 'bookstore', address: 'TTTM Biên Hoà', description: 'Khu tự học cạnh nhà sách.', has_wifi: true, has_power_outlets: false, quietness: 2, rating_avg: 4.0, total_capacity: 30, amenities: ['wifi', 'sách tham khảo'], location: { type: 'Point', coordinates: [106.8325, 10.9591] } },
            { id: 'spot-5', name: 'Thư viện Tổng hợp TP.HCM', type: 'library', address: 'Số 69 Lý Tự Trọng, Q.1', description: 'Thư viện lớn với hơn 500 chỗ ngồi.', has_wifi: true, has_power_outlets: true, quietness: 5, rating_avg: 4.7, total_capacity: 520, amenities: ['wifi', 'máy lạnh', 'tra cứu số'], location: { type: 'Point', coordinates: [106.6992, 10.7809] } },
            { id: 'spot-6', name: 'Phòng Lab AI Bách khoa Hà Nội', type: 'lab', address: 'Hai Bà Trưng, Hà Nội', description: 'Phòng nghiên cứu có máy trạm GPU.', has_wifi: true, has_power_outlets: true, quietness: 4, rating_avg: 4.8, total_capacity: 25, amenities: ['wifi', 'GPU', 'máy chủ'], location: { type: 'Point', coordinates: [105.8424, 21.0055] } },
            { id: 'spot-7', name: 'Thư viện Đà Nẵng', type: 'library', address: 'Hải Châu, Đà Nẵng', description: 'Thư viện công cộng hiện đại.', has_wifi: true, has_power_outlets: true, quietness: 4, rating_avg: 4.3, total_capacity: 160, amenities: ['wifi', 'phòng nhóm'], location: { type: 'Point', coordinates: [108.2022, 16.0544] } },
            { id: 'spot-8', name: 'Unicode Library Cần Thơ', type: 'library', address: 'Ninh Kiều, Cần Thơ', description: 'Không gian đọc mở cho sinh viên.', has_wifi: true, has_power_outlets: true, quietness: 3, rating_avg: 4.1, total_capacity: 90, amenities: ['wifi', 'cà phê'], location: { type: 'Point', coordinates: [105.7712, 10.0324] } },
        ],

        scholarships: [
            { id: 'sch-1', title: 'Học bổng Toàn phần Chính phủ Nhật Bản (MEXT) 2026', provider: 'Đại sứ quán Nhật Bản tại Việt Nam', description: `Học bổng toàn phần bậc đại học và sau đại học tại Nhật Bản, bao gồm học phí, sinh hoạt phí và vé máy bay. ${provenance('https://www.vn.emb-japan.go.jp/itpr_vi/mext.html')}`, value_amount: 0, deadline: iso(45), requirements: ['Tốt nghiệp THPT hoặc đại học', 'GPA từ 3.0/4.0', 'Chứng chỉ tiếng Nhật hoặc tiếng Anh'], apply_url: 'https://www.vn.emb-japan.go.jp/itpr_vi/mext.html', eligibility_criteria: 'Công dân Việt Nam, dưới 25 tuổi với bậc đại học, GPA ≥ 3.0', location: 'Nhật Bản', status: 'open' },
            { id: 'sch-2', title: 'Học bổng Khuyến khích Học tập DNTU', provider: 'Trường Đại học Công nghệ Đồng Nai', description: `Học bổng dành cho sinh viên có kết quả học tập xuất sắc tại DNTU. ${provenance('https://dntu.edu.vn')}`, value_amount: 15000000, deadline: iso(20), requirements: ['Sinh viên DNTU', 'GPA ≥ 3.2', 'Không vi phạm kỷ luật'], apply_url: 'https://dntu.edu.vn', eligibility_criteria: 'Sinh viên đang theo học tại DNTU từ năm 2', location: 'Đồng Nai', status: 'open' },
            { id: 'sch-3', title: 'Học bổng Vallet 2026', provider: 'Quỹ Vallet', description: `Học bổng hỗ trợ sinh viên xuất sắc ngành khoa học tự nhiên và kỹ thuật. ${provenance('https://vallet.org')}`, value_amount: 40000000, deadline: iso(60), requirements: ['Sinh viên năm 2 trở lên', 'GPA ≥ 3.4', 'Ngành STEM'], apply_url: 'https://vallet.org', eligibility_criteria: 'Sinh viên các ngành khoa học, kỹ thuật', location: 'Toàn quốc', status: 'open' },
            { id: 'sch-4', title: 'Học bổng Vingroup - Học bổng Khoa học Công nghệ', provider: 'Quỹ Đổi mới sáng tạo Vingroup (VinIF)', description: `Hỗ trợ sinh viên và nghiên cứu sinh ngành khoa học công nghệ. ${provenance('https://vinif.org')}`, value_amount: 60000000, deadline: iso(80), requirements: ['Có đề tài nghiên cứu', 'GPA ≥ 3.3'], apply_url: 'https://vinif.org', eligibility_criteria: 'Sinh viên năm cuối, học viên cao học', location: 'Toàn quốc', status: 'open' },
            { id: 'sch-5', title: 'Học bổng Đồng hành cùng Học sinh Nghèo hiếu học', provider: 'Hội Khuyến học tỉnh Đồng Nai', description: `Hỗ trợ học sinh có hoàn cảnh khó khăn tại Đồng Nai. ${provenance('https://khuyenhocdongnai.vn')}`, value_amount: 5000000, deadline: iso(15), requirements: ['Hộ nghèo/cận nghèo', 'Học lực khá trở lên'], apply_url: 'https://khuyenhocdongnai.vn', eligibility_criteria: 'Học sinh THCS/THPT trên địa bàn Đồng Nai', location: 'Đồng Nai', status: 'open' },
            { id: 'sch-6', title: 'Học bổng Kỹ thuật Hàn Quốc (KOICA)', provider: 'Cơ quan Hợp tác Quốc tế Hàn Quốc', description: `Học bổng thạc sĩ ngành kỹ thuật tại Hàn Quốc. ${provenance('https://www.koica.go.kr')}`, value_amount: 0, deadline: iso(90), requirements: ['Tốt nghiệp đại học', 'IELTS 6.0 hoặc tương đương'], apply_url: 'https://www.koica.go.kr', eligibility_criteria: 'Công chức, viên chức hoặc giảng viên', location: 'Hàn Quốc', status: 'open' },
            { id: 'sch-7', title: 'Học bổng Chắp cánh Ước mơ HCMUT', provider: 'Trường Đại học Bách khoa TP.HCM', description: `Hỗ trợ học phí cho sinh viên hiếu học. ${provenance('https://hcmut.edu.vn')}`, value_amount: 20000000, deadline: iso(35), requirements: ['Sinh viên HCMUT', 'Hoàn cảnh khó khăn'], apply_url: 'https://hcmut.edu.vn', eligibility_criteria: 'Sinh viên chính quy có hoàn cảnh khó khăn', location: 'TP.HCM', status: 'open' },
            { id: 'sch-8', title: 'Học bổng Nữ sinh STEM 2026', provider: 'Quỹ EduMap cùng đối tác', description: `Trao học bổng cho nữ sinh theo đuổi ngành STEM. ${provenance('https://edumap.vn')}`, value_amount: 25000000, deadline: iso(50), requirements: ['Nữ sinh THPT/đại học', 'Đam mê STEM'], apply_url: 'https://edumap.vn', eligibility_criteria: 'Nữ sinh từ 16 đến 22 tuổi', location: 'Toàn quốc', status: 'open' },
        ],

        scholarshipApplications: [
            { id: 'app-sch-1', scholarship_id: 'sch-2', user_id: 'usr-demo-admin', status: 'pending', created_at: iso(-6), personal_statement: 'Em mong muốn tiếp tục học tập và nghiên cứu tại DNTU.', cv_url: 'https://edumap.vn/cv/demo.pdf' },
        ],

        jobs: [
            { id: 'job-1', title: 'Lập trình viên Backend (Node.js)', company_name: 'Công ty CP Công nghệ CMC Đồng Nai', company_id: 'org-1', location: 'Biên Hoà, Đồng Nai', salary_range: '15 - 25 triệu', job_type: 'full_time', description: 'Phát triển API NestJS cho hệ thống giáo dục.', requirements: ['Node.js', 'TypeScript', 'SQL'], skills: ['Node.js', 'TypeScript', 'PostgreSQL'], created_at: iso(-2), posted_at: iso(-2), deadline: iso(20), source: 'VietnamWorks', status: 'open' },
            { id: 'job-2', title: 'Thực tập sinh Phân tích dữ liệu', company_name: 'Công ty TNHH Thống kê Số Việt', company_id: 'org-2', location: 'TP.HCM', salary_range: '5 - 7 triệu', job_type: 'internship', description: 'Hỗ trợ làm sạch dữ liệu và xây dashboard.', requirements: ['SQL cơ bản', 'Python'], skills: ['Python', 'SQL', 'Power BI'], created_at: iso(-4), posted_at: iso(-4), deadline: iso(12), source: 'VietnamWorks', status: 'open' },
            { id: 'job-3', title: 'Giáo viên STEM', company_name: 'Trường THCS Nguyễn Trãi', company_id: 'org-3', location: 'Biên Hoà, Đồng Nai', salary_range: '10 - 14 triệu', job_type: 'full_time', description: 'Giảng dạy STEM cho học sinh THCS.', requirements: ['Sư phạm', 'Kinh nghiệm STEM'], skills: ['STEM', 'Sư phạm'], created_at: iso(-7), posted_at: iso(-7), deadline: iso(25), source: 'EduMap', status: 'open' },
            { id: 'job-4', title: 'Chuyên viên UI/UX', company_name: 'Công ty CP Thiết kế Sáng tạo Đông Á', company_id: 'org-4', location: 'Hà Nội', salary_range: '18 - 28 triệu', job_type: 'full_time', description: 'Thiết kế trải nghiệm cho sản phẩm giáo dục số.', requirements: ['Figma', 'Nguyên lý UX'], skills: ['Figma', 'UI/UX'], created_at: iso(-9), posted_at: iso(-9), deadline: iso(18), source: 'VietnamWorks', status: 'open' },
            { id: 'job-5', title: 'Kỹ sư AI (NLP tiếng Việt)', company_name: 'Viện Nghiên cứu Trí tuệ Nhân tạo Việt Nam', company_id: 'org-5', location: 'Hà Nội', salary_range: '25 - 40 triệu', job_type: 'full_time', description: 'Nghiên cứu mô hình ngôn ngữ tiếng Việt.', requirements: ['Python', 'PyTorch', 'NLP'], skills: ['Python', 'NLP', 'Deep Learning'], created_at: iso(-11), posted_at: iso(-11), deadline: iso(30), source: 'EduMap', status: 'open' },
            { id: 'job-6', title: 'Nhân viên Kinh doanh Giáo dục', company_name: 'Trung tâm Ngoại ngữ Đồng Nai', company_id: 'org-6', location: 'Biên Hoà, Đồng Nai', salary_range: '8 - 12 triệu', job_type: 'full_time', description: 'Tư vấn khóa học cho học viên.', requirements: ['Giao tiếp tốt'], skills: ['Sales', 'Tư vấn'], created_at: iso(-13), posted_at: iso(-13), deadline: iso(10), source: 'EduMap', status: 'open' },
            { id: 'job-7', title: 'Kỹ thuật viên Phần cứng', company_name: 'Công ty TNHH Điện tử Biên Hoà', company_id: 'org-7', location: 'Biên Hoà, Đồng Nai', salary_range: '12 - 16 triệu', job_type: 'full_time', description: 'Bảo trì thiết bị phòng lab.', requirements: ['Điện tử', 'Thực hành tốt'], skills: ['Điện tử', 'Bảo trì'], created_at: iso(-15), posted_at: iso(-15), deadline: iso(22), source: 'VietnamWorks', status: 'open' },
            { id: 'job-8', title: 'Thực tập sinh Truyền thông', company_name: 'Trường Đại học Công nghệ Đồng Nai', company_id: 'org-8', location: 'Biên Hoà, Đồng Nai', salary_range: '3 - 5 triệu', job_type: 'internship', description: 'Viết bài và quản lý kênh truyền thông của trường.', requirements: ['Viết tốt', 'Canva'], skills: ['Content', 'Canva'], created_at: iso(-18), posted_at: iso(-18), deadline: iso(8), source: 'EduMap', status: 'open' },
        ],

        jobApplications: [],

        careerPaths: [
            { id: 'career-1', title: 'Kỹ sư Phần mềm (Backend)', field: 'Công nghệ thông tin', description: 'Xây dựng dịch vụ máy chủ, API và cơ sở dữ liệu.', salary_range: '15 - 35 triệu', demand_level: 'high', skills_required: ['Node.js', 'TypeScript', 'SQL', 'System Design'], roadmap: [{ step: 1, title: 'Nền tảng lập trình', duration: '3 tháng', skills: ['Python', 'OOP'] }, { step: 2, title: 'Phát triển web backend', duration: '4 tháng', skills: ['Node.js', 'REST API'] }, { step: 3, title: 'Cơ sở dữ liệu & triển khai', duration: '3 tháng', skills: ['PostgreSQL', 'Docker'] }, { step: 4, title: 'Dự án thực tế', duration: '6 tháng', skills: ['System Design', 'CI/CD'] }] },
            { id: 'career-2', title: 'Chuyên viên Phân tích dữ liệu', field: 'Dữ liệu', description: 'Phân tích dữ liệu để hỗ trợ quyết định.', salary_range: '12 - 28 triệu', demand_level: 'high', skills_required: ['SQL', 'Python', 'Power BI'], roadmap: [{ step: 1, title: 'Thống kê cơ bản', duration: '2 tháng', skills: ['Statistics'] }, { step: 2, title: 'SQL & trực quan hoá', duration: '3 tháng', skills: ['SQL', 'Power BI'] }, { step: 3, title: 'Python cho dữ liệu', duration: '3 tháng', skills: ['Pandas', 'Matplotlib'] }] },
            { id: 'career-3', title: 'Kỹ sư AI/ML', field: 'Trí tuệ nhân tạo', description: 'Huấn luyện và triển khai mô hình học máy.', salary_range: '20 - 45 triệu', demand_level: 'high', skills_required: ['Python', 'PyTorch', 'NLP'], roadmap: [{ step: 1, title: 'Toán cho AI', duration: '3 tháng', skills: ['Linear Algebra', 'Probability'] }, { step: 2, title: 'Machine Learning', duration: '4 tháng', skills: ['Scikit-learn', 'PyTorch'] }, { step: 3, title: 'Triển khai mô hình', duration: '3 tháng', skills: ['FastAPI', 'MLOps'] }] },
            { id: 'career-4', title: 'Giáo viên STEM', field: 'Giáo dục', description: 'Giảng dạy tích hợp khoa học, công nghệ, kỹ thuật và toán.', salary_range: '9 - 16 triệu', demand_level: 'medium', skills_required: ['STEM', 'Sư phạm', 'Thiết kế bài giảng'], roadmap: [{ step: 1, title: 'Nghiệp vụ sư phạm', duration: '4 tháng', skills: ['Sư phạm'] }, { step: 2, title: 'Thiết kế bài giảng STEM', duration: '3 tháng', skills: ['Lesson Design'] }] },
            { id: 'career-5', title: 'Chuyên viên UI/UX', field: 'Thiết kế', description: 'Thiết kế trải nghiệm người dùng cho sản phẩm số.', salary_range: '14 - 30 triệu', demand_level: 'medium', skills_required: ['Figma', 'UX Research', 'Prototyping'], roadmap: [{ step: 1, title: 'Nguyên lý thiết kế', duration: '2 tháng', skills: ['Design Thinking'] }, { step: 2, title: 'Công cụ & prototype', duration: '3 tháng', skills: ['Figma'] }, { step: 3, title: 'Nghiên cứu người dùng', duration: '2 tháng', skills: ['UX Research'] }] },
            { id: 'career-6', title: 'Chuyên viên Truyền thông Giáo dục', field: 'Truyền thông', description: 'Xây dựng nội dung và cộng đồng cho tổ chức giáo dục.', salary_range: '8 - 18 triệu', demand_level: 'medium', skills_required: ['Content', 'Social Media'], roadmap: [{ step: 1, title: 'Viết nội dung', duration: '2 tháng', skills: ['Copywriting'] }, { step: 2, title: 'Quản trị kênh', duration: '3 tháng', skills: ['Social Media'] }] },
        ],

        userSkills: [
            { id: 'uskill-1', user_id: 'usr-demo-admin', skill_name: 'JavaScript', level: 'intermediate', years_experience: 2, created_at: iso(-40) },
            { id: 'uskill-2', user_id: 'usr-demo-admin', skill_name: 'SQL', level: 'intermediate', years_experience: 1, created_at: iso(-25) },
            { id: 'uskill-3', user_id: 'usr-demo-admin', skill_name: 'Figma', level: 'beginner', years_experience: 1, created_at: iso(-12) },
        ],

        userCareers: [
            { id: 'ucareer-1', user_id: 'usr-demo-admin', career_path_id: 'career-1', title: 'Kỹ sư Phần mềm (Backend)', status: 'in_progress', progress_percent: 45, target_date: dateOnly(180), created_at: iso(-30) },
        ],

        internships: [
            { id: 'int-1', title: 'Thực tập sinh Backend NestJS', description: 'Tham gia phát triển API cho nền tảng giáo dục.', field: 'Công nghệ thông tin', salary_range: '5 - 8 triệu', status: 'open', created_at: iso(-3), company: { id: 'org-1', full_name: 'Công ty CP Công nghệ CMC Đồng Nai', avatar_url: `${AVATAR}CMC`, industry: 'Công nghệ' }, location: 'Biên Hoà, Đồng Nai', address: 'Biên Hoà, Đồng Nai', duration: '3 tháng', positions: 3 },
            { id: 'int-2', title: 'Thực tập sinh Data Analyst', description: 'Phân tích dữ liệu tuyển sinh và học tập.', field: 'Dữ liệu', salary_range: '4 - 6 triệu', status: 'open', created_at: iso(-6), company: { id: 'org-2', full_name: 'Công ty TNHH Thống kê Số Việt', avatar_url: `${AVATAR}SoViet`, industry: 'Dữ liệu' }, location: 'TP.HCM', address: 'TP.HCM', duration: '4 tháng', positions: 2 },
            { id: 'int-3', title: 'Thực tập sinh Marketing Giáo dục', description: 'Hỗ trợ chiến dịch tuyển sinh.', field: 'Marketing', salary_range: '3 - 5 triệu', status: 'open', created_at: iso(-8), company: { id: 'org-8', full_name: 'Trường Đại học Công nghệ Đồng Nai', avatar_url: `${AVATAR}DNTU`, industry: 'Giáo dục' }, location: 'Biên Hoà, Đồng Nai', address: 'Biên Hoà, Đồng Nai', duration: '3 tháng', positions: 4 },
            { id: 'int-4', title: 'Thực tập sinh AI/NLP', description: 'Tiền xử lý dữ liệu tiếng Việt cho mô hình ngôn ngữ.', field: 'Trí tuệ nhân tạo', salary_range: '6 - 10 triệu', status: 'open', created_at: iso(-10), company: { id: 'org-5', full_name: 'Viện Nghiên cứu Trí tuệ Nhân tạo Việt Nam', avatar_url: `${AVATAR}AI`, industry: 'Nghiên cứu' }, location: 'Hà Nội', address: 'Hà Nội', duration: '6 tháng', positions: 2 },
            { id: 'int-5', title: 'Thực tập sinh Thiết kế UI/UX', description: 'Thiết kế giao diện ứng dụng học tập.', field: 'Thiết kế', salary_range: '4 - 7 triệu', status: 'open', created_at: iso(-12), company: { id: 'org-4', full_name: 'Công ty CP Thiết kế Sáng tạo Đông Á', avatar_url: `${AVATAR}DongA`, industry: 'Thiết kế' }, location: 'Hà Nội', address: 'Hà Nội', duration: '3 tháng', positions: 2 },
        ],

        internshipApplications: [],

        events: [
            { id: 'evt-1', title: 'Ngày hội Tuyển sinh DNTU 2026', description: 'Tư vấn ngành học, học bổng và cơ hội việc làm.', type: 'admissions', location: 'Trường Đại học Công nghệ Đồng Nai', address: 'Số 1 Nguyễn Khuyến, Biên Hoà', start_date: iso(12), end_date: iso(12), capacity: 800, registered_count: 412, organizer_id: 'org-8', status: 'upcoming', image_url: 'https://placehold.co/800x400?text=EduMap', created_at: iso(-14) },
            { id: 'evt-2', title: 'Cuộc thi Robocon Học sinh Đồng Nai', description: 'Sân chơi robotics cho học sinh THCS và THPT.', type: 'competition', location: 'Nhà thi đấu Đồng Nai', address: 'Biên Hoà, Đồng Nai', start_date: iso(25), end_date: iso(26), capacity: 300, registered_count: 148, organizer_id: 'org-3', status: 'upcoming', image_url: 'https://placehold.co/800x400?text=EduMap', created_at: iso(-21) },
            { id: 'evt-3', title: 'Hội thảo Hướng nghiệp ngành CNTT', description: 'Chia sẻ lộ trình nghề nghiệp từ chuyên gia.', type: 'seminar', location: 'Trung tâm Học liệu DNTU', address: 'Trảng Dài, Biên Hoà', start_date: iso(8), end_date: iso(8), capacity: 200, registered_count: 121, organizer_id: 'org-8', status: 'upcoming', image_url: 'https://placehold.co/800x400?text=EduMap', created_at: iso(-9) },
            { id: 'evt-4', title: 'Ngày hội Sách và Văn hoá đọc', description: 'Trao đổi sách, giao lưu tác giả.', type: 'festival', location: 'Thư viện tỉnh Đồng Nai', address: 'Số 1 Hưng Đạo Vương, Biên Hoà', start_date: iso(-5), end_date: iso(-4), capacity: 500, registered_count: 500, organizer_id: 'org-9', status: 'completed', image_url: 'https://placehold.co/800x400?text=EduMap', created_at: iso(-30) },
            { id: 'evt-5', title: 'Workshop AI cho Học sinh', description: 'Giới thiệu AI và thực hành mô hình nhỏ.', type: 'workshop', location: 'Phòng STEM DNTU', address: 'Trảng Dài, Biên Hoà', start_date: iso(18), end_date: iso(18), capacity: 60, registered_count: 57, organizer_id: 'org-8', status: 'upcoming', image_url: 'https://placehold.co/800x400?text=EduMap', created_at: iso(-6) },
        ],

        eventRegistrations: [],

        opportunities: [
            { id: 'opp-1', title: 'Học bổng Toàn phần Chính phủ Nhật Bản (MEXT) 2026', category: 'scholarship', type: 'scholarship', description: 'Học bổng toàn phần bậc đại học và sau đại học tại Nhật Bản.', url: 'https://www.vn.emb-japan.go.jp/itpr_vi/mext.html', location: { lat: 35.6762, lng: 139.6503 }, address: 'Nhật Bản', deadline: iso(45), is_team_finding_open: false, tags: ['du học', 'học bổng', 'Nhật Bản'], field: 'CNTT', region: 'Toàn quốc', organization: 'Đại sứ quán Nhật Bản', gpa_requirement: 3.0, created_at: iso(-20) },
            { id: 'opp-2', title: 'Cuộc thi Sáng tạo STEM 2026', category: 'competition', type: 'competition', description: 'Cuộc thi dành cho học sinh THPT đam mê STEM.', url: 'https://stem.edu.vn', location: { lat: 10.957, lng: 106.843 }, address: 'Biên Hoà, Đồng Nai', deadline: iso(30), is_team_finding_open: true, tags: ['STEM', 'thi đấu'], field: 'STEM', region: 'Đồng Nai', organization: 'Sở GD&ĐT Đồng Nai', gpa_requirement: null, created_at: iso(-16) },
            { id: 'opp-3', title: 'Thực tập sinh Phân tích dữ liệu', category: 'internship', type: 'internship', description: 'Cơ hội thực tập tại công ty dữ liệu.', url: null, location: { lat: 10.7769, lng: 106.7009 }, address: 'TP.HCM', deadline: iso(12), is_team_finding_open: false, tags: ['dữ liệu', 'thực tập'], field: 'Dữ liệu', region: 'TP.HCM', organization: 'Thống kê Số Việt', gpa_requirement: 2.8, created_at: iso(-9) },
            { id: 'opp-4', title: 'Học bổng Nữ sinh STEM 2026', category: 'scholarship', type: 'scholarship', description: 'Học bổng dành cho nữ sinh theo đuổi STEM.', url: 'https://edumap.vn', location: { lat: 21.0285, lng: 105.8542 }, address: 'Toàn quốc', deadline: iso(50), is_team_finding_open: false, tags: ['nữ sinh', 'STEM'], field: 'STEM', region: 'Toàn quốc', organization: 'Quỹ EduMap', gpa_requirement: 3.2, created_at: iso(-25) },
            { id: 'opp-5', title: 'Việc làm Lập trình viên Backend', category: 'job', type: 'job', description: 'Tuyển lập trình viên Node.js tại Biên Hoà.', url: null, location: { lat: 10.9753, lng: 106.8452 }, address: 'Biên Hoà, Đồng Nai', deadline: iso(20), is_team_finding_open: false, tags: ['CNTT', 'Node.js'], field: 'CNTT', region: 'Đồng Nai', organization: 'CMC Đồng Nai', gpa_requirement: null, created_at: iso(-4) },
            { id: 'opp-6', title: 'Học bổng Vallet 2026', category: 'scholarship', type: 'scholarship', description: 'Học bổng cho sinh viên xuất sắc ngành khoa học.', url: 'https://vallet.org', location: { lat: 10.7769, lng: 106.7009 }, address: 'Toàn quốc', deadline: iso(60), is_team_finding_open: false, tags: ['khoa học', 'học bổng'], field: 'Khoa học', region: 'Toàn quốc', organization: 'Quỹ Vallet', gpa_requirement: 3.4, created_at: iso(-40) },
            { id: 'opp-7', title: 'Cuộc thi Lập trình Hackathon EduMap 2026', category: 'hackathon', type: 'competition', description: 'Xây dựng giải pháp số cho giáo dục.', url: 'https://edumap.vn/hackathon', location: { lat: 10.957, lng: 106.843 }, address: 'Biên Hoà, Đồng Nai', deadline: iso(40), is_team_finding_open: true, tags: ['hackathon', 'CNTT'], field: 'CNTT', region: 'Đồng Nai', organization: 'EduMap', gpa_requirement: null, created_at: iso(-11) },
            { id: 'opp-8', title: 'Học bổng Kỹ thuật Hàn Quốc (KOICA)', category: 'scholarship', type: 'scholarship', description: 'Học bổng thạc sĩ kỹ thuật tại Hàn Quốc.', url: 'https://www.koica.go.kr', location: { lat: 37.5665, lng: 126.978 }, address: 'Hàn Quốc', deadline: iso(90), is_team_finding_open: false, tags: ['du học', 'kỹ thuật'], field: 'Kỹ thuật', region: 'Toàn quốc', organization: 'KOICA', gpa_requirement: 3.0, created_at: iso(-55) },
        ],

        libraryResources: [
            { id: 'lib-1', title: 'Giáo trình Lập trình TypeScript cơ bản', author: 'Bộ môn CNTT - DNTU', type: 'pdf', subject: 'Programming', description: 'Tài liệu nhập môn TypeScript cho sinh viên năm 1.', file_url: 'https://developer.mozilla.org/vi/docs/Web/JavaScript', cover_image_url: 'https://placehold.co/640x400?text=EduMap', view_count: 421, source: 'local-sqlite', created_at: iso(-120) },
            { id: 'lib-2', title: 'Nhập môn Trí tuệ Nhân tạo', author: 'Nhiều tác giả', type: 'pdf', subject: 'Science', description: 'Kiến thức nền tảng về AI và học máy.', file_url: 'https://arxiv.org/', cover_image_url: 'https://placehold.co/640x400?text=EduMap', view_count: 612, source: 'local-sqlite', created_at: iso(-200) },
            { id: 'lib-3', title: 'Kỹ năng thuyết trình hiệu quả', author: 'Trung tâm Kỹ năng mềm', type: 'article', subject: 'Soft Skills', description: 'Hướng dẫn chuẩn bị và trình bày trước đám đông.', file_url: 'https://www.ted.com/talks', cover_image_url: 'https://placehold.co/640x400?text=EduMap', view_count: 388, source: 'local-sqlite', created_at: iso(-90) },
            { id: 'lib-4', title: 'Video: Thiết kế UI với Figma', author: 'Đông Á Design', type: 'video', subject: 'Design', description: 'Chuỗi video thực hành thiết kế giao diện.', file_url: 'https://www.youtube.com/results?search_query=figma', cover_image_url: 'https://placehold.co/640x400?text=EduMap', view_count: 274, source: 'local-sqlite', created_at: iso(-70) },
            { id: 'lib-5', title: 'Sách: Toán rời rạc và Ứng dụng', author: 'NXB Giáo dục Việt Nam', type: 'book', subject: 'Science', description: 'Giáo trình toán rời rạc cho ngành CNTT.', file_url: 'https://nxbgd.vn', cover_image_url: 'https://placehold.co/640x400?text=EduMap', view_count: 190, source: 'local-sqlite', created_at: iso(-150) },
            { id: 'lib-6', title: 'Cẩm nang Hướng nghiệp cho Học sinh THPT', author: 'EduMap', type: 'article', subject: 'Soft Skills', description: 'Hướng dẫn chọn ngành và tìm hiểu thị trường lao động.', file_url: 'https://edumap.vn', cover_image_url: 'https://placehold.co/640x400?text=EduMap', view_count: 512, source: 'local-sqlite', created_at: iso(-60) },
            { id: 'lib-7', title: 'Giáo trình Cơ sở Dữ liệu', author: 'HCMUT', type: 'pdf', subject: 'Programming', description: 'Mô hình quan hệ, SQL và chuẩn hoá.', file_url: 'https://hcmut.edu.vn', cover_image_url: 'https://placehold.co/640x400?text=EduMap', view_count: 333, source: 'local-sqlite', created_at: iso(-95) },
            { id: 'lib-8', title: 'Khóa học Python cho người mới', author: 'Open Library', type: 'video', subject: 'Programming', description: 'Video bài giảng Python cơ bản.', file_url: 'https://openlibrary.org', cover_image_url: 'https://placehold.co/640x400?text=EduMap', view_count: 745, source: 'open-library', created_at: iso(-40) },
            { id: 'lib-9', title: 'Tiếng Anh Giao tiếp cho Sinh viên', author: 'Trung tâm Ngoại ngữ Đồng Nai', type: 'pdf', subject: 'Soft Skills', description: 'Mẫu câu và bài tập giao tiếp hằng ngày.', file_url: 'https://edumap.vn', cover_image_url: 'https://placehold.co/640x400?text=EduMap', view_count: 268, source: 'local-sqlite', created_at: iso(-55) },
            { id: 'lib-10', title: 'Nhập môn Khoa học Dữ liệu', author: 'Open Library', type: 'book', subject: 'Science', description: 'Quy trình phân tích dữ liệu từ thu thập đến báo cáo.', file_url: 'https://openlibrary.org', cover_image_url: 'https://placehold.co/640x400?text=EduMap', view_count: 401, source: 'open-library', created_at: iso(-35) },
            { id: 'lib-11', title: 'Thiết kế Trải nghiệm Người dùng', author: 'Đông Á Design', type: 'article', subject: 'Design', description: 'Nguyên tắc UX và quy trình nghiên cứu người dùng.', file_url: 'https://edumap.vn', cover_image_url: 'https://placehold.co/640x400?text=EduMap', view_count: 158, source: 'local-sqlite', created_at: iso(-28) },
            { id: 'lib-12', title: 'Giáo trình Vật lý Đại cương', author: 'NXB Giáo dục Việt Nam', type: 'pdf', subject: 'Science', description: 'Cơ học, nhiệt học và điện từ học.', file_url: 'https://nxbgd.vn', cover_image_url: 'https://placehold.co/640x400?text=EduMap', view_count: 221, source: 'local-sqlite', created_at: iso(-180) },
        ],

        mentors: [
            { id: 'mentor-1', user_id: 'usr-mentor-1', specialty: 'Công nghệ thông tin', specialties: ['Backend', 'System Design', 'Phỏng vấn kỹ thuật'], bio: 'Kỹ sư phần mềm 8 năm kinh nghiệm tại TP.HCM.', rating_avg: 4.8, rating_count: 42, is_verified: true, hourly_rate: 0, user: { id: 'usr-mentor-1', full_name: 'Nguyễn Minh Khoa', avatar_url: `${AVATAR}MinhKhoa`, role: 'mentor' } },
            { id: 'mentor-2', user_id: 'usr-mentor-2', specialty: 'Dữ liệu', specialties: ['Data Analytics', 'SQL', 'Power BI'], bio: 'Chuyên viên phân tích dữ liệu tại công ty tài chính.', rating_avg: 4.6, rating_count: 28, is_verified: true, hourly_rate: 0, user: { id: 'usr-mentor-2', full_name: 'Trần Thị Hồng Nhung', avatar_url: `${AVATAR}HongNhung`, role: 'mentor' } },
            { id: 'mentor-3', user_id: 'usr-mentor-3', specialty: 'Giáo dục', specialties: ['STEM', 'Thiết kế bài giảng'], bio: 'Giáo viên STEM 10 năm tại Đồng Nai.', rating_avg: 4.9, rating_count: 51, is_verified: true, hourly_rate: 0, user: { id: 'usr-mentor-3', full_name: 'Phạm Quốc Hưng', avatar_url: `${AVATAR}QuocHung`, role: 'mentor' } },
            { id: 'mentor-4', user_id: 'usr-mentor-4', specialty: 'Thiết kế', specialties: ['UI/UX', 'Figma', 'Portfolio'], bio: 'Product Designer tại một startup giáo dục.', rating_avg: 4.5, rating_count: 19, is_verified: false, hourly_rate: 0, user: { id: 'usr-mentor-4', full_name: 'Lê Thuỳ Dương', avatar_url: `${AVATAR}ThuyDuong`, role: 'mentor' } },
            { id: 'mentor-5', user_id: 'usr-mentor-5', specialty: 'Du học', specialties: ['MEXT', 'Học bổng châu Âu', 'SOP'], bio: 'Cựu du học sinh Nhật Bản, hỗ trợ viết SOP.', rating_avg: 4.7, rating_count: 33, is_verified: true, hourly_rate: 0, user: { id: 'usr-mentor-5', full_name: 'Đỗ Anh Tuấn', avatar_url: `${AVATAR}AnhTuan`, role: 'mentor' } },
            { id: 'mentor-6', user_id: 'usr-mentor-6', specialty: 'Trí tuệ nhân tạo', specialties: ['NLP', 'PyTorch', 'Nghiên cứu'], bio: 'Nghiên cứu viên NLP tiếng Việt.', rating_avg: 4.8, rating_count: 24, is_verified: true, hourly_rate: 0, user: { id: 'usr-mentor-6', full_name: 'Vũ Hoàng Nam', avatar_url: `${AVATAR}HoangNam`, role: 'mentor' } },
        ],

        mentorBookings: [
            { id: 'booking-1', mentor_id: 'mentor-1', mentor_name: 'Nguyễn Minh Khoa', student_id: 'usr-demo-admin', start: iso(3), end: iso(3), status: 'confirmed', meeting_url: 'https://meet.google.com/edumap-demo', created_at: iso(-2) },
        ],

        communityPosts: [
            { id: 'post-1', title: 'Kinh nghiệm ôn thi THPT Quốc gia môn Toán', content: 'Mình chia sẻ lộ trình ôn thi 6 tháng và bộ tài liệu tự biên soạn. Mọi người có thể tải ở phần đính kèm.', author_id: 'usr-student-1', group_id: 'group-1', like_count: 42, comment_count: 2, status: 'published', created_at: iso(-2), author: { id: 'usr-student-1', full_name: 'Ngô Gia Hân', avatar_url: `${AVATAR}GiaHan`, role: 'student' }, group: { id: 'group-1', name: 'Học tập THPT', description: 'Nhóm trao đổi học tập bậc THPT' } },
            { id: 'post-2', title: 'Tìm bạn cùng nhóm thi Hackathon EduMap', content: 'Mình cần thêm 2 bạn biết React và một bạn làm backend Node.js để tham gia Hackathon EduMap 2026.', author_id: 'usr-student-2', group_id: 'group-2', like_count: 18, comment_count: 1, status: 'published', created_at: iso(-4), author: { id: 'usr-student-2', full_name: 'Bùi Anh Kiệt', avatar_url: `${AVATAR}AnhKiet`, role: 'student' }, group: { id: 'group-2', name: 'CNTT & Lập trình', description: 'Cộng đồng lập trình viên trẻ' } },
            { id: 'post-3', title: 'Review học bổng MEXT sau khi trúng tuyển', content: 'Mình vừa nhận kết quả học bổng MEXT 2026, chia sẻ timeline chuẩn bị hồ sơ cho các bạn khoá sau.', author_id: 'usr-student-3', group_id: 'group-3', like_count: 76, comment_count: 3, status: 'published', created_at: iso(-7), author: { id: 'usr-student-3', full_name: 'Trịnh Mai Phương', avatar_url: `${AVATAR}MaiPhuong`, role: 'student' }, group: { id: 'group-3', name: 'Du học & Học bổng', description: 'Chia sẻ kinh nghiệm du học' } },
            { id: 'post-4', title: 'Nhóm học Tiếng Anh giao tiếp tối thứ 3 hàng tuần', content: 'Nhóm sinh viên DNTU mở lớp học tiếng Anh miễn phí, ai muốn tham gia thì comment nhé.', author_id: 'usr-student-4', group_id: 'group-4', like_count: 27, comment_count: 2, status: 'published', created_at: iso(-11), author: { id: 'usr-student-4', full_name: 'Lâm Thanh Tùng', avatar_url: `${AVATAR}ThanhTung`, role: 'student' }, group: { id: 'group-4', name: 'Ngoại ngữ', description: 'Học và luyện ngoại ngữ' } },
            { id: 'post-5', title: 'Chia sẻ bộ đề cương ôn tập Vật lý 12', content: 'Mình tổng hợp đề cương và đáp án cho các chương trọng tâm.', author_id: 'usr-student-5', group_id: 'group-1', like_count: 33, comment_count: 1, status: 'published', created_at: iso(-15), author: { id: 'usr-student-5', full_name: 'Phan Bảo Ngọc', avatar_url: `${AVATAR}BaoNgoc`, role: 'student' }, group: { id: 'group-1', name: 'Học tập THPT', description: 'Nhóm trao đổi học tập bậc THPT' } },
        ],

        communityComments: [
            { id: 'cmt-1', post_id: 'post-1', author_id: 'usr-student-2', content: 'Cảm ơn bạn, tài liệu rất hữu ích!', like_count: 4, status: 'published', created_at: iso(-1), author: { id: 'usr-student-2', full_name: 'Bùi Anh Kiệt', avatar_url: `${AVATAR}AnhKiet`, role: 'student' } },
            { id: 'cmt-2', post_id: 'post-1', author_id: 'usr-student-3', content: 'Bạn có thể chia sẻ thêm đề thi thử không?', like_count: 2, status: 'published', created_at: iso(-1), author: { id: 'usr-student-3', full_name: 'Trịnh Mai Phương', avatar_url: `${AVATAR}MaiPhuong`, role: 'student' } },
            { id: 'cmt-3', post_id: 'post-3', author_id: 'usr-student-1', content: 'Chúc mừng bạn! Timeline rất rõ ràng.', like_count: 6, status: 'published', created_at: iso(-6), author: { id: 'usr-student-1', full_name: 'Ngô Gia Hân', avatar_url: `${AVATAR}GiaHan`, role: 'student' } },
        ],

        communityGroups: [
            { id: 'group-1', name: 'Học tập THPT', description: 'Nhóm trao đổi học tập bậc THPT', member_count: 412 },
            { id: 'group-2', name: 'CNTT & Lập trình', description: 'Cộng đồng lập trình viên trẻ', member_count: 328 },
            { id: 'group-3', name: 'Du học & Học bổng', description: 'Chia sẻ kinh nghiệm du học', member_count: 256 },
            { id: 'group-4', name: 'Ngoại ngữ', description: 'Học và luyện ngoại ngữ', member_count: 189 },
        ],

        wifiLocations: [
            { id: 'wifi-1', name: 'Wifi miễn phí Thư viện Đồng Nai', description: 'Cáp quang tốc độ cao, miễn phí cho học sinh sinh viên.', ssid: 'ThuvienDongNai', password: '', is_free: true, speed_mbps: 45, provider: 'Thư viện tỉnh Đồng Nai', location: { type: 'Point', coordinates: [106.8186, 10.9576] }, coordinates: { type: 'Point', coordinates: [106.8186, 10.9576] }, address: 'Số 1 Hưng Đạo Vương, Biên Hoà', rating_avg: 4.4, rating_count: 48, verified: true, is_verified: true, reported_by: 'usr-demo-admin', created_at: iso(-40) },
            { id: 'wifi-2', name: 'Wifi KTX DNTU', description: 'Wifi nội bộ ký túc xá, miễn phí cho sinh viên.', ssid: 'DNTU-KTX', password: '', is_free: true, speed_mbps: 60, provider: 'DNTU', location: { type: 'Point', coordinates: [106.8472, 10.9761] }, coordinates: { type: 'Point', coordinates: [106.8472, 10.9761] }, address: 'Trảng Dài, Biên Hoà', rating_avg: 4.1, rating_count: 31, verified: true, is_verified: true, reported_by: 'usr-student-1', created_at: iso(-30) },
            { id: 'wifi-3', name: 'Wifi Cà phê An Nhiên', description: 'Wifi quán cà phê, mật khẩu tại quầy.', ssid: 'AnNhien_Cafe', password: 'annhien2026', is_free: false, speed_mbps: 35, provider: 'An Nhiên', location: { type: 'Point', coordinates: [106.8421, 10.9521] }, coordinates: { type: 'Point', coordinates: [106.8421, 10.9521] }, address: 'P. Tân Tiến, Biên Hoà', rating_avg: 4.0, rating_count: 17, verified: false, is_verified: false, reported_by: 'usr-student-2', created_at: iso(-22) },
            { id: 'wifi-4', name: 'Wifi Trung tâm Học liệu DNTU', description: 'Wifi tốc độ cao trong khu học liệu.', ssid: 'DNTU-Library', password: '', is_free: true, speed_mbps: 80, provider: 'DNTU', location: { type: 'Point', coordinates: [106.8461, 10.9748] }, coordinates: { type: 'Point', coordinates: [106.8461, 10.9748] }, address: 'Trảng Dài, Biên Hoà', rating_avg: 4.5, rating_count: 26, verified: true, is_verified: true, reported_by: 'usr-demo-admin', created_at: iso(-18) },
            { id: 'wifi-5', name: 'Wifi Phố đi bộ Nguyễn Huệ', description: 'Wifi công cộng miễn phí của thành phố.', ssid: 'HCM-Public', password: '', is_free: true, speed_mbps: 25, provider: 'TP.HCM', location: { type: 'Point', coordinates: [106.7038, 10.7743] }, coordinates: { type: 'Point', coordinates: [106.7038, 10.7743] }, address: 'Q.1, TP.HCM', rating_avg: 3.8, rating_count: 12, verified: false, is_verified: false, reported_by: 'usr-student-3', created_at: iso(-12) },
            { id: 'wifi-6', name: 'Wifi Thư viện Tổng hợp TP.HCM', description: 'Wifi miễn phí cho bạn đọc.', ssid: 'ThuVienTongHop', password: '', is_free: true, speed_mbps: 50, provider: 'Thư viện TP.HCM', location: { type: 'Point', coordinates: [106.6992, 10.7809] }, coordinates: { type: 'Point', coordinates: [106.6992, 10.7809] }, address: 'Số 69 Lý Tự Trọng, Q.1', rating_avg: 4.3, rating_count: 21, verified: true, is_verified: true, reported_by: 'usr-mentor-1', created_at: iso(-9) },
        ],

        greenChallenges: [
            { id: 'green-1', title: 'Nhặt rác tại Công viên Bửu Long', description: 'Tham gia nhặt rác và phân loại tại công viên.', points: 120, carbon_saved_kg: 18, image_url: 'https://placehold.co/640x400?text=EduMap', status: 'active', participants_count: 84, lat: 10.9633, lng: 106.7952, address: 'Bửu Long, Biên Hoà', created_at: iso(-20) },
            { id: 'green-2', title: 'Trồng cây xanh tại trường học', description: 'Trồng 100 cây xanh trong khuôn viên trường.', points: 200, carbon_saved_kg: 45, image_url: 'https://placehold.co/640x400?text=EduMap', status: 'active', participants_count: 52, lat: 10.9753, lng: 106.8452, address: 'DNTU, Biên Hoà', created_at: iso(-16) },
            { id: 'green-3', title: 'Tiết kiệm điện trong lớp học', description: 'Tắt thiết bị không sử dụng trong lớp.', points: 60, carbon_saved_kg: 8, image_url: 'https://placehold.co/640x400?text=EduMap', status: 'active', participants_count: 130, lat: 10.9465, lng: 106.8188, address: 'THCS Nguyễn Trãi, Biên Hoà', created_at: iso(-30) },
            { id: 'green-4', title: 'Ngày hội Tái chế 2026', description: 'Đổi rác tái chế lấy quà tặng.', points: 150, carbon_saved_kg: 22, image_url: 'https://placehold.co/640x400?text=EduMap', status: 'completed', participants_count: 201, lat: 10.9576, lng: 106.8186, address: 'Thư viện Đồng Nai', created_at: iso(-60) },
            { id: 'green-5', title: 'Đi xe đạp đến trường', description: 'Ghi nhận số ngày đi xe đạp đến trường.', points: 90, carbon_saved_kg: 12, image_url: 'https://placehold.co/640x400?text=EduMap', status: 'active', participants_count: 67, lat: 10.9508, lng: 106.8302, address: 'THPT Chuyên Lương Thế Vinh', created_at: iso(-10) },
            { id: 'green-6', title: 'Chiến dịch Vì Biển Xanh Đà Nẵng', description: 'Làm sạch bãi biển Mỹ Khê.', points: 180, carbon_saved_kg: 20, image_url: 'https://placehold.co/640x400?text=EduMap', status: 'upcoming', participants_count: 40, lat: 16.0611, lng: 108.2441, address: 'Mỹ Khê, Đà Nẵng', created_at: iso(-5) },
        ],

        greenActivities: [],

        surveys: [
            { id: 'survey-1', title: 'Khảo sát nhu cầu học tập của học sinh Biên Hoà', questions_json: [{ id: 'q1', type: 'single_choice', question: 'Bạn đang học lớp mấy?', options: ['THCS', 'THPT', 'Cao đẳng/Đại học'] }, { id: 'q2', type: 'text', question: 'Môn học bạn cần hỗ trợ nhiều nhất?', options: [] }], status: 'active', created_at: iso(-15) },
            { id: 'survey-2', title: 'Đánh giá chất lượng thư viện trường', questions_json: [{ id: 'q1', type: 'rating', question: 'Bạn đánh giá không gian thư viện thế nào?', options: ['1', '2', '3', '4', '5'] }, { id: 'q2', type: 'text', question: 'Góp ý thêm?', options: [] }], status: 'active', created_at: iso(-22) },
            { id: 'survey-3', title: 'Khảo sát kỹ năng số của sinh viên', questions_json: [{ id: 'q1', type: 'multi_choice', question: 'Bạn đã từng học kỹ năng nào?', options: ['Excel', 'SQL', 'Python', 'Thiết kế'] }], status: 'active', created_at: iso(-8) },
        ],

        surveyResponses: [],

        stemLabs: [
            { id: 'lab-1', name: 'Phòng STEM Trường Thực hành Sư phạm DNTU', description: 'Phòng thí nghiệm đa năng cho học sinh phổ thông.', location: 'Trảng Dài, Biên Hoà, Đồng Nai', address: 'Trảng Dài, Biên Hoà, Đồng Nai', contact_email: 'stem@dntu.edu.vn', equipment: ['Kính hiển vi', 'Bộ kit Arduino', 'Máy in 3D'], status: 'active', created_at: iso(-120) },
            { id: 'lab-2', name: 'Lab AI - Đại học Bách khoa Hà Nội', description: 'Phòng nghiên cứu AI có máy trạm GPU.', location: 'Hai Bà Trưng, Hà Nội', address: 'Hai Bà Trưng, Hà Nội', contact_email: 'ailab@hust.edu.vn', equipment: ['GPU RTX 4090', 'Máy chủ', 'Bộ dữ liệu mẫu'], status: 'active', created_at: iso(-200) },
            { id: 'lab-3', name: 'Phòng Thực hành Vật lý HCMUT', description: 'Phòng thí nghiệm vật lý cho sinh viên.', location: 'Thủ Đức, TP.HCM', address: 'Thủ Đức, TP.HCM', contact_email: 'physlab@hcmut.edu.vn', equipment: ['Bộ thí nghiệm quang học', 'Dao động ký'], status: 'active', created_at: iso(-300) },
            { id: 'lab-4', name: 'Không gian Sáng chế Đà Nẵng', description: 'Maker space mở cho học sinh.', location: 'Liên Chiểu, Đà Nẵng', address: 'Liên Chiểu, Đà Nẵng', contact_email: 'maker@danang.gov.vn', equipment: ['Máy in 3D', 'Máy cắt laser', 'Bộ kit robotics'], status: 'active', created_at: iso(-90) },
        ],

        stemBookings: [],

        summerCampaigns: [
            { id: 'summer-1', name: 'Mùa hè xanh Đồng Nai 2026', year: 2026, location: 'Biên Hoà, Đồng Nai', lat: 10.9451, lng: 106.8241, status: 'upcoming', description: 'Tình nguyện dạy học hè và tổ chức hoạt động cho học sinh.', created_at: iso(-30) },
            { id: 'summer-2', name: 'Tiếp sức mùa thi 2026', year: 2026, location: 'TP.HCM', lat: 10.7769, lng: 106.7009, status: 'upcoming', description: 'Hỗ trợ thí sinh trong kỳ thi tốt nghiệp.', created_at: iso(-25) },
            { id: 'summer-3', name: 'Hè sáng tạo Hà Nội 2026', year: 2026, location: 'Hà Nội', lat: 21.0285, lng: 105.8542, status: 'planning', description: 'Lớp học STEM và robotics miễn phí cho trẻ em.', created_at: iso(-20) },
        ],

        summerRegistrations: [],

        volunteerActivities: [
            { id: 'vol-1', title: 'Dạy học hè tại xã Tân Phú', description: 'Dạy Toán và Tiếng Anh cho 30 học sinh.', campaign_name: 'Mùa hè xanh Đồng Nai 2025', hours: 24, date: dateOnly(-120), status: 'approved', created_at: iso(-125) },
            { id: 'vol-2', title: 'Hỗ trợ Ngày hội Sách', description: 'Hướng dẫn và sắp xếp sách.', campaign_name: 'Ngày hội Sách 2025', hours: 8, date: dateOnly(-60), status: 'approved', created_at: iso(-62) },
            { id: 'vol-3', title: 'Nhặt rác Công viên Bửu Long', description: 'Tham gia nhặt rác cùng câu lạc bộ xanh.', campaign_name: 'Bửu Long Xanh', hours: 5, date: dateOnly(-30), status: 'approved', created_at: iso(-31) },
        ],

        donationCampaigns: [
            { id: 'don-1', title: 'Quỹ Ánh Sáng Học Đường', description: 'Trao học bổng và sách vở cho học sinh khó khăn Đồng Nai.', target_amount: 300000000, current_amount: 182000000, end_date: iso(60), status: 'active', created_at: iso(-90), address: 'Biên Hoà, Đồng Nai', location_point: '10.957,106.843' },
            { id: 'don-2', title: 'Máy tính cho em', description: 'Trang bị máy tính cho học sinh thiếu thiết bị học trực tuyến.', target_amount: 500000000, current_amount: 215000000, end_date: iso(90), status: 'active', created_at: iso(-60), address: 'Toàn quốc', location_point: '21.0285,105.8542' },
            { id: 'don-3', title: 'Thư viện cho trường vùng sâu', description: 'Xây dựng thư viện nhỏ cho 5 trường vùng sâu.', target_amount: 150000000, current_amount: 150000000, end_date: iso(-10), status: 'completed', created_at: iso(-180), address: 'Đồng Nai', location_point: '11.2,107.3' },
        ],

        donationDonors: [
            { id: 'donor-1', campaign_id: 'don-1', donor_name: 'Ẩn danh', amount: 5000000, is_anonymous: true, created_at: iso(-10) },
            { id: 'donor-2', campaign_id: 'don-1', donor_name: 'Công ty CP Công nghệ CMC Đồng Nai', amount: 50000000, is_anonymous: false, created_at: iso(-25) },
            { id: 'donor-3', campaign_id: 'don-2', donor_name: 'Nhóm cựu sinh viên DNTU', amount: 30000000, is_anonymous: false, created_at: iso(-15) },
        ],

        sharedItems: [
            { id: 'share-1', name: 'Sách Giải tích 12 (bản cũ)', category: 'books', description: 'Sách còn tốt, tặng cho bạn cần.', status: 'available', owner_id: 'usr-student-1', created_at: iso(-12), owner: { id: 'usr-student-1', full_name: 'Ngô Gia Hân', avatar_url: `${AVATAR}GiaHan` } },
            { id: 'share-2', name: 'Máy tính Casio fx-580VN X', category: 'devices', description: 'Mượn dùng trong kỳ thi, hoạt động tốt.', status: 'available', owner_id: 'usr-student-2', created_at: iso(-9), owner: { id: 'usr-student-2', full_name: 'Bùi Anh Kiệt', avatar_url: `${AVATAR}AnhKiet` } },
            { id: 'share-3', name: 'Bộ đề thi IELTS', category: 'books', description: 'Tài liệu luyện thi IELTS 6.5+.', status: 'available', owner_id: 'usr-student-3', created_at: iso(-7), owner: { id: 'usr-student-3', full_name: 'Trịnh Mai Phương', avatar_url: `${AVATAR}MaiPhuong` } },
            { id: 'share-4', name: 'Tặng áo khoác đồng phục', category: 'clothes', description: 'Áo size M, mới 90%.', status: 'available', owner_id: 'usr-student-4', created_at: iso(-4), owner: { id: 'usr-student-4', full_name: 'Lâm Thanh Tùng', avatar_url: `${AVATAR}ThanhTung` } },
        ],

        shareRequests: [],

        hackathons: [
            { id: 'hack-1', title: 'Hackathon EduMap 2026 - Giáo dục số', description: '48 giờ xây dựng sản phẩm giáo dục số.', start_date: iso(40), end_date: iso(42), status: 'upcoming', created_at: iso(-14), location: 'Biên Hoà, Đồng Nai', prizes: '150 triệu đồng' },
            { id: 'hack-2', title: 'Hackathon Sinh viên CNTT Đồng Nai', description: 'Cuộc thi lập trình dành cho sinh viên.', start_date: iso(70), end_date: iso(71), status: 'upcoming', created_at: iso(-20), location: 'DNTU', prizes: '80 triệu đồng' },
        ],

        hackathonTeams: [],

        notifications: [
            { id: 'notif-1', user_id: 'usr-demo-admin', title: 'Chào mừng đến EduMap', body: 'Bạn đang sử dụng chế độ dữ liệu mô phỏng trên trình duyệt.', channel: 'in_app', is_read: false, sent_at: iso(0), read_at: null },
            { id: 'notif-2', user_id: 'usr-demo-admin', title: 'Có học bổng mới phù hợp', body: 'Học bổng Nữ sinh STEM 2026 vừa được cập nhật.', channel: 'in_app', is_read: false, sent_at: iso(-1), read_at: null },
            { id: 'notif-3', user_id: 'usr-demo-admin', title: 'Lịch cố vấn sắp tới', body: 'Buổi cố vấn với Nguyễn Minh Khoa diễn ra trong 3 ngày nữa.', channel: 'in_app', is_read: true, sent_at: iso(-2), read_at: iso(-1) },
        ],

        bookmarks: [
            { id: 'bm-1', user_id: 'usr-demo-admin', target_type: 'scholarship', target_id: 'sch-1', title: 'Học bổng Toàn phần Chính phủ Nhật Bản (MEXT) 2026', created_at: iso(-3) },
            { id: 'bm-2', user_id: 'usr-demo-admin', target_type: 'poi', target_id: 'poi-1', title: 'Trường Đại học Công nghệ Đồng Nai (DNTU)', created_at: iso(-5) },
        ],

        files: [
            { id: 'file-1', user_id: 'usr-demo-admin', original_name: 'cv-nguyen-van-a.pdf', file_url: 'https://edumap.vn/files/cv-demo.pdf', mime_type: 'application/pdf', size_kb: 320, created_at: iso(-15) },
            { id: 'file-2', user_id: 'usr-demo-admin', original_name: 'bang-diem-hoc-ky-1.pdf', file_url: 'https://edumap.vn/files/transcript-demo.pdf', mime_type: 'application/pdf', size_kb: 210, created_at: iso(-10) },
        ],

        cart: [],

        orders: [],

        businessProfiles: [
            { id: 'biz-1', name: 'Nhà sách Giáo dục Biên Hoà', description: 'Chuyên sách giáo khoa và đồ dùng học tập.', industry: 'Bán lẻ sách', website: 'https://edumap.vn', logo_url: 'https://placehold.co/200x200?text=EduMap', is_verified: true, products: [{ id: 'prod-1', name: 'Bộ sách giáo khoa lớp 12', description: 'Bộ sách đầy đủ các môn.', price: 285000, currency: 'VND', category: 'Sách', stock: 40, image_url: 'https://placehold.co/400x300?text=EduMap', businessProfileId: 'biz-1', reviews: [{ id: 'rev-1', rating: 5, comment: 'Sách mới, giao nhanh.' }], created_at: iso(-60) }, { id: 'prod-2', name: 'Bút bi Thiên Long (hộp 20 cây)', description: 'Bút bi mực xanh.', price: 72000, currency: 'VND', category: 'Đồ dùng', stock: 120, image_url: 'https://placehold.co/400x300?text=EduMap', businessProfileId: 'biz-1', reviews: [], created_at: iso(-50) }], services: [{ id: 'svc-1', name: 'Gói bọc sách miễn phí', description: 'Bọc sách cho khách mua từ 3 cuốn.', price: 0, currency: 'VND', category: 'Dịch vụ', duration: '10 phút', location: 'Biên Hoà', businessProfileId: 'biz-1', reviews: [], created_at: iso(-40) }] },
            { id: 'biz-2', name: 'Trung tâm Ngoại ngữ Đồng Nai', description: 'Đào tạo tiếng Anh, tiếng Nhật, luyện thi IELTS.', industry: 'Giáo dục', website: 'https://edumap.vn', logo_url: 'https://placehold.co/200x200?text=EduMap', is_verified: true, products: [], services: [{ id: 'svc-2', name: 'Khóa IELTS 6.5 (3 tháng)', description: 'Lớp 12 học viên, giáo viên 8.0 IELTS.', price: 4500000, currency: 'VND', category: 'Khóa học', duration: '3 tháng', location: 'Biên Hoà', businessProfileId: 'biz-2', reviews: [{ id: 'rev-2', rating: 4, comment: 'Giáo viên nhiệt tình.' }], created_at: iso(-70) }, { id: 'svc-3', name: 'Luyện thi THPT môn Toán', description: 'Lớp ôn thi cấp tốc.', price: 2500000, currency: 'VND', category: 'Khóa học', duration: '2 tháng', location: 'Biên Hoà', businessProfileId: 'biz-2', reviews: [], created_at: iso(-65) }] },
            { id: 'biz-3', name: 'Công ty CP Công nghệ CMC Đồng Nai', description: 'Cung cấp giải pháp phần mềm giáo dục.', industry: 'Công nghệ', website: 'https://cmc.com.vn', logo_url: 'https://placehold.co/200x200?text=EduMap', is_verified: true, products: [{ id: 'prod-3', name: 'Gói LMS cho trường học (1 năm)', description: 'Hệ thống quản lý học tập trực tuyến.', price: 25000000, currency: 'VND', category: 'Phần mềm', stock: 10, image_url: 'https://placehold.co/400x300?text=EduMap', businessProfileId: 'biz-3', reviews: [], created_at: iso(-30) }], services: [] },
        ],

        intlPrograms: [
            { id: 'intl-1', title: 'Học bổng MEXT Nhật Bản 2026', type: 'scholarship', description: 'Học bổng toàn phần bậc đại học tại Nhật Bản.', host_country: 'Nhật Bản', organization: 'Đại sứ quán Nhật Bản', application_deadline: iso(45), benefits: ['Học phí', 'Sinh hoạt phí', 'Vé máy bay'], apply_url: 'https://www.vn.emb-japan.go.jp/itpr_vi/mext.html', created_at: iso(-45) },
            { id: 'intl-2', title: 'Chương trình Trao đổi Sinh viên Erasmus+', type: 'exchange', description: 'Trao đổi một học kỳ tại châu Âu.', host_country: 'Châu Âu', organization: 'Erasmus+', application_deadline: iso(70), benefits: ['Học phí', 'Hỗ trợ đi lại'], apply_url: 'https://erasmus-plus.ec.europa.eu', created_at: iso(-60) },
            { id: 'intl-3', title: 'Học bổng KOICA Hàn Quốc', type: 'scholarship', description: 'Học bổng thạc sĩ kỹ thuật tại Hàn Quốc.', host_country: 'Hàn Quốc', organization: 'KOICA', application_deadline: iso(90), benefits: ['Học phí', 'Sinh hoạt phí'], apply_url: 'https://www.koica.go.kr', created_at: iso(-55) },
            { id: 'intl-4', title: 'Chương trình Fulbright Việt Nam', type: 'scholarship', description: 'Học bổng thạc sĩ tại Hoa Kỳ.', host_country: 'Hoa Kỳ', organization: 'Fulbright Vietnam', application_deadline: iso(100), benefits: ['Học phí', 'Sinh hoạt phí', 'Bảo hiểm'], apply_url: 'https://fulbright.edu.vn', created_at: iso(-80) },
            { id: 'intl-5', title: 'Trại hè Công nghệ Singapore', type: 'summer_program', description: 'Trại hè 2 tuần về AI và robotics.', host_country: 'Singapore', organization: 'NUS Summer Programme', application_deadline: iso(35), benefits: ['Chứng chỉ', 'Chỗ ở'], apply_url: 'https://nus.edu.sg', created_at: iso(-25) },
        ],

        alumni: [
            { id: 'alum-1', full_name: 'Nguyễn Thị Lan Anh', university: 'Đại học Tokyo', country: 'Nhật Bản', major: 'Khoa học Máy tính', location: { type: 'Point', coordinates: [139.6917, 35.6895] }, contact_email: 'lananh@example.edu', status: 'verified', created_at: iso(-100) },
            { id: 'alum-2', full_name: 'Trần Văn Đức', university: 'KAIST', country: 'Hàn Quốc', major: 'Kỹ thuật Điện', location: { type: 'Point', coordinates: [127.3845, 36.3504] }, contact_email: 'vanduc@example.edu', status: 'verified', created_at: iso(-120) },
            { id: 'alum-3', full_name: 'Phạm Thu Hà', university: 'Đại học Quốc gia Singapore', country: 'Singapore', major: 'Khoa học Dữ liệu', location: { type: 'Point', coordinates: [103.7764, 1.2966] }, contact_email: 'thuha@example.edu', status: 'verified', created_at: iso(-90) },
            { id: 'alum-4', full_name: 'Lê Quang Huy', university: 'Đại học Melbourne', country: 'Úc', major: 'Kinh tế học', location: { type: 'Point', coordinates: [144.9631, -37.8136] }, contact_email: 'quanghuy@example.edu', status: 'pending', created_at: iso(-40) },
        ],

        exchangeResources: [
            { id: 'res-1', type: 'book', title: 'Bộ sách Giải tích 1-2 (HCMUT)', description: 'Sách còn mới, gồm 2 tập.', condition: 4, location: 'Biên Hoà, Đồng Nai', lat: 10.9753, lng: 106.8452, available_from: dateOnly(1), cost: 0, contact_method: 'Email', status: 'available', is_verified: true, tags: ['toán', 'đại học'], created_at: iso(-12), updated_at: iso(-12) },
            { id: 'res-2', type: 'device', title: 'Máy tính Casio fx-580VN X', description: 'Máy hoạt động tốt, pin mới.', condition: 5, location: 'Biên Hoà, Đồng Nai', lat: 10.9508, lng: 106.8302, available_from: dateOnly(0), cost: 0, contact_method: 'Trực tiếp', status: 'available', is_verified: true, tags: ['thi cử'], created_at: iso(-9), updated_at: iso(-9) },
            { id: 'res-3', type: 'volunteer_hours', title: 'Hỗ trợ dạy Toán 2 giờ/tuần', description: 'Sinh viên năm 3 nhận kèm Toán miễn phí.', condition: 5, location: 'TP.HCM', lat: 10.7769, lng: 106.7009, available_from: dateOnly(2), cost: 0, contact_method: 'Zalo', status: 'available', is_verified: false, tags: ['dạy học'], created_at: iso(-7), updated_at: iso(-7) },
            { id: 'res-4', type: 'book', title: 'Giáo trình Lập trình Python', description: 'Sách nhập môn Python.', condition: 3, location: 'Hà Nội', lat: 21.0285, lng: 105.8542, available_from: dateOnly(3), cost: 0, contact_method: 'Email', status: 'available', is_verified: true, tags: ['CNTT'], created_at: iso(-20), updated_at: iso(-20) },
            { id: 'res-5', type: 'device', title: 'Bộ kit Arduino UNO', description: 'Bộ kit thực hành cho học sinh STEM.', condition: 4, location: 'Đà Nẵng', lat: 16.0544, lng: 108.2022, available_from: dateOnly(5), cost: 0, contact_method: 'Email', status: 'available', is_verified: false, tags: ['STEM', 'robotics'], created_at: iso(-15), updated_at: iso(-15) },
        ],

        exchangeRequests: [
            { id: 'req-1', need_type: 'book', title: 'Cần mượn sách Giải tích 1', description: 'Sinh viên năm 1 cần mượn trong 1 học kỳ.', urgency: 'high', location: 'Biên Hoà, Đồng Nai', lat: 10.9753, lng: 106.8452, deadline: dateOnly(10), preferred_min_condition: 3, contact_method: 'Email', status: 'open', tags: ['toán'], created_at: iso(-6), updated_at: iso(-6) },
            { id: 'req-2', need_type: 'device', title: 'Cần mượn máy tính Casio để thi', description: 'Cần mượn trong kỳ thi tốt nghiệp.', urgency: 'critical', location: 'Biên Hoà, Đồng Nai', lat: 10.9508, lng: 106.8302, deadline: dateOnly(4), preferred_min_condition: 4, contact_method: 'Trực tiếp', status: 'open', tags: ['thi cử'], created_at: iso(-3), updated_at: iso(-3) },
            { id: 'req-3', need_type: 'volunteer_hours', title: 'Cần gia sư Toán cho học sinh lớp 9', description: 'Học sinh cần hỗ trợ ôn thi vào 10.', urgency: 'medium', location: 'TP.HCM', lat: 10.7769, lng: 106.7009, deadline: dateOnly(30), preferred_min_condition: 3, contact_method: 'Zalo', status: 'open', tags: ['gia sư'], created_at: iso(-8), updated_at: iso(-8) },
            { id: 'req-4', need_type: 'device', title: 'Cần mượn bộ kit Arduino cho lớp STEM', description: 'Lớp học 20 học sinh cần kit thực hành.', urgency: 'high', location: 'Đà Nẵng', lat: 16.0544, lng: 108.2022, deadline: dateOnly(14), preferred_min_condition: 3, contact_method: 'Email', status: 'open', tags: ['STEM'], created_at: iso(-5), updated_at: iso(-5) },
        ],

        exchangeMatches: [],

        sponsorNeeds: [
            { id: 'need-1', title: 'Trang bị 20 máy tính cho phòng học tin học', description: 'Trường THCS cần máy tính phục vụ dạy tin học.', category: 'equipment', urgency: 'high', cost_estimate: 180000000, location: 'Biên Hoà, Đồng Nai', status: 'open', tags: ['máy tính', 'CNTT'], apply_url: 'https://edumap.vn', provenance: provenance('https://edumap.vn'), created_at: iso(-14) },
            { id: 'need-2', title: 'Học bổng cho 30 học sinh khó khăn', description: 'Hỗ trợ học phí và sách vở năm học 2026-2027.', category: 'scholarship', urgency: 'critical', cost_estimate: 150000000, location: 'Đồng Nai', status: 'open', tags: ['học bổng'], apply_url: 'https://edumap.vn', provenance: provenance('https://edumap.vn'), created_at: iso(-10) },
            { id: 'need-3', title: 'Sửa chữa thư viện trường tiểu học', description: 'Nâng cấp kệ sách và ánh sáng thư viện.', category: 'infrastructure', urgency: 'medium', cost_estimate: 80000000, location: 'Đà Nẵng', status: 'open', tags: ['thư viện'], apply_url: 'https://edumap.vn', provenance: provenance('https://edumap.vn'), created_at: iso(-21) },
            { id: 'need-4', title: 'Tài trợ xe đưa đón học sinh vùng xa', description: 'Hỗ trợ chi phí đi lại cho học sinh khó khăn.', category: 'transport', urgency: 'medium', cost_estimate: 60000000, location: 'Cần Thơ', status: 'open', tags: ['đi lại'], apply_url: 'https://edumap.vn', provenance: provenance('https://edumap.vn'), created_at: iso(-18) },
        ],

        sponsorProfiles: [
            { id: 'sponsor-1', name: 'Quỹ Đổi mới sáng tạo Vingroup (VinIF)', description: 'Hỗ trợ khoa học công nghệ và giáo dục.', focus_areas: ['equipment', 'scholarship'], budget_amount: 2000000000, budget_currency: 'VND', location: 'Hà Nội', website_url: 'https://vinif.org', contact_email: 'contact@vinif.org', status: 'active', is_verified: true, created_at: iso(-200) },
            { id: 'sponsor-2', name: 'Công ty CP Công nghệ CMC Đồng Nai', description: 'Tài trợ thiết bị CNTT cho trường học.', focus_areas: ['equipment'], budget_amount: 500000000, budget_currency: 'VND', location: 'Biên Hoà, Đồng Nai', website_url: 'https://cmc.com.vn', contact_email: 'esg@cmc.com.vn', status: 'active', is_verified: true, created_at: iso(-150) },
            { id: 'sponsor-3', name: 'Hội Khuyến học tỉnh Đồng Nai', description: 'Hỗ trợ học bổng cho học sinh nghèo hiếu học.', focus_areas: ['scholarship'], budget_amount: 300000000, budget_currency: 'VND', location: 'Đồng Nai', website_url: 'https://khuyenhocdongnai.vn', contact_email: 'info@khuyenhocdongnai.vn', status: 'active', is_verified: true, created_at: iso(-180) },
            { id: 'sponsor-4', name: 'Ngân hàng TMCP Đông Á chi nhánh Biên Hoà', description: 'Tài trợ hạ tầng giáo dục địa phương.', focus_areas: ['infrastructure', 'transport'], budget_amount: 400000000, budget_currency: 'VND', location: 'Biên Hoà, Đồng Nai', website_url: 'https://donga.vn', contact_email: 'esg@donga.vn', status: 'active', is_verified: false, created_at: iso(-90) },
        ],

        impactMatches: [],

        knowledgeNodes: [
            { id: 'node-dntu', type: 'university', name: 'Trường Đại học Công nghệ Đồng Nai', description: 'Cơ sở giáo dục đại học tại Biên Hoà.', lat: 10.9753, lng: 106.8452, city: 'Biên Hoà', province: 'Đồng Nai', url: 'https://dntu.edu.vn', metadata: {}, confidence: 0.95 },
            { id: 'node-hcmut', type: 'university', name: 'Trường Đại học Bách khoa TP.HCM', description: 'Đại học kỹ thuật hàng đầu phía Nam.', lat: 10.8701, lng: 106.8032, city: 'TP.HCM', province: 'TP.HCM', url: 'https://hcmut.edu.vn', metadata: {}, confidence: 0.96 },
            { id: 'node-cmc', type: 'organization', name: 'Công ty CP Công nghệ CMC Đồng Nai', description: 'Doanh nghiệp công nghệ tại Biên Hoà.', lat: 10.9753, lng: 106.8452, city: 'Biên Hoà', province: 'Đồng Nai', url: 'https://cmc.com.vn', metadata: {}, confidence: 0.9 },
            { id: 'node-hk-dn', type: 'organization', name: 'Hội Khuyến học tỉnh Đồng Nai', description: 'Tổ chức hỗ trợ học bổng.', lat: 10.957, lng: 106.843, city: 'Biên Hoà', province: 'Đồng Nai', url: 'https://khuyenhocdongnai.vn', metadata: {}, confidence: 0.88 },
            { id: 'node-sch-mext', type: 'scholarship', name: 'Học bổng MEXT 2026', description: 'Học bổng toàn phần Nhật Bản.', lat: null, lng: null, city: null, province: null, url: 'https://www.vn.emb-japan.go.jp/itpr_vi/mext.html', metadata: {}, confidence: 0.92 },
            { id: 'node-thuvien-dn', type: 'library', name: 'Thư viện tỉnh Đồng Nai', description: 'Thư viện công cộng Biên Hoà.', lat: 10.9576, lng: 106.8186, city: 'Biên Hoà', province: 'Đồng Nai', url: 'https://thuviendongnai.vn', metadata: {}, confidence: 0.87 },
            { id: 'node-stem-dntu', type: 'lab', name: 'Phòng STEM DNTU', description: 'Phòng thí nghiệm STEM mở.', lat: 10.9761, lng: 106.8472, city: 'Biên Hoà', province: 'Đồng Nai', url: 'https://dntu.edu.vn', metadata: {}, confidence: 0.85 },
        ],
        knowledgeEdges: [
            { id: 'edge-1', source: 'node-dntu', target: 'node-cmc', type: 'partners_with', weight: 0.9, metadata: {} },
            { id: 'edge-2', source: 'node-cmc', target: 'node-stem-dntu', type: 'sponsors', weight: 0.8, metadata: {} },
            { id: 'edge-3', source: 'node-hcmut', target: 'node-cmc', type: 'partners_with', weight: 0.7, metadata: {} },
            { id: 'edge-4', source: 'node-hk-dn', target: 'node-sch-mext', type: 'supports', weight: 0.6, metadata: {} },
            { id: 'edge-5', source: 'node-dntu', target: 'node-thuvien-dn', type: 'cooperates_with', weight: 0.5, metadata: {} },
            { id: 'edge-6', source: 'node-dntu', target: 'node-stem-dntu', type: 'operates', weight: 0.95, metadata: {} },
        ],
        knowledgeReviews: [
            { id: 'rev-kg-1', entity_text: 'Trường THCS Tân Phú', entity_type: 'school', confidence: 0.42, status: 'pending', created_at: iso(-2), source_text: 'Trường THCS Tân Phú tổ chức ngày hội STEM.' },
        ],

        certificates: [
            { id: 'cert-1', user_id: 'usr-demo-admin', verify_code: 'EDU-2026-0001', issued_at: iso(-40), template: { name: 'Chứng nhận Hoàn thành Khóa học AI cơ bản', type: 'course', organization: { name: 'EduMap Academy' } } },
            { id: 'cert-2', user_id: 'usr-demo-admin', verify_code: 'EDU-2026-0002', issued_at: iso(-20), template: { name: 'Chứng nhận Tình nguyện viên Mùa hè xanh', type: 'volunteer', organization: { name: 'Tỉnh Đoàn Đồng Nai' } } },
        ],

        roles: [
            { id: 1, name: 'admin', description: 'Quản trị viên toàn hệ thống' },
            { id: 2, name: 'moderator', description: 'Kiểm duyệt nội dung' },
            { id: 3, name: 'student', description: 'Học sinh, sinh viên' },
            { id: 4, name: 'mentor', description: 'Cố vấn nghề nghiệp' },
        ],

        auditLogs: [
            { id: 'log-1', user_id: 'usr-demo-admin', action: 'login', resource: 'auth', details: 'Đăng nhập chế độ mô phỏng', created_at: iso(-1), ip_address: '127.0.0.1' },
            { id: 'log-2', user_id: 'usr-demo-admin', action: 'create_scholarship_application', resource: 'scholarships', details: 'Nộp đơn học bổng DNTU', created_at: iso(-6), ip_address: '127.0.0.1' },
        ],

        adminUsers: [
            { id: 'usr-demo-admin', email: 'admin@edumap.vn', full_name: 'Quản trị viên EduMap', status: 'active', role: 'admin', created_at: iso(-200), last_login: iso(0) },
            { id: 'usr-student-1', email: 'giahan@student.edumap.vn', full_name: 'Ngô Gia Hân', status: 'active', role: 'student', created_at: iso(-180), last_login: iso(-2) },
            { id: 'usr-student-2', email: 'anhkiet@student.edumap.vn', full_name: 'Bùi Anh Kiệt', status: 'active', role: 'student', created_at: iso(-170), last_login: iso(-1) },
            { id: 'usr-student-3', email: 'maiphuong@student.edumap.vn', full_name: 'Trịnh Mai Phương', status: 'active', role: 'student', created_at: iso(-160), last_login: iso(-3) },
            { id: 'usr-mentor-1', email: 'khoa.nguyen@mentor.edumap.vn', full_name: 'Nguyễn Minh Khoa', status: 'active', role: 'mentor', created_at: iso(-150), last_login: iso(-4) },
            { id: 'usr-mentor-2', email: 'nhung.tran@mentor.edumap.vn', full_name: 'Trần Thị Hồng Nhung', status: 'active', role: 'mentor', created_at: iso(-140), last_login: iso(-5) },
            { id: 'usr-teacher-1', email: 'hung.pham@teacher.edumap.vn', full_name: 'Phạm Quốc Hưng', status: 'active', role: 'teacher', created_at: iso(-130), last_login: iso(-6) },
            { id: 'usr-employer-1', email: 'hr@cmc.com.vn', full_name: 'Phòng Nhân sự CMC Đồng Nai', status: 'active', role: 'employer', created_at: iso(-120), last_login: iso(-7) },
            { id: 'usr-donor-1', email: 'esg@cmc.com.vn', full_name: 'Quỹ CMC vì Cộng đồng', status: 'active', role: 'donor', created_at: iso(-110), last_login: iso(-8) },
            { id: 'usr-partner-1', email: 'partner@dntu.edu.vn', full_name: 'DNTU Đối ngoại', status: 'pending', role: 'partner', created_at: iso(-20), last_login: null },
        ],

        notificationsReadAt: {},
        aiHistory: [],
        tutorHistory: [],
    };
}

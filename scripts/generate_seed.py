import uuid
import random
from datetime import datetime, timedelta

def gen_id():
    return str(uuid.uuid4())

def escape(s):
    if s is None: return "NULL"
    return "'" + str(s).replace("'", "''") + "'"

def random_date():
    start = datetime(2025, 1, 1)
    end = datetime(2026, 12, 31)
    return start + timedelta(days=random.randint(0, (end - start).days))

# Real Vietnamese names & organizations for seed data
names = [
    "Lê Ngọc Tân", "Nguyễn Hoàng Nam", "Trần Thị Thanh Thảo", "Lê Minh Triết", 
    "Phạm Thanh Hải", "Đặng Minh Khôi", "Nguyễn Thị Lan", "Bùi Huy Hoàng", 
    "Vũ Đăng Khoa", "Đỗ Minh Tuấn", "Trần Thanh Sơn", "Phạm Thị Ngọc Anh", 
    "Nguyễn Văn Dũng", "Lê Thị Mai", "Phan Thanh Bình", "Hoàng Văn Thái", 
    "Trần Hoàng Yến", "Nguyễn Quốc Bảo", "Đặng Văn Lâm", "Nguyễn Thu Trang"
]

companies = [
    "Tổng công ty Sonadezi Đồng Nai", "Tập đoàn Amata Việt Nam", 
    "Công ty Cổ phần Phát triển Đô thị Công nghiệp số 2 (D2D)", 
    "Công ty Cổ phần Sonadezi Long Bình", "Tập đoàn Phong Phú",
    "Ngân hàng Vietcombank chi nhánh Đồng Nai", "Tập đoàn FPT chi nhánh Biên Hòa"
]

subjects = [
    "Toán học", "Vật lý", "Hóa học", "Sinh học", 
    "Tin học", "Lịch sử", "Địa lý", "Tiếng Anh", "Ngữ văn"
]

# Containers for IDs to maintain FK integrity
role_ids = []
perm_ids = []
user_ids = []
cat_ids = []
point_ids = []
material_ids = []
group_ids = []
badge_ids = []
event_ids = []
campaign_ids = []
challenge_ids = []

sql = []

# 1. roles (12 standard roles matching Sheet 4)
role_names = [
    ("Super Admin", "Super Administrator", "Quyền tối cao hệ thống", 10),
    ("Admin", "Administrator", "Quản trị viên hệ thống", 9),
    ("Moderator", "Moderator", "Người kiểm duyệt nội dung", 8),
    ("School", "School Representative", "Đại diện Trường học THPT", 7),
    ("University", "University Representative", "Đại diện Trường Đại học", 7),
    ("Business", "Business Partner", "Doanh nghiệp tuyển dụng/tài trợ", 6),
    ("Sponsor", "Sponsor", "Nhà tài trợ quỹ học tập", 5),
    ("Teacher", "Teacher", "Giáo viên/Giảng viên", 4),
    ("Mentor", "Mentor", "Người hướng dẫn/Tư vấn học tập", 4),
    ("Volunteer", "Volunteer", "Tình nguyện viên xanh", 3),
    ("Student", "Student", "Học sinh/Sinh viên - Người dùng chính", 2),
    ("Guest", "Guest", "Khách vãng lai", 1)
]

for i, (name, display, desc, lvl) in enumerate(role_names):
    rid = i + 1
    role_ids.append(rid)
    sql.append(f"INSERT INTO roles (id, name, display_name, description, level, system_created) VALUES ({rid}, {escape(name)}, {escape(display)}, {escape(desc)}, {lvl}, true);")

# 2. permissions (10)
actions = ["CREATE", "READ", "UPDATE", "DELETE", "MANAGE", "APPROVE", "VIEW", "DOWNLOAD", "UPLOAD", "SHARE"]
for i in range(10):
    pid = i + 1
    perm_ids.append(pid)
    sql.append(f"INSERT INTO permissions (id, name, resource, action, description) VALUES ({pid}, {escape('PERM_' + actions[i])}, {escape('resource_' + str(i))}, {escape(actions[i])}, {escape('Allow ' + actions[i] + ' actions')});")

# 3. users (100 users with real Vietnamese names)
# Make Le Ngoc Tan Super Admin
super_admin_id = gen_id()
user_ids.append(super_admin_id)
sql.append(f"INSERT INTO users (id, email, password_hash, full_name, role_id, status, email_verified) VALUES ({escape(super_admin_id)}, 'admin@edumap.vn', '$2b$10$xyz', 'Lê Ngọc Tân', 1, 'active', true);")

for i in range(99):
    uid = gen_id()
    user_ids.append(uid)
    rid = random.choice(role_ids[1:]) # avoid duplicating super admin
    full_name = random.choice(names)
    if rid == 11: # Student
        email = f"student{i+1}@edumap.vn"
    elif rid == 8: # Teacher
        email = f"teacher{i+1}@edumap.vn"
    elif rid == 9: # Mentor
        email = f"mentor{i+1}@edumap.vn"
    elif rid == 6: # Business
        email = f"biz{i+1}@example.com"
        full_name = random.choice(companies)
    else:
        email = f"user{i+1}@edumap.vn"
    sql.append(f"INSERT INTO users (id, email, password_hash, full_name, role_id, status, email_verified) VALUES ({escape(uid)}, {escape(email)}, '$2b$10$xyz', {escape(full_name)}, {rid}, 'active', true);")

# 4. map_categories
cat_names = [
    ("Trường Đại Học", "fa-university", "#4e73df"),
    ("Trường THPT", "fa-school", "#1cc88a"),
    ("Thư Viện", "fa-book-reader", "#36b9cc"),
    ("Nhà Sách", "fa-book", "#f6c23e"),
    ("STEM Lab", "fa-flask", "#e74a3b"),
    ("Wifi Miễn Phí", "fa-wifi", "#858796"),
    ("Không Gian Xanh", "fa-leaf", "#2e59d9"),
    ("Cà Phê Học Tập", "fa-coffee", "#f8f9fc")
]
for i, (name, icon, color) in enumerate(cat_names):
    cid = i + 1
    cat_ids.append(cid)
    sql.append(f"INSERT INTO map_categories (id, name, icon, color, is_active) VALUES ({cid}, {escape(name)}, {escape(icon)}, {escape(color)}, true);")

# 5. map_points (Real educational coordinates in Dong Nai revolving around Bien Hoa)
dong_nai_points = [
    # Universities
    ("Trường Đại học Công nghệ Đồng Nai (DNTU)", 1, 106.8778, 10.9525, "Nguyễn Khuyến, Trảng Dài, TP. Biên Hòa, Đồng Nai", "Biên Hòa", "Trảng Dài", "Đồng Nai", "Trường Đại học tư thục đào tạo nguồn nhân lực chất lượng cao ngành kỹ thuật, quản lý và chăm sóc sức khỏe hàng đầu tỉnh Đồng Nai với cơ sở vật chất cực kỳ hiện đại."),
    ("Trường Đại học Lạc Hồng (LHU)", 1, 106.8085, 10.9631, "Số 10 Huỳnh Văn Nghệ, Bửu Long, TP. Biên Hòa, Đồng Nai", "Biên Hòa", "Bửu Long", "Đồng Nai", "Đại học ứng dụng công nghệ hàng đầu tại Đồng Nai, nổi tiếng với thành tích Robocon."),
    ("Trường Đại học Đồng Nai (DNU)", 1, 106.8475, 10.9423, "Số 9 Lê Quý Đôn, Tân Hiệp, TP. Biên Hòa, Đồng Nai", "Biên Hòa", "Tân Hiệp", "Đồng Nai", "Đại học công lập đa ngành trực thuộc Ủy ban Nhân dân tỉnh Đồng Nai."),
    ("Phân hiệu Đại học Lâm nghiệp (VNUF Branch)", 1, 106.9691, 10.9582, "Thị trấn Trảng Bom, Huyện Trảng Bom, Đồng Nai", "Trảng Bom", "Thị trấn Trảng Bom", "Đồng Nai", "Phân hiệu đào tạo kỹ sư lâm sinh, môi trường và công nghệ tại khu vực phía Nam."),
    ("Trường Đại học Công nghệ Miền Đông (MUT)", 1, 107.0315, 10.9854, "Quốc lộ 1A, Thống Nhất, Đồng Nai", "Thống Nhất", "Bàu Hàm 2", "Đồng Nai", "Đại học định hướng ứng dụng kỹ thuật và chăm sóc sức khỏe tại Đồng Nai."),
    
    # High Schools
    ("Trường THPT Chuyên Lương Thế Vinh", 2, 106.8624, 10.9482, "Đường Lê Quý Đôn, Tân Hiệp, TP. Biên Hòa, Đồng Nai", "Biên Hòa", "Tân Hiệp", "Đồng Nai", "Trường THPT chuyên chất lượng cao duy nhất của tỉnh Đồng Nai."),
    ("Trường THPT Ngô Quyền", 2, 106.8222, 10.9524, "328 Hưng Đạo Vương, Quyết Thắng, TP. Biên Hòa, Đồng Nai", "Biên Hòa", "Quyết Thắng", "Đồng Nai", "Trường THPT giàu truyền thống lịch sử hơn 100 năm tại trung tâm Biên Hòa."),
    ("Trường THPT Trấn Biên", 2, 106.8448, 10.9581, "Đặng Đức Thuật, Tam Hòa, TP. Biên Hòa, Đồng Nai", "Biên Hòa", "Tam Hòa", "Đồng Nai", "Trường THPT có chất lượng giáo dục toàn diện hàng đầu Biên Hòa."),
    ("Trường THPT Lê Hồng Phong", 2, 106.8184, 10.9588, "Phường Bửu Long, TP. Biên Hòa, Đồng Nai", "Biên Hòa", "Bửu Long", "Đồng Nai", "Trường THPT năng động với nhiều hoạt động phong trào đổi mới sáng tạo."),
    ("Trường THPT Nguyễn Trãi", 2, 106.8351, 10.9501, "Phường Hòa Bình, TP. Biên Hòa, Đồng Nai", "Biên Hòa", "Hòa Bình", "Đồng Nai", "Đơn vị đào tạo uy tín đóng góp nguồn nhân lực trẻ cho tỉnh nhà."),
    ("Trường THPT Long Thành", 2, 106.9535, 10.7818, "Thị trấn Long Thành, Huyện Long Thành, Đồng Nai", "Long Thành", "Thị trấn Long Thành", "Đồng Nai", "Trường THPT trọng điểm của huyện Long Thành, tiếp giáp khu vực dự án sân bay quốc tế."),
    ("Trường THPT Thống Nhất A", 2, 106.9742, 10.9531, "Thị trấn Trảng Bom, Huyện Trảng Bom, Đồng Nai", "Trảng Bom", "Thị trấn Trảng Bom", "Đồng Nai", "Trường THPT đạt chuẩn quốc gia xuất sắc tại khu vực Trảng Bom."),
    
    # Libraries
    ("Thư viện Đại học Công nghệ Đồng Nai (DNTU Library)", 3, 106.8780, 10.9523, "Trung tâm Học liệu DNTU, Trảng Dài, Biên Hòa, Đồng Nai", "Biên Hòa", "Trảng Dài", "Đồng Nai", "Trung tâm thông tin học liệu số hiện đại bậc nhất khu vực, không gian tự học chuẩn quốc tế, kho học liệu cực khủng phục vụ nghiên cứu công nghệ."),
    ("Thư viện Đại học Lạc Hồng", 3, 106.8087, 10.9629, "Cơ sở 1 LHU, Bửu Long, TP. Biên Hòa, Đồng Nai", "Biên Hòa", "Bửu Long", "Đồng Nai", "Thư viện điện tử hiện đại phục vụ nghiên cứu và học tập của giảng viên, sinh viên LHU."),
    ("Thư viện Đại học Đồng Nai", 3, 106.8477, 10.9421, "Tòa nhà Trung tâm DNU, Tân Hiệp, Biên Hòa, Đồng Nai", "Biên Hòa", "Tân Hiệp", "Đồng Nai", "Kho sách chuyên ngành sư phạm, khoa học tự nhiên và xã hội vô cùng đồ sộ."),
    ("Thư viện Tỉnh Đồng Nai", 3, 106.8208, 10.9495, "Số 3 Huỳnh Văn Nghệ, Quyết Thắng, TP. Biên Hòa, Đồng Nai", "Biên Hòa", "Quyết Thắng", "Đồng Nai", "Thư viện công cộng lớn nhất tỉnh, kho học liệu phong phú và không gian đọc mở hiện đại."),

    # Bookstores
    ("Nhà sách Fahasa Biên Hòa", 4, 106.8291, 10.9562, "Tầng 2 Co.opmart Biên Hòa, Quyết Thắng, Biên Hòa", "Biên Hòa", "Quyết Thắng", "Đồng Nai", "Điểm phát hành sách quốc văn, ngoại văn và văn phòng phẩm lớn nhất thành phố."),
    ("Nhà sách Phương Nam - Pegasus", 4, 106.8256, 10.9488, "Tòa nhà Pegasus Plaza, Võ Thị Sáu, Biên Hòa, Đồng Nai", "Biên Hòa", "Quyết Thắng", "Đồng Nai", "Không gian nhà sách cà phê hiện đại, trải nghiệm sách chất lượng cao."),
    ("Nhà sách Fahasa Lotte Biên Hòa", 4, 106.8782, 10.9546, "Khu thương mại Lotte Mart, Amata, Biên Hòa, Đồng Nai", "Biên Hòa", "Long Bình", "Đồng Nai", "Phục vụ người dân và công nhân, học sinh khu vực công nghiệp Amata."),
    ("Nhà sách Nguyễn Văn Cừ Biên Hòa", 4, 106.8351, 10.9501, "Phường Hòa Bình, Biên Hòa, Đồng Nai", "Biên Hòa", "Hòa Bình", "Đồng Nai", "Điểm tìm kiếm và mua sắm giáo trình, tài liệu chuyên khảo uy tín lâu năm."),
    ("Nhà sách Biên Hòa", 4, 106.8208, 10.9495, "Đường Cách Mạng Tháng Tám, Quyết Thắng, Biên Hòa", "Biên Hòa", "Quyết Thắng", "Đồng Nai", "Cửa hàng sách tổng hợp cung cấp đầy đủ các đầu sách tham khảo và ôn luyện."),

    # STEM Labs
    ("Smart STEM & Robotics Lab - DNTU", 5, 106.8776, 10.9527, "Khu công nghệ cao DNTU, Trảng Dài, Biên Hòa, Đồng Nai", "Biên Hòa", "Trảng Dài", "Đồng Nai", "Phòng thí nghiệm STEM thông minh hàng đầu của Đại học Công nghệ Đồng Nai, đầu tư trang thiết bị AI, IoT và robot tiên tiến nhất phục vụ kỹ sư tương lai nghiên cứu."),
    ("LHU Automation STEM Lab", 5, 106.8083, 10.9633, "Huỳnh Văn Nghệ, Bửu Long, Biên Hòa, Đồng Nai", "Biên Hòa", "Bửu Long", "Đồng Nai", "Phòng lab STEM tự động hóa, chế tạo robot đạt tiêu chuẩn quốc gia."),
    ("STEM Space THPT Chuyên Lương Thế Vinh", 5, 106.8624, 10.9482, "Đường Lê Quý Đôn, Tân Hiệp, Biên Hòa, Đồng Nai", "Biên Hòa", "Tân Hiệp", "Đồng Nai", "Nơi tổ chức các hoạt động nghiên cứu khoa học kỹ thuật cho học sinh tài năng."),
    ("STEM & Robotics Center - THPT Ngô Quyền", 5, 106.8222, 10.9524, "328 Hưng Đạo Vương, Quyết Thắng, Biên Hòa", "Biên Hòa", "Quyết Thắng", "Đồng Nai", "Không gian sáng tạo trải nghiệm lắp ráp mạch điện tử và lập trình nhúng cho học sinh phổ thông."),
    ("Biên Hòa AI Lab - Trung tâm Khoa học Trẻ", 5, 106.8256, 10.9488, "Pegasus Plaza, Võ Thị Sáu, Biên Hòa", "Biên Hòa", "Quyết Thắng", "Đồng Nai", "Phòng nghiên cứu mở phục vụ học sinh sinh viên tìm hiểu về trí tuệ nhân tạo."),

    # Wifi Spots
    ("DNTU High-speed Campus Wifi", 6, 106.8778, 10.9525, "Trung tâm công nghệ thông tin DNTU, Trảng Dài, Biên Hòa, Đồng Nai", "Biên Hòa", "Trảng Dài", "Đồng Nai", "Hệ thống Wifi cáp quang siêu tốc phủ sóng 100% khuôn viên Đại học Công nghệ Đồng Nai phục vụ sinh viên tra cứu tài liệu học tập, mật khẩu: 'dntu2026'."),
    ("LHU High-speed Campus Wifi", 6, 106.8085, 10.9631, "Trung tâm thông tin LHU, Bửu Long, Biên Hòa, Đồng Nai", "Biên Hòa", "Bửu Long", "Đồng Nai", "Mạng wifi cáp quang phủ sóng toàn bộ giảng đường Đại học Lạc Hồng, mật khẩu truy cập: 'lhu@2026'."),
    ("DNU High-speed Campus Wifi", 6, 106.8475, 10.9423, "Tòa nhà Trung tâm DNU, Tân Hiệp, Biên Hòa, Đồng Nai", "Biên Hòa", "Tân Hiệp", "Đồng Nai", "Mạng wifi sư phạm trường Đại học Đồng Nai tốc độ ổn định, mật khẩu truy cập: 'dnu@teacher'."),
    ("High-speed Wifi THPT Chuyên Lương Thế Vinh", 6, 106.8624, 10.9482, "Phòng máy THPT Lương Thế Vinh, Tân Hiệp, Biên Hòa, Đồng Nai", "Biên Hòa", "Tân Hiệp", "Đồng Nai", "Mạng wifi học tập dành riêng cho học sinh chuyên Lương Thế Vinh, mật khẩu: 'ltvchuyen'."),
    ("High-speed Wifi THPT Ngô Quyền", 6, 106.8222, 10.9524, "Văn phòng THPT Ngô Quyền, Quyết Thắng, Biên Hòa, Đồng Nai", "Biên Hòa", "Quyết Thắng", "Đồng Nai", "Mạng wifi trường Ngô Quyền giàu truyền thống, mật khẩu: 'ngoquyen100'."),
    ("Free Wifi Công viên Biên Hùng", 6, 106.8228, 10.9542, "Đường Hưng Đạo Vương, Quyết Thắng, Biên Hòa, Đồng Nai", "Biên Hòa", "Quyết Thắng", "Đồng Nai", "Hệ thống phát sóng wifi miễn phí tốc độ cao phục vụ người dân và học sinh sinh viên giải trí."),
    ("Free Wifi Highlands Võ Thị Sáu", 6, 106.8262, 10.9502, "Đường Võ Thị Sáu, Quyết Thắng, Biên Hòa, Đồng Nai", "Biên Hòa", "Quyết Thắng", "Đồng Nai", "Điểm truy cập mạng internet cáp quang phục vụ tự học nhóm."),
    ("Free Wifi Ga Biên Hòa", 6, 106.8152, 10.9535, "Hưng Đạo Vương, Trung Dũng, Biên Hòa", "Biên Hòa", "Trung Dũng", "Đồng Nai", "Hạ tầng phát sóng công cộng hỗ trợ tra cứu lịch trình tàu xe và kết nối internet."),
    ("Free Wifi Bệnh viện Đa khoa Đồng Nai", 6, 106.8488, 10.9398, "Đồng Khởi, Tân Hiệp, Biên Hòa", "Biên Hòa", "Tân Hiệp", "Đồng Nai", "Wifi công cộng phục vụ tra cứu thông tin y khoa và kết nối gia đình."),
    ("Free Wifi Quảng trường Tỉnh Đồng Nai", 6, 106.8524, 10.9492, "Nguyễn Ái Quốc, Tân Phong, Biên Hòa", "Biên Hòa", "Tân Phong", "Đồng Nai", "Điểm truy cập internet mở ngoài trời phục vụ người dân sinh hoạt công cộng."),

    # Green Spaces
    ("Eco Garden Campus DNTU", 7, 106.8774, 10.9524, "Khuôn viên sinh thái DNTU, Trảng Dài, Biên Hòa, Đồng Nai", "Biên Hòa", "Trảng Dài", "Đồng Nai", "Khu vườn sinh thái xanh mát tuyệt đẹp tại Đại học Công nghệ Đồng Nai, đạt chuẩn không gian xanh mát cho sinh viên tự học ngoài trời."),
    ("Không Gian Xanh Đại học Lạc Hồng", 7, 106.8081, 10.9630, "Bờ sông Đồng Nai, Bửu Long, Biên Hòa, Đồng Nai", "Biên Hòa", "Bửu Long", "Đồng Nai", "Khuôn viên xanh ven sông thư thái, giảm thiểu carbon, đạt giải Green Campus."),
    ("Khuôn viên Thảo mộc DNU", 7, 106.8471, 10.9422, "Tân Hiệp, Biên Hòa, Đồng Nai", "Biên Hòa", "Tân Hiệp", "Đồng Nai", "Không gian xanh thực nghiệm học tập môn sinh học ứng dụng của sinh viên Đồng Nai."),
    ("Công viên Quyết Thắng", 7, 106.8222, 10.9524, "Hưng Đạo Vương, Quyết Thắng, Biên Hòa", "Biên Hòa", "Quyết Thắng", "Đồng Nai", "Khuôn viên công viên cây xanh sạch đẹp giữa lòng thành phố Biên Hòa."),
    ("Vườn thực vật ven sông Biên Hòa", 7, 106.8184, 10.9588, "Nguyễn Văn Trị, Hòa Bình, Biên Hòa", "Biên Hòa", "Hòa Bình", "Đồng Nai", "Hành lang xanh ven sông trong lành phục vụ học tập nghiên cứu đa dạng sinh học phổ thông."),

    # Café
    ("DNTU Smart Coffee & Book Space", 8, 106.8782, 10.9526, "Tòa nhà G DNTU, Trảng Dài, Biên Hòa, Đồng Nai", "Biên Hòa", "Trảng Dài", "Đồng Nai", "Quán cà phê sách nội khu thông minh độc quyền của sinh viên Đại học Công nghệ Đồng Nai, thiết kế sáng tạo cực kỳ lý tưởng cho tự học nhóm chạy deadline."),
    ("Bus Coffee - Góc học tập SV LHU", 8, 106.8089, 10.9632, "Huỳnh Văn Nghệ, Bửu Long, Biên Hòa, Đồng Nai", "Biên Hòa", "Bửu Long", "Đồng Nai", "Địa điểm tụ họp ưa thích của hội sinh viên tự chế tạo robot và thảo luận bài tập lớn."),
    ("Cà phê Sách Sư Phạm DNU", 8, 106.8479, 10.9424, "Lê Quý Đôn, Tân Hiệp, Biên Hòa, Đồng Nai", "Biên Hòa", "Tân Hiệp", "Đồng Nai", "Điểm hẹn cà phê yên tĩnh đọc sách và thảo luận bài tập của sinh viên sư phạm trường Đại học Đồng Nai."),
    ("The Coffee House Biên Hòa", 8, 106.8324, 10.9528, "Đường Hà Huy Giáp, Quyết Thắng, Biên Hòa", "Biên Hòa", "Quyết Thắng", "Đồng Nai", "Địa điểm học tập nhóm vô cùng yên tĩnh cùng hệ thống ánh sáng chuẩn."),
    ("The Coffee House Võ Thị Sáu", 8, 106.8262, 10.9502, "Võ Thị Sáu, Quyết Thắng, Biên Hòa", "Biên Hòa", "Quyết Thắng", "Đồng Nai", "Không gian quán cà phê hiện đại có bàn tự học lớn phục vụ chạy deadline.")
]

for name, cat, lon, lat, addr, city, dist, prov, desc in dong_nai_points:
    pid = gen_id()
    point_ids.append(pid)
    uid = random.choice(user_ids)
    sql.append(f"INSERT INTO map_points (id, name, type_id, location, address, city, district, province, description, verified, status, created_by) VALUES ({escape(pid)}, {escape(name)}, {cat}, 'SRID=4326;POINT({lon} {lat})', {escape(addr)}, {escape(city)}, {escape(dist)}, {escape(prov)}, {escape(desc)}, true, 'approved', {escape(uid)});")

# 6. learning_materials (Real educational materials in Dong Nai)
materials_list = [
    ("Tài liệu ôn thi THPT Quốc gia môn Toán - Sở GD&ĐT Đồng Nai", "pdf", "Toán học", "Lớp 12"),
    ("Đề thi thử chuyên Lương Thế Vinh môn Vật Lý 2025 kèm lời giải", "pdf", "Vật lý", "Lớp 12"),
    ("Giáo trình Lập trình Python cơ bản - Khoa Công nghệ Thông tin LHU", "pdf", "Tin học", "Đại học"),
    ("Đề thi tuyển sinh lớp 10 tỉnh Đồng Nai môn Anh văn các năm", "pdf", "Tiếng Anh", "Lớp 9"),
    ("Đề cương ôn tập Sinh học tế bào nâng cao chuyên Lương Thế Vinh", "pdf", "Sinh học", "Lớp 11"),
    ("Cẩm nang hướng nghiệp STEM cho học sinh THPT Biên Hòa", "video", "Tin học", "Lớp 10"),
    ("Bài giảng điện tử Lịch sử hình thành Vùng đất Trấn Biên - Đồng Nai", "video", "Lịch sử", "Lớp 11"),
    ("Chuyên đề phương trình lượng giác ôn thi đại học THPT Trấn Biên", "pdf", "Toán học", "Lớp 12")
]

for title, mtype, subject, grade in materials_list:
    mid = gen_id()
    material_ids.append(mid)
    uid = random.choice(user_ids)
    sql.append(f"INSERT INTO learning_materials (id, title, description, type, subject, grade, status, author_id) VALUES ({escape(mid)}, {escape(title)}, {escape('Tài liệu học tập hữu ích dành cho học sinh Đồng Nai biên soạn bởi các giáo viên uy tín.')}, {escape(mtype)}, {escape(subject)}, {escape(grade)}, 'published', {escape(uid)});")

# 7. groups (Study communities)
groups_list = [
    ("Cộng đồng học sinh THPT Chuyên Lương Thế Vinh Đồng Nai", "study"),
    ("Câu lạc bộ Robocon Đại học Lạc Hồng", "club"),
    ("Học sinh Trấn Biên ôn thi THPT Quốc Gia", "study"),
    ("Diễn đàn STEM & Maker Space Đồng Nai", "project"),
    ("Hội sinh viên Đồng Nai tình nguyện xanh", "club")
]
for name, gtype in groups_list:
    gid = gen_id()
    group_ids.append(gid)
    uid = random.choice(user_ids)
    sql.append(f"INSERT INTO groups (id, name, description, type, owner_id) VALUES ({escape(gid)}, {escape(name)}, {escape('Nơi học tập, thảo luận trao đổi kinh nghiệm cùng giải các bài toán khó.')}, {escape(gtype)}, {escape(uid)});")

# 8. posts (Real posts on forums)
post_titles = [
    "Kinh nghiệm ôn thi môn Vật Lý đạt điểm 9+ THPT Quốc Gia",
    "Gợi ý tài liệu học Python miễn phí của khoa CNTT LHU",
    "Làm sao để đăng ký tham gia CLB Robotics Biên Hòa?",
    "Thông tin về chiến dịch tình nguyện Mùa hè xanh năm nay tại Định Quán",
    "Thử thách gom chai nhựa đổi quà tại Công viên Biên Hùng"
]
for title in post_titles:
    pid = gen_id()
    uid = random.choice(user_ids)
    gid = random.choice(group_ids)
    sql.append(f"INSERT INTO posts (id, author_id, group_id, title, content) VALUES ({escape(pid)}, {escape(uid)}, {escape(gid)}, {escape(title)}, {escape('Bài viết chia sẻ kiến thức cực kỳ bổ ích và chi tiết dành cho các thành viên trong nhóm tham khảo và thảo luận tích cực.')});")

# 9. badges (System awards)
badges_list = [
    ("Đại Sứ Bản Đồ", "Đóng góp 10 địa điểm giáo dục Đồng Nai hữu ích", "achievement"),
    ("Chiến Binh Xanh Biên Hòa", "Hoàn thành 3 thử thách bảo vệ môi trường xanh", "green"),
    ("Mentor Uy Tín", "Hướng dẫn thành công cho hơn 10 mentee THPT", "mentor"),
    ("Chuyên Gia STEM", "Tham gia 5 buổi workshop công nghệ", "stem"),
    ("Thủ Khoa Học Liệu", "Upload 5 tài liệu ôn thi chất lượng được tải nhiều", "achievement")
]
for name, desc, cat in badges_list:
    bid = len(badge_ids) + 1
    badge_ids.append(bid)
    sql.append(f"INSERT INTO badges (id, name, description, category, points_criteria, rarity) VALUES ({bid}, {escape(name)}, {escape(desc)}, {escape(cat)}, 100, 'epic');")

# 10. events (Real educational events in Dong Nai)
events_list = [
    ("Workshop Hướng nghiệp Công nghệ 4.0 - LHU 2025", 106.8085, 10.9631, "Hội trường lớn Đại học Lạc Hồng, Biên Hòa, Đồng Nai", "2025-05-20 08:00:00+07", "2025-05-20 12:00:00+07", "workshop"),
    ("Ngày hội Tuyển sinh & Hướng nghiệp THPT tỉnh Đồng Nai", 106.8475, 10.9423, "Khuôn viên Đại học Đồng Nai, Biên Hòa, Đồng Nai", "2025-06-15 07:30:00+07", "2025-06-15 17:00:00+07", "seminar"),
    ("Camp STEM & Robotics Biên Hòa 2025", 106.8624, 10.9482, "STEM Space Chuyên Lương Thế Vinh, Biên Hòa", "2025-07-10 08:00:00+07", "2025-07-12 17:00:00+07", "camp"),
    ("Chiến dịch Mùa hè xanh - Dạy học hè tại Định Quán", 107.3501, 11.2304, "Huyện Định Quán, Tỉnh Đồng Nai", "2025-08-01 07:00:00+07", "2025-08-25 17:00:00+07", "camp"),
    ("Hội thảo Chuyển đổi số trong Giáo dục Phổ thông Đồng Nai", 106.8208, 10.9495, "Thư viện Tỉnh Đồng Nai, Biên Hòa", "2025-09-05 09:00:00+07", "2025-09-05 16:30:00+07", "seminar")
]

for title, lon, lat, addr, start, end, etype in events_list:
    eid = gen_id()
    event_ids.append(eid)
    uid = random.choice(user_ids)
    sql.append(f"INSERT INTO events (id, title, description, location_point, address, start_date, end_date, type, organizer_id, status) VALUES ({escape(eid)}, {escape(title)}, {escape('Sự kiện quy mô lớn quy tụ nhiều học sinh, sinh viên và chuyên gia tham dự để giao lưu chia sẻ kiến thức bổ ích.')}, 'SRID=4326;POINT({lon} {lat})', {escape(addr)}, {escape(start)}, {escape(end)}, {escape(etype)}, {escape(uid)}, 'upcoming');")

# 11. donation_campaigns (Real charity in Dong Nai)
campaigns_list = [
    "Quyên góp Sách giáo khoa & Tập vở cũ cho học sinh Định Quán, Đồng Nai",
    "Quyên góp Laptop cũ chắp cánh ước mơ tin học vùng sâu Tân Phú",
    "Quỹ học bổng Trấn Biên nâng bước thủ khoa nghèo hiếu học",
    "Quyên góp Thiết bị Thí nghiệm STEM cho trường học vùng xa Xuân Lộc"
]
for title in campaigns_list:
    cid = gen_id()
    campaign_ids.append(cid)
    uid = random.choice(user_ids)
    sql.append(f"INSERT INTO donation_campaigns (id, title, description, organizer_id) VALUES ({escape(cid)}, {escape(title)}, {escape('Chiến dịch ý nghĩa nhằm kêu gọi cộng đồng hỗ trợ trang thiết bị học tập cho các học sinh vượt khó học tốt.')}, {escape(uid)});")

# 12. donations
for i in range(50):
    uid = random.choice(user_ids)
    cid = random.choice(campaign_ids)
    sql.append(f"INSERT INTO donations (id, donor_id, campaign_id, amount) VALUES ({escape(gen_id())}, {escape(uid)}, {escape(cid)}, {random.randint(10, 1000)}000);")

# 13. ai_conversations
for i in range(20):
    cid = gen_id()
    uid = random.choice(user_ids)
    sql.append(f"INSERT INTO ai_conversations (id, user_id, title) VALUES ({escape(cid)}, {escape(uid)}, {escape('Hỏi đáp về Lộ trình học AI & Blockchain LHU')});")

# 14. career_paths
careers_list = [
    ("Kỹ sư Phần mềm (Software Engineer)", "Lộ trình kỹ năng lập trình web, di động và phân tích thuật toán ứng dụng."),
    ("Chuyên gia Tự động hóa & Robotics", "Định hướng lập trình vi điều khiển, thiết kế robot công nghiệp Biên Hòa 2."),
    ("Kỹ sư Phân tích Dữ liệu (Data Analyst)", "Lộ trình kỹ năng SQL, Python, Excel và trực quan hóa số liệu thống kê."),
    ("Giáo viên STEM & Khoa học máy tính", "Đào tạo kỹ năng giảng dạy khoa học tích hợp cho học sinh phổ thông.")
]
for i, (title, desc) in enumerate(careers_list):
    sql.append(f"INSERT INTO career_paths (id, title, description) VALUES ({i+1}, {escape(title)}, {escape(desc)});")

# 15. green_challenges
challenges_list = [
    "Thử thách gom chai nhựa tái chế - Nhận quà xanh Lạc Hồng",
    "Ngày hội trồng cây bảo vệ hành lang xanh sông Đồng Nai",
    "Thử thách 7 ngày đi bộ/xe đạp đến trường - THPT Trấn Biên"
]
for title in challenges_list:
    cid = gen_id()
    uid = random.choice(user_ids)
    sql.append(f"INSERT INTO green_challenges (id, title, description, created_by) VALUES ({escape(cid)}, {escape(title)}, {escape('Thử thách nhằm xây dựng thói quen thân thiện với môi trường xanh trong giới học đường Biên Hòa.')}, {escape(uid)});")

# Save to file
with open('backend/src/database/seed.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(sql))

print("Successfully generated highly realistic Dong Nai seed.sql!")

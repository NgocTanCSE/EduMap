# TÀI LIỆU ĐẶC TẢ SƠ ĐỒ LỚP NGHIỆP VỤ (CLASS DIAGRAM SPECIFICATION)
## HỆ SINH THÁI GIÁO DỤC THÔNG MINH EDUMAP

> **Tài liệu tham chiếu:** [`docs/class/Class_Diagram.puml`](file:///home/ngoctan/Downloads/EduMap/docs/class/Class_Diagram.puml)  
> **Sơ đồ đồ họa gốc:** [`docs/class/Class_Diagram.png`](file:///home/ngoctan/Downloads/EduMap/docs/class/Class_Diagram.png)  
> **Cấu trúc bảng chuẩn UML:** Mô phỏng chính xác cấu trúc hộp lớp UML 3 ngăn:
> 1. **Ngăn trên:** Tên Lớp & Loại lớp (Chỉ hiển thị Tên Lớp thuần túy)
> 2. **Ngăn giữa:** Thuộc tính (`Tên: Kiểu dữ liệu`)
> 3. **Ngăn dưới:** Phương thức nghiệp vụ (`Tên(tham số): Kiểu trả về`)
>
> **Ký hiệu phạm vi truy cập (Visibility):**
> - `-` : Private
> - `#` : Protected
> - `+` : Public

---

## MỤC LỤC
- [1. Phân hệ Quản trị Người dùng & Phân quyền (Identity & Access)](#1-phân-hệ-quản-trị-người-dùng--phân-quyền-identity--access)
- [2. Phân hệ Bản đồ & Không gian Thông minh (Geospatial & Smart Campus)](#2-phân-hệ-bản-đồ--không-gian-thông-minh-geospatial--smart-campus)
- [3. Phân hệ Cố vấn & Buổi tư vấn Trực tuyến (Mentorship & Consultation)](#3-phân-hệ-cố-vấn--buổi-tư-vấn-trực-tuyến-mentorship--consultation)
- [4. Phân hệ Thương mại & Đơn hàng (Commerce & Order)](#4-phân-hệ-thương-mại--đơn-hàng-commerce--order)
- [5. Phân hệ Học bổng, Nghề nghiệp & Cộng đồng (Scholarship, Career & Social)](#5-phân-hệ-học-bổng-nghề-nghiệp--cộng-đồng-scholarship-career--social)
- [6. Bảng Ma trận Mối quan hệ giữa các Lớp (Class Relationships Matrix)](#6-bảng-ma-trận-mối-quan-hệ-giữa-các-lớp-class-relationships-matrix)

---

## 1. PHÂN HỆ QUẢN TRỊ NGƯỜI DÙNG & PHÂN QUYỀN (IDENTITY & ACCESS)

### 1.1. Lớp Trừu tượng `User` (Lớp Cơ sở)
| **User** |
| :--- |
| `# id: UUID`<br>`# email: String`<br>`# passwordHash: String`<br>`# fullName: String`<br>`# phoneNumber: String`<br>`# avatarUrl: String`<br>`# isActive: Boolean`<br>`# createdAt: DateTime` |
| `+ authenticate(password: String): Boolean`<br>`+ updateProfile(fullName: String, phone: String): Void`<br>`+ changePassword(oldPass: String, newPass: String): Boolean`<br>`+ resetPassword(token: String, newPass: String): Boolean` |

---

### 1.2. Lớp `Student` (Học sinh / Sinh viên - Kế thừa User)
| **Student** |
| :--- |
| `- studentCode: String`<br>`- schoolName: String`<br>`- gpa: Float`<br>`- mbtiType: String`<br>`- skills: String[]` |
| `+ searchNearbyLocations(radiusKm: Double): List<MapPoint>`<br>`+ applyScholarship(scholarshipId: UUID): ScholarshipApplication`<br>`+ bookMentor(mentorId: UUID, slot: DateTime): Booking`<br>`+ addToCart(productId: UUID, quantity: Int): CartItem`<br>`+ enrollCareerPath(careerId: UUID): Void` |

---

### 1.3. Lớp `Mentor` (Chuyên gia Cố vấn - Kế thừa User)
| **Mentor** |
| :--- |
| `- bio: String`<br>`- specialties: String[]`<br>`- experienceYears: Int`<br>`- hourlyRate: Decimal`<br>`- ratingAvg: Float`<br>`- isVerified: Boolean` |
| `+ configureAvailability(dayOfWeek: Int, start: Time, end: Time): MentorAvailability`<br>`+ acceptBooking(bookingId: UUID): Boolean`<br>`+ rejectBooking(bookingId: UUID, reason: String): Boolean`<br>`+ startSession(bookingId: UUID): MentorSession`<br>`+ recalculateRating(): Float` |

---

### 1.4. Lớp `BusinessPartner` (Đối tác Doanh nghiệp - Kế thừa User)
| **BusinessPartner** |
| :--- |
| `- companyName: String`<br>`- taxCode: String`<br>`- businessAddress: String`<br>`- walletBalance: Decimal` |
| `+ publishProduct(name: String, price: Decimal, stock: Int): Product`<br>`+ publishService(name: String, price: Decimal): Service`<br>`+ updateStock(productId: UUID, newStock: Int): Void`<br>`+ confirmFulfillment(orderId: UUID): Boolean`<br>`+ withdrawFunds(amount: Decimal): Boolean` |

---

### 1.5. Lớp `Admin` (Quản trị viên Hệ thống - Kế thừa User)
| **Admin** |
| :--- |
| `- staffCode: String`<br>`- department: String` |
| `+ verifyMentor(mentorId: UUID): Boolean`<br>`+ lockUser(userId: UUID, reason: String): Void`<br>`+ moderatePost(postId: UUID, isApproved: Boolean): Void`<br>`+ generateSystemReport(): Report` |

---

### 1.6. Lớp `Role` & Lớp `Notification`
| **Role** |
| :--- |
| `- id: UUID`<br>`- roleName: String`<br>`- permissions: String[]` |
| `+ hasPermission(permission: String): Boolean` |

| **Notification** |
| :--- |
| `- id: UUID`<br>`- recipientId: UUID`<br>`- title: String`<br>`- content: String`<br>`- isRead: Boolean`<br>`- channel: String` |
| `+ markAsRead(): Void`<br>`+ sendPush(): Boolean` |

---

## 2. PHÂN HỆ BẢN ĐỒ & KHÔNG GIAN THÔNG MINH (GEOSPATIAL & SMART CAMPUS)

### 2.1. Lớp `Location` (Tọa độ Địa lý)
| **Location** |
| :--- |
| `- id: UUID`<br>`- latitude: Double`<br>`- longitude: Double`<br>`- address: String`<br>`- district: String` |
| `+ getCoordinates(): Point`<br>`+ calculateDistance(toLat: Double, toLng: Double): Double`<br>`+ isWithinRadius(centerLat: Double, centerLng: Double, radiusKm: Double): Boolean` |

---

### 2.2. Lớp `MapPoint` (Điểm Ghim Bản đồ)
| **MapPoint** |
| :--- |
| `- id: UUID`<br>`- name: String`<br>`- category: String`<br>`- description: String`<br>`- verified: Boolean` |
| `+ getDetails(): String`<br>`+ updateInformation(info: String): Void` |

---

### 2.3. Lớp `School` (Trường học - Kế thừa MapPoint)
| **School** |
| :--- |
| `- schoolType: String`<br>`- websiteUrl: String`<br>`- admissionQuota: Int`<br>`- totalFaculties: Int` |
| `+ getAdmissionCriteria(): String`<br>`+ getContactInfo(): String` |

---

### 2.4. Lớp `WifiHotspot` (Điểm Wifi Miễn phí - Kế thừa MapPoint)
| **WifiHotspot** |
| :--- |
| `- ssid: String`<br>`- isFree: Boolean`<br>`- bandwidthMbps: Float`<br>`- venueType: String` |
| `+ checkActiveStatus(): Boolean` |

---

### 2.5. Lớp `MobileUnit` (Đơn vị Lưu động GPS)
| **MobileUnit** |
| :--- |
| `- vehiclePlate: String`<br>`- unitType: String`<br>`- currentStatus: String`<br>`- batteryPercentage: Int` |
| `+ updateLocation(lat: Double, lng: Double): Void`<br>`+ broadcastPosition(): Void`<br>`+ getNextStopSchedule(): Schedule` |

---

## 3. PHÂN HỆ CỐ VẤN & BUỔI TƯ VẤN TRỰC TUYẾN (MENTORSHIP & CONSULTATION)

### 3.1. Lớp `MentorAvailability` (Lịch Rảnh Cố vấn)
| **MentorAvailability** |
| :--- |
| `- id: UUID`<br>`- dayOfWeek: Int`<br>`- startTime: Time`<br>`- endTime: Time`<br>`- isActive: Boolean` |
| `+ isSlotAvailable(date: Date, time: Time): Boolean`<br>`+ toggleStatus(): Void` |

---

### 3.2. Lớp `Booking` (Phiên Đặt lịch Tư vấn)
| **Booking** |
| :--- |
| `- id: UUID`<br>`- slotStart: DateTime`<br>`- slotEnd: DateTime`<br>`- amount: Decimal`<br>`- status: String`<br>`- paymentStatus: String`<br>`- meetingUrl: String` |
| `+ confirmBooking(): Void`<br>`+ cancelBooking(reason: String): Void`<br>`+ markPaid(): Void`<br>`+ generateMeetingRoom(): String` |

---

### 3.3. Lớp `MentorSession` (Buổi Họp Tư vấn Trực tuyến)
| **MentorSession** |
| :--- |
| `- id: UUID`<br>`- actualStartTime: DateTime`<br>`- actualEndTime: DateTime`<br>`- durationMinutes: Int`<br>`- notes: String` |
| `+ startCall(): Void`<br>`+ endCall(): Void`<br>`+ saveNotes(summary: String): Void` |

---

### 3.4. Lớp `Review` (Đánh giá Buổi Tư vấn)
| **Review** |
| :--- |
| `- id: UUID`<br>`- rating: Int`<br>`- comment: String`<br>`- createdAt: DateTime` |
| `+ validateScore(): Boolean`<br>`+ editComment(text: String): Void` |

---

## 4. PHÂN HỆ THƯƠNG MẠI & ĐƠN HÀNG (COMMERCE & ORDER)

### 4.1. Lớp `Order` (Đơn hàng Mua sắm)
| **Order** |
| :--- |
| `- id: UUID`<br>`- totalAmount: Decimal`<br>`- currency: String`<br>`- status: String`<br>`- shippingAddress: String`<br>`- createdAt: DateTime` |
| `+ calculateTotal(): Decimal`<br>`+ markPaid(): Void`<br>`+ markShipping(): Void`<br>`+ completeOrder(): Void`<br>`+ cancelOrder(): Void` |

---

### 4.2. Lớp `OrderItem` (Chi tiết Mặt hàng Đơn hàng)
| **OrderItem** |
| :--- |
| `- id: UUID`<br>`- quantity: Int`<br>`- priceAtPurchase: Decimal` |
| `+ getItemTotal(): Decimal` |

---

### 4.3. Lớp `Product` (Sản phẩm Vật lý)
| **Product** |
| :--- |
| `- id: UUID`<br>`- name: String`<br>`- description: String`<br>`- price: Decimal`<br>`- stock: Int`<br>`- category: String` |
| `+ hasSufficientStock(quantity: Int): Boolean`<br>`+ reduceStock(quantity: Int): Void`<br>`+ replenishStock(quantity: Int): Void` |

---

### 4.4. Lớp `Service` (Khóa học & Dịch vụ Số)
| **Service** |
| :--- |
| `- id: UUID`<br>`- name: String`<br>`- description: String`<br>`- price: Decimal`<br>`- durationMonths: Int` |
| `+ grantAccess(studentId: UUID): Void` |

---

### 4.5. Lớp `CartItem` (Mục Giỏ hàng)
| **CartItem** |
| :--- |
| `- id: UUID`<br>`- quantity: Int` |
| `+ calculateSubtotal(): Decimal`<br>`+ updateQuantity(newQty: Int): Void` |

---

### 4.6. Lớp `Transaction` (Giao dịch Thanh toán Điện tử)
| **Transaction** |
| :--- |
| `- id: UUID`<br>`- amount: Decimal`<br>`- paymentMethod: String`<br>`- status: String`<br>`- externalTxnId: String` |
| `+ verifySignature(checksum: String): Boolean`<br>`+ markSuccess(): Void`<br>`+ markFailed(): Void` |

---

## 5. PHÂN HỆ HỌC BỔNG, NGHỀ NGHIỆP & CỘNG ĐỒNG (SCHOLARSHIP, CAREER & SOCIAL)

### 5.1. Lớp `Scholarship` (Chương trình Học bổng)
| **Scholarship** |
| :--- |
| `- id: UUID`<br>`- title: String`<br>`- provider: String`<br>`- minGpa: Float`<br>`- scholarshipAmount: Decimal`<br>`- deadline: Date` |
| `+ checkEligibility(gpa: Float, district: String): Boolean`<br>`+ isExpired(): Boolean` |

---

### 5.2. Lớp `ScholarshipApplication` (Đơn Ứng tuyển Học bổng)
| **ScholarshipApplication** |
| :--- |
| `- id: UUID`<br>`- submissionDate: Date`<br>`- status: String`<br>`- transcriptUrl: String` |
| `+ submitApplication(): Void`<br>`+ updateStatus(newStatus: String): Void` |

---

### 5.3. Lớp `CareerPath` (Lộ trình Hướng nghiệp)
| **CareerPath** |
| :--- |
| `- id: UUID`<br>`- title: String`<br>`- industrySector: String`<br>`- requiredSkills: String[]`<br>`- targetGpa: Float` |
| `+ calculateMatchScore(studentSkills: String[], gpa: Float): Float` |

---

### 5.4. Lớp `Group` (Nhóm / CLB Sinh viên)
| **Group** |
| :--- |
| `- id: UUID`<br>`- name: String`<br>`- description: String`<br>`- privacy: String` |
| `+ addMember(user: User): Void`<br>`+ removeMember(user: User): Void` |

---

### 5.5. Lớp `Post` (Bài đăng Cộng đồng)
| **Post** |
| :--- |
| `- id: UUID`<br>`- title: String`<br>`- content: String`<br>`- status: String`<br>`- likeCount: Int` |
| `+ publish(): Void`<br>`+ flagForReview(): Void`<br>`+ incrementLikes(): Void` |

---

### 5.6. Lớp `Comment` (Bình luận Phản hồi)
| **Comment** |
| :--- |
| `- id: UUID`<br>`- content: String`<br>`- createdAt: DateTime` |
| `+ updateContent(newContent: String): Void` |

---

## 6. BẢNG TỔNG HỢP THEO PHÂN HỆ (DẠNG 3 CỘT)

Dành cho trình bày báo cáo tổng quan dạng bảng ngang (Class Name | Attributes | Methods):

| Tên Lớp (Class) | Thuộc tính (Attributes) | Phương thức (Methods / Operations) |
| :--- | :--- | :--- |
| **User** | `# id: UUID`<br>`# email: String`<br>`# passwordHash: String`<br>`# fullName: String`<br>`# phoneNumber: String`<br>`# avatarUrl: String`<br>`# isActive: Boolean`<br>`# createdAt: DateTime` | `+ authenticate(password: String): Boolean`<br>`+ updateProfile(fullName: String, phone: String): Void`<br>`+ changePassword(oldPass: String, newPass: String): Boolean`<br>`+ resetPassword(token: String, newPass: String): Boolean` |
| **Student** | `- studentCode: String`<br>`- schoolName: String`<br>`- gpa: Float`<br>`- mbtiType: String`<br>`- skills: String[]` | `+ searchNearbyLocations(radiusKm: Double): List<MapPoint>`<br>`+ applyScholarship(scholarshipId: UUID): ScholarshipApplication`<br>`+ bookMentor(mentorId: UUID, slot: DateTime): Booking`<br>`+ addToCart(productId: UUID, quantity: Int): CartItem`<br>`+ enrollCareerPath(careerId: UUID): Void` |
| **Mentor** | `- bio: String`<br>`- specialties: String[]`<br>`- experienceYears: Int`<br>`- hourlyRate: Decimal`<br>`- ratingAvg: Float`<br>`- isVerified: Boolean` | `+ configureAvailability(dayOfWeek: Int, start: Time, end: Time): MentorAvailability`<br>`+ acceptBooking(bookingId: UUID): Boolean`<br>`+ rejectBooking(bookingId: UUID, reason: String): Boolean`<br>`+ startSession(bookingId: UUID): MentorSession`<br>`+ recalculateRating(): Float` |
| **BusinessPartner** | `- companyName: String`<br>`- taxCode: String`<br>`- businessAddress: String`<br>`- walletBalance: Decimal` | `+ publishProduct(name: String, price: Decimal, stock: Int): Product`<br>`+ publishService(name: String, price: Decimal): Service`<br>`+ updateStock(productId: UUID, newStock: Int): Void`<br>`+ confirmFulfillment(orderId: UUID): Boolean`<br>`+ withdrawFunds(amount: Decimal): Boolean` |
| **Admin** | `- staffCode: String`<br>`- department: String` | `+ verifyMentor(mentorId: UUID): Boolean`<br>`+ lockUser(userId: UUID, reason: String): Void`<br>`+ moderatePost(postId: UUID, isApproved: Boolean): Void`<br>`+ generateSystemReport(): Report` |
| **Role** | `- id: UUID`<br>`- roleName: String`<br>`- permissions: String[]` | `+ hasPermission(permission: String): Boolean` |
| **Notification** | `- id: UUID`<br>`- recipientId: UUID`<br>`- title: String`<br>`- content: String`<br>`- isRead: Boolean`<br>`- channel: String` | `+ markAsRead(): Void`<br>`+ sendPush(): Boolean` |
| **Location** | `- id: UUID`<br>`- latitude: Double`<br>`- longitude: Double`<br>`- address: String`<br>`- district: String` | `+ getCoordinates(): Point`<br>`+ calculateDistance(toLat: Double, toLng: Double): Double`<br>`+ isWithinRadius(centerLat: Double, centerLng: Double, radiusKm: Double): Boolean` |
| **MapPoint** | `- id: UUID`<br>`- name: String`<br>`- category: String`<br>`- description: String`<br>`- verified: Boolean` | `+ getDetails(): String`<br>`+ updateInformation(info: String): Void` |
| **School** | `- schoolType: String`<br>`- websiteUrl: String`<br>`- admissionQuota: Int`<br>`- totalFaculties: Int` | `+ getAdmissionCriteria(): String`<br>`+ getContactInfo(): String` |
| **WifiHotspot** | `- ssid: String`<br>`- isFree: Boolean`<br>`- bandwidthMbps: Float`<br>`- venueType: String` | `+ checkActiveStatus(): Boolean` |
| **MobileUnit** | `- vehiclePlate: String`<br>`- unitType: String`<br>`- currentStatus: String`<br>`- batteryPercentage: Int` | `+ updateLocation(lat: Double, lng: Double): Void`<br>`+ broadcastPosition(): Void`<br>`+ getNextStopSchedule(): Schedule` |
| **MentorAvailability** | `- id: UUID`<br>`- dayOfWeek: Int`<br>`- startTime: Time`<br>`- endTime: Time`<br>`- isActive: Boolean` | `+ isSlotAvailable(date: Date, time: Time): Boolean`<br>`+ toggleStatus(): Void` |
| **Booking** | `- id: UUID`<br>`- slotStart: DateTime`<br>`- slotEnd: DateTime`<br>`- amount: Decimal`<br>`- status: String`<br>`- paymentStatus: String`<br>`- meetingUrl: String` | `+ confirmBooking(): Void`<br>`+ cancelBooking(reason: String): Void`<br>`+ markPaid(): Void`<br>`+ generateMeetingRoom(): String` |
| **MentorSession** | `- id: UUID`<br>`- actualStartTime: DateTime`<br>`- actualEndTime: DateTime`<br>`- durationMinutes: Int`<br>`- notes: String` | `+ startCall(): Void`<br>`+ endCall(): Void`<br>`+ saveNotes(summary: String): Void` |
| **Review** | `- id: UUID`<br>`- rating: Int`<br>`- comment: String`<br>`- createdAt: DateTime` | `+ validateScore(): Boolean`<br>`+ editComment(text: String): Void` |
| **Product** | `- id: UUID`<br>`- name: String`<br>`- description: String`<br>`- price: Decimal`<br>`- stock: Int`<br>`- category: String` | `+ hasSufficientStock(quantity: Int): Boolean`<br>`+ reduceStock(quantity: Int): Void`<br>`+ replenishStock(quantity: Int): Void` |
| **Service** | `- id: UUID`<br>`- name: String`<br>`- description: String`<br>`- price: Decimal`<br>`- durationMonths: Int` | `+ grantAccess(studentId: UUID): Void` |
| **CartItem** | `- id: UUID`<br>`- quantity: Int` | `+ calculateSubtotal(): Decimal`<br>`+ updateQuantity(newQty: Int): Void` |
| **Order** | `- id: UUID`<br>`- totalAmount: Decimal`<br>`- currency: String`<br>`- status: String`<br>`- shippingAddress: String`<br>`- createdAt: DateTime` | `+ calculateTotal(): Decimal`<br>`+ markPaid(): Void`<br>`+ markShipping(): Void`<br>`+ completeOrder(): Void`<br>`+ cancelOrder(): Void` |
| **OrderItem** | `- id: UUID`<br>`- quantity: Int`<br>`- priceAtPurchase: Decimal` | `+ getItemTotal(): Decimal` |
| **Transaction** | `- id: UUID`<br>`- amount: Decimal`<br>`- paymentMethod: String`<br>`- status: String`<br>`- externalTxnId: String` | `+ verifySignature(checksum: String): Boolean`<br>`+ markSuccess(): Void`<br>`+ markFailed(): Void` |
| **Scholarship** | `- id: UUID`<br>`- title: String`<br>`- provider: String`<br>`- minGpa: Float`<br>`- scholarshipAmount: Decimal`<br>`- deadline: Date` | `+ checkEligibility(gpa: Float, district: String): Boolean`<br>`+ isExpired(): Boolean` |
| **ScholarshipApplication** | `- id: UUID`<br>`- submissionDate: Date`<br>`- status: String`<br>`- transcriptUrl: String` | `+ submitApplication(): Void`<br>`+ updateStatus(newStatus: String): Void` |
| **CareerPath** | `- id: UUID`<br>`- title: String`<br>`- industrySector: String`<br>`- requiredSkills: String[]`<br>`- targetGpa: Float` | `+ calculateMatchScore(studentSkills: String[], gpa: Float): Float` |
| **Group** | `- id: UUID`<br>`- name: String`<br>`- description: String`<br>`- privacy: String` | `+ addMember(user: User): Void`<br>`+ removeMember(user: User): Void` |
| **Post** | `- id: UUID`<br>`- title: String`<br>`- content: String`<br>`- status: String`<br>`- likeCount: Int` | `+ publish(): Void`<br>`+ flagForReview(): Void`<br>`+ incrementLikes(): Void` |
| **Comment** | `- id: UUID`<br>`- content: String`<br>`- createdAt: DateTime` | `+ updateContent(newContent: String): Void` |

---

## 7. BẢNG MA TRẬN MỐI QUAN HỆ GIỮA CÁC LỚP (CLASS RELATIONSHIPS MATRIX)

| STT | Lớp Nguồn (Source) | Loại Quan hệ | Ký hiệu UML | Lớp Đích (Target) | Bản số (Multiplicity) | Diễn giải Nghiệp vụ |
| :---: | :--- | :--- | :---: | :--- | :---: | :--- |
| 1 | `Student` | Kế thừa (Generalization) | `<\|--` | `User` | N/A | Sinh viên là một loại người dùng cụ thể |
| 2 | `Mentor` | Kế thừa (Generalization) | `<\|--` | `User` | N/A | Cố vấn là người dùng chuyên gia |
| 3 | `BusinessPartner` | Kế thừa (Generalization) | `<\|--` | `User` | N/A | Đối tác doanh nghiệp là người dùng tổ chức |
| 4 | `Admin` | Kế thừa (Generalization) | `<\|--` | `User` | N/A | Quản trị viên hệ thống |
| 5 | `User` | Thu nạp (Aggregation) | `o--` | `Role` | `1` đến `1..*` | Mỗi người dùng được gán 1 hoặc nhiều vai trò |
| 6 | `User` | Kết hợp (Association) | `-->` | `Notification` | `1` đến `0..*` | Người dùng nhận nhiều thông báo |
| 7 | `School` | Kế thừa (Generalization) | `<\|--` | `MapPoint` | N/A | Trường học là một điểm địa lý trên bản đồ |
| 8 | `WifiHotspot` | Kế thừa (Generalization) | `<\|--` | `MapPoint` | N/A | Trạm Wifi là một điểm tiện ích trên bản đồ |
| 9 | `MapPoint` | Hợp thành (Composition) | `*--` | `Location` | `1` đến `1` | Mỗi điểm bản đồ gắn chặt với 1 tọa độ vị trí |
| 10 | `MobileUnit` | Kết hợp (Association) | `-->` | `Location` | `1` đến `1` | Xe lưu động liên tục cập nhật tọa độ GPS |
| 11 | `Student` | Kết hợp (Association) | `-->` | `School` | `0..*` đến `0..1` | Sinh viên theo học tại trường học |
| 12 | `BusinessPartner` | Kết hợp (Association) | `-->` | `Location` | `1` đến `0..1` | Trụ sở kinh doanh của doanh nghiệp |
| 13 | `Mentor` | Hợp thành (Composition) | `*--` | `MentorAvailability`| `1` đến `0..*` | Lịch rảnh thuộc sở hữu độc quyền của Mentor |
| 14 | `Student` | Kết hợp (Association) | `-->` | `Booking` | `1` đến `0..*` | Sinh viên đặt các lịch hẹn tư vấn |
| 15 | `Booking` | Kết hợp (Association) | `-->` | `Mentor` | `0..*` đến `1` | Mỗi lịch hẹn chỉ định cho 1 Mentor |
| 16 | `Booking` | Thu nạp (Aggregation) | `o--` | `MentorSession` | `1` đến `0..1` | Lịch hẹn chuyển thành 1 buổi tư vấn thực tế |
| 17 | `Booking` | Kết hợp (Association) | `-->` | `Review` | `1` đến `0..1` | Mỗi buổi tư vấn được đánh giá bởi 1 bài review |
| 18 | `BusinessPartner` | Kết hợp (Association) | `-->` | `Product` | `1` đến `0..*` | Doanh nghiệp sở hữu các sản phẩm đăng bán |
| 19 | `BusinessPartner` | Kết hợp (Association) | `-->` | `Service` | `1` đến `0..*` | Doanh nghiệp cung cấp các gói dịch vụ/khóa học |
| 20 | `Student` | Kết hợp (Association) | `-->` | `CartItem` | `1` đến `0..*` | Sinh viên sở hữu giỏ hàng |
| 21 | `Student` | Kết hợp (Association) | `-->` | `Order` | `1` đến `0..*` | Sinh viên tạo các đơn hàng mua sắm |
| 22 | `Order` | Hợp thành (Composition) | `*--` | `OrderItem` | `1` đến `1..*` | Đơn hàng cấu thành từ ít nhất 1 mặt hàng |
| 23 | `Order` | Kết hợp 1-1 (Association) | `--` | `Transaction` | `1` đến `1` | Mỗi đơn hàng được tất toán bằng 1 giao dịch |
| 24 | `Student` | Kết hợp (Association) | `-->` | `ScholarshipApplication` | `1` đến `0..*` | Sinh viên nộp hồ sơ xin học bổng |
| 25 | `ScholarshipApplication` | Kết hợp (Association) | `-->` | `Scholarship` | `0..*` đến `1` | Hồ sơ ứng tuyển nhắm vào 1 chương trình học bổng |
| 26 | `Student` | Kết hợp nhiều-nhiều (N-N) | `-->` | `CareerPath` | `0..*` đến `0..*` | Sinh viên theo dõi lộ trình nghề nghiệp |
| 27 | `Group` | Hợp thành (Composition) | `*--` | `Post` | `1` đến `0..*` | Nhóm học tập sở hữu các bài viết |
| 28 | `Post` | Hợp thành (Composition) | `*--` | `Comment` | `1` đến `0..*` | Bài viết sở hữu các phản hồi bình luận |
| 29 | `User` | Kết hợp (Association) | `-->` | `Post` | `1` đến `0..*` | Người dùng là tác giả bài viết |
| 30 | `User` | Kết hợp (Association) | `-->` | `Comment` | `1` đến `0..*` | Người dùng là tác giả bình luận |

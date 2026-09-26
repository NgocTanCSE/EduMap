const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ImageRun,
  Footer,
  PageNumber,
  VerticalAlign,
} = require('/tmp/docx-builder/node_modules/docx');

const UML_DIR = '/home/ngoctan/Downloads/EduMap/docs/uml';
const FONT = 'Times New Roman';
const COLOR_BLACK = '000000';

function getPngDimensions(filePath) {
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(24);
  fs.readSync(fd, buffer, 0, 24, 0);
  fs.closeSync(fd);
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return { width, height, ratio: height / width };
}

function createSizedImage(fileName, maxW = 570, maxH = 460) {
  const filePath = path.join(UML_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    return new Paragraph({ children: [new TextRun(`[Thiếu ảnh: ${fileName}]`)] });
  }

  const { ratio } = getPngDimensions(filePath);
  let displayW = maxW;
  let displayH = Math.round(maxW * ratio);

  if (displayH > maxH) {
    displayH = maxH;
    displayW = Math.round(maxH / ratio);
  }

  const imgData = fs.readFileSync(filePath);
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 140, after: 60 },
    children: [
      new ImageRun({
        data: imgData,
        transformation: {
          width: displayW,
          height: displayH,
        },
      }),
    ],
  });
}

// Đoạn văn thông thường
function p(text, options = {}) {
  return new Paragraph({
    alignment: options.align || AlignmentType.JUSTIFIED,
    spacing: { before: options.before || 30, after: options.after || 70, line: 300 },
    indent: options.firstLine ? { firstLine: 450 } : undefined,
    children: [
      new TextRun({
        text,
        font: FONT,
        size: 26, // 13pt
        color: COLOR_BLACK,
        bold: options.bold || false,
        italics: options.italics || false,
      }),
    ],
  });
}

// Gạch đầu dòng "-" (không dùng chấm tròn)
function dash(boldPrefix, content) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: 20, after: 50, line: 300 },
    indent: { left: 450, hanging: 240 },
    children: [
      new TextRun({ text: '- ' + boldPrefix + ': ', font: FONT, size: 26, bold: true, color: COLOR_BLACK }),
      new TextRun({ text: content, font: FONT, size: 26, color: COLOR_BLACK }),
    ],
  });
}

// Chú thích Hình (Hình 2.X: ...)
function figCaption(label, title) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 50, after: 140 },
    children: [
      new TextRun({ text: label + ': ', font: FONT, size: 24, bold: true, color: COLOR_BLACK }),
      new TextRun({ text: title, font: FONT, size: 24, italics: true, color: COLOR_BLACK }),
    ],
  });
}

// Tiêu đề cấp 1 (2.X. TÊN MỤC IN HOA)
function h1(title) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 260, after: 100 },
    children: [
      new TextRun({ text: title, font: FONT, size: 28, bold: true, color: COLOR_BLACK }),
    ],
  });
}

// Tiêu đề cấp 2 (2.X.Y. Tên mục in thường)

// Tiêu đề cấp 3
function h3(title) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 160, after: 60 },
    children: [
      new TextRun({ text: title, font: FONT, size: 25, bold: true, italics: true, color: COLOR_BLACK }),
    ],
  });
}

function h2(title) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 80 },
    children: [
      new TextRun({ text: title, font: FONT, size: 26, bold: true, color: COLOR_BLACK }),
    ],
  });
}

// Bảng theo phong cách khung nét đứt / chấm như ảnh chụp của người dùng
function createAcademicTable(headers, rowsData, widths = []) {
  const borderDotted = { style: BorderStyle.DOTTED, size: 8, color: '4B88BE' };

  const headerCells = headers.map((h, i) => new TableCell({
    shading: { fill: 'FFFFFF' },
    margins: { top: 90, bottom: 90, left: 100, right: 100 },
    width: widths[i] ? { size: widths[i], type: WidthType.PERCENTAGE } : undefined,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        indent: { firstLine: 0, left: 0 },
        children: [new TextRun({ text: h, font: FONT, size: 23, bold: true, color: COLOR_BLACK })],
      }),
    ],
  }));

  const rows = [new TableRow({ children: headerCells })];

  rowsData.forEach((row) => {
    const cells = row.map((cellText, cIdx) => new TableCell({
      shading: { fill: 'FFFFFF' },
      margins: { top: 70, bottom: 70, left: 100, right: 100 },
      width: widths[cIdx] ? { size: widths[cIdx], type: WidthType.PERCENTAGE } : undefined,
      children: [
        new Paragraph({
          alignment: cIdx === 0 ? AlignmentType.CENTER : AlignmentType.LEFT,
          spacing: { line: 260 },
          indent: { firstLine: 0, left: 0 },
          children: [new TextRun({ text: cellText, font: FONT, size: 22, color: COLOR_BLACK })],
        }),
      ],
    }));
    rows.push(new TableRow({ children: cells }));
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: borderDotted,
      bottom: borderDotted,
      left: borderDotted,
      right: borderDotted,
      insideHorizontal: borderDotted,
      insideVertical: borderDotted,
    },
    rows,
  });
}

// Bảng đặc tả chi tiết một Ca sử dụng theo chuẩn OOAD
function createUseCaseSpecTable(specData) {
  const borderDotted = { style: BorderStyle.DOTTED, size: 8, color: '4B88BE' };

  const tableRows = [];

  // Dòng tiêu đề gộp 2 cột
  tableRows.push(
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          columnSpan: 2,
          shading: { fill: 'FFFFFF' },
          margins: { top: 90, bottom: 90, left: 100, right: 100 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: 'ĐẶC TẢ CA SỬ DỤNG: ' + specData.id + ' - ' + specData.name.toUpperCase(),
                  font: FONT,
                  size: 23,
                  bold: true,
                  color: COLOR_BLACK,
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  const fields = [
    { label: 'Mã Ca sử dụng', val: specData.id, bold: true },
    { label: 'Tên Ca sử dụng', val: specData.name, bold: true },
    { label: 'Phân hệ nghiệp vụ', val: specData.package },
    { label: 'Tác nhân chính', val: specData.primaryActor },
    { label: 'Tác nhân phụ / Hệ thống', val: specData.secondaryActors },
    { label: 'Mô tả tóm tắt', val: specData.description },
    { label: 'Tiền điều kiện', val: specData.preconditions },
    { label: 'Hậu điều kiện', val: specData.postconditions },
    { label: 'Luồng sự kiện chính (Basic Flow)', val: specData.mainFlow, isList: true },
    { label: 'Luồng ngoại lệ (Alternative Flow)', val: specData.altFlow, isList: true },
  ];

  fields.forEach((f) => {
    let contentParas = [];
    if (f.isList && Array.isArray(f.val)) {
      contentParas = f.val.map((item) => {
        return new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { before: 20, after: 20, line: 260 },
          indent: { left: 240, hanging: 240 },
          children: [
            new TextRun({ text: item, font: FONT, size: 22, color: COLOR_BLACK }),
          ],
        });
      });
    } else {
      contentParas = [
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { before: 20, after: 20, line: 260 },
          indent: { firstLine: 0, left: 0 },
          children: [
            new TextRun({
              text: f.val,
              font: FONT,
              size: 22,
              bold: f.bold || false,
              color: COLOR_BLACK,
            }),
          ],
        }),
      ];
    }

    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            width: { size: 28, type: WidthType.PERCENTAGE },
            margins: { top: 70, bottom: 70, left: 100, right: 100 },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                indent: { firstLine: 0, left: 0 },
                children: [
                  new TextRun({ text: f.label, font: FONT, size: 22, bold: true, color: COLOR_BLACK }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 72, type: WidthType.PERCENTAGE },
            margins: { top: 70, bottom: 70, left: 100, right: 100 },
            children: contentParas,
          }),
        ],
      })
    );
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: borderDotted,
      bottom: borderDotted,
      left: borderDotted,
      right: borderDotted,
      insideHorizontal: borderDotted,
      insideVertical: borderDotted,
    },
    rows: tableRows,
  });
}


// Bắt đầu lắp ráp nội dung
const children = [];

// Tiêu đề Chương 2
children.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 80 },
    children: [
      new TextRun({ text: 'CHƯƠNG 2: PHÂN TÍCH VÀ THIẾT KẾ KIẾN TRÚC HỆ THỐNG', font: FONT, size: 30, bold: true, color: COLOR_BLACK }),
    ],
  }),
  p('Chương này trình bày chi tiết quá trình phân tích yêu cầu, mô hình hóa nghiệp vụ và thiết kế kiến trúc kỹ thuật cho Hệ sinh thái Bản đồ Giáo dục Thông minh EduMap. Toàn bộ thiết kế được xây dựng theo chuẩn UML 2.5 và mô hình C4, gắn kết trực tiếp với mã nguồn và dữ liệu thực nghiệm của dự án.', { firstLine: true })
);

// -----------------------------------------------------------------------------
// 2.1. Phân tích Yêu cầu Chức năng & Sơ đồ Ca Sử Dụng Tổng quan
// -----------------------------------------------------------------------------
children.push(
  h1('2.1. Phân tích Yêu cầu Chức năng và Sơ đồ Ca Sử Dụng Tổng quan'),
  p('Hệ thống EduMap phục vụ 4 nhóm tác nhân người dùng chính và 2 tác nhân ngoại vi thông qua 6 phân hệ nghiệp vụ trọng tâm:', { firstLine: true }),
  dash('Học sinh, Sinh viên (Student)', 'Khai thác bản đồ giáo dục GIS, tìm điểm Wi-Fi công cộng, lộ trình xe lưu động, tham gia tư vấn cố vấn 1-1, tìm kiếm học bổng và mua sắm tài liệu học tập.'),
  dash('Cố vấn, Chuyên gia (Mentor)', 'Cấu hình lịch rảnh định kỳ, xác nhận lịch hẹn tư vấn, tham gia phòng họp trực tuyến WebRTC Jitsi Meet và quản lý hồ sơ chuyên môn.'),
  dash('Doanh nghiệp, Đối tác (Business/Employer)', 'Đăng tin tuyển dụng thực tập, việc làm, quản lý gian hàng tài liệu học tập và xử lý đơn hàng.'),
  dash('Quản trị viên (Admin/Moderator)', 'Quản lý tài khoản, cấu hình phân quyền RBAC, kiểm duyệt nội dung tự động kết hợp xử lý thủ công và thống kê dữ liệu toàn tỉnh.'),
  dash('Tác nhân ngoại vi (Gateways & AI Engine)', 'Cổng thanh toán điện tử (VNPay/MoMo) xử lý giao dịch ký quỹ; Google Gemini AI cung cấp suy luận RAG và kiểm duyệt ngữ nghĩa.'),
  createSizedImage('UML_usecase-overall.png', 570, 480),
  figCaption('Hình 2.1', 'Sơ đồ Ca sử dụng Tổng quan Hệ sinh thái EduMap'),

  h2('2.1.1. Danh mục Tổng hợp các Ca Sử Dụng Hệ thống EduMap'),
  p('Dựa trên sơ đồ ca sử dụng tổng quan (Hình 2.1), toàn bộ chức năng của hệ thống EduMap được chuẩn hóa thành 19 Ca sử dụng (Use Cases) phân bổ trên 6 phân hệ nghiệp vụ, phục vụ 4 nhóm tác nhân người dùng và 2 đối tác tích hợp ngoại vi:', { firstLine: true }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 60 },
    children: [
      new TextRun({ text: 'Bảng 2.1: Danh mục tổng hợp 19 Ca sử dụng cốt lõi của Hệ thống EduMap', font: FONT, size: 24, bold: true, color: COLOR_BLACK }),
    ],
  }),
  createAcademicTable(
    ['STT', 'Mã UC', 'Tên Ca Sử Dụng', 'Phân hệ Nghiệp vụ', 'Tác nhân Chính', 'Mức độ'],
    [["1","UC01","Tra cứu bản đồ & Điểm học tập lân cận","Bản đồ & GIS (MOD-MAP)","Sinh viên, Khách","Cao"],["2","UC02","Theo dõi lộ trình xe thư viện lưu động","Bản đồ & GIS (MOD-MAP)","Sinh viên, Khách","Trung bình"],["3","UC03","Tìm trạm Wi-Fi miễn phí Đồng Nai","Bản đồ & GIS (MOD-MAP)","Sinh viên, Khách","Cao"],["4","UC04","Chat hỏi đáp RAG với Trợ lý AI","Trợ lý AI & Hướng nghiệp","Sinh viên, Khách","Cao"],["5","UC05","Làm trắc nghiệm nghề nghiệp & Lộ trình","Trợ lý AI & Hướng nghiệp","Sinh viên","Trung bình"],["6","UC06","Đánh giá độ phù hợp học bổng bằng AI","Trợ lý AI & Hướng nghiệp","Sinh viên","Trung bình"],["7","UC07","Đặt lịch hẹn cố vấn học tập 1-1","Tư vấn & Cố vấn Học tập","Sinh viên","Cao"],["8","UC08","Quản lý lịch rảnh & Xác nhận lịch hẹn","Tư vấn & Cố vấn Học tập","Cố vấn (Mentor)","Cao"],["9","UC09","Tham gia phòng họp trực tuyến Jitsi Meet","Tư vấn & Cố vấn Học tập","Sinh viên, Cố vấn","Cao"],["10","UC10","Đánh giá & Phản hồi chất lượng Mentor","Tư vấn & Cố vấn Học tập","Sinh viên","Trung bình"],["11","UC11","Tra cứu & Đọc học liệu số mở","Thư viện Số & Chứng chỉ","Sinh viên, Khách","Cao"],["12","UC12","Nhận chứng chỉ số xác thực Blockchain","Thư viện Số & Chứng chỉ","Sinh viên","Thấp"],["13","UC13","Đặt mua tài liệu / Đăng ký dịch vụ số","Sàn Giáo dục & Giao dịch","Sinh viên","Cao"],["14","UC14","Đăng tuyển dụng & Quản lý gian hàng","Sàn Giáo dục & Giao dịch","Doanh nghiệp","Cao"],["15","UC15","Đăng thảo luận & Tương tác bài viết","Cộng đồng & Mạng xã hội","Toàn bộ người dùng","Cao"],["16","UC16","Tham gia Thử thách xanh & Tình nguyện","Cộng đồng & Mạng xã hội","Sinh viên","Trung bình"],["17","UC17","Quản trị tài khoản & Phân quyền RBAC","Quản trị & Điều hành","Quản trị viên (Admin)","Cao"],["18","UC18","Kiểm duyệt bài viết vi phạm (Human-AI)","Quản trị & Điều hành","Quản trị viên (Admin)","Cao"],["19","UC19","Xem bảng điều khiển thống kê Dashboard","Quản trị & Điều hành","Quản trị viên (Admin)","Trung bình"]],
    [6, 10, 31, 24, 18, 11]
  ),

  h2('2.1.2. Đặc tả Chi tiết các Ca Sử Dụng Trọng tâm Hệ thống'),
  p('Để làm rõ quy trình tương tác nghiệp vụ, điều kiện biên và cơ chế xử lý ngoại lệ, dưới đây là bảng đặc tả chi tiết cho 6 Ca sử dụng tiêu biểu đại diện cho các phân hệ chức năng then chốt của dự án:', { firstLine: true }),

  h3('a. Đặc tả Ca sử dụng UC01: Tra cứu bản đồ giáo dục và điểm học tập lân cận'),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 40, after: 40 },
    children: [
      new TextRun({ text: 'Bảng 2.2: Đặc tả ca sử dụng UC01 - Tra cứu bản đồ & Điểm học tập lân cận', font: FONT, size: 24, bold: true, color: COLOR_BLACK }),
    ],
  }),
  createUseCaseSpecTable({"id":"UC01","name":"Tra cứu Bản đồ Giáo dục & Điểm Học tập Lân cận","package":"Phân hệ 1: Bản đồ Số & Không gian GIS (MOD-MAP)","primaryActor":"Học sinh / Sinh viên (Student), Người dùng vãng lai (Guest)","secondaryActors":"Hệ thống Định vị GPS Thiết bị, Dịch vụ Bản đồ Số OpenStreetMap, CSDL PostGIS","description":"Cho phép người dùng tương tác với bản đồ số, tự động định vị vị trí hiện tại và lọc tìm kiếm các địa điểm giáo dục (trường ĐH, CĐ, trường nghề, trạm Wi-Fi công cộng, không gian học tập) trong bán kính xác định trên địa bàn tỉnh Đồng Nai.","preconditions":"Người dùng truy cập ứng dụng Web/Mobile và thiết bị bật kết nối mạng Internet.","postconditions":"Bản đồ hiển thị các điểm ghim (marker) tương ứng với bộ lọc, cho phép xem chi tiết thông tin và điều hướng đường đi.","mainFlow":["1. Người dùng truy cập vào tính năng Bản đồ Giáo dục từ Menu chính của ứng dụng.","2. Hệ thống yêu cầu cấp quyền truy cập vị trí địa lý (GPS) của thiết bị.","3. Người dùng chấp thuận quyền vị trí, thiết bị gửi tọa độ (Vĩ độ, Kinh độ) về cho ứng dụng.","4. Hệ thống định vị vị trí người dùng trên bản đồ và kích hoạt bán kính mặc định (5 km).","5. Người dùng chọn danh mục cần lọc (ví dụ: \"Trường Đại học\", \"Điểm Wi-Fi miễn phí\").","6. Frontend gửi yêu cầu API kèm tọa độ và danh mục tới Backend NestJS.","7. Backend thực hiện truy vấn không gian PostGIS bằng hàm ST_DWithin với chỉ mục GiST.","8. CSDL trả về danh sách các điểm thỏa mãn; Backend chuyển đổi dữ liệu chuẩn GeoJSON gửi về Client.","9. Client hiển thị các marker kèm cụm điểm (Clustering). Người dùng bấm vào marker để xem thông tin tóm tắt (Popup)."],"altFlow":["- 2a. Người dùng từ chối cấp quyền vị trí GPS: Hệ thống tự động thiết lập tọa độ mặc định tại trung tâm TP. Biên Hòa (10.9574° B, 106.8427° Đ) và hiển thị thông báo hướng dẫn.","- 7a. Không có điểm dữ liệu nào trong bán kính đã chọn: Hệ thống hiển thị thông báo không tìm thấy kết quả và gợi ý người dùng tăng bán kính tìm kiếm lên 10 km hoặc 20 km."]}),

  h3('b. Đặc tả Ca sử dụng UC04: Chat hỏi đáp RAG với Trợ lý AI'),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 40, after: 40 },
    children: [
      new TextRun({ text: 'Bảng 2.3: Đặc tả ca sử dụng UC04 - Chat hỏi đáp và tư vấn với Trợ lý AI RAG', font: FONT, size: 24, bold: true, color: COLOR_BLACK }),
    ],
  }),
  createUseCaseSpecTable({"id":"UC04","name":"Chat Hỏi đáp Tri thức & Tư vấn Tuyển sinh với Trợ lý AI","package":"Phân hệ 2: Trợ lý AI & Hướng nghiệp (MOD-AI)","primaryActor":"Học sinh / Sinh viên (Student), Phụ huynh","secondaryActors":"Vi dịch vụ AI (FastAPI), Kho Vector RAG (ChromaDB), Google Gemini 1.5 Flash API","description":"Cung cấp kênh tư vấn tự động 24/7, tiếp nhận câu hỏi tự nhiên về quy chế tuyển sinh, chương trình đào tạo, cơ hội học bổng và thủ tục nhập học; truy xuất tài liệu chính thống và tổng hợp câu trả lời chuẩn xác kèm trích dẫn nguồn.","preconditions":"Hệ thống Backend NestJS và Vi dịch vụ AI FastAPI đang hoạt động bình thường.","postconditions":"Câu trả lời được sinh tự động, hiển thị theo luồng thời gian thực (Streaming) và lưu vết vào lịch sử hội thoại.","mainFlow":["1. Người dùng mở cửa sổ Trợ lý AI trên giao diện Web hoặc Mobile.","2. Người dùng nhập câu hỏi (ví dụ: \"Hồ sơ xét tuyển học bổng Đại học Đồng Nai cần những giấy tờ gì?\") và bấm Gửi.","3. Client gửi tin nhắn qua WebSocket/RESTful API tới Backend NestJS.","4. Backend chuyển tiếp câu hỏi sang Vi dịch vụ AI FastAPI.","5. AI Service tiến hành chuẩn hóa văn bản và tạo vector nhúng (Embedding) bằng mô hình text-embedding-004.","6. AI Service truy vấn kho vector ChromaDB để tìm top 3 đoạn văn bản liên quan nhất dựa trên khoảng cách Cosine Similarity.","7. AI Service tổng hợp ngữ cảnh (Context) cùng câu hỏi ban đầu thành Prompt hoàn chỉnh.","8. AI Service gọi Google Gemini 1.5 Flash API sinh câu trả lời theo kỹ thuật RAG.","9. Câu trả lời được kiểm duyệt an toàn ngữ nghĩa và đẩy về Client theo dạng luồng ký tự (Server-Sent Events).","10. Người dùng nhận câu trả lời kèm đường dẫn tham chiếu đến văn bản nguồn."],"altFlow":["- 2a. Người dùng nhập câu hỏi vi phạm tiêu chuẩn cộng đồng (từ ngữ thô tục, bạo lực): Bộ lọc kiểm duyệt tự động từ chối xử lý và hiển thị thông báo nhắc nhở chuẩn mực giao tiếp.","- 8a. Google Gemini API gặp sự cố quá tải hoặc mất mạng: Hệ thống tự động chuyển sang cơ chế Fallback, lấy câu trả lời mẫu có sẵn từ bộ nhớ đệm Redis Cache cho các câu hỏi phổ biến."]}),

  h3('c. Đặc tả Ca sử dụng UC07: Đặt lịch hẹn cố vấn học tập 1-1 & Ký quỹ'),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 40, after: 40 },
    children: [
      new TextRun({ text: 'Bảng 2.4: Đặc tả ca sử dụng UC07 - Đặt lịch hẹn cố vấn 1-1 và ký quỹ thanh toán', font: FONT, size: 24, bold: true, color: COLOR_BLACK }),
    ],
  }),
  createUseCaseSpecTable({"id":"UC07","name":"Đặt Lịch hẹn Tư vấn Cố vấn Học tập 1-1 & Ký quỹ Thanh toán","package":"Phân hệ 3: Tư vấn & Cố vấn Học tập (MOD-MENTOR)","primaryActor":"Học sinh / Sinh viên (Student)","secondaryActors":"Cố vấn (Mentor), Cổng thanh toán điện tử (VNPay / MoMo), Dịch vụ WebRTC Jitsi Meet","description":"Quy trình sinh viên tìm kiếm chuyên gia hướng nghiệp, chọn khung thời gian tư vấn phù hợp, tiến hành thanh toán ký quỹ bảo đảm và nhận đường dẫn phòng họp trực tuyến bảo mật.","preconditions":"Sinh viên đã đăng nhập tài khoản; Mentor đã kích hoạt hồ sơ và cấu hình lịch rảnh (Availability).","postconditions":"Lịch hẹn được xác nhận (CONFIRMED), tiền thù lao được giữ an toàn tại tài khoản ký quỹ (Escrow), phòng họp trực tuyến được khởi tạo tự động.","mainFlow":["1. Sinh viên vào phân hệ Mentor, duyệt danh sách chuyên gia theo lĩnh vực (Công nghệ, Du học, Kinh tế).","2. Sinh viên bấm xem hồ sơ chi tiết của Mentor, đánh giá học viên cũ và mức thù lao theo giờ.","3. Sinh viên chọn ngày và khung giờ còn trống trong lịch làm việc của Mentor.","4. Sinh viên điền phiếu tóm tắt mục tiêu tư vấn và các câu hỏi cần giải đáp.","5. Hệ thống tạm khóa (Lock) khung giờ đã chọn trong 15 phút để chờ thanh toán.","6. Sinh viên chọn cổng thanh toán (VNPay / MoMo) và quét mã QR thanh toán phí tư vấn.","7. Cổng thanh toán gửi Webhook xác nhận giao dịch thành công (IPN) tới Backend EduMap.","8. Backend ghi nhận trạng thái đơn đặt lịch thành CONFIRMED và giữ tiền ở trạng thái Ký quỹ (Escrow).","9. Hệ thống tự động sinh phòng họp trực tuyến Jitsi Meet bảo mật bằng JWT Secret.","10. Hệ thống gửi thông báo đẩy (Push Notification) và Email xác nhận kèm link phòng họp cho cả Sinh viên và Mentor."],"altFlow":["- 6a. Quá 15 phút sinh viên không hoàn tất thanh toán: Hệ thống tự động hủy đơn đặt lịch và giải phóng khung giờ trống để người khác có thể đặt.","- 8a. Mentor có việc đột xuất từ chối lịch hẹn trước 24 giờ: Hệ thống tự động hoàn lại 100% số tiền ký quỹ về tài khoản của sinh viên và gửi thông báo cáo lỗi."]}),

  h3('d. Đặc tả Ca sử dụng UC13: Đặt mua tài liệu học tập & Đăng ký dịch vụ số'),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 40, after: 40 },
    children: [
      new TextRun({ text: 'Bảng 2.5: Đặc tả ca sử dụng UC13 - Đặt mua tài liệu học tập và dịch vụ số', font: FONT, size: 24, bold: true, color: COLOR_BLACK }),
    ],
  }),
  createUseCaseSpecTable({"id":"UC13","name":"Đặt Mua Tài liệu Học tập & Đăng ký Khóa học Trực tuyến","package":"Phân hệ 5: Sàn Giáo dục & Giao dịch (MOD-COMMERCE)","primaryActor":"Học sinh / Sinh viên (Student)","secondaryActors":"Doanh nghiệp / Nhà xuất bản đối tác (Partner), Cổng thanh toán trực tuyến","description":"Quy trình sinh viên đặt mua tài liệu học tập vật lý (sách, giáo trình) hoặc đăng ký dịch vụ số (khóa học trực tuyến, bản quyền phần mềm học tập) và hoàn tất thanh toán qua mạng.","preconditions":"Sinh viên đã đăng nhập và thêm ít nhất một sản phẩm/dịch vụ vào giỏ hàng.","postconditions":"Đơn hàng được lưu vào hệ thống, số lượng tồn kho được cập nhật tự động, quyền truy cập dịch vụ số được kích hoạt ngay lập tức.","mainFlow":["1. Sinh viên mở giao diện Giỏ hàng (Cart), kiểm tra danh sách sản phẩm và số lượng cần mua.","2. Sinh viên bấm nút \"Tiến hành Đặt hàng\".","3. Đối với tài liệu vật lý: Sinh viên nhập địa chỉ giao hàng, số điện thoại người nhận.","4. Hệ thống tính toán tổng tiền thanh toán (bao gồm giá sản phẩm và phí vận chuyển).","5. Sinh viên chọn hình thức thanh toán trực tuyến (VNPay / Quét mã VietQR).","6. Hệ thống tạo đơn hàng với trạng thái PENDING và chuyển hướng sinh viên sang cổng thanh toán.","7. Sinh viên xác thực thanh toán tại ứng dụng Ngân hàng / Ví điện tử.","8. Backend nhận thông báo thanh toán thành công, kích hoạt Database Transaction mức Read Committed.","9. Hệ thống cập nhật trạng thái đơn hàng sang PAID, tự động trừ số lượng tồn kho sản phẩm.","10. Đối với dịch vụ số / khóa học: Hệ thống tự động phân quyền tài khoản để sinh viên vào học ngay.","11. Hệ thống gửi Email hóa đơn điện tử xác nhận đơn hàng thành công."],"altFlow":["- 8a. Sản phẩm bị mua hết bởi người khác trong lúc đang thanh toán: Giao dịch được rollback, hệ thống tự động hoàn tiền và gửi thông báo xin lỗi người dùng.","- 7a. Sinh viên hủy giao dịch tại cổng thanh toán: Đơn hàng chuyển sang trạng thái CANCELLED, sản phẩm trong giỏ hàng vẫn được giữ nguyên."]}),

  h3('e. Đặc tả Ca sử dụng UC15: Đăng thảo luận & Tương tác bài viết cộng đồng'),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 40, after: 40 },
    children: [
      new TextRun({ text: 'Bảng 2.6: Đặc tả ca sử dụng UC15 - Đăng thảo luận và kiểm duyệt bài viết 2 tầng', font: FONT, size: 24, bold: true, color: COLOR_BLACK }),
    ],
  }),
  createUseCaseSpecTable({"id":"UC15","name":"Đăng Thảo luận & Tương tác Bài viết Cộng đồng Học tập","package":"Phân hệ 5: Sàn Giáo dục & Cộng đồng (MOD-COMMUNITY)","primaryActor":"Toàn bộ Người dùng đã đăng nhập (Student, Mentor, Teacher)","secondaryActors":"Động cơ Kiểm duyệt Tự động AI (Gemini Safety Filter), Ban Quản trị viên","description":"Quy trình người dùng chia sẻ kinh nghiệm học tập, đặt câu hỏi học thuật lên diễn đàn cộng đồng; bài viết được kiểm duyệt tự động trước khi xuất bản rộng rãi.","preconditions":"Người dùng đã đăng nhập và tài khoản ở trạng thái hoạt động bình thường (không bị kỷ luật cấm đăng bài).","postconditions":"Bài viết hợp lệ được hiển thị trên Bảng tin chung; người dùng khác có thể xem, thích và bình luận.","mainFlow":["1. Người dùng chọn nhóm thảo luận hoặc bảng tin cộng đồng, bấm \"Tạo bài viết mới\".","2. Người dùng nhập tiêu đề, nội dung văn bản, gắn nhãn chủ đề (Tag) và đính kèm tệp ảnh/tài liệu.","3. Người dùng bấm nút \"Đăng bài\".","4. Backend tiếp nhận bài viết và kích hoạt luồng Kiểm duyệt 2 tầng (Two-Tier Moderation).","5. Tầng 1 (Regex Blacklist): Hệ thống quét nhanh các từ khóa tục tĩu, vi phạm thuần phong mỹ tục.","6. Tầng 2 (AI Semantic Analysis): Hệ thống gọi mô hình phân tích ngữ nghĩa để phát hiện nội dung thù ghét, tin giả.","7. Nếu bài viết đạt chuẩn an toàn: Hệ thống lưu bài viết với trạng thái APPROVED.","8. Bài viết xuất hiện tức thì trên Bảng tin công khai; hệ thống gửi thông báo WebSocket tới các thành viên theo dõi nhóm.","9. Người dùng khác có thể tương tác: Thả tim, Bình luận, Chia sẻ tài liệu."],"altFlow":["- 5a/6a. Bài viết chứa từ ngữ vi phạm hoặc AI đánh giá độc hại vượt ngưỡng: Hệ thống tự động chuyển bài viết sang trạng thái PENDING_REVIEW.","- 6b. Bài viết bị giữ lại kiểm duyệt: Hệ thống gửi thông báo cho tác giả \"Bài viết đang được Ban quản trị duyệt thủ công\" và đẩy vào hàng đợi của Admin Dashboard."]}),

  h3('f. Đặc tả Ca sử dụng UC17: Quản trị tài khoản người dùng & Phân quyền RBAC'),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 40, after: 40 },
    children: [
      new TextRun({ text: 'Bảng 2.7: Đặc tả ca sử dụng UC17 - Quản trị tài khoản và phân quyền hệ thống (RBAC)', font: FONT, size: 24, bold: true, color: COLOR_BLACK }),
    ],
  }),
  createUseCaseSpecTable({"id":"UC17","name":"Quản trị Tài khoản Người dùng & Phân quyền Hệ thống (RBAC)","package":"Phân hệ 6: Quản trị & Điều hành Nền tảng (MOD-AUTH / ADMIN)","primaryActor":"Quản trị viên Hệ thống (System Administrator)","secondaryActors":"Hệ thống Phân quyền Role-Based Access Control (RBAC), Nhật ký Kiểm toán (Audit Log)","description":"Cung cấp công cụ cho Quản trị viên theo dõi danh sách người dùng, cấp phát/thu hồi vai trò (Roles & Permissions), khóa tài khoản vi phạm và phê duyệt chứng nhận uy tín cho Mentor.","preconditions":"Người dùng đăng nhập bằng tài khoản có vai trò SUPER_ADMIN hoặc ADMIN.","postconditions":"Quyền hạn người dùng được cập nhật trong CSDL; mọi thao tác quản trị được lưu vết kiểm toán vĩnh viễn.","mainFlow":["1. Quản trị viên truy cập vào Bảng điều khiển Quản trị (Admin Dashboard).","2. Quản trị viên chọn mục \"Quản lý Người dùng\" (User Management).","3. Hệ thống hiển thị danh sách người dùng phân trang kèm bộ lọc theo Vai trò, Trạng thái, Ngày đăng ký.","4. Quản trị viên tìm kiếm tài khoản cụ thể theo Email hoặc Tên người dùng.","5. Quản trị viên xem hồ sơ chi tiết, lịch sử đăng nhập và nhật ký hoạt động của tài khoản.","6. Quản trị viên thực hiện thao tác nghiệp vụ: Thay đổi vai trò (gán quyền Mentor, Mod), Khóa tài khoản (Lock) hoặc Cấp tích xanh xác thực.","7. Quản trị viên nhập lý do thay đổi vào trường ghi chú bắt buộc.","8. Quản trị viên bấm \"Xác nhận Lưu thay đổi\".","9. Hệ thống cập nhật bảng dữ liệu users và user_roles trong PostgreSQL.","10. Hệ thống ghi một bản ghi mới vào bảng audit_logs lưu vết: Admin ID, Hành động, Thời gian, Dữ liệu cũ, Dữ liệu mới.","11. Hệ thống gửi thông báo qua Email tới chủ tài khoản về quyết định thay đổi trạng thái."],"altFlow":["- 6a. Quản trị viên vô tình chọn thao tác khóa tài khoản chính mình: Hệ thống phát hiện logic xung đột, từ chối thực thi và cảnh báo \"Không thể tự khóa tài khoản quản trị đang đăng nhập\".","- 9a. Lỗi kết nối CSDL trong quá trình lưu quyền: Hệ thống thực hiện rollback transaction, giữ nguyên quyền cũ và thông báo lỗi kỹ thuật."]})

);

// -----------------------------------------------------------------------------
// 2.2. Đánh giá & So sánh Công nghệ Hệ thống
// -----------------------------------------------------------------------------
children.push(
  h1('2.2. Khảo sát và Đánh giá Lựa chọn Công nghệ Hệ thống'),
  p('Bảng 2.8 tổng hợp đánh giá và đối chiếu các công nghệ được lựa chọn trong quá trình xây dựng hệ thống:', { firstLine: true }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 60 },
    children: [
      new TextRun({ text: 'Bảng 2.8: Ma trận đánh giá và so sánh công nghệ hệ thống EduMap', font: FONT, size: 24, bold: true, color: COLOR_BLACK }),
    ],
  }),
  createAcademicTable(
    ['STT', 'Công nghệ', 'Vai trò trong EduMap', 'Lý do lựa chọn & Ưu điểm', 'Phương án thay thế'],
    [
      ['1', 'Next.js 14', 'Frontend Web Portal', 'App Router, tối ưu SEO qua SSR/SSG, tải trang nhanh qua React Server Components.', 'Nuxt (Vue), Remix'],
      ['2', 'React Native (Expo 50)', 'Ứng dụng Di động', 'Một codebase cho iOS và Android, hỗ trợ cảm biến GPS và lưu đệm ngoại tuyến SQLite.', 'Flutter 3, Kotlin'],
      ['3', 'NestJS', 'Backend Core API', 'Kiến trúc Module hóa, Dependency Injection, TypeScript chặt chẽ, dễ bảo trì và mở rộng.', 'Express.js, Fastify'],
      ['4', 'FastAPI', 'AI Microservice', 'Async ASGI hiệu năng cao, tích hợp mượt mà hệ sinh thái Python ML, tự động sinh tài liệu Swagger.', 'Flask, Django REST'],
      ['5', 'PostgreSQL 16 + PostGIS', 'Cơ sở dữ liệu chính', 'Hỗ trợ chuẩn ACID, xử lý dữ liệu không gian GIS mạnh mẽ với chỉ mục GiST và kiểu JSONB.', 'MySQL, CockroachDB'],
      ['6', 'ChromaDB', 'Cơ sở dữ liệu Vector RAG', 'Lưu trữ vector nhúng cục bộ, hỗ trợ tìm kiếm ngữ nghĩa cosine similarity cho AI Chatbot.', 'Pinecone, Qdrant'],
      ['7', 'Redis 7', 'Cache & Hàng đợi', 'Độ trễ truy xuất dưới 1ms, phục vụ lưu đệm kết quả, rate limit và quản trị hàng đợi BullMQ.', 'Memcached, Dragonfly'],
      ['8', 'MinIO', 'Lưu trữ Đối tượng S3', 'Chuẩn S3 tương thích cao, tự triển khai an toàn, bảo mật tệp minh chứng học bổng và ảnh đại diện.', 'AWS S3, Google Cloud'],
      ['9', 'Kubernetes & Docker', 'Điều phối & Hạ tầng', 'Tự động co giãn (HPA), tự phục hồi (Self-healing), rolling updates đảm bảo dịch vụ hoạt động liên tục.', 'Docker Swarm, Nomad'],
    ],
    [7, 18, 22, 35, 18]
  )
);

// -----------------------------------------------------------------------------
// 2.3. Thiết kế Kiến trúc Tổng thể C4 Container
// -----------------------------------------------------------------------------
children.push(
  h1('2.3. Thiết kế Kiến trúc Tổng thể Hệ thống (C4 Container Diagram)'),
  p('Hệ thống EduMap được tổ chức theo mô hình kiến trúc phân tầng dọc (Vertical 5-Tier Architecture):', { firstLine: true }),
  dash('Tầng Khách (Client Tier)', 'Bao gồm Web Portal (Next.js 14) và Ứng dụng Di động (React Native Expo SDK 50) giao tiếp qua HTTPS RESTful API và WebSocket.'),
  dash('Tầng Cổng Biên (Edge Ingress Tier)', 'Nginx Reverse Proxy đảm nhận cân bằng tải, SSL Termination (Let\'s Encrypt) và tường lửa WAF.'),
  dash('Tầng Ứng dụng Phi trạng thái (Stateless Pods)', 'NestJS Backend Pods (cổng 3000) xử lý nghiệp vụ chính và FastAPI AI Pods (cổng 8000) phụ trách suy luận trí tuệ nhân tạo.'),
  dash('Tầng Dữ liệu Bền vững (Data Tier)', 'PostgreSQL 16 kết hợp PostGIS, Redis 7, MinIO S3 và kho vector ChromaDB.'),
  dash('Tầng Dịch vụ Đám mây (Cloud Services)', 'Google Gemini API, Cổng thanh toán VNPay/MoMo, OpenStreetMap và Firebase Cloud Messaging (FCM).'),
  createSizedImage('UML_container-diagram.png', 570, 480),
  figCaption('Hình 2.2', 'Sơ đồ Kiến trúc C4 Mức 2 (Container Diagram) Hệ thống EduMap')
);

// -----------------------------------------------------------------------------
// 2.4. Thiết kế Phân hệ Backend NestJS
// -----------------------------------------------------------------------------
children.push(
  h1('2.4. Thiết kế Phân hệ Backend NestJS'),
  p('Phân hệ Backend được tổ chức theo mô hình Hub-and-Spoke 3 cột, loại bỏ phụ thuộc vòng và bảo đảm tính độc lập giữa các miền nghiệp vụ:', { firstLine: true }),
  dash('Cột Lõi Nền tảng (Core Infrastructure)', 'AuthModule, RoleModule, UserPreferenceModule và AuditLogModule cung cấp cơ chế xác thực JWT, phân quyền RBAC và ghi vết kiểm toán.'),
  dash('Cột Nghiệp vụ Miền (Domain Subsystems)', 'MapModule, CareerModule, ScholarshipModule, MentorModule, BusinessModule, CommunityModule, MobileUnitModule và VolunteerModule.'),
  dash('Cột Dịch vụ Tích hợp Dùng chung (Shared Services)', 'AIModule (giao tiếp FastAPI), PaymentModule (cổng thanh toán), NotificationModule và StorageModule.'),
  createSizedImage('UML_backend-module-dependency.png', 570, 480),
  figCaption('Hình 2.3', 'Sơ đồ Thành phần và Phụ thuộc Mô-đun Backend NestJS')
);

// -----------------------------------------------------------------------------
// 2.5. Thiết kế Vi dịch vụ Trí tuệ Nhân tạo FastAPI
// -----------------------------------------------------------------------------
children.push(
  h1('2.5. Thiết kế Vi dịch vụ Trí tuệ Nhân tạo FastAPI'),
  p('Phân hệ AI Service được xây dựng theo kiến trúc Clean Architecture 3 tầng phục vụ hỏi đáp thông minh và kiểm duyệt tự động:', { firstLine: true }),
  dash('12 APIRouters Chuyên biệt', 'Phân rã chức năng rõ ràng: `/chat`, `/mentor`, `/scholarship`, `/moderation`, `/career`, `/search`, `/predictive`...'),
  dash('Đường ống RAG và Bộ đệm Hai cấp', 'Kiểm tra Semantic Cache trên Redis; nếu không có sẽ truy vấn kho vector ChromaDB bằng Cosine Similarity để trích xuất 3 đoạn ngữ cảnh chuẩn nhồi vào Prompt gọi Gemini 1.5 Flash.'),
  dash('Kiểm duyệt Nội dung 2 Tầng', 'Tầng 1 Regex quét từ cấm nhanh (<5ms) kết hợp Tầng 2 phân tích ngữ nghĩa sâu bằng mô hình Gemini.'),
  createSizedImage('UML_ai-service-components.png', 570, 460),
  figCaption('Hình 2.4', 'Sơ đồ Kiến trúc Thành phần Vi dịch vụ Trí tuệ Nhân tạo FastAPI')
);

// -----------------------------------------------------------------------------
// 2.6. Thiết kế Ứng dụng Di động React Native
// -----------------------------------------------------------------------------
children.push(
  h1('2.6. Thiết kế Ứng dụng Di động React Native / Expo SDK 50'),
  p('Ứng dụng di động được phân thành 4 tầng kiến trúc phục vụ sinh viên di chuyển và định vị GPS ngoài thực địa:', { firstLine: true }),
  dash('Tầng Giao diện (Screens)', 'HomeScreen, MapScreen (bản đồ GIS), ChatScreen (trợ lý ảo AI), InternshipScreen, ScholarshipScreen, ProfileScreen, CareerScreen và WifiScreen.'),
  dash('Tầng Trạng thái Dùng chung (Context Layer)', 'AuthContext (quản lý token đăng nhập), LocationContext (tọa độ GPS người dùng) và ThemeContext (giao diện tối Dark Mode).'),
  dash('Tầng Dịch vụ Khách (Client Services)', 'ApiService (RESTful client kèm Bearer Token), SecureStoreService (lưu trữ an toàn trong Keychain/Keystore), OfflineCacheManager và LocationManager.'),
  dash('Tầng Cầu nối Hạ tầng (Bridges & Infrastructure)', 'Kết nối phần cứng GPS thiết bị, máy chủ bản đồ nền OSM Tiles và hệ thống Backend/AI Service.'),
  createSizedImage('UML_mobile-app-architecture.png', 570, 480),
  figCaption('Hình 2.5', 'Sơ đồ Kiến trúc Thành phần Ứng dụng Di động React Native')
);

// -----------------------------------------------------------------------------
// 2.7. Thiết kế Pipeline Thu thập GIS & Nạp Vector
// -----------------------------------------------------------------------------
children.push(
  h1('2.7. Thiết kế Đường ống Thu thập Dữ liệu GIS và Nạp Vector'),
  p('Quy trình xử lý dữ liệu không gian tỉnh Đồng Nai được thực hiện qua 4 giai đoạn khép kín:', { firstLine: true }),
  dash('Giai đoạn 1 (Multi-Source Crawlers)', 'Thu thập từ OSM Overpass (`overpass_crawler.py`), cổng GD&ĐT Đồng Nai, các điểm Wi-Fi Biên Hòa, không gian xanh và danh mục sách thư viện.'),
  dash('Giai đoạn 2 (Hợp nhất & Lọc trùng)', 'Script `aggregator.py` gắn nhãn nguồn dữ liệu, chuẩn hóa tiếng Việt UTF-8, kiểm tra tọa độ trong hộp bao Đồng Nai `[10.6°N - 11.6°N, 106.7°E - 107.6°E]` và lọc trùng vị trí bán kính ~11 mét.'),
  dash('Giai đoạn 3A (Spatial ETL)', 'Chuyển đổi tọa độ thành PostGIS Point (`ST_SetSRID`), phân mảnh file SQL 30.000 dòng và đánh chỉ mục không gian GiST phục vụ truy vấn bán kính `ST_DWithin`.'),
  dash('Giai đoạn 3B (Vector Ingestion)', 'Cắt đoạn ngữ nghĩa văn bản, tính toán vector nhúng 768 chiều (`text-embedding-004`) và nạp vào ChromaDB phục vụ Chatbot RAG.'),
  createSizedImage('UML_crawler-gis-pipeline.png', 570, 480),
  figCaption('Hình 2.6', 'Sơ đồ Luồng Hoạt động Pipeline Thu thập Dữ liệu GIS và Nạp Vector')
);

// -----------------------------------------------------------------------------
// 2.8. Thiết kế Cơ sở Dữ liệu & 7 Bounded Contexts
// -----------------------------------------------------------------------------
children.push(
  h1('2.8. Thiết kế Cơ sở Dữ liệu và 7 Bounded Contexts (DDD)'),
  p('Cơ sở dữ liệu EduMap được thiết kế theo tư duy Domain-Driven Design (DDD) gồm 85 thực thể và 12 enum chia thành 7 miền nghiệp vụ độc lập:', { firstLine: true }),
  dash('Context 1: Identity & Access Management', 'User, Role, UserPreference, Notification và bảng nhật ký kiểm toán AuditLog.'),
  dash('Context 2: Geospatial & Smart Campus', 'Location, LocationCategory, MapPoint, WifiLocation, StemLab, MobileUnit; toàn bộ có cột tọa độ PostGIS `geography(Point, 4326)`.'),
  dash('Context 3: Academic & Career Pathways', 'CareerPath, Job, Application, LearningMaterial và kỹ năng sinh viên UserSkill.'),
  dash('Context 4: Talent, Donations & Scholarships', 'Scholarship, ScholarshipApplication, DonationCampaign và Donation.'),
  dash('Context 5: Mentorship & Consultation', 'Mentor, Booking, MentorAvailability, MentorRelationship và MentorSession.'),
  dash('Context 6: Community, Social & Engagement', 'Group, Post, Comment, ChatMessage, Event và EventRegistration.'),
  dash('Context 7: Commerce & Gamification', 'BusinessProfile, Product, Service, Order, OrderItem, Transaction, Review, Badge và GreenChallenge.'),
  createSizedImage('UML_entity-relationship-diagram.png', 570, 460),
  figCaption('Hình 2.7', 'Sơ đồ Thực thể Liên kết (Entity Relationship Diagram - 85 Thực thể)')
);

// -----------------------------------------------------------------------------
// 2.9. Thiết kế Luồng Xác thực & Bảo mật Hệ thống
// -----------------------------------------------------------------------------
children.push(
  h1('2.9. Thiết kế Luồng Nghiệp vụ Động: Xác thực và Bảo mật Hệ thống'),
  p('Quy trình xác thực bảo vệ hệ thống trước tấn công dò mật khẩu và đảm bảo an toàn phiên làm việc:', { firstLine: true }),
  dash('Kiểm soát tần suất (Rate Limiting)', 'Redis Throttler giới hạn tối đa 5 lần đăng nhập/phút cho mỗi tài khoản/IP; vượt ngưỡng trả về lỗi HTTP 429.'),
  dash('Mã hóa mật khẩu một chiều', 'Mật khẩu được so khớp duy nhất 1 lần bằng thuật toán `bcrypt.compare` với độ phức tạp work factor = 10.'),
  dash('Cấp phát cặp Token JWT', 'Hệ thống sinh Access Token ngắn hạn (15 phút) và Refresh Token dài hạn (7 ngày) lưu an toàn trong Redis.'),
  createSizedImage('UML_seq-auth-login.png', 570, 480),
  figCaption('Hình 2.8', 'Sơ đồ Tuần tự Luồng Xác thực và Đăng nhập Hệ thống')
);

// -----------------------------------------------------------------------------
// 2.10. Thiết kế Luồng Trợ lý Ảo RAG AI Chatbot
// -----------------------------------------------------------------------------
children.push(
  h1('2.10. Thiết kế Luồng Nghiệp vụ Động: Trợ lý Ảo RAG AI Chatbot'),
  p('Luồng hỏi đáp thông minh kết hợp RAG loại bỏ hiện tượng ảo giác ngôn ngữ và cung cấp thông tin chuẩn xác:', { firstLine: true }),
  dash('Tra cứu bộ đệm câu hỏi', 'Băm câu hỏi kiểm tra trên Redis Cache; nếu có trả kết quả ngay với độ trễ dưới 10ms.'),
  dash('Truy xuất ngữ cảnh ChromaDB', 'Trích xuất top 3 đoạn văn bản liên quan nhất từ kho tri thức vector ChromaDB.'),
  dash('Tăng cường Prompt và gọi LLM', 'Nhồi ngữ cảnh trích xuất vào Prompt gửi tới Gemini 1.5 Flash để sinh câu trả lời tự nhiên, có căn cứ.'),
  dash('Lưu vết lịch sử', 'NestJS ghi nhật ký câu hỏi và câu trả lời vào bảng `chat_histories` trong PostgreSQL.'),
  createSizedImage('UML_seq-ai-chat.png', 570, 480),
  figCaption('Hình 2.9', 'Sơ đồ Tuần tự Luồng Hỏi đáp Trợ lý Ảo RAG AI Chatbot')
);

// -----------------------------------------------------------------------------
// 2.11. Thiết kế Luồng Kiểm duyệt Nội dung Cộng đồng 2 Tầng
// -----------------------------------------------------------------------------
children.push(
  h1('2.11. Thiết kế Luồng Nghiệp vụ Động: Kiểm duyệt Nội dung Cộng đồng 2 Tầng'),
  p('Hệ thống tự động rà soát nội dung bài viết trước khi hiển thị lên bảng tin công cộng:', { firstLine: true }),
  dash('Tầng 1 (Regex & Từ điển từ cấm)', 'Quét nhanh từ ngữ vi phạm nặng và thông tin nhạy cảm trong <5ms; vi phạm lập tức gán trạng thái `AUTO_REJECTED`.'),
  dash('Tầng 2 (Phân tích ngữ nghĩa Gemini)', 'Đánh giá ngữ cảnh, phát hiện phát ngôn kích động thù hằn hoặc thông tin sai lệch.'),
  dash('3 Kịch bản quyết định', 'APPROVED (công khai ngay), SEND_TO_HUMAN_REVIEW (chuyển kiểm duyệt viên thủ công) hoặc AUTO_REJECTED (khóa bài và thông báo tác giả).'),
  createSizedImage('UML_seq-community-post.png', 570, 480),
  figCaption('Hình 2.10', 'Sơ đồ Tuần tự Luồng Đăng bài và Kiểm duyệt Nội dung Cộng đồng 2 Tầng')
);

// -----------------------------------------------------------------------------
// 2.12. Thiết kế Luồng Đặt hàng & Thanh toán Thương mại 2 Pha
// -----------------------------------------------------------------------------
children.push(
  h1('2.12. Thiết kế Luồng Nghiệp vụ Động: Đặt hàng và Thanh toán 2 Pha'),
  p('Thiết kế giao dịch bảo đảm nguyên tắc ACID và chống gian lận thanh toán trực tuyến:', { firstLine: true }),
  dash('Pha 1 (Khởi tạo & Khóa tồn kho ACID)', 'Thực hiện trong PostgreSQL Transaction `REPEATABLE READ`, kiểm tra và trừ tồn kho tức thời, tạo Order và Transaction ở trạng thái PENDING, kích hoạt timer hủy sau 15 phút.'),
  dash('Pha 2 (Xác thực Webhook IPN Cổng thanh toán)', 'Cổng thanh toán gửi IPN kèm chữ ký số HMAC-SHA512 trực tiếp về máy chủ; Backend đối chiếu số tiền và cập nhật Transaction SUCCESS, Order PAID. Hết 15 phút không có IPN sẽ kích hoạt worker hoàn tồn kho.'),
  createSizedImage('UML_seq-business-checkout.png', 570, 480),
  figCaption('Hình 2.11', 'Sơ đồ Tuần tự Luồng Đặt hàng và Thanh toán Thương mại Điện tử 2 Pha')
);

// -----------------------------------------------------------------------------
// 2.13. Thiết kế Luồng Ghép đôi Cố vấn & Đặt lịch Jitsi Meet
// -----------------------------------------------------------------------------
children.push(
  h1('2.13. Thiết kế Luồng Nghiệp vụ Động: Ghép đôi Cố vấn và Đặt lịch Jitsi Meet'),
  p('Quy trình kết nối chuyên gia hướng nghiệp và kích hoạt phòng họp trực tuyến:', { firstLine: true }),
  dash('Khớp nối thông minh bằng AI', 'Đối chiếu mục tiêu kỹ năng, kiểu tính cách MBTI của sinh viên với chuyên môn cố vấn.'),
  dash('Cơ chế ký quỹ bảo vệ học sinh', 'Phí tư vấn được giữ ở trạng thái Escrow; nếu cố vấn từ chối hoặc không phản hồi, hệ thống tự động hoàn tiền 100%.'),
  dash('Phòng họp trực tuyến WebRTC', 'Tự động sinh URL phòng họp an toàn: `https://meet.jit.si/edumap-mentor-{uuid}` phục vụ gọi video, chia sẻ màn hình 1-1.'),
  createSizedImage('UML_seq-mentor-booking.png', 570, 480),
  figCaption('Hình 2.12', 'Sơ đồ Tuần tự Luồng Ghép đôi Cố vấn và Đặt lịch Buổi tư vấn Trực tuyến')
);

// -----------------------------------------------------------------------------
// 2.14. Thiết kế Luồng Đánh giá Đủ điều kiện Học bổng
// -----------------------------------------------------------------------------
children.push(
  h1('2.14. Thiết kế Luồng Nghiệp vụ Động: Đánh giá Đủ điều kiện và Nộp hồ sơ Học bổng'),
  p('Hệ thống hỗ trợ sinh viên nhanh chóng sàng lọc cơ hội học bổng và nộp minh chứng điện tử:', { firstLine: true }),
  dash('Chấm điểm tiêu chí tự động', 'So khớp điểm tích lũy GPA, ngành học, hoàn cảnh và khu vực ưu tiên theo thang điểm 100.'),
  dash('Nộp minh chứng lên MinIO S3', 'Sinh viên đủ điều kiện tải hồ sơ trực tiếp lên MinIO S3 qua Presigned URL an toàn và tạo bản ghi ứng tuyển `submitted`.'),
  createSizedImage('UML_seq-scholarship-eligibility.png', 570, 480),
  figCaption('Hình 2.13', 'Sơ đồ Tuần tự Luồng Đánh giá Đủ điều kiện và Nộp hồ sơ Học bổng')
);

// -----------------------------------------------------------------------------
// 2.15. Thiết kế Máy Trạng thái: Vòng đời Đơn hàng & Dịch vụ Số
// -----------------------------------------------------------------------------
children.push(
  h1('2.15. Thiết kế Máy Trạng thái: Vòng đời Đơn hàng và Dịch vụ Số'),
  p('Vòng đời đơn hàng tuân thủ máy trạng thái hữu hạn kiểm soát chuyển dịch chặt chẽ:', { firstLine: true }),
  dash('SHOPPING_CART', 'Giỏ hàng của người dùng, chưa tác động đến số lượng tồn kho.'),
  dash('ORDER_PENDING', 'Đơn hàng được khởi tạo, trừ tồn kho tạm thời, đếm ngược 15 phút chờ thanh toán trực tuyến hoặc xác nhận COD.'),
  dash('ORDER_PAID', 'Nhận IPN thanh toán thành công. Dịch vụ số kích hoạt ngay lập tức sang COMPLETED; sản phẩm vật lý chuyển sang chuẩn bị đóng gói.'),
  dash('ORDER_SHIPPING', 'Giao cho đơn vị vận chuyển 3PL (GHN/GHTK) gắn mã vận đơn theo dõi lộ trình.'),
  dash('ORDER_COMPLETED', 'Giao hàng thành công, giải ngân tiền ký quỹ cho người bán và mở quyền viết đánh giá.'),
  dash('ORDER_CANCELLED', 'Hủy do quá hạn thanh toán, người mua hủy hoặc giao thất bại 3 lần; kích hoạt Saga bù trừ hoàn lại tồn kho.'),
  createSizedImage('UML_state-order-lifecycle.png', 570, 480),
  figCaption('Hình 2.14', 'Sơ đồ Máy Trạng thái Vòng đời Đơn hàng và Kích hoạt Dịch vụ Số')
);

// -----------------------------------------------------------------------------
// 2.16. Thiết kế Máy Trạng thái: Vòng đời Lịch hẹn Cố vấn
// -----------------------------------------------------------------------------
children.push(
  h1('2.16. Thiết kế Máy Trạng thái: Vòng đời Lịch hẹn Cố vấn và Buổi tư vấn 1-1'),
  p('Quản lý trạng thái buổi tư vấn đồng bộ giữa lịch làm việc và dòng tiền ký quỹ:', { firstLine: true }),
  dash('SLOT_BROWSING_&_MATCHING', 'Tìm kiếm chuyên gia và lựa chọn khung giờ rảnh khả dụng.'),
  dash('BOOKING_PENDING', 'Khởi tạo lịch hẹn, sinh URL phòng họp Jitsi, thanh toán học phí vào trạng thái ký quỹ Escrow.'),
  dash('BOOKING_CONFIRMED', 'Cố vấn xác nhận lịch hẹn; hệ thống gửi file lịch (.ics) và lên lịch gửi nhắc nhở T-24h, T-1h, T-10m.'),
  dash('SESSION_IN_PROGRESS', 'Đến giờ hẹn, sinh viên và cố vấn cùng tham gia phòng gọi WebRTC.'),
  dash('BOOKING_COMPLETED', 'Buổi tư vấn kết thúc, giải ngân thù lao cho cố vấn và gửi yêu cầu sinh viên chấm điểm sao.'),
  dash('BOOKING_CANCELLED', 'Hủy hẹn do hết hạn, sinh viên hủy trước 24h hoặc cố vấn từ chối; hệ thống tự động hoàn tiền 100%.'),
  createSizedImage('UML_state-mentor-booking.png', 570, 480),
  figCaption('Hình 2.15', 'Sơ đồ Máy Trạng thái Vòng đời Đặt lịch Cố vấn và Buổi tư vấn Trực tuyến')
);

// -----------------------------------------------------------------------------
// 2.17. Thiết kế Triển khai Hạ tầng Cụm Kubernetes Sản xuất
// -----------------------------------------------------------------------------
children.push(
  h1('2.17. Thiết kế Triển khai Hạ tầng Cụm Kubernetes Sản xuất (edumap-prod)'),
  p('Hạ tầng thực tế được triển khai trên cụm Kubernetes đảm bảo khả năng sẵn sàng cao và tự động co giãn:', { firstLine: true }),
  dash('Ingress & Cân bằng tải', 'Nginx Ingress Controller phân phối lưu lượng và tự động gia hạn chứng chỉ bảo mật SSL Let\'s Encrypt.'),
  dash('Khối Ứng dụng Co giãn Tự động (HPA)', 'Frontend Pods (Next.js), Backend Pods (NestJS) và AI Service Pods (FastAPI) tự động co giãn từ 2 đến 10 bản sao dựa trên ngưỡng CPU > 70%.'),
  dash('Khối Lưu trữ Có trạng thái (StatefulSets & PVC)', 'PostgreSQL 16 PostGIS, Redis Cluster, MinIO S3 và ChromaDB gắn ổ đĩa phân tán Ceph/EBS qua StorageClass `fast-ssd` bảo toàn dữ liệu.'),
  dash('Tích hợp Đám mây Ngoại vi', 'Kết nối bảo mật qua Internet tới Gemini API, VNPay, MoMo, OpenStreetMap và Firebase Cloud Messaging.'),
  createSizedImage('UML_deployment-diagram.png', 570, 480),
  figCaption('Hình 2.16', 'Sơ đồ Triển khai Hạ tầng Cụm Kubernetes Sản xuất')
);

// Cấu hình tài liệu hoàn chỉnh (Không header rườm rà, footer số trang đơn giản)
const doc = new Document({
  styles: {
    default: {
      document: {
        run: {
          font: FONT,
          size: 26, // 13pt chuẩn
          color: COLOR_BLACK,
        },
      },
    },
  },
  sections: [
    {
      properties: {
        page: {
          margin: {
            top: 1134, // 20mm
            bottom: 1134, // 20mm
            left: 1417, // 25mm
            right: 1134, // 20mm
          },
        },
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  children: [PageNumber.CURRENT],
                  font: FONT,
                  size: 22,
                  color: COLOR_BLACK,
                }),
              ],
            }),
          ],
        }),
      },
      children,
    },
  ],
});

console.log('Đang xuất file Word định dạng chuẩn học thuật...');
Packer.toBuffer(doc).then((buffer) => {
  const outPath1 = '/home/ngoctan/Downloads/EduMap/docs/BaoCao_Chuong2_ThietKeHeThong_EduMap.docx';
  const outPath2 = '/home/ngoctan/Downloads/EduMap/docs/uml/BaoCao_Chuong2_ThietKeHeThong_EduMap.docx';

  fs.writeFileSync(outPath1, buffer);
  fs.writeFileSync(outPath2, buffer);

  const stats = fs.statSync(outPath1);
  console.log(`\n======================================================`);
  console.log(`✅ Xuất file Word thành công!`);
  console.log(`👉 File chính: ${outPath1}`);
  console.log(`👉 File sao lưu: ${outPath2}`);
  console.log(`📊 Dung lượng: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`======================================================\n`);
});

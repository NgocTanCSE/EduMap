const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const author_id = '0b1a55ca-e332-49f7-8ad0-6118bcb6199d'; // existing user id
const subjects = ['Toán học', 'Vật lý', 'Hóa học', 'Sinh học', 'Ngữ văn', 'Tiếng Anh', 'Lịch sử', 'Địa lý', 'Tin học', 'Khoa học dữ liệu', 'Trí tuệ nhân tạo', 'Thiết kế đồ họa', 'Marketing', 'Quản trị kinh doanh', 'Kinh tế vĩ mô', 'Lập trình Web', 'Lập trình di động', 'Cơ điện tử', 'Kỹ thuật ô tô'];
const grades = ['Lớp 10', 'Lớp 11', 'Lớp 12', 'Đại học', 'Cao đẳng'];
const types = ['pdf', 'video', 'document'];

const titles = [
  "Cẩm nang toàn tập", "Bí quyết chinh phục", "Hướng dẫn thực hành", "Tài liệu chuyên sâu",
  "Giáo trình cơ bản", "Tuyển tập đề thi", "Bài giảng trực tuyến", "Tài liệu ôn tập",
  "Phương pháp giải nhanh", "Kiến thức trọng tâm", "Bộ tài liệu tham khảo", "Giáo trình nâng cao"
];

const seedSqlPath = path.join(__dirname, '..', 'backend', 'src', 'database', 'seed.sql');

let sqlInserts = '\n-- 100 additional books generated for the library\n';

for (let i = 0; i < 100; i++) {
  const subject = subjects[Math.floor(Math.random() * subjects.length)];
  const grade = grades[Math.floor(Math.random() * grades.length)];
  const type = types[Math.floor(Math.random() * types.length)];
  const titlePrefix = titles[Math.floor(Math.random() * titles.length)];
  
  const title = `${titlePrefix} ${subject} - ${grade} (Tập ${Math.floor(Math.random() * 5) + 1})`;
  const description = `Tài liệu chất lượng cao phục vụ việc học tập và nghiên cứu chuyên môn ngành ${subject} dành cho ${grade}.`;
  
  sqlInserts += `INSERT INTO learning_materials (id, title, description, type, subject, grade, status, author_id) VALUES ('${crypto.randomUUID()}', '${title}', '${description}', '${type}', '${subject}', '${grade}', 'published', '${author_id}');\n`;
}

// read seed.sql
const content = fs.readFileSync(seedSqlPath, 'utf8');

// Insert the books right after the existing books (around line 184)
const lines = content.split('\n');
const insertIndex = lines.findIndex(line => line.includes("INSERT INTO groups")) || lines.length;

lines.splice(insertIndex, 0, sqlInserts);

fs.writeFileSync(seedSqlPath, lines.join('\n'));

console.log("Successfully generated and inserted 100 books to seed.sql");

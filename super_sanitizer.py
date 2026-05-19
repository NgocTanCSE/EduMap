import os
import re

def super_sanitize(directory):
    # Regex để tìm các chuỗi bị hỏng do gạch chéo ngược
    # Ví dụ: 'User \ joined room \' -> 'User joined room'
    # 'Ð? ghi nh?n \ gi? t?nh nguy?n' -> 'Ghi nhận giờ tình nguyện' (nếu có thể)
    
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith(('.ts', '.tsx')):
                path = os.path.join(root, file)
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    original = content
                    
                    # 1. Loại bỏ các dấu gạch chéo ngược lẻ loi trong chuỗi
                    content = re.sub(r"(?<=['\"])(.*?)\\(.*?)(?=['\"])", r"\1 \2", content)
                    
                    # 2. Sửa các lỗi cú pháp log( ... \);
                    content = re.sub(r"log\((.*?)\\ \);", r"log('\1');", content)
                    
                    # 3. Sửa các lỗi import hỏng (../users/ thay vì ../auth/)
                    content = content.replace('../../users/entities/user.entity', '../../auth/entities/user.entity')
                    content = content.replace('../users/entities/user.entity', '../auth/entities/user.entity')
                    
                    # 4. Đặc biệt cho lỗi volunteer service
                    content = re.sub(r"message: (.*?),", r"message: 'Ghi nhận hoạt động',", content)

                    if content != original:
                        with open(path, 'w', encoding='utf-8') as f:
                            f.write(content)
                        print(f"Super Sanitized: {path}")
                except Exception as e:
                    print(f"Error: {path} - {e}")

print("✨ Bắt đầu chiến dịch SIÊU LÀM SẠCH...")
super_sanitize('backend/src')
print("✅ Hoàn tất!")

import os
import re

def sanitize_file(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Sửa các mẫu logger.log hỏng
        content = re.sub(r"logger\.log\(([^'\"]*?)\);", r"logger.log('\1');", content)
        # Sửa các mẫu có dấu gạch chéo ngược ở cuối chuỗi hỏng
        content = re.sub(r": \\\);", r": ');", content)
        # Sửa các mẫu \-\;
        content = re.sub(r" = \\-\\ ;", r" = '';", content)
        # Sửa các mẫu \/\/\,
        content = re.sub(r": \\/\\/\\ ,", r": '',", content)
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    except Exception as e:
        print(f"Error {path}: {e}")
        return False

for root, dirs, files in os.walk('backend/src'):
    for file in files:
        if file.endswith(('.ts', '.tsx')):
            sanitize_file(os.path.join(root, file))

print("Done sanitizing.")

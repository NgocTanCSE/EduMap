import os
import re

def sanitize_code(directory):
    patterns = [
        (r"logger\.log\((.*?)\\ \);", r"logger.log(\1 '');"),
        (r"const objectName = \\-\\ ;", r"const objectName = '';"),
        (r"url: \\/\\/\\ ,", r"url: '',"),
        (r"\{ q: %\\% \}", r"{ q: '' }"),
        (r"\\\s*;", r"'';"), # Fix trailing backslashes before semicolon
    ]
    
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith(('.ts', '.tsx')):
                path = os.path.join(root, file)
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    original = content
                    for pattern, replacement in patterns:
                        content = re.sub(pattern, replacement, content)
                    
                    if content != original:
                        with open(path, 'w', encoding='utf-8') as f:
                            f.write(content)
                        print(f"Sanitized: {path}")
                except Exception as e:
                    print(f"Error sanitizing {path}: {e}")

print("🧼 Bắt đầu làm sạch mã nguồn Backend...")
sanitize_code('backend/src')
print("✅ Làm sạch hoàn tất!")

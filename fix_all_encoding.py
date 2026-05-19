import os

def fix_encoding(directory):
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith(('.tsx', '.ts', '.js', '.md')):
                path = os.path.join(root, file)
                try:
                    with open(path, 'rb') as f:
                        content = f.read()
                    
                    # Thử decode bằng các kiểu phổ biến
                    decoded = None
                    for enc in ['utf-8-sig', 'utf-16', 'utf-16-le', 'utf-16-be', 'latin-1']:
                        try:
                            decoded = content.decode(enc)
                            break
                        except:
                            continue
                    
                    if decoded:
                        with open(path, 'w', encoding='utf-8') as f:
                            f.write(decoded)
                        print(f"Fixed: {path}")
                except Exception as e:
                    print(f"Failed: {path} - {e}")

print("🚀 Bắt đầu sửa lỗi mã hóa toàn bộ dự án...")
fix_encoding('frontend/app')
fix_encoding('backend/src')
fix_encoding('ai-service')
print("✅ Hoàn tất sửa lỗi mã hóa!")

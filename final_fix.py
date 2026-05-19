import os

def check_and_fix(path):
    try:
        with open(path, 'rb') as f:
            raw = f.read()
        
        # Thử decode chuẩn
        try:
            raw.decode('utf-8')
            # Nếu đã là utf-8 chuẩn, chỉ cần đảm bảo không có BOM
            if raw.startswith(b'\xef\xbb\xbf'):
                with open(path, 'wb') as f:
                    f.write(raw[3:])
                return f"Removed BOM from {path}"
            return None # Đã OK
        except UnicodeDecodeError:
            # Nếu lỗi, ép về UTF-8 bằng cách ignore lỗi hoặc dùng latin-1 làm trung gian
            content = raw.decode('latin-1')
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
            return f"FORCED UTF-8: {path}"
    except Exception as e:
        return f"ERROR: {path} - {e}"

targets = ['frontend', 'backend', 'ai-service']
for target in targets:
    print(f"--- Scanning {target} ---")
    for root, dirs, files in os.walk(target):
        for file in files:
            if file.endswith(('.tsx', '.ts', '.js', '.md', '.json', '.css')):
                full_path = os.path.join(root, file)
                res = check_and_fix(full_path)
                if res:
                    print(res)

print("🚀 Sửa lỗi hoàn tất. Đang dọn dẹp Docker Cache...")

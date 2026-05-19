import os

def force_utf8(directory):
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith(('.tsx', '.ts', '.js', '.md', '.json', '.css')):
                path = os.path.join(root, file)
                try:
                    # Đọc nhị phân
                    with open(path, 'rb') as f:
                        data = f.read()
                    
                    # Loại bỏ các loại BOM phổ biến
                    if data.startswith(b'\xef\xbb\xbf'): # UTF-8 BOM
                        data = data[3:]
                    elif data.startswith(b'\xff\xfe'): # UTF-16 LE
                        data = data.decode('utf-16').encode('utf-8')
                    elif data.startswith(b'\xfe\xff'): # UTF-16 BE
                        data = data.decode('utf-16-be').encode('utf-8')
                    else:
                        # Thử decode xem có lỗi không, nếu có thì ép lại
                        try:
                            data.decode('utf-8')
                        except UnicodeDecodeError:
                            # Nếu lỗi, thử decode latin-1 (thường là trường hợp của file hỏng) rồi encode lại
                            data = data.decode('latin-1').encode('utf-8')
                    
                    with open(path, 'wb') as f:
                        f.write(data)
                    print(f"Aggressive Fix: {path}")
                except Exception as e:
                    print(f"Failed Aggressive Fix: {path} - {e}")

print("🔥 Bắt đầu chiến dịch QUÉT SẠCH lỗi mã hóa toàn dự án...")
force_utf8('frontend')
force_utf8('backend')
force_utf8('ai-service')
print("✅ Chiến dịch hoàn tất!")

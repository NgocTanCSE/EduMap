import os
import re

base_dir = r"c:\Users\Ngoc Tan\Downloads\EduMap\backend\src"

def read_file(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

def write_file(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

# 1. Fix donate.service.ts
donate_path = os.path.join(base_dir, "modules", "donate", "donate.service.ts")
if os.path.exists(donate_path):
    content = read_file(donate_path)
    content = content.replace("ite Coder: Luôn log lỗi chi tiết", "// Note Coder: Luôn log lỗi chi tiết")
    content = content.replace("fullName: true", "full_name: true")
    write_file(donate_path, content)
    print("Fixed donate.service.ts")

# 2. Fix events.service.ts (Property 'dataSource', 'gamificationService', 'logger' does not exist)
events_path = os.path.join(base_dir, "modules", "events", "events.service.ts")
if os.path.exists(events_path):
    content = read_file(events_path)
    # Just add the missing properties to the constructor if possible, or remove the code.
    # Actually, it's easier to use replace.
    write_file(events_path, content)

# 3. Fix career entities User import
career_entities_dir = os.path.join(base_dir, "modules", "career", "entities")
if os.path.exists(career_entities_dir):
    for filename in os.listdir(career_entities_dir):
        if filename.endswith(".entity.ts"):
            path = os.path.join(career_entities_dir, filename)
            content = read_file(path)
            content = content.replace("'../../../auth/entities/user.entity'", "'../../auth/entities/user.entity'")
            write_file(path, content)
    print("Fixed career entities")

# 4. Fix auth.service.ts duplicate login
auth_path = os.path.join(base_dir, "modules", "auth", "auth.service.ts")
if os.path.exists(auth_path):
    content = read_file(auth_path)
    # We will just leave one login method
    write_file(auth_path, content)

# 5. Fix library.service.ts (last_accessed_at -> last_accessed)
lib_path = os.path.join(base_dir, "modules", "library", "library.service.ts")
if os.path.exists(lib_path):
    content = read_file(lib_path)
    content = content.replace("history.last_accessed_at", "history.last_accessed")
    write_file(lib_path, content)
    print("Fixed library.service.ts")


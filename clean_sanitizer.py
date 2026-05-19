import os
import re

def super_sanitize(directory):
    patterns = [
        # Fix logger strings
        (r"logger\.log\(([^'\"]*?)\\ \);", r"logger.log('\1');"),
        # Fix broken backslashes in strings
        (r"(?<=['\"])(.*?)\\(.*?)(?=['\"])", r"\1 \2"),
        # Fix missing imports
        (r"../../users/entities/user.entity", r"../../auth/entities/user.entity"),
        (r"../users/entities/user.entity", r"../auth/entities/user.entity"),
        # Fix corrupted property names or patterns
        (r"\{ q: %\\% \}", r"{ q: '' }"),
        (r"otify:\\", r"notify:"),
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
                        with open(path, 'wb') as f:
                            f.write(content.encode('utf-8'))
                        print(f"Fixed: {path}")
                except Exception as e:
                    pass

print("Starting Sanitization...")
super_sanitize('backend/src')
print("Finished Sanitization.")

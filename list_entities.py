import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

entity_files = []
for root, dirs, files in os.walk("backend/src/modules"):
    for file in files:
        if file.endswith(".entity.ts"):
            entity_files.append(os.path.join(root, file))

print(f"Total entity files found: {len(entity_files)}")
for f in sorted(entity_files):
    print("-", f)

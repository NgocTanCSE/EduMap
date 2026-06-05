import os
import glob

components_dir = r"c:\Users\Ngoc Tan\Downloads\EduMap\frontend\components\ui"

for root, _, files in os.walk(components_dir):
    for file in files:
        if file.endswith(".tsx") or file.endswith(".ts"):
            filepath = os.path.join(root, file)
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()
            
            new_content = content.replace("@/lib/utils", "../../lib/utils")
            
            if content != new_content:
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(new_content)
                print(f"Fixed {filepath}")

# Fix Skeleton case
dashboard_page = r"c:\Users\Ngoc Tan\Downloads\EduMap\frontend\app\dashboard\page.tsx"
with open(dashboard_page, "r", encoding="utf-8") as f:
    content = f.read()
new_content = content.replace("@/components/ui/Skeleton", "@/components/ui/skeleton")
if content != new_content:
    with open(dashboard_page, "w", encoding="utf-8") as f:
        f.write(new_content)
    print(f"Fixed {dashboard_page}")


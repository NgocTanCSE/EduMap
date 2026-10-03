import os
import glob

app_dir = r"c:\Users\Ngoc Tan\Downloads\EduMap\frontend\app"

for root, _, files in os.walk(app_dir):
    for file in files:
        if file.endswith(".tsx") or file.endswith(".ts"):
            filepath = os.path.join(root, file)
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()
            
            new_content = content.replace("@/src/components/", "@/components/")
            new_content = new_content.replace("../../../../src/types/", "@/src/types/")
            new_content = new_content.replace("../../../src/types/", "@/src/types/")
            new_content = new_content.replace("../../src/types/", "@/src/types/")
            
            if content != new_content:
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(new_content)
                print(f"Fixed {filepath}")

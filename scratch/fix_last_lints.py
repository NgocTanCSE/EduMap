import os

# Fix Settings in profile/page.tsx
p1 = r"c:\Users\Ngoc Tan\Downloads\EduMap\frontend\app\profile\page.tsx"
with open(p1, "r", encoding="utf-8") as f:
    c1 = f.read()
if "Settings" not in c1.split("from 'lucide-react'")[0]:
    c1 = c1.replace("import {", "import { Settings,")
with open(p1, "w", encoding="utf-8") as f:
    f.write(c1)

# Fix getToken in FileUpload.tsx
p2 = r"c:\Users\Ngoc Tan\Downloads\EduMap\frontend\src\components\ui\FileUpload.tsx"
with open(p2, "r", encoding="utf-8") as f:
    c2 = f.read()
c2 = c2.replace("authService.getToken()", "authService.getAccessToken()")
with open(p2, "w", encoding="utf-8") as f:
    f.write(c2)

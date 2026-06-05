import os

# Fix ai-chat/page.tsx (another getToken)
path = r"c:\Users\Ngoc Tan\Downloads\EduMap\frontend\app\ai-chat\page.tsx"
with open(path, "r", encoding="utf-8") as f:
    c = f.read()
c = c.replace("authService.getToken()", "authService.getAccessToken()")
with open(path, "w", encoding="utf-8") as f:
    f.write(c)

# Fix dashboard/page.tsx (UserCircle and Target)
path2 = r"c:\Users\Ngoc Tan\Downloads\EduMap\frontend\app\dashboard\page.tsx"
with open(path2, "r", encoding="utf-8") as f:
    c2 = f.read()

# Add Target to lucide-react import
if "Target" not in c2.split("from 'lucide-react'")[0]:
    c2 = c2.replace("UserCircle", "UserCircle, Target")

with open(path2, "w", encoding="utf-8") as f:
    f.write(c2)

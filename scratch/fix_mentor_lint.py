import os
import subprocess

# Fix Sparkles import in mentor/page.tsx
path = r"c:\Users\Ngoc Tan\Downloads\EduMap\frontend\app\mentor\page.tsx"
with open(path, "r", encoding="utf-8") as f:
    c = f.read()

if "Sparkles" not in c.split("from 'lucide-react'")[0]:
    c = c.replace("Calendar,", "Calendar, Sparkles,")

with open(path, "w", encoding="utf-8") as f:
    f.write(c)

print("Fixed Sparkles in mentor/page.tsx")

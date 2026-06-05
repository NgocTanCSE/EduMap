import os

path = r"c:\Users\Ngoc Tan\Downloads\EduMap\frontend\app\marketplace\cart\page.tsx"
with open(path, "r", encoding="utf-8") as f:
    c = f.read()

# Add GraduationCap to lucide-react import
if "GraduationCap" not in c.split("from 'lucide-react'")[0]:
    c = c.replace("ShoppingCart,", "ShoppingCart, GraduationCap,")

with open(path, "w", encoding="utf-8") as f:
    f.write(c)

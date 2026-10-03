import os

path = r"c:\Users\Ngoc Tan\Downloads\EduMap\frontend\app\career\predictive\page.tsx"
with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    new_lines.append(line)
    if line.strip() == "}":
        # Check if the next line is 198
        if i >= 190 and "export default" not in "".join(lines[i:]):
            break

with open(path, "w", encoding="utf-8") as f:
    f.writelines(new_lines)

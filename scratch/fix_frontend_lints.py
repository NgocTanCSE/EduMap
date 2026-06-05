import os

# Fix Target import in library/page.tsx
lib_path = r"c:\Users\Ngoc Tan\Downloads\EduMap\frontend\app\library\page.tsx"
with open(lib_path, "r", encoding="utf-8") as f:
    lib_content = f.read()

if "Target" not in lib_content.split("import {")[1].split("}")[0]:
    lib_content = lib_content.replace("import { \n  Search", "import { \n  Search, Target")
    with open(lib_path, "w", encoding="utf-8") as f:
        f.write(lib_content)

# Fix predictive/page.tsx by truncating after the final closing brace of the component
pred_path = r"c:\Users\Ngoc Tan\Downloads\EduMap\frontend\app\career\predictive\page.tsx"
with open(pred_path, "r", encoding="utf-8") as f:
    pred_lines = f.readlines()

new_pred_lines = []
for i, line in enumerate(pred_lines):
    new_pred_lines.append(line)
    if line.strip() == "}":
        # Check if the next line is 198
        if i >= 190 and "export default" not in "".join(pred_lines[i:]):
            break

with open(pred_path, "w", encoding="utf-8") as f:
    f.writelines(new_pred_lines)

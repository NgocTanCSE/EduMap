import openpyxl
import sys

try:
    wb = openpyxl.load_workbook('EduMap_Documentation.xlsx')
    
    # Dump Sheet 3 (4. Vai Trò & Phân Quyền)
    s3 = wb['4. Vai Trò & Phân Quyền']
    with open('sheet3_roles_dump.txt', 'w', encoding='utf-8') as f:
        for r in range(1, s3.max_row + 1):
            row_vals = [cell.value for cell in s3[r]]
            f.write(" | ".join([str(val) if val is not None else "" for val in row_vals]) + "\n")
            
    print("Dump created successfully!")
except Exception as e:
    print("Error:", str(e))

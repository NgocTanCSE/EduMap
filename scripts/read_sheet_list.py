import openpyxl
import os

os.makedirs('scratch', exist_ok=True)
wb = openpyxl.load_workbook('EduMap_Documentation.xlsx')
with open('scratch/sheets.txt', 'w', encoding='utf-8') as f:
    for name in wb.sheetnames:
        f.write(name + '\n')
print("Done writing sheet names!")

import openpyxl
import sys

# Reconfigure stdout to use utf-8 to prevent encoding crashes with Vietnamese characters
sys.stdout.reconfigure(encoding='utf-8')

try:
    wb = openpyxl.load_workbook('EduMap_Documentation.xlsx')
    for index, name in enumerate(wb.sheetnames):
        print(f"\nSheet {index}: {name}")
        sheet = wb[name]
        # Print the first row (headers)
        headers = [cell.value for cell in sheet[1]]
        print("Headers:", headers)
except Exception as e:
    print("Error:", str(e))

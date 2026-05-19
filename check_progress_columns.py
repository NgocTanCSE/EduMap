import openpyxl
import sys

sys.stdout.reconfigure(encoding='utf-8')

try:
    wb = openpyxl.load_workbook('EduMap_Documentation.xlsx')
    for name in wb.sheetnames:
        sheet = wb[name]
        headers = [cell.value for cell in sheet[1]]
        # Print if there is progress, completeness, or percentage columns
        for index, h in enumerate(headers):
            if h and any(kw in str(h).lower() for kw in ['hoàn thiện', 'trạng thái', 'percent', 'status', 'progress', '%']):
                print(f"Match in Sheet: {name} | Column: {h}")
except Exception as e:
    print("Error:", str(e))

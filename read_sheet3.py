import pandas as pd
import sys

# Reconfigure stdout to use utf-8 to prevent encoding crashes with Vietnamese characters
sys.stdout.reconfigure(encoding='utf-8')

try:
    xl = pd.ExcelFile('EduMap_Documentation.xlsx')
    print("Sheet names:", xl.sheet_names)
    
    # Let's read Sheet 3 (either index 2, or the 3rd sheet)
    sheet_name = xl.sheet_names[2]
    print(f"\n--- Reading Sheet: {sheet_name} ---")
    df = xl.parse(sheet_name)
    print(df.to_string())
except Exception as e:
    print("Error:", str(e))

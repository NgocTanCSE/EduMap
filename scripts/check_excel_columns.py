import pandas as pd

EXCEL_FILE_PATH = 'EduMap_Documentation.xlsx'
SHEETS = ['2. Danh Sách Module', '3. Chi Tiết Chức Năng', '4. Vai Trò & Phân Quyền']

def check_headers():
    for sheet in SHEETS:
        try:
            df = pd.read_excel(EXCEL_FILE_PATH, sheet_name=sheet, nrows=0)
            print(f"\n--- Headers for sheet: '{sheet}' ---")
            print(df.columns.tolist())
        except Exception as e:
            print(f"Could not read sheet '{sheet}': {e}")

if __name__ == "__main__":
    check_headers()

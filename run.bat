@echo off
python -m venv .venv
call .venv\Scripts\activate.bat
pip install pandas openpyxl >nul 2>&1
python read_excel.py
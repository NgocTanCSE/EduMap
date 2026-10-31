@echo off
title EduMap Frontend Starter
echo ========================================================
echo         CHAO MUNG DEN VOI EDUMAP FRONTEND
echo ========================================================
echo.

if not exist node_modules (
    echo [INFO] Dang cai dat thu vien dependencies (chi can lam lan dau)...
    call npm install
    if errorlevel 1 (
        echo [ERROR] Cai dat dependencies that bai. Vui long kiem tra lai Node.js.
        pause
        exit /b 1
    )
)

echo.
echo [INFO] Dang khoi dong EduMap Frontend tai http://localhost:3000 ...
echo [INFO] Nhan Ctrl+C de dung ung dung.
echo.
call npm run dev -- -p 3000
pause


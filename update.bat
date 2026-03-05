@echo off
echo ═══════════════════════════════════════
echo   T1 Tax Data — Update ^& Deploy
echo ═══════════════════════════════════════

echo.
echo [1/4] Converting T1 CSV data...
node convert-data.js
if errorlevel 1 (
    echo ERROR: T1 data conversion failed!
    pause
    exit /b 1
)

echo.
echo [2/4] Fetching Gov't Expenditure data from Open Canada API...
node update-govexp-data.js
if errorlevel 1 (
    echo ERROR: Gov't Expenses data fetch failed! Check internet connection.
    pause
    exit /b 1
)

echo.
echo [3/4] Staging files...
git add -A

echo.
echo [4/4] Committing and pushing to GitHub...
git commit -m "Update data %date%"
git push origin main

echo.
echo Done! Dashboard updated and deployed.
pause

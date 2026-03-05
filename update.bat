@echo off
echo ═══════════════════════════════════════
echo   T1 Tax Data — Update ^& Deploy
echo ═══════════════════════════════════════

echo.
echo [1/3] Converting CSV data...
node convert-data.js
if errorlevel 1 (
    echo ERROR: Data conversion failed!
    pause
    exit /b 1
)

echo.
echo [2/3] Staging files...
git add -A

echo.
echo [3/3] Committing and pushing to GitHub...
git commit -m "Update T1 tax data %date%"
git push origin main

echo.
echo ✓ Done! Dashboard updated and deployed.
pause

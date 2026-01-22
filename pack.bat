@echo off
chcp 65001 >nul
echo ============================================
echo VSCode MDTODO Plugin Package Script
echo ============================================
echo.

cd /d "%~dp0"
setlocal

echo [1/3] Building project...
echo.
call npm.cmd run compile
if errorlevel 1 (
    echo ERROR: Build failed!
    exit /b 1
)
echo Build completed.
echo.

echo [2/3] Packaging VSIX...
echo.
call npx vsce package --allow-missing-repository
if errorlevel 1 (
    echo ERROR: Packaging failed!
    exit /b 1
)
echo Packaging completed.
echo.

echo [3/3] Done!
echo.
echo The VSIX file has been created in the current directory.
echo You can install it via:
echo   code --install-extension vscode-mdtodo-0.0.2.vsix
echo.
echo Or install manually in VSCode:
echo   1. Press Ctrl+Shift+P
echo   2. Type "Extensions: Install from VSIX"
echo   3. Select the generated .vsix file
echo.

endlocal
pause

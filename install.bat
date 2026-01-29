@echo off
chcp 437 >nul
echo ============================================
echo   MDTODO VSCode Extension Install Script
echo ============================================
echo.

cd /d "%~dp0"

echo [1/5] Installing dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: npm install failed!
    exit /b 1
)
echo Done.

echo [2/5] Building project...
call npm.cmd run compile
if errorlevel 1 (
    echo ERROR: Build failed!
    exit /b 1
)
echo Done.

echo [3/5] Packaging VSIX...
call npx vsce package --allow-missing-repository
if errorlevel 1 (
    echo ERROR: Packaging failed!
    exit /b 1
)
echo Done.

set "VSIX_FILE=vscode-mdtodo-0.0.2.vsix"
if not exist "%VSIX_FILE%" (
    echo ERROR: %VSIX_FILE% not found!
    exit /b 1
)
echo VSIX file generated: %VSIX_FILE%
echo.

echo [4/5] Uninstalling old version (if exists)...
echo.
call code --uninstall-extension mdtodo.vscode-mdtodo --force || echo No previous version to uninstall.
echo.
echo Done.

echo [5/5] Installing new version...
call code --install-extension "%VSIX_FILE%" --force

if not errorlevel 0 (
    echo WARNING: Could not auto-install to VSCode.
    echo Please install manually:
    echo   1. Open VSCode
    echo   2. Press Ctrl+Shift+X
    echo   3. Click "..." menu
    echo   4. Select "Install from VSIX"
    echo   5. Select: %VSIX_FILE%
    echo.
    set "MANUAL=1"
)

echo.
echo ============================================
echo   Build Complete!
echo ============================================
echo.
echo VSIX file: %VSIX_FILE%
echo.

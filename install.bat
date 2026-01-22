@echo off
chcp 65001 >nul
echo ============================================
echo VSCode MDTODO Plugin Install Script
echo ============================================
echo.

cd /d "%~dp0"
setlocal

echo [1/4] Building project...
echo.
call npm.cmd run compile
if errorlevel 1 (
    echo ERROR: Build failed!
    exit /b 1
)
echo Build completed.
echo.

echo [2/4] Packaging VSIX...
echo.
call npx vsce package --allow-missing-repository
if errorlevel 1 (
    echo ERROR: Packaging failed!
    exit /b 1
)
echo Packaging completed.
echo.

set VSIX_FILE=vscode-mdtodo-0.0.2.vsix

if not exist "%VSIX_FILE%" (
    echo ERROR: %VSIX_FILE% not found after packaging!
    exit /b 1
)
echo VSIX file generated: %VSIX_FILE%
echo.

echo [3/4] Uninstalling old version (if exists)...
echo.
call code --uninstall-extension mdtodo.vscode-mdtodo --force 2>nul || echo No previous version to uninstall.
echo.

echo [4/4] Installing extension...
echo.
call code --install-extension "%VSIX_FILE%" --force
if errorlevel 1 (
    echo ERROR: Installation failed!
    echo Please make sure VSCode is installed and 'code' command is available.
    echo You can add VSCode to PATH by:
    echo   1. Open VSCode
    echo   2. Press Ctrl+Shift+P
    echo   3. Type "Shell Command: Install 'code' command in PATH"
    exit /b 1
)
echo Installation completed.
echo.

echo ============================================
echo Install Complete!
echo ============================================
echo.
echo The MDTODO plugin has been built and installed successfully!
echo.
echo To verify the installation:
echo   1. Open VSCode
echo   2. Press Ctrl+Shift+X to open Extensions panel
echo   3. Search for "MDTODO" to confirm it's installed
echo.
echo To use the plugin:
echo   1. Open a .md file
echo   2. Press Ctrl+Shift+P
echo   3. Type "MDTODO: Open" to launch the plugin
echo.

endlocal
pause

@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo.
echo   野球人生：スマホで遊ぶためのサーバーを動かしています。
echo.
echo   パソコンなら http://localhost:8010 を開いてください。
echo   スマホは同じ Wi-Fi につないで、次のアドレスを開いてください。
echo.
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do for /f "tokens=*" %%b in ("%%a") do echo       http://%%b:8010
echo.
echo   やめるときは、この黒い画面を閉じてください。
echo.
python -m http.server 8010 --bind 0.0.0.0
pause

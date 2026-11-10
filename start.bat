@echo off
rem Moje Zoo: uruchamia serwer gry (jesli jeszcze nie dziala) i otwiera gre w przegladarce.
cd /d "%~dp0"
netstat -ano | findstr /r /c:":8765 .*LISTENING" >nul
if errorlevel 1 (
  start "Moje Zoo - serwer" /min python -m http.server 8765 --bind 127.0.0.1
  timeout /t 2 /nobreak >nul
)
start "" http://localhost:8765/

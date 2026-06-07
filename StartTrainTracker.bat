@echo off
color 0A
title Train Tracker Server

echo =======================================================
echo          TRAIN TRACKER SERVER IS ONLINE
echo =======================================================
echo.
echo  Your PERMANENT URL (type this on your phone):
echo  https://nonremediably-ennuyant-jordan.ngrok-free.dev
echo.
echo  This URL NEVER changes! Save it on your phone.
echo =======================================================
echo.

:: Start ngrok tunnel with static domain in a new window
start "Ngrok Tunnel" cmd /k "title Ngrok Tunnel && A:\Dev\Tools\ngrok.exe http --url=nonremediably-ennuyant-jordan.ngrok-free.dev 8080"

:: Give the tunnel a moment to start
timeout /t 3 /nobreak >nul

echo Leave this window open. Press CTRL+C to stop.
echo.

:: Start the Node.js backend in THIS main window
node index.js
pause

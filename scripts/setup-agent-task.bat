@echo off
REM Sets up a Windows Scheduled Task to run the SoundSense agent every 6 hours.
REM Run this script once as Administrator.

set TASK_NAME=SoundSense-Agent
set GIT_BASH="C:\Program Files\Git\bin\bash.exe"
set SCRIPT_PATH=C:\Users\Daniel\Projects\SoundSense\scripts\agent-run.sh

REM Delete existing task if it exists
schtasks /delete /tn "%TASK_NAME%" /f 2>nul

REM Create scheduled task — runs every 6 hours
schtasks /create ^
  /tn "%TASK_NAME%" ^
  /tr "%GIT_BASH% --login -c '%SCRIPT_PATH%'" ^
  /sc HOURLY ^
  /mo 6 ^
  /st 00:00 ^
  /ru "%USERNAME%" ^
  /rl HIGHEST ^
  /f

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✓ Scheduled task "%TASK_NAME%" created successfully.
    echo   Runs every 6 hours starting at midnight.
    echo.
    echo   To run it now:     schtasks /run /tn "%TASK_NAME%"
    echo   To check status:   schtasks /query /tn "%TASK_NAME%"
    echo   To delete it:      schtasks /delete /tn "%TASK_NAME%" /f
    echo   To change freq:    Edit this file and re-run
) else (
    echo.
    echo ✗ Failed to create task. Try running as Administrator.
)

pause

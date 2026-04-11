@echo off
cd /d "D:\zhishi-plant-system\backend"
node scripts/auto-fill-hybrid-chinese-names.js > auto-fill-output.log 2>&1
type auto-fill-output.log
pause

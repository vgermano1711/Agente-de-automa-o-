@echo off
cd /d "C:\Users\vgerm\sales-automation"
pm2 start ecosystem.config.js
pm2 save

# PM2 startup script — executado pelo Task Scheduler no boot do Windows
# Aguarda a rede estar disponível antes de iniciar

Start-Sleep -Seconds 15

$env:PATH = "C:\Program Files\nodejs;$env:PATH;$env:APPDATA\npm"
$env:HOME = $env:USERPROFILE

Set-Location "C:\Users\vgerm\sales-automation"
& pm2 resurrect

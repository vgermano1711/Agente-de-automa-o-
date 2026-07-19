##############################################################################
# auto-start-windows.ps1
# Registra o Sales Bot para iniciar automaticamente no Windows.
# Execute UMA VEZ como Administrador:
#   powershell -ExecutionPolicy Bypass -File auto-start-windows.ps1
##############################################################################

$ErrorActionPreference = 'Stop'

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$batPath    = Join-Path $projectDir 'pm2-startup.bat'

Write-Host "`n=== Sales Bot — Auto-Start Setup ===" -ForegroundColor Cyan

# ── 1. Garantir que PM2 está salvo ─────────────────────────────────────────
Write-Host "`n[1/3] Salvando estado atual do PM2..." -ForegroundColor Yellow
try {
    & npm run pm2:start 2>&1 | Out-Null
} catch {}
& pm2 save --force 2>&1 | Out-Null
Write-Host "      OK" -ForegroundColor Green

# ── 2. Criar tarefa no Agendador de Tarefas do Windows ─────────────────────
Write-Host "[2/3] Registrando no Agendador de Tarefas do Windows..." -ForegroundColor Yellow

$taskName   = "SalesBot-AutoStart"
$action     = New-ScheduledTaskAction -Execute $batPath -WorkingDirectory $projectDir
$trigger    = New-ScheduledTaskTrigger -AtLogOn
$settings   = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Hours 0) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -StartWhenAvailable

# Remove tarefa antiga se existir
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

Register-ScheduledTask `
    -TaskName    $taskName `
    -Action      $action `
    -Trigger     $trigger `
    -Settings    $settings `
    -RunLevel    Highest `
    -Force | Out-Null

Write-Host "      Tarefa '$taskName' criada com sucesso" -ForegroundColor Green

# ── 3. Mostrar URL de acesso ────────────────────────────────────────────────
Write-Host "[3/3] Verificando URL de acesso mobile..." -ForegroundColor Yellow

$tunnelFile = Join-Path $projectDir 'tunnel_url.txt'
$envFile    = Join-Path $projectDir '.env'

$tunnelUrl = $null

# Tenta ler do arquivo salvo pelo ngrok
if (Test-Path $tunnelFile) {
    $tunnelUrl = (Get-Content $tunnelFile -Raw).Trim()
}

# Tenta ler NGROK_DOMAIN do .env
if (-not $tunnelUrl -and (Test-Path $envFile)) {
    $domain = (Get-Content $envFile | Where-Object { $_ -match '^NGROK_DOMAIN=' }) -replace '^NGROK_DOMAIN=', ''
    if ($domain) { $tunnelUrl = "https://$domain" }
}

if ($tunnelUrl) {
    Write-Host "`n╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║  SEU LINK FIXO DE ACESSO MOBILE:                     ║" -ForegroundColor Cyan
    Write-Host "║  $tunnelUrl" -ForegroundColor White
    Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host "  Salve este link — ele nunca muda!" -ForegroundColor Green
} else {
    Write-Host "      NGROK_DOMAIN nao encontrado no .env" -ForegroundColor Yellow
    Write-Host "      Configure um dominio fixo gratuito em: https://dashboard.ngrok.com/domains" -ForegroundColor Yellow
    Write-Host "      Depois adicione ao .env:" -ForegroundColor Yellow
    Write-Host "        NGROK_AUTHTOKEN=seu_token" -ForegroundColor Gray
    Write-Host "        NGROK_DOMAIN=seu-dominio.ngrok-free.app" -ForegroundColor Gray
}

Write-Host "`n=== Pronto! ===" -ForegroundColor Green
Write-Host "O servidor vai iniciar automaticamente toda vez que o Windows ligar." -ForegroundColor White
Write-Host "Nao precisa mais abrir terminal.`n" -ForegroundColor White

/**
 * Cloudflare Quick Tunnel — expõe localhost:3000 via HTTPS.
 * Auto-restart quando a conexão cai (URLs expiram após ~8h).
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const TUNNEL_URL_FILE = path.join(__dirname, 'tunnel_url.txt');
const PORT = process.env.PORT || 3000;
const MAX_ERRORS_BEFORE_KILL = 8;  // mata e reinicia após N erros consecutivos
const ERROR_RESET_INTERVAL = 60000; // reset contador após 60s sem erro

const CF_PATH = process.env.LOCALAPPDATA +
  '\\Microsoft\\WinGet\\Packages\\Cloudflare.cloudflared_Microsoft.Winget.Source_8wekyb3d8bbwe\\cloudflared.exe';

function startTunnel() {
  let errorCount = 0;
  let errorTimer = null;

  console.log(`[TUNNEL] Iniciando → localhost:${PORT}`);

  const proc = spawn(CF_PATH, ['tunnel', '--url', `http://localhost:${PORT}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  function resetErrorTimer() {
    clearTimeout(errorTimer);
    errorTimer = setTimeout(() => { errorCount = 0; }, ERROR_RESET_INTERVAL);
  }

  function handleOutput(data) {
    const text = data.toString();
    process.stdout.write(text);

    // Captura URL nova
    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (match) {
      const url = match[0];
      console.log('\n╔══════════════════════════════════════════════════════════╗');
      console.log(`║  LINK MOBILE: ${url}`);
      console.log('╚══════════════════════════════════════════════════════════╝\n');
      try { fs.writeFileSync(TUNNEL_URL_FILE, url); } catch {}
      errorCount = 0;
    }

    // Detecta erros de "control stream" (tunnel expirado)
    if (text.includes('control stream encountered') || text.includes('failed to serve tunnel')) {
      errorCount++;
      resetErrorTimer();
      if (errorCount >= MAX_ERRORS_BEFORE_KILL) {
        console.log(`[TUNNEL] ${errorCount} erros consecutivos — reiniciando tunnel para obter nova URL...`);
        try { fs.unlinkSync(TUNNEL_URL_FILE); } catch {}
        proc.kill('SIGKILL');
      }
    }
  }

  proc.stdout.on('data', handleOutput);
  proc.stderr.on('data', handleOutput);

  proc.on('exit', (code) => {
    clearTimeout(errorTimer);
    console.log(`[TUNNEL] Processo encerrado (código ${code}) — PM2 reiniciará em breve`);
    process.exit(1); // PM2 reinicia start-tunnel.js → nova URL
  });

  process.on('SIGTERM', () => { proc.kill(); });
  process.on('SIGINT',  () => { proc.kill(); });
}

if (!fs.existsSync(CF_PATH)) {
  console.error('[TUNNEL] cloudflared não encontrado em:', CF_PATH);
  process.exit(1);
}

startTunnel();

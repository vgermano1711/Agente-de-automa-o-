/**
 * connect-whatsapp.js
 * Standalone WhatsApp QR connector — plain Node.js, zero TypeScript.
 * Usage: node connect-whatsapp.js
 * Then open http://localhost:3002 in your browser.
 */

'use strict';

const http = require('http');
const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 3002;
const AUTH_DIR = path.join(__dirname, '.wwebjs_auth');
const LOCK_FILE = path.join(AUTH_DIR, 'session', 'lockfile');

// ── 1. Kill orphaned Puppeteer Chrome processes ──────────────────────────────
function killPuppeteerChrome() {
  try {
    const lines = execSync(
      'wmic process where "name=\'chrome.exe\'" get ProcessId,CommandLine /format:csv 2>nul',
      { encoding: 'utf-8', timeout: 10000 }
    ).split('\n');

    lines.forEach((line) => {
      if (line.includes('.cache') && line.includes('puppeteer')) {
        const parts = line.split(',');
        const pid = parts[parts.length - 1]?.trim();
        if (pid && /^\d+$/.test(pid)) {
          try { execSync(`taskkill /PID ${pid} /F`); console.log(`Killed puppeteer PID ${pid}`); } catch {}
        }
      }
    });
  } catch {
    // wmic not available or no processes — ignore
  }
}

// ── 2. Remove stale lockfile ─────────────────────────────────────────────────
function removeLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      fs.unlinkSync(LOCK_FILE);
      console.log('Lockfile removido.');
    }
  } catch (e) {
    console.warn('Não foi possível remover lockfile:', e.message);
  }
}

// ── 3. State ─────────────────────────────────────────────────────────────────
let state = 'waiting'; // waiting | qr_ready | connected | error
let qrDataUrl = null;
let errorMsg = null;

// ── 4. HTTP Server ────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  if (req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ state, qrDataUrl, error: errorMsg }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(HTML_PAGE);
});

server.listen(PORT, () => {
  console.log(`\n✅ Painel aberto: http://localhost:${PORT}`);

  // Open browser on Windows
  if (process.platform === 'win32') {
    setTimeout(() => exec(`start http://localhost:${PORT}`), 1200);
  }

  // Start WhatsApp client AFTER server is listening
  startWhatsApp();
});

// ── 5. WhatsApp Client ────────────────────────────────────────────────────────
async function startWhatsApp() {
  let { Client, LocalAuth } = require('whatsapp-web.js');
  let QRCode;
  try {
    QRCode = require('qrcode');
  } catch {
    console.error('ERRO: pacote "qrcode" não instalado. Rode: npm install qrcode');
    state = 'error';
    errorMsg = 'Pacote qrcode não instalado. Rode: npm install qrcode';
    return;
  }

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: AUTH_DIR }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    },
  });

  client.on('qr', async (qr) => {
    try {
      qrDataUrl = await QRCode.toDataURL(qr, { width: 280, margin: 2, errorCorrectionLevel: 'M' });
      state = 'qr_ready';
      console.log('\n📱 QR Code pronto! Abra http://localhost:' + PORT + ' e escaneie.');
    } catch (e) {
      console.error('Erro ao gerar QR Data URL:', e.message);
    }
  });

  client.on('loading_screen', (percent) => {
    if (percent === 0) state = 'waiting';
  });

  client.on('authenticated', () => {
    console.log('Autenticado! Aguardando sincronização...');
    state = 'waiting';
    qrDataUrl = null;
  });

  client.on('ready', () => {
    state = 'connected';
    qrDataUrl = null;
    console.log('\n✅ WhatsApp conectado! Sessão salva em .wwebjs_auth/');
    console.log('Pode fechar este terminal. O sistema reconecta automaticamente.');
    // Keep server alive so browser can show the success screen
  });

  client.on('auth_failure', (msg) => {
    state = 'error';
    errorMsg = 'Falha na autenticação: ' + msg;
    console.error(errorMsg);
  });

  client.on('disconnected', () => {
    console.warn('Desconectado.');
    state = 'waiting';
  });

  console.log('\nInicializando WhatsApp Web (pode levar 20-40 segundos)...');
  try {
    await client.initialize();
  } catch (e) {
    const msg = e.message || '';
    if (msg.includes('already running') || msg.includes('lockfile') || msg.includes('userDataDir')) {
      console.warn('Lockfile detectado — removendo e tentando novamente em 4s...');
      removeLock();
      setTimeout(startWhatsApp, 4000);
    } else {
      state = 'error';
      errorMsg = 'Erro: ' + msg;
      console.error(errorMsg);
    }
  }
}

// ── 6. HTML Page (polling, no meta-refresh to avoid QR flicker) ───────────────
const HTML_PAGE = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Conectar WhatsApp</title>
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0c0c0c;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center}
  .card{background:#141414;border:1px solid #242424;border-radius:24px;padding:52px 44px;text-align:center;max-width:420px;width:100%}
  .logo{width:44px;height:44px;border-radius:12px;background:#25D366;display:flex;align-items:center;justify-content:center;margin:0 auto 24px}
  h1{font-size:1.35rem;font-weight:600;margin-bottom:10px}
  .sub{color:#666;font-size:.88rem;line-height:1.65;margin-bottom:28px}
  .qr-wrap{background:#fff;border-radius:16px;padding:18px;display:inline-block;margin-bottom:20px}
  .qr-wrap img{display:block;border-radius:4px}
  .hint{color:#555;font-size:.78rem;line-height:1.6}
  .success{background:rgba(37,211,102,.1);border:1px solid rgba(37,211,102,.3);border-radius:14px;padding:28px;margin-top:4px}
  .success h2{font-size:1.15rem;color:#25D366;margin-bottom:8px}
  .success p{color:#888;font-size:.88rem;line-height:1.6}
  .spinner{width:36px;height:36px;border:3px solid #1e1e1e;border-top-color:#25D366;border-radius:50%;animation:spin .9s linear infinite;margin:28px auto 20px}
  @keyframes spin{to{transform:rotate(360deg)}}
  .badge{display:inline-block;background:rgba(37,211,102,.12);color:#25D366;font-size:.75rem;font-weight:600;padding:4px 12px;border-radius:20px;margin-bottom:20px}
  .error-box{color:#f87171;font-size:.88rem;margin-top:16px;padding:12px;background:rgba(248,113,113,.1);border-radius:8px;border:1px solid rgba(248,113,113,.2)}
</style>
</head>
<body>
<div class="card">
  <div class="logo">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.553 4.116 1.52 5.845L.057 23.617a.5.5 0 00.611.611l5.772-1.463A11.942 11.942 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.96 0-3.788-.529-5.355-1.448l-.385-.228-3.985 1.01 1.01-3.985-.228-.385A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
    </svg>
  </div>
  <div id="content">
    <div class="badge">Configuração única</div>
    <h1>Inicializando...</h1>
    <div class="spinner"></div>
    <p class="hint">Aguarde — carregando WhatsApp Web...</p>
  </div>
</div>

<script>
let prevState = null;
let prevQr = null;

function render(data) {
  const el = document.getElementById('content');

  if (data.state === 'connected') {
    el.innerHTML = \`
      <div class="success">
        <h2>WhatsApp Conectado!</h2>
        <p>Sessão salva com sucesso.<br>Pode fechar esta aba.<br><br>
        O sistema já está pronto para enviar mensagens.</p>
      </div>\`;
    return;
  }

  if (data.state === 'error') {
    el.innerHTML = \`
      <div class="badge">Erro</div>
      <h1>Falha na inicialização</h1>
      <div class="error-box">\${data.error || 'Erro desconhecido'}</div>
      <p class="hint" style="margin-top:16px">Feche e rode novamente: <strong>node connect-whatsapp.js</strong></p>\`;
    return;
  }

  if (data.state === 'qr_ready' && data.qrDataUrl) {
    // Only re-render if QR actually changed (avoid flicker)
    if (prevQr === data.qrDataUrl) return;
    prevQr = data.qrDataUrl;
    el.innerHTML = \`
      <div class="badge">Configuração única</div>
      <h1>Escaneie o QR Code</h1>
      <p class="sub">Abra o WhatsApp no celular &rarr; toque em &#8942; (Android) ou Configurações (iOS) &rarr; Dispositivos conectados &rarr; Conectar dispositivo</p>
      <div class="qr-wrap"><img src="\${data.qrDataUrl}" width="260" height="260"></div>
      <p class="hint">O QR code expira em ~20s — atualiza automaticamente.</p>\`;
    return;
  }

  // waiting / authenticating
  el.innerHTML = \`
    <div class="badge">Configuração única</div>
    <h1>\${data.state === 'waiting' ? 'Aguardando QR Code...' : 'Autenticando...'}</h1>
    <div class="spinner"></div>
    <p class="hint">Inicializando WhatsApp Web (20-40s)...</p>\`;
}

async function poll() {
  try {
    const r = await fetch('/status').then(r => r.json());
    render(r);
    if (r.state !== 'connected' && r.state !== 'error') {
      setTimeout(poll, 2500);
    }
  } catch {
    setTimeout(poll, 3000);
  }
}

poll();
</script>
</body>
</html>`;

// ── 7. Boot ───────────────────────────────────────────────────────────────────
console.log('=== WhatsApp QR Connector ===');
killPuppeteerChrome();
removeLock();
// Server starts above via server.listen()

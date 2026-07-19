/**
 * Conecta o WhatsApp Web.js e exibe o QR code no browser.
 * Rode uma vez: npm run whatsapp:connect
 * Abra http://localhost:3001 e escaneie o QR code.
 * Após conectar, a sessão fica salva — o sistema reconecta automaticamente.
 */

import 'dotenv/config';
import express from 'express';
import QRCode from 'qrcode';
import { log } from './utils/logger';

const app = express();
const PORT = 3001;

let qrDataUrl: string | null = null;
let connectionStatus: 'aguardando' | 'qr_pronto' | 'conectado' | 'falha' = 'aguardando';

async function startClient(): Promise<void> {
  const { Client, LocalAuth } = await import('whatsapp-web.js');

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  client.on('qr', async (qr: string) => {
    qrDataUrl = await QRCode.toDataURL(qr, { width: 280, margin: 2 });
    connectionStatus = 'qr_pronto';
    log.info('QR code pronto — abra http://localhost:' + PORT + ' no browser');
  });

  client.on('ready', () => {
    connectionStatus = 'conectado';
    qrDataUrl = null;
    log.success('WhatsApp conectado! Sessão salva em .wwebjs_auth/');
    log.info('Pode fechar este terminal. O sistema vai reconectar automaticamente.');
    setTimeout(() => process.exit(0), 4000);
  });

  client.on('auth_failure', (msg: string) => {
    connectionStatus = 'falha';
    log.error('Falha na autenticação: ' + msg);
  });

  client.on('authenticated', () => {
    log.info('Autenticado — aguardando sincronização...');
  });

  try {
    await client.initialize();
  } catch (err) {
    const msg = (err as Error).message || '';
    if (msg.includes('already running') || msg.includes('userDataDir') || msg.includes('lockfile')) {
      // Limpa o lockfile e tenta novamente
      const lockFile = require('path').join(process.cwd(), '.wwebjs_auth', 'session', 'lockfile');
      try { require('fs').unlinkSync(lockFile); log.warn('Lockfile removido — reiniciando em 3s...'); } catch {}
      connectionStatus = 'aguardando';
      qrDataUrl = null;
      setTimeout(startClient, 3000);
    } else {
      connectionStatus = 'falha';
      log.error('Erro ao inicializar: ' + msg);
      // Não chama process.exit — mantém o servidor Express vivo para exibir o erro no browser
    }
  }
}

app.get('/status', (_req, res) => {
  res.json({ status: connectionStatus, qrDataUrl });
});

app.get('/', (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Conectar WhatsApp</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0c0c0c;
      color: #fff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: #141414;
      border: 1px solid #242424;
      border-radius: 24px;
      padding: 52px 44px;
      text-align: center;
      max-width: 420px;
      width: 100%;
    }
    .logo {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: #25D366;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
    }
    h1 { font-size: 1.35rem; font-weight: 600; margin-bottom: 10px; }
    .sub { color: #666; font-size: .88rem; line-height: 1.65; margin-bottom: 28px; }
    .qr-wrap {
      background: #fff;
      border-radius: 16px;
      padding: 18px;
      display: inline-block;
      margin-bottom: 20px;
      box-shadow: 0 0 0 1px rgba(255,255,255,.06);
    }
    .qr-wrap img { display: block; border-radius: 4px; }
    .hint { color: #555; font-size: .78rem; line-height: 1.6; }
    .success {
      background: rgba(37,211,102,.1);
      border: 1px solid rgba(37,211,102,.3);
      border-radius: 14px;
      padding: 28px;
      margin-top: 4px;
    }
    .success h2 { font-size: 1.15rem; color: #25D366; margin-bottom: 8px; }
    .success p { color: #888; font-size: .88rem; line-height: 1.6; }
    .spinner {
      width: 36px; height: 36px;
      border: 3px solid #1e1e1e;
      border-top-color: #25D366;
      border-radius: 50%;
      animation: spin .9s linear infinite;
      margin: 28px auto 20px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .badge {
      display: inline-block;
      background: rgba(37,211,102,.12);
      color: #25D366;
      font-size: .75rem;
      font-weight: 600;
      padding: 4px 12px;
      border-radius: 20px;
      margin-bottom: 20px;
      letter-spacing: .02em;
    }
    .error { color: #f87171; font-size: .88rem; margin-top: 16px; }
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
      <h1>Aguardando QR Code...</h1>
      <div class="spinner"></div>
      <p class="hint">Inicializando WhatsApp Web...</p>
    </div>
  </div>

  <script>
    let prevStatus = null;

    async function poll() {
      try {
        const r = await fetch('/status').then(r => r.json());

        if (r.status === prevStatus && r.status !== 'qr_pronto') {
          setTimeout(poll, 2000);
          return;
        }
        prevStatus = r.status;

        const el = document.getElementById('content');

        if (r.status === 'conectado') {
          el.innerHTML = \`
            <div class="success">
              <h2>WhatsApp Conectado!</h2>
              <p>Sessão salva com sucesso.<br>Pode fechar esta aba.<br><br>
              Inicie o sistema normalmente com<br><strong>npm run dev</strong></p>
            </div>\`;
          return;
        }

        if (r.status === 'falha') {
          el.innerHTML = \`
            <div class="badge">Configuração única</div>
            <h1>Falha na autenticação</h1>
            <p class="error">Tente fechar e rodar novamente:<br><strong>npm run whatsapp:connect</strong></p>\`;
          return;
        }

        if (r.status === 'qr_pronto' && r.qrDataUrl) {
          el.innerHTML = \`
            <div class="badge">Configuração única</div>
            <h1>Escaneie o QR Code</h1>
            <p class="sub">Abra o WhatsApp no celular → toque em ⋮ (Android) ou Configurações (iOS) → Dispositivos conectados → Conectar dispositivo</p>
            <div class="qr-wrap"><img src="\${r.qrDataUrl}" width="260" height="260"></div>
            <p class="hint">O QR code expira em ~20 segundos — a página atualiza automaticamente.</p>\`;
        } else {
          el.innerHTML = \`
            <div class="badge">Configuração única</div>
            <h1>Aguardando QR Code...</h1>
            <div class="spinner"></div>
            <p class="hint">Inicializando WhatsApp Web...</p>\`;
        }
      } catch {
        // servidor ainda subindo
      }
      setTimeout(poll, 2000);
    }

    poll();
  </script>
</body>
</html>`);
});

app.listen(PORT, () => {
  log.success('Abrindo painel em http://localhost:' + PORT);
  log.info('Escaneie o QR code com o WhatsApp do celular para conectar.');

  // Abre o browser automaticamente no Windows
  if (process.platform === 'win32') {
    const { exec } = require('child_process');
    setTimeout(() => exec('start http://localhost:' + PORT), 1500);
  }
});

startClient().catch((err) => {
  log.error('Erro ao inicializar WhatsApp: ' + (err as Error).message);
  connectionStatus = 'falha';
  // Não encerra — servidor Express permanece vivo
});

/**
 * start-ngrok.js — Tunnel permanente via @ngrok/ngrok SDK
 * Sem binário externo — o SDK npm gerencia tudo automaticamente.
 */

require('dotenv/config');
const ngrok = require('@ngrok/ngrok');
const fs    = require('fs');
const path  = require('path');

const TOKEN  = process.env.NGROK_AUTHTOKEN;
const DOMAIN = process.env.NGROK_DOMAIN;
const PORT   = process.env.PORT || '3000';

if (!TOKEN || !DOMAIN) {
  console.error('[NGROK] NGROK_AUTHTOKEN e NGROK_DOMAIN devem estar no .env');
  process.exit(1);
}

const TUNNEL_URL_FILE = path.join(__dirname, 'tunnel_url.txt');
const RETRY_DELAY_MS  = 10000; // 10s entre tentativas

async function startTunnel() {
  try {
    console.log(`[NGROK] Conectando → https://${DOMAIN}`);

    const listener = await ngrok.forward({
      addr:      parseInt(PORT),
      authtoken: TOKEN,
      domain:    DOMAIN,
    });

    const url = listener.url();
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log(`║  ACESSO REMOTO: ${url}`);
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    try { fs.writeFileSync(TUNNEL_URL_FILE, url); } catch {}

    process.on('SIGTERM', async () => { try { await listener.close(); } catch {} process.exit(0); });
    process.on('SIGINT',  async () => { try { await listener.close(); } catch {} process.exit(0); });

    // Mantém o event loop ativo — o SDK gerencia reconexão internamente, mas o processo
    // precisa de um timer referenciado para não sair depois que o await resolve.
    setInterval(() => {
      const currentUrl = listener.url();
      if (currentUrl) {
        console.log(`[NGROK] ✓ Tunnel ativo: ${currentUrl}`);
      } else {
        console.log('[NGROK] Aguardando reconexão do SDK...');
      }
    }, 5 * 60 * 1000); // log a cada 5min

  } catch (err) {
    console.error(`[NGROK] Erro: ${err.message} — tentando novamente em 10s...`);
    setTimeout(startTunnel, RETRY_DELAY_MS);
  }
}

startTunnel();

/**
 * start-ngrok.js — Tunnel fixo via ngrok (URL permanente)
 * Requer: NGROK_AUTHTOKEN e NGROK_DOMAIN no .env
 */

const { spawn } = require('child_process');
const fs   = require('fs');
const path = require('path');

const TUNNEL_URL_FILE = path.join(__dirname, 'tunnel_url.txt');
const PORT   = process.env.PORT   || '3000';
const TOKEN  = process.env.NGROK_AUTHTOKEN;
const DOMAIN = process.env.NGROK_DOMAIN;

if (!TOKEN || !DOMAIN) {
  console.error('[NGROK] NGROK_AUTHTOKEN e NGROK_DOMAIN devem estar no .env');
  process.exit(1);
}

function start() {
  console.log(`[NGROK] Iniciando → https://${DOMAIN}`);

  const proc = spawn('ngrok', [
    'http',
    PORT,
    '--authtoken', TOKEN,
    '--domain',   DOMAIN,
    '--log',      'stdout',
    '--log-format', 'json',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  proc.stdout.on('data', (data) => {
    const text = data.toString();
    // Detecta quando o tunnel está pronto
    if (text.includes('"msg":"started tunnel"') || text.includes(DOMAIN)) {
      const url = `https://${DOMAIN}`;
      console.log('\n╔══════════════════════════════════════════════════════════╗');
      console.log(`║  LINK FIXO MOBILE: ${url}`);
      console.log('╚══════════════════════════════════════════════════════════╝\n');
      try { fs.writeFileSync(TUNNEL_URL_FILE, url); } catch {}
    }
  });

  proc.stderr.on('data', (data) => process.stderr.write(data));

  proc.on('exit', (code) => {
    console.log(`[NGROK] Processo encerrado (código ${code}) — PM2 reiniciará`);
    process.exit(1);
  });

  process.on('SIGTERM', () => proc.kill());
  process.on('SIGINT',  () => proc.kill());
}

start();

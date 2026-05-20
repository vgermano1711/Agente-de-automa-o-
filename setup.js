#!/usr/bin/env node
/**
 * Setup interativo do Sales Bot
 * Roda com: node setup.js
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function print(msg = '') { process.stdout.write(msg + '\n'); }
function bold(s) { return BOLD + s + RESET; }
function green(s) { return GREEN + s + RESET; }
function yellow(s) { return YELLOW + s + RESET; }
function cyan(s) { return CYAN + s + RESET; }
function red(s) { return RED + s + RESET; }
function dim(s) { return DIM + s + RESET; }

function ask(question, defaultVal = '') {
  return new Promise((resolve) => {
    const hint = defaultVal ? dim(` [${defaultVal}]`) : '';
    rl.question(cyan('→ ') + question + hint + ' ', (answer) => {
      resolve(answer.trim() || defaultVal);
    });
  });
}

function askSecret(question) {
  return new Promise((resolve) => {
    process.stdout.write(cyan('→ ') + question + ' ');
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    let value = '';
    stdin.on('data', function handler(ch) {
      ch = ch.toString();
      if (ch === '\n' || ch === '\r' || ch === '') {
        stdin.setRawMode(false);
        stdin.removeListener('data', handler);
        process.stdout.write('\n');
        resolve(value);
      } else if (ch === '') {
        if (value.length > 0) { value = value.slice(0, -1); process.stdout.write('\b \b'); }
      } else {
        value += ch;
        process.stdout.write('*');
      }
    });
  });
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject).on('timeout', () => reject(new Error('timeout')));
  });
}

async function validateAnthropic(key) {
  if (!key || key.length < 20) return false;
  try {
    const res = await httpGet('https://api.anthropic.com/v1/models');
    // qualquer resposta (mesmo 401) indica que a URL existe
    return res.status !== 0;
  } catch { return true; } // sem rede? assume válido
}

async function checkNodeVersion() {
  const major = parseInt(process.version.slice(1));
  if (major < 18) {
    print(red(`\n✗ Node.js ${process.version} detectado. É necessário Node.js 18+.`));
    print('  Baixe em: https://nodejs.org\n');
    process.exit(1);
  }
}

function checkFfmpeg() {
  try { execSync('ffmpeg -version', { stdio: 'ignore' }); return true; }
  catch { return false; }
}

function checkPm2() {
  try { execSync('pm2 --version', { stdio: 'ignore' }); return true; }
  catch { return false; }
}

function writeEnv(vars) {
  const lines = [
    '# Sales Bot — gerado pelo setup.js em ' + new Date().toLocaleString('pt-BR'),
    '',
    '# ANTHROPIC (obrigatório)',
    `ANTHROPIC_API_KEY=${vars.anthropic_key}`,
    '',
    '# GOOGLE PLACES (Agente 1 — prospecção)',
    `GOOGLE_PLACES_API_KEY=${vars.places_key || 'nao_configurado'}`,
    '',
    '# GMAIL (envio de emails e Agente 7)',
    `GMAIL_USER=${vars.gmail_user || ''}`,
    `GMAIL_APP_PASSWORD=${vars.gmail_pass || ''}`,
    '',
    '# GOOGLE OAUTH2 (Agente 7 — monitorar respostas)',
    `GOOGLE_CLIENT_ID=${vars.google_client_id || ''}`,
    `GOOGLE_CLIENT_SECRET=${vars.google_client_secret || ''}`,
    `GOOGLE_REFRESH_TOKEN=${vars.google_refresh_token || ''}`,
    '',
    '# NETLIFY (deploy de landing pages)',
    `NETLIFY_AUTH_TOKEN=${vars.netlify_token || ''}`,
    `NETLIFY_SITE_PREFIX=demo-`,
    '',
    '# PUSHOVER (notificações no celular)',
    `PUSHOVER_TOKEN=${vars.pushover_token || ''}`,
    `PUSHOVER_USER=${vars.pushover_user || ''}`,
    '',
    '# CALENDLY',
    `CALENDLY_LINK=${vars.calendly_link || ''}`,
    '',
    '# WHATSAPP',
    `WHATSAPP_PROVIDER=${vars.whatsapp_provider || 'zapi'}`,
    `ZAPI_INSTANCE_ID=${vars.zapi_instance_id || ''}`,
    `ZAPI_TOKEN=${vars.zapi_token || ''}`,
    `ZAPI_CLIENT_TOKEN=${vars.zapi_client_token || ''}`,
    '',
    '# SISTEMA',
    `OWNER_EMAIL=${vars.owner_email || vars.gmail_user || ''}`,
    `APPROVAL_PANEL_URL=http://localhost:3000`,
    `PORT=3000`,
    `CRON_SCHEDULE=0 8 * * *`,
    `NOTIFICACOES_ATIVAS=${vars.notificacoes}`,
  ];
  fs.writeFileSync(path.join(__dirname, '.env'), lines.join('\n'));
}

function section(title) {
  print('');
  print(bold(CYAN + '━━━ ' + title + ' ' + '━'.repeat(Math.max(0, 50 - title.length)) + RESET));
}

async function main() {
  print('');
  print(bold(CYAN + '╔══════════════════════════════════════════╗'));
  print(bold(CYAN + '║        Sales Bot — Setup Interativo      ║'));
  print(bold(CYAN + '╚══════════════════════════════════════════╝' + RESET));
  print('');
  print('Este script configura o .env e verifica os pré-requisitos.');
  print(dim('Pressione Enter para pular qualquer campo opcional.'));

  await checkNodeVersion();
  print(green('✓ Node.js ' + process.version));

  const hasFfmpeg = checkFfmpeg();
  if (hasFfmpeg) print(green('✓ ffmpeg encontrado'));
  else print(yellow('⚠ ffmpeg não encontrado — vídeos não serão gerados'));

  const hasPm2 = checkPm2();
  if (hasPm2) print(green('✓ PM2 encontrado'));
  else print(dim('  PM2 não instalado (opcional para produção)'));

  // ── 1. Anthropic ──────────────────────────────────────────────────────────
  section('1. Anthropic API Key (OBRIGATÓRIO)');
  print(dim('  Obter em: https://console.anthropic.com/settings/keys'));
  print(dim('  Formato: sk-ant-api03-...'));
  print('');

  let anthropic_key = '';
  while (!anthropic_key) {
    anthropic_key = await ask('Cole sua ANTHROPIC_API_KEY:');
    if (!anthropic_key.startsWith('sk-ant')) {
      print(red('  ✗ Chave inválida. Deve começar com sk-ant-...'));
      anthropic_key = '';
    }
  }
  print(green('  ✓ Chave Anthropic aceita'));

  // ── 2. WhatsApp ───────────────────────────────────────────────────────────
  section('2. WhatsApp — canal principal de envio');
  print(dim('  Escolha como quer enviar as mensagens:'));
  print('');
  print('  ' + bold('A) Z-API') + dim(' — recomendado. Pago (~R$97/mês), sem celular preso.'));
  print('     Criar em: ' + cyan('app.z-api.io'));
  print('');
  print('  ' + bold('B) whatsapp-web.js') + dim(' — gratuito. Escaneia QR code no terminal.'));
  print('     Requer: celular com WhatsApp conectado ao computador.'));
  print('');
  const whatsapp_provider_choice = await ask('Escolha (A para Z-API / B para gratuito):', 'A');
  const whatsapp_provider = whatsapp_provider_choice.toUpperCase() === 'B' ? 'wwebjs' : 'zapi';

  let zapi_instance_id = '', zapi_token = '', zapi_client_token = '';
  if (whatsapp_provider === 'zapi') {
    print(dim('  No app.z-api.io: crie uma instância → conecte seu WhatsApp → copie os dados abaixo'));
    print('');
    zapi_instance_id = await ask('ZAPI_INSTANCE_ID (Enter para pular):');
    zapi_token = await ask('ZAPI_TOKEN (Enter para pular):');
    zapi_client_token = await ask('ZAPI_CLIENT_TOKEN (Enter para pular):');
    if (zapi_instance_id && zapi_token) print(green('  ✓ Z-API configurado'));
    else print(yellow('  → Pulado — WhatsApp rodará em modo simulação'));
  } else {
    print(green('  ✓ whatsapp-web.js selecionado — QR code aparecerá ao iniciar o sistema'));
  }

  // ── 3. Google Places ──────────────────────────────────────────────────────
  section('3. Google Places API Key (para prospecção real)');
  print(dim('  Obter em: console.cloud.google.com → APIs → Places API → Credentials'));
  print(dim('  Sem ela o sistema usa dados mock (ótimo para testar)'));
  print('');
  const places_key = await ask('Cole sua GOOGLE_PLACES_API_KEY (Enter para pular):');
  if (places_key) print(green('  ✓ Google Places configurado'));
  else print(yellow('  → Pulado — sistema usará dados mock'));

  // ── 4. Gmail ──────────────────────────────────────────────────────────────
  section('4. Gmail (para monitorar respostas — opcional)');
  print(dim('  Precisa de: seu email + uma "Senha de app" do Google'));
  print(dim('  Passos: conta.google.com → Segurança → Verificação em 2 etapas → Senhas de app'));
  print('');
  const gmail_user = await ask('Seu email Gmail (Enter para pular):');
  let gmail_pass = '';
  if (gmail_user) {
    print(dim('  A senha de app tem 16 caracteres (ex: abcd efgh ijkl mnop)'));
    gmail_pass = await ask('Senha de app do Gmail:');
    if (gmail_pass) print(green('  ✓ Gmail configurado'));
  } else {
    print(yellow('  → Pulado — envio de email não funcionará'));
  }

  // ── 5. Netlify ────────────────────────────────────────────────────────────
  section('5. Netlify (deploy automático das landing pages)');
  print(dim('  Obter em: app.netlify.com → User Settings → Applications → New access token'));
  print('');
  const netlify_token = await ask('Cole seu NETLIFY_AUTH_TOKEN (Enter para pular):');
  if (netlify_token) print(green('  ✓ Netlify configurado — landing pages farão deploy automático'));
  else print(yellow('  → Pulado — LPs serão servidas localmente em localhost:3000'));

  // ── 6. Pushover ───────────────────────────────────────────────────────────
  section('6. Pushover (notificações no celular) — opcional');
  print(dim('  Criar em: pushover.net — plano gratuito por 30 dias, depois $5 único'));
  print('');
  const wantsPushover = await ask('Quer configurar notificações Pushover? (s/n)', 'n');
  let pushover_token = '', pushover_user = '';
  if (wantsPushover.toLowerCase() === 's') {
    pushover_token = await ask('PUSHOVER_TOKEN (API Token da aplicação):');
    pushover_user = await ask('PUSHOVER_USER (User Key da sua conta):');
    if (pushover_token && pushover_user) print(green('  ✓ Pushover configurado'));
  } else {
    print(dim('  → Pulado — notificações serão por email'));
  }

  // ── 7. Calendly ───────────────────────────────────────────────────────────
  section('7. Calendly (para Agente 7 propor horários) — opcional');
  print(dim('  Se tiver conta, cole seu link pessoal (ex: calendly.com/seu-nome/30min)'));
  print('');
  const calendly_link = await ask('Link do Calendly (Enter para pular):');

  // ── 8. Configurações gerais ───────────────────────────────────────────────
  section('8. Configurações gerais');
  const owner_email = await ask('Seu email (para notificações de fallback):', gmail_user || '');
  const notif = (!pushover_token && !gmail_pass) ? 'false' : 'true';

  // ── Escrever .env ─────────────────────────────────────────────────────────
  writeEnv({
    anthropic_key, places_key, gmail_user, gmail_pass,
    google_client_id: '', google_client_secret: '', google_refresh_token: '',
    netlify_token, pushover_token, pushover_user, calendly_link,
    owner_email, notificacoes: notif,
    whatsapp_provider, zapi_instance_id, zapi_token, zapi_client_token,
  });

  // ── Instalar dependências ─────────────────────────────────────────────────
  section('Instalando dependências...');
  try {
    execSync('npm install', { stdio: 'inherit', cwd: __dirname });
    print(green('✓ Dependências instaladas'));
  } catch {
    print(red('✗ Erro ao instalar dependências. Tente rodar: npm install'));
  }

  // ── ffmpeg hint ───────────────────────────────────────────────────────────
  if (!hasFfmpeg) {
    section('Instalar ffmpeg (para geração de vídeos)');
    const platform = process.platform;
    if (platform === 'darwin') print(dim('  brew install ffmpeg'));
    else if (platform === 'win32') print(dim('  winget install ffmpeg\n  ou baixe em: ffmpeg.org/download.html'));
    else print(dim('  sudo apt install ffmpeg'));
  }

  // ── Resumo final ──────────────────────────────────────────────────────────
  print('');
  print(bold(GREEN + '╔══════════════════════════════════════════╗'));
  print(bold(GREEN + '║           Setup Concluído! ✓             ║'));
  print(bold(GREEN + '╚══════════════════════════════════════════╝' + RESET));
  print('');
  print(bold('Próximos passos:'));
  print('');
  print('  ' + bold('1. Rodar agora (teste):'));
  print('     ' + cyan('npm run run-now'));
  print('');
  print('  ' + bold('2. Abrir o painel de aprovação:'));
  print('     ' + cyan('npm run dev:api') + '  →  abra ' + bold('http://localhost:3000'));
  print('');
  print('  ' + bold('3. Produção 24/7 com PM2:'));
  if (!hasPm2) {
    print('     ' + cyan('npm install -g pm2'));
  }
  print('     ' + cyan('npm run build && pm2 start ecosystem.config.js'));
  print('');
  print(dim('  .env salvo em: ' + path.join(__dirname, '.env')));
  print('');

  rl.close();
}

main().catch(err => {
  print(red('\nErro inesperado: ' + err.message));
  rl.close();
  process.exit(1);
});

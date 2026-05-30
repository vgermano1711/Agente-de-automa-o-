/**
 * utils/whatsapp.ts
 * Envio de WhatsApp com dois provedores:
 *   - Z-API  (zapi.io) — pago, sem QR code, recomendado para produção
 *   - whatsapp-web.js  — gratuito, requer escanear QR code ou vincular por número
 */

import axios from 'axios';
import { log } from './logger';

// ── Z-API ─────────────────────────────────────────────────────────────────
async function sendViaZapi(phone: string, message: string): Promise<boolean> {
  const instanceId = process.env.ZAPI_INSTANCE_ID;
  const token      = process.env.ZAPI_TOKEN;
  const clientToken = process.env.ZAPI_CLIENT_TOKEN;
  if (!instanceId || !token) return false;

  const normalized = '55' + phone.replace(/\D/g, '').replace(/^55/, '');

  try {
    await axios.post(
      `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`,
      { phone: normalized, message },
      { headers: { 'client-token': clientToken || '' } }
    );
    return true;
  } catch (err) {
    log.error(`Z-API erro: ${(err as Error).message}`);
    return false;
  }
}

// ── whatsapp-web.js (sessão local) ─────────────────────────────────────────
let wwjsClient: import('whatsapp-web.js').Client | null = null;
let wwjsReady   = false;

// Estado exposto à API REST
let _latestQr: string | null   = null;
let _connected = false;

/** Retorna o QR string mais recente (null se não houver ou já conectado). */
export function getLatestQr(): string | null { return _latestQr; }

/** Retorna true se o cliente wwjs está autenticado e pronto. */
export function isWwjsConnected(): boolean { return _connected; }

/** Solicita código de vinculação por número de telefone (alternativa ao QR). */
export async function requestPairingCode(phone: string): Promise<string> {
  if (!wwjsClient) {
    throw new Error(
      'Cliente WhatsApp não inicializado. Inicie o servidor com WHATSAPP_PROVIDER=wwebjs.'
    );
  }
  // Formato: apenas dígitos com DDI 55
  const digits     = phone.replace(/\D/g, '');
  const normalized = digits.startsWith('55') ? digits : '55' + digits;

  // requestPairingCode está disponível no whatsapp-web.js ≥ 1.22
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const code = await (wwjsClient as any).requestPairingCode(normalized);
  log.info(`Código de vinculação para ${normalized}: ${code}`);
  return String(code);
}

export async function initWhatsappWeb(): Promise<void> {
  const { Client, LocalAuth } = await import('whatsapp-web.js');
  const qrcode = await import('qrcode-terminal');

  wwjsClient = new Client({
    authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
    puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
  });

  wwjsClient.on('qr', (qr) => {
    _latestQr  = qr;
    _connected = false;
    log.info('📱 Escaneie o QR Code abaixo com o WhatsApp do seu celular:');
    qrcode.default.generate(qr, { small: true });
    log.info('   Ou acesse http://localhost:3000/qr.html para vincular pelo navegador');
  });

  wwjsClient.on('ready', () => {
    wwjsReady  = true;
    _connected = true;
    _latestQr  = null; // limpa QR quando conectado
    log.success('✓ WhatsApp Web conectado');
  });

  wwjsClient.on('authenticated', () => {
    _latestQr = null; // sessão restaurada — QR não mais necessário
  });

  wwjsClient.on('disconnected', () => {
    wwjsReady  = false;
    _connected = false;
    log.warn('WhatsApp Web desconectado');
  });

  await wwjsClient.initialize();
}

async function sendViaWwebjs(phone: string, message: string): Promise<boolean> {
  if (!wwjsClient || !wwjsReady) return false;
  const normalized = '55' + phone.replace(/\D/g, '').replace(/^55/, '') + '@c.us';
  try {
    await wwjsClient.sendMessage(normalized, message);
    return true;
  } catch (err) {
    log.error(`whatsapp-web.js erro: ${(err as Error).message}`);
    return false;
  }
}

// ── Interface pública ──────────────────────────────────────────────────────
export async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  if (!phone || phone.replace(/\D/g, '').length < 10) {
    log.warn(`Número inválido para WhatsApp: "${phone}"`);
    return false;
  }

  const provider = process.env.WHATSAPP_PROVIDER || 'zapi';

  if (provider === 'zapi') {
    const ok = await sendViaZapi(phone, message);
    if (ok) { log.success(`WhatsApp enviado via Z-API → ${phone}`); return true; }
  }

  if (provider === 'wwebjs' || provider === 'whatsapp-web') {
    const ok = await sendViaWwebjs(phone, message);
    if (ok) { log.success(`WhatsApp enviado via whatsapp-web.js → ${phone}`); return true; }
  }

  log.warn(`[SIMULADO] WhatsApp para ${phone}:\n${message}`);
  return true;
}

export function whatsappConfigured(): boolean {
  const provider = process.env.WHATSAPP_PROVIDER || 'zapi';
  if (provider === 'zapi')   return !!(process.env.ZAPI_INSTANCE_ID && process.env.ZAPI_TOKEN);
  if (provider === 'wwebjs') return wwjsReady;
  return false;
}

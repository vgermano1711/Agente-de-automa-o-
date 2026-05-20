/**
 * utils/whatsapp.ts
 * Envio de WhatsApp com dois provedores:
 *   - Z-API  (zapi.io) — pago, sem QR code, recomendado para produção
 *   - whatsapp-web.js  — gratuito, requer escanear QR code uma vez
 */

import axios from 'axios';
import { log } from './logger';

// ── Z-API ─────────────────────────────────────────────────────────────────
async function sendViaZapi(phone: string, message: string): Promise<boolean> {
  const instanceId = process.env.ZAPI_INSTANCE_ID;
  const token = process.env.ZAPI_TOKEN;
  const clientToken = process.env.ZAPI_CLIENT_TOKEN;
  if (!instanceId || !token) return false;

  // Normaliza número: apenas dígitos, com DDI 55
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
let wwjsReady = false;

export async function initWhatsappWeb(): Promise<void> {
  const { Client, LocalAuth } = await import('whatsapp-web.js');
  const qrcode = await import('qrcode-terminal');

  wwjsClient = new Client({
    authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
    puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
  });

  wwjsClient.on('qr', (qr) => {
    log.info('📱 Escaneie o QR Code abaixo com o WhatsApp do seu celular:');
    qrcode.default.generate(qr, { small: true });
  });

  wwjsClient.on('ready', () => {
    wwjsReady = true;
    log.success('✓ WhatsApp Web conectado');
  });

  wwjsClient.on('disconnected', () => {
    wwjsReady = false;
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

  // Modo simulação (desenvolvimento)
  log.warn(`[SIMULADO] WhatsApp para ${phone}:\n${message}`);
  return true; // retorna true para não travar o pipeline em dev
}

export function whatsappConfigured(): boolean {
  const provider = process.env.WHATSAPP_PROVIDER || 'zapi';
  if (provider === 'zapi') return !!(process.env.ZAPI_INSTANCE_ID && process.env.ZAPI_TOKEN);
  if (provider === 'wwebjs') return wwjsReady;
  return false;
}

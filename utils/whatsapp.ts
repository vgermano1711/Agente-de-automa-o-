/**
 * utils/whatsapp.ts
 * Envio de WhatsApp com dois provedores:
 *   - Z-API  (zapi.io) — pago, sem QR code, recomendado para produção
 *   - whatsapp-web.js  — gratuito, requer escanear QR code ou vincular por número
 *
 * Wrapper fino sobre a conexão do vendedor (whatsappManager.getSeller()) —
 * mantém a API pública idêntica à de antes da refatoração multi-tenant, para
 * que nenhum ponto de chamada existente (api/server.ts, orchestrator.ts,
 * agents/*) precise mudar. Conexões de clientes (automação) usam
 * WhatsAppConnection/whatsappManager diretamente, não este módulo.
 */

import axios from 'axios';
import { log } from './logger';
import { whatsappManager } from './whatsappManager';
import type { MessageHandler } from './whatsappConnection';

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

// ── whatsapp-web.js (conexão do vendedor) ───────────────────────────────────
export function getLatestQr(): string | null {
  return whatsappManager.getSeller().getLatestQr();
}

export function isWwjsConnected(): boolean {
  return whatsappManager.getSeller().isConnected();
}

export async function requestPairingCode(phone: string): Promise<string> {
  return whatsappManager.getSeller().requestPairingCode(phone);
}

export async function initWhatsappWeb(): Promise<void> {
  return whatsappManager.getSeller().init();
}

export async function reinitWhatsappWeb(): Promise<void> {
  return whatsappManager.getSeller().reinit();
}

export function setMessageHandler(handler: MessageHandler): void {
  whatsappManager.getSeller().setMessageHandler(handler);
}

// ── Interface pública ──────────────────────────────────────────────────────
export async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  // Aceita endereço WA completo (@c.us / @lid) ou número com mín. 10 dígitos
  const isWaId = phone.includes('@');
  if (!phone || (!isWaId && phone.replace(/\D/g, '').length < 10)) {
    log.warn(`Número inválido para WhatsApp: "${phone}"`);
    return false;
  }

  const provider = process.env.WHATSAPP_PROVIDER || 'zapi';

  if (provider === 'zapi') {
    const ok = await sendViaZapi(phone, message);
    if (ok) { log.success(`WhatsApp enviado via Z-API → ${phone}`); return true; }
  }

  if (provider === 'wwebjs' || provider === 'whatsapp-web') {
    const ok = await whatsappManager.getSeller().sendMessage(phone, message);
    if (ok) { log.success(`WhatsApp enviado via whatsapp-web.js → ${phone}`); return true; }
  }

  log.warn(`[SIMULADO] WhatsApp para ${phone}: nenhum provedor ativo — mensagem NÃO enviada`);
  return false;
}

/**
 * Envia mídia (imagem/vídeo/doc) via whatsapp-web.js.
 * Usado para enviar o vídeo de prévia da landing page após o probe ser aprovado.
 */
export async function sendMediaWhatsApp(phone: string, filePath: string, caption = ''): Promise<boolean> {
  return whatsappManager.getSeller().sendMedia(phone, filePath, caption);
}

/**
 * Adiciona uma etiqueta a um chat pelo nome (requer WhatsApp Business).
 * Se a etiqueta não existir ou o WA não for Business, falha silenciosamente.
 */
export async function addLabelToChat(chatId: string, labelName: string): Promise<void> {
  return whatsappManager.getSeller().addLabelToChat(chatId, labelName);
}

export function whatsappConfigured(): boolean {
  const provider = process.env.WHATSAPP_PROVIDER || 'zapi';
  if (provider === 'zapi')   return !!(process.env.ZAPI_INSTANCE_ID && process.env.ZAPI_TOKEN);
  if (provider === 'wwebjs') return whatsappManager.getSeller().isConfigured();
  return false;
}

/**
 * Verifica saúde da sessão wwebjs sem enviar mensagem.
 * Retorna true se o estado for CONNECTED; false se desconectado ou com erro.
 */
export async function checkWwjsHealth(): Promise<boolean> {
  return whatsappManager.getSeller().checkHealth();
}

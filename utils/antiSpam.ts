/**
 * utils/antiSpam.ts
 * Proteções compartilhadas contra bloqueio por alto volume no WhatsApp — usadas
 * por qualquer agente que envie mensagens em lote (Agente 7, Agente 8, Cadência).
 * Extraído pra módulo próprio pra evitar import circular entre esses agentes.
 */

import fs from 'fs';
import path from 'path';
import { readJson } from './dataHelpers';
import { log } from './logger';

const BLACKLIST_FILE   = path.join(process.cwd(), 'data', 'blacklist.json');
const PAUSE_FILE       = path.join(process.cwd(), 'data', 'envio_pausado.txt');

/**
 * Kill-switch global — para TODOS os envios de WhatsApp de prospecção/follow-up
 * (Agente 7, Agente 8 e Cadência). Ativa via arquivo data/envio_pausado.txt
 * (basta o arquivo existir) ou pela variável de ambiente ENVIO_PAUSADO=true.
 * Para retomar: apague o arquivo ou remova a variável de ambiente.
 */
export function envioPausado(): boolean {
  if (process.env.ENVIO_PAUSADO === 'true') return true;
  return fs.existsSync(PAUSE_FILE);
}

/**
 * Kill-switch manual pro canal de e-mail de prospecção/acionamento (Agente 8 e
 * Cadência). Não afeta WhatsApp nem o monitoramento de respostas do Agente 7 —
 * só o disparo de novos e-mails de prospecção/follow-up.
 */
export function emailProspeccaoPausada(): boolean {
  return process.env.EMAIL_PROSPECCAO_PAUSADA === 'true';
}

/** Kill-switch manual pra busca de leads novos (Agente 1 — Google Maps). */
export function buscaDeLeadsPausada(): boolean {
  return process.env.BUSCA_DE_LEADS_PAUSADA === 'true';
}

export function isNaBlacklist(telefone: string): boolean {
  const bl = readJson<string[]>(BLACKLIST_FILE) || [];
  const norm = telefone.replace(/\D/g, '').replace(/^55/, '');
  return bl.some((b) => b.replace(/\D/g, '').replace(/^55/, '') === norm);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Delay entre envios "pesados" (apresentação completa, follow-up de cadência) — 1–3 min. */
export function randomDelay(): Promise<void> {
  const ms = Math.floor(Math.random() * (180_000 - 60_000) + 60_000);
  log.info(`  ⏳ Aguardando ${Math.round(ms / 1000)}s antes do próximo envio...`);
  return sleep(ms);
}

/** Delay curto pra espaçar múltiplos envios dentro do mesmo ciclo/lote — 20–50s. */
export function randomShortDelay(): Promise<void> {
  const ms = Math.floor(Math.random() * (50_000 - 20_000) + 20_000);
  return sleep(ms);
}

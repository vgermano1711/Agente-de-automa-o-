/**
 * Agente Follow-up — envia mensagem personalizada a leads que não responderam
 * Lê data/followup_queue.json, verifica se o lead respondeu e, se não, envia.
 */

import Anthropic from '@anthropic-ai/sdk';
import path from 'path';
import fs from 'fs';
import { log } from '../utils/logger';
import { notifyOwner } from '../utils/notifications';
import { sendWhatsApp } from '../utils/whatsapp';
import { readJson, writeJson } from '../utils/dataHelpers';

const client = new Anthropic();

const QUEUE_FILE    = path.join(process.cwd(), 'data', 'followup_queue.json');
const CONVERSAS_FILE = path.join(process.cwd(), 'data', 'conversas_whatsapp.json');

export interface FollowupEntry {
  id: string;
  lead_id: string;
  nome_negocio: string;
  telefone: string;           // apenas dígitos, sem DDI
  data_envio: string;         // YYYY-MM-DD
  motivo: string;             // contexto para gerar a mensagem
  segmento?: string;
  cidade?: string;
  status: 'pendente' | 'enviado' | 'cancelado';
  enviado_em?: string;
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Verifica se o lead respondeu após o último envio de Victor nessa conversa */
function leadJaRespondeu(telefone: string): boolean {
  const conversas = readJson<Array<{ phone: string; mensagens: Array<{ role: string; data: string }> }>>(CONVERSAS_FILE) || [];
  const digits = telefone.replace(/\D/g, '').replace(/^55/, '');

  const conversa = conversas.find((c) =>
    c.phone.replace(/\D/g, '').replace(/^55/, '').endsWith(digits) ||
    digits.endsWith(c.phone.replace(/\D/g, '').replace(/^55/, '').slice(-8))
  );
  if (!victorConversa(conversa)) return false;

  const msgs = conversa!.mensagens;
  const ultimoVictor = [...msgs].reverse().findIndex((m) => m.role === 'victor');
  if (ultimoVictor === -1) return false;

  // Há alguma mensagem do lead APÓS o último envio de Victor?
  const posUltimoVictor = msgs.length - 1 - ultimoVictor;
  return msgs.slice(posUltimoVictor + 1).some((m) => m.role === 'lead');
}

function victorConversa(conv: unknown): boolean {
  return !!(conv && (conv as { mensagens: unknown[] }).mensagens?.length);
}

async function gerarFollowup(entry: FollowupEntry): Promise<string> {
  const prompt = `Você é Victor Germano, desenvolvedor web brasileiro de 23 anos. Direto, humano, cordial, profissional.

SITUAÇÃO:
- Lead: ${entry.nome_negocio}${entry.cidade ? ` (${entry.cidade})` : ''}${entry.segmento ? ` — ${entry.segmento}` : ''}
- Motivo do follow-up: ${entry.motivo}

OBJETIVO: enviar UMA mensagem de follow-up gentil, profissional, sem pressão.
- Pergunte se está tudo bem com o projeto / se pode dar andamento
- Mostre autoridade e confiança no trabalho, mas sem urgência falsa
- Máximo 3 frases curtas, tom WhatsApp
- Sem asteriscos, sem emojis excessivos (1 no máximo)
- Não mencione que é automático

Retorne APENAS o texto da mensagem, sem aspas.`;

  try {
    const r = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });
    return (r.content[0] as { type: string; text: string }).text.trim();
  } catch (err) {
    return `Oi! Passando para ver se tudo certo com você — podemos dar andamento no projeto? Qualquer dúvida estou por aqui.`;
  }
}

export async function processarFollowups(): Promise<void> {
  const queue = readJson<FollowupEntry[]>(QUEUE_FILE) || [];
  const pendentes = queue.filter((e) => e.status === 'pendente' && e.data_envio === hoje());

  if (pendentes.length === 0) {
    log.info('Follow-up: nenhum agendado para hoje');
    return;
  }

  log.info(`Follow-up: ${pendentes.length} agendado(s) para hoje`);

  for (const entry of pendentes) {
    try {
      if (leadJaRespondeu(entry.telefone)) {
        log.info(`Follow-up: ${entry.nome_negocio} já respondeu — cancelando`);
        entry.status = 'cancelado';
        continue;
      }

      const mensagem = await gerarFollowup(entry);
      log.info(`Follow-up para ${entry.nome_negocio}: "${mensagem.slice(0, 80)}"`);

      const ok = await sendWhatsApp(entry.telefone, mensagem);
      if (ok) {
        entry.status = 'enviado';
        entry.enviado_em = new Date().toISOString();
        log.success(`Follow-up enviado para ${entry.nome_negocio}`);
        await notifyOwner(
          `Follow-up enviado para ${entry.nome_negocio}:\n"${mensagem}"`,
          `📬 Follow-up — ${entry.nome_negocio}`
        );
      } else {
        log.warn(`Follow-up: falha ao enviar para ${entry.nome_negocio}`);
      }
    } catch (err) {
      log.error(`Follow-up erro (${entry.nome_negocio}): ${(err as Error).message}`);
    }
  }

  writeJson(QUEUE_FILE, queue);
}

/** Adiciona um follow-up à fila */
export function agendarFollowup(entry: Omit<FollowupEntry, 'id' | 'status'>): void {
  const queue = readJson<FollowupEntry[]>(QUEUE_FILE) || [];
  queue.push({ ...entry, id: Math.random().toString(36).slice(2), status: 'pendente' });
  writeJson(QUEUE_FILE, queue);
  log.info(`Follow-up agendado para ${entry.nome_negocio} em ${entry.data_envio}`);
}

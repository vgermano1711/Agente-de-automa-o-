/**
 * Agente 7 — Handler de Respostas (roda continuamente, 24/7)
 * Polling a cada N minutos no Gmail, detecta respostas de leads,
 * gera draft de reply + propõe horários no Calendar, notifica dono para aprovação.
 */

import { google } from 'googleapis';
import Anthropic from '@anthropic-ai/sdk';
import path from 'path';
import fs from 'fs';
import { RespostaLead, CalendarSlot } from '../types';
import { log } from '../utils/logger';
import { readJson, writeJson, generateId } from '../utils/dataHelpers';
import { notifyOwner } from '../utils/notifications';

const client = new Anthropic();
const RESPOSTAS_FILE = path.join(process.cwd(), 'data', 'respostas.json');
const PROCESSED_IDS_FILE = path.join(process.cwd(), 'data', 'gmail_processed.json');

function getGmailAuth() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) return null;

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });
  return oauth2;
}

function loadProcessedIds(): Set<string> {
  const data = readJson<string[]>(PROCESSED_IDS_FILE);
  return new Set(data || []);
}

function saveProcessedIds(ids: Set<string>): void {
  writeJson(PROCESSED_IDS_FILE, Array.from(ids));
}

async function fetchNewReplies(auth: ReturnType<typeof getGmailAuth>): Promise<
  Array<{
    threadId: string;
    messageId: string;
    from: string;
    subject: string;
    body: string;
  }>
> {
  if (!auth) return [];

  const gmail = google.gmail({ version: 'v1', auth });
  const processedIds = loadProcessedIds();

  try {
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:inbox is:unread',
      maxResults: 20,
    });

    const messages = res.data.messages || [];
    const replies = [];

    for (const msg of messages) {
      if (!msg.id || processedIds.has(msg.id)) continue;

      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'full',
      });

      const headers = detail.data.payload?.headers || [];
      const from = headers.find((h) => h.name === 'From')?.value || '';
      const subject = headers.find((h) => h.name === 'Subject')?.value || '';

      // Só processa se for reply (subject começa com Re:)
      if (!subject.toLowerCase().startsWith('re:')) {
        processedIds.add(msg.id);
        continue;
      }

      let body = '';
      const parts = detail.data.payload?.parts || [detail.data.payload];
      for (const part of parts) {
        if (part?.mimeType === 'text/plain' && part.body?.data) {
          body = Buffer.from(part.body.data, 'base64').toString('utf-8');
          break;
        }
      }

      replies.push({
        threadId: msg.threadId || msg.id,
        messageId: msg.id,
        from,
        subject,
        body: body.slice(0, 2000),
      });

      processedIds.add(msg.id);
    }

    saveProcessedIds(processedIds);
    return replies;
  } catch (err) {
    log.error(`Gmail polling falhou: ${(err as Error).message}`);
    return [];
  }
}

async function getCalendarSlots(auth: ReturnType<typeof getGmailAuth>): Promise<CalendarSlot[]> {
  if (!auth) {
    const base = new Date();
    base.setDate(base.getDate() + 1);
    return [1, 2, 3].map((i) => {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      d.setHours(10, 0, 0, 0);
      const fim = new Date(d);
      fim.setMinutes(30);
      return {
        inicio: d.toISOString(),
        fim: fim.toISOString(),
        link_calendly: process.env.CALENDLY_LINK || undefined,
      };
    });
  }

  const calendar = google.calendar({ version: 'v3', auth });
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + 7);

  try {
    const busyRes = await calendar.freebusy.query({
      requestBody: {
        timeMin: now.toISOString(),
        timeMax: end.toISOString(),
        items: [{ id: 'primary' }],
      },
    });

    const busy = (busyRes.data.calendars?.primary?.busy || []).map((b) => ({
      start: new Date(b.start || ''),
      end: new Date(b.end || ''),
    }));

    const slots: CalendarSlot[] = [];
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + 1);
    candidate.setHours(9, 0, 0, 0);

    while (slots.length < 3 && candidate < end) {
      const slotEnd = new Date(candidate);
      slotEnd.setMinutes(30);
      const conflicts = busy.filter(
        (b) => candidate < b.end && slotEnd > b.start
      );

      if (conflicts.length === 0 && candidate.getDay() !== 0 && candidate.getDay() !== 6) {
        slots.push({
          inicio: candidate.toISOString(),
          fim: slotEnd.toISOString(),
          link_calendly: process.env.CALENDLY_LINK || undefined,
        });
      }

      candidate.setMinutes(candidate.getMinutes() + 30);
      if (candidate.getHours() >= 18) {
        candidate.setDate(candidate.getDate() + 1);
        candidate.setHours(9, 0, 0, 0);
      }
    }

    return slots;
  } catch {
    return [];
  }
}

async function generateDraftReply(
  from: string,
  subject: string,
  body: string,
  slots: CalendarSlot[]
): Promise<string> {
  const slotsText = slots
    .map((s, i) => {
      const d = new Date(s.inicio);
      return `Opção ${i + 1}: ${d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    })
    .join('\n');

  const prompt = `Você é um assistente de vendas. Gere um draft de resposta curto e humano para este email de um potencial cliente.

De: ${from}
Assunto: ${subject}
Mensagem recebida:
---
${body}
---

Horários disponíveis para call de 30min:
${slotsText}
${process.env.CALENDLY_LINK ? `\nLink de agendamento: ${process.env.CALENDLY_LINK}` : ''}

Instruções:
- Tom amigável e direto, sem linguagem de IA genérica
- Propor os 3 horários acima OU o link do Calendly
- Máx 3 parágrafos
- Não assine com nome específico (o dono vai revisar antes de enviar)
- Não use "Atenciosamente" ou similares em excesso`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });
    return (response.content[0] as { type: string; text: string }).text.trim();
  } catch {
    return `Olá! Obrigado por responder.\n\nTeria disponibilidade para uma conversa rápida de 30 minutos? Seguem alguns horários:\n\n${slotsText}\n\nQual funciona melhor pra você?`;
  }
}

async function processReplies(auth: ReturnType<typeof getGmailAuth>): Promise<void> {
  const replies = await fetchNewReplies(auth);
  if (replies.length === 0) return;

  log.info(`Agent 7: ${replies.length} nova(s) resposta(s) detectada(s)`);

  const respostas = readJson<RespostaLead[]>(RESPOSTAS_FILE) || [];
  const slots = await getCalendarSlots(auth);

  for (const reply of replies) {
    const draft = await generateDraftReply(reply.from, reply.subject, reply.body, slots);

    const resposta: RespostaLead = {
      mensagem_id: generateId(),
      lead_id: '',
      nome_negocio: reply.from,
      email_from: reply.from,
      assunto_original: reply.subject,
      corpo_resposta: reply.body,
      gmail_thread_id: reply.threadId,
      gmail_message_id: reply.messageId,
      horarios_propostos: slots,
      draft_reply: draft,
      data_recebimento: new Date().toISOString(),
      status: 'pendente_aprovacao',
    };

    respostas.push(resposta);

    const panelUrl = process.env.APPROVAL_PANEL_URL || 'http://localhost:3000';
    await notifyOwner(
      `Nova resposta de: ${reply.from}\n\nResumo: "${reply.body.slice(0, 100)}..."\n\nAcesse o painel para aprovar a resposta: ${panelUrl}`,
      '📩 Lead respondeu!'
    );
  }

  writeJson(RESPOSTAS_FILE, respostas);
}

export function startAgent7Loop({ intervalMinutes = 5 }: { intervalMinutes?: number } = {}): void {
  log.info(`Agente 7 — Handler de Respostas iniciado (polling a cada ${intervalMinutes}min)`);

  const auth = getGmailAuth();
  if (!auth) {
    log.warn('Agente 7: credenciais Gmail não configuradas — rodando em modo mockado');
  }

  const run = async () => {
    try {
      await processReplies(auth);
    } catch (err) {
      log.error(`Agente 7 erro: ${(err as Error).message}`);
    }
  };

  run();
  setInterval(run, intervalMinutes * 60 * 1000);
}

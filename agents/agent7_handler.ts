/**
 * Agente 7 — Handler de Respostas (roda continuamente, 24/7)
 * Polling a cada N minutos no Gmail, detecta respostas de leads,
 * gera draft de reply + propõe horários no Calendar, notifica dono para aprovação.
 */

import { google } from 'googleapis';
import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { RespostaLead, CalendarSlot, Diagnostico, Mensagem, Projeto } from '../types';
import { log } from '../utils/logger';
import { readJson, writeJson, generateId } from '../utils/dataHelpers';
import { notifyOwner } from '../utils/notifications';
import { registrarNaCadencia } from './cadencia';
import { isNaBlacklist, randomShortDelay } from '../utils/antiSpam';
import { obterOuCriarCobrancaPendente } from '../utils/cobranca';

const client = new Anthropic();
const RESPOSTAS_FILE     = path.join(process.cwd(), 'data', 'respostas.json');
const PROCESSED_IDS_FILE = path.join(process.cwd(), 'data', 'gmail_processed.json');
const PROBE_QUEUE_FILE   = path.join(process.cwd(), 'data', 'probe_queue.json');
const BOT_RESPONSES_FILE = path.join(process.cwd(), 'data', 'bot_responses.json');

interface ProbeQueueEntry {
  id: string;
  telefone: string;
  nome_negocio: string;
  probe_enviado_em: string;
  corpo_completo: string;
  canal: string;
  msg_id: string;
  msg_file: string;
  diag_snapshot: Diagnostico;
  msg_snapshot: Mensagem;
  video_path?: string | null;
}

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

function updateMsgStatus(msgFile: string, msgId: string, status: Mensagem['status']): void {
  try {
    const msgs = readJson<Mensagem[]>(msgFile) || [];
    const idx = msgs.findIndex((m) => m.id === msgId);
    if (idx !== -1) {
      msgs[idx].status = status;
      if (status === 'enviado') msgs[idx].data_envio = new Date().toISOString();
      writeJson(msgFile, msgs);
    }
  } catch (err) {
    log.warn(`updateMsgStatus: ${(err as Error).message}`);
  }
}

const CONVERSAS_FILE       = path.join(process.cwd(), 'data', 'conversas_whatsapp.json');
const FILA_RESPOSTAS_FILE  = path.join(process.cwd(), 'data', 'fila_respostas.json');
const PROJETOS_FILE        = path.join(process.cwd(), 'data', 'projetos.json');
const INDICACOES_FILE      = path.join(process.cwd(), 'data', 'indicacoes.json');
const RELATORIO_LOG_FILE   = path.join(process.cwd(), 'data', 'relatorio_matinal_log.json');

interface ConversaMsgMin { role: string; texto: string; data: string; }
interface ConversaMin {
  phone: string;
  slug?: string;
  nome_negocio: string;
  estagio: string;
  segmento?: string;
  mensagens: ConversaMsgMin[];
  followups_frios?: number;
  ultimo_followup_frio?: string;
  proxima_mensagem_agendada?: { texto: string; enviar_em: string };
  // PIX tracking
  pix_enviado?: boolean;
  pix_lembrete_count?: number;
  ultimo_pix_lembrete?: string;
  comprovante_recebido?: boolean;
  opcao_escolhida?: 1 | 2 | 3;
  // Reativação encerrado
  reativacao_90d_enviada?: boolean;
  [key: string]: unknown;
}

const NUDGE_1: Record<string, string> = {
  primeiro_contato: 'Oi! Tudo bem? Passando pra saber se chegou a ver a demonstração que te mandei. Qualquer dúvida é só falar.',
  interesse:        'Oi! Ficou alguma dúvida sobre a demonstração? Qualquer coisa é só falar.',
  negociacao:       'Oi! Só passando pra saber se ficou alguma dúvida sobre as opções que te mandei.',
  objecao:          'Oi, tudo bem? Se quiser retomar quando for o momento certo, estarei por aqui.',
};

function nudge2(c: ConversaMin): string {
  const seg = c.segmento ? `${c.segmento} ` : 'negócio ';
  const por: Record<string, string> = {
    interesse:  `Oi! Acabei de finalizar um projeto pra um ${seg}aqui na região. Caso queira ver como ficou pra ter uma ideia, é só me chamar.`,
    negociacao: `Oi! Estou por aqui caso queira retomar. Se quiser ajustar algum detalhe das opções que te passei, é só falar.`,
    objecao:    `Oi! Se o momento mudar por aí, pode me chamar. Estarei por aqui.`,
  };
  return por[c.estagio] || 'Oi! Se tiver alguma dúvida, pode me chamar quando quiser.';
}

async function processConversasFrias(): Promise<void> {
  const conversas = readJson<ConversaMin[]>(CONVERSAS_FILE) || [];
  if (conversas.length === 0) return;

  const now = Date.now();
  const MS_24H  = 24  * 60 * 60 * 1000;
  const MS_72H  = 72  * 60 * 60 * 1000;
  const MS_10D  = 10  * 24 * 60 * 60 * 1000;
  const port = process.env.PORT || '3000';
  let nudgeCount = 0;
  let alterou = false;

  for (const c of conversas) {
    if (!['primeiro_contato', 'interesse', 'negociacao', 'objecao'].includes(c.estagio)) continue;

    const enviados = c.followups_frios ?? 0;
    if (enviados >= 4) continue; // máx 4: 24h + 72h + 10d + encerramento gracioso

    let texto: string;

    // Usa a última mensagem DO LEAD como referência — não a última mensagem geral.
    // O bot sempre responde, então checar c.mensagens[-1].role === 'lead' bloquearia todos.
    const ultimaLead = [...c.mensagens].reverse().find((m) => m.role === 'lead');
    if (!ultimaLead) continue;
    const ultimaBot  = [...c.mensagens].reverse().find((m) => m.role === 'victor');
    // Não nudge se o bot respondeu há menos de 6h (deixa o lead ter tempo de ver a resp)
    if (ultimaBot && now - new Date(ultimaBot.data).getTime() < 6 * 60 * 60 * 1000) continue;

    if (enviados === 0) {
      // Primeiro nudge: 24h desde a última mensagem do lead
      if (now - new Date(ultimaLead.data).getTime() < MS_24H) continue;
      texto = NUDGE_1[c.estagio] || 'Ficou alguma dúvida? Estou por aqui.';
    } else if (enviados === 1) {
      // Segundo nudge: 72h após o primeiro
      if (!c.ultimo_followup_frio) continue;
      if (now - new Date(c.ultimo_followup_frio).getTime() < MS_72H) continue;
      texto = nudge2(c);
    } else if (enviados === 2) {
      // Terceiro nudge (reativação): 10 dias após o segundo
      if (!c.ultimo_followup_frio) continue;
      if (now - new Date(c.ultimo_followup_frio).getTime() < MS_10D) continue;
      const seg = (c.segmento || 'negócios').toLowerCase();
      texto = `Oi! Passaram alguns dias desde o nosso contato. Semana passada comecei alguns projetos de ${seg} e tenho disponibilidade pra mais um essa semana. Se o momento mudou ou ficou alguma dúvida, pode falar que a gente encaixa.`;
    } else {
      // Quarto (encerramento gracioso): 10 dias após o terceiro
      if (!c.ultimo_followup_frio) continue;
      if (now - new Date(c.ultimo_followup_frio).getTime() < MS_10D) continue;
      const segE = (c.segmento || 'negócios').toLowerCase();
      texto = `Oi! Tentei algumas vezes entrar em contato sobre o site de ${segE}. Vou deixar espaço por aqui — se quiser retomar quando for o momento certo, é só me chamar. Qualquer coisa estarei por aqui.`;
    }

    try {
      const resp = await axios.post(
        `http://localhost:${port}/api/whatsapp/send`,
        { phone: c.phone, message: texto },
        { timeout: 15000 }
      );

      if (resp.data?.success) {
        const agora = new Date().toISOString();
        c.followups_frios = enviados + 1;
        c.ultimo_followup_frio = agora;
        c.mensagens.push({ role: 'victor', texto, data: agora });
        nudgeCount++;
        alterou = true;
        const isEncerramento = enviados === 3;
        if (isEncerramento) {
          c.estagio = 'encerrado'; // encerramento gracioso após 4 tentativas
          log.info(`Agent7: ${c.nome_negocio} movido para encerrado após 4 follow-ups sem resposta`);
        }
        const labelNudge = enviados === 0 ? '24h' : enviados === 1 ? '72h' : enviados === 2 ? '10 dias' : 'encerramento';
        log.success(`Agent7: follow-up frio ${enviados + 1}/4 → ${c.nome_negocio} [${isEncerramento ? 'encerrado' : c.estagio}]`);
        await notifyOwner(
          `🌡️ Follow-up ${enviados + 1}/4 enviado para ${c.nome_negocio} após ${labelNudge} de silêncio.${isEncerramento ? '\nConversa encerrada graciosamente.' : `\nEstágio: ${c.estagio}`}`,
          isEncerramento ? `🔚 ${c.nome_negocio} — encerrado` : '🌡️ Follow-up frio'
        );
      }
    } catch (err) {
      log.warn(`Agent7: follow-up frio falhou para ${c.nome_negocio}: ${(err as Error).message}`);
    }
  }

  if (alterou) writeJson(CONVERSAS_FILE, conversas);
  if (nudgeCount > 0) log.info(`Agent7: ${nudgeCount} follow-up(s) frio(s) enviado(s)`);
}

// ── Onboarding pós-pagamento ──────────────────────────────────────────────────

interface ConversaOnboarding extends ConversaMin {
  slug: string;
  phone: string;
  comprovante_recebido?: boolean;
  comprovante_recebido_em?: string;
  opcao_escolhida?: 1 | 2 | 3;
}

async function processOnboardings(): Promise<void> {
  const conversas = readJson<ConversaOnboarding[]>(CONVERSAS_FILE) || [];
  const projetos  = readJson<Projeto[]>(PROJETOS_FILE) || [];
  const port      = process.env.PORT || '3000';
  const ESPERA_MS = 30 * 60 * 1000; // 30 min após comprovante
  const now       = Date.now();
  let alterou     = false;

  for (const c of conversas) {
    // Só processa conversas com comprovante recebido no estágio fechamento
    if (c.estagio !== 'fechamento') continue;
    if (!c.comprovante_recebido || !c.comprovante_recebido_em) continue;
    if (now - new Date(c.comprovante_recebido_em).getTime() < ESPERA_MS) continue;

    // Verifica se projeto já existe (evita duplicata)
    const jaExiste = projetos.some((p) => p.slug === c.slug);

    try {
      const boas_vindas =
        `Pagamento confirmado! Muito obrigado pela confiança — bem-vindo(a) à família 🎉\n\n` +
        `Agora vou precisar de algumas informações rápidas para começar o seu site. São só 5 perguntas.\n\n` +
        `Primeira: me passa o @ de vocês no Instagram ou Facebook. Se não tiver, é só falar.`;

      const resp = await axios.post(
        `http://localhost:${port}/api/whatsapp/send`,
        { phone: c.phone, message: boas_vindas },
        { timeout: 15000 }
      );

      if (resp.data?.success) {
        // Muda estágio para onboarding
        c.estagio = 'onboarding';
        (c as unknown as Record<string, unknown>).onboarding_info = { passo: 1 };
        c.mensagens.push({ role: 'victor', texto: boas_vindas, data: new Date().toISOString() });
        alterou = true;

        // Cria entrada no projetos.json (se ainda não existe)
        if (!jaExiste) {
          const novoProjeto: Projeto = {
            id:            generateId(),
            slug:          c.slug,
            nome_negocio:  c.nome_negocio,
            phone:         c.phone,
            opcao:         (c as unknown as { opcao_escolhida?: 1 | 2 | 3 }).opcao_escolhida,
            status:        'onboarding',
            comprovante_em: c.comprovante_recebido_em!,
          };
          projetos.push(novoProjeto);
          writeJson(PROJETOS_FILE, projetos);
        } else {
          const idx = projetos.findIndex((p) => p.slug === c.slug);
          if (idx !== -1) { projetos[idx].status = 'onboarding'; writeJson(PROJETOS_FILE, projetos); }
        }

        log.success(`Agent7: onboarding iniciado para ${c.nome_negocio}`);
        await notifyOwner(
          `🚀 Onboarding iniciado para ${c.nome_negocio}!\nPrimeira pergunta enviada. Acompanhe as respostas — chegam automaticamente.`,
          `🚀 ${c.nome_negocio} — Onboarding iniciado`
        );
      }
    } catch (err) {
      log.warn(`Agent7: falha ao iniciar onboarding de ${c.nome_negocio}: ${(err as Error).message}`);
    }
  }

  if (alterou) writeJson(CONVERSAS_FILE, conversas);
}

// ── Lembrete de PIX não pago ──────────────────────────────────────────────────

async function processLembretesPIX(): Promise<void> {
  const conversas = readJson<ConversaMin[]>(CONVERSAS_FILE) || [];
  const port      = process.env.PORT || '3000';
  const now       = Date.now();
  const MS_24H    = 24 * 60 * 60 * 1000;
  const MS_48H    = 48 * 60 * 60 * 1000;
  let alterou     = false;

  for (const c of conversas) {
    if (c.estagio !== 'fechamento') continue;
    if (!c.pix_enviado) continue;
    if (c.comprovante_recebido) continue;

    const count = c.pix_lembrete_count ?? 0;
    if (count >= 2) continue;

    // Data de referência: último lembrete ou última mensagem do Victor
    const refDate = c.ultimo_pix_lembrete
      ? new Date(c.ultimo_pix_lembrete).getTime()
      : (() => {
          const vMsgs = c.mensagens.filter((m) => m.role === 'victor');
          const last  = vMsgs[vMsgs.length - 1];
          return last ? new Date(last.data).getTime() : 0;
        })();

    const threshold = count === 0 ? MS_24H : MS_48H;
    if (now - refDate < threshold) continue;

    const textos = [
      'Oi! Tudo certo por aí? Fica à vontade se quiser tirar alguma dúvida antes de finalizar. Estou por aqui.',
      'Oi! Só passando uma última vez pra saber se surgiu algum ponto. Se quiser ajustar algo na proposta, é só me falar.',
    ];
    const texto = textos[count];

    try {
      const resp = await axios.post(
        `http://localhost:${port}/api/whatsapp/send`,
        { phone: c.phone, message: texto },
        { timeout: 15000 }
      );
      if (resp.data?.success) {
        c.pix_lembrete_count  = count + 1;
        c.ultimo_pix_lembrete = new Date().toISOString();
        c.mensagens.push({ role: 'victor', texto, data: new Date().toISOString() });
        alterou = true;
        const label = count === 0 ? '24h' : '48h';
        log.success(`Agent7: lembrete PIX ${count + 1}/2 → ${c.nome_negocio} (${label} sem pagamento)`);
        await notifyOwner(
          `💰 Lembrete ${count + 1}/2 enviado para ${c.nome_negocio} — pagamento pendente há ${label}.`,
          '💰 Abandono de pagamento'
        );
      }
    } catch (err) {
      log.warn(`Agent7: lembrete PIX falhou para ${c.nome_negocio}: ${(err as Error).message}`);
    }
  }
  if (alterou) writeJson(CONVERSAS_FILE, conversas);
}

// ── Mensagens agendadas manualmente ───────────────────────────────────────────

async function processAgendamentos(): Promise<void> {
  const conversas = readJson<ConversaMin[]>(CONVERSAS_FILE) || [];
  const agora = Date.now();
  let alterou = false;
  for (const c of conversas) {
    if (!c.proxima_mensagem_agendada) continue;
    const { texto, enviar_em } = c.proxima_mensagem_agendada;
    if (agora < new Date(enviar_em).getTime()) continue;
    const port = process.env.PORT || '3000';
    const resp = await fetch(`http://localhost:${port}/api/whatsapp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: c.phone, message: texto }),
    }).catch(() => null);
    if (resp?.ok) {
      const now = new Date().toISOString();
      c.mensagens.push({ role: 'victor', texto, data: now });
      c.ultima_atualizacao = now;
      delete c.proxima_mensagem_agendada;
      alterou = true;
      log.info(`Agendamento enviado para ${c.nome_negocio} (${c.phone})`);
    }
  }
  if (alterou) writeJson(CONVERSAS_FILE, conversas);
}

// ── Follow-up pós-entrega (satisfação + avaliação Google) ─────────────────────

async function processFollowupEntrega(): Promise<void> {
  const projetos  = readJson<Projeto[]>(PROJETOS_FILE) || [];
  const conversas = readJson<ConversaMin[]>(CONVERSAS_FILE) || [];
  const port      = process.env.PORT || '3000';
  const now       = Date.now();
  const MS_7D     = 7 * 24 * 60 * 60 * 1000;
  let projetosAlterou = false;

  for (const p of projetos) {
    if (p.status !== 'entregue') continue;
    if (p.satisfacao_followup_enviado_em) continue;
    if (!p.entregue_em) continue;
    if (now - new Date(p.entregue_em).getTime() < MS_7D) continue;

    const texto =
      `Oi! Faz uma semana desde que entregamos o site de vocês. Como está ficando? Tem algum ajuste que queira fazer?\n\n` +
      `Se estiver satisfeito(a), ficaria muito bem se pudesse nos avaliar no Google — ajuda demais a gente crescer. Posso te mandar o link direto se quiser.`;

    try {
      const resp = await axios.post(
        `http://localhost:${port}/api/whatsapp/send`,
        { phone: p.phone, message: texto },
        { timeout: 15000 }
      );
      if (resp.data?.success) {
        p.satisfacao_followup_enviado_em = new Date().toISOString();
        projetosAlterou = true;
        const conv = conversas.find((c) => c.slug === p.slug || c.phone === p.phone);
        if (conv) { conv.mensagens.push({ role: 'victor', texto, data: new Date().toISOString() }); writeJson(CONVERSAS_FILE, conversas); }
        log.success(`Agent7: follow-up satisfação → ${p.nome_negocio}`);
        await notifyOwner(`⭐ Follow-up de satisfação enviado para ${p.nome_negocio} (7 dias após entrega).`, '⭐ Pós-entrega');
      }
    } catch (err) {
      log.warn(`Agent7: follow-up entrega falhou para ${p.nome_negocio}: ${(err as Error).message}`);
    }
  }
  if (projetosAlterou) writeJson(PROJETOS_FILE, projetos);
}

// ── Cobrança mensal recorrente (automação) ────────────────────────────────────

async function processCobrancaMensalAuto(): Promise<void> {
  const projetos  = readJson<Projeto[]>(PROJETOS_FILE) || [];
  const conversas = readJson<ConversaMin[]>(CONVERSAS_FILE) || [];
  const port      = process.env.PORT || '3000';
  const now       = Date.now();
  const MS_30D    = 30 * 24 * 60 * 60 * 1000;
  let alterou     = false;

  for (const p of projetos) {
    if ((p as unknown as Record<string, unknown>).tipo_produto !== 'automacao') continue;
    if (!['em_producao', 'entregue', 'ativo'].includes(p.status)) continue;

    const ref = (p as unknown as Record<string, unknown>).ultimo_cobranca_mensal as string | undefined
      || (p as unknown as Record<string, unknown>).ativo_desde as string | undefined
      || p.comprovante_em;
    if (!ref || now - new Date(ref).getTime() < MS_30D) continue;

    const mensalidade = (p as unknown as Record<string, unknown>).mensalidade as number | undefined || 297;
    const pixKey = process.env.VICTOR_PIX_KEY || '';
    let pixInfo = 'Me fala que te mando os dados do PIX agora.';
    if (pixKey) {
      try {
        const cobranca = obterOuCriarCobrancaPendente(p);
        pixInfo = `Pix Copia e Cola:\n${cobranca.copia_e_cola}\n\nValor: *R$${mensalidade},00*`;
      } catch (err) {
        log.warn(`Agent7: falha ao gerar Pix pra ${p.nome_negocio}: ${(err as Error).message}`);
        pixInfo = `Chave PIX: *${pixKey}*\nValor: *R$${mensalidade},00*`;
      }
    }

    const texto =
      `Oi! Tudo bem por aí?\n\n` +
      `Passando para lembrar da mensalidade do bot de WhatsApp — *R$${mensalidade},00* referente a este mês.\n\n` +
      `${pixInfo}\n\n` +
      `Qualquer dúvida ou ajuste no bot é só me chamar!`;

    try {
      const resp = await axios.post(
        `http://localhost:${port}/api/whatsapp/send`,
        { phone: p.phone, message: texto },
        { timeout: 15000 }
      );
      if (resp.data?.success) {
        (p as unknown as Record<string, unknown>).ultimo_cobranca_mensal = new Date().toISOString();
        alterou = true;
        const conv = conversas.find((c) => c.slug === p.slug || c.phone === p.phone);
        if (conv) {
          conv.mensagens.push({ role: 'victor', texto, data: new Date().toISOString() });
          writeJson(CONVERSAS_FILE, conversas);
        }
        log.success(`Agent7: cobrança mensal auto → ${p.nome_negocio} (R$${mensalidade})`);
        await notifyOwner(
          `💵 Mensalidade enviada para ${p.nome_negocio} — R$${mensalidade},00/mês.`,
          '💵 Mensalidade automação'
        );
      }
    } catch (err) {
      log.warn(`Agent7: cobrança mensal falhou para ${p.nome_negocio}: ${(err as Error).message}`);
    }
  }
  if (alterou) writeJson(PROJETOS_FILE, projetos);
}

// ── Cobrança da segunda parcela ───────────────────────────────────────────────

async function processCobrancaSegundaParcela(): Promise<void> {
  const projetos = readJson<Projeto[]>(PROJETOS_FILE) || [];
  const port     = process.env.PORT || '3000';
  const now      = Date.now();
  const MS_3D    = 3 * 24 * 60 * 60 * 1000;
  const VALORES: Record<1|2|3, number> = { 1: 297, 2: 447, 3: 347 };
  let alterou    = false;

  for (const p of projetos) {
    if ((p as unknown as Record<string, unknown>).tipo_produto === 'automacao') continue; // automação tem mensalidade, não segunda parcela
    if (p.status !== 'entregue') continue;
    if (p.segunda_parcela_paga) continue;
    if (p.segunda_parcela_lembrete_enviado_em) continue;
    if (!p.entregue_em) continue;
    if (now - new Date(p.entregue_em).getTime() < MS_3D) continue;
    if (!p.opcao) continue;

    const valor  = VALORES[p.opcao];
    const pixKey = process.env.VICTOR_PIX_KEY || '';
    const pixInfo = pixKey
      ? `Chave PIX: *${pixKey}*\nValor: *R$${valor},00*`
      : 'Me fala que te mando os dados do PIX agora.';

    const texto =
      `Oi! O site de vocês está no ar. Só precisamos finalizar a segunda e última parcela de *R$${valor},00* para encerrar tudo.\n\n${pixInfo}\n\nQualquer dúvida pode me chamar!`;

    try {
      const resp = await axios.post(
        `http://localhost:${port}/api/whatsapp/send`,
        { phone: p.phone, message: texto },
        { timeout: 15000 }
      );
      if (resp.data?.success) {
        p.segunda_parcela_lembrete_enviado_em = new Date().toISOString();
        alterou = true;
        log.success(`Agent7: cobrança 2ª parcela → ${p.nome_negocio} (R$${valor})`);
        await notifyOwner(`💵 Cobrança da 2ª parcela enviada para ${p.nome_negocio} — R$${valor},00 pendente.`, '💵 2ª Parcela');
      }
    } catch (err) {
      log.warn(`Agent7: cobrança 2ª parcela falhou para ${p.nome_negocio}: ${(err as Error).message}`);
    }
  }
  if (alterou) writeJson(PROJETOS_FILE, projetos);
}

// ── Upsell de automação para clientes de site (pós-entrega) ─────────────────

async function processUpsellAutomacao(): Promise<void> {
  const projetos   = readJson<Projeto[]>(PROJETOS_FILE) || [];
  const conversas  = readJson<ConversaMin[]>(CONVERSAS_FILE) || [];
  const configData = readJson<Record<string, unknown>>(path.join(process.cwd(), 'config.json')) || {};
  const mapaSegmentos = (configData.segmentos_upsell_automacao || {}) as Record<string, string>;
  const port   = process.env.PORT || '3000';
  const now    = Date.now();
  const MS_45D = 45 * 24 * 60 * 60 * 1000;
  let alterou  = false;

  for (const p of projetos) {
    const pExt = p as unknown as Record<string, unknown>;
    if (pExt.tipo_produto === 'automacao') continue;   // já é cliente de automação
    if (p.status !== 'entregue') continue;
    if (pExt.upsell_automacao_enviado_em) continue;
    if (!p.entregue_em) continue;
    if (now - new Date(p.entregue_em).getTime() < MS_45D) continue;

    // Descobre o segmento a partir da conversa
    const conv = conversas.find((c) => c.slug === p.slug || c.phone === p.phone);
    const segmento = (conv?.segmento || '').toLowerCase();
    const tipoAuto = mapaSegmentos[segmento];
    if (!tipoAuto) continue; // segmento não elegível

    const segDisplay = segmento || 'negócio';
    let texto = '';

    if (tipoAuto === 'agendamento') {
      texto =
        `Oi! Como está indo o site? Espero que esteja trazendo resultado.\n\n` +
        `Olhando o mercado de ${segDisplay}, uma coisa que tem funcionado muito bem é um bot de agendamento pelo WhatsApp — o cliente escolhe o horário sozinho, a qualquer hora, sem precisar de ninguém pra responder na hora.\n\n` +
        `Você evita perder cliente por demora na resposta, e ainda libera tempo da equipe pra focar no atendimento em si.\n\n` +
        `Quer ver uma demonstração de como ficaria pra vocês?`;
    } else if (tipoAuto === 'cardapio') {
      texto =
        `Oi! Como está o movimento com o site?\n\n` +
        `Tenho visto muitos clientes de ${segDisplay} usando junto um bot de cardápio/pedido pelo WhatsApp — o cliente manda mensagem, recebe o cardápio na hora e faz o pedido automaticamente, sem precisar ninguém pra atender.\n\n` +
        `Funciona especialmente bem nos horários de pico, quando a equipe está ocupada.\n\n` +
        `Posso montar uma demo personalizada pra vocês se quiser ver como ficaria.`;
    } else if (tipoAuto === 'reativacao') {
      texto =
        `Oi! Como está indo o site?\n\n` +
        `Uma coisa que tem dado muito resultado pra ${segDisplay} é um bot de reativação de clientes — ele identifica automaticamente quem não aparece há mais de 30 dias e manda uma mensagem chamando de volta, sem você precisar fazer nada.\n\n` +
        `É basicamente receita passiva: cliente que sumiu volta a aparecer no automático.\n\n` +
        `Quer que eu monte uma demonstração?`;
    } else {
      texto =
        `Oi! Como está indo o site?\n\n` +
        `Com o site rodando, o próximo passo que mais faz diferença é um bot de atendimento pelo WhatsApp — ele responde automaticamente as dúvidas mais comuns: horários, preços, localização, serviços. Tudo sem você precisar parar o que está fazendo.\n\n` +
        `Clientes recebem resposta na hora, o que reduz bastante a perda por falta de resposta rápida.\n\n` +
        `Quer ver como funcionaria pra ${segDisplay}?`;
    }

    try {
      const resp = await axios.post(
        `http://localhost:${port}/api/whatsapp/send`,
        { phone: p.phone, message: texto },
        { timeout: 15000 }
      );
      if (resp.data?.success) {
        pExt.upsell_automacao_enviado_em = new Date().toISOString();
        alterou = true;
        if (conv) {
          conv.mensagens.push({ role: 'victor', texto, data: new Date().toISOString() });
          writeJson(CONVERSAS_FILE, conversas);
        }
        log.success(`Agent7: upsell automação (${tipoAuto}) → ${p.nome_negocio}`);
        await notifyOwner(
          `🤖 Upsell de automação (${tipoAuto}) enviado para ${p.nome_negocio} — cliente de site há 45+ dias.`,
          '🤖 Upsell Automação'
        );
      }
    } catch (err) {
      log.warn(`Agent7: upsell automação falhou para ${p.nome_negocio}: ${(err as Error).message}`);
    }
  }
  if (alterou) writeJson(PROJETOS_FILE, projetos);
}

// ── Upsell para plano de manutenção ──────────────────────────────────────────

async function processUpsellManutencao(): Promise<void> {
  const projetos = readJson<Projeto[]>(PROJETOS_FILE) || [];
  const port     = process.env.PORT || '3000';
  const now      = Date.now();
  const MS_30D   = 30 * 24 * 60 * 60 * 1000;
  let alterou    = false;

  for (const p of projetos) {
    if ((p as unknown as Record<string, unknown>).tipo_produto === 'automacao') continue; // automação não tem upsell de manutenção
    if (p.status !== 'entregue') continue;
    if (p.opcao === 3) continue; // já tem manutenção
    if (p.upsell_enviado_em) continue;
    if (!p.entregue_em) continue;
    if (now - new Date(p.entregue_em).getTime() < MS_30D) continue;

    const texto =
      `Oi! Faz um mês que o site de vocês está no ar — como está indo?\n\n` +
      `Tenho um plano de manutenção por R$149/mês que inclui: atualização de conteúdo, monitoramento 24/7, suporte WhatsApp direto e relatório mensal de acessos.\n\n` +
      `Vários clientes optaram por isso depois que viram o resultado. Quer mais detalhes?`;

    try {
      const resp = await axios.post(
        `http://localhost:${port}/api/whatsapp/send`,
        { phone: p.phone, message: texto },
        { timeout: 15000 }
      );
      if (resp.data?.success) {
        p.upsell_enviado_em = new Date().toISOString();
        alterou = true;
        log.success(`Agent7: upsell manutenção → ${p.nome_negocio}`);
        await notifyOwner(`🔄 Upsell de manutenção enviado para ${p.nome_negocio} (30 dias após entrega).`, '🔄 Upsell');
      }
    } catch (err) {
      log.warn(`Agent7: upsell falhou para ${p.nome_negocio}: ${(err as Error).message}`);
    }
  }
  if (alterou) writeJson(PROJETOS_FILE, projetos);
}

// ── Reativação de encerrados (90 dias) ───────────────────────────────────────

async function processReativacaoEncerrados(): Promise<void> {
  const conversas = readJson<ConversaMin[]>(CONVERSAS_FILE) || [];
  const port      = process.env.PORT || '3000';
  const now       = Date.now();
  const MS_90D    = 90 * 24 * 60 * 60 * 1000;
  let alterou     = false;

  for (const c of conversas) {
    if (c.estagio !== 'encerrado') continue;
    if (c.reativacao_90d_enviada) continue;

    const ultima = c.mensagens[c.mensagens.length - 1];
    if (!ultima) continue;
    if (now - new Date(ultima.data).getTime() < MS_90D) continue;

    const seg  = (c.segmento || 'seu negócio').toLowerCase();
    const texto =
      `Oi! Passaram 3 meses desde o nosso último contato. O mercado digital mudou bastante — hoje um site bem feito faz diferença real para ${seg}.\n\n` +
      `Se o momento mudou por aí e quiser conversar, é só me chamar. Sem compromisso.`;

    try {
      const resp = await axios.post(
        `http://localhost:${port}/api/whatsapp/send`,
        { phone: c.phone, message: texto },
        { timeout: 15000 }
      );
      if (resp.data?.success) {
        c.reativacao_90d_enviada = true;
        c.estagio = 'primeiro_contato'; // volta ao funil
        c.mensagens.push({ role: 'victor', texto, data: new Date().toISOString() });
        alterou = true;
        log.success(`Agent7: reativação 90d → ${c.nome_negocio}`);
      }
    } catch (err) {
      log.warn(`Agent7: reativação 90d falhou para ${c.nome_negocio}: ${(err as Error).message}`);
    }
  }
  if (alterou) writeJson(CONVERSAS_FILE, conversas);
}

// ── Follow-up de indicações ───────────────────────────────────────────────────

async function processFollowupIndicacoes(): Promise<void> {
  const indicacoes = readJson<import('../types').Indicacao[]>(INDICACOES_FILE) || [];
  const projetos   = readJson<Projeto[]>(PROJETOS_FILE) || [];
  const port       = process.env.PORT || '3000';
  const now        = Date.now();
  const MS_14D     = 14 * 24 * 60 * 60 * 1000;
  let alterou      = false;

  for (const ind of indicacoes) {
    if (ind.status !== 'detectada') continue;
    if (ind.followup_enviado_em) continue;

    // Só manda o follow-up se o projeto do indicador foi entregue
    const proj = projetos.find((p) => p.phone === ind.de_phone);
    if (!proj || proj.status !== 'entregue') continue;
    if (!proj.entregue_em) continue;
    if (now - new Date(proj.entregue_em).getTime() < MS_14D) continue;

    const texto =
      `Oi! Que ótimo que o site ficou bom. Aquele amigo/parceiro que você mencionou — chegou a falar com ele? Se quiser me apresentar, posso verificar se consigo fazer algo parecido pra ele também.`;

    try {
      const resp = await axios.post(
        `http://localhost:${port}/api/whatsapp/send`,
        { phone: ind.de_phone, message: texto },
        { timeout: 15000 }
      );
      if (resp.data?.success) {
        ind.followup_enviado_em = new Date().toISOString();
        ind.status = 'followup_enviado';
        alterou = true;
        log.success(`Agent7: follow-up indicação → ${ind.de_nome_negocio}`);
      }
    } catch (err) {
      log.warn(`Agent7: follow-up indicação falhou para ${ind.de_nome_negocio}: ${(err as Error).message}`);
    }
  }
  if (alterou) writeJson(INDICACOES_FILE, indicacoes);
}

// ── Relatório matinal para Victor ─────────────────────────────────────────────

async function enviarRelatorioMatinal(): Promise<void> {
  const hora = new Date().getHours();
  if (hora < 8 || hora > 9) return;

  const logData = readJson<{ ultima_data?: string }>(RELATORIO_LOG_FILE) || {};
  const hoje    = new Date().toISOString().slice(0, 10);
  if (logData.ultima_data === hoje) return;

  const ownerWa = process.env.OWNER_WHATSAPP;
  if (!ownerWa) return;

  const conversas = readJson<ConversaMin[]>(CONVERSAS_FILE) || [];
  const projetos  = readJson<Projeto[]>(PROJETOS_FILE) || [];

  const quentes       = conversas.filter((c) => ['fechamento', 'negociacao'].includes(c.estagio));
  const interesse     = conversas.filter((c) => c.estagio === 'interesse');
  const emProducao    = projetos.filter((p) => p.status === 'em_producao');
  const aguardandoPag = conversas.filter((c) => c.estagio === 'fechamento' && !c.comprovante_recebido);

  const VALORES_EST: Record<number, number> = { 1: 597, 2: 897, 3: 797 };
  const receitaFechada = projetos
    .filter((p) => ['em_producao', 'entregue'].includes(p.status))
    .reduce((s, p) => s + (VALORES_EST[p.opcao || 1] || 597), 0);
  const receitaPotencial = quentes.length * 597;

  const dataBR = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const linhas: string[] = [
    `📊 *Relatório — ${dataBR}*\n`,
    `🔥 Conversas quentes: *${quentes.length}* (fechamento/negociação)`,
    `💬 Em interesse: *${interesse.length}*`,
    `⏳ Aguardando pagamento: *${aguardandoPag.length}*`,
    `🏗️ Sites em produção: *${emProducao.length}*`,
    `💰 Pipeline (potencial): *R$${receitaPotencial.toLocaleString('pt-BR')}*`,
    `✅ Receita fechada: *R$${receitaFechada.toLocaleString('pt-BR')}*`,
  ];

  // Score de prioridade: estágio × interações × recência
  function calcScore(c: ConversaMin): number {
    const stageW: Record<string, number> = { fechamento: 100, negociacao: 70, interesse: 40, objecao: 25, primeiro_contato: 10 };
    const base  = stageW[c.estagio] ?? 0;
    const msgs  = c.mensagens.filter((m) => m.role === 'lead').length;
    const last  = [...c.mensagens].reverse().find((m) => m.role === 'lead');
    const days  = last ? Math.max(1, (Date.now() - new Date(last.data).getTime()) / 86400000) : 30;
    return base + Math.min(msgs * 3, 20) + Math.max(0, 10 - Math.floor(days));
  }

  const prioridades = [...conversas]
    .filter((c) => !['encerrado', 'onboarding', 'em_producao', 'entregue'].includes(c.estagio))
    .sort((a, b) => calcScore(b) - calcScore(a));

  if (prioridades.length > 0) {
    linhas.push('\n*Prioridades (por score):*');
    for (const c of prioridades.slice(0, 6)) {
      const score = calcScore(c);
      linhas.push(`• ${c.nome_negocio} [${c.estagio}] — score ${score}`);
    }
  }

  if (emProducao.length > 0) {
    linhas.push('\n*Em produção:*');
    for (const p of emProducao.slice(0, 4)) {
      const ref  = p.onboarding_completo_em || p.comprovante_em;
      const dias = ref ? Math.floor((Date.now() - new Date(ref).getTime()) / 86400000) : '?';
      linhas.push(`• ${p.nome_negocio} — ${dias}d (Opção ${p.opcao ?? '?'})`);
    }
  }

  linhas.push('\nBom dia! 🚀');

  try {
    const { sendWhatsApp: sendWA } = await import('../utils/whatsapp');
    await sendWA(ownerWa, linhas.join('\n'));
    writeJson(RELATORIO_LOG_FILE, { ultima_data: hoje, enviado_em: new Date().toISOString() });
    log.success('Agent7: relatório matinal enviado');
  } catch (err) {
    log.warn(`Agent7: relatório matinal falhou: ${(err as Error).message}`);
  }
}

// Limite de apresentações completas enviadas por ciclo do Agent7 (a cada intervalo, ver
// startAgent7Loop). Evita que uma fila represada (ex: bot ficou offline por um tempo e
// muitas entradas "maduraram" ao mesmo tempo) dispare uma rajada de mensagens simultâneas —
// gatilho clássico de bloqueio por alto volume no WhatsApp. O excedente fica em `remaining`
// e é retomado nos próximos ciclos, no ritmo normal.
const PROBE_MAX_ENVIOS_POR_CICLO = 5;

async function processProbeQueue(): Promise<void> {
  const queue = readJson<ProbeQueueEntry[]>(PROBE_QUEUE_FILE) || [];
  if (queue.length === 0) return;

  const PROBE_WAIT_MS = 30 * 60 * 1000; // 30 minutos
  const now = Date.now();
  const botData = readJson<Record<string, string>>(BOT_RESPONSES_FILE) || {};
  const remaining: ProbeQueueEntry[] = [];
  let enviados = 0;
  let descartados = 0;

  for (const entry of queue) {
    const age = now - new Date(entry.probe_enviado_em).getTime();
    if (age < PROBE_WAIT_MS) {
      remaining.push(entry);
      continue;
    }

    const phone = entry.telefone.replace(/\D/g, '').replace(/^55/, '');
    if (botData[phone]) {
      log.info(`Agent7: ${entry.nome_negocio} — bot detectado após probe, descartando`);
      updateMsgStatus(entry.msg_file, entry.msg_id, 'bot_descartado');
      descartados++;
      continue; // remove da fila sem enviar
    }

    if (isNaBlacklist(entry.telefone)) {
      log.info(`Agent7: ${entry.nome_negocio} — número na blacklist, descartando sem enviar`);
      updateMsgStatus(entry.msg_file, entry.msg_id, 'bot_descartado');
      descartados++;
      continue;
    }

    if (enviados >= PROBE_MAX_ENVIOS_POR_CICLO) {
      remaining.push(entry); // fila represada — retoma no próximo ciclo, sem rajada
      continue;
    }

    if (enviados > 0) await randomShortDelay(); // espaça os envios dentro do mesmo ciclo

    // Humano (ou silêncio) — envia apresentação completa
    try {
      const port = process.env.PORT || '3000';
      const resp = await axios.post(
        `http://localhost:${port}/api/whatsapp/send`,
        { phone: entry.telefone, message: entry.corpo_completo },
        { timeout: 20000 }
      );

      if (resp.data?.success) {
        const sentMsg: Mensagem = {
          ...entry.msg_snapshot,
          status: 'enviado',
          data_envio: new Date().toISOString(),
        };
        updateMsgStatus(entry.msg_file, entry.msg_id, 'enviado');
        registrarNaCadencia(entry.diag_snapshot, sentMsg).catch((err: Error) =>
          log.warn(`Cadência falhou para ${entry.nome_negocio}: ${err.message}`)
        );
        enviados++;
        log.success(`Agent7: apresentação enviada para ${entry.nome_negocio}`);
        // Envio do vídeo de prévia (se existir)
        if (entry.video_path && fs.existsSync(entry.video_path)) {
          await new Promise((r) => setTimeout(r, 2500));
          try {
            const { sendMediaWhatsApp } = await import('../utils/whatsapp');
            await sendMediaWhatsApp(entry.telefone, entry.video_path, 'Olha como ficaria 👆');
            log.success(`Agent7: vídeo de prévia enviado para ${entry.nome_negocio}`);
          } catch {
            log.warn(`Agent7: falha ao enviar vídeo para ${entry.nome_negocio}`);
          }
        }
        await notifyOwner(
          `📤 ${entry.nome_negocio}\nNúmero: ${entry.telefone}\n\nApresentação completa enviada!${entry.video_path ? ' + vídeo de prévia.' : ''}`,
          '✅ Apresentação enviada'
        );
      } else if (resp.data?.numero_invalido) {
        updateMsgStatus(entry.msg_file, entry.msg_id, 'numero_invalido');
        log.warn(`Agent7: ${entry.nome_negocio} — número inválido no envio da apresentação`);
      } else {
        remaining.push(entry); // tenta novamente no próximo ciclo
        log.warn(`Agent7: falha ao enviar apresentação para ${entry.nome_negocio} — tentará novamente`);
      }
    } catch (err) {
      remaining.push(entry); // tenta novamente no próximo ciclo
      log.error(`Agent7: erro ao enviar para ${entry.nome_negocio}: ${(err as Error).message}`);
    }
  }

  writeJson(PROBE_QUEUE_FILE, remaining);
  if (enviados > 0 || descartados > 0) {
    log.info(`Agent7 fila probe: ${enviados} apresentação(ões) enviada(s), ${descartados} bot(s) descartado(s)`);
  }
}

const ENVIOS_AGENDADOS_FILE = path.join(process.cwd(), 'data', 'envios_agendados.json');

interface EnvioAgendado {
  id: string;
  nome_negocio: string;
  telefone: string;
  mensagem: string;
  enviar_a_partir_de: string; // data ISO "YYYY-MM-DD"
  status: 'pendente' | 'enviado' | 'falhou';
  enviado_em?: string;
}

async function processEnviosAgendados(): Promise<void> {
  const agendados = readJson<EnvioAgendado[]>(ENVIOS_AGENDADOS_FILE) || [];
  if (!agendados.some((e) => e.status === 'pendente')) return;

  const hoje = new Date().toISOString().slice(0, 10);
  const hora  = new Date().getHours();
  // Só envia em horário comercial
  if (hora < 9 || hora >= 18) return;

  const port = process.env.PORT || '3000';
  let alterou = false;

  for (const envio of agendados) {
    if (envio.status !== 'pendente') continue;
    if (envio.enviar_a_partir_de > hoje) continue;

    try {
      const resp = await axios.post(
        `http://localhost:${port}/api/whatsapp/send`,
        { phone: envio.telefone, message: envio.mensagem },
        { timeout: 15000 }
      );
      if (resp.data?.success) {
        envio.status   = 'enviado';
        envio.enviado_em = new Date().toISOString();
        alterou = true;
        log.success(`Agent7: envio agendado → ${envio.nome_negocio}`);
        await notifyOwner(
          `📤 Mensagem agendada enviada para ${envio.nome_negocio}:\n\n"${envio.mensagem.slice(0, 120)}"`,
          `📅 ${envio.nome_negocio} — envio agendado`
        );
      } else {
        envio.status = 'falhou';
        alterou = true;
        log.warn(`Agent7: envio agendado falhou para ${envio.nome_negocio}`);
      }
    } catch (err) {
      envio.status = 'falhou';
      alterou = true;
      log.warn(`Agent7: envio agendado erro para ${envio.nome_negocio}: ${(err as Error).message}`);
    }
  }

  if (alterou) writeJson(ENVIOS_AGENDADOS_FILE, agendados);
}

// ── Despacho da fila de respostas fora do horário ────────────────────────────

interface FilaResposta {
  id: string;
  phone: string;
  sendTarget: string;
  resposta: string;
  enfileirado_em: string;
}

async function processFilaRespostas(): Promise<void> {
  const hora = new Date().getHours();
  if (hora < 9 || hora >= 18) return; // só despacha em horário comercial

  const fila = readJson<FilaResposta[]>(FILA_RESPOSTAS_FILE) || [];
  if (fila.length === 0) return;

  const port = process.env.PORT || '3000';
  const restante: FilaResposta[] = [];
  let enviados = 0;

  for (const item of fila) {
    try {
      const resp = await axios.post(
        `http://localhost:${port}/api/whatsapp/send`,
        { phone: item.phone, message: item.resposta },
        { timeout: 15000 }
      );
      if (resp.data?.success) {
        enviados++;
        log.success(`Agent7 fila: enviado para ${item.phone}`);
        await new Promise((r) => setTimeout(r, 3000)); // 3s entre envios
      } else {
        restante.push(item); // tenta novamente no próximo ciclo
      }
    } catch {
      restante.push(item);
    }
  }

  writeJson(FILA_RESPOSTAS_FILE, restante);
  if (enviados > 0) log.info(`Agent7: ${enviados} resposta(s) enfileirada(s) despachada(s)`);
}

// ── Limpeza automática de pipeline ───────────────────────────────────────────

async function processLimpezaPipeline(): Promise<void> {
  const conversas = readJson<ConversaMin[]>(CONVERSAS_FILE) || [];
  if (conversas.length === 0) return;

  const now = Date.now();
  const MS_30D = 30 * 24 * 60 * 60 * 1000;
  let alterou = false;

  for (const c of conversas) {
    if (!['primeiro_contato', 'interesse', 'objecao'].includes(c.estagio)) continue;

    // Encontra a última mensagem do lead
    const ultimaLead = [...c.mensagens].reverse().find((m) => m.role === 'lead');
    if (!ultimaLead) continue;

    const silencio = now - new Date(ultimaLead.data).getTime();
    if (silencio < MS_30D) continue;

    // 30+ dias sem resposta e já recebeu todos os nudges (ou nunca respondeu de verdade)
    const estagioAnterior = c.estagio;
    c.estagio = 'encerrado';
    c.mensagens.push({
      role: 'victor',
      texto: '[encerrado automaticamente por inatividade — 30 dias sem resposta]',
      data: new Date().toISOString(),
    });
    alterou = true;
    log.info(`Agent7 limpeza: ${c.nome_negocio} encerrado (${estagioAnterior} → encerrado, ${Math.floor(silencio / 86400000)} dias sem resposta)`);
  }

  if (alterou) writeJson(CONVERSAS_FILE, conversas);
}

// ── Relatório semanal (segunda-feira, 8h–9h) ─────────────────────────────────

async function enviarRelatorioSemanal(): Promise<void> {
  const dia  = new Date().getDay();  // 1 = segunda
  const hora = new Date().getHours();
  if (dia !== 1 || hora < 8 || hora > 9) return;

  const logData = readJson<{ ultima_data?: string; ultima_semana?: string }>(RELATORIO_LOG_FILE) || {};
  const semanaAtual = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (d.getDay() || 7) + 1); // início da semana (segunda)
    return d.toISOString().slice(0, 10);
  })();
  if (logData.ultima_semana === semanaAtual) return;

  const ownerWa = process.env.OWNER_WHATSAPP;
  if (!ownerWa) return;

  const conversas  = readJson<ConversaMin[]>(CONVERSAS_FILE) || [];
  const projetos   = readJson<Projeto[]>(PROJETOS_FILE) || [];
  const historico  = readJson<Array<{ data_acionado: string; segmento_micro: string; nome_negocio: string }>>
    (path.join(process.cwd(), 'data', 'historico_contatos.json')) || [];

  const MS_7D = 7 * 24 * 60 * 60 * 1000;
  const now   = Date.now();

  const leadsEssaSemana = historico.filter((h) => now - new Date(h.data_acionado).getTime() < MS_7D);
  const responderam = conversas.filter((c) =>
    leadsEssaSemana.some((h) => h.nome_negocio === c.nome_negocio) && c.mensagens.some((m) => m.role === 'lead')
  );
  const taxaResposta = leadsEssaSemana.length > 0
    ? Math.round((responderam.length / leadsEssaSemana.length) * 100)
    : 0;

  const emNegociacao = conversas.filter((c) => c.estagio === 'negociacao').length;
  const emFechamento = conversas.filter((c) => c.estagio === 'fechamento').length;
  const emProducao   = projetos.filter((p) => p.status === 'em_producao').length;
  const entregues    = projetos.filter((p) => p.status === 'entregue').length;

  const VALORES_EST: Record<number, number> = { 0: 297, 1: 597, 2: 897, 3: 797 };
  const receitaFechada = projetos
    .filter((p) => ['em_producao', 'entregue'].includes(p.status))
    .reduce((s, p) => s + (VALORES_EST[p.opcao ?? 1] || 597), 0);

  // Top 3 segmentos por volume de acionamento essa semana
  const segCount: Record<string, number> = {};
  for (const h of leadsEssaSemana) {
    const seg = h.segmento_micro || 'outros';
    segCount[seg] = (segCount[seg] || 0) + 1;
  }
  const topSegs = Object.entries(segCount).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const dataBR = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
  const linhas: string[] = [
    `📊 *Relatório Semanal — ${dataBR}*\n`,
    `📤 Leads acionados: *${leadsEssaSemana.length}*`,
    `💬 Responderam: *${responderam.length}* (${taxaResposta}% de resposta)`,
    `💰 Em negociação: *${emNegociacao}*`,
    `🔥 Em fechamento: *${emFechamento}*`,
    `🏗️ Em produção: *${emProducao}*`,
    `✅ Entregues (total): *${entregues}*`,
    `💵 Receita fechada: *R$${receitaFechada.toLocaleString('pt-BR')}*`,
  ];

  if (topSegs.length > 0) {
    linhas.push('\n*Top segmentos da semana:*');
    for (const [seg, count] of topSegs) {
      linhas.push(`• ${seg}: ${count} leads`);
    }
  }

  const urgentes = conversas.filter((c) => ['negociacao', 'fechamento'].includes(c.estagio));
  if (urgentes.length > 0) {
    linhas.push('\n*Atenção prioritária:*');
    for (const c of urgentes.slice(0, 4)) {
      linhas.push(`• ${c.nome_negocio} [${c.estagio}]`);
    }
  }

  linhas.push('\nBoa semana! 🚀');

  try {
    const { sendWhatsApp: sendWA } = await import('../utils/whatsapp');
    await sendWA(ownerWa, linhas.join('\n'));
    writeJson(RELATORIO_LOG_FILE, { ...logData, ultima_semana: semanaAtual, semana_enviada_em: new Date().toISOString() });
    log.success('Agent7: relatório semanal enviado');
  } catch (err) {
    log.warn(`Agent7: relatório semanal falhou: ${(err as Error).message}`);
  }
}

export function startAgent7Loop({ intervalMinutes = 5 }: { intervalMinutes?: number } = {}): void {
  log.info(`Agente 7 — Handler de Respostas iniciado (polling a cada ${intervalMinutes}min)`);

  const auth = getGmailAuth();
  if (!auth) {
    log.warn('Agente 7: credenciais Gmail não configuradas — rodando em modo mockado');
  }

  let ciclo = 0;
  const CICLOS_POR_HORA = Math.round(60 / intervalMinutes);
  let emExecucao = false;

  const run = async () => {
    if (emExecucao) {
      log.warn('Agente 7: ciclo anterior ainda em execução (provável fila represada) — pulando este tick');
      return;
    }
    emExecucao = true;
    try {
      await processReplies(auth);
      await processProbeQueue();
      await processEnviosAgendados();
      await processFilaRespostas();
      await processOnboardings();
      await processLembretesPIX();
      await processAgendamentos();
      await processFollowupEntrega();
      await processCobrancaSegundaParcela();
      await processCobrancaMensalAuto();
      await processUpsellAutomacao();
      await processUpsellManutencao();
      await processReativacaoEncerrados();
      await processFollowupIndicacoes();
      await enviarRelatorioMatinal();
      await enviarRelatorioSemanal();
      ciclo++;
      if (ciclo >= CICLOS_POR_HORA) {
        ciclo = 0;
        await processConversasFrias();
        await processLimpezaPipeline();
      }
    } catch (err) {
      log.error(`Agente 7 erro: ${(err as Error).message}`);
    } finally {
      emExecucao = false;
    }
  };

  run();
  setInterval(run, intervalMinutes * 60 * 1000);
}

/**
 * Sistema de Cadência de Follow-up
 *
 * Gerencia contatos estruturados para leads que não responderam ao primeiro toque.
 * Cada etapa varia canal, tom e horário — nunca repete a mesma mensagem.
 *
 * Estrutura:
 *   Dia 1   → apresentação inicial (canal primário)
 *   Dia 3   → follow-up com ângulo diferente (canal primário)
 *   Dia 7   → canal secundário + pergunta curta
 *   Dia 14  → entrega de valor gratuito — sem pedir nada
 *   Dia 21  → encerramento elegante
 *   Dia 30+ → fila de reativação em 90 dias
 */

import Anthropic from '@anthropic-ai/sdk';
import nodemailer from 'nodemailer';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { CadenciaLead, FollowUpEntry, Diagnostico, Mensagem } from '../types';
import { log } from '../utils/logger';
import { readJson, writeJson, today } from '../utils/dataHelpers';

async function sendWhatsAppViaCadencia(phone: string, message: string): Promise<boolean> {
  const apiPort = process.env.PORT || '3000';
  try {
    const resp = await axios.post(`http://localhost:${apiPort}/api/whatsapp/send`, { phone, message }, { timeout: 15000 });
    return resp.data?.success === true;
  } catch (err) {
    log.error(`  [cadência] Falha ao chamar API WhatsApp: ${(err as Error).message}`);
    return false;
  }
}

let _mailer: nodemailer.Transporter | null = null;
function getMailer(): nodemailer.Transporter | null {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  if (!_mailer) {
    _mailer = nodemailer.createTransport({ service: 'gmail', auth: { user, pass }, pool: true, maxConnections: 1 });
  }
  return _mailer;
}

async function sendFollowUpEmail(lead: CadenciaLead, corpo: string): Promise<boolean> {
  const mailer = getMailer();
  const owner = process.env.GMAIL_USER;
  if (!mailer || !owner) {
    log.warn(`  [cadência] Gmail não configurado — follow-up email para ${lead.nome_negocio} simulado`);
    return true;
  }
  try {
    await mailer.sendMail({
      from: owner,
      to: owner,
      subject: `Follow-up: ${lead.nome_negocio}`,
      text: corpo,
    });
    return true;
  } catch (err) {
    log.error(`  [cadência] Email falhou para ${lead.nome_negocio}: ${(err as Error).message}`);
    return false;
  }
}

const client = new Anthropic();
const CADENCIA_FILE = path.join(process.cwd(), 'data', 'cadencia.json');

// Dias em que follow-up deve acontecer
const ETAPAS: Array<0 | 1 | 3 | 7 | 14 | 21> = [0, 1, 3, 7, 14, 21];
const PROXIMO_ETAPA: Record<number, 0 | 1 | 3 | 7 | 14 | 21 | 99> = {
  0: 1, 1: 3, 3: 7, 7: 14, 14: 21, 21: 99,
};

function loadCadencias(): CadenciaLead[] {
  return readJson<CadenciaLead[]>(CADENCIA_FILE) || [];
}

function saveCadencias(cadencias: CadenciaLead[]): void {
  const dir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  writeJson(CADENCIA_FILE, cadencias);
}

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function isToday(date: string): boolean {
  return date === today();
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRO DE NOVO LEAD NA CADÊNCIA
// ─────────────────────────────────────────────────────────────────────────────
export function registrarNaCadencia(diag: Diagnostico, msg: Mensagem): void {
  const cadencias = loadCadencias();
  const existe = cadencias.find(c => c.slug === diag.slug);
  if (existe) return;

  const canalPrimario = diag.perfil_cadencia?.melhor_canal || (diag.canal_recomendado === 'whatsapp' ? 'whatsapp' : 'email');
  const canalSecundario = canalPrimario === 'whatsapp' ? 'email' : 'whatsapp';

  const nova: CadenciaLead = {
    lead_id: diag.lead_id,
    slug: diag.slug,
    nome_negocio: diag.nome,
    telefone: diag.telefone,
    canal_primario: canalPrimario as 'whatsapp' | 'email',
    canal_secundario: canalSecundario as 'whatsapp' | 'email',
    etapa_atual: 0,
    status: 'ativo',
    data_primeiro_contato: today(),
    data_proximo_contato: addDays(today(), 3),
    historico: [{
      dia: 1,
      canal: canalPrimario,
      horario: diag.perfil_cadencia?.melhor_horario || 'tarde',
      variacao: 'apresentacao',
      enviado_em: new Date().toISOString(),
      resultado: 'pendente',
    }],
    segmento_micro: diag.segmento?.micro?.[0] || diag.categoria,
    cidade: diag.cidade,
  };

  cadencias.push(nova);
  saveCadencias(cadencias);
  log.info(`Cadência iniciada para ${diag.nome} — próximo contato em ${nova.data_proximo_contato}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// GERAÇÃO DE MENSAGEM DE FOLLOW-UP
// ─────────────────────────────────────────────────────────────────────────────
async function gerarMensagemFollowup(lead: CadenciaLead, etapa: number): Promise<string> {
  const variantes: Record<number, string> = {
    3: `Você é um vendedor experiente e humano. Escreva um follow-up para WhatsApp (máx 3 linhas) para ${lead.nome_negocio} em ${lead.cidade}.
Etapa: 3 dias após apresentação. Eles viram sua mensagem mas não responderam.
Tom: direto, sem "follow-up", sem enrolação. Apresente um dado ou resultado específico de ${lead.segmento_micro} em vez de repetir a apresentação.
Não comece com "Olá" genérico. Não mencione que você já enviou mensagem antes.
Retorne apenas o texto da mensagem, sem explicações.`,

    7: `Escreva uma mensagem curta para WhatsApp (máx 2 linhas) para ${lead.nome_negocio}.
Etapa: 7 dias. Use tom diferente do habitual — mais casual e com uma pergunta aberta de resposta fácil (sim/não ou uma palavra).
Objetivo: diminuir a fricção de resposta ao máximo. Não mencione automação. Não tente vender.
Retorne apenas o texto da mensagem.`,

    14: `Escreva uma mensagem de valor puro para ${lead.nome_negocio} (${lead.segmento_micro} em ${lead.cidade}).
Etapa: 14 dias. NÃO peça nada. Entregue um dado, observação ou insight genuinamente útil para o segmento deles.
Tom: consultivo, mostra que você conhece o mercado deles. Máx 4 linhas.
Retorne apenas o texto da mensagem.`,

    21: `Escreva uma mensagem de encerramento elegante e sem pressão para ${lead.nome_negocio}.
Etapa: 21 dias. Tom: respeitoso, sem culpa, deixa porta aberta. Frases como "não quero ser inconveniente" têm alta taxa de resposta.
Máx 3 linhas. NÃO mencione follow-up nem "última tentativa".
Retorne apenas o texto da mensagem.`,
  };

  const promptTemplate = variantes[etapa];
  if (!promptTemplate) return '';

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [{ role: 'user', content: promptTemplate }],
    });
    return (response.content[0] as { type: string; text: string }).text.trim();
  } catch {
    const fallbacks: Record<number, string> = {
      3: `Vi que negócios de ${lead.segmento_micro} em ${lead.cidade} estão captando 2x mais clientes com automação. Vale 5 minutos para conversar?`,
      7: `Oi! Uma pergunta rápida sobre ${lead.nome_negocio}: vocês usam WhatsApp para atender clientes novos?`,
      14: `Dado do setor: ${lead.segmento_micro} que respondem leads em menos de 10 minutos têm 7x mais conversão. Posso te mostrar como automatizar isso?`,
      21: `Oi! Não quero ser inconveniente. Se agora não é o momento certo para ${lead.nome_negocio}, tudo bem — fico por aqui se precisar depois.`,
    };
    return fallbacks[etapa] || '';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROCESSAR CADÊNCIAS DO DIA
// ─────────────────────────────────────────────────────────────────────────────
export async function processarCadencias(): Promise<void> {
  log.info('Cadência — verificando follow-ups do dia...');

  const cadencias = loadCadencias();
  const pendentes = cadencias.filter(c =>
    c.status === 'ativo' &&
    c.data_proximo_contato &&
    isToday(c.data_proximo_contato)
  );

  if (pendentes.length === 0) {
    log.info('Cadência — nenhum follow-up para hoje');
    return;
  }

  log.info(`Cadência — ${pendentes.length} follow-up(s) agendado(s) para hoje`);

  for (const lead of pendentes) {
    const etapa = lead.etapa_atual === 0 ? 3 : lead.etapa_atual;
    log.info(`  Follow-up Dia ${etapa}: ${lead.nome_negocio}`);

    const mensagem = await gerarMensagemFollowup(lead, etapa);
    if (!mensagem) {
      log.warn(`  ↷ ${lead.nome_negocio} — mensagem vazia, pulando`);
      continue;
    }

    let enviado = false;

    // Enviar pelo canal da etapa
    const canal = etapa === 7 ? lead.canal_secundario : lead.canal_primario;
    if (canal === 'whatsapp' && lead.telefone) {
      enviado = await sendWhatsAppViaCadencia(lead.telefone, mensagem);
      if (enviado) log.info(`  ✓ WhatsApp enviado para ${lead.nome_negocio}`);
      else log.error(`  ✗ Erro WhatsApp ${lead.nome_negocio}`);
    } else if (canal === 'email') {
      enviado = await sendFollowUpEmail(lead, mensagem);
      if (enviado) log.info(`  ✓ Email enviado para ${lead.nome_negocio}`);
    } else {
      log.info(`  ↷ ${lead.nome_negocio} — canal ${canal} não suportado na cadência, pulando`);
    }

    if (!enviado) continue;

    // Atualizar estado
    const novoHistorico: FollowUpEntry = {
      dia: etapa,
      canal,
      horario: lead.canal_primario === 'whatsapp' ? 'tarde' : 'manhã',
      variacao: `dia${etapa}`,
      enviado_em: new Date().toISOString(),
      resultado: 'pendente',
    };

    lead.historico.push(novoHistorico);
    lead.etapa_atual = etapa as CadenciaLead['etapa_atual'];

    const proximaEtapa = PROXIMO_ETAPA[etapa];
    if (proximaEtapa === 99) {
      // Ciclo de 21 dias completo — reativação em 90 dias
      lead.status = 'inativo';
      lead.data_proximo_contato = addDays(today(), 90);
      log.info(`  ${lead.nome_negocio} — cadência completa, reativação em 90 dias`);
    } else {
      lead.data_proximo_contato = addDays(today(), Number(proximaEtapa) - etapa);
    }
  }

  saveCadencias(cadencias);
  log.success(`Cadência — ${pendentes.length} follow-up(s) processado(s)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// MARCAR LEAD COMO RESPONDEU / RECUSOU
// ─────────────────────────────────────────────────────────────────────────────
export function marcarResposta(slug: string, tipo: 'respondeu' | 'recusou'): void {
  const cadencias = loadCadencias();
  const lead = cadencias.find(c => c.slug === slug);
  if (!lead) return;

  lead.status = tipo;
  lead.data_proximo_contato = null;

  const ultima = lead.historico[lead.historico.length - 1];
  if (ultima) ultima.resultado = tipo;

  saveCadencias(cadencias);
  log.info(`Cadência — ${lead.nome_negocio} marcado como: ${tipo}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// RELATÓRIO SEMANAL
// ─────────────────────────────────────────────────────────────────────────────
export function gerarRelatorio(): object {
  const cadencias = loadCadencias();
  const total = cadencias.length;
  const ativos = cadencias.filter(c => c.status === 'ativo').length;
  const responderam = cadencias.filter(c => c.status === 'respondeu').length;
  const recusaram = cadencias.filter(c => c.status === 'recusou').length;
  const inativos = cadencias.filter(c => c.status === 'inativo').length;
  const taxaResposta = total > 0 ? ((responderam / total) * 100).toFixed(1) : '0';

  const porEtapa = ETAPAS.reduce((acc, e) => {
    acc[`dia_${e}`] = cadencias.filter(c => c.etapa_atual === e).length;
    return acc;
  }, {} as Record<string, number>);

  return {
    gerado_em: new Date().toISOString(),
    total_leads: total,
    ativos,
    responderam,
    recusaram,
    inativos,
    taxa_resposta_percent: taxaResposta,
    distribuicao_por_etapa: porEtapa,
  };
}

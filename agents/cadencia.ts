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
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { CadenciaLead, FollowUpEntry, Diagnostico, Mensagem } from '../types';
import { isBotNumber } from './agent9_whatsapp_reply';
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

async function sendFollowUpEmail(lead: CadenciaLead, _corpo: string): Promise<boolean> {
  // Google Places API não retorna email dos leads — nunca temos o endereço real.
  // Enviar para o owner seria enganoso. Notifica Victor para envio manual.
  log.warn(`  [cadência] Follow-up email para ${lead.nome_negocio} — sem email do lead capturado. Envie manualmente se necessário.`);
  return false;
}

const client = new Anthropic();
const CADENCIA_FILE = path.join(process.cwd(), 'data', 'cadencia.json');

// Dias em que follow-up deve acontecer (etapa 0 = envio da proposta no dia 1)
const ETAPAS: Array<0 | 1 | 3 | 7 | 14 | 21> = [0, 1, 3, 7, 14, 21];
const PROXIMO_ETAPA: Record<number, 0 | 1 | 3 | 7 | 14 | 21 | 99> = {
  0: 3, 1: 3, 3: 7, 7: 14, 14: 21, 21: 99,
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
// GERAÇÃO DA PROPOSTA (segundo toque — com landing page link)
// ─────────────────────────────────────────────────────────────────────────────
async function gerarMensagemProposta(lead: CadenciaLead, landingUrl: string): Promise<string> {
  const prompt = `Você é o Victor, desenvolvedor web. Escreva uma mensagem de continuação no estilo de Joe Girard.

Esta é a SEGUNDA mensagem enviada para ${lead.nome_negocio}. Ontem Victor se apresentou como pessoa — caloroso, sem proposta. Hoje ele entrega o presente que preparou especialmente para eles.

ESTRUTURA — 2 blocos separados por linha em branco:

Bloco 1 (1-2 frases): Ponte natural com o contato de ontem. Algo que mostre que Victor genuinamente continuou pensando neles — não uma fórmula. Sem "Como combinado", sem "Conforme prometido". Natural e caloroso, como alguém que não esqueceu.

Bloco 2 (3 linhas exatas):
"Preparei algo especialmente pra vocês:"
[link sozinho na linha seguinte — sem texto antes ou depois]
Uma frase calorosa e sem pressão convidando a responder. Assina "Victor".

REGRAS INEGOCIÁVEIS:
- Tom: continuação calorosa de conversa já iniciada — genuíno, sem pressa, sem pressão
- Zero asteriscos, zero emojis forçados, zero linguagem de vendedor
- Frases com no máximo 12 palavras
- O link fica SOZINHO na sua linha
- Máximo 6 linhas de texto no total
- Assinar com "Victor" no final

Contexto:
- Negócio: ${lead.nome_negocio}
- Segmento: ${lead.segmento_micro}
- Cidade: ${lead.cidade}
- Link da prévia preparada por Victor: ${landingUrl}

Retorne apenas o texto da mensagem.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });
    return (response.content[0] as { type: string; text: string }).text.trim();
  } catch {
    return `Ontem não saí da cabeça do que vocês têm no ${lead.nome_negocio}.\n\nPreparei algo especialmente pra vocês:\n${landingUrl}\n\nFico feliz em saber o que acharam — mas sem pressa nenhuma.\n\nVictor`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRO DE NOVO LEAD NA CADÊNCIA
// ─────────────────────────────────────────────────────────────────────────────
export async function registrarNaCadencia(diag: Diagnostico, msg: Mensagem): Promise<void> {
  const cadencias = loadCadencias();
  const existe = cadencias.find(c => c.slug === diag.slug);
  if (existe) return;

  const canalPrimario = diag.perfil_cadencia?.melhor_canal || (diag.canal_recomendado === 'whatsapp' ? 'whatsapp' : 'email');
  const canalSecundario = canalPrimario === 'whatsapp' ? 'email' : 'whatsapp';
  const landingUrl = diag.landing_page_url || msg.landing_page_url;

  // Gera a proposta (segundo toque com link) para enviar amanhã
  const mensagemProposta = landingUrl
    ? await gerarMensagemProposta(
        {
          lead_id: diag.lead_id, slug: diag.slug, nome_negocio: diag.nome,
          telefone: diag.telefone, canal_primario: canalPrimario as 'whatsapp' | 'email',
          canal_secundario: canalSecundario as 'whatsapp' | 'email',
          etapa_atual: 0, status: 'ativo',
          data_primeiro_contato: today(), data_proximo_contato: null,
          historico: [], segmento_micro: diag.segmento?.micro?.[0] || diag.categoria,
          cidade: diag.cidade,
        },
        landingUrl
      )
    : undefined;

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
    data_proximo_contato: addDays(today(), 1),  // Proposta enviada amanhã
    historico: [{
      dia: 0,
      canal: canalPrimario,
      horario: diag.perfil_cadencia?.melhor_horario || 'tarde',
      variacao: 'apresentacao',
      enviado_em: new Date().toISOString(),
      resultado: 'pendente',
    }],
    segmento_micro: diag.segmento?.micro?.[0] || diag.categoria,
    cidade: diag.cidade,
    mensagem_proposta: mensagemProposta,
    tipo_automacao: diag.tipo_automacao ?? null,
  };

  cadencias.push(nova);
  saveCadencias(cadencias);
  log.info(`Cadência iniciada para ${diag.nome} — proposta agendada para ${nova.data_proximo_contato}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// GERAÇÃO DE MENSAGEM DE FOLLOW-UP
// ─────────────────────────────────────────────────────────────────────────────
async function gerarMensagemFollowup(lead: CadenciaLead, etapa: number): Promise<string> {
  // FILOSOFIA VICTOR — embutida em todos os follow-ups:
  // Sempre positivo. Nunca perder um cliente. Nunca fechar uma porta.
  // Cada mensagem entrega algo genuíno — não é pressão, é presença.
  // O "não" de hoje é o "sim" que ainda não chegou.
  const filosofia = `
FILOSOFIA INEGOCIÁVEL:
- Você é Victor Germano, dev web. Formal mas descontraído — como um amigo competente.
- Toda mensagem é positiva, sem exceção. Nunca há tom de cobrança, pressão ou urgência falsa.
- Você nunca mente, nunca inventa prazo, nunca promete o que não pode cumprir.
- Seja prestativo: você genuinamente quer ajudar esse negócio, independente de vender agora.
- A porta nunca fecha. Cada interação é uma semente — algumas florescem hoje, outras em meses.
- Zero asteriscos. Zero emojis forçados. Zero linguagem de vendedor ou IA genérica.
- Assinar apenas "Victor" quando tiver assinatura.`;

  const variantes: Record<number, string> = {
    3: `${filosofia}

Escreva uma mensagem de WhatsApp (máx 3 linhas) para ${lead.nome_negocio} em ${lead.cidade}.
Contexto: 3 dias após Victor se apresentar. Eles ainda não responderam — tudo bem, não é cobrança.
Objetivo: reaparecer com algo genuinamente útil para o segmento deles (${lead.segmento_micro}). Um dado real, uma observação específica do mercado deles, algo que mostre que Victor conhece o negócio deles — não que quer vender.
Tom: como quem passou 3 dias pensando neles e teve uma ideia que quis compartilhar. Caloroso, direto, sem enrolação.
Não comece com "Olá" genérico. Não mencione que já enviou mensagem antes.
Retorne apenas o texto da mensagem.`,

    7: `${filosofia}

Escreva uma mensagem curtíssima para WhatsApp (máx 2 linhas) para ${lead.nome_negocio}.
Contexto: 7 dias. Victor muda de tom — mais leve, mais casual, quase como um amigo verificando se está tudo bem.
Objetivo: diminuir a fricção ao máximo. Uma pergunta simples, de resposta fácil — sim/não ou uma palavra. Algo que mostre interesse genuíno no negócio deles, não na venda.
Não tente vender. Não mencione serviços. Só aproxima.
Retorne apenas o texto da mensagem.`,

    14: `${filosofia}

Escreva uma mensagem de valor puro para ${lead.nome_negocio} (${lead.segmento_micro} em ${lead.cidade}).
Contexto: 14 dias. Victor entrega algo útil sem pedir absolutamente nada em troca. Ponto.
Objetivo: um insight, dado, dica ou observação genuinamente valiosa para o segmento deles — algo que qualquer pessoa de ${lead.segmento_micro} acharia útil hoje. Não tem CTA, não tem "me chama", não tem proposta.
Tom: consultivo e generoso — alguém que conhece o mercado deles e quer contribuir. Máx 4 linhas.
Retorne apenas o texto da mensagem.`,

    21: `${filosofia}

Escreva uma mensagem final elegante para ${lead.nome_negocio}.
Contexto: 21 dias. Victor aparece pela última vez neste ciclo — com leveza, sem culpa, sem pressão.
Objetivo: deixar a porta escancarada e a memória positiva. Victor não quer incomodar. Se não for o momento certo, tudo bem — ele estará por aqui quando fizer sentido.
Tom: caloroso, respeitoso, sem "última tentativa", sem "não vou mais entrar em contato". Apenas um encerramento humano que convida o cliente a chegar quando quiser. Máx 3 linhas.
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
      3: `Fiquei pensando no ${lead.nome_negocio} esses dias. Negócios de ${lead.segmento_micro} em ${lead.cidade} que fortalecem a presença digital estão saindo na frente — especialmente no Google. Se quiser trocar uma ideia sobre isso, estou por aqui.\n\nVictor`,
      7: `Oi! Uma pergunta rápida: vocês recebem bem os clientes novos pelo WhatsApp, ou às vezes fica difícil responder todo mundo?`,
      14: `Uma coisa que percebo nos melhores ${lead.segmento_micro} de ${lead.cidade}: eles têm uma presença online que trabalha enquanto a equipe atende. Não precisa ser nada grande — às vezes um ponto de contato bem feito já faz diferença real. Compartilhando porque pode ser útil pra vocês.`,
      21: `Oi! Não quero tomar seu tempo se não faz sentido agora para o ${lead.nome_negocio}. Se um dia precisar de algo na área de tecnologia ou quiser trocar uma ideia, pode me chamar — estarei por aqui.\n\nVictor`,
    };
    return fallbacks[etapa] || '';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VERIFICAÇÃO DE CONVERSA ATIVA (evita follow-up durante troca em andamento)
// ─────────────────────────────────────────────────────────────────────────────
function temConversaAtiva(telefone: string): boolean {
  const conversasFile = path.join(process.cwd(), 'data', 'conversas_whatsapp.json');
  if (!fs.existsSync(conversasFile)) return false;
  const conversas = readJson<Array<{
    phone: string;
    estagio: string;
    mensagens?: Array<{ role: string; data: string }>;
  }>>(conversasFile) || [];
  const digits = telefone.replace(/\D/g, '').replace(/^55/, '');
  const conversa = conversas.find(
    (c) => c.phone.replace(/\D/g, '').replace(/^55/, '') === digits
  );
  if (!conversa || conversa.estagio === 'encerrado') return false;
  // Só bloqueia follow-up se o LEAD enviou uma mensagem real nas últimas 48h
  // (não conta auto-respostas de bot, que não geram entradas role:'lead')
  const ultimaRespostaLead = (conversa.mensagens || [])
    .filter((m) => m.role === 'lead')
    .map((m) => new Date(m.data).getTime())
    .sort((a, b) => b - a)[0];
  if (!ultimaRespostaLead) return false;
  return (Date.now() - ultimaRespostaLead) / 3600000 < 48;
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
    c.data_proximo_contato <= today()
  );

  if (pendentes.length === 0) {
    log.info('Cadência — nenhum follow-up para hoje');
    return;
  }

  log.info(`Cadência — ${pendentes.length} follow-up(s) agendado(s) para hoje`);

  for (const lead of pendentes) {
    // etapa 0 com mensagem_proposta = envio do segundo toque (proposta com link)
    const isPropostaStep = lead.etapa_atual === 0 && !!lead.mensagem_proposta;
    const etapa = isPropostaStep ? 0 : (lead.etapa_atual === 0 ? 3 : lead.etapa_atual);

    log.info(`  ${isPropostaStep ? 'Proposta (dia 1)' : `Follow-up Dia ${etapa}`}: ${lead.nome_negocio}`);

    // Arquiva automaticamente leads com auto-resposta de bot detectada
    if (isBotNumber(lead.telefone)) {
      lead.status = 'arquivado';
      lead.data_proximo_contato = null;
      log.info(`  ✗ ${lead.nome_negocio} — auto-resposta de bot detectada, arquivando`);
      continue;
    }

    // Pula se o lead está em conversa ativa no WhatsApp
    if (temConversaAtiva(lead.telefone)) {
      log.info(`  ↷ ${lead.nome_negocio} — conversa ativa no WhatsApp, pulando follow-up automático`);
      continue;
    }

    const mensagem = isPropostaStep
      ? lead.mensagem_proposta!
      : await gerarMensagemFollowup(lead, etapa);

    if (!mensagem) {
      log.warn(`  ↷ ${lead.nome_negocio} — mensagem vazia, pulando`);
      continue;
    }

    let enviado = false;

    // Proposta e follow-ups até dia 7 usam canal primário; dia 7 usa secundário
    const canal = (!isPropostaStep && etapa === 7) ? lead.canal_secundario : lead.canal_primario;
    if (canal === 'whatsapp' && lead.telefone) {
      enviado = await sendWhatsAppViaCadencia(lead.telefone, mensagem);
      if (enviado) log.info(`  ✓ WhatsApp enviado para ${lead.nome_negocio}`);
      else log.error(`  ✗ Erro WhatsApp ${lead.nome_negocio}`);
    } else if (canal === 'email') {
      enviado = await sendFollowUpEmail(lead, mensagem);
      if (enviado) log.info(`  ✓ Email enviado para ${lead.nome_negocio}`);
    } else {
      log.info(`  ↷ ${lead.nome_negocio} — canal ${canal} não suportado, pulando`);
    }

    if (!enviado) continue;

    // Atualizar estado
    const novoHistorico: FollowUpEntry = {
      dia: isPropostaStep ? 1 : etapa,
      canal,
      horario: lead.canal_primario === 'whatsapp' ? 'tarde' : 'manhã',
      variacao: isPropostaStep ? 'proposta' : `dia${etapa}`,
      enviado_em: new Date().toISOString(),
      resultado: 'pendente',
    };

    lead.historico.push(novoHistorico);

    if (isPropostaStep) {
      // Após proposta: próximo é day-3 follow-up em 2 dias
      lead.etapa_atual = 3;
      lead.data_proximo_contato = addDays(today(), 2);
      log.info(`  ${lead.nome_negocio} — proposta enviada, follow-up dia 3 em ${lead.data_proximo_contato}`);
    } else {
      lead.etapa_atual = etapa as CadenciaLead['etapa_atual'];
      const proximaEtapa = PROXIMO_ETAPA[etapa];
      if (proximaEtapa === 99) {
        lead.status = 'arquivado';
        lead.data_proximo_contato = null;
        log.info(`  ${lead.nome_negocio} — cadência completa sem resposta. Arquivado permanentemente.`);
        // Notifica Victor para que possa ligar manualmente se quiser
        sendWhatsAppViaCadencia(
          process.env.OWNER_WHATSAPP || '',
          `📁 *${lead.nome_negocio}* foi arquivado após 21 dias sem resposta.\nSe quiser tentar manualmente: wa.me/55${lead.telefone.replace(/\D/g, '').replace(/^55/, '')}`
        ).catch(() => {});
      } else {
        lead.data_proximo_contato = addDays(today(), Number(proximaEtapa) - etapa);
      }
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
// RESUMO DIÁRIO DE LEADS QUENTES → WhatsApp do Victor
// ─────────────────────────────────────────────────────────────────────────────
export async function enviarResumoDiario(): Promise<void> {
  const ownerWa = process.env.OWNER_WHATSAPP || '';
  if (!ownerWa) return;

  const conversasFile = path.join(process.cwd(), 'data', 'conversas_whatsapp.json');
  if (!fs.existsSync(conversasFile)) return;

  const conversas = readJson<Array<{ phone: string; nome_negocio: string; estagio: string; ultima_atualizacao: string }>>(conversasFile) || [];

  const fechamento = conversas.filter((c) => c.estagio === 'fechamento');
  const negociacao = conversas.filter((c) => c.estagio === 'negociacao');
  const interesse  = conversas.filter((c) => c.estagio === 'interesse');

  const total = fechamento.length + negociacao.length + interesse.length;
  if (total === 0) {
    log.info('Resumo diário: nenhum lead quente no momento');
    return;
  }

  const fmtLead = (c: { phone: string; nome_negocio: string }) => {
    const num = c.phone.replace(/\D/g, '').replace(/^55/, '');
    return `• ${c.nome_negocio || 'contato'} — wa.me/55${num}`;
  };

  let msg = `📋 *LEADS QUENTES — ${new Date().toLocaleDateString('pt-BR')}*\n`;

  if (fechamento.length > 0) {
    msg += `\n🔥 *PRONTO PARA FECHAR (${fechamento.length})*\n${fechamento.map(fmtLead).join('\n')}`;
  }
  if (negociacao.length > 0) {
    msg += `\n\n💰 *EM NEGOCIAÇÃO (${negociacao.length})*\n${negociacao.map(fmtLead).join('\n')}`;
  }
  if (interesse.length > 0) {
    msg += `\n\n👀 *INTERESSE DEMONSTRADO (${interesse.length})*\n${interesse.map(fmtLead).join('\n')}`;
  }

  msg += `\n\nToque nos links para abrir a conversa e assumir manualmente.`;

  await sendWhatsAppViaCadencia(ownerWa, msg);
  log.success(`Resumo diário enviado: ${total} lead(s) quente(s)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// RELATÓRIO SEMANAL → WhatsApp do Victor (toda sexta-feira)
// ─────────────────────────────────────────────────────────────────────────────
export async function enviarRelatorioSemanal(): Promise<void> {
  const ownerWa = process.env.OWNER_WHATSAPP || '';
  if (!ownerWa) return;

  const rel = gerarRelatorio() as {
    total_leads: number;
    ativos: number;
    responderam: number;
    recusaram: number;
    inativos: number;
    taxa_resposta_percent: string;
    distribuicao_por_etapa: Record<string, number>;
  };

  const conversasFile = path.join(process.cwd(), 'data', 'conversas_whatsapp.json');
  const conversas = fs.existsSync(conversasFile)
    ? (readJson<Array<{ estagio: string }>>(conversasFile) || [])
    : [];
  const quentes  = conversas.filter(c => ['interesse', 'negociacao', 'fechamento'].includes(c.estagio)).length;
  const fechados = conversas.filter(c => c.estagio === 'fechamento').length;

  const msg =
    `📊 *RELATÓRIO SEMANAL — ${new Date().toLocaleDateString('pt-BR')}*\n\n` +
    `📋 Total na cadência: ${rel.total_leads}\n` +
    `🟢 Em acompanhamento: ${rel.ativos}\n` +
    `💬 Responderam: ${rel.responderam} (${rel.taxa_resposta_percent}%)\n` +
    `🔥 Leads quentes agora: ${quentes}\n` +
    `🤝 Em fechamento: ${fechados}\n` +
    `❌ Recusaram: ${rel.recusaram}\n` +
    `📁 Arquivados: ${rel.inativos}`;

  await sendWhatsAppViaCadencia(ownerWa, msg);
  log.success('Relatório semanal enviado via WhatsApp');
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

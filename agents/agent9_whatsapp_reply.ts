/**
 * Agente 9 — Respondedor Automático de WhatsApp
 *
 * Responde 100% automaticamente a toda mensagem recebida de leads.
 * Mantém histórico completo da conversa para responder com contexto.
 * Objetivo único: conduzir o cliente ao fechamento e entregar o projeto.
 *
 * Estágios do funil:
 *   primeiro_contato → interesse → negociacao → fechamento
 *   → onboarding (coleta info pós-pagamento) → em_producao → entregue
 *   Paralelo: objecao | encerrado
 */

import Anthropic from '@anthropic-ai/sdk';
import path from 'path';
import fs from 'fs';
import { CadenciaLead, OnboardingInfo, Projeto } from '../types';
import { log } from '../utils/logger';
import { notifyOwner } from '../utils/notifications';
import { generateId, readJson, writeJson } from '../utils/dataHelpers';
import { sendWhatsApp, addLabelToChat } from '../utils/whatsapp';
import { marcarResposta } from './cadencia';
import { getAvailableSlots, criarEventoCall, formatarSlotsWA, SlotAgenda } from './agent_calendar';
import { gerarPropostaPDF, urlProposta, DadosProposta } from '../utils/pdf_proposal';

const client = new Anthropic();

const CONVERSAS_FILE     = path.join(process.cwd(), 'data', 'conversas_whatsapp.json');
const COOLDOWN_FILE      = path.join(process.cwd(), 'data', 'wa_cooldown.json');
const BOT_RESPONSES_FILE = path.join(process.cwd(), 'data', 'bot_responses.json');
const PROBE_QUEUE_FILE   = path.join(process.cwd(), 'data', 'probe_queue.json');
const LID_MAP_FILE       = path.join(process.cwd(), 'data', 'lid_map.json');
const BLACKLIST_FILE     = path.join(process.cwd(), 'data', 'blacklist.json');
const PROJETOS_FILE      = path.join(process.cwd(), 'data', 'projetos.json');
const INDICACOES_FILE    = path.join(process.cwd(), 'data', 'indicacoes.json');
const COOLDOWN_MS        = 90 * 1000; // 90s entre respostas por número

// ── Blacklist (opt-out permanente / LGPD) ────────────────────────────────

function isBlacklisted(phone: string): boolean {
  const bl = readJson<string[]>(BLACKLIST_FILE) || [];
  const norm = phone.replace(/\D/g, '').replace(/^55/, '');
  return bl.some((b) => b.replace(/\D/g, '').replace(/^55/, '') === norm);
}

export function addToBlacklist(phone: string): void {
  const bl = readJson<string[]>(BLACKLIST_FILE) || [];
  const norm = phone.replace(/\D/g, '').replace(/^55/, '');
  if (!bl.includes(norm)) {
    bl.push(norm);
    writeJson(BLACKLIST_FILE, bl);
    log.info(`Agent9: ${norm} adicionado à blacklist`);
  }
}

// ── Projetos (pós-pagamento) ──────────────────────────────────────────────

function getProjetos(): Projeto[] {
  return readJson<Projeto[]>(PROJETOS_FILE) || [];
}

function criarEntradaProjeto(conversa: ConversaWhatsApp): void {
  const projs = getProjetos();
  if (projs.some((p) => p.slug === conversa.slug)) return; // idempotente
  const proj: Projeto = {
    id: generateId(),
    slug: conversa.slug,
    nome_negocio: conversa.nome_negocio,
    phone: conversa.phone,
    opcao: conversa.opcao_escolhida,
    status: 'aguardando_confirmacao',
    comprovante_em: new Date().toISOString(),
    ativacao_token: generateId(),
  };
  projs.push(proj);
  writeJson(PROJETOS_FILE, projs);
  log.info(`Agent9: projeto criado para ${conversa.nome_negocio}`);
}

function atualizarProjeto(slug: string, updates: Partial<Projeto>): void {
  const projs = getProjetos();
  const idx = projs.findIndex((p) => p.slug === slug);
  if (idx !== -1) {
    projs[idx] = { ...projs[idx], ...updates };
    writeJson(PROJETOS_FILE, projs);
  }
}

// ── Onboarding — perguntas em sequência ──────────────────────────────────

const ONBOARDING_PERGUNTAS = [
  'Me passa o @ de vocês no Instagram ou Facebook. Se não tiver, é só falar.',
  'Tem uma logo ou arte do negócio? Se tiver, me manda o arquivo aqui mesmo. Se não tiver, a gente cria.',
  'Tem algum site que goste do visual como referência? Pode ser de qualquer ramo. Se não tiver, tudo bem.',
  'Me conta em 2-3 frases o que vocês fazem e quem é o público de vocês.',
  'Me lista os principais serviços ou produtos que vocês oferecem.',
];

const ONBOARDING_PERGUNTAS_AUTO = [
  'Qual é o número de WhatsApp que vai receber o bot? (pode ser este mesmo ou outro número do negócio)',
  'Quais são as dúvidas mais comuns que os clientes mandam pra vocês? (ex: preços, horários, endereço, agendamento)',
  'Qual o horário de funcionamento de vocês? (ex: seg–sex das 9h às 18h, sáb das 9h ao meio-dia)',
  'Me manda a lista de serviços ou produtos com os preços, se tiver. Pode ser texto, foto ou PDF.',
  'Tem alguma mensagem de boas-vindas que quer que o bot mande quando alguém entrar em contato pela primeira vez?',
];

// ── Detecção e captura de indicações ─────────────────────────────────────

const REFERRAL_PATTERNS = [
  /vou te indicar/i,
  /vou indicar voc[eê]/i,
  /tenho (um|uma) (amigo|amiga|primo|prima|parceiro|parceira|conhecido|conhecida|irm[aã]o|irm[aã]|vizinho|vizinha|colega|s[oó]cio|s[oó]cia)/i,
  /conhe[çc]o (algu[eé]m|uma pessoa|um cara|uma menina|um rapaz)/i,
  /posso (te|lhe) indicar/i,
  /vou falar de voc[eê]/i,
  /vou recomendar/i,
  /meu (s[oó]cio|patr[aã]o|chefe|cunhado|cunhada|genro|nora)/i,
  /indica[çc][aã]o/i,
];

function detectarIndicacao(body: string): boolean {
  return REFERRAL_PATTERNS.some((p) => p.test(body));
}

function salvarIndicacao(conversa: { phone: string; nome_negocio: string }, mensagem: string): void {
  const lista = readJson<import('../types').Indicacao[]>(INDICACOES_FILE) || [];
  if (lista.some((i) => i.de_phone === conversa.phone && i.mensagem_original === mensagem)) return;
  lista.push({
    id: generateId(),
    de_phone: conversa.phone,
    de_nome_negocio: conversa.nome_negocio,
    mensagem_original: mensagem,
    data_detectada: new Date().toISOString(),
    status: 'detectada',
  });
  writeJson(INDICACOES_FILE, lista);
}

// ── Registro de números com auto-resposta ────────────────────────────────

function registrarBotResponse(phone: string): void {
  const normalized = phone.replace(/\D/g, '').replace(/^55/, '');
  if (!normalized || normalized.length < 10) return;
  const data = readJson<Record<string, string>>(BOT_RESPONSES_FILE) || {};
  if (!data[normalized]) {
    data[normalized] = new Date().toISOString();
    writeJson(BOT_RESPONSES_FILE, data);
  }
}

export function isBotNumber(telefone: string): boolean {
  const normalized = telefone.replace(/\D/g, '').replace(/^55/, '');
  if (!normalized) return false;
  const data = readJson<Record<string, string>>(BOT_RESPONSES_FILE) || {};
  return !!data[normalized];
}

// ── Detecção de mensagem automática (bot) ────────────────────────────────

const BOT_SIGNATURES = [
  /assistente virtual/i,
  /atendimento autom[aá]tico/i,
  /aguardando (atendente|um atendente)/i,
  /mensagem autom[aá]tica/i,
  /resposta autom[aá]tica/i,
  /protocolo\s*[#:nN°]?\s*\d/i,
  /fora do hor[aá]rio/i,
  /hor[aá]rio de atendimento/i,
  /em breve (um de nossos|um) atendente/i,
  /ser[aá] atendido em breve/i,
  /recebemos sua mensagem/i,
  /bot de atendimento/i,
  /central de atendimento/i,
  /powered by/i,
  /chat.?bot/i,
  /agradecemos (o seu|seu) contato/i,
  /bem-vindo(a)? ao (consultório|cl[ií]nica|est[uú]dio|studio|atendimento)/i,
  /nosso hor[aá]rio de atendimento/i,
  /em breve (retornaremos|entraremos em contato|responderemos)/i,
  /retornaremos (em breve|logo|em seguida)/i,
  /em instantes (um (dos nossos|atendente|colaborador)|seremos)/i,
  /deixe sua mensagem (que|e) (em breve|logo)/i,
  /pedido foi (enviado|confirmado|despachado)/i,
  /n[uú]mero de rastreamento/i,
  /data estimada de entrega/i,
  /n[uú]mero do pedido/i,
  /c[oó]digo de rastreio/i,
  /seja bem-vindo(a)?! 😊/i,
  /obrigado por entrar em contato/i,
  /seu atendimento (é|sera|vai ser) realizado/i,
  // Padrões adicionais detectados em produção
  /no momento estou (fotografando|filmando|atendendo|em reuni[aã]o|fora)/i,
  /passando (por aqui|rapidinho) porque vi que voc[eê] demonstrou interesse/i,
  /voc[eê] ainda (ficou com alguma d[uú]vida|tem alguma d[uú]vida)/i,
  /aqui [eé] (a|o) \w+,?\s*(gestora?|coordenadora?|representante|consultora?|analista)/i,
  /seu pedido (foi|n[uú]mero|gsm|gsh)/i,
  /estimado cliente/i,
  /n[uú]mero do pedido\s*[:=]/i,
  /rastreamento.{0,30}[A-Z0-9]{8,}/i, // códigos de rastreio (alfanumérico longo)
  /passando para (a|o) (dra?|doutor|dr\.)/i,
  /será um prazer cuidar de voc[eê]/i,
  /que bom ter voc[eê] por aqui/i,
  /pode deixar sua mensagem/i,
];

function isAutomatedMessage(body: string, historico: MensagemConversa[]): boolean {
  if (BOT_SIGNATURES.some((p) => p.test(body))) return true;
  // Mensagem repetida exata = auto-response
  const leadMsgs = historico.filter((m) => m.role === 'lead');
  if (leadMsgs.filter((m) => m.texto === body).length >= 2) return true;
  // Base64 pura sem contexto real = imagem enviada erroneamente como texto
  if (/^\/9j\/[A-Za-z0-9+/]{50,}/.test(body.trim())) return true;
  return false;
}

// ── Tipos ─────────────────────────────────────────────────────────────────

interface MensagemConversa {
  role: 'victor' | 'lead';
  texto: string;
  data: string;
}

interface ConversaWhatsApp {
  phone: string;
  contactPhone?: string;
  nome_negocio: string;
  slug: string;
  cidade: string;
  segmento: string;
  landing_url: string;
  mensagens: MensagemConversa[];
  estagio:
    | 'primeiro_contato'
    | 'interesse'
    | 'objecao'
    | 'negociacao'
    | 'fechamento'
    | 'encerrado'
    | 'onboarding'
    | 'em_producao'
    | 'entregue';
  ultima_atualizacao: string;
  proposta_enviada?: boolean;
  pix_enviado?: boolean;
  opcao_escolhida?: 0 | 1 | 2 | 3;
  slots_ofertados?: SlotAgenda[];
  reuniao_agendada?: string;
  followups_frios?: number;
  ultimo_followup_frio?: string;
  tipo_automacao?: string | null;
  tipo_produto?: 'site' | 'automacao';
  plano_escolhido?: 1 | 2 | 3;
  // Pós-pagamento
  comprovante_recebido?: boolean;
  comprovante_recebido_em?: string;
  projeto_id?: string;
  onboarding_info?: OnboardingInfo;
}

// ── Conversa storage ──────────────────────────────────────────────────────

function getConversas(): ConversaWhatsApp[] {
  return readJson<ConversaWhatsApp[]>(CONVERSAS_FILE) || [];
}

function saveConversas(conversas: ConversaWhatsApp[]): void {
  writeJson(CONVERSAS_FILE, conversas);
}

function getOrCreateConversa(
  phone: string,
  lead: LeadInfo,
  contactPhone?: string
): { conversa: ConversaWhatsApp; conversas: ConversaWhatsApp[] } {
  const conversas = getConversas();
  let conversa = conversas.find((c) => c.phone === phone);

  if (!conversa && contactPhone) {
    const normalized = contactPhone.replace(/\D/g, '');
    const byCP = conversas.find(
      (c) => c.contactPhone && c.contactPhone.replace(/\D/g, '') === normalized
    );
    if (byCP) {
      conversa = byCP;
      conversa.phone = phone;
      log.info(`Agent9: conversa migrada LID→real (${phone})`);
    }
  }

  if (!conversa) {
    conversa = {
      phone,
      contactPhone: contactPhone && contactPhone !== phone ? contactPhone : undefined,
      nome_negocio: lead.nome_negocio,
      slug: lead.slug,
      cidade: lead.cidade,
      segmento: lead.segmento,
      landing_url: lead.landing_url,
      mensagens: [],
      estagio: 'primeiro_contato',
      ultima_atualizacao: new Date().toISOString(),
      tipo_automacao: lead.tipo_automacao ?? null,
      tipo_produto: (lead.pitch_principal === 'automacao' ? 'automacao' : 'site') as 'site' | 'automacao',
    };
    conversas.push(conversa);
  } else if (!conversa.contactPhone && contactPhone && contactPhone !== phone) {
    conversa.contactPhone = contactPhone;
  }

  return { conversa, conversas };
}

function adicionarMensagem(
  conversas: ConversaWhatsApp[],
  phone: string,
  role: 'victor' | 'lead',
  texto: string
): void {
  const c = conversas.find((x) => x.phone === phone);
  if (!c) return;
  c.mensagens.push({ role, texto, data: new Date().toISOString() });
  c.ultima_atualizacao = new Date().toISOString();
  saveConversas(conversas);
}

// ── Cooldown ──────────────────────────────────────────────────────────────

function getCooldowns(): Record<string, number> {
  return readJson<Record<string, number>>(COOLDOWN_FILE) || {};
}

function isOnCooldown(phone: string): boolean {
  const cd = getCooldowns();
  return !!cd[phone] && Date.now() - cd[phone] < COOLDOWN_MS;
}

function setCooldown(phone: string): void {
  const cd = getCooldowns();
  cd[phone] = Date.now();
  writeJson(COOLDOWN_FILE, cd);
}

function typingDelay(): Promise<void> {
  const ms = Math.floor(Math.random() * (9000 - 4000) + 4000);
  return new Promise((r) => setTimeout(r, ms));
}

async function sendPropostaPartida(sendTarget: string, msg: string): Promise<void> {
  const paragrafos = msg.split('\n\n');
  const corte = Math.ceil(paragrafos.length / 2);
  const parte1 = paragrafos.slice(0, corte).join('\n\n');
  const parte2 = paragrafos.slice(corte).join('\n\n').trim();
  await sendWhatsApp(sendTarget, parte1);
  if (parte2) {
    await new Promise<void>((r) => setTimeout(r, 3000));
    await sendWhatsApp(sendTarget, parte2);
  }
}

// ── Busca de lead ─────────────────────────────────────────────────────────

interface LeadInfo {
  nome_negocio: string;
  slug: string;
  cidade: string;
  segmento: string;
  landing_url: string;
  etapa_cadencia: number;
  tipo_automacao?: string | null;
  pitch_principal?: 'site' | 'automacao';
}

function findLeadInfo(phone: string): LeadInfo | null {
  const digits = phone.replace(/\D/g, '').replace(/^55/, '');

  const cadenciaFile = path.join(process.cwd(), 'data', 'cadencia.json');
  const cadLeads = readJson<CadenciaLead[]>(cadenciaFile) || [];
  const cadLead = cadLeads.find(
    (l) => l.telefone.replace(/\D/g, '').replace(/^55/, '') === digits
  );
  if (cadLead) {
    return {
      nome_negocio: cadLead.nome_negocio,
      slug: cadLead.slug,
      cidade: cadLead.cidade,
      segmento: cadLead.segmento_micro,
      landing_url: cadLead.mensagem_proposta?.match(/https?:\/\/\S+/)?.[0] || '',
      etapa_cadencia: cadLead.etapa_atual,
      tipo_automacao: cadLead.tipo_automacao ?? null,
    };
  }

  const probeQueueFile = path.join(process.cwd(), 'data', 'probe_queue.json');
  const probeQueue = readJson<Array<{
    telefone: string;
    nome_negocio: string;
    diag_snapshot: { slug: string; cidade: string; segmento?: { micro: string[] }; landing_page_url?: string | null; pitch_principal?: 'site' | 'automacao'; tipo_automacao?: string | null };
  }>>(probeQueueFile) || [];
  const probeEntry = probeQueue.find(
    (e) => e.telefone.replace(/\D/g, '').replace(/^55/, '') === digits
  );
  if (probeEntry) {
    return {
      nome_negocio: probeEntry.nome_negocio,
      slug: probeEntry.diag_snapshot.slug,
      cidade: probeEntry.diag_snapshot.cidade,
      segmento: probeEntry.diag_snapshot.segmento?.micro?.[0] || '',
      landing_url: probeEntry.diag_snapshot.landing_page_url || '',
      etapa_cadencia: 0,
      pitch_principal: probeEntry.diag_snapshot.pitch_principal,
      tipo_automacao: probeEntry.diag_snapshot.tipo_automacao ?? null,
    };
  }

  const dataDir = path.join(process.cwd(), 'data');
  const hoje = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(hoje.getTime() - i * 86400000).toISOString().slice(0, 10);
    const diagFile = path.join(dataDir, `diagnosticos_${d}.json`);
    if (!fs.existsSync(diagFile)) continue;
    const diags = readJson<Array<{
      telefone: string; nome: string; slug: string; cidade: string;
      segmento?: { micro: string[] }; landing_page_url?: string | null
    }>>(diagFile) || [];
    const diag = diags.find(
      (dd) => (dd.telefone || '').replace(/\D/g, '').replace(/^55/, '') === digits
    );
    if (diag) {
      return {
        nome_negocio: diag.nome,
        slug: diag.slug,
        cidade: diag.cidade,
        segmento: diag.segmento?.micro?.[0] || '',
        landing_url: diag.landing_page_url || '',
        etapa_cadencia: 0,
      };
    }
  }

  return null;
}

// ── Proposta formatada ────────────────────────────────────────────────────

function gerarMsgProposta(nomeNegocio: string, tipoAutomacao?: string | null, segmento?: string): string {
  const seg = (segmento || '').toLowerCase();
  if (tipoAutomacao === 'agendamento' || tipoAutomacao === 'atendimento') {
    return (
      `Preparei duas linhas de proposta pra ${nomeNegocio}:\n\n` +
      `*Automação WhatsApp:*\n` +
      `Bot de Atendimento: R$297 setup + R$149/mês — responde perguntas e encaminha clientes automaticamente.\n` +
      `Bot de Agendamento: R$497 setup + R$197/mês — cliente agenda horário pelo WhatsApp sem ninguém do outro lado. Confirmação e lembrete automáticos.\n\n` +
      `*Site + Automação juntos:*\n` +
      `R$897 setup + R$197/mês — site institucional completo + bot integrado. Resolve presença online e atendimento de uma vez.\n\n` +
      `Qual faz mais sentido pra vocês?`
    );
  }
  if (tipoAutomacao === 'reativacao') {
    return (
      `Preparei 3 opções pra ${nomeNegocio}:\n\n` +
      `*Opção 1 — Reativação de Clientes (R$197/mês)*\n` +
      `Mensagem automática para clientes que não voltam há 30, 60 ou 90 dias. Sem esforço manual. Campanha ativa em 2 dias.\n\n` +
      `*Opção 2 — Site Institucional (R$897)*\n` +
      `Presença digital completa pra atrair clientes novos. Entrega em 7 dias.\n\n` +
      `*Opção 3 — Site + Reativação (R$897 setup + R$197/mês)*\n` +
      `Atrai clientes novos pelo Google e reativa quem já conhece vocês. Os dois canais trabalhando juntos.\n\n` +
      `Qual faz mais sentido pra vocês?`
    );
  }
  if (tipoAutomacao === 'cardapio') {
    return (
      `Preparei uma proposta pra ${nomeNegocio}:\n\n` +
      `*Cardápio Digital + Site (R$597)*\n` +
      `Cardápio online com fotos e preços, botão de pedido pelo WhatsApp e página de apresentação do negócio. Entrega em 5 dias.\n\n` +
      `*Site Completo + Cardápio + Automação (R$897 + R$149/mês)*\n` +
      `Tudo acima mais atendimento automático no WhatsApp para pedidos e dúvidas. Inclui 1 ano de hospedagem.\n\n` +
      `Qual das duas faz mais sentido?`
    );
  }
  // Personalização da landing page por segmento
  const lp1Detalhe =
    seg.includes('barbearia') || seg.includes('salão') || seg.includes('beleza')
      ? 'com galeria de fotos dos serviços, lista de preços, botão de agendamento pelo WhatsApp e mapa'
    : seg.includes('clínica') || seg.includes('fisio') || seg.includes('odonto') || seg.includes('médico') || seg.includes('saúde')
      ? 'com lista de especialidades, convênios aceitos, botão de agendamento e localização'
    : seg.includes('restaurante') || seg.includes('pizzaria') || seg.includes('lanchonete') || seg.includes('alimentação')
      ? 'com cardápio digital, botão de pedido pelo WhatsApp, horário de funcionamento e endereço'
    : seg.includes('advoca') || seg.includes('contab') || seg.includes('arquite')
      ? 'com áreas de atuação, formulário de consulta, credenciais e endereço do escritório'
    : seg.includes('imobil') || seg.includes('corretor')
      ? 'com catálogo de imóveis, formulário de captação e botão direto pro WhatsApp'
    : seg.includes('academia') || seg.includes('musculação') || seg.includes('fitness')
      ? 'com planos e preços, horários das aulas, fotos da estrutura e botão de matrícula'
    : seg.includes('escola') || seg.includes('idioma') || seg.includes('música') || seg.includes('curso')
      ? 'com grade de cursos, turmas disponíveis, formulário de matrícula e depoimentos'
    : 'com apresentação do negócio, serviços, botão do WhatsApp em destaque e localização';

  return (
    `Preparei 4 opções pra ${nomeNegocio}:\n\n` +
    `*Mini Landing Page (R$297)*\n` +
    `Página enxuta e direta ${lp1Detalhe}. Entrega em 3 dias. Pagamento: R$200 pra iniciar + R$97 na entrega. Ideal pra quem quer testar e ver o resultado antes de investir mais.\n\n` +
    `*Opção 1 — Landing Page Profissional (R$597)*\n` +
    `Tudo da Mini mais design premium, SEO básico, velocidade otimizada e 1 ano de hospedagem. Entrega em 5 dias. Pagamento: R$300 + R$297 na entrega.\n\n` +
    `*Opção 2 — Site Institucional Completo (R$897)*\n` +
    `Múltiplas páginas (Home, Serviços, Sobre, Contato), redes sociais integradas, formulário de captação, SEO completo, 1 ano de hospedagem. Entrega em 7 dias. Pagamento: R$450 + R$447 na entrega.\n\n` +
    `*Opção 3 — Site Completo + Manutenção (R$797 + R$149/mês)*\n` +
    `Tudo da Opção 2 mais atualizações mensais, suporte WhatsApp, relatório de acessos e hospedagem permanente.\n\n` +
    `Qual faz mais sentido pra vocês? Tenho agenda aberta pra começar essa semana.`
  );
}

// ── PIX ───────────────────────────────────────────────────────────────────

const VALORES_OPCAO = {
  0: { total: 297,  entrada: 200, restante: 97   },
  1: { total: 597,  entrada: 300, restante: 297  },
  2: { total: 897,  entrada: 450, restante: 447  },
  3: { total: 797,  entrada: 450, restante: 347, mensalidade: 149 },
} as const;

function gerarMsgPIX(opcao: 0 | 1 | 2 | 3): string {
  const v = VALORES_OPCAO[opcao];
  const pixKey = process.env.VICTOR_PIX_KEY || '';
  const pixInfo = pixKey
    ? `Chave PIX: *${pixKey}*\nValor da entrada: *R$${v.entrada},00*`
    : `Me fala que te mando os dados do PIX agora`;
  const mensalidade = 'mensalidade' in v ? `\n\nA mensalidade de R$${v.mensalidade},00 começa no mês seguinte à entrega.` : '';
  const label = opcao === 0 ? 'Mini Landing Page' : `Opção ${opcao}`;
  return (
    `Ótimo! ${label} confirmada.\n\n` +
    `Para dar início:\n${pixInfo}\n\n` +
    `Quando fizer, me manda o comprovante aqui que eu já começo a preparar tudo. O restante (R$${v.restante},00) você paga na entrega.${mensalidade}`
  );
}

// ── Prompt do Victor ──────────────────────────────────────────────────────

function getVictorIdentity(): string {
  const pixKey = process.env.VICTOR_PIX_KEY || '';
  const pixInfo = pixKey
    ? `\nCHAVE PIX para receber pagamento: "${pixKey}". Compartilhe APENAS quando o lead confirmar qual opção escolheu e estiver pronto para pagar — nunca antes.`
    : '';

  return `Você é Victor Germano, desenvolvedor web brasileiro de 23 anos.` + pixInfo + `
Fale como uma pessoa real falaria no WhatsApp — não como assistente virtual, não como robô de vendas.
Escreva como quem está no celular: natural, direto, humano.

PORTFÓLIO: https://vgermano1711.github.io/portfolio-germano-dev/
Se o lead pedir exemplos de trabalhos anteriores, referências ou portfólio, compartilhe esse link naturalmente.
Exemplo de resposta: "Claro, deixa eu te mandar o portfólio: https://vgermano1711.github.io/portfolio-germano-dev/ — dá pra ver os projetos lá."

PROVA SOCIAL POR SEGMENTO (use com naturalidade quando o lead hesitar, pedir referência ou demonstrar dúvida):
- Barbearia / salão / beleza: "Fiz um site pra uma barbearia aqui no ABC semana passada, eles já estão aparecendo no Google quando o cliente procura barbearia na cidade."
- Clínica / saúde / fisio / dentista: "Fiz um site pra uma clínica de fisioterapia em São Bernardo, os pacientes passaram a encontrar o endereço e convênios direto no site, reduziu muito a dúvida por WhatsApp."
- Restaurante / pizzaria / alimentação: "Fiz um cardápio digital pra uma pizzaria no ABC, os clientes acessam o cardápio pelo link e já entram em contato direto pra pedir."
- Advogado / contador / profissional liberal: "Fiz um site pra um escritório de contabilidade em São Caetano, começaram a receber pedidos de orçamento pelo formulário do site."
- Corretor / imobiliária: "Fiz um site pra uma corretora com catálogo de imóveis integrado, cliente filtra direto e entra em contato pelo WhatsApp."
- Escola / curso / idioma: "Fiz um site pra uma escola de idiomas em São José dos Campos, o formulário de matrícula já tá gerando contatos novos toda semana."
- Academia / fitness: "Fiz um site pra uma academia com tabela de planos e botão de matrícula, reduziu o trabalho da recepção."
- Pet shop: "Fiz um site pra um pet shop aqui na região com agendamento de banho e tosa pelo WhatsApp direto."
NÃO use prova social em todo contato — reserve para quando o lead demonstrar dúvida ou pedir referência.

URGÊNCIA (use em negociacao e fechamento, uma vez por conversa):
- Se estágio for "negociacao": ao final da proposta, acrescente naturalmente "Ainda tenho agenda aberta pra começar essa semana."
- Se estágio for "fechamento": "Posso dar início hoje mesmo, é só confirmar qual opção."
NÃO repita urgência em toda mensagem — use uma única vez no momento certo.

REGRAS DE HUMANIZAÇÃO (inegociáveis):
- Varie o início de cada resposta. Nunca comece duas seguidas com a mesma palavra
- Use linguagem do dia a dia: "a gente", "pode falar", "tranquilo", "fica à vontade"
- Frases curtas, resposta que vai direto ao ponto
- Nunca liste com traço, asterisco ou número — incorpore tudo no texto corrido
- Nunca use "Fico à disposição", "Atenciosamente" ou qualquer coisa de atendimento corporativo
- Nunca repita palavras do cliente de forma óbvia
- Zero emojis forçados — 1 no máximo e apenas se fizer sentido real
- NUNCA use traço ou hífen como pausa (troque por vírgula ou ponto)

OBJETIVO: conduzir ao fechamento. Cada resposta avança um passo. A venda é consequência de ajudar de verdade.

COMPORTAMENTO OBRIGATÓRIO POR ESTÁGIO:

Estágio "interesse":
  1. Se o link do site ainda não foi enviado: manda AGORA de forma calorosa e natural
  2. Sempre proponha um próximo passo concreto — de preferência uma chamada
  3. Nunca deixe o lead sem próxima ação clara

Estágio "negociacao":
  1. A proposta com valores já foi enviada automaticamente. Responda dúvidas sobre as opções.
  2. Recomende uma opção específica com base no que o cliente mencionou (segmento, orçamento, urgência)
  3. Se o lead estiver hesitando por preço, mencione a Mini Landing Page (R$297) como porta de entrada
  4. Feche com próxima ação clara: "Qual faz mais sentido pra vocês?"

Estágio "fechamento":
  1. Confirme qual opção o lead escolheu (se não ficou claro, pergunte de forma natural)
  2. Próximo passo SEM criar fricção
  3. Nunca mencione "contrato", "proposta formal" ou termos que causam hesitação

Estágio "objecao":
  "Já tenho site": "Me manda o link? Dou um feedback rápido, sem compromisso — às vezes uma análise de 5 minutos mostra o que tá travando os resultados."
  "Tá caro": "Entendo. A Mini Landing Page de R$297 é uma entrada bem acessível, você testa o trabalho e decide se quer avançar. O que acha?"
  "Vou pensar": "Claro, sem pressa. O que você precisaria saber pra se sentir seguro em avançar?"
  "Não é o momento": "Tudo bem. Me fala um período que faz mais sentido e eu te aviso antes."
  "Não conheço seu trabalho": "Claro, tô te mandando o portfólio: https://vgermano1711.github.io/portfolio-germano-dev/ — dá uma olhada nos projetos lá."

Estágio "em_producao":
  Victor está desenvolvendo o site. Responda perguntas sobre prazo e progresso com naturalidade.
  Prazo padrão: Mini = 3 dias, Opção 1 = 5 dias, Opção 2 e 3 = 7 dias. Se passaram mais, peça desculpas e diga que finaliza em breve.

SERVIÇOS E VALORES:
Mini Landing Page (R$297): página enxuta e direta (logo, serviços, WhatsApp, endereço). Entrega em 3 dias. Pagamento: R$200 pra iniciar + R$97 na entrega. Ideal como porta de entrada.
Opção 1 — Landing Page Profissional (R$597): página completa, responsiva, SEO básico, 1 ano de hospedagem. Entrega em 5 dias. Pagamento: R$300 + R$297 na entrega.
Opção 2 — Site Institucional Completo (R$897): múltiplas páginas, design exclusivo, formulário de captação, SEO completo, 1 ano de hospedagem. Entrega em 7 dias. Pagamento: R$450 + R$447 na entrega.
Opção 3 — Site Completo com Manutenção (R$797 + R$149/mês): tudo da Opção 2 mais atualizações mensais, suporte WhatsApp e hospedagem permanente.

DISPONIBILIDADE PARA CHAMADAS: Victor só pode atender chamadas após às 15h40.

ESTILO FINAL: máximo 3 frases por resposta, sem asteriscos em excesso, sem emojis desnecessários.`;
}

const VICTOR_IDENTITY = getVictorIdentity();

// ── Identidade para pitch de automação ────────────────────────────────────────
const VICTOR_IDENTITY_AUTOMACAO = (() => {
  const pixKey = process.env.VICTOR_PIX_KEY || '';
  const pixInfo = pixKey
    ? `\nCHAVE PIX: "${pixKey}". Use APENAS quando o lead confirmar o plano e estiver pronto para pagar.`
    : '';
  return `Você é Victor Germano, desenvolvedor especializado em automação de WhatsApp para pequenas empresas em SP e região.${pixInfo}
Fale como uma pessoa real no WhatsApp — direto, natural, humano. Sem linguagem corporativa.

PRODUTO: bot de WhatsApp personalizado que atende clientes automaticamente 24h por dia.

PLANOS:
• Básico (R$297/mês + R$200 setup): respostas automáticas 24h, FAQ do negócio
• Pro (R$497/mês + R$200 setup): Básico + agendamento automático + lembretes + reativação de inativos
• Premium (R$697/mês + R$200 setup): Pro + relatório semanal + múltiplos setores + ilimitado

CASES (use com naturalidade quando o lead hesitar):
- Clínica: "Fiz automação pra uma clínica odontológica no ABC — eles dobram os agendamentos sem contratar recepcionista."
- Academia: "Fiz pra uma academia em Santo André — reativou 40 alunos inativos em 1 mês sozinho."
- Salão: "Fiz pra um salão em SP — zero cliente perdido fora do horário, agenda cheia pra 3 semanas."
- Restaurante: "Fiz pra uma pizzaria em Guarulhos — pedidos via WhatsApp subiram 60% com resposta instantânea à noite."

OBJEÇÕES:
- "Tá caro": compare com um funcionário de atendimento (R$1.500+/mês) — o bot faz o mesmo trabalho
- "Não sei se preciso": pergunte "quantas mensagens ficam sem resposta quando você tá ocupado?"
- "Já tenho atendente": o bot cobre fora do horário e fins de semana sem custo extra
- "Vou pensar": urgência real — "tenho 2 slots de configuração essa semana, prefere segunda ou terça?"
- "Já uso outro": "qual você usa? O meu é configurado especificamente pro [segmento], não é genérico."

URGÊNCIA (use UMA vez em negociacao/fechamento):
- negociacao: "Tenho disponibilidade de configuração ainda essa semana."
- fechamento: "Posso dar início hoje, é só confirmar o plano."

REGRAS: máximo 3 frases por resposta, frases curtas, zero emojis forçados, zero linguagem de vendas artificial.
OBJETIVO: conduzir ao fechamento. A venda é consequência de resolver um problema real.`;
})();

const PLANOS_AUTO = {
  1: { nome: 'Básico',  mensalidade: 297, setup: 200 },
  2: { nome: 'Pro',     mensalidade: 497, setup: 200 },
  3: { nome: 'Premium', mensalidade: 697, setup: 200 },
};

function gerarMsgPropostaAuto(segmento: string): string {
  return `Ótimo! Para ${segmento || 'seu negócio'}, tenho 3 opções:

*Básico — R$297/mês* + R$200 setup
Bot responde clientes 24h, FAQ do negócio (serviços, preços, horários)

*Pro — R$497/mês* + R$200 setup
Básico + agendamento automático + lembretes + reativação de clientes sumidos

*Premium — R$697/mês* + R$200 setup
Pro + relatório semanal de atendimentos + múltiplos setores + ilimitado

Qual faz mais sentido pro volume de vocês?`;
}

function gerarMsgPIXAuto(plano: 1 | 2 | 3, nomeNegocio: string): string {
  const p = PLANOS_AUTO[plano];
  const pixKey = process.env.VICTOR_PIX_KEY || '(chave PIX não configurada)';
  return `Perfeito! Para ativar o Plano ${p.nome}:

*1ª cobrança (setup + 1º mês):* R$${p.mensalidade + p.setup}
• Setup: R$${p.setup}  •  1º mês: R$${p.mensalidade}

*A partir do 2º mês:* R$${p.mensalidade}/mês

PIX: ${pixKey}
Nome: Victor Germano

Me manda o comprovante que já inicio a configuração pra ${nomeNegocio}. ✅`;
}

// ── Fila de respostas fora do horário comercial ────────────────────────────

const FILA_RESPOSTAS_FILE = path.join(process.cwd(), 'data', 'fila_respostas.json');

interface FilaResposta {
  id: string;
  phone: string;
  sendTarget: string;
  resposta: string;
  enfileirado_em: string;
}

function isHorarioComercial(): boolean {
  const h = new Date().getHours();
  const d = new Date().getDay(); // 0=dom, 6=sab
  return d >= 1 && d <= 5 && h >= 9 && h < 18;
}

async function enviarOuEnfileirar(
  sendTarget: string,
  phone: string,
  resposta: string,
  estagio: ConversaWhatsApp['estagio']
): Promise<boolean> {
  // Onboarding, pagamento e pós-entrega respondem sempre imediatamente
  const urgente = ['onboarding', 'em_producao', 'entregue', 'fechamento'].includes(estagio);
  if (urgente || isHorarioComercial()) {
    await typingDelay();
    await sendWhatsApp(sendTarget, resposta);
    return true;
  }
  // Fora do horário: enfileira para envio às 9h
  const fila = readJson<FilaResposta[]>(FILA_RESPOSTAS_FILE) || [];
  fila.push({ id: generateId(), phone, sendTarget, resposta, enfileirado_em: new Date().toISOString() });
  writeJson(FILA_RESPOSTAS_FILE, fila);
  return false;
}

// ── Sinais de upsell e concorrência ──────────────────────────────────────

const SINAIS_UPSELL = /\b(muitas? mensagens?|n[aã]o consigo (responder|atender)|fico (fora|ocupado|sem tempo)|clientes? som(e|em)|n[aã]o (tenho|tem|consigo) tempo pra|dif[íi]cil (responder|atender)|perd(o|e) mensagens?|n[aã]o (d[aá]|consigo) atender (tudo|todo mundo))\b/i;

const SINAIS_CONCORRENTE = /\b(outro (dev|programador|desenvolvedor|empresa|fornecedor)|proposta de (outra|outro)|j[aá] (tenho|recebi|tem) (proposta|or[çc]amento|cota[çc][aã]o)|j[aá] foi (cotado|or[çc]ado)|outro (profissional|servi[çc]o))\b/i;

// ── Momento crítico ───────────────────────────────────────────────────────

function ehMomentoCritico(mensagem: string): boolean {
  const gatilhos = [
    /quero fechar/i, /vamos fechar/i, /aceito/i, /topa/i, /combinado/i,
    /quanto custa/i, /qual o valor/i, /orçamento/i,
    /call/i, /videochamada/i, /reunião/i,
    /pode fazer hoje/i, /urgente/i,
    /pagar/i, /pix/i, /boleto/i, /forma de pagamento/i,
  ];
  return gatilhos.some((r) => r.test(mensagem));
}

// ── Classificação de estágio ──────────────────────────────────────────────

// Estágios que não devem ser sobrescritos pela detecção automática
const STAGES_IMUTAVEIS = new Set<ConversaWhatsApp['estagio']>([
  'onboarding', 'em_producao', 'entregue',
]);

function detectarEstagio(
  historico: MensagemConversa[],
  novaMensagem: string
): Exclude<ConversaWhatsApp['estagio'], 'onboarding' | 'em_producao' | 'entregue'> {
  const nova = novaMensagem.toLowerCase();
  const leadMessages = historico.filter((m) => m.role === 'lead');
  const all = [...leadMessages.map((m) => m.texto), novaMensagem].join(' ').toLowerCase();

  if (/não tenho interesse|não preciso|não quero|não obrigado|sem interesse|para de me? (mandar|enviar)|remove meu número/.test(nova)) {
    return 'encerrado';
  }
  if (
    /\b(quero fechar|vamos fechar|aceito|topa|combinado|quero (contratar|começar)|quando (começa|podemos iniciar|você começa))\b/.test(nova) ||
    /\b(pix|boleto|forma de pagamento|como (pago|faço o pagamento))\b/.test(nova)
  ) {
    return 'fechamento';
  }
  if (/\b(quanto (custa|fica|é|cobr)|qual o (valor|preço|custo)|orçamento|me (passa|manda|diz) o (valor|preço)|call|reunião|videochamada|pode me ligar|você liga)\b/.test(nova)) {
    return 'negociacao';
  }
  if (/\b(já tenho (site|p[aá]gina|homepage)|já uso|caro (demais)?|sem (verba|orçamento)|não tenho (dinheiro|verba|orçamento)|deixa pra (depois|outro momento)|num momento melhor|não (é|ta) o momento)\b/.test(all)) {
    return 'objecao';
  }
  const sinaisInteresse = /\b(interesse|gostei|adorei|quero saber|me conta|pode ser|sim|claro|ótimo|boa|legal|bacana|massa|perfeito|me (fala|conta) mais|como funciona|o que inclui|tem (algum|exemplo|amostra|prévia)|vamos conversar)\b/;
  if (sinaisInteresse.test(nova) || (leadMessages.length > 0 && sinaisInteresse.test(all))) {
    return 'interesse';
  }
  return leadMessages.length > 0 ? 'interesse' : 'primeiro_contato';
}

// ── Geração de resposta ───────────────────────────────────────────────────

async function gerarResposta(
  conversa: ConversaWhatsApp,
  novaMensagem: string,
  tipoAutomacao?: string | null
): Promise<string> {
  const historicoTexto = conversa.mensagens
    .slice(-12)
    .map((m) => `${m.role === 'victor' ? 'Victor' : conversa.nome_negocio}: ${m.texto}`)
    .join('\n');

  const estagioDescricao: Record<ConversaWhatsApp['estagio'], string> = {
    primeiro_contato: 'Primeiro contato — cliente acabou de responder pela primeira vez',
    interesse:        'Cliente demonstrou interesse — explore o que ele precisa',
    objecao:          'Cliente levantou objeção — acolha e redirecione para o valor',
    negociacao:       'Negociação em curso — foque no fechamento, seja flexível',
    fechamento:       'MOMENTO DE FECHAMENTO — cliente quer fechar, não perca essa oportunidade',
    encerrado:        'Cliente não quer agora — deixe a porta aberta com leveza e encerre bem',
    onboarding:       'Cliente pagou — coletando informações para produção do site',
    em_producao:      'Site em produção — responda dúvidas sobre prazo com naturalidade',
    entregue:         'Site entregue — verifique satisfação e abra conversa de manutenção',
  };

  const siteMencionado = conversa.mensagens.some(
    (m) => m.role === 'victor' && conversa.landing_url && m.texto.includes(conversa.landing_url)
  );

  const instrucaoSite = (() => {
    if (!conversa.landing_url || siteMencionado) return '';
    if (conversa.tipo_produto === 'automacao') {
      // Para automação: link da demo só entra quando o lead já demonstrou interesse
      // (nunca na primeira mensagem — o gancho humanizado vem antes)
      if (conversa.estagio === 'interesse' || conversa.estagio === 'negociacao') {
        return `\nIMPORTANTE: O cliente demonstrou interesse na automação. Inclua OBRIGATORIAMENTE na resposta o link da demonstração: "${conversa.landing_url}" — precedido de uma frase natural como "montei uma demonstração de como ficaria pra vocês".`;
      }
      return '';
    }
    // Para sites: comportamento original
    if (conversa.estagio === 'interesse' || conversa.estagio === 'primeiro_contato' || conversa.estagio === 'negociacao') {
      return `\nIMPORTANTE: O cliente ainda não recebeu o link do site prévia. Inclua OBRIGATORIAMENTE na resposta: "${conversa.landing_url}"`;
    }
    return '';
  })();

  const tipoProjeto = tipoAutomacao
    ? `Automação WhatsApp (${tipoAutomacao}) — lead assistiu demo de bot automatizado`
    : 'Site profissional — lead viu prévia do site';

  const instrucaoUpsell =
    SINAIS_UPSELL.test(novaMensagem) && !tipoAutomacao &&
    ['interesse', 'negociacao', 'objecao'].includes(conversa.estagio)
      ? '\nATENÇÃO: o lead sinalizou dificuldade de atendimento. Além do site, plante naturalmente a ideia de automação do WhatsApp (bot que responde 24h sozinho). Não venda ainda — só deixa a curiosidade.'
      : '';

  const instrucaoConcorrente =
    SINAIS_CONCORRENTE.test(novaMensagem)
      ? '\nATENÇÃO: lead mencionou proposta concorrente. Pergunte naturalmente o que foi ofertado. Posicione seu diferencial: entrega em até 5 dias, suporte direto por WhatsApp, pagamento só na entrega. Não entre em guerra de preço — vença na confiança e no prazo.'
      : '';

  const identityPrompt = conversa.tipo_produto === 'automacao' ? VICTOR_IDENTITY_AUTOMACAO : VICTOR_IDENTITY;

  const prompt = `${identityPrompt}

CONTEXTO DO LEAD:
- Negócio: ${conversa.nome_negocio}
- Segmento: ${conversa.segmento}
- Cidade: ${conversa.cidade}
- Tipo de projeto: ${conversa.tipo_produto === 'automacao' ? 'Automação de WhatsApp (produto principal)' : tipoProjeto}
- ${conversa.tipo_produto === 'automacao' ? `Demo de automação: ${conversa.landing_url || 'ainda não gerada'}` : `Site de prévia: ${conversa.landing_url || 'não disponível'}`}
- Estágio da conversa: ${estagioDescricao[conversa.estagio]}

HISTÓRICO DA CONVERSA:
${historicoTexto || '(primeira resposta do cliente)'}

NOVA MENSAGEM DE ${conversa.nome_negocio}:
"${novaMensagem}"

Responda como Victor, uma pessoa real digitando no WhatsApp. Máximo 3 frases curtas.
Não pode parecer robô, assistente virtual ou template de vendas.${instrucaoSite}${instrucaoUpsell}${instrucaoConcorrente}
Retorne APENAS o texto da resposta, sem aspas, sem explicações.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });
    return (response.content[0] as { type: string; text: string }).text.trim();
  } catch (err) {
    log.warn(`Agent9 geração falhou: ${(err as Error).message}`);
    return 'Oi! Pode me contar mais sobre o que você precisa? Estou por aqui.';
  }
}

// ── Handler principal ─────────────────────────────────────────────────────

export async function handleIncomingWhatsApp(
  from: string,
  body: string,
  contactPhone?: string,
  isPersonalContact?: boolean,
  isMedia?: boolean
): Promise<void> {
  log.info(`Agent9: recebido de ${from}`);
  if (!from.endsWith('@c.us') && !from.endsWith('@lid')) {
    log.warn(`Agent9: ignorado — formato inesperado (${from})`);
    return;
  }

  const isBase64Binary = /^(\/9j\/|iVBORw0K|JVBER|R0lGOD|UEsDB)/.test((body || '').trim());
  if (isBase64Binary) { isMedia = true; body = '[imagem]'; }

  if (!isMedia && (!body || body.trim().length < 2)) return;

  // Nunca responder ao próprio Victor
  const ownerDigits = (process.env.OWNER_WHATSAPP || '').replace(/\D/g, '').replace(/^55/, '');
  const senderDigits = (contactPhone || from.replace('@c.us', '').replace('@lid', '')).replace(/\D/g, '').replace(/^55/, '');
  if (ownerDigits && senderDigits === ownerDigits) {
    log.info('Agent9: mensagem do próprio Victor — ignorando');
    return;
  }

  const rawId = from.replace('@c.us', '').replace('@lid', '');
  const isLid  = from.endsWith('@lid');

  // ── LID map ───────────────────────────────────────────────────────────
  const lidMap = readJson<Record<string, string>>(LID_MAP_FILE) || {};
  if (isLid && contactPhone && contactPhone.length >= 10) {
    if (!lidMap[rawId]) { lidMap[rawId] = contactPhone; writeJson(LID_MAP_FILE, lidMap); }
  } else if (isLid && (!contactPhone || contactPhone.length < 10) && lidMap[rawId]) {
    contactPhone = lidMap[rawId];
  }

  const phone = contactPhone || rawId;

  // ── Blacklist (opt-out / LGPD) ────────────────────────────────────────
  if (isBlacklisted(phone)) {
    log.info(`Agent9: ${phone} está na blacklist — ignorando`);
    return;
  }

  if (isOnCooldown(phone)) {
    log.info(`Agent9: ${phone} em cooldown`);
    return;
  }

  const leadInfo = findLeadInfo(phone) || (contactPhone ? findLeadInfo(rawId) : null);

  if (isPersonalContact && !leadInfo) {
    log.info(`Agent9: ${from} é contato pessoal fora da cadência — ignorando`);
    return;
  }

  const finalLeadInfo = leadInfo ?? {
    nome_negocio: 'contato', slug: phone, cidade: '', segmento: '', landing_url: '', etapa_cadencia: 0,
  };

  // Anti-bot pré-histórico
  if (isAutomatedMessage(body, [])) {
    log.info(`Agent9: auto-resposta detectada de ${phone} — ignorando`);
    registrarBotResponse(phone);
    return;
  }

  const { conversa, conversas } = getOrCreateConversa(phone, finalLeadInfo, contactPhone);

  // Atualiza metadados quando conversa foi criada sem contexto
  if (conversa.nome_negocio === 'contato' && leadInfo) {
    conversa.nome_negocio   = leadInfo.nome_negocio;
    conversa.slug           = leadInfo.slug || phone;
    conversa.cidade         = leadInfo.cidade || '';
    conversa.segmento       = leadInfo.segmento || '';
    conversa.landing_url    = leadInfo.landing_url || '';
    conversa.tipo_automacao = leadInfo.tipo_automacao ?? null;
    log.info(`Agent9: conversa ${phone} atualizada → ${conversa.nome_negocio}`);
  } else if (!conversa.tipo_automacao && finalLeadInfo.tipo_automacao) {
    conversa.tipo_automacao = finalLeadInfo.tipo_automacao;
  }

  // Anti-bot com histórico
  if (isAutomatedMessage(body, conversa.mensagens)) {
    log.info(`Agent9: mensagem automática detectada de ${conversa.nome_negocio} — ignorando`);
    return;
  }

  if (leadInfo?.slug) {
    try { marcarResposta(leadInfo.slug, 'respondeu'); } catch { /* silently ignore */ }
  }

  const ownerWa       = process.env.OWNER_WHATSAPP || '';
  const sendTarget    = contactPhone || from;
  const isAutomacaoLead = conversa.tipo_produto === 'automacao';

  // ── Mídia: comprovante ou arquivo genérico ────────────────────────────
  if (isMedia) {
    adicionarMensagem(conversas, phone, 'lead', '[arquivo recebido]');

    if (conversa.estagio === 'fechamento') {
      // Sinaliza comprovante recebido e cria entrada no projeto
      if (!conversa.comprovante_recebido) {
        conversa.comprovante_recebido    = true;
        conversa.comprovante_recebido_em = new Date().toISOString();
        saveConversas(conversas);
        criarEntradaProjeto(conversa);
      }
      if (ownerWa) {
        const numLink = `wa.me/55${phone.replace(/\D/g, '').replace(/^55/, '')}`;
        sendWhatsApp(ownerWa,
          `📎 *${conversa.nome_negocio}* enviou um arquivo — possível comprovante de pagamento!\n\nConfirme e em 30min o onboarding inicia automaticamente: ${numLink}`
        ).catch(() => {});
      }
      await typingDelay();
      const ackPag = 'Recebi! Vou confirmar o pagamento aqui e já te aviso para a gente começar.';
      await sendWhatsApp(sendTarget, ackPag);
      adicionarMensagem(conversas, phone, 'victor', ackPag);
    } else if (conversa.estagio === 'onboarding' && (conversa.onboarding_info?.passo ?? 0) === 2) {
      // Logo enviada durante onboarding
      const info = conversa.onboarding_info!;
      info.logo = 'recebida';
      info.passo = 3;
      conversa.onboarding_info = info;
      saveConversas(conversas);
      await typingDelay();
      const nextQ = ONBOARDING_PERGUNTAS[2];
      await sendWhatsApp(sendTarget, nextQ);
      adicionarMensagem(conversas, phone, 'victor', nextQ);
    } else {
      await typingDelay();
      const ackMedia = 'Recebi! Se quiser me contar mais por texto, pode falar.';
      await sendWhatsApp(sendTarget, ackMedia);
      adicionarMensagem(conversas, phone, 'victor', ackMedia);
    }

    setCooldown(phone);
    log.info(`Agent9: mídia recebida de ${conversa.nome_negocio} [${conversa.estagio}]`);
    return;
  }

  // Salva mensagem do lead
  adicionarMensagem(conversas, phone, 'lead', body);

  // ── Detecção de indicação ─────────────────────────────────────────────
  if (detectarIndicacao(body)) {
    salvarIndicacao(conversa, body);
    if (ownerWa) {
      sendWhatsApp(ownerWa,
        `🤝 *${conversa.nome_negocio}* mencionou uma indicação!\n\n"${body.slice(0, 200)}"\n\nSalvo em indicacoes.json — follow-up automático após entrega do projeto.`
      ).catch(() => {});
    }
  }

  // ── Probe queue: aguardando pitch completo ────────────────────────────
  const probeQueueRaw = readJson<Array<{ telefone: string }>>(PROBE_QUEUE_FILE) || [];
  const phoneDigits   = phone.replace(/\D/g, '').replace(/^55/, '');
  const isInProbeQueue = probeQueueRaw.some(
    (e) => e.telefone.replace(/\D/g, '').replace(/^55/, '') === phoneDigits
  );
  if (isInProbeQueue) {
    await typingDelay();
    const holdMsg = 'Oi! Boa, já estou finalizando aqui. Mando tudo em instantes.';
    await sendWhatsApp(sendTarget, holdMsg);
    adicionarMensagem(conversas, phone, 'victor', holdMsg);
    setCooldown(phone);
    log.info(`Agent9: ${conversa.nome_negocio} ainda na probe_queue`);
    return;
  }

  // ── Onboarding: coleta de informações do projeto ──────────────────────
  if (conversa.estagio === 'onboarding') {
    const isAutoOnboarding = conversa.tipo_produto === 'automacao';
    const PERGUNTAS = isAutoOnboarding ? ONBOARDING_PERGUNTAS_AUTO : ONBOARDING_PERGUNTAS;
    const info: OnboardingInfo = conversa.onboarding_info || { passo: 1 };
    const passo = info.passo || 1;

    // Salva resposta da pergunta atual
    if (isAutoOnboarding) {
      switch (passo) {
        case 1: info.whatsapp_bot        = body; break;
        case 2: info.duvidas_frequentes  = body; break;
        case 3: info.horario_funcionamento = body; break;
        case 4: info.catalogo            = body; break; // texto (arquivo tratado no bloco mídia)
        case 5: info.msg_boas_vindas     = body; break;
      }
    } else {
      switch (passo) {
        case 1: info.instagram = body; break;
        case 2: info.logo      = body; break; // texto (arquivo tratado no bloco mídia acima)
        case 3: info.site_ref  = body; break;
        case 4: info.descricao = body; break;
        case 5: info.servicos  = body; break;
      }
    }
    info.passo = Math.min(passo + 1, 6);
    conversa.onboarding_info = info;
    saveConversas(conversas);

    let resposta: string;
    if (info.passo <= 5) {
      resposta = PERGUNTAS[info.passo - 1];
    } else {
      // Onboarding completo
      if (isAutoOnboarding) {
        resposta = 'Perfeito, tenho tudo que preciso! Vou configurar o bot nos próximos dias. Assim que estiver pronto te aviso para testarmos juntos antes de ativar. Qualquer dúvida me chama aqui.';
        conversa.estagio = 'em_producao';
        saveConversas(conversas);
        atualizarProjeto(conversa.slug, {
          status: 'em_producao',
          onboarding_completo_em: new Date().toISOString(),
          onboarding_info: {
            whatsapp_bot:         info.whatsapp_bot,
            duvidas_frequentes:   info.duvidas_frequentes,
            horario_funcionamento: info.horario_funcionamento,
            catalogo:             info.catalogo,
            msg_boas_vindas:      info.msg_boas_vindas,
          },
        });
        if (ownerWa) {
          sendWhatsApp(ownerWa,
            `✅ *${conversa.nome_negocio}* — Onboarding de automação completo!\n\n` +
            `📱 WhatsApp bot: ${info.whatsapp_bot || '—'}\n` +
            `❓ Dúvidas frequentes: ${info.duvidas_frequentes || '—'}\n` +
            `🕐 Horário: ${info.horario_funcionamento || '—'}\n` +
            `📋 Catálogo: ${info.catalogo || '—'}\n` +
            `💬 Boas-vindas: ${info.msg_boas_vindas || '—'}`
          ).catch(() => {});
        }
        await notifyOwner(
          `✅ ${conversa.nome_negocio} — onboarding de automação completo! Configure o bot e ative.`,
          `🤖 ${conversa.nome_negocio} — pronto para configurar bot`
        );
      } else {
        resposta = 'Perfeito, tenho tudo! Vou começar a produção hoje mesmo. Em até 5 dias úteis você recebe a prévia do site pra aprovação. Qualquer dúvida pode me chamar aqui.';
        conversa.estagio = 'em_producao';
        saveConversas(conversas);
        atualizarProjeto(conversa.slug, {
          status: 'em_producao',
          onboarding_completo_em: new Date().toISOString(),
          onboarding_info: {
            instagram: info.instagram,
            logo:      info.logo,
            site_ref:  info.site_ref,
            descricao: info.descricao,
            servicos:  info.servicos,
          },
        });
        if (ownerWa) {
          sendWhatsApp(ownerWa,
            `✅ *${conversa.nome_negocio}* — Onboarding completo! Pode iniciar a produção.\n\n` +
            `📱 Instagram: ${info.instagram || '—'}\n` +
            `🖼️ Logo: ${info.logo || '—'}\n` +
            `🌐 Referência: ${info.site_ref || '—'}\n` +
            `📝 Descrição: ${info.descricao || '—'}\n` +
            `🛍️ Serviços: ${info.servicos || '—'}`
          ).catch(() => {});
        }
        await notifyOwner(
          `✅ ${conversa.nome_negocio} — onboarding completo! Todas as informações coletadas. Pode começar a produção.`,
          `🚀 ${conversa.nome_negocio} — pronto para produção`
        );
      }
    }

    await typingDelay();
    await sendWhatsApp(sendTarget, resposta);
    adicionarMensagem(conversas, phone, 'victor', resposta);
    setCooldown(phone);
    log.success(`Agent9: onboarding${isAutoOnboarding ? ' auto' : ''} passo ${passo}/5 — ${conversa.nome_negocio}`);
    return;
  }

  // ── Atualiza estágio (não sobrescreve estágios imutáveis) ─────────────
  const estagioAnterior = conversa.estagio;
  if (!STAGES_IMUTAVEIS.has(conversa.estagio)) {
    conversa.estagio = detectarEstagio(conversa.mensagens.slice(0, -1), body);
  }
  // Se a LP já foi enviada e o lead está respondendo de volta sem ter recebido proposta →
  // ele já viu o site e voltou, não há motivo para ficar em interesse — vai direto para negociacao
  const lpJaEnviada = !!conversa.landing_url &&
    conversa.mensagens.some((m) => m.role === 'victor' && m.texto.includes(conversa.landing_url!));
  const numMsgsLead = conversa.mensagens.filter((m) => m.role === 'lead').length;
  if (lpJaEnviada && conversa.estagio === 'interesse' && numMsgsLead >= 2 && !conversa.proposta_enviada) {
    conversa.estagio = 'negociacao';
  }
  const estagioEscalou = estagioAnterior !== conversa.estagio;

  // Auto-blacklist em opt-out explícito
  if (conversa.estagio === 'encerrado' && estagioAnterior !== 'encerrado') {
    addToBlacklist(phone);
    log.info(`Agent9: ${conversa.nome_negocio} adicionado à blacklist por opt-out`);
  }

  // Etiqueta WhatsApp Business
  const ESTAGIOS_QUENTES = new Set(['interesse', 'negociacao', 'fechamento']);
  if (estagioEscalou && ESTAGIOS_QUENTES.has(conversa.estagio)) {
    addLabelToChat(from, 'Interessados').catch(() => {});
  }

  // ── Seleção de slot de agenda ─────────────────────────────────────────
  if ((conversa.slots_ofertados?.length ?? 0) > 0) {
    const numMatch = body.match(/\b([1-4])\b/);
    if (numMatch) {
      const slotIdx = parseInt(numMatch[1]) - 1;
      const slots   = conversa.slots_ofertados!;
      if (slotIdx >= 0 && slotIdx < slots.length) {
        const slot = slots[slotIdx];
        await criarEventoCall(conversa.nome_negocio, phone, slot);
        const confirmMsg = `Perfeito! Anotei aqui: *${slot.label}*. Te ligo neste número na hora marcada. Qualquer coisa me chama antes!`;
        await typingDelay();
        await sendWhatsApp(sendTarget, confirmMsg);
        adicionarMensagem(conversas, phone, 'victor', confirmMsg);
        conversa.slots_ofertados  = [];
        conversa.reuniao_agendada = slot.inicio;
        saveConversas(conversas);
        setCooldown(phone);
        if (ownerWa) sendWhatsApp(ownerWa, `📅 Call agendada com *${conversa.nome_negocio}*: ${slot.label}`).catch(() => {});
        return;
      }
    }
  }

  // ── Pedido de call ────────────────────────────────────────────────────
  const querCall =
    /\b(call|ligar|ligue|liga[çc][aã]o|reuni[aã]o|videochamada|agendar|quando (pode|posso)|me liga|conversar por voz|zoom|google meet|teams|skype)\b/i.test(body) ||
    /zoom\.us|meet\.google|teams\.microsoft|whereby\.com/i.test(body);
  if (querCall && !conversa.reuniao_agendada) {
    const slots    = await getAvailableSlots();
    const slotsMsg = formatarSlotsWA(slots);
    await typingDelay();
    await sendWhatsApp(sendTarget, slotsMsg);
    adicionarMensagem(conversas, phone, 'victor', slotsMsg);
    conversa.slots_ofertados = slots;
    saveConversas(conversas);
    setCooldown(phone);
    if (ownerWa) sendWhatsApp(ownerWa, `📅 *${conversa.nome_negocio}* pediu uma call. Slots oferecidos.`).catch(() => {});
    return;
  }

  // ── Proposta completa (primeira vez em negociação) ────────────────────
  if (conversa.estagio === 'negociacao' && !conversa.proposta_enviada) {
    const tipoAuto    = leadInfo?.tipo_automacao ?? conversa.tipo_automacao ?? null;
    const propostaMsg = isAutomacaoLead
      ? gerarMsgPropostaAuto(conversa.segmento)
      : gerarMsgProposta(conversa.nome_negocio, tipoAuto, conversa.segmento);
    await typingDelay();
    await sendPropostaPartida(sendTarget, propostaMsg);
    adicionarMensagem(conversas, phone, 'victor', propostaMsg);
    conversa.proposta_enviada = true;
    saveConversas(conversas);
    setCooldown(phone);

    const dadosPdf: DadosProposta = {
      nomeNegocio: conversa.nome_negocio,
      segmento:    conversa.segmento,
      cidade:      conversa.cidade,
      slug:        conversa.slug,
    };
    setTimeout(async () => {
      const filePath = await gerarPropostaPDF(dadosPdf);
      if (filePath) {
        const pdfUrl = urlProposta(conversa.slug);
        const pdfMsg = `Também preparei uma versão completa em PDF, caso queira guardar ou compartilhar: ${pdfUrl}`;
        await sendWhatsApp(sendTarget, pdfMsg).catch(() => {});
        adicionarMensagem(getConversas(), phone, 'victor', pdfMsg);
      }
    }, 8000);

    await notifyOwner(`💰 ${conversa.nome_negocio} entrou em negociação — proposta enviada`, `💰 ${conversa.nome_negocio} — NEGOCIAÇÃO`);
    return;
  }

  // ── Opção escolhida ───────────────────────────────────────────────────
  if (conversa.estagio === 'fechamento' && !conversa.opcao_escolhida) {
    const opcMatch = body.match(/\b(?:(?:op[çc][aã]o|mini)\s*)?([0-3])\b/i)
      || body.match(/\b(mini)\b/i);
    if (opcMatch) conversa.opcao_escolhida = (opcMatch[1].toLowerCase() === 'mini' ? 0 : parseInt(opcMatch[1])) as 0 | 1 | 2 | 3;
  }

  // ── Instruções PIX (primeira vez em fechamento com opção) ─────────────
  if (conversa.estagio === 'fechamento' && conversa.opcao_escolhida && !conversa.pix_enviado) {
    const pixMsg = isAutomacaoLead && conversa.plano_escolhido
      ? gerarMsgPIXAuto(conversa.plano_escolhido, conversa.nome_negocio)
      : gerarMsgPIX(conversa.opcao_escolhida);
    await typingDelay();
    await sendWhatsApp(sendTarget, pixMsg);
    adicionarMensagem(conversas, phone, 'victor', pixMsg);
    conversa.pix_enviado = true;
    saveConversas(conversas);
    setCooldown(phone);
    if (ownerWa) {
      sendWhatsApp(ownerWa,
        `🔥🔥 *${conversa.nome_negocio}* escolheu a Opção ${conversa.opcao_escolhida}! PIX enviado. Aguarde o comprovante.`
      ).catch(() => {});
    }
    await notifyOwner(
      `⚡ ${conversa.nome_negocio} escolheu a Opção ${conversa.opcao_escolhida} e recebeu as instruções de pagamento.`,
      `🔥 ${conversa.nome_negocio} — FECHAMENTO`
    );
    return;
  }

  // ── Resposta padrão via Claude ────────────────────────────────────────
  const resposta = await gerarResposta(conversa, body, conversa.tipo_automacao ?? leadInfo?.tipo_automacao);
  const enviouAgora = await enviarOuEnfileirar(sendTarget, phone, resposta, conversa.estagio);
  setCooldown(phone);
  adicionarMensagem(conversas, phone, 'victor', resposta);
  log.success(`Agent9: resposta ${enviouAgora ? 'enviada' : 'enfileirada (fora do horário)'} para ${conversa.nome_negocio} [${conversa.estagio}]`);

  // Notificação WhatsApp em estágios quentes (sempre — mesmo quando enfileirado, Victor deve saber)
  const estagioQuente =
    conversa.estagio === 'fechamento' ||
    conversa.estagio === 'negociacao' ||
    (conversa.estagio === 'interesse' && estagioEscalou && estagioAnterior === 'primeiro_contato');
  if (ownerWa && estagioQuente) {
    const urgIcon = conversa.estagio === 'fechamento' ? '🔥🔥' : conversa.estagio === 'negociacao' ? '💰' : '👀';
    const filaAviso = !enviouAgora ? '\n\n⏰ Resposta enfileirada — será enviada às 9h.' : '';
    sendWhatsApp(ownerWa,
      `${urgIcon} *${conversa.nome_negocio}* — ${conversa.estagio.toUpperCase()}\n\nDeles: "${body.slice(0, 120)}"\nBot: "${resposta.slice(0, 120)}"${filaAviso}\n\nConsidere assumir a conversa!`
    ).catch(() => {});
  }

  // Notificação Pushover
  const critico = ehMomentoCritico(body);
  await notifyOwner(
    `${critico ? '⚡ AÇÃO NECESSÁRIA\n\n' : ''}Deles: "${body.slice(0, 120)}"\n\nBot: "${resposta.slice(0, 120)}"\n\nEstágio: ${conversa.estagio}${!enviouAgora ? '\n⏰ Fora do horário — enviará às 9h.' : ''}`,
    critico ? `🔥 ${conversa.nome_negocio} — MOMENTO DE FECHAMENTO` : `💬 ${conversa.nome_negocio} respondeu`
  );
}

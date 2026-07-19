/**
 * Agente 8 — Auto-Envio
 * Envia automaticamente todas as mensagens revisadas pelo Agente 6.
 * Sem necessidade de aprovação manual no painel.
 * Notifica Victor via Pushover para cada mensagem enviada.
 *
 * Funcionalidades:
 * - Deduplica por slug (não aciona o mesmo negócio duas vezes)
 * - Janelas de envio por segmento (restaurante → tarde, padaria → manhã, etc.)
 * - Histórico rico persistido em data/historico_contatos.json
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import nodemailer from 'nodemailer';
import { Mensagem, Diagnostico } from '../types';
import { log } from '../utils/logger';
import { notifyOwner } from '../utils/notifications';
import { dataPath, readJson, writeJson, today, generateId } from '../utils/dataHelpers';
import { isNaBlacklist, randomDelay } from '../utils/antiSpam';
import { registrarNaCadencia } from './cadencia';

const PROBE_QUEUE_FILE         = path.join(process.cwd(), 'data', 'probe_queue.json');
const HISTORICO_CONTATOS_FILE  = path.join(process.cwd(), 'data', 'historico_contatos.json');

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

// ── HISTÓRICO RICO DE CONTATOS ─────────────────────────────────────────────

interface HistoricoContato {
  slug: string;
  nome_negocio: string;
  telefone: string;
  segmento_macro: string;
  segmento_nivel2: string;
  segmento_micro: string;
  cidade: string;
  canal: string;
  data_acionado: string;
  status_envio: string;
}

function getHistorico(): HistoricoContato[] {
  return readJson<HistoricoContato[]>(HISTORICO_CONTATOS_FILE) || [];
}

function jaFoiAcionado(slug: string): boolean {
  return getHistorico().some((h) => h.slug === slug);
}

function jaFoiAcionadoPorTelefone(telefone: string): boolean {
  const norm = telefone.replace(/\D/g, '').replace(/^55/, '');
  if (!norm || norm.length < 10) return false;
  return getHistorico().some((h) => h.telefone.replace(/\D/g, '').replace(/^55/, '') === norm);
}

async function checkLPHealth(url: string | null | undefined): Promise<boolean> {
  if (!url || url.includes('localhost') || url.includes('127.0.0.1')) return true;
  try {
    const resp = await axios.get(url, { timeout: 8000, validateStatus: (s) => s < 500 });
    return resp.status >= 200 && resp.status < 400;
  } catch {
    return false;
  }
}

function registrarContato(msg: Mensagem, diag: Diagnostico | undefined): void {
  const historico = getHistorico();
  if (historico.some((h) => h.slug === msg.slug)) return; // idempotente
  historico.push({
    slug: msg.slug,
    nome_negocio: msg.nome_negocio,
    telefone: diag?.telefone || '',
    segmento_macro: diag?.segmento?.macro || '',
    segmento_nivel2: diag?.segmento?.nivel2 || '',
    segmento_micro: diag?.segmento?.micro?.[0] || diag?.categoria || '',
    cidade: diag?.cidade || '',
    canal: msg.canal,
    data_acionado: msg.data_envio || new Date().toISOString(),
    status_envio: msg.status,
  });
  writeJson(HISTORICO_CONTATOS_FILE, historico);
}

// Constrói o histórico retroativamente a partir dos arquivos existentes.
// Só executa se historico_contatos.json ainda não existe.
async function construirHistoricoRetroativo(): Promise<void> {
  if (fs.existsSync(HISTORICO_CONTATOS_FILE)) return;

  log.info('Agent8: construindo histórico retroativo de contatos...');
  const dataDir = path.join(process.cwd(), 'data');
  const vistos  = new Set<string>();
  const historico: HistoricoContato[] = [];

  const arquivos = fs.readdirSync(dataDir)
    .filter((f) => /^mensagens_\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();

  for (const nomeArquivo of arquivos) {
    const data     = nomeArquivo.replace('mensagens_', '').replace('.json', '');
    const msgFile  = path.join(dataDir, nomeArquivo);
    const diagFile = path.join(dataDir, `diagnosticos_${data}.json`);

    const msgs  = readJson<Mensagem[]>(msgFile) || [];
    const diags = readJson<Diagnostico[]>(diagFile) || [];

    for (const msg of msgs) {
      if (!['enviado', 'probe_enviado'].includes(msg.status)) continue;
      if (vistos.has(msg.slug)) continue;
      vistos.add(msg.slug);

      const diag = diags.find((d) => d.slug === msg.slug);
      historico.push({
        slug: msg.slug,
        nome_negocio: msg.nome_negocio,
        telefone: diag?.telefone || '',
        segmento_macro: diag?.segmento?.macro || '',
        segmento_nivel2: diag?.segmento?.nivel2 || '',
        segmento_micro: diag?.segmento?.micro?.[0] || diag?.categoria || '',
        cidade: diag?.cidade || '',
        canal: msg.canal,
        data_acionado: msg.data_envio || msg.data_criacao,
        status_envio: msg.status,
      });
    }
  }

  writeJson(HISTORICO_CONTATOS_FILE, historico);
  log.success(`Agent8: histórico retroativo construído — ${historico.length} contatos`);
}

// ── JANELAS DE ENVIO POR SEGMENTO ─────────────────────────────────────────
// Cada segmento define uma ou mais janelas { inicio, fim } em hora local (0–23).
// Lógica: inicio <= hora < fim

interface Janela { inicio: number; fim: number }

const JANELAS_SEGMENTO: Record<string, Janela[]> = {
  // ── Alimentação ────────────────────────────────────────────────────────
  // Restaurantes: rush do almoço 12-14h e do jantar 19h+ → janelas fora desses horários
  'restaurante':     [{ inicio: 10, fim: 12 }, { inicio: 14, fim: 17 }],
  'churrascaria':    [{ inicio: 10, fim: 12 }, { inicio: 14, fim: 17 }],
  'pizzaria':        [{ inicio: 14, fim: 17 }],
  'hamburgueria':    [{ inicio: 14, fim: 17 }],
  'lanchonete':      [{ inicio: 10, fim: 12 }],
  'espetinho':       [{ inicio: 14, fim: 17 }],
  // Padarias e cafeterias: abertas cedo, movimento de manhã
  'padaria':         [{ inicio: 8, fim: 10 }],
  'pão':             [{ inicio: 8, fim: 10 }],
  'cafeteria':       [{ inicio: 8, fim: 10 }],
  'café ':           [{ inicio: 8, fim: 10 }],
  // Bares: tarde é o melhor momento (ainda não abriram o serviço noturno)
  'bar ':            [{ inicio: 14, fim: 17 }],
  'pub':             [{ inicio: 14, fim: 17 }],
  'boteco':          [{ inicio: 14, fim: 17 }],
  // Sobremesas: abertura no período do almoço
  'sorveteria':      [{ inicio: 11, fim: 14 }],
  'açaí':            [{ inicio: 11, fim: 14 }],
  'doce':            [{ inicio: 10, fim: 12 }],
  'confeitaria':     [{ inicio: 9,  fim: 11 }],
  'doceria':         [{ inicio: 9,  fim: 11 }],

  // ── Saúde ──────────────────────────────────────────────────────────────
  // Dentistas: agendam no início da manhã e logo após o almoço
  'dentista':        [{ inicio: 8, fim: 11 }, { inicio: 14, fim: 17 }],
  'odontologia':     [{ inicio: 8, fim: 11 }, { inicio: 14, fim: 17 }],
  'ortodontia':      [{ inicio: 8, fim: 11 }, { inicio: 14, fim: 17 }],
  // Clínicas médicas: mesma lógica que dentistas
  'médico':          [{ inicio: 8, fim: 11 }],
  'clínica':         [{ inicio: 9, fim: 11 }, { inicio: 14, fim: 16 }],
  'consultório':     [{ inicio: 9, fim: 11 }, { inicio: 14, fim: 16 }],
  // Veterinário: manhã cedo
  'veterinário':     [{ inicio: 9, fim: 11 }],
  'pet':             [{ inicio: 9, fim: 11 }],
  'animal':          [{ inicio: 9, fim: 11 }],
  // Farmácia: manhã cedo (antes do rush do almoço)
  'farmácia':        [{ inicio: 9, fim: 11 }],
  'drogaria':        [{ inicio: 9, fim: 11 }],
  // Academia: evitar horário de pico (6-8h e 18-20h) → meio da manhã
  'academia':        [{ inicio: 10, fim: 12 }],
  'crossfit':        [{ inicio: 10, fim: 12 }],
  'musculação':      [{ inicio: 10, fim: 12 }],
  'pilates':         [{ inicio: 9,  fim: 11 }],
  'fisioterapia':    [{ inicio: 9,  fim: 11 }, { inicio: 14, fim: 16 }],
  'psicólogo':       [{ inicio: 9,  fim: 11 }],
  'psiquiatra':      [{ inicio: 9,  fim: 11 }],
  'nutricionista':   [{ inicio: 9,  fim: 11 }],
  'fonoaudiólogo':   [{ inicio: 9,  fim: 11 }],

  // ── Beleza ─────────────────────────────────────────────────────────────
  // Salões e barbearias: início da manhã ou pós-almoço
  'salão':           [{ inicio: 9, fim: 11 }, { inicio: 14, fim: 16 }],
  'cabeleireiro':    [{ inicio: 9, fim: 11 }, { inicio: 14, fim: 16 }],
  'barbearia':       [{ inicio: 9, fim: 11 }, { inicio: 14, fim: 16 }],
  'estética':        [{ inicio: 9, fim: 11 }, { inicio: 14, fim: 16 }],
  'depilação':       [{ inicio: 9, fim: 11 }, { inicio: 14, fim: 16 }],
  'nail':            [{ inicio: 10, fim: 12 }],
  'manicure':        [{ inicio: 10, fim: 12 }],
  'spa':             [{ inicio: 10, fim: 12 }],
  'sobrancelha':     [{ inicio: 9,  fim: 11 }],
  'micropigmentação':[{ inicio: 9,  fim: 11 }],

  // ── Educação ───────────────────────────────────────────────────────────
  // Escolas: inícios de período (antes das aulas ou intervalo)
  'escola':          [{ inicio: 8, fim: 10 }, { inicio: 14, fim: 16 }],
  'colégio':         [{ inicio: 8, fim: 10 }, { inicio: 14, fim: 16 }],
  'creche':          [{ inicio: 8, fim: 10 }],
  // Cursos e idiomas: horário administrativo
  'curso':           [{ inicio: 9, fim: 11 }],
  'inglês':          [{ inicio: 9, fim: 11 }],
  'idioma':          [{ inicio: 9, fim: 11 }],
  'coworking':       [{ inicio: 9, fim: 11 }],

  // ── Comércio ───────────────────────────────────────────────────────────
  // Lojas: abertura (10h) ou meio da manhã
  'loja':            [{ inicio: 10, fim: 12 }],
  'moda':            [{ inicio: 10, fim: 12 }],
  'vestuário':       [{ inicio: 10, fim: 12 }],
  'roupa':           [{ inicio: 10, fim: 12 }],
  'calçado':         [{ inicio: 10, fim: 12 }],
  'óptica':          [{ inicio: 10, fim: 12 }],
  'joalheria':       [{ inicio: 10, fim: 12 }],
  'relojoaria':      [{ inicio: 10, fim: 12 }],
  'eletrônico':      [{ inicio: 10, fim: 12 }],
  'supermercado':    [{ inicio: 9,  fim: 11 }],
  'mercado':         [{ inicio: 9,  fim: 11 }],
  'flores':          [{ inicio: 8,  fim: 10 }],
  'floricult':       [{ inicio: 8,  fim: 10 }],
  'floricultura':    [{ inicio: 8,  fim: 10 }],
  'pet shop':        [{ inicio: 9,  fim: 11 }],

  // ── Serviços profissionais ─────────────────────────────────────────────
  // Escritórios: chegam às 9h, melhor janela é logo no início
  'advogado':        [{ inicio: 9, fim: 11 }],
  'advocacia':       [{ inicio: 9, fim: 11 }],
  'jurídico':        [{ inicio: 9, fim: 11 }],
  'contabilidade':   [{ inicio: 9, fim: 11 }],
  'contador':        [{ inicio: 9, fim: 11 }],
  'imobiliária':     [{ inicio: 9, fim: 12 }],
  'corretor':        [{ inicio: 9, fim: 12 }],
  'seguro':          [{ inicio: 9, fim: 11 }],
  'financeiro':      [{ inicio: 9, fim: 11 }],
  'consultoria':     [{ inicio: 9, fim: 11 }],
  'marketing':       [{ inicio: 9, fim: 11 }],

  // ── Auto ───────────────────────────────────────────────────────────────
  // Mecânicos: chegam cedo, rush 8-9h → melhor logo após
  'oficina':         [{ inicio: 8, fim: 11 }],
  'mecânica':        [{ inicio: 8, fim: 11 }],
  'borracharia':     [{ inicio: 8, fim: 11 }],
  'auto':            [{ inicio: 8, fim: 11 }],
  'lava-jato':       [{ inicio: 9, fim: 11 }],
  'lava jato':       [{ inicio: 9, fim: 11 }],
  'estacionamento':  [{ inicio: 9, fim: 11 }],
  'concessionária':  [{ inicio: 9, fim: 11 }],

  // ── Turismo e Hospedagem ───────────────────────────────────────────────
  // Check-out manhã, melhor momento é pós-check-out
  'hotel':           [{ inicio: 10, fim: 12 }],
  'pousada':         [{ inicio: 10, fim: 12 }],
  'hostel':          [{ inicio: 10, fim: 12 }],
  'resort':          [{ inicio: 10, fim: 12 }],
  'turismo':         [{ inicio: 10, fim: 12 }],
  'viagem':          [{ inicio: 9,  fim: 11 }],
  'agência de tur':  [{ inicio: 9,  fim: 11 }],

  // ── Eventos ────────────────────────────────────────────────────────────
  'buffet':          [{ inicio: 10, fim: 12 }],
  'evento':          [{ inicio: 10, fim: 12 }],
  'casamento':       [{ inicio: 10, fim: 12 }],
  'fotógrafo':       [{ inicio: 10, fim: 12 }],
  'videografia':     [{ inicio: 10, fim: 12 }],
  'decoração':       [{ inicio: 9,  fim: 12 }],

  // ── Construção e Casa ──────────────────────────────────────────────────
  'constru':         [{ inicio: 8, fim: 10 }],
  'engenheiro':      [{ inicio: 9, fim: 11 }],
  'arquiteto':       [{ inicio: 9, fim: 11 }],
  'empreiteira':     [{ inicio: 8, fim: 10 }],
  'material de':     [{ inicio: 8, fim: 10 }],
  'elétric':         [{ inicio: 8, fim: 10 }],
  'hidráulic':       [{ inicio: 8, fim: 10 }],
  'marceneiro':      [{ inicio: 8, fim: 10 }],
  'marcenaria':      [{ inicio: 8, fim: 10 }],
  'reformas':        [{ inicio: 8, fim: 10 }],
  'pintor':          [{ inicio: 8, fim: 10 }],

  // ── Default (todos os outros) ──────────────────────────────────────────
  'default':         [{ inicio: 9, fim: 11 }, { inicio: 14, fim: 17 }],
};

function getJanelasParaSegmento(diag: Diagnostico | undefined): Janela[] {
  if (!diag) return JANELAS_SEGMENTO['default'];

  // Testa micro[], nivel2, categoria em ordem — mais específico primeiro
  const candidatos = [
    ...(diag.segmento?.micro || []),
    diag.segmento?.nivel2 || '',
    diag.categoria || '',
  ].map((s) => s.toLowerCase());

  for (const texto of candidatos) {
    for (const [chave, janelas] of Object.entries(JANELAS_SEGMENTO)) {
      if (chave !== 'default' && texto.includes(chave)) return janelas;
    }
  }
  return JANELAS_SEGMENTO['default'];
}

function estaEmJanela(janelas: Janela[], hora: number): boolean {
  return janelas.some((j) => hora >= j.inicio && hora < j.fim);
}

function descreveJanelas(janelas: Janela[]): string {
  return janelas.map((j) => `${j.inicio}h–${j.fim}h`).join(' ou ');
}

// ── WhatsApp via API ───────────────────────────────────────────────────────

interface SendResult {
  ok: boolean;
  numero_invalido?: boolean;
}

async function sendWhatsAppViaApi(phone: string, message: string): Promise<SendResult> {
  const port = process.env.PORT || '3000';
  try {
    const resp = await axios.post(
      `http://localhost:${port}/api/whatsapp/send`,
      { phone, message },
      { timeout: 20000 }
    );
    return {
      ok: resp.data?.success === true,
      numero_invalido: resp.data?.numero_invalido === true,
    };
  } catch (err) {
    log.error(`Agent8 HTTP WhatsApp falhou: ${(err as Error).message}`);
    return { ok: false };
  }
}

// ── Arquivo de mensagens ───────────────────────────────────────────────────

interface FilePair { msgFile: string; diagFile: string; }

function getRecentFilePairs(): FilePair[] {
  const dataDir = path.join(process.cwd(), 'data');
  const pairs: FilePair[] = [];
  for (let d = 0; d <= 3; d++) {
    const dt = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
    const msgFile  = path.join(dataDir, `mensagens_${dt}.json`);
    const diagFile = path.join(dataDir, `diagnosticos_${dt}.json`);
    if (!fs.existsSync(msgFile)) continue;
    const msgs = readJson<Mensagem[]>(msgFile) || [];
    if (msgs.some((m) => m.status === 'aprovacao_pendente')) pairs.push({ msgFile, diagFile });
  }
  return pairs;
}

function getDiagnosticosFromFile(diagFile: string): Diagnostico[] {
  return readJson<Diagnostico[]>(diagFile) || [];
}

async function sendEmail(msg: Mensagem): Promise<void> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) throw new Error('GMAIL_USER / GMAIL_APP_PASSWORD não configurados');

  const to = process.env.LEAD_EMAIL_OVERRIDE || user;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: user,
    to,
    subject: msg.assunto || `Olá, ${msg.nome_negocio}`,
    text: msg.corpo,
  });
}

function canAutoSend(msg: Mensagem, telefone: string): { ok: boolean; motivo?: string } {
  if (msg.canal === 'whatsapp' && telefone.replace(/\D/g, '').length < 10) {
    return { ok: false, motivo: 'telefone ausente ou inválido' };
  }
  if (msg.canal === 'instagram' || msg.canal === 'linkedin' || msg.canal === 'email') {
    return { ok: false, motivo: `canal ${msg.canal} requer envio manual` };
  }
  return { ok: true };
}

// ── Main ───────────────────────────────────────────────────────────────────

export async function runAgent8(): Promise<void> {
  log.info('Agente 8 — Auto-Envio iniciado');

  // Constrói histórico retroativo se for a primeira execução
  await construirHistoricoRetroativo();

  const dow = new Date().getDay(); // 0=Dom, 6=Sáb
  if (dow === 0 || dow === 6) {
    log.info('  Fim de semana — envios pausados. Mensagens preparadas serão enviadas na segunda-feira.');
    return;
  }

  const hora = new Date().getHours();
  // Janela externa de segurança: 8h–18h (algumas janelas de segmento começam às 8h)
  if (hora < 8 || hora >= 18) {
    log.info(`  Fora do horário permitido (${hora}h) — envios permitidos entre 8h e 18h.`);
    return;
  }

  const cfgRaw = fs.readFileSync(path.join(process.cwd(), 'config.json'), 'utf-8');
  const cfg = JSON.parse(cfgRaw);
  const MAX_ENVIOS_DIA: number = cfg.max_envios_por_dia ?? 30;

  const filePairs = getRecentFilePairs();
  if (filePairs.length === 0) {
    log.info('Nenhuma mensagem pendente para envio automático');
    return;
  }

  let totalEnviados = 0, totalManuais = 0, totalFalhas = 0, totalPostergados = 0;
  let enviosGlobais = 0;

  for (const { msgFile, diagFile } of filePairs) {
    const msgs = readJson<Mensagem[]>(msgFile) || [];
    const pendentes = msgs.filter((m) => m.status === 'aprovacao_pendente');
    if (pendentes.length === 0) continue;

    log.info(`  ${pendentes.length} mensagem(ns) pendente(s) em ${path.basename(msgFile)}`);
    const diags = getDiagnosticosFromFile(diagFile);
    let enviados = 0, manuais = 0, falhas = 0, postergados = 0;

    for (const msg of pendentes) {
      const idx     = msgs.findIndex((m) => m.id === msg.id);
      const diag    = diags.find((d) => d.slug === msg.slug);
      const telefone = diag?.telefone || '';

      // ── 1. Blacklist (opt-out / LGPD) ────────────────────────────────
      if (telefone && isNaBlacklist(telefone)) {
        log.info(`  🚫 ${msg.nome_negocio} — número na blacklist, pulando`);
        msgs[idx].status = 'enviado';
        continue;
      }

      // ── 2. Deduplicação por slug ──────────────────────────────────────
      if (jaFoiAcionado(msg.slug)) {
        log.info(`  ⏭ ${msg.nome_negocio} — já acionado (slug), pulando`);
        msgs[idx].status = 'enviado';
        continue;
      }

      // ── 3. Deduplicação por telefone ──────────────────────────────────
      if (telefone && jaFoiAcionadoPorTelefone(telefone)) {
        log.info(`  ⏭ ${msg.nome_negocio} — mesmo telefone já acionado anteriormente, pulando`);
        msgs[idx].status = 'enviado';
        continue;
      }

      // ── 4. Janela de segmento: respeita o horário de cada negócio ────
      const janelas = getJanelasParaSegmento(diag);
      if (!estaEmJanela(janelas, hora)) {
        const janStr = descreveJanelas(janelas);
        const seg = diag?.segmento?.micro?.[0] || diag?.segmento?.nivel2 || diag?.categoria || 'geral';
        log.info(`  ⏰ ${msg.nome_negocio} [${seg}] — melhor janela ${janStr} (agora ${hora}h), postergando`);
        postergados++;
        continue;
      }

      // ── 5. Validação de canal/telefone ────────────────────────────────
      const check = canAutoSend(msg, telefone);
      if (!check.ok) {
        log.warn(`  ⚠ ${msg.nome_negocio} — ${check.motivo} (requer envio manual)`);
        manuais++;
        await notifyOwner(
          `⚠️ ${msg.nome_negocio} precisa de envio manual\nMotivo: ${check.motivo}\nCanal: ${msg.canal.toUpperCase()}`,
          'Envio manual necessário'
        );
        continue;
      }

      try {
        if (msg.canal === 'whatsapp') {
          // ── 6. Health check da landing page ───────────────────────────
          const lpUrl = diag?.landing_page_url;
          if (lpUrl && !lpUrl.includes('localhost')) {
            const lpOk = await checkLPHealth(lpUrl);
            if (!lpOk) {
              log.warn(`  🔴 ${msg.nome_negocio} — LP offline (${lpUrl}), postergando`);
              postergados++;
              await notifyOwner(
                `🔴 LP offline para ${msg.nome_negocio}\nURL: ${lpUrl}\n\nEnvio postergado até a página estar acessível.`,
                '⚠️ Landing page offline'
              );
              continue;
            }
          }

          // ── PROBE: mensagem curta para detectar bot ───────────────────
          const probeMsg = `Oi! Você cuida da parte comercial${diag?.nome ? ` do ${diag.nome}` : ''}?`;
          const probeResult = await sendWhatsAppViaApi(telefone, probeMsg);

          if (probeResult.numero_invalido) {
            msgs[idx].status = 'numero_invalido';
            log.warn(`  ⚠ ${msg.nome_negocio} — número não registrado no WhatsApp (${telefone})`);
            falhas++;
            continue;
          }
          if (!probeResult.ok) throw new Error('API WhatsApp retornou falha no probe');

          // Salva apresentação na fila — agent7 envia após 30min se não for bot
          const probeQueue = readJson<ProbeQueueEntry[]>(PROBE_QUEUE_FILE) || [];
          probeQueue.push({
            id: generateId(),
            telefone,
            nome_negocio: msg.nome_negocio,
            probe_enviado_em: new Date().toISOString(),
            corpo_completo: msg.corpo,
            canal: msg.canal,
            msg_id: msg.id,
            msg_file: msgFile,
            diag_snapshot: diag!,
            msg_snapshot: { ...msg },
            video_path: msg.video_path || null,
          });
          writeJson(PROBE_QUEUE_FILE, probeQueue);

          msgs[idx].status   = 'probe_enviado';
          msgs[idx].data_envio = new Date().toISOString();
          enviados++;

          // ── Registra no histórico rico ────────────────────────────────
          registrarContato({ ...msg, status: 'probe_enviado', data_envio: msgs[idx].data_envio }, diag);

          log.info(`  ✓ ${msg.nome_negocio} → probe enviado (apresentação em 30min se humano)`);
          await notifyOwner(
            `🔍 ${msg.nome_negocio}\nNúmero: ${telefone}\nSegmento: ${diag?.segmento?.micro?.[0] || diag?.categoria || '—'}\n\nProbe enviado! A apresentação completa chega em ~30min, se não for bot.`,
            '🔍 Probe enviado'
          );
          enviosGlobais++;
          if (enviosGlobais >= MAX_ENVIOS_DIA) {
            writeJson(msgFile, msgs);
            totalEnviados += enviados; totalManuais += manuais;
            totalFalhas += falhas; totalPostergados += postergados;
            log.info(`  Limite diário de ${MAX_ENVIOS_DIA} envios atingido — encerrando.`);
            log.success(`Agente 8 concluído (limite): ${totalEnviados} enviadas | ${totalPostergados} postergadas | ${totalManuais} manuais | ${totalFalhas} falhas`);
            return;
          }
          await randomDelay();
          continue;

        } else if (msg.canal === 'email') {
          await sendEmail(msg);
          registrarContato({ ...msg, status: 'enviado', data_envio: new Date().toISOString() }, diag);
        }

        msgs[idx].status   = 'enviado';
        msgs[idx].data_envio = new Date().toISOString();
        enviados++;

        log.info(`  ✓ ${msg.nome_negocio} → ${msg.canal}`);

        await notifyOwner(
          `📤 ${msg.nome_negocio}\nCanal: ${msg.canal.toUpperCase()}\n\nAmanhã às 10h: proposta com link enviada automaticamente.`,
          '✅ Mensagem enviada'
        );

        if (diag) {
          registrarNaCadencia(diag, msgs[idx]).catch((err: Error) =>
            log.warn(`Cadência falhou para ${msg.nome_negocio}: ${err.message}`)
          );
        }
      } catch (err) {
        log.error(`  ✗ ${msg.nome_negocio}: ${(err as Error).message}`);
        msgs[idx].status = 'falha_envio';
        falhas++;
        await notifyOwner(
          `❌ Falha ao enviar para ${msg.nome_negocio}\nErro: ${(err as Error).message}\nCanal: ${msg.canal.toUpperCase()}`,
          'Erro no envio automático'
        );
      }
    }

    writeJson(msgFile, msgs);
    totalEnviados    += enviados;
    totalManuais     += manuais;
    totalFalhas      += falhas;
    totalPostergados += postergados;
  }

  const total = totalEnviados + totalManuais + totalFalhas;
  log.success(
    `Agente 8 concluído: ${totalEnviados}/${total} enviadas | ${totalPostergados} postergadas por janela | ${totalManuais} manuais | ${totalFalhas} falhas`
  );

  if (totalEnviados > 0) {
    await notifyOwner(
      `🎯 ${totalEnviados} probe(s) enviado(s) hoje!\n${totalPostergados > 0 ? `⏰ ${totalPostergados} postergado(s) para janela correta.\n` : ''}${totalManuais > 0 ? `⚠️ ${totalManuais} precisam de envio manual.\n` : ''}A apresentação completa chega em ~30min para cada lead validado como humano.`,
      '📊 Ciclo diário concluído'
    );
  }
}

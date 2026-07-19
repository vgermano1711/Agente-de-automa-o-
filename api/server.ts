/**
 * API Server — endpoints de aprovação e status
 * Serve o painel HTML, as landing pages locais e os endpoints REST.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import { Mensagem, RespostaLead, CadenciaLead, RascunhoWhatsApp, Projeto } from '../types';
import { log } from '../utils/logger';
import { notifyOwner } from '../utils/notifications';
import {
  sendWhatsApp,
  checkWwjsHealth,
  initWhatsappWeb,
  reinitWhatsappWeb,
  whatsappConfigured,
  getLatestQr,
  isWwjsConnected,
  requestPairingCode,
  setMessageHandler,
} from '../utils/whatsapp';
import { whatsappManager } from '../utils/whatsappManager';
import { handleIncomingWhatsApp } from '../agents/agent9_whatsapp_reply';
import { createTenantMessageHandler } from '../agents/agent10_tenant_reply';

const app = express();
app.use(cors());
app.use(express.json());

// Bypass automático do aviso de browser do ngrok e localtunnel
// Permite acesso mobile direto sem interstitial de aviso
app.use((_req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true');
  res.setHeader('bypass-tunnel-reminder', 'true');
  next();
});

const PORT = parseInt(process.env.PORT || '3000', 10);

// Servir landing pages locais
app.use('/pages', express.static(path.join(process.cwd(), 'pages')));
// Servir vídeos
app.use('/videos', express.static(path.join(process.cwd(), 'videos')));
// Servir painel de aprovação
app.use(express.static(path.join(process.cwd())));

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function getMsgFile(): string {
  const todayFile = path.join(process.cwd(), 'data', `mensagens_${today()}.json`);
  if (fs.existsSync(todayFile)) return todayFile;
  // Check yesterday (Brazil is UTC-3; file may still be from previous UTC day)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const yFile = path.join(process.cwd(), 'data', `mensagens_${yesterday}.json`);
  if (fs.existsSync(yFile)) return yFile;
  return todayFile;
}

function readMessages(): Mensagem[] {
  const file = getMsgFile();
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8'));
  // Fallback: most recent mensagens file (handles UTC midnight crossing before BR midnight)
  const dataDir = path.join(process.cwd(), 'data');
  const files = fs.readdirSync(dataDir)
    .filter(f => f.startsWith('mensagens_') && f.endsWith('.json'))
    .sort().reverse();
  if (files.length === 0) return [];
  return JSON.parse(fs.readFileSync(path.join(dataDir, files[0]), 'utf-8'));
}

function writeMessages(msgs: Mensagem[]): void {
  fs.writeFileSync(getMsgFile(), JSON.stringify(msgs, null, 2));
}

// GET /api/mensagens — lista todas pendentes de aprovação (com telefone do diagnóstico)
app.get('/api/mensagens', (_req, res) => {
  const msgs = readMessages().filter((m) => m.status === 'aprovacao_pendente');
  const todayStr = new Date().toISOString().slice(0, 10);
  const diagFile = path.join(process.cwd(), 'data', `diagnosticos_${todayStr}.json`);
  const diags: { slug: string; telefone: string }[] = fs.existsSync(diagFile)
    ? JSON.parse(fs.readFileSync(diagFile, 'utf-8'))
    : [];

  const result = msgs.map((m) => {
    const diag          = diags.find((d) => d.slug === m.slug);
    const lpLocalPath   = path.join(process.cwd(), 'pages', m.slug, 'index.html');
    const videoLocalPath = path.join(process.cwd(), 'videos', `${m.slug}.mp4`);
    return {
      ...m,
      _telefone: diag?.telefone || '',
      lp_local_exists: fs.existsSync(lpLocalPath),
      video_local_exists: fs.existsSync(videoLocalPath),
    };
  });
  res.json(result);
});

// GET /api/whatsapp-status — estado da conexão WhatsApp
app.get('/api/whatsapp-status', (_req, res) => {
  res.json({ connected: whatsappConfigured() });
});

// GET /api/whatsapp-qr — retorna estado e QR string para vinculação
app.get('/api/whatsapp-qr', (_req, res) => {
  const provider = process.env.WHATSAPP_PROVIDER || 'zapi';

  if (provider !== 'wwebjs') {
    return res.json({
      status: 'zapi',
      message: 'WhatsApp gerenciado via Z-API — QR não necessário',
      qr_string: null,
    });
  }

  if (whatsappConfigured() || isWwjsConnected()) {
    return res.json({ status: 'connected', qr_string: null });
  }

  const qr = getLatestQr();
  if (qr) {
    return res.json({ status: 'qr_ready', qr_string: qr });
  }

  return res.json({ status: 'waiting', qr_string: null });
});

// POST /api/whatsapp-pair — solicita código de 8 dígitos para vincular por número
app.post('/api/whatsapp-pair', async (req, res) => {
  const { phone } = req.body as { phone?: string };
  if (!phone || phone.replace(/\D/g, '').length < 10) {
    return res.status(400).json({ error: 'Informe um número de WhatsApp válido (com DDD)' });
  }
  try {
    const code = await requestPairingCode(phone);
    res.json({ success: true, code });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * Confere o token opaco (?t=) contra Projeto.ativacao_token, quando presente.
 * Projetos antigos sem token (criados antes desta proteção) continuam acessíveis
 * só pelo slug — gap aceito e documentado, não um requisito de segurança forte.
 */
function tokenValido(projeto: Projeto, req: express.Request): boolean {
  if (!projeto.ativacao_token) return true;
  return req.query.t === projeto.ativacao_token;
}

// GET /api/ativacao/:slug/status — dados básicos do Projeto para o painel de ativação do cliente
app.get('/api/ativacao/:slug/status', (req, res) => {
  const projeto = readProjetos().find((p) => p.slug === req.params.slug);
  if (!projeto || projeto.tipo_produto !== 'automacao') {
    return res.status(404).json({ status: 'not_found', message: 'Projeto não encontrado' });
  }
  if (!tokenValido(projeto, req)) {
    return res.status(403).json({ status: 'forbidden', message: 'Link inválido' });
  }
  res.json({
    nome_negocio: projeto.nome_negocio,
    status: projeto.status,
    tipo_produto: projeto.tipo_produto,
    connected: whatsappManager.getTenant(projeto.slug)?.isConnected() || false,
  });
});

// GET /api/ativacao/:slug/qr — QR (ou status de conexão) da conexão WhatsApp isolada do cliente
app.get('/api/ativacao/:slug/qr', async (req, res) => {
  const slug = req.params.slug;
  const projeto = readProjetos().find((p) => p.slug === slug);
  if (!projeto || projeto.tipo_produto !== 'automacao') {
    return res.status(404).json({ status: 'not_found', message: 'Projeto não encontrado' });
  }
  if (!tokenValido(projeto, req)) {
    return res.status(403).json({ status: 'forbidden', message: 'Link inválido' });
  }
  if (!['em_producao', 'ativo'].includes(projeto.status)) {
    return res.status(409).json({ status: 'wrong_stage', message: 'Projeto ainda não está pronto para ativação' });
  }

  let conn = whatsappManager.getTenant(slug);
  if (!conn) {
    try {
      conn = await whatsappManager.createTenantConnection(slug, {
        onReady: () => activateProjeto(slug),
        onDisconnected: () => {},
      });
    } catch (err) {
      if ((err as Error).message === 'CAPACITY_FULL') {
        return res.json({
          status: 'capacity_full',
          message: `Limite de ${MAX_TENANT_WHATSAPP} bots simultâneos atingido — fale com o suporte.`,
        });
      }
      return res.status(500).json({ status: 'failed', message: (err as Error).message });
    }
  }

  if (conn.isConnected()) return res.json({ status: 'connected', qr_string: null });

  const qr = conn.getLatestQr();
  if (qr) return res.json({ status: 'qr_ready', qr_string: qr });

  return res.json({ status: 'waiting', qr_string: null });
});

// GET /ativacao/:slug — painel público onde o cliente escaneia o próprio QR
app.get('/ativacao/:slug', (_req, res) => {
  res.sendFile(path.join(process.cwd(), 'ativacao.html'));
});

// GET /api/status — status geral do sistema
app.get('/api/status', (_req, res) => {
  const stateFile = path.join(process.cwd(), 'pipeline_state.json');
  const state = fs.existsSync(stateFile)
    ? JSON.parse(fs.readFileSync(stateFile, 'utf-8'))
    : null;

  const msgs = readMessages();
  res.json({
    state,
    mensagens_pendentes: msgs.filter((m) => m.status === 'aprovacao_pendente').length,
    mensagens_enviadas: msgs.filter((m) => m.status === 'enviado').length,
    server_time: new Date().toISOString(),
  });
});

// GET /api/respostas — respostas de leads pendentes de aprovação
app.get('/api/respostas', (_req, res) => {
  const file = path.join(process.cwd(), 'data', 'respostas.json');
  if (!fs.existsSync(file)) return res.json([]);
  const respostas: RespostaLead[] = JSON.parse(fs.readFileSync(file, 'utf-8'));
  res.json(respostas.filter((r) => r.status === 'pendente_aprovacao'));
});

// Singleton SMTP — evita abrir nova conexão por envio
let _emailTransporter: nodemailer.Transporter | null = null;
function getEmailTransporter(): nodemailer.Transporter | null {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  if (!_emailTransporter) {
    _emailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
      pool: true,
      maxConnections: 1,
    });
  }
  return _emailTransporter;
}

async function sendEmail(msg: Mensagem): Promise<void> {
  const transporter = getEmailTransporter();
  const toEmail = process.env.LEAD_EMAIL_OVERRIDE || 'lead@example.com';

  if (!transporter) {
    log.warn('Gmail não configurado — simulando envio de email');
    return;
  }

  const mailOptions: nodemailer.SendMailOptions = {
    from: process.env.GMAIL_USER,
    to: toEmail,
    subject: msg.assunto || `Proposta para ${msg.nome_negocio}`,
    text: msg.corpo,
  };

  if (msg.video_path && fs.existsSync(msg.video_path)) {
    mailOptions.attachments = [{ filename: `preview_${msg.slug}.mp4`, path: msg.video_path }];
  } else if (msg.video_path) {
    log.warn(`Video não encontrado para anexo (${msg.slug}): ${msg.video_path} — enviando sem anexo`);
  }

  await transporter.sendMail(mailOptions);
}

async function sendGmailReply(resposta: RespostaLead): Promise<void> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    log.warn('Gmail OAuth não configurado — simulando envio de resposta');
    return;
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });
  const gmail = google.gmail({ version: 'v1', auth: oauth2 });

  const rawMessage = [
    `To: ${resposta.email_from}`,
    `Subject: Re: ${resposta.assunto_original}`,
    `In-Reply-To: ${resposta.gmail_message_id}`,
    `References: ${resposta.gmail_message_id}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    resposta.draft_reply,
  ].join('\r\n');

  const encoded = Buffer.from(rawMessage).toString('base64url');

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encoded,
      threadId: resposta.gmail_thread_id,
    },
  });
}

// GET /api/mensagens/enviadas — histórico de mensagens enviadas
app.get('/api/mensagens/enviadas', (_req, res) => {
  const msgs = readMessages();
  res.json(msgs.filter((m) => m.status === 'enviado'));
});

// POST /api/aprovar/:id — aprova e envia mensagem
app.post('/api/aprovar/:id', async (req, res) => {
  const msgs = readMessages();
  const idx = msgs.findIndex((m) => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Mensagem não encontrada' });

  const msg = msgs[idx];
  if (msg.status !== 'aprovacao_pendente') {
    return res.status(400).json({ error: 'Mensagem não está pendente de aprovação' });
  }

  // Pegar o telefone: 1) do body (usuário digitou), 2) do diagnóstico
  const today = new Date().toISOString().slice(0, 10);
  let telefone: string = (req.body as { telefone?: string }).telefone?.trim() || '';

  if (!telefone) {
    const diagFile = path.join(process.cwd(), 'data', `diagnosticos_${today}.json`);
    if (fs.existsSync(diagFile)) {
      const diags = JSON.parse(fs.readFileSync(diagFile, 'utf-8'));
      const diag = diags.find((d: { slug: string; telefone: string }) => d.slug === msg.slug);
      if (diag) telefone = diag.telefone;
    }
  }

  // Bloquear envio WhatsApp sem telefone
  if (msg.canal === 'whatsapp' && (!telefone || telefone.replace(/\D/g, '').length < 10)) {
    return res.status(400).json({ error: 'telefone_ausente', message: 'Informe o número de WhatsApp para enviar' });
  }

  try {
    if (msg.canal === 'whatsapp') {
      await sendWhatsApp(telefone, msg.corpo);
    } else if (msg.canal === 'email') {
      await sendEmail(msg);
    } else {
      log.info(`Canal ${msg.canal} — registrando aprovação (envio manual necessário)`);
    }

    msgs[idx].status = 'enviado';
    msgs[idx].data_envio = new Date().toISOString();
    writeMessages(msgs);

    // Registrar na cadência de follow-up
    try {
      const { registrarNaCadencia } = await import('../agents/cadencia');
      let diagFile = path.join(process.cwd(), 'data', `diagnosticos_${today}.json`);
      if (!fs.existsSync(diagFile)) {
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        const yDiag = path.join(process.cwd(), 'data', `diagnosticos_${yesterday}.json`);
        if (fs.existsSync(yDiag)) diagFile = yDiag;
      }
      if (fs.existsSync(diagFile)) {
        const diags = JSON.parse(fs.readFileSync(diagFile, 'utf-8'));
        const diag = diags.find((d: { slug: string }) => d.slug === msg.slug);
        if (diag) registrarNaCadencia(diag, msgs[idx]).catch(() => {});
      }
    } catch { /* não bloqueia envio se cadência falhar */ }

    await notifyOwner(
      `✅ WhatsApp enviado para ${msg.nome_negocio} (${telefone || 'número não encontrado'})`,
      'Mensagem enviada'
    );

    log.success(`Mensagem ${msg.id} aprovada e enviada — ${msg.nome_negocio}`);
    res.json({ success: true, message: 'Aprovado e enviado', id: msg.id });
  } catch (err) {
    log.error(`Envio falhou: ${(err as Error).message}`);
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── Rascunhos WhatsApp (Agent 9) ──────────────────────────────────────────
const RASCUNHOS_WA_FILE = path.join(process.cwd(), 'data', 'rascunhos_whatsapp.json');

function readRascunhos(): RascunhoWhatsApp[] {
  if (!fs.existsSync(RASCUNHOS_WA_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(RASCUNHOS_WA_FILE, 'utf-8')); } catch { return []; }
}
function writeRascunhos(lista: RascunhoWhatsApp[]): void {
  fs.writeFileSync(RASCUNHOS_WA_FILE, JSON.stringify(lista, null, 2));
}

// GET /api/rascunhos-whatsapp — lista rascunhos pendentes
app.get('/api/rascunhos-whatsapp', (_req, res) => {
  res.json(readRascunhos().filter((r) => r.status === 'pendente'));
});

// POST /api/rascunhos-whatsapp/:id/enviar — envia rascunho (com texto editável)
app.post('/api/rascunhos-whatsapp/:id/enviar', async (req, res) => {
  const lista = readRascunhos();
  const idx = lista.findIndex((r) => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Rascunho não encontrado' });

  const texto: string = (req.body as { texto?: string }).texto || lista[idx].rascunho_resposta;

  try {
    await sendWhatsApp(lista[idx].lead_phone, texto);
    lista[idx].status = 'enviado';
    writeRascunhos(lista);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/rascunhos-whatsapp/:id/ignorar — descarta rascunho
app.post('/api/rascunhos-whatsapp/:id/ignorar', (req, res) => {
  const lista = readRascunhos();
  const idx = lista.findIndex((r) => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Rascunho não encontrado' });
  lista[idx].status = 'ignorado';
  writeRascunhos(lista);
  res.json({ success: true });
});

// POST /api/notify-owner — envia WhatsApp para o dono (chamado pelo orquestrador)
app.post('/api/notify-owner', async (req, res) => {
  const { message, title } = req.body as { message?: string; title?: string };
  const ownerNumber = process.env.OWNER_WHATSAPP;
  if (!ownerNumber) return res.json({ sent: false, reason: 'OWNER_WHATSAPP não configurado' });
  if (!message) return res.status(400).json({ error: 'message obrigatório' });

  try {
    const texto = title ? `[${title}]\n${message}` : message;
    await sendWhatsApp(ownerNumber, texto);
    res.json({ sent: true });
  } catch (err) {
    log.warn(`notify-owner falhou: ${(err as Error).message}`);
    res.status(500).json({ sent: false, error: (err as Error).message });
  }
});

// POST /api/editar/:id — edita mensagem
app.post('/api/editar/:id', (req, res) => {
  const msgs = readMessages();
  const idx = msgs.findIndex((m) => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Mensagem não encontrada' });

  const { assunto, corpo } = req.body as { assunto?: string; corpo?: string };
  if (assunto !== undefined) msgs[idx].assunto = assunto;
  if (corpo !== undefined) msgs[idx].corpo = corpo;
  writeMessages(msgs);

  res.json({ success: true });
});

// POST /api/rejeitar/:id — rejeita mensagem
app.post('/api/rejeitar/:id', (req, res) => {
  const msgs = readMessages();
  const idx = msgs.findIndex((m) => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Mensagem não encontrada' });

  msgs[idx].status = 'rejeitado';
  writeMessages(msgs);

  log.info(`Mensagem ${req.params.id} rejeitada`);
  res.json({ success: true });
});

// POST /api/respostas/aprovar/:id — aprova e envia reply ao lead
app.post('/api/respostas/aprovar/:id', async (req, res) => {
  const file = path.join(process.cwd(), 'data', 'respostas.json');
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Nenhuma resposta encontrada' });

  const respostas: RespostaLead[] = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const idx = respostas.findIndex((r) => r.mensagem_id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Resposta não encontrada' });

  try {
    await sendGmailReply(respostas[idx]);
    respostas[idx].status = 'enviado';
    fs.writeFileSync(file, JSON.stringify(respostas, null, 2));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/pesquisar?q=barbearia+curitiba — busca negócios via Google Places
app.get('/api/pesquisar', async (req, res) => {
  const query = String(req.query.q || '').trim();
  if (!query) return res.status(400).json({ error: 'Parâmetro q é obrigatório' });

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey || apiKey === 'nao_configurado' || apiKey === 'sua_chave_aqui') {
    // Mock para quando não há API key
    const mockResults = [
      { place_id: 'mock1', nome: query.split(' ')[0] + ' Premium', endereco: 'Rua das Flores, 123 — São Paulo, SP', telefone: '(11) 99999-0001', avaliacao: 4.8, total_avaliacoes: 312, website: null, categoria: query, cidade: 'São Paulo, SP', status_site: 'sem_site' },
      { place_id: 'mock2', nome: query.split(' ')[0] + ' Centro', endereco: 'Av. Paulista, 456 — São Paulo, SP', telefone: '(11) 99999-0002', avaliacao: 4.5, total_avaliacoes: 187, website: 'http://site-antigo.com.br', categoria: query, cidade: 'São Paulo, SP', status_site: 'site_antigo' },
      { place_id: 'mock3', nome: query.split(' ')[0] + ' Express', endereco: 'Rua Augusta, 789 — São Paulo, SP', telefone: '(11) 99999-0003', avaliacao: 4.3, total_avaliacoes: 94, website: null, categoria: query, cidade: 'São Paulo, SP', status_site: 'sem_site' },
    ];
    return res.json({ resultados: mockResults, mock: true });
  }

  try {
    const axios = (await import('axios')).default;
    const searchResp = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', {
      params: { query, key: apiKey, language: 'pt-BR' },
    });

    const places = searchResp.data?.results || [];
    const resultados = [];

    for (const place of places.slice(0, 8)) {
      let telefone = '';
      let website: string | null = null;

      try {
        const detailResp = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
          params: { place_id: place.place_id, fields: 'formatted_phone_number,website', key: apiKey, language: 'pt-BR' },
        });
        const d = detailResp.data?.result || {};
        telefone = d.formatted_phone_number || '';
        website = d.website || null;
      } catch { /* ignora erros de detalhe */ }

      let status_site = 'sem_site';
      if (website) {
        try {
          const siteResp = await axios.get(website, { timeout: 5000, headers: { 'User-Agent': 'Mozilla/5.0' } });
          const temViewport = siteResp.data?.includes('width=device-width');
          status_site = temViewport ? 'site_ok' : 'site_antigo';
        } catch { status_site = 'sem_site'; }
      }

      resultados.push({
        place_id: place.place_id,
        nome: place.name,
        endereco: place.formatted_address,
        telefone,
        avaliacao: place.rating || 0,
        total_avaliacoes: place.user_ratings_total || 0,
        website,
        categoria: query,
        cidade: place.formatted_address?.split(',').slice(-2).join(',').trim() || '',
        status_site,
      });
    }

    res.json({ resultados, mock: false });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/prospectar — roda pipeline completo para um lead específico
app.post('/api/prospectar', async (req, res) => {
  const lead = req.body;
  if (!lead?.nome) return res.status(400).json({ error: 'Dados do lead são obrigatórios' });

  res.json({ success: true, message: 'Pipeline iniciado para ' + lead.nome });

  // Roda em background
  (async () => {
    try {
      const { runAgent2 } = await import('../agents/agent2_diagnostico');
      const { runAgent3 } = await import('../agents/agent3_builder');
      const { runAgent5 } = await import('../agents/agent5_canal');
      const { runAgent6 } = await import('../agents/agent6_revisor');

      const { dataPath, writeJson, generateId, slugify } = await import('../utils/dataHelpers');
      const todayStr = new Date().toISOString().slice(0, 10);

      const leadCompleto = {
        id: generateId(),
        nome: lead.nome,
        endereco: lead.endereco || '',
        telefone: lead.telefone || '',
        categoria: lead.categoria || '',
        website: lead.website || null,
        cidade: lead.cidade || '',
        avaliacao: lead.avaliacao || 0,
        total_avaliacoes: lead.total_avaliacoes || 0,
        google_place_id: lead.place_id || generateId(),
        score_oportunidade: 80,
        data_prospeccao: todayStr,
      };

      // Salva o lead no arquivo do dia (mantendo os existentes)
      const leadsFile = dataPath('leads_{data}.json');
      const leadsExistentes = fs.existsSync(leadsFile) ? JSON.parse(fs.readFileSync(leadsFile, 'utf-8')) : [];
      const leadsAtualizado = [...leadsExistentes.filter((l: { google_place_id: string }) => l.google_place_id !== leadCompleto.google_place_id), leadCompleto];
      writeJson(leadsFile, leadsAtualizado);

      await runAgent2();
      await runAgent3();
      await runAgent5();
      await runAgent6();

      log.success(`Pipeline concluído para lead pesquisado: ${lead.nome}`);
    } catch (err) {
      log.error(`Pipeline falhou para ${lead.nome}: ${(err as Error).message}`);
    }
  })();
});

// ─── CADÊNCIA ENDPOINTS ───────────────────────────────────────────────────────

const CADENCIA_FILE = path.join(process.cwd(), 'data', 'cadencia.json');

function readCadencias(): CadenciaLead[] {
  if (!fs.existsSync(CADENCIA_FILE)) return [];
  return JSON.parse(fs.readFileSync(CADENCIA_FILE, 'utf-8'));
}

// GET /api/cadencia — lista todos os leads na cadência
app.get('/api/cadencia', (_req, res) => {
  res.json(readCadencias());
});

// GET /api/cadencia/relatorio — relatório semanal da cadência
app.get('/api/cadencia/relatorio', (_req, res) => {
  try {
    const { gerarRelatorio } = require('../agents/cadencia');
    res.json(gerarRelatorio());
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/cadencia/:slug/resposta — marca lead como respondeu ou recusou
app.post('/api/cadencia/:slug/resposta', (req, res) => {
  const { tipo } = req.body as { tipo?: 'respondeu' | 'recusou' };
  if (tipo !== 'respondeu' && tipo !== 'recusou') {
    return res.status(400).json({ error: 'tipo deve ser respondeu ou recusou' });
  }
  try {
    const { marcarResposta } = require('../agents/cadencia');
    marcarResposta(req.params.slug, tipo);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/cadencia/processar — processa follow-ups do dia (chamado pelo cron)
app.post('/api/cadencia/processar', async (_req, res) => {
  try {
    const { processarCadencias } = await import('../agents/cadencia');
    await processarCadencias();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/followups/processar — processa fila de follow-ups agendados para hoje
app.post('/api/followups/processar', async (_req, res) => {
  try {
    const { processarFollowups } = await import('../agents/agent_followup');
    await processarFollowups();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/pipeline/executar — dispara ciclo completo sob demanda (agentes 1-8)
// Body opcional: { "desde": 3 } para pular agentes já concluídos
app.post('/api/pipeline/executar', async (req, res) => {
  const desde: number = (req.body as { desde?: number }).desde ?? 1;
  const { clearState } = await import('../utils/state');
  clearState();
  res.json({ success: true, message: `Pipeline iniciado em background (desde agente ${desde})` });

  (async () => {
    try {
      if (desde <= 1) { const { runAgent1 } = await import('../agents/agent1_prospector'); await runAgent1(); }
      if (desde <= 2) { const { runAgent2 } = await import('../agents/agent2_diagnostico'); await runAgent2(); }
      if (desde <= 3) { const { runAgent3 } = await import('../agents/agent3_builder'); await runAgent3(); }
      if (desde <= 4) { const { runAgent4 } = await import('../agents/agent4_video'); await runAgent4(); }
      if (desde <= 5) { const { runAgent5 } = await import('../agents/agent5_canal'); await runAgent5(); }
      if (desde <= 6) { const { runAgent6 } = await import('../agents/agent6_revisor'); await runAgent6(); }
      if (desde <= 8) { const { runAgent8 } = await import('../agents/agent8_autosend'); await runAgent8(); }

      log.success('Pipeline sob demanda concluído');
      await notifyOwner('✅ Pipeline sob demanda concluído — novos leads acionados!', '🚀 Pipeline Manual');
    } catch (err) {
      log.error(`Pipeline sob demanda falhou: ${(err as Error).message}`);
    }
  })();
});

// ─────────────────────────────────────────────────────────────────────────────
// WEBHOOK Z-API — recebe mensagens dos leads e aciona Agent 9 automaticamente
// Configure a URL do webhook no painel Z-API: {NGROK_URL}/webhook/zapi
// ─────────────────────────────────────────────────────────────────────────────

app.post('/webhook/zapi', async (req, res) => {
  // Responde 200 imediatamente — Z-API reenvia se não receber resposta rápida
  res.sendStatus(200);

  const p = req.body as Record<string, any>;

  // Ignora mensagens enviadas por mim, grupos, e callbacks de status de envio
  if (p.fromMe || p.isGroup) return;
  if (p.momType === 'DeliveryCallback' || p.momType === 'ReadCallback' || p.momType === 'ackMessage') return;

  const rawPhone = (p.phone || p.senderPhone || '').replace(/\D/g, '');
  if (!rawPhone || rawPhone.length < 10) return;

  // Extrai corpo da mensagem — Z-API usa formatos diferentes por tipo
  const isMedia = ['imageMessage','audioMessage','videoMessage','documentMessage','stickerMessage'].includes(p.momType || '');
  let body = '';
  if (isMedia) {
    body = p.image?.caption || p.video?.caption || p.document?.caption || p.audio?.caption || '[arquivo]';
  } else {
    body = p.text?.message || p.body || p.message || '';
  }

  if (!body && !isMedia) return;

  log.info(`Webhook Z-API: mensagem de ${rawPhone} — "${(body || '').slice(0, 60)}"`);

  // Formata como @c.us para compatibilidade com Agent 9
  const from = rawPhone + '@c.us';
  const contactPhone = rawPhone.replace(/^55/, '');

  try {
    await handleIncomingWhatsApp(from, body, contactPhone, false, isMedia);
  } catch (err) {
    log.error(`Webhook Z-API: Agent 9 falhou — ${(err as Error).message}`);
  }
});

// POST /webhook/zapi/status — callbacks de status (entregue, lido, etc.) — apenas loga
app.post('/webhook/zapi/status', (req, res) => {
  res.sendStatus(200);
  const p = req.body as Record<string, any>;
  log.info(`Z-API status: ${p.status || p.momType || 'desconhecido'} — ${p.phone || ''}`);
});

// ─────────────────────────────────────────────────────────────────────────────

// POST /api/whatsapp/send — envia WhatsApp via sessão gerenciada pela API
// POST /api/whatsapp/send-media — envia mídia (vídeo/imagem) via wwebjs
app.post('/api/whatsapp/send-media', async (req, res) => {
  const { phone, filePath, caption } = req.body as { phone?: string; filePath?: string; caption?: string };
  if (!phone || !filePath) return res.status(400).json({ error: 'phone e filePath obrigatórios' });
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'arquivo não encontrado' });
  try {
    const { sendMediaWhatsApp } = await import('../utils/whatsapp');
    const ok = await sendMediaWhatsApp(phone, filePath, caption || '');
    res.json({ success: ok });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Usado pelo orchestrator/cadência que rodam em processo separado
app.post('/api/whatsapp/send', async (req, res) => {
  const { phone, message } = req.body as { phone?: string; message?: string };
  if (!phone || !message) return res.status(400).json({ error: 'phone e message obrigatórios' });
  try {
    const ok = await sendWhatsApp(phone, message);
    res.json({ success: ok });
  } catch (err) {
    const errMsg = (err as Error).message || '';
    if (errMsg.startsWith('NUMERO_NAO_REGISTRADO')) {
      res.json({ success: false, numero_invalido: true });
    } else {
      res.status(500).json({ error: errMsg });
    }
  }
});

// GET /api/proposta/:slug — serve o PDF da proposta gerado para o lead
app.get('/api/proposta/:slug', (req, res) => {
  const slug     = (req.params as { slug: string }).slug.replace(/[^a-zA-Z0-9_-]/g, '');
  const filePath = path.join(process.cwd(), 'data', 'propostas', `${slug}.pdf`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Proposta não encontrada' });
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="proposta-${slug}.pdf"`);
  fs.createReadStream(filePath).pipe(res);
});

// GET /api/agenda/slots — retorna próximos horários disponíveis no calendário de Victor
app.get('/api/agenda/slots', async (_req, res) => {
  try {
    const { getAvailableSlots } = await import('../agents/agent_calendar');
    const slots = await getAvailableSlots();
    res.json({ slots });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/dashboard/stats — métricas consolidadas do pipeline
app.get('/api/dashboard/stats', (_req, res) => {
  try {
    const dataDir = path.join(process.cwd(), 'data');

    // Conversas ativas
    const conversasFile = path.join(dataDir, 'conversas_whatsapp.json');
    const conversas: any[] = fs.existsSync(conversasFile)
      ? JSON.parse(fs.readFileSync(conversasFile, 'utf-8'))
      : [];

    // Mensagens — últimos 7 dias
    let totalAbordados = 0, totalProbe = 0, totalEnviados = 0;
    const hoje = new Date().toISOString().slice(0, 10);
    let hojeEnviados = 0;

    for (let i = 0; i < 7; i++) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      const f = path.join(dataDir, `mensagens_${d}.json`);
      if (!fs.existsSync(f)) continue;
      const msgs: any[] = JSON.parse(fs.readFileSync(f, 'utf-8'));
      totalAbordados += msgs.length;
      totalProbe  += msgs.filter((m: any) => m.status === 'probe_enviado').length;
      totalEnviados += msgs.filter((m: any) => m.status === 'enviado').length;
      if (d === hoje) hojeEnviados = msgs.filter((m: any) => ['probe_enviado','enviado'].includes(m.status)).length;
    }

    // Estágios
    const porEstagio: Record<string, number> = {};
    for (const c of conversas) porEstagio[c.estagio] = (porEstagio[c.estagio] || 0) + 1;

    const responderam   = conversas.filter((c: any) => c.estagio !== 'primeiro_contato').length;
    const emNegociacao  = conversas.filter((c: any) => c.estagio === 'negociacao').length;
    const fechamentos   = conversas.filter((c: any) => c.estagio === 'fechamento').length;
    const conversasAtivas = conversas.filter((c: any) => c.estagio !== 'encerrado').length;

    const hojeResponderam = conversas.filter((c: any) => {
      const u = c.mensagens?.[c.mensagens.length - 1];
      return u?.data?.startsWith(hoje) && u.role === 'lead';
    }).length;

    // Receita potencial — R$597 médio para leads quentes
    const receitaPotencial = (emNegociacao + fechamentos) * 597;

    // Relatórios diários (última semana)
    const relatorios: any[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      const f = path.join(process.cwd(), 'logs', `relatorio_${d}.json`);
      if (fs.existsSync(f)) relatorios.push(JSON.parse(fs.readFileSync(f, 'utf-8')));
    }

    res.json({
      ultima_atualizacao: new Date().toISOString(),
      pipeline: {
        total_abordados:    totalAbordados,
        probe_enviado:      totalProbe,
        apresentacao_enviada: totalEnviados,
        responderam,
        em_negociacao:      emNegociacao,
        fechamentos,
        taxa_resposta:    totalEnviados > 0 ? ((responderam / totalEnviados) * 100).toFixed(1) + '%' : '0%',
        taxa_conversao:   totalEnviados > 0 ? ((fechamentos / totalEnviados) * 100).toFixed(1) + '%' : '0%',
      },
      por_estagio:       porEstagio,
      receita_potencial: `R$${receitaPotencial.toLocaleString('pt-BR')}`,
      conversas_ativas:  conversasAtivas,
      hoje:              { enviados: hojeEnviados, responderam: hojeResponderam },
      relatorios,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/historico — lista completa de contatos acionados
app.get('/api/historico', (_req, res) => {
  const file = path.join(process.cwd(), 'data', 'historico_contatos.json');
  if (!fs.existsSync(file)) return res.json([]);
  const historico = JSON.parse(fs.readFileSync(file, 'utf-8'));
  res.json(historico);
});

// POST /api/historico/rebuild — reconstrói histórico a partir de todos os arquivos existentes
app.post('/api/historico/rebuild', async (_req, res) => {
  try {
    const dataDir    = path.join(process.cwd(), 'data');
    const outFile    = path.join(dataDir, 'historico_contatos.json');
    const vistos     = new Set<string>();
    type HC = { slug: string; nome_negocio: string; telefone: string; segmento_macro: string; segmento_nivel2: string; segmento_micro: string; cidade: string; canal: string; data_acionado: string; status_envio: string };
    const historico: HC[] = [];

    const arquivos = fs.readdirSync(dataDir)
      .filter((f) => /^mensagens_\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .sort();

    for (const nomeArquivo of arquivos) {
      const data     = nomeArquivo.replace('mensagens_', '').replace('.json', '');
      const msgFile  = path.join(dataDir, nomeArquivo);
      const diagFile = path.join(dataDir, `diagnosticos_${data}.json`);
      const msgs  = JSON.parse(fs.readFileSync(msgFile, 'utf-8')) as Mensagem[];
      const diags = fs.existsSync(diagFile) ? JSON.parse(fs.readFileSync(diagFile, 'utf-8')) as Array<{ slug: string; telefone: string; cidade: string; categoria: string; segmento?: { macro: string; nivel2: string; micro: string[] } }> : [];

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
          data_acionado: (msg as any).data_envio || msg.data_criacao,
          status_envio: msg.status,
        });
      }
    }

    fs.writeFileSync(outFile, JSON.stringify(historico, null, 2));
    log.success(`/api/historico/rebuild: ${historico.length} contatos`);
    res.json({ ok: true, total: historico.length });
  } catch (err) {
    log.error(`/api/historico/rebuild: ${(err as Error).message}`);
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── Analytics por segmento ────────────────────────────────────────────────────

// GET /api/analytics/segmentos — funil de conversão agrupado por segmento
app.get('/api/analytics/segmentos', (_req, res) => {
  try {
    const dataDir        = path.join(process.cwd(), 'data');
    const historicoFile  = path.join(dataDir, 'historico_contatos.json');
    const conversasFile  = path.join(dataDir, 'conversas_whatsapp.json');

    type HC = { slug: string; segmento_micro: string; canal: string; cidade: string };
    type CV = { slug: string; estagio: string };

    const historico: HC[]  = fs.existsSync(historicoFile)  ? JSON.parse(fs.readFileSync(historicoFile, 'utf-8'))  : [];
    const conversas: CV[]  = fs.existsSync(conversasFile)  ? JSON.parse(fs.readFileSync(conversasFile, 'utf-8'))  : [];

    const conversaBySlug = new Map<string, CV>();
    for (const c of conversas) conversaBySlug.set(c.slug, c);

    type Funil = {
      segmento: string;
      acionados: number;
      responderam: number;
      negociacao: number;
      fechamento: number;
      taxa_resposta: string;
      taxa_negociacao: string;
      taxa_fechamento: string;
    };

    const map = new Map<string, Funil>();
    for (const h of historico) {
      const seg = h.segmento_micro || 'Outros';
      if (!map.has(seg)) {
        map.set(seg, { segmento: seg, acionados: 0, responderam: 0, negociacao: 0, fechamento: 0, taxa_resposta: '0%', taxa_negociacao: '0%', taxa_fechamento: '0%' });
      }
      const row = map.get(seg)!;
      row.acionados++;
      const cv = conversaBySlug.get(h.slug);
      if (cv) {
        if (!['primeiro_contato'].includes(cv.estagio))               row.responderam++;
        if (['negociacao', 'fechamento', 'onboarding', 'em_producao', 'entregue'].includes(cv.estagio)) row.negociacao++;
        if (['fechamento', 'onboarding', 'em_producao', 'entregue'].includes(cv.estagio))               row.fechamento++;
      }
    }

    const result = Array.from(map.values()).map((r) => ({
      ...r,
      taxa_resposta:    r.acionados > 0 ? ((r.responderam / r.acionados) * 100).toFixed(1) + '%' : '0%',
      taxa_negociacao:  r.acionados > 0 ? ((r.negociacao  / r.acionados) * 100).toFixed(1) + '%' : '0%',
      taxa_fechamento:  r.acionados > 0 ? ((r.fechamento  / r.acionados) * 100).toFixed(1) + '%' : '0%',
    })).sort((a, b) => b.acionados - a.acionados);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── Projetos (pós-pagamento) ──────────────────────────────────────────────────

const PROJETOS_FILE = path.join(process.cwd(), 'data', 'projetos.json');

function readProjetos(): Projeto[] {
  if (!fs.existsSync(PROJETOS_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(PROJETOS_FILE, 'utf-8')); } catch { return []; }
}
function writeProjetos(list: Projeto[]): void {
  fs.writeFileSync(PROJETOS_FILE, JSON.stringify(list, null, 2));
}

const MAX_TENANT_WHATSAPP = parseInt(process.env.MAX_TENANT_WHATSAPP || '3', 10);

/**
 * Marca o Projeto como ativo (idempotente) quando a conexão WhatsApp do
 * cliente conecta, e (re)liga o handler de resposta do Agente 10 — necessário
 * tanto na primeira ativação quanto depois de qualquer restart do processo.
 */
function activateProjeto(slug: string): void {
  const list = readProjetos();
  const idx = list.findIndex((p) => p.slug === slug);
  if (idx === -1) {
    log.warn(`activateProjeto: Projeto "${slug}" não encontrado`);
    return;
  }

  if (list[idx].status !== 'ativo') {
    list[idx] = { ...list[idx], status: 'ativo', ativo_desde: new Date().toISOString() };
    writeProjetos(list);
    notifyOwner(`✅ Bot ativado automaticamente para ${list[idx].nome_negocio}!`, '🤖 Bot ativado').catch(() => {});
    log.success(`Projeto "${slug}" ativado — bot de WhatsApp conectado`);
  }

  const conn = whatsappManager.getTenant(slug);
  if (conn) conn.setMessageHandler(createTenantMessageHandler(list[idx], conn));
}

// GET /api/projetos — lista todos os projetos
app.get('/api/projetos', (_req, res) => res.json(readProjetos()));

// PATCH /api/projetos/:id — atualiza campo(s) de um projeto
app.patch('/api/projetos/:id', (req, res) => {
  const list = readProjetos();
  const idx  = list.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Projeto não encontrado' });
  list[idx] = { ...list[idx], ...(req.body as Partial<Projeto>) };
  writeProjetos(list);
  res.json({ success: true, projeto: list[idx] });
});

// ── Blacklist (LGPD opt-out) ──────────────────────────────────────────────────

const BLACKLIST_FILE_SRV = path.join(process.cwd(), 'data', 'blacklist.json');

function readBlacklist(): string[] {
  if (!fs.existsSync(BLACKLIST_FILE_SRV)) return [];
  try { return JSON.parse(fs.readFileSync(BLACKLIST_FILE_SRV, 'utf-8')); } catch { return []; }
}
function writeBlacklist(list: string[]): void {
  fs.writeFileSync(BLACKLIST_FILE_SRV, JSON.stringify(list, null, 2));
}
function normalizePhone(p: string): string {
  return p.replace(/\D/g, '').replace(/^55/, '');
}

// GET /api/blacklist — lista números na blacklist
app.get('/api/blacklist', (_req, res) => res.json(readBlacklist()));

// POST /api/blacklist — adiciona número à blacklist
app.post('/api/blacklist', (req, res) => {
  const { phone } = req.body as { phone?: string };
  if (!phone) return res.status(400).json({ error: 'phone obrigatório' });
  const norm = normalizePhone(phone);
  const list = readBlacklist();
  if (!list.includes(norm)) { list.push(norm); writeBlacklist(list); }
  res.json({ success: true, phone: norm });
});

// DELETE /api/blacklist/:phone — remove número da blacklist
app.delete('/api/blacklist/:phone', (req, res) => {
  const norm = normalizePhone(req.params.phone);
  const list = readBlacklist().filter((p) => normalizePhone(p) !== norm);
  writeBlacklist(list);
  res.json({ success: true });
});

// GET /analytics — página de análise por segmento
app.get('/analytics', (_req, res) => {
  res.sendFile(path.join(process.cwd(), 'analytics.html'));
});

// ── Analytics por cidade ──────────────────────────────────────────────────────

app.get('/api/analytics/cidades', (_req, res) => {
  try {
    const dataDir       = path.join(process.cwd(), 'data');
    const historicoFile = path.join(dataDir, 'historico_contatos.json');
    const conversasFile = path.join(dataDir, 'conversas_whatsapp.json');
    type HC = { slug: string; cidade: string; canal: string };
    type CV = { slug: string; estagio: string };
    const historico: HC[] = fs.existsSync(historicoFile) ? JSON.parse(fs.readFileSync(historicoFile, 'utf-8')) : [];
    const conversas: CV[] = fs.existsSync(conversasFile) ? JSON.parse(fs.readFileSync(conversasFile, 'utf-8')) : [];
    const cvMap = new Map<string, CV>();
    for (const c of conversas) cvMap.set(c.slug, c);
    type Row = { cidade: string; acionados: number; responderam: number; fechamento: number; taxa_resposta: string; taxa_fechamento: string };
    const map = new Map<string, Row>();
    for (const h of historico) {
      const cidade = h.cidade || 'Desconhecida';
      if (!map.has(cidade)) map.set(cidade, { cidade, acionados: 0, responderam: 0, fechamento: 0, taxa_resposta: '0%', taxa_fechamento: '0%' });
      const row = map.get(cidade)!;
      row.acionados++;
      const cv = cvMap.get(h.slug);
      if (cv) {
        if (cv.estagio !== 'primeiro_contato') row.responderam++;
        if (['fechamento','onboarding','em_producao','entregue'].includes(cv.estagio)) row.fechamento++;
      }
    }
    const result = Array.from(map.values()).map((r) => ({
      ...r,
      taxa_resposta:  r.acionados > 0 ? ((r.responderam / r.acionados) * 100).toFixed(1) + '%' : '0%',
      taxa_fechamento: r.acionados > 0 ? ((r.fechamento / r.acionados) * 100).toFixed(1) + '%' : '0%',
    })).sort((a, b) => b.acionados - a.acionados);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── Indicações ────────────────────────────────────────────────────────────────

const INDICACOES_FILE_SRV = path.join(process.cwd(), 'data', 'indicacoes.json');

app.get('/api/indicacoes', (_req, res) => {
  if (!fs.existsSync(INDICACOES_FILE_SRV)) return res.json([]);
  try { res.json(JSON.parse(fs.readFileSync(INDICACOES_FILE_SRV, 'utf-8'))); } catch { res.json([]); }
});

app.patch('/api/indicacoes/:id', (req, res) => {
  if (!fs.existsSync(INDICACOES_FILE_SRV)) return res.status(404).json({ error: 'Nenhuma indicação' });
  const lista = JSON.parse(fs.readFileSync(INDICACOES_FILE_SRV, 'utf-8')) as import('../types').Indicacao[];
  const idx = lista.findIndex((i) => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Não encontrado' });
  lista[idx] = { ...lista[idx], ...(req.body as Partial<import('../types').Indicacao>) };
  fs.writeFileSync(INDICACOES_FILE_SRV, JSON.stringify(lista, null, 2));
  res.json({ success: true });
});

// ── Ações especiais de projetos ───────────────────────────────────────────────

// PATCH /api/projetos/:id/entregue — marca como entregue com URL do site
app.patch('/api/projetos/:id/entregue', (req, res) => {
  const list = readProjetos();
  const idx  = list.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Projeto não encontrado' });
  const { entrega_url } = req.body as { entrega_url?: string };
  list[idx].status      = 'entregue';
  list[idx].entregue_em = new Date().toISOString();
  if (entrega_url) list[idx].entrega_url = entrega_url;
  writeProjetos(list);
  // Atualiza conversa
  const conversasFile = path.join(process.cwd(), 'data', 'conversas_whatsapp.json');
  if (fs.existsSync(conversasFile)) {
    const convs: Array<{ slug?: string; phone?: string; estagio?: string }> = JSON.parse(fs.readFileSync(conversasFile, 'utf-8'));
    const ci = convs.findIndex((c) => c.slug === list[idx].slug || c.phone === list[idx].phone);
    if (ci !== -1) { convs[ci].estagio = 'entregue'; fs.writeFileSync(conversasFile, JSON.stringify(convs, null, 2)); }
  }
  res.json({ success: true, projeto: list[idx] });
});

// PATCH /api/projetos/:id/segunda-parcela — confirma recebimento da 2ª parcela
app.patch('/api/projetos/:id/segunda-parcela', (req, res) => {
  const list = readProjetos();
  const idx  = list.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Projeto não encontrado' });
  list[idx].segunda_parcela_paga    = true;
  list[idx].segunda_parcela_paga_em = new Date().toISOString();
  writeProjetos(list);
  res.json({ success: true });
});

// ── Painel de chat ao vivo ────────────────────────────────────────────────

const CONVERSAS_CHAT_FILE = path.join(process.cwd(), 'data', 'conversas_whatsapp.json');

app.get('/api/chat/conversas', (_req, res) => {
  interface ChatConversa { phone: string; nome_negocio: string; estagio: string; segmento: string; cidade: string; ultima_atualizacao: string; mensagens: Array<{ role: string; texto: string; data: string }>; }
  let convs: ChatConversa[] = [];
  try { convs = JSON.parse(fs.readFileSync(CONVERSAS_CHAT_FILE, 'utf-8')); } catch { convs = []; }
  const sorted = [...convs]
    .filter((c) => !['encerrado'].includes(c.estagio))
    .sort((a, b) => new Date(b.ultima_atualizacao).getTime() - new Date(a.ultima_atualizacao).getTime());
  res.json(sorted.map((c) => ({
    phone: c.phone,
    nome_negocio: c.nome_negocio,
    estagio: c.estagio,
    segmento: c.segmento,
    cidade: c.cidade,
    ultima_atualizacao: c.ultima_atualizacao,
    ultima_mensagem: c.mensagens[c.mensagens.length - 1] || null,
    total_mensagens: c.mensagens.length,
    mensagens: c.mensagens.slice(-30),
  })));
});

app.post('/api/chat/send', async (req, res) => {
  const { phone, message } = req.body as { phone?: string; message?: string };
  if (!phone || !message?.trim()) return res.status(400).json({ error: 'phone e message obrigatórios' });
  try {
    const { sendWhatsApp } = await import('../utils/whatsapp');
    const ok = await sendWhatsApp(phone, message.trim());
    if (ok) {
      type ChatEntry = { phone: string; mensagens: Array<{ role: string; texto: string; data: string }>; ultima_atualizacao: string };
      let convs: ChatEntry[] = [];
      try { convs = JSON.parse(fs.readFileSync(CONVERSAS_CHAT_FILE, 'utf-8')); } catch { convs = []; }
      const c = convs.find((x) => x.phone === phone);
      if (c) {
        c.mensagens.push({ role: 'victor', texto: message.trim(), data: new Date().toISOString() });
        c.ultima_atualizacao = new Date().toISOString();
        fs.writeFileSync(CONVERSAS_CHAT_FILE, JSON.stringify(convs, null, 2));
      }
    }
    res.json({ success: ok });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /chat — painel de chat ao vivo
app.get('/chat', (_req, res) => {
  res.sendFile(path.join(process.cwd(), 'chat.html'));
});

// GET /projetos — painel de gestão de projetos
app.get('/projetos', (_req, res) => {
  res.sendFile(path.join(process.cwd(), 'projetos.html'));
});

// GET /historico — página de histórico de leads acionados
app.get('/historico', (_req, res) => {
  res.sendFile(path.join(process.cwd(), 'historico.html'));
});

// GET /dashboard — página de métricas
app.get('/dashboard', (_req, res) => {
  res.sendFile(path.join(process.cwd(), 'dashboard.html'));
});

// Redirecionar raiz para o painel
app.get('/', (_req, res) => {
  res.sendFile(path.join(process.cwd(), 'aprovacao.html'));
});

app.listen(PORT, () => {
  log.success(`🌐 Servidor rodando em http://localhost:${PORT}`);

  if (process.env.WHATSAPP_PROVIDER === 'wwebjs') {
    log.info('📱 Reconectando WhatsApp Web (sessão salva)...');
    setMessageHandler(handleIncomingWhatsApp);
    initWhatsappWeb().catch((err) => {
      log.warn(`WhatsApp Web não inicializado: ${(err as Error).message} — envios serão simulados`);
    });

    // Monitor de saúde: verifica conexão a cada 5min e reconecta automaticamente
    let _disconnectedSince: number | null = null;
    setInterval(async () => {
      if (!isWwjsConnected()) {
        // Rastreia há quanto tempo está desconectado
        if (!_disconnectedSince) _disconnectedSince = Date.now();
        const mins = Math.round((Date.now() - _disconnectedSince) / 60000);
        log.warn(`⚠ WhatsApp desconectado há ${mins}min — reconectando...`);
        _disconnectedSince = null;
        reinitWhatsappWeb().catch((err: Error) =>
          log.error(`Falha ao reconectar WhatsApp: ${err.message}`)
        );
        return;
      }
      _disconnectedSince = null;
      // Verifica sessão via getState() — sem enviar mensagem, sem log de erro desnecessário
      const alive = await checkWwjsHealth();
      if (!alive) {
        log.warn('⚠ WhatsApp sessão travada (getState falhou) — reconectando...');
        reinitWhatsappWeb().catch((e: Error) =>
          log.error(`Falha ao reconectar WhatsApp: ${e.message}`)
        );
      }
    }, 5 * 60 * 1000); // a cada 5 minutos

    // Reconecta bots de clientes já ativos (ex: após restart do PM2), limitado ao teto de conexões simultâneas
    readProjetos()
      .filter((p) => p.tipo_produto === 'automacao' && p.status === 'ativo')
      .slice(0, MAX_TENANT_WHATSAPP)
      .forEach((p) => {
        whatsappManager
          .createTenantConnection(p.slug, {
            onReady: () => activateProjeto(p.slug),
            onDisconnected: () => {},
          })
          .catch((err) => log.warn(`Reconexão do bot "${p.slug}" falhou: ${(err as Error).message}`));
      });
  }
});

export default app;

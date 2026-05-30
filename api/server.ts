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
import { Mensagem, RespostaLead, CadenciaLead } from '../types';
import { log } from '../utils/logger';
import { notifyOwner } from '../utils/notifications';
import {
  sendWhatsApp,
  initWhatsappWeb,
  whatsappConfigured,
  getLatestQr,
  isWwjsConnected,
  requestPairingCode,
} from '../utils/whatsapp';

const app = express();
app.use(cors());
app.use(express.json());

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
  return path.join(process.cwd(), 'data', `mensagens_${today()}.json`);
}

function readMessages(): Mensagem[] {
  const file = getMsgFile();
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
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
      const todayDiagFile = path.join(process.cwd(), 'data', `diagnosticos_${today}.json`);
      if (fs.existsSync(todayDiagFile)) {
        const diags = JSON.parse(fs.readFileSync(todayDiagFile, 'utf-8'));
        const diag = diags.find((d: { slug: string }) => d.slug === msg.slug);
        if (diag) registrarNaCadencia(diag, msgs[idx]);
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

// ─────────────────────────────────────────────────────────────────────────────

// Redirecionar raiz para o painel
app.get('/', (_req, res) => {
  res.sendFile(path.join(process.cwd(), 'aprovacao.html'));
});

app.listen(PORT, () => {
  log.success(`🌐 Servidor rodando em http://localhost:${PORT}`);

  if (process.env.WHATSAPP_PROVIDER === 'wwebjs') {
    log.info('📱 Reconectando WhatsApp Web (sessão salva)...');
    initWhatsappWeb().catch((err) => {
      log.warn(`WhatsApp Web não inicializado: ${(err as Error).message} — envios serão simulados`);
    });
  }
});

export default app;

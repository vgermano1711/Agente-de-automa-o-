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
import { Mensagem, RespostaLead } from '../types';
import { log } from '../utils/logger';
import { notifyOwner } from '../utils/notifications';
import { sendWhatsApp } from '../utils/whatsapp';

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

// GET /api/mensagens — lista todas pendentes de aprovação
app.get('/api/mensagens', (_req, res) => {
  const msgs = readMessages().filter((m) => m.status === 'aprovacao_pendente');
  res.json(msgs);
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

async function sendEmail(msg: Mensagem): Promise<void> {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  const toEmail = process.env.LEAD_EMAIL_OVERRIDE || 'lead@example.com';

  if (!gmailUser || !gmailPass) {
    log.warn('Gmail não configurado — simulando envio');
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailUser, pass: gmailPass },
  });

  const mailOptions: nodemailer.SendMailOptions = {
    from: gmailUser,
    to: toEmail,
    subject: msg.assunto || `Proposta para ${msg.nome_negocio}`,
    text: msg.corpo,
  };

  if (msg.video_path && fs.existsSync(msg.video_path)) {
    mailOptions.attachments = [
      {
        filename: `preview_${msg.slug}.mp4`,
        path: msg.video_path,
      },
    ];
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

// POST /api/aprovar/:id — aprova e envia mensagem
app.post('/api/aprovar/:id', async (req, res) => {
  const msgs = readMessages();
  const idx = msgs.findIndex((m) => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Mensagem não encontrada' });

  const msg = msgs[idx];
  if (msg.status !== 'aprovacao_pendente') {
    return res.status(400).json({ error: 'Mensagem não está pendente de aprovação' });
  }

  // Pegar o telefone do lead do arquivo de diagnósticos
  const today = new Date().toISOString().slice(0, 10);
  const diagFile = path.join(process.cwd(), 'data', `diagnosticos_${today}.json`);
  let telefone = '';
  if (fs.existsSync(diagFile)) {
    const diags = JSON.parse(fs.readFileSync(diagFile, 'utf-8'));
    const diag = diags.find((d: { slug: string; telefone: string }) => d.slug === msg.slug);
    if (diag) telefone = diag.telefone;
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

// Redirecionar raiz para o painel
app.get('/', (_req, res) => {
  res.sendFile(path.join(process.cwd(), 'aprovacao.html'));
});

app.listen(PORT, () => {
  log.success(`🌐 Servidor rodando em http://localhost:${PORT}`);
});

export default app;

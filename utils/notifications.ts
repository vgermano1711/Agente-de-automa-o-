import axios from 'axios';
import nodemailer from 'nodemailer';
import { log } from './logger';

async function sendPushover(message: string, title: string): Promise<boolean> {
  const token = process.env.PUSHOVER_TOKEN;
  const user = process.env.PUSHOVER_USER;
  if (!token || !user) return false;

  try {
    await axios.post('https://api.pushover.net/1/messages.json', {
      token,
      user,
      title,
      message,
      url: process.env.APPROVAL_PANEL_URL || 'http://localhost:3000',
      url_title: 'Abrir Painel',
    });
    return true;
  } catch (err) {
    log.warn(`Pushover falhou: ${(err as Error).message}`);
    return false;
  }
}

// Singleton — uma única conexão SMTP reutilizada em todas as notificações
let _transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
      pool: true,
      maxConnections: 1,
    });
  }
  return _transporter;
}

async function sendEmailFallback(message: string, title: string): Promise<boolean> {
  const transporter = getTransporter();
  const owner = process.env.OWNER_EMAIL;
  if (!transporter || !owner) return false;

  try {
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: owner,
      subject: `[Sales Bot] ${title}`,
      text: message,
    });
    return true;
  } catch (err) {
    log.error(`Email fallback falhou: ${(err as Error).message}`);
    return false;
  }
}

interface NotificationTask {
  message: string;
  title: string;
  attempts: number;
}

const _queue: NotificationTask[] = [];
let _draining = false;

async function drainQueue(): Promise<void> {
  if (_draining) return;
  _draining = true;

  while (_queue.length > 0) {
    const task = _queue[0];
    task.attempts++;

    const sent = await sendPushover(task.message, task.title);
    if (sent) {
      _queue.shift();
      continue;
    }

    if (task.attempts >= 3) {
      const emailSent = await sendEmailFallback(task.message, task.title);
      if (!emailSent) {
        log.error(`Notificação perdida após 3 tentativas: [${task.title}] ${task.message}`);
      }
      _queue.shift();
      continue;
    }

    // Aguarda 5s antes de tentar novamente
    await new Promise<void>((r) => setTimeout(r, 5000));
  }

  _draining = false;
}

export async function notifyOwner(message: string, title = 'Sales Bot'): Promise<void> {
  if (process.env.NOTIFICACOES_ATIVAS === 'false') return;
  log.info(`Notificação: ${title} — ${message}`);
  // Pushover (push nativo no celular) + email como fallback
  _queue.push({ message, title, attempts: 0 });
  drainQueue().catch((e: Error) => log.error(`Fila de notificações: ${e.message}`));
}

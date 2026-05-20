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

async function sendEmailFallback(message: string, title: string): Promise<void> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  const owner = process.env.OWNER_EMAIL;
  if (!user || !pass || !owner) return;

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
    await transporter.sendMail({
      from: user,
      to: owner,
      subject: `[Sales Bot] ${title}`,
      text: message,
    });
  } catch (err) {
    log.error(`Email fallback falhou: ${(err as Error).message}`);
  }
}

export async function notifyOwner(message: string, title = 'Sales Bot'): Promise<void> {
  if (process.env.NOTIFICACOES_ATIVAS === 'false') return;
  log.info(`Notificação: ${title} — ${message}`);
  const sent = await sendPushover(message, title);
  if (!sent) await sendEmailFallback(message, title);
}

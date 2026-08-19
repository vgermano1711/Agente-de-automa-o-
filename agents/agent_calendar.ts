/**
 * Agente de Agenda — Google Calendar
 * Consulta disponibilidade, formata slots para WhatsApp e cria eventos de call.
 * Usa as mesmas credenciais OAuth já configuradas para Gmail (GOOGLE_*).
 */

import { google } from 'googleapis';
import { log } from '../utils/logger';

const TIMEZONE = 'America/Sao_Paulo';
const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export interface SlotAgenda {
  label: string;  // "ter, 17/06 às 16h"
  inicio: string; // ISO string
  fim: string;    // ISO string
}

function criarAuth() {
  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;
  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });
  return auth;
}

/** Retorna os próximos slots livres de 30 min após 16h em dias úteis. */
export async function getAvailableSlots(qtd = 4): Promise<SlotAgenda[]> {
  const auth = criarAuth();
  if (!auth) return [];

  const calendar = google.calendar({ version: 'v3', auth });

  const agora  = new Date();
  const inicio = new Date(agora);
  inicio.setDate(inicio.getDate() + 1);
  inicio.setHours(0, 0, 0, 0);
  const fim = new Date(inicio.getTime() + 14 * 24 * 60 * 60 * 1000);

  let busyPeriods: Array<{ start: string; end: string }> = [];
  try {
    const resp = await calendar.freebusy.query({
      requestBody: {
        timeMin: inicio.toISOString(),
        timeMax: fim.toISOString(),
        timeZone: TIMEZONE,
        items: [{ id: 'primary' }],
      },
    });
    busyPeriods = (resp.data.calendars?.primary?.busy || []) as Array<{ start: string; end: string }>;
  } catch (err) {
    log.warn(`Calendar — erro ao buscar disponibilidade: ${(err as Error).message}`);
  }

  const slots: SlotAgenda[] = [];
  const d = new Date(inicio);

  while (slots.length < qtd && d < fim) {
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) {
      for (const hora of [16, 17, 18, 19]) {
        if (slots.length >= qtd) break;
        const slotStart = new Date(d);
        slotStart.setHours(hora, 0, 0, 0);
        const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);

        const ocupado = busyPeriods.some((b) => {
          const bs = new Date(b.start).getTime();
          const be = new Date(b.end).getTime();
          return slotStart.getTime() < be && slotEnd.getTime() > bs;
        });

        if (!ocupado) {
          const dd = d.getDate().toString().padStart(2, '0');
          const mm = (d.getMonth() + 1).toString().padStart(2, '0');
          slots.push({
            label: `${DIAS_SEMANA[dow]}, ${dd}/${mm} às ${hora}h`,
            inicio: slotStart.toISOString(),
            fim:    slotEnd.toISOString(),
          });
        }
      }
    }
    d.setDate(d.getDate() + 1);
  }

  return slots;
}

/** Cria um evento no Google Calendar de Victor para a call com o lead. */
export async function criarEventoCall(
  nomeNegocio: string,
  telefone: string,
  slot: SlotAgenda
): Promise<boolean> {
  const auth = criarAuth();
  if (!auth) return false;

  const calendar = google.calendar({ version: 'v3', auth });
  try {
    await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: `Call — ${nomeNegocio}`,
        description: `Reunião de venda\nNegócio: ${nomeNegocio}\nWhatsApp: ${telefone}`,
        start: { dateTime: slot.inicio, timeZone: TIMEZONE },
        end:   { dateTime: slot.fim,    timeZone: TIMEZONE },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 30 },
            { method: 'popup', minutes: 5  },
          ],
        },
      },
    });
    log.success(`Calendar — evento criado: Call com ${nomeNegocio} em ${slot.label}`);
    return true;
  } catch (err) {
    log.warn(`Calendar — falha ao criar evento: ${(err as Error).message}`);
    return false;
  }
}

/** Formata os slots disponíveis para mensagem de WhatsApp. */
export function formatarSlotsWA(slots: SlotAgenda[]): string {
  if (slots.length === 0) {
    return 'Minha agenda está cheia essa semana. Me fala o melhor dia e horário pra você depois das 16h e eu encaixo aqui.';
  }
  const linhas = slots.map((s, i) => `${i + 1}. ${s.label}`).join('\n');
  return `Esses são os meus horários disponíveis:\n\n${linhas}\n\nQual encaixa melhor pra você?`;
}

/**
 * Agente 6 — Revisor Anti-IA
 * Lê mensagens, verifica e reescreve frases genéricas de IA, alinha tom ao canal,
 * atualiza status para aprovacao_pendente e notifica o dono.
 */

import Anthropic from '@anthropic-ai/sdk';
import { Mensagem } from '../types';
import { log } from '../utils/logger';
import { dataPath, readJson, writeJson } from '../utils/dataHelpers';
import { notifyOwner } from '../utils/notifications';

const client = new Anthropic();

const AI_PHRASES = [
  'espero que este email te encontre bem',
  'espero que este e-mail te encontre bem',
  'espero que esteja bem',
  'como vai você',
  'conforme mencionado anteriormente',
  'não hesite em entrar em contato',
  'fico à disposição para quaisquer dúvidas',
  'atenciosamente',
  'cordialmente',
  'desde já agradeço',
  'prezado(a)',
  'prezada empresa',
  'através desta',
  'venho por meio desta',
  'inovador',
  'revolucionário',
  'soluções inovadoras',
  'em um mundo cada vez mais',
  'na era digital',
];

function hasAIPhrases(text: string): string[] {
  const lower = text.toLowerCase();
  return AI_PHRASES.filter((phrase) => lower.includes(phrase));
}

function countParagraphs(text: string): number {
  return text.split(/\n\n+/).filter((p) => p.trim().length > 0).length;
}

function mentionsBusiness(text: string, nome: string): boolean {
  const nomeSimplificado = nome.split(' ')[0].toLowerCase();
  return text.toLowerCase().includes(nomeSimplificado);
}

async function reviewMessage(msg: Mensagem): Promise<Mensagem> {
  const foundPhrases = hasAIPhrases(msg.corpo);
  const paragraphsOk = countParagraphs(msg.corpo) <= 3;
  const mentionsBiz = mentionsBusiness(msg.corpo, msg.nome_negocio);

  const needsRevision = foundPhrases.length > 0 || !paragraphsOk || !mentionsBiz;

  if (!needsRevision) {
    msg.revisao_score = 95;
    msg.revisao_notas = 'Mensagem aprovada na revisão automática sem alterações';
    msg.status = 'aprovacao_pendente';
    return msg;
  }

  const issues = [];
  if (foundPhrases.length > 0) issues.push(`Frases genéricas de IA encontradas: ${foundPhrases.join(', ')}`);
  if (!paragraphsOk) issues.push(`Mais de 3 parágrafos (${countParagraphs(msg.corpo)} encontrados)`);
  if (!mentionsBiz) issues.push(`Nome do negócio "${msg.nome_negocio}" não aparece na mensagem`);

  const prompt = `Você é um revisor de copywriting especializado em reescrever mensagens de vendas para remover linguagem genérica de IA e torná-las mais humanas e eficazes.

Problemas encontrados na mensagem abaixo:
${issues.map((i) => `- ${i}`).join('\n')}

Canal: ${msg.canal}
Negócio: ${msg.nome_negocio}
${msg.assunto ? `Assunto: ${msg.assunto}` : ''}

Mensagem original:
---
${msg.corpo}
---

Reescreva a mensagem corrigindo TODOS os problemas. Regras:
1. REMOVA todas as frases genéricas de IA listadas
2. MANTENHA o link da landing page (${msg.landing_page_url})
3. O nome "${msg.nome_negocio}" deve aparecer NATURALMENTE pelo menos 1x
4. MÁXIMO 3 parágrafos
5. Tom alinhado com o canal: ${msg.canal}
6. Mantenha a proposta de valor — apenas reescreva, não mude o conteúdo principal

${msg.canal === 'email' ? 'Se havia assunto, reescreva também. Retorne JSON: {"assunto": "...", "corpo": "..."}' : 'Retorne apenas o texto reescrito'}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = (response.content[0] as { type: string; text: string }).text.trim();

    if (msg.canal === 'email') {
      try {
        const parsed = JSON.parse(text);
        if (parsed.assunto) msg.assunto = parsed.assunto;
        msg.corpo = parsed.corpo;
      } catch {
        msg.corpo = text;
      }
    } else {
      msg.corpo = text;
    }

    const remainingPhrases = hasAIPhrases(msg.corpo);
    const score = Math.max(
      60,
      100 -
        remainingPhrases.length * 10 -
        (countParagraphs(msg.corpo) > 3 ? 15 : 0) -
        (!mentionsBusiness(msg.corpo, msg.nome_negocio) ? 10 : 0)
    );

    msg.revisao_score = score;
    msg.revisao_notas = `Revisado — ${issues.join('; ')}. Score: ${score}/100`;
  } catch (err) {
    log.warn(`Revisão via IA falhou para ${msg.nome_negocio}, mantendo original: ${(err as Error).message}`);
    msg.revisao_score = 70;
    msg.revisao_notas = `Revisão automática falhou. Problemas detectados: ${issues.join('; ')}`;
  }

  msg.status = 'aprovacao_pendente';
  return msg;
}

export async function runAgent6(): Promise<Mensagem[]> {
  log.info('Agente 6 — Revisor Anti-IA iniciado');

  const msgFile = dataPath('mensagens_{data}.json');
  const mensagens = readJson<Mensagem[]>(msgFile);
  if (!mensagens || mensagens.length === 0) {
    log.warn('Nenhuma mensagem para revisar');
    return [];
  }

  const revisadas: Mensagem[] = [];
  for (const msg of mensagens) {
    if (msg.status !== 'aguardando_revisao') {
      revisadas.push(msg);
      continue;
    }
    log.info(`  Revisando mensagem para ${msg.nome_negocio}...`);
    const revisada = await reviewMessage(msg);
    revisadas.push(revisada);
    log.info(`  ✓ ${msg.nome_negocio} — score: ${revisada.revisao_score}`);
  }

  writeJson(msgFile, revisadas);

  const pendentes = revisadas.filter((m) => m.status === 'aprovacao_pendente').length;
  const panelUrl = process.env.APPROVAL_PANEL_URL || 'http://localhost:3000';

  await notifyOwner(
    `${pendentes} mensagem(ns) prontas para sua aprovação.\nAcesse: ${panelUrl}`,
    '📬 Mensagens aguardando aprovação'
  );

  log.success(`Agente 6 concluído: ${pendentes} mensagens prontas para aprovação`);
  return revisadas;
}

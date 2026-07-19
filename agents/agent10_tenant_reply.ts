/**
 * Agente 10 — Respondedor de WhatsApp por cliente (produto "automação")
 *
 * Diferente do Agente 9 (que vende, com funil de cadência/negociação para o
 * vendedor), este handler responde em nome do CLIENTE que contratou a
 * automação — usa só o que foi coletado no onboarding (catálogo, horário,
 * dúvidas frequentes, mensagem de boas-vindas). Uma instância por Projeto,
 * amarrada à conexão WhatsApp isolada daquele cliente (WhatsAppConnection),
 * nunca à conexão do vendedor.
 */

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { Projeto } from '../types';
import { log } from '../utils/logger';
import type { WhatsAppConnection, MessageHandler } from '../utils/whatsappConnection';

const client = new Anthropic();

const PROJETOS_FILE = path.join(process.cwd(), 'data', 'projetos.json');

export type SinalConversa = 'agendamento_pedido' | 'interesse_alto' | 'duvida_resolvida' | 'nenhum';

export interface MensagemConversa {
  role: 'cliente' | 'bot';
  texto: string;
  timestamp: string;
  sinal?: SinalConversa; // só em mensagens role:'bot' — sinal de interesse detectado pela IA
}

export type ConversasClienteFile = Record<string, { mensagens: MensagemConversa[] }>;

function clienteDataDir(slug: string): string {
  return path.join(process.cwd(), 'data', 'clients', slug);
}

export function conversasFile(slug: string): string {
  return path.join(clienteDataDir(slug), 'conversas.json');
}

export function lerConversas(slug: string): ConversasClienteFile {
  const file = conversasFile(slug);
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return {};
  }
}

function salvarConversas(slug: string, conversas: ConversasClienteFile): void {
  const dir = clienteDataDir(slug);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(conversasFile(slug), JSON.stringify(conversas, null, 2));
}

function lerProjetoFresco(slug: string): Projeto | null {
  if (!fs.existsSync(PROJETOS_FILE)) return null;
  try {
    const lista = JSON.parse(fs.readFileSync(PROJETOS_FILE, 'utf-8')) as Projeto[];
    return lista.find((p) => p.slug === slug) || null;
  } catch {
    return null;
  }
}

function montarPrompt(projeto: Projeto, historico: MensagemConversa[], novaMensagem: string): string {
  const info = projeto.onboarding_info || {};
  const historicoTexto = historico.length
    ? 'HISTÓRICO RECENTE:\n' +
      historico
        .slice(-6)
        .map((h) => `${h.role === 'cliente' ? 'Cliente' : 'Você'}: ${h.texto}`)
        .join('\n') +
      '\n\n'
    : '';

  return `Você é o assistente de WhatsApp do negócio "${projeto.nome_negocio}". Responda em nome desse negócio, não do seu criador.

Catálogo/serviços: ${info.catalogo || 'não informado'}
Horário de funcionamento: ${info.horario_funcionamento || 'não informado'}
Dúvidas frequentes conhecidas: ${info.duvidas_frequentes || 'nenhuma cadastrada'}
Mensagem de boas-vindas padrão do negócio: ${info.msg_boas_vindas || '(nenhuma cadastrada)'}

${historicoTexto}NOVA MENSAGEM DO CLIENTE:
"${novaMensagem}"

Responda como atendente real do negócio, educado e direto. Máximo 3 frases curtas.
Se perguntarem sobre agendamento, use o horário de funcionamento informado — não invente disponibilidade específica de horário/vaga.
Se a dúvida não estiver coberta pelas informações acima, diga que vai verificar e que alguém do negócio retorna em breve.
Retorne o texto da resposta e, numa última linha separada, um marcador de controle interno — o cliente NUNCA vê essa linha, ela é só pra registro:
---SINAL:agendamento_pedido--- (se o cliente pediu horário/agendamento)
---SINAL:interesse_alto--- (se demonstrou forte interesse mas não pediu agendamento)
---SINAL:duvida_resolvida--- (se só tirou dúvida simples, sem sinal de interesse maior)
---SINAL:nenhum--- (qualquer outro caso)
Use exatamente um desses marcadores, sempre na última linha.`;
}

const SINAIS_VALIDOS: SinalConversa[] = ['agendamento_pedido', 'interesse_alto', 'duvida_resolvida', 'nenhum'];

export function extrairSinal(textoCompleto: string): { texto: string; sinal: SinalConversa } {
  const match = textoCompleto.match(/---SINAL:(\w+)---\s*$/);
  const bruto = match?.[1];
  const sinal = SINAIS_VALIDOS.includes(bruto as SinalConversa) ? (bruto as SinalConversa) : 'nenhum';
  const texto = match ? textoCompleto.slice(0, match.index).trim() : textoCompleto.trim();
  return { texto, sinal };
}

async function gerarResposta(
  projeto: Projeto,
  historico: MensagemConversa[],
  novaMensagem: string
): Promise<{ texto: string; sinal: SinalConversa }> {
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [{ role: 'user', content: montarPrompt(projeto, historico, novaMensagem) }],
    });
    const bruto = (response.content[0] as { type: string; text: string }).text.trim();
    return extrairSinal(bruto);
  } catch (err) {
    log.warn(`Agent10 (${projeto.slug}) geração falhou: ${(err as Error).message}`);
    return { texto: 'Recebi sua mensagem! Em instantes alguém retorna — obrigado pelo contato.', sinal: 'nenhum' };
  }
}

export function createTenantMessageHandler(projetoInicial: Projeto, conn: WhatsAppConnection): MessageHandler {
  const slug = projetoInicial.slug;

  return async (from, body, _contactPhone, _isPersonalContact, isMedia) => {
    const projeto = lerProjetoFresco(slug) || projetoInicial;

    const conversas = lerConversas(slug);
    const conversa = conversas[from] || { mensagens: [] };

    const textoRecebido = isMedia && !body ? '[mídia recebida]' : body;
    conversa.mensagens.push({ role: 'cliente', texto: textoRecebido, timestamp: new Date().toISOString() });

    const { texto: resposta, sinal } = await gerarResposta(projeto, conversa.mensagens, textoRecebido);

    conversa.mensagens.push({ role: 'bot', texto: resposta, timestamp: new Date().toISOString(), sinal });
    conversas[from] = conversa;
    salvarConversas(slug, conversas);

    const enviado = await conn.sendMessage(from, resposta);
    if (!enviado) {
      log.warn(`Agent10 (${slug}): falha ao enviar resposta para ${from}`);
    }
  };
}

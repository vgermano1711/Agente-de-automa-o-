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

interface MensagemConversa {
  role: 'cliente' | 'bot';
  texto: string;
  timestamp: string;
}

type ConversasClienteFile = Record<string, { mensagens: MensagemConversa[] }>;

function clienteDataDir(slug: string): string {
  return path.join(process.cwd(), 'data', 'clients', slug);
}

function conversasFile(slug: string): string {
  return path.join(clienteDataDir(slug), 'conversas.json');
}

function lerConversas(slug: string): ConversasClienteFile {
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
Retorne APENAS o texto da resposta, sem aspas, sem explicações.`;
}

async function gerarResposta(projeto: Projeto, historico: MensagemConversa[], novaMensagem: string): Promise<string> {
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [{ role: 'user', content: montarPrompt(projeto, historico, novaMensagem) }],
    });
    return (response.content[0] as { type: string; text: string }).text.trim();
  } catch (err) {
    log.warn(`Agent10 (${projeto.slug}) geração falhou: ${(err as Error).message}`);
    return 'Recebi sua mensagem! Em instantes alguém retorna — obrigado pelo contato.';
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

    const resposta = await gerarResposta(projeto, conversa.mensagens, textoRecebido);

    conversa.mensagens.push({ role: 'bot', texto: resposta, timestamp: new Date().toISOString() });
    conversas[from] = conversa;
    salvarConversas(slug, conversas);

    const enviado = await conn.sendMessage(from, resposta);
    if (!enviado) {
      log.warn(`Agent10 (${slug}): falha ao enviar resposta para ${from}`);
    }
  };
}

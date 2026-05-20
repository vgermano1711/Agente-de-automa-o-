/**
 * Agente 5 — Seletor de Canal e Gerador de Mensagem
 * Lê diagnósticos, gera mensagem personalizada para o canal correto via Claude,
 * salva mensagens_{data}.json com status aguardando_revisao.
 */

import Anthropic from '@anthropic-ai/sdk';
import path from 'path';
import { Diagnostico, Mensagem } from '../types';
import { log } from '../utils/logger';
import { dataPath, readJson, writeJson, generateId, today } from '../utils/dataHelpers';

const client = new Anthropic();

const CHANNEL_PROMPTS: Record<string, string> = {
  email: `Gere um email de prospecção frio com:
- Assunto: impactante, curioso, sem spam (máx 60 chars)
- Corpo: 3 parágrafos curtos. Parágrafo 1: abertura direta mencionando o negócio pelo nome e a cidade. Parágrafo 2: problema específico e a solução (a landing page). Parágrafo 3: CTA claro com o link.
- Tom: profissional mas acessível, sem linguagem de IA`,

  sms: `Gere uma mensagem SMS com MÁXIMO 160 caracteres. Deve:
- Mencionar o nome do negócio
- Ter link placeholder {{LINK}}
- Ser direto e humano, não parecer robô
- Incluir proposta de valor em poucas palavras`,

  instagram: `Gere uma DM de Instagram. Deve:
- Começar de forma casual, como uma pessoa real escreveria
- Mencionar o negócio pelo nome de forma natural
- Ser curta (máx 3 frases)
- Incluir o link da landing page
- Tom: amigável, local, humano`,

  linkedin: `Gere uma mensagem LinkedIn. Deve:
- Tom profissional, focado em ROI e resultados
- Mencionar o nome do negócio e a cidade
- Máx 4 frases
- Focar no impacto comercial de ter uma presença digital profissional
- Incluir o link`,
};

async function generateMessage(diag: Diagnostico): Promise<Mensagem> {
  const canal = diag.canal_recomendado;
  const landingUrl = diag.landing_page_url || 'https://exemplo.netlify.app';
  const videoPath = path.join(process.cwd(), 'videos', `${diag.slug}.mp4`);

  const channelInstructions = CHANNEL_PROMPTS[canal];

  const prompt = `Você é um especialista em copywriting de vendas para pequenos negócios locais brasileiros.
Escreva uma mensagem de prospecção REAL, humana, sem linguagem de IA.

${channelInstructions}

Dados do negócio:
- Nome: ${diag.nome}
- Categoria: ${diag.categoria}
- Cidade: ${diag.cidade}
- Problema: ${diag.problema_principal}
- Ângulo de venda: ${diag.angulo_de_venda}
- Proposta de valor: ${diag.proposta_de_valor}
- Tom: ${diag.tom_da_abordagem}
- Link da landing page: ${landingUrl}

Regras ABSOLUTAS:
1. NUNCA use "Espero que este email te encontre bem" ou variações
2. NUNCA use "Prezado(a)" — use o nome do negócio ou forma casual
3. NUNCA termine com "Atenciosamente" em canais informais
4. O nome "${diag.nome}" deve aparecer pelo menos 1x de forma natural
5. Máximo 3 parágrafos

${canal === 'email' ? 'Retorne JSON: {"assunto": "...", "corpo": "..."}' : 'Retorne apenas o texto da mensagem, sem JSON'}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = (response.content[0] as { type: string; text: string }).text.trim();

    let assunto: string | undefined;
    let corpo: string;

    if (canal === 'email') {
      try {
        const jsonText = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        const parsed = JSON.parse(jsonText);
        assunto = parsed.assunto;
        corpo = parsed.corpo;
      } catch {
        const lines = text.split('\n');
        assunto = lines[0].replace(/^(Assunto:|Subject:)\s*/i, '').trim();
        corpo = lines.slice(1).join('\n').trim();
      }
    } else {
      corpo = text.replace(/\{\{LINK\}\}/g, landingUrl);
    }

    return {
      id: generateId(),
      lead_id: diag.lead_id,
      nome_negocio: diag.nome,
      canal,
      assunto,
      corpo,
      landing_page_url: landingUrl,
      video_path: require('fs').existsSync(videoPath) ? videoPath : null,
      status: 'aguardando_revisao',
      data_criacao: new Date().toISOString(),
      slug: diag.slug,
    };
  } catch (err) {
    log.warn(`Mensagem mock para ${diag.nome}: ${(err as Error).message}`);
    return mockMessage(diag, landingUrl, videoPath);
  }
}

function mockMessage(diag: Diagnostico, landingUrl: string, videoPath: string): Mensagem {
  const canal = diag.canal_recomendado;
  const fs = require('fs');

  const corpos: Record<string, string> = {
    email: `Oi, tudo bem?\n\nVi o ${diag.nome} no Google e fiquei impressionado com as avaliações — reputação assim é difícil de construir. Só que percebi uma coisa: quando alguém busca ${diag.categoria} em ${diag.cidade}, não consegue te encontrar direito online.\n\nMontei uma prévia de como sua presença digital poderia ficar: ${landingUrl}\n\nSe curtir, posso deixar isso no ar pra você em menos de 24h. Sem enrolação.`,
    sms: `Oi! Montei uma prévia de site para o ${diag.nome}. Dá uma olhada: ${landingUrl} — posso te mostrar como isso pode trazer mais clientes.`,
    instagram: `Oi! Vi o ${diag.nome} aqui no Google — incrível as avaliações! Montei uma prévia de site pra vocês, dá uma olhada: ${landingUrl} 🚀`,
    linkedin: `Olá! Analisando negócios de ${diag.categoria} em ${diag.cidade}, notei que o ${diag.nome} tem ótima reputação mas baixa visibilidade digital. Preparei uma demonstração gratuita do que uma landing page profissional poderia representar em novos clientes: ${landingUrl}`,
  };

  return {
    id: generateId(),
    lead_id: diag.lead_id,
    nome_negocio: diag.nome,
    canal,
    assunto: canal === 'email' ? `Vi o ${diag.nome} no Google — tenho algo pra mostrar` : undefined,
    corpo: (corpos as Record<string, string>)[canal] || corpos.email,
    landing_page_url: landingUrl,
    video_path: fs.existsSync(videoPath) ? videoPath : null,
    status: 'aguardando_revisao',
    data_criacao: new Date().toISOString(),
    slug: diag.slug,
  };
}

export async function runAgent5(): Promise<Mensagem[]> {
  log.info('Agente 5 — Seletor de Canal e Gerador de Mensagem iniciado');

  const diagFile = dataPath('diagnosticos_{data}.json');
  const diagnosticos = readJson<Diagnostico[]>(diagFile);
  if (!diagnosticos || diagnosticos.length === 0) {
    log.warn('Nenhum diagnóstico para processar');
    return [];
  }

  const mensagens: Mensagem[] = [];
  for (const diag of diagnosticos) {
    log.info(`  Gerando mensagem ${diag.canal_recomendado} para ${diag.nome}...`);
    const msg = await generateMessage(diag);
    mensagens.push(msg);
    log.info(`  ✓ ${diag.nome} → canal ${msg.canal}`);
  }

  const msgFile = dataPath('mensagens_{data}.json');
  writeJson(msgFile, mensagens);

  log.success(`Agente 5 concluído: ${mensagens.length} mensagens geradas → ${msgFile}`);
  return mensagens;
}

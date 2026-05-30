/**
 * Agente 5 — Seletor de Canal e Gerador de Mensagem
 * Lê diagnósticos, gera mensagem personalizada para o canal correto via Claude,
 * salva mensagens_{data}.json com status aguardando_revisao.
 */

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { Diagnostico, Mensagem } from '../types';
import { log } from '../utils/logger';
import { dataPath, readJson, writeJson, generateId, today } from '../utils/dataHelpers';

const client = new Anthropic();

const CHANNEL_PROMPTS: Record<string, string> = {
  whatsapp: `Você é o Victor, desenvolvedor web. Escreva uma mensagem WhatsApp que faça o dono do negócio parar tudo e ler duas vezes.

ESTRUTURA OBRIGATÓRIA — 4 linhas separadas, sem bloco de texto:

Linha 1 — RECONHECIMENTO ESPECÍFICO: Algo que só quem realmente olhou o negócio saberia. Não elogio genérico. Um detalhe real — o horário de funcionamento, o bairro, o serviço específico, o número de avaliações. Algo que prova que Victor viu de verdade.

Linha 2 — A LACUNA: Uma frase que nomeia exatamente o que está faltando. Sem suavizar, sem "talvez", sem "poderia". A lacuna é real e Victor a enxerga com clareza. Exemplo: "Mas quem te pesquisa no Google não encontra nada que mostre o quanto vocês são bons."

Linha 3 — A ENTREGA: Victor já fez. Não está oferecendo. Está entregando. "Fiz uma prévia de como isso poderia mudar:" seguido do link sozinho na linha. Ponto final. Sem floreios.

Linha 4 — A PERGUNTA QUE DESPERTA CURIOSIDADE: Não "O que você acha?". Uma pergunta que implica que a resposta vai surpreender. Exemplo: "Curioso pra saber o que você sentiu ao ver." ou "Me fala o que achou — fiz pensando especificamente em vocês."

REGRAS ABSOLUTAS:
- Zero asteriscos, zero listas, zero títulos, zero emojis forçados — no máximo 1 se vier naturalmente
- Frases curtas. Se uma frase tem mais de 15 palavras, corte ao meio
- O link aparece sozinho na linha, sem texto antes ou depois
- Victor nunca pede desculpa por enviar. Ele sabe que o que tem é valioso
- Nunca use "Prezado", "Atenciosamente", "Espero não incomodar"
- Tom: confiante como Jobs apresentando o iPhone — não arrogante, mas absolutamente certo do valor`,

  email: `Você é o Victor, desenvolvedor web que encontrou esse negócio no Google.

Escreva um email como o Victor escreveria — direto, gentil, sem enrolação. Como se estivesse escrevendo para um conhecido, não para um desconhecido.

ASSUNTO: Curto, direto, desperta curiosidade sem parecer spam (máx 50 chars). Ex: "fiz algo pra vocês" ou "vi o [nome] no Google"

CORPO — 3 parágrafos curtos:
1. Abertura genuína: como achou o negócio e o que chamou atenção (algo específico e verdadeiro)
2. Observação leve do problema + o que o Victor já preparou, com o link
3. Pergunta aberta e leve, sem pressão. Assina como "Victor" apenas.

Tom: como uma mensagem de email pessoal, não newsletter. Sem template, sem formatação excessiva.`,

  sms: `Você é o Victor, desenvolvedor web. Escreva um SMS de no máximo 160 caracteres.
Mencione o nome do negócio, apresente o link e faça uma pergunta curta e leve.
Tom: direto e humano, como quem manda SMS de verdade.`,

  instagram: `Você é o Victor, desenvolvedor web que achou esse negócio no Instagram.
Escreva uma DM curta (máx 3 frases) como o Victor escreveria de verdade.
Abertura casual, elogio genuíno, link da prévia e pergunta leve.
Tom: descontraído, como uma mensagem de quem realmente viu o perfil.`,

  linkedin: `Você é o Victor, desenvolvedor web.
Escreva uma mensagem LinkedIn de até 4 frases.
Tom profissional mas pessoal — como quem encontrou o perfil e teve uma ideia genuína de ajudar.
Mencione o negócio, a cidade, apresente o link da prévia e termine com uma pergunta aberta.`,
};

async function generateMessage(diag: Diagnostico): Promise<Mensagem> {
  const canal = diag.canal_recomendado;
  const landingUrl = diag.landing_page_url || 'http://localhost:3000/pages/' + diag.slug;
  const videoPath = path.join(process.cwd(), 'videos', `${diag.slug}.mp4`);

  const channelInstructions = CHANNEL_PROMPTS[canal];

  const prompt = `${channelInstructions}

Contexto do negócio que o Victor encontrou:
- Nome: ${diag.nome}
- Categoria: ${diag.categoria}
- Cidade: ${diag.cidade}
- Problema identificado: ${diag.problema_principal}
- Oportunidade: ${diag.angulo_de_venda}
- Link da prévia que o Victor já preparou: ${landingUrl}

REGRAS ABSOLUTAS — qualquer violação invalida a mensagem:
1. NUNCA use "Espero que este email te encontre bem" ou qualquer variação
2. NUNCA use "Prezado(a)", "Caro(a)", "Atenciosamente", "Cordialmente"
3. NUNCA mencione "automação", "IA", "sistema", "bot" ou "prospecção"
4. NUNCA use linguagem de vendedor ou script de vendas
5. O nome "${diag.nome}" deve aparecer pelo menos 1 vez de forma natural
6. A mensagem deve parecer que foi digitada agora, não copiada de template
7. Termine sempre com uma pergunta leve e genuína, sem pressão

${canal === 'email' ? 'Retorne JSON: {"assunto": "...", "corpo": "..."}' : 'Retorne apenas o texto da mensagem, sem explicações ou comentários adicionais'}`;

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
      video_path: fs.existsSync(videoPath) ? videoPath : null,
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

  const corpos: Record<string, string> = {
    whatsapp: `Oi! Vi o ${diag.nome} no Google enquanto pesquisava negócios de ${diag.categoria} em ${diag.cidade}.\n\nFiquei impressionado com as avaliações — reputação assim é difícil de construir. Só que percebi que quem busca por vocês online acaba não te encontrando com facilidade.\n\nResolvi montar uma prévia de como ficaria a presença de vocês na internet:\n${landingUrl}\n\nO que você achou?`,
    email: `Oi, tudo bem?\n\nVi o ${diag.nome} no Google hoje e fiquei curioso — as avaliações de vocês são muito boas, esse nível de reputação é raro. Só que percebi que quando alguém busca ${diag.categoria} em ${diag.cidade}, fica difícil te encontrar online.\n\nResolvi montar uma prévia de como poderia ser a presença digital de vocês: ${landingUrl}\n\nFaz sentido pra você?\n\nVictor`,
    sms: `Oi! Sou o Victor, vi o ${diag.nome} no Google e fiz uma prévia de site pra vocês: ${landingUrl} — o que você achou?`,
    instagram: `Oi! Vi o ${diag.nome} aqui e fiquei curioso — as avaliações de vocês são ótimas. Resolvi montar uma prévia de como ficaria a presença online de vocês: ${landingUrl} — faz sentido?`,
    linkedin: `Olá! Vi o ${diag.nome} no Google e fiquei impressionado com a reputação de vocês em ${diag.cidade}. Percebi uma oportunidade de melhorar a visibilidade online e já montei uma prévia: ${landingUrl}. Faria sentido conversar sobre isso?`,
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

  const msgFile = dataPath('mensagens_{data}.json');
  const existentes = readJson<Mensagem[]>(msgFile) || [];
  // Ignora mensagens com URLs antigas do Netlify para forçar regeneração
  const slugsComMensagem = new Set(
    existentes
      .filter((m) => !m.landing_page_url?.includes('netlify'))
      .map((m) => m.slug)
  );

  const novos = diagnosticos.filter((d) => !slugsComMensagem.has(d.slug));

  if (novos.length === 0) {
    log.info('Todos os diagnósticos já têm mensagem — nada a fazer');
    return existentes;
  }

  const novasMensagens: Mensagem[] = [];
  for (const diag of novos) {
    log.info(`  Gerando mensagem ${diag.canal_recomendado} para ${diag.nome}...`);
    const msg = await generateMessage(diag);
    novasMensagens.push(msg);
    log.info(`  ✓ ${diag.nome} → canal ${msg.canal}`);
  }

  const merged = [...existentes, ...novasMensagens];
  writeJson(msgFile, merged);

  log.success(`Agente 5 concluído: +${novasMensagens.length} mensagem(ns) → ${msgFile}`);
  return merged;
}

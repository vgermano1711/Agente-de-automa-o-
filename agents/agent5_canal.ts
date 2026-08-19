/**
 * Agente 5 — Seletor de Canal e Gerador de Mensagem de Apresentação
 * Gera SOMENTE a mensagem de apresentação (sem link, sem proposta).
 * A proposta com link é gerada pela cadência no dia seguinte.
 */

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { Diagnostico, Mensagem } from '../types';
import { log } from '../utils/logger';
import { dataPath, readJson, writeJson, generateId, today } from '../utils/dataHelpers';

const client = new Anthropic();

// Segmentos onde a dor é de produto/venda online (e-commerce/marketplace)
const SEGMENTOS_LOJA = new Set([
  'pet shop', 'confeitaria artesanal', 'ótica', 'farmácia de manipulação',
  'buffet e eventos', 'studio de tatuagem', 'loja de roupas', 'loja de calçados',
  'floricultura', 'papelaria', 'loja de presentes',
]);

const INTRO_PROMPTS: Record<string, string> = {
  // ── Automações ────────────────────────────────────────────────────────────
  whatsapp_automacao_agendamento: `Use o template abaixo EXATAMENTE como está. Substitua apenas os 2 marcadores:
- [Nome do Dono] → tente inferir o primeiro nome pelo nome do negócio (ex: "Barbearia do João" → "João"). Se não possível, use "Bom dia!" sem nome.
- [Nome da Loja] → nome exato do negócio fornecido no contexto

Não altere nenhuma outra palavra do template.

TEMPLATE:

Bom dia, [Nome do Dono]! Tudo bem?

Sou o Victor, programador. Minha mãe queria marcar um horário aí n[o/a] [Nome da Loja] semana passada — tentou pelo WhatsApp mas demorou um tempão pra receber resposta. Alta demanda mesmo, é sinal que o lugar é bom.

Só que ela quase tinha ido em outro lugar enquanto esperava.

Faço sistemas de agendamento automático pelo WhatsApp — o cliente manda mensagem, o bot responde na hora, mostra os horários disponíveis e confirma tudo sozinho. Você não precisa fazer nada, só aparecer pra atender.

Posso te mostrar como funciona?`,

  whatsapp_automacao_cardapio: `Use o template abaixo EXATAMENTE como está. Substitua apenas os 2 marcadores:
- [Nome do Dono] → tente inferir o primeiro nome pelo nome do negócio. Se não possível, use "Bom dia!" sem nome.
- [Nome da Loja] → nome exato do negócio fornecido no contexto

Não altere nenhuma outra palavra do template.

TEMPLATE:

Bom dia, [Nome do Dono]! Tudo certo?

Sou o Victor, programador. Minha namorada fez um pedido aí n[o/a] [Nome da Loja] semana passada, num sábado à noite — mandou mensagem no WhatsApp e ficou uns 20 minutos esperando alguém responder. Alta demanda mesmo.

Ela quase tinha desistido e pedido em outro lugar. No fim deu certo, mas ficou naquele sufoco de não saber se a mensagem tinha chegado.

Faço sistemas de pedido automático pelo WhatsApp — o cliente manda mensagem, o bot mostra o cardápio, ele escolhe e confirma, sem precisar de ninguém do outro lado.

Posso te mostrar como ficaria?`,

  whatsapp_automacao_reativacao: `Use o template abaixo EXATAMENTE como está. Substitua apenas os 2 marcadores:
- [Nome do Dono] → tente inferir o primeiro nome pelo nome do negócio. Se não possível, use "Bom dia!" sem nome.
- [Nome da Loja] → nome exato do negócio fornecido no contexto

Não altere nenhuma outra palavra do template.

TEMPLATE:

Bom dia, [Nome do Dono]! Tudo bem?

Sou o Victor, programador. Minha prima frequentava aí n[o/a] [Nome da Loja] mas parou uns meses por conta da correria do trabalho. Ela mesma falou que queria voltar — só que nunca ninguém entrou em contato pra chamar de volta, e acabou esquecendo mesmo.

Vi as avaliações de vocês no Google, são ótimas. Mas perder cliente que some sem dar satisfação é quase universal nesse segmento — a maioria volta com um simples "sumiu, tá bem?".

Faço sistemas de reativação automática — o WhatsApp de vocês manda mensagem pra quem sumiu, sem você precisar controlar nada.

Posso te mostrar como funciona?`,

  whatsapp_automacao_atendimento: `Use o template abaixo EXATAMENTE como está. Substitua apenas os 2 marcadores:
- [Nome do Dono] → tente inferir o primeiro nome pelo nome do negócio. Se não possível, use "Bom dia!" sem nome.
- [Nome da Loja] → nome exato do negócio fornecido no contexto

Não altere nenhuma outra palavra do template.

TEMPLATE:

Bom dia, [Nome do Dono]! Tudo certo?

Sou o Victor, programador. Meu irmão tentou falar com [Nome da Loja] pelo WhatsApp semana passada e ficou um bom tempo esperando resposta. Alta demanda — é sinal que o lugar tem movimento mesmo.

Só que ele quase tinha desistido de esperar. Acabou sendo atendido, mas comentou que se tivesse pressa teria ido embora.

Faço sistemas de atendimento automático pelo WhatsApp — responde clientes 24h, na hora, sem precisar de ninguém do outro lado. Vocês não perdem mais nenhuma mensagem.

Posso te mostrar rapidinho como funciona?`,

  // ── Sites ─────────────────────────────────────────────────────────────────
  whatsapp_longo: `Use o template abaixo EXATAMENTE como está. Substitua apenas os 3 marcadores:
- [Nome do Dono] → tente inferir o primeiro nome do dono/responsável pelo nome do negócio (ex: "Barbearia do João" → "João", "Studio Luana" → "Luana"). Se não for possível inferir, use apenas "Bom dia!" sem nome.
- [Nome da Loja] → nome exato do negócio fornecido no contexto
- LINK_AQUI → o link da prévia fornecido no contexto

Não altere nenhuma outra palavra do template.

TEMPLATE:

Bom dia, [Nome do Dono]! Sou o Victor, programador e desenvolvedor web. Vi o [Nome da Loja] no Google Maps e montei uma prévia de como ficaria o site de vocês:

LINK_AQUI

Dá uma olhada e me fala o que acha, sem compromisso nenhum.`,

  whatsapp_curto: `Use o template abaixo EXATAMENTE como está. Substitua apenas os 3 marcadores:
- [Nome do Dono] → tente inferir o primeiro nome do dono/responsável pelo nome do negócio (ex: "Barbearia do João" → "João", "Studio Luana" → "Luana"). Se não for possível inferir, remova e deixe só "Bom dia!" sem nome.
- [Nome da Loja] → nome exato do negócio fornecido no contexto
- LINK_AQUI → o link da prévia fornecido no contexto

Não altere nenhuma outra palavra do template.

TEMPLATE:

Bom dia, [Nome do Dono]! Vi o [Nome da Loja] no Google e fiz uma prévia de como ficaria o site de vocês — sem compromisso nenhum, só pra mostrar:

LINK_AQUI

Se quiser conversar, estou por aqui. — Victor`,

  whatsapp_loja: `Use o template abaixo EXATAMENTE como está. Substitua apenas os 3 marcadores:
- [Nome do Dono] → tente inferir o primeiro nome do dono/responsável pelo nome do negócio (ex: "Pet da Maria" → "Maria", "Confeitaria do João" → "João"). Se não for possível inferir, use apenas "Bom dia!" sem nome.
- [Nome da Loja] → nome exato do negócio fornecido no contexto
- LINK_AQUI → o link da prévia fornecido no contexto

Não altere nenhuma outra palavra do template.

TEMPLATE:

Bom dia, [Nome do Dono]! Sou o Victor, programador e desenvolvedor web. Passei pelo perfil da [Nome da Loja] e montei uma prévia de como ficaria a loja online de vocês:

LINK_AQUI

O que achou?`,

  email: `Você é o Victor, desenvolvedor web. Escreva um email de APRESENTAÇÃO no estilo de Joe Girard — apenas o primeiro contato humano genuíno. Sem proposta, sem link, sem oferta.

ASSUNTO (máx 45 caracteres): Natural, como de alguém que você conhece. Tom: "vi o [nome] no Google" / "olá, [nome]" / "uma coisa que notei". Sem marketing.

CORPO — 3 parágrafos curtos:

Parágrafo 1 (2-3 frases): Victor encontrou o negócio e ficou genuinamente admirado — detalhe específico e verdadeiro. Como alguém que realmente parou e olhou com cuidado.

Parágrafo 2 (2 frases): Victor se apresenta como pessoa — nome, o que faz, por que esse negócio chamou atenção. Humano, sem cargo formal, sem script.

Parágrafo 3 (1-2 frases + assinatura): Porta aberta e calorosa. Victor ficará feliz em trocar uma ideia se fizer sentido — sem pressão. Assina apenas "Victor".

REGRAS: ZERO links, ZERO proposta, ZERO menção de serviços. Tom de carta pessoal genuína. Sem "Atenciosamente", sem "Cordialmente".`,

  sms: `Você é o Victor, desenvolvedor web. Escreva um SMS de APRESENTAÇÃO de no máximo 140 caracteres no estilo Joe Girard.
Apenas primeiro contato humano: nome do negócio, algo específico que Victor notou, apresentação pessoal rápida.
ZERO links, ZERO proposta. Tom: caloroso e direto, como quem realmente pensou na pessoa.`,

  instagram: `Você é o Victor, desenvolvedor web. Escreva uma DM de APRESENTAÇÃO de no máximo 3 frases no estilo Joe Girard.
Algo específico e verdadeiro que Victor notou, apresentação pessoal breve, porta aberta calorosa.
ZERO links, ZERO proposta. Tom: genuíno, como quem parou para olhar o perfil e sentiu vontade de se apresentar.`,

  linkedin: `Você é o Victor, desenvolvedor web. Escreva uma mensagem de APRESENTAÇÃO no LinkedIn de até 3 frases no estilo Joe Girard.
Reconheça o trabalho com especificidade genuína, apresente-se brevemente, abra uma porta calorosa.
ZERO links, ZERO proposta. Tom: profissional mas humano — como alguém genuinamente admirado que decidiu se apresentar.`,
};

async function generateMessage(diag: Diagnostico): Promise<Mensagem> {
  const canal = diag.canal_recomendado;
  const landingUrl = diag.landing_page_url || 'http://localhost:3000/pages/' + diag.slug;
  const videoPath = path.join(process.cwd(), 'videos', `${diag.slug}.mp4`);

  // Roteia por pitch e tipo de negócio
  let variante: string | undefined;
  let channelInstructions: string;
  if (canal === 'whatsapp') {
    if (diag.pitch_principal === 'automacao' && diag.tipo_automacao) {
      // Automação: roteamento por tipo detectado
      const autoKey = `whatsapp_automacao_${diag.tipo_automacao}`;
      channelInstructions = INTRO_PROMPTS[autoKey] || INTRO_PROMPTS.whatsapp_longo;
      variante = `automacao_${diag.tipo_automacao}`;
    } else {
      // Site: roteamento por perfil de negócio
      const isLoja = SEGMENTOS_LOJA.has((diag.categoria || '').toLowerCase());
      variante = isLoja ? 'loja' : 'longo';
      channelInstructions = INTRO_PROMPTS[`whatsapp_${variante}`];
    }
  } else {
    channelInstructions = INTRO_PROMPTS[canal] || INTRO_PROMPTS.whatsapp_longo;
  }

  const prompt = `${channelInstructions}

Contexto do negócio que o Victor encontrou:
- Nome: ${diag.nome}
- Categoria: ${diag.categoria}
- Cidade: ${diag.cidade}
- Detalhe para destacar: ${diag.problema_principal}
- Site de apresentação criado pelo Victor para este negócio: ${landingUrl}

REGRAS:
1. Substitua LINK_AQUI pelo link: ${landingUrl}
2. Para canal email: retorne JSON {"assunto": "...", "corpo": "..."}
3. Para outros canais: retorne apenas o texto final, sem explicações

${canal === 'email' ? 'Retorne JSON: {"assunto": "...", "corpo": "..."}' : 'Retorne apenas o texto da mensagem preenchida, sem explicações ou comentários adicionais'}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = (response.content[0] as { type: string; text: string }).text.trim();

    let assunto: string | undefined;
    let corpo: string = '';

    // Tenta extrair JSON independente do canal — Claude às vezes retorna JSON mesmo para WhatsApp
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.corpo) {
          assunto = parsed.assunto || undefined;
          corpo = parsed.corpo;
        }
      } catch { /* segue para fallback */ }
    }

    if (!corpo) {
      const clean = text.replace(/```[^\n]*\n?/g, '').trim();
      if (canal === 'email') {
        const lines = clean.split('\n');
        assunto = lines[0].replace(/^(Assunto:|Subject:)\s*/i, '').trim();
        corpo = lines.slice(1).join('\n').trim();
      } else {
        corpo = clean;
      }
    }

    // Garante que o link está sempre presente — independente do que Claude gerou
    if (landingUrl && !corpo.includes(landingUrl)) {
      corpo = corpo.trimEnd() + '\n\n' + landingUrl;
    }

    if (variante) log.info(`    Variante A/B: ${variante}`);
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
      variante_ab: variante,
    } as Mensagem & { variante_ab?: string };
  } catch (err) {
    log.warn(`Mensagem mock para ${diag.nome}: ${(err as Error).message}`);
    return mockMessage(diag, landingUrl, videoPath, variante);
  }
}

function mockMessage(diag: Diagnostico, landingUrl: string, videoPath: string, variante?: string): Mensagem {
  const canal = diag.canal_recomendado;

  const corpoLongo = `Bom dia! Sou o Victor, programador e desenvolvedor web. Vi o ${diag.nome} no Google Maps e montei uma prévia de como ficaria o site de vocês:\n\n${landingUrl}\n\nDá uma olhada e me fala o que acha, sem compromisso nenhum.`;

  const corpoLoja = `Bom dia! Sou o Victor, programador e desenvolvedor web. Passei pelo perfil da ${diag.nome} e montei uma prévia de como ficaria a loja online de vocês:\n\n${landingUrl}\n\nO que achou?`;

  const corpoAgendamento = `Bom dia! Sou o Victor, programador. Vi o ${diag.nome} no Google Maps.\n\nMontei uma demonstração de como ficaria o agendamento automático pelo WhatsApp de vocês:\n\n${landingUrl}\n\nDá uma olhada sem compromisso.`;

  const corpoCardapio = `Bom dia! Sou o Victor, dev. Vi o ${diag.nome} no Google Maps.\n\nFiz uma prévia de como ficaria o cardápio digital de vocês:\n\n${landingUrl}\n\nO que acha?`;

  const corpoReativacaoAtendimento = `Bom dia! Sou o Victor, programador. Vi o ${diag.nome} no Google.\n\nMontei uma demonstração de um sistema automatizado que roda sozinho no WhatsApp de vocês, sem precisar de esforço nenhum da sua parte:\n\n→ Responde clientes automaticamente, 24h — você não precisa fazer nada\n→ Manda mensagem pra clientes que sumiram — também automático, sem precisar lembrar\n\nVocê instala uma vez e o sistema cuida do resto.\n\n${landingUrl}\n\nDá uma olhada, sem compromisso.`;

  const corposWa: Record<string, string> = {
    automacao_agendamento: corpoAgendamento,
    automacao_cardapio:    corpoCardapio,
    automacao_reativacao:  corpoReativacaoAtendimento,
    automacao_atendimento: corpoReativacaoAtendimento,
    loja:                  corpoLoja,
    longo:                 corpoLongo,
  };

  const corpos: Record<string, string> = {
    whatsapp: corposWa[variante || 'longo'] || corpoLongo,
    email: `Vi o ${diag.nome} no Google hoje e fiquei genuinamente admirado. A reputação que vocês têm em ${diag.cidade} não aparece por acaso — é resultado de dedicação real com cada cliente.\n\nMeu nome é Victor, sou desenvolvedor web. Preparei um site de apresentação especialmente para vocês: ${landingUrl}\n\nSe quiserem trocar uma ideia, estou por aqui — sem pressa.\n\nVictor`,
    sms: `Vi o ${diag.nome} no Google. Sou Victor, dev web — preparei um site de apresentação pra vocês: ${landingUrl}`,
    instagram: `Vi o ${diag.nome} aqui e fiquei admirado com o que vocês construíram. Preparei um site de apresentação pra vocês: ${landingUrl} — Sou o Victor, desenvolvedor web.`,
    linkedin: `Vi o ${diag.nome} no Google e fiquei genuinamente admirado. Preparei um site de apresentação especialmente para vocês: ${landingUrl} — Sou Victor, desenvolvedor web.`,
  };

  const corpoFinal = ((corpos as Record<string, string>)[canal] || corpos.email);

  return {
    id: generateId(),
    lead_id: diag.lead_id,
    nome_negocio: diag.nome,
    canal,
    assunto: canal === 'email' ? `vi o ${diag.nome} no Google` : undefined,
    corpo: corpoFinal,
    landing_page_url: landingUrl,
    video_path: fs.existsSync(videoPath) ? videoPath : null,
    status: 'aguardando_revisao',
    data_criacao: new Date().toISOString(),
    slug: diag.slug,
    variante_ab: variante,
  } as Mensagem & { variante_ab?: string };
}

export async function runAgent5(): Promise<Mensagem[]> {
  log.info('Agente 5 — Gerador de Apresentação iniciado');

  const diagFile = dataPath('diagnosticos_{data}.json');
  const diagnosticos = readJson<Diagnostico[]>(diagFile);
  if (!diagnosticos || diagnosticos.length === 0) {
    log.warn('Nenhum diagnóstico para processar');
    return [];
  }

  const msgFile = dataPath('mensagens_{data}.json');
  const existentes = readJson<Mensagem[]>(msgFile) || [];
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
    log.info(`  Gerando apresentação ${diag.canal_recomendado} para ${diag.nome}...`);
    const msg = await generateMessage(diag);
    novasMensagens.push(msg);
    log.info(`  ✓ ${diag.nome} → canal ${msg.canal}`);
  }

  const merged = [...existentes, ...novasMensagens];
  writeJson(msgFile, merged);

  log.success(`Agente 5 concluído: +${novasMensagens.length} apresentação(ões) → ${msgFile}`);
  return merged;
}

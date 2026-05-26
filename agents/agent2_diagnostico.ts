/**
 * Agente 2 — Diagnosticador
 * Lê leads do dia, prioriza top 5 por score, gera diagnóstico via Claude API,
 * e salva diagnosticos_{data}.json.
 */

import Anthropic from '@anthropic-ai/sdk';
import { Lead, Diagnostico } from '../types';
import { log } from '../utils/logger';
import { dataPath, readJson, writeJson, slugify, today } from '../utils/dataHelpers';

const client = new Anthropic();

// WhatsApp é o canal padrão para todos — maior taxa de abertura no Brasil
const CANAL_MAP: Record<string, Diagnostico['canal_recomendado']> = {
  'salão de beleza': 'whatsapp',
  barbearia: 'whatsapp',
  'clínica odontológica': 'whatsapp',
  construtora: 'whatsapp',
  'corretor de imóveis': 'whatsapp',
};

async function diagnoseLead(lead: Lead): Promise<Diagnostico> {
  const prompt = `Você é um consultor de marketing digital especializado em pequenos negócios locais brasileiros.

Analise este negócio e gere um diagnóstico de vendas em JSON:

Negócio: ${lead.nome}
Categoria: ${lead.categoria}
Cidade: ${lead.cidade}
Website atual: ${lead.website || 'Nenhum'}
Avaliação Google: ${lead.avaliacao} estrelas (${lead.total_avaliacoes} avaliações)

Retorne APENAS o JSON válido abaixo, sem markdown, sem explicações:

{
  "problema_principal": "string de 1 frase descrevendo o problema digital mais crítico",
  "angulo_de_venda": "string de 1 frase com o ângulo emocional/comercial ideal para abordar",
  "tom_da_abordagem": "direto e técnico | amigável e local | consultivo | aspiracional",
  "proposta_de_valor": "1 frase poderosa que resume o benefício principal de ter uma landing page profissional",
  "diferencial_local": "1 característica específica deste tipo de negócio nesta cidade que pode ser explorada"
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = (response.content[0] as { type: string; text: string }).text.trim();
    const parsed = JSON.parse(text);

    const canalRecomendado: Diagnostico['canal_recomendado'] =
      CANAL_MAP[lead.categoria] || 'whatsapp';

    return {
      lead_id: lead.id,
      nome: lead.nome,
      categoria: lead.categoria,
      cidade: lead.cidade,
      telefone: lead.telefone,
      slug: slugify(lead.nome),
      problema_principal: parsed.problema_principal,
      angulo_de_venda: parsed.angulo_de_venda,
      tom_da_abordagem: parsed.tom_da_abordagem,
      canal_recomendado: canalRecomendado,
      proposta_de_valor: parsed.proposta_de_valor,
      landing_page_url: null,
      landing_page_path: null,
      data_diagnostico: today(),
    };
  } catch (err) {
    log.warn(`Diagnóstico mock para ${lead.nome}: ${(err as Error).message}`);
    return mockDiagnostico(lead);
  }
}

function mockDiagnostico(lead: Lead): Diagnostico {
  const canal = CANAL_MAP[lead.categoria] || 'email';
  return {
    lead_id: lead.id,
    nome: lead.nome,
    categoria: lead.categoria,
    cidade: lead.cidade,
    telefone: lead.telefone,
    slug: slugify(lead.nome),
    problema_principal: `${lead.nome} não tem presença digital adequada e perde clientes para concorrentes com site`,
    angulo_de_venda: `Clientes em ${lead.cidade} buscam ${lead.categoria} no Google e não encontram ${lead.nome}`,
    tom_da_abordagem: canal === 'linkedin' ? 'consultivo' : 'amigável e local',
    canal_recomendado: 'whatsapp',
    proposta_de_valor: `Uma landing page profissional pode triplicar os contatos de novos clientes em 30 dias`,
    landing_page_url: null,
    landing_page_path: null,
    data_diagnostico: today(),
  };
}

export async function runAgent2(): Promise<Diagnostico[]> {
  log.info('Agente 2 — Diagnosticador iniciado');

  const leadsFile = dataPath('leads_{data}.json');
  const leads = readJson<Lead[]>(leadsFile);
  if (!leads || leads.length === 0) {
    log.warn('Nenhum lead encontrado para diagnosticar');
    return [];
  }

  const diagFile = dataPath('diagnosticos_{data}.json');
  const existentes = readJson<Diagnostico[]>(diagFile) || [];
  const slugsExistentes = new Set(existentes.map((d) => d.slug));

  // Novos leads sem diagnóstico ainda
  const novos = leads.filter((l) => !slugsExistentes.has(slugify(l.nome)));

  if (novos.length === 0) {
    log.info('Todos os leads já possuem diagnóstico — nada a fazer');
    return existentes;
  }

  log.info(`Diagnosticando ${novos.length} lead(s) novo(s)`);

  const novosDiags: Diagnostico[] = [];
  for (const lead of novos) {
    const diag = await diagnoseLead(lead);
    novosDiags.push(diag);
    log.info(`  ✓ ${lead.nome} → canal: ${diag.canal_recomendado}`);
  }

  const merged = [...existentes, ...novosDiags];
  writeJson(diagFile, merged);

  log.success(`Agente 2 concluído: +${novosDiags.length} diagnóstico(s) → ${diagFile}`);
  return merged;
}

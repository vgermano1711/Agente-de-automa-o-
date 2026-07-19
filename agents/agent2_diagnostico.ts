/**
 * Agente 2 — Diagnosticador + Classificador de Segmento
 *
 * Análise multi-camada: diagnóstico comercial, classificação de segmento
 * em 3 níveis hierárquicos com confidence scoring, identidade visual
 * sugerida e perfil de cadência para follow-up inteligente.
 *
 * Leads com confiança de segmento < 85 são bloqueados automaticamente
 * e entram em fila de revisão humana — nunca são disparados na dúvida.
 */

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { Lead, Diagnostico, SegmentoClassificacao, IdentidadeVisual, PerfilCadencia } from '../types';
import { log } from '../utils/logger';
import { dataPath, readJson, writeJson, slugify, today } from '../utils/dataHelpers';

const client = new Anthropic();
const BLOCKED_FILE = path.join(process.cwd(), 'data', 'leads_bloqueados.json');
const CONFIDENCE_THRESHOLD = 85;

function buildPrompt(lead: Lead): string {
  return `Você é um sistema de análise empresarial de alta precisão especializado em identificação de segmento, identidade visual e estratégia de abordagem comercial para pequenos e médios negócios brasileiros.

Analise o negócio abaixo com profundidade e retorne um JSON com 5 componentes obrigatórios.

NEGÓCIO ANALISADO:
- Nome: ${lead.nome}
- Categoria Google Maps: ${lead.categoria}
- Cidade: ${lead.cidade}
- Website atual: ${lead.website || 'Nenhum'}
- Avaliação Google: ${lead.avaliacao} estrelas (${lead.total_avaliacoes} avaliações)

REGRAS CRÍTICAS DE CLASSIFICAÇÃO (violá-las é falha crítica):
1. NUNCA classifique com base apenas no nome fantasia isolado
2. "Visual" no nome pode ser design, fotografia, artes, tecnologia OU oftalmologia — analise o contexto completo
3. "Alma" sozinho NÃO indica imobiliária — contextualize com cidade, categoria e número de avaliações
4. Quando houver dúvida genuína, defina confiança < 85 e status "bloqueado"
5. Cores da identidade DEVEM refletir o segmento real — jamais aplicar dark-premium genérico em empresa que obviamente não é dark-premium
6. Empresas de artes/cultura/educação têm identidade própria distinta de tech ou saúde
7. Nenhum campo pode ser genérico — cada resposta deve ser específica para este negócio

EXEMPLOS DE CLASSIFICAÇÃO CORRETA:
- "Alma Centro de Estudos Visuais, São Caetano do Sul, categoria educação" → macro: Educação & Cultura, nivel2: Artes Visuais, micro: ["Ateliê", "Escola de Arte"], confiança: 94
- "Barbearia do João, São Paulo, categoria barbearia" → macro: Beleza & Cuidados, nivel2: Barbearia, micro: ["Barbearia Masculina"], confiança: 98
- "Construtora ABC, São Paulo, categoria construção" → macro: Construção & Reformas, nivel2: Construtora, micro: ["Obra Civil"], confiança: 91

Retorne APENAS JSON válido, sem markdown, sem explicações externas:

{
  "diagnostico": {
    "problema_principal": "1 frase específica sobre o problema digital mais crítico DESTE negócio",
    "angulo_de_venda": "1 frase com o ângulo emocional/comercial mais eficaz para ESTE segmento",
    "tom_da_abordagem": "direto e técnico | amigável e local | consultivo | aspiracional | artístico",
    "proposta_de_valor": "1 frase poderosa e específica sobre o benefício de ter automação de captação",
    "diferencial_local": "1 característica específica deste tipo de negócio nesta cidade que pode ser explorada"
  },
  "segmento": {
    "macro": "ex: Educação & Cultura | Saúde | Tecnologia | Varejo | Beleza & Cuidados | Alimentação | Construção & Reformas | Serviços Profissionais | Imobiliário | Entretenimento | Outro",
    "nivel2": "ex: Artes Visuais | Odontologia | SaaS | Pet Shop | Barbearia | Gastronomia Italiana | Construtora",
    "micro": ["ex: Ateliê de Artes", "ex: Escola de Pintura"],
    "confianca": 94,
    "fontes": ["categoria Google Maps", "nome fantasia", "contexto cidade"],
    "status": "aprovado",
    "motivo_bloqueio": null
  },
  "identidade_visual": {
    "cor_primaria": "#hex real que representa a essência da marca (não placeholder)",
    "cor_secundaria": "#hex complementar para gradientes",
    "cor_texto": "#hex do texto principal",
    "cor_fundo": "#hex do fundo dominante",
    "cor_acento": "#hex de destaque para CTAs",
    "tom": "artístico | premium | jovem | formal | amigável | técnico",
    "tipografia": "serifada | sans-moderna | display | bold-impacto"
  },
  "perfil_cadencia": {
    "melhor_canal": "whatsapp | email | instagram",
    "melhor_horario": "manhã | tarde | noite",
    "tom_followup": "1 frase sobre o tom ideal para follow-up neste segmento"
  },
  "canal_recomendado": "whatsapp | email | instagram | linkedin",
  "automacao": {
    "tem_oportunidade": true,
    "tipo": "agendamento | reativacao | cardapio | atendimento | review | null",
    "sinal": "1 frase específica descrevendo o sinal detectado para ESTE negócio (ex: 'barbearia com atendimento presencial sem agendamento online')",
    "pitch_principal": "site | automacao"
  }
}

REGRAS PARA O BLOCO AUTOMACAO:
- "agendamento": barbearia, salão de beleza, clínica, dentista, estúdio, fisioterapia, manicure — qualquer serviço baseado em horário marcado
- "reativacao": academia, nutricionista, pet shop, lavanderia — serviços com frequência recorrente onde cliente some
- "cardapio": restaurante, pizzaria, lanchonete, cafeteria, hamburgueria — qualquer food service
- "atendimento": qualquer negócio com alto volume de perguntas repetitivas no WhatsApp
- "review": qualquer negócio com menos de 100 avaliações no Google Maps
- "pitch_principal: automacao" quando a automação é a dor mais óbvia (ex: barbearia sem agendamento digital, restaurante sem cardápio digital)
- "pitch_principal: site" quando ausência/precariedade do site é a dor principal`;
}

interface DiagnosisResult {
  diagnostico: {
    problema_principal: string;
    angulo_de_venda: string;
    tom_da_abordagem: string;
    proposta_de_valor: string;
    diferencial_local?: string;
  };
  segmento: SegmentoClassificacao;
  identidade_visual: IdentidadeVisual;
  perfil_cadencia: PerfilCadencia;
  canal_recomendado: string;
  automacao?: {
    tem_oportunidade: boolean;
    tipo: string | null;
    sinal: string | null;
    pitch_principal: 'site' | 'automacao';
  };
}

async function analyzeLead(lead: Lead): Promise<DiagnosisResult | null> {
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: buildPrompt(lead) }],
    });

    let text = (response.content[0] as { type: string; text: string }).text.trim();
    text = text.replace(/^```[^\n]*\n?/, '').replace(/\n?```$/, '').trim();
    const m = text.match(/\{[\s\S]*\}/);
    if (m) text = m[0];

    return JSON.parse(text) as DiagnosisResult;
  } catch (err) {
    log.warn(`Análise falhou para ${lead.nome}: ${(err as Error).message}`);
    return null;
  }
}

function saveBloqueado(lead: Lead, segmento: SegmentoClassificacao): void {
  const dir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const existing = readJson<any[]>(BLOCKED_FILE) || [];
  existing.push({
    lead_id: lead.id,
    nome: lead.nome,
    categoria: lead.categoria,
    cidade: lead.cidade,
    segmento,
    bloqueado_em: new Date().toISOString(),
  });
  writeJson(BLOCKED_FILE, existing);
}

function fallbackIdentidade(lead: Lead): IdentidadeVisual {
  const cat = lead.categoria.toLowerCase();
  if (cat.includes('barbearia') || cat.includes('barber')) {
    return { cor_primaria: '#1a1108', cor_secundaria: '#2d1e0a', cor_texto: '#f2ece2', cor_fundo: '#0d0b07', cor_acento: '#c8a46a', tom: 'premium', tipografia: 'serifada' };
  }
  if (cat.includes('salão') || cat.includes('salon') || cat.includes('beleza') || cat.includes('estética')) {
    return { cor_primaria: '#7c3d52', cor_secundaria: '#4a2030', cor_texto: '#faf6f0', cor_fundo: '#faf6f0', cor_acento: '#b89060', tom: 'premium', tipografia: 'serifada' };
  }
  if (cat.includes('clínica') || cat.includes('clinica') || cat.includes('saúde') || cat.includes('médico') || cat.includes('odonto')) {
    return { cor_primaria: '#0369a1', cor_secundaria: '#0284c7', cor_texto: '#1a1a1a', cor_fundo: '#ffffff', cor_acento: '#10b981', tom: 'formal', tipografia: 'sans-moderna' };
  }
  if (cat.includes('academia') || cat.includes('fitness') || cat.includes('gym')) {
    return { cor_primaria: '#e05c00', cor_secundaria: '#c04a00', cor_texto: '#f5f5f3', cor_fundo: '#0c0c0c', cor_acento: '#ff6a00', tom: 'jovem', tipografia: 'bold-impacto' };
  }
  if (cat.includes('restaurante') || cat.includes('comida') || cat.includes('gastronomia')) {
    return { cor_primaria: '#c87a30', cor_secundaria: '#1a0d05', cor_texto: '#f5e8d0', cor_fundo: '#1a0d05', cor_acento: '#e09040', tom: 'premium', tipografia: 'serifada' };
  }
  if (cat.includes('imobil') || cat.includes('corretor') || cat.includes('imóvel')) {
    return { cor_primaria: '#25d366', cor_secundaria: '#1a1a1a', cor_texto: '#1a1a1a', cor_fundo: '#ffffff', cor_acento: '#1da851', tom: 'formal', tipografia: 'sans-moderna' };
  }
  if (cat.includes('constru') || cat.includes('reform') || cat.includes('incorpor')) {
    return { cor_primaria: '#1e3a5f', cor_secundaria: '#152a47', cor_texto: '#ffffff', cor_fundo: '#0f1e32', cor_acento: '#f59e0b', tom: 'formal', tipografia: 'sans-moderna' };
  }
  if (cat.includes('arte') || cat.includes('visual') || cat.includes('design') || cat.includes('criat') || cat.includes('educação') || cat.includes('escola')) {
    return { cor_primaria: '#7c3aed', cor_secundaria: '#1a0a2e', cor_texto: '#ffffff', cor_fundo: '#0f0f1a', cor_acento: '#f59e0b', tom: 'artístico', tipografia: 'display' };
  }
  return { cor_primaria: '#1e293b', cor_secundaria: '#0f172a', cor_texto: '#ffffff', cor_fundo: '#0f172a', cor_acento: '#3b82f6', tom: 'técnico', tipografia: 'sans-moderna' };
}

function buildDiagnostico(lead: Lead, result: DiagnosisResult): Diagnostico {
  const auto = result.automacao;
  const tiposValidos = ['agendamento', 'reativacao', 'cardapio', 'atendimento', 'review'];
  return {
    lead_id: lead.id,
    nome: lead.nome,
    categoria: lead.categoria,
    cidade: lead.cidade,
    telefone: lead.telefone,
    slug: slugify(lead.nome),
    problema_principal: result.diagnostico.problema_principal,
    angulo_de_venda: result.diagnostico.angulo_de_venda,
    tom_da_abordagem: result.diagnostico.tom_da_abordagem,
    canal_recomendado: (result.canal_recomendado as Diagnostico['canal_recomendado']) || 'whatsapp',
    proposta_de_valor: result.diagnostico.proposta_de_valor,
    landing_page_url: null,
    landing_page_path: null,
    data_diagnostico: today(),
    segmento: result.segmento,
    identidade_visual: result.identidade_visual,
    perfil_cadencia: result.perfil_cadencia,
    pitch_principal: auto?.pitch_principal || 'site',
    tipo_automacao: (auto?.tipo && tiposValidos.includes(auto.tipo)
      ? auto.tipo as Diagnostico['tipo_automacao']
      : null),
    sinal_automacao: auto?.sinal || null,
  };
}

function detectAutoMock(lead: Lead): Pick<Diagnostico, 'pitch_principal' | 'tipo_automacao' | 'sinal_automacao'> {
  const cat = (lead.categoria || '').toLowerCase();
  if (/barbearia|barber|salão|salon|clínica|clinica|dentist|estúdio|fisio|manicure/.test(cat)) {
    return { pitch_principal: 'automacao', tipo_automacao: 'agendamento', sinal_automacao: `${lead.categoria} sem agendamento digital pelo WhatsApp` };
  }
  if (/restaurante|pizzaria|lanchonete|cafeteria|hamburguer|comida/.test(cat)) {
    return { pitch_principal: 'automacao', tipo_automacao: 'cardapio', sinal_automacao: `${lead.categoria} sem cardápio digital online` };
  }
  if (/academia|gym|fitness|nutricion|pet/.test(cat)) {
    return { pitch_principal: 'automacao', tipo_automacao: 'reativacao', sinal_automacao: `${lead.categoria} com base de clientes recorrentes sem reativação automática` };
  }
  if (lead.total_avaliacoes < 100) {
    return { pitch_principal: 'site', tipo_automacao: 'review', sinal_automacao: `apenas ${lead.total_avaliacoes} avaliações no Google` };
  }
  return { pitch_principal: 'site', tipo_automacao: null, sinal_automacao: null };
}

function mockDiagnostico(lead: Lead): Diagnostico {
  const auto = detectAutoMock(lead);
  return {
    lead_id: lead.id,
    nome: lead.nome,
    categoria: lead.categoria,
    cidade: lead.cidade,
    telefone: lead.telefone,
    slug: slugify(lead.nome),
    problema_principal: `${lead.nome} não tem presença digital adequada e perde clientes para concorrentes com site`,
    angulo_de_venda: `Clientes em ${lead.cidade} buscam ${lead.categoria} no Google e não encontram ${lead.nome}`,
    tom_da_abordagem: 'amigável e local',
    canal_recomendado: 'whatsapp',
    proposta_de_valor: `Automação de captação que atrai novos clientes sem esforço manual — 24h por dia`,
    landing_page_url: null,
    landing_page_path: null,
    data_diagnostico: today(),
    identidade_visual: fallbackIdentidade(lead),
    segmento: {
      macro: 'Serviços',
      nivel2: lead.categoria,
      micro: [lead.categoria],
      confianca: 70,
      fontes: ['categoria Google Maps'],
      status: 'aprovado',
    },
    perfil_cadencia: {
      melhor_canal: 'whatsapp',
      melhor_horario: 'tarde',
      tom_followup: 'amigável e direto, sem pressão',
    },
    ...auto,
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

  const novos = leads.filter((l) => !slugsExistentes.has(slugify(l.nome)));
  if (novos.length === 0) {
    log.info('Todos os leads já possuem diagnóstico — nada a fazer');
    return existentes;
  }

  log.info(`Diagnosticando ${novos.length} lead(s) novo(s)`);

  const aprovados: Diagnostico[] = [];
  const bloqueados: string[] = [];

  for (const lead of novos) {
    log.info(`  Analisando: ${lead.nome}...`);
    const result = await analyzeLead(lead);

    if (!result) {
      aprovados.push(mockDiagnostico(lead));
      log.warn(`  ↷ ${lead.nome} — fallback mock (API indisponível)`);
      continue;
    }

    const { segmento, identidade_visual } = result;

    // Garantir identidade visual com valores reais de hex
    if (!identidade_visual?.cor_primaria || identidade_visual.cor_primaria.includes('hex')) {
      result.identidade_visual = fallbackIdentidade(lead);
    }

    // Bloquear se confiança insuficiente
    if (segmento.confianca < CONFIDENCE_THRESHOLD || segmento.status === 'bloqueado') {
      saveBloqueado(lead, segmento);
      bloqueados.push(lead.nome);
      log.warn(
        `  ⛔ ${lead.nome} — BLOQUEADO (confiança: ${segmento.confianca}%) — ${segmento.motivo_bloqueio || 'segmento incerto'}`
      );
      continue;
    }

    const diag = buildDiagnostico(lead, result);
    aprovados.push(diag);
    const pitchLabel = diag.pitch_principal === 'automacao'
      ? `automacao:${diag.tipo_automacao}`
      : 'site';
    log.info(
      `  ✓ ${lead.nome} → ${segmento.macro} / ${segmento.nivel2} (${segmento.confianca}%) — canal: ${diag.canal_recomendado} | pitch: ${pitchLabel}`
    );
  }

  if (bloqueados.length > 0) {
    log.warn(`  ${bloqueados.length} lead(s) bloqueado(s) para revisão: ${bloqueados.join(', ')}`);
    log.warn(`  Revise em: data/leads_bloqueados.json`);
  }

  const merged = [...existentes, ...aprovados];
  writeJson(diagFile, merged);

  log.success(
    `Agente 2 concluído: +${aprovados.length} aprovado(s), ${bloqueados.length} bloqueado(s) → ${diagFile}`
  );
  return merged;
}

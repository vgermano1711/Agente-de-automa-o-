/**
 * Agente 1 — Prospector
 * Varre cidades-alvo via Google Places API, filtra negócios sem site ou com site antigo,
 * deduplicados contra prospectados.json, e salva leads_{data}.json.
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { Lead } from '../types';
import { log } from '../utils/logger';
import { dataPath, readJson, writeJson, slugify, generateId, today } from '../utils/dataHelpers';

const PROSPECTADOS_FILE    = path.join(process.cwd(), 'data', 'prospectados.json');
const HISTORICO_FILE       = path.join(process.cwd(), 'data', 'historico_acionados.json');
const ROTATION_FILE        = path.join(process.cwd(), 'data', 'rotation_state.json');
const PLACES_API           = 'https://maps.googleapis.com/maps/api/place';
const COMBINACOES_POR_DIA  = 50; // ~$5/dia, dentro do crédito gratuito de $200/mês

interface HistoricoEntry {
  place_id: string;
  slug: string;
  nome: string;
  telefone: string;
  cidade: string;
  segmento: string;
  avaliacao: number | null;
  data_acionamento: string;
  status_cadencia: string;
  etapa_cadencia: number | null;
  respondeu: boolean;
  estagio_conversa: string | null;
}

interface RotationState {
  ordem: string[];   // combinações embaralhadas "cidade||segmento"
  indice: number;    // próxima combinação a processar
}

function loadRotation(cidades: string[], segmentos: string[]): RotationState {
  const existing = readJson<RotationState>(ROTATION_FILE);
  const totalEsperado = cidades.length * segmentos.length;

  // Recria se não existe, incompleto ou lista de cidades/segmentos mudou
  if (!existing || existing.ordem.length !== totalEsperado) {
    const todas: string[] = [];
    for (const c of cidades) for (const s of segmentos) todas.push(`${c}||${s}`);
    // Fisher-Yates shuffle
    for (let i = todas.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [todas[i], todas[j]] = [todas[j], todas[i]];
    }
    const state: RotationState = { ordem: todas, indice: 0 };
    writeJson(ROTATION_FILE, state);
    return state;
  }
  return existing;
}

function nextCombinations(state: RotationState, n: number): Array<{ cidade: string; segmento: string }> {
  const result: Array<{ cidade: string; segmento: string }> = [];
  const total = state.ordem.length;
  for (let i = 0; i < n; i++) {
    const idx = (state.indice + i) % total;
    const [cidade, segmento] = state.ordem[idx].split('||');
    result.push({ cidade, segmento });
  }
  state.indice = (state.indice + n) % total;
  writeJson(ROTATION_FILE, state);
  return result;
}

function loadProspectados(): Set<string> {
  const data = readJson<string[]>(PROSPECTADOS_FILE);
  return new Set(data || []);
}

function saveProspectados(ids: Set<string>): void {
  writeJson(PROSPECTADOS_FILE, Array.from(ids));
}

/** Normaliza telefone para apenas dígitos (sem DDI 55) para comparação. */
function normalizePhone(tel: string): string {
  const digits = tel.replace(/\D/g, '');
  return digits.startsWith('55') ? digits.slice(2) : digits;
}

/**
 * Fonte única de verdade: carrega todos os telefones já acionados desde o início.
 * Lê historico_acionados.json (arquivo consolidado) + cadência para garantir cobertura total.
 */
function loadPhonesJaContatados(): Set<string> {
  const phones = new Set<string>();

  // 1. Histórico consolidado — todos os leads de toda a vida do sistema
  const historico = readJson<HistoricoEntry[]>(HISTORICO_FILE) || [];
  for (const h of historico) {
    if (h.telefone) phones.add(normalizePhone(h.telefone));
  }

  // 2. Cadência — garante cobertura de leads novos ainda não no histórico
  const cadencia = readJson<Array<{ telefone?: string }>>(
    path.join(process.cwd(), 'data', 'cadencia.json')
  ) || [];
  for (const c of cadencia) {
    if (c.telefone) phones.add(normalizePhone(c.telefone));
  }

  return phones;
}

/** Registra novos leads no historico_acionados.json para deduplicação futura. */
function registrarNoHistorico(leads: Lead[]): void {
  const historico = readJson<HistoricoEntry[]>(HISTORICO_FILE) || [];
  const existentes = new Set(historico.map((h) => h.place_id).filter(Boolean));
  const existentesPhone = new Set(historico.map((h) => normalizePhone(h.telefone)).filter(Boolean));

  let adicionados = 0;
  for (const l of leads) {
    if (l.google_place_id && existentes.has(l.google_place_id)) continue;
    const ph = normalizePhone(l.telefone || '');
    if (ph && existentesPhone.has(ph)) continue;

    historico.push({
      place_id:        l.google_place_id || '',
      slug:            '',
      nome:            l.nome,
      telefone:        l.telefone || '',
      cidade:          l.cidade,
      segmento:        l.categoria,
      avaliacao:       l.avaliacao ?? null,
      data_acionamento: today(),
      status_cadencia:  'novo',
      etapa_cadencia:   null,
      respondeu:        false,
      estagio_conversa: null,
    });
    if (l.google_place_id) existentes.add(l.google_place_id);
    if (ph) existentesPhone.add(ph);
    adicionados++;
  }

  if (adicionados > 0) {
    writeJson(HISTORICO_FILE, historico);
    log.info(`  Histórico atualizado: +${adicionados} lead(s) registrado(s) (total: ${historico.length})`);
  }
}

async function checkSiteQuality(url: string): Promise<'sem_site' | 'site_antigo' | 'site_ok'> {
  if (!url) return 'sem_site';
  try {
    const resp = await axios.get(url, { timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = resp.data as string;
    const $ = cheerio.load(html);

    const viewportMeta = $('meta[name="viewport"]').attr('content') || '';
    const isMobile = viewportMeta.includes('width=device-width');

    const bodyText = $('body').text();
    const currentYear = new Date().getFullYear();
    const oldYears = [currentYear - 5, currentYear - 4, currentYear - 3].map(String);
    const hasOldYear = oldYears.some((y) => bodyText.includes(y) && !bodyText.includes(String(currentYear)));

    if (!isMobile || hasOldYear) return 'site_antigo';
    return 'site_ok';
  } catch {
    return 'sem_site';
  }
}

async function searchPlaces(
  cidade: string,
  segmento: string,
  apiKey: string,
  prospectados: Set<string>
): Promise<Lead[]> {
  const leads: Lead[] = [];

  try {
    const searchResp = await axios.get(`${PLACES_API}/textsearch/json`, {
      params: {
        query: `${segmento} em ${cidade}`,
        key: apiKey,
        language: 'pt-BR',
      },
    });

    const results = searchResp.data?.results || [];

    // Padrões de nomes que indicam rede/franquia/hospital — alto risco de chatbot
    const CHAIN_PATTERNS = /\b(rede|grupo\s+\w|franquia|filial|matriz|unidade\s+\d|hospital|upa|pronto.socorro|sistema|corporativo|associa[çc][aã]o\s+(dos|de\s+(m[eé]dicos|dentistas)))\b/i;

    // Pré-filtra antes de buscar detalhes (evita requests desnecessários)
    const candidates = (results as Record<string, unknown>[]).slice(0, 10).filter(
      (place) =>
        !prospectados.has(place.place_id as string) &&
        ((place.rating as number) || 0) >= 4.0 &&
        ((place.user_ratings_total as number) || 0) >= 20 &&
        ((place.user_ratings_total as number) || 0) <= 500 &&  // >500 = rede/franquia → bot
        !CHAIN_PATTERNS.test((place.name as string) || '')
    );

    // Busca detalhes + qualidade do site em paralelo para todos os candidatos
    const settled = await Promise.allSettled(
      candidates.map(async (place) => {
        const detailResp = await axios.get(`${PLACES_API}/details/json`, {
          params: {
            place_id: place.place_id,
            fields: 'name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,types',
            key: apiKey,
            language: 'pt-BR',
          },
        });
        const detalhes: Record<string, unknown> = detailResp.data?.result || {};
        const website = (detalhes.website as string) || null;
        const siteStatus = await checkSiteQuality(website || '');
        return { place, detalhes, website, siteStatus };
      })
    );

    for (const result of settled) {
      if (result.status !== 'fulfilled') continue;
      const { place, detalhes, website, siteStatus } = result.value;
      if (siteStatus === 'sem_site') continue; // pivô: prospectar negócios COM site para pitch de automação

      const scoreBase = Math.round(
        (((place.rating as number) - 4) / 1) * 40 +
          (Math.min(place.user_ratings_total as number, 200) / 200) * 30 +
          (siteStatus === 'site_ok' ? 30 : 15)
      );

      const rawTelefone = (detalhes.formatted_phone_number as string) || '';
      const rawDigits = rawTelefone.replace(/\D/g, '');
      const digitos = (rawDigits.length > 11 && rawDigits.startsWith('55'))
        ? rawDigits.slice(2)
        : rawDigits;
      const isCelular = digitos.length === 11 && digitos[2] === '9';
      if (!isCelular) {
        log.info(`  Pulando ${(detalhes.name as string)} — número fixo (${rawTelefone})`);
        continue;
      }

      // Descarta números com auto-resposta de bot já detectada
      const botData = readJson<Record<string, string>>(path.join(process.cwd(), 'data', 'bot_responses.json')) || {};
      if (botData[digitos]) {
        log.info(`  Pulando ${(detalhes.name as string)} — número com bot registrado`);
        continue;
      }

      const lead: Lead = {
        id: generateId(),
        nome: (detalhes.name as string) || (place.name as string),
        endereco: (detalhes.formatted_address as string) || (place.formatted_address as string),
        telefone: rawTelefone,
        categoria: segmento,
        website,
        cidade,
        avaliacao: place.rating as number,
        total_avaliacoes: place.user_ratings_total as number,
        google_place_id: place.place_id as string,
        score_oportunidade: scoreBase,
        data_prospeccao: today(),
      };

      leads.push(lead);
    }
  } catch (err) {
    log.error(`Places API falhou para ${segmento} em ${cidade}: ${(err as Error).message}`);
  }

  return leads;
}

function mockLeads(config: { cidades_alvo: string[]; segmentos: string[] }): Lead[] {
  const negociosMock = [
    { nome: 'Salão da Dona Maria', cat: 'salão de beleza', cidade: config.cidades_alvo[0] },
    { nome: 'Barbearia do Zé', cat: 'barbearia', cidade: config.cidades_alvo[0] },
    { nome: 'Clínica Sorria Mais', cat: 'clínica odontológica', cidade: config.cidades_alvo[1] },
    { nome: 'Construtora Horizonte', cat: 'construtora', cidade: config.cidades_alvo[1] },
    { nome: 'Imóveis Silva & Filhos', cat: 'corretor de imóveis', cidade: config.cidades_alvo[2] },
  ];

  return negociosMock.map((n, i) => ({
    id: generateId(),
    nome: n.nome,
    endereco: `Rua das Flores, ${100 + i * 10} — ${n.cidade}`,
    telefone: `(11) 9${8000 + i}-${1000 + i * 111}`,
    categoria: n.cat,
    website: null,
    cidade: n.cidade,
    avaliacao: 4.2 + i * 0.1,
    total_avaliacoes: 45 + i * 12,
    google_place_id: `mock_place_${i}`,
    score_oportunidade: 75 + i * 4,
    data_prospeccao: today(),
  }));
}

export async function runAgent1(): Promise<Lead[]> {
  log.info('Agente 1 — Prospector iniciado');

  const configRaw = fs.readFileSync(path.join(process.cwd(), 'config.json'), 'utf-8');
  const config = JSON.parse(configRaw);
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const prospectados = loadProspectados();
  const phonesJaContatados = loadPhonesJaContatados();

  let allLeads: Lead[] = [];

  if (!apiKey || apiKey === 'sua_chave_aqui' || apiKey === 'nao_configurado') {
    log.warn('GOOGLE_PLACES_API_KEY não configurada — usando dados mock para desenvolvimento');
    allLeads = mockLeads(config);
  } else {
    // Agenda semanal: usa segmentos e horário do dia da semana se configurado
    let segmentosHoje: string[] = config.segmentos;
    type AgendaDia = { segmentos: string[]; horario: string } | string[];
    const agendaSemanal: Record<string, AgendaDia> | undefined = config.agenda_semanal;
    if (agendaSemanal) {
      const diaSemana = new Date().getDay(); // 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex
      const entrada = agendaSemanal[String(diaSemana)];
      if (entrada) {
        const segs = Array.isArray(entrada) ? entrada : entrada.segmentos;
        if (segs && segs.length > 0) {
          segmentosHoje = segs;
          const nomes = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
          log.info(`  Agenda semanal (${nomes[diaSemana]}): ${segs.join(', ')}`);
        }
      }
    }

    const combinacoesPorDia = Math.min(COMBINACOES_POR_DIA, config.cidades_alvo.length * segmentosHoje.length);
    const rotation = loadRotation(config.cidades_alvo, segmentosHoje);
    const combinacoes = nextCombinations(rotation, combinacoesPorDia);
    log.info(`  Rotação: ${combinacoes.length} combinações hoje (índice ${rotation.indice}/${rotation.ordem.length})`);

    const tasks = combinacoes.map(({ cidade, segmento }) =>
      searchPlaces(cidade, segmento, apiKey, prospectados)
    );
    const results = await Promise.all(tasks);
    allLeads = results.flat();
  }

  // Deduplicar por place_id e filtrar já prospectados
  const vistosId = new Set<string>();
  const vistosPhone = new Set<string>();
  const leadsUnicos = allLeads.filter((l) => {
    if (prospectados.has(l.google_place_id) || vistosId.has(l.google_place_id)) return false;
    const phone = l.telefone ? normalizePhone(l.telefone) : '';
    if (phone && (phonesJaContatados.has(phone) || vistosPhone.has(phone))) return false;
    vistosId.add(l.google_place_id);
    if (phone) vistosPhone.add(phone);
    return true;
  });

  // Top N por score
  const topLeads = leadsUnicos
    .sort((a, b) => b.score_oportunidade - a.score_oportunidade)
    .slice(0, config.leads_por_dia);

  // Salvar
  const leadsFile = dataPath('leads_{data}.json');
  writeJson(leadsFile, topLeads);

  // Registra TODOS os candidatos encontrados (não só top N) para evitar reprocessamento futuro
  leadsUnicos.forEach((l) => prospectados.add(l.google_place_id));
  saveProspectados(prospectados);

  // Atualiza historico_acionados.json com os leads selecionados hoje
  registrarNoHistorico(topLeads);

  log.success(`Agente 1 concluído: ${topLeads.length} leads encontrados → ${leadsFile}`);
  return topLeads;
}

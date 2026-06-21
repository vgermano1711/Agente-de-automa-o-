/**
 * Agente 1 — Prospector
 * Prospecta dois públicos distintos em paralelo:
 *   - leads de SITE: negócios sem site ou com site antigo (WhatsApp)
 *   - leads de AUTOMAÇÃO: negócios com site em setores de serviço intensivo (email/LinkedIn)
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { Lead } from '../types';
import { log } from '../utils/logger';
import { dataPath, readJson, writeJson, generateId, today } from '../utils/dataHelpers';

const PROSPECTADOS_FILE = path.join(process.cwd(), 'data', 'prospectados.json');
const PLACES_API = 'https://maps.googleapis.com/maps/api/place';

function loadProspectados(): Set<string> {
  const data = readJson<string[]>(PROSPECTADOS_FILE);
  return new Set(data || []);
}

function saveProspectados(ids: Set<string>): void {
  writeJson(PROSPECTADOS_FILE, Array.from(ids));
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
  prospectados: Set<string>,
  tipoProduto: 'site' | 'automacao'
): Promise<Lead[]> {
  const leads: Lead[] = [];

  try {
    const searchResp = await axios.get(`${PLACES_API}/textsearch/json`, {
      params: { query: `${segmento} em ${cidade}`, key: apiKey, language: 'pt-BR' },
    });

    const results = searchResp.data?.results || [];

    const candidates = (results as Record<string, unknown>[]).slice(0, 10).filter(
      (place) =>
        !prospectados.has(place.place_id as string) &&
        ((place.rating as number) || 0) >= 4.0 &&
        ((place.user_ratings_total as number) || 0) >= 20
    );

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

      // Leads de SITE: sem site ou com site antigo
      // Leads de AUTOMAÇÃO: já tem site (empresas mais estruturadas)
      if (tipoProduto === 'site' && siteStatus === 'site_ok') continue;
      if (tipoProduto === 'automacao' && siteStatus === 'sem_site') continue;

      const scoreBase = Math.round(
        (((place.rating as number) - 4) / 1) * 40 +
          (Math.min(place.user_ratings_total as number, 200) / 200) * 30 +
          (tipoProduto === 'site'
            ? siteStatus === 'sem_site' ? 30 : 15
            : siteStatus === 'site_ok' ? 30 : 15)
      );

      const rawTelefone = (detalhes.formatted_phone_number as string) || '';
      const rawDigits = rawTelefone.replace(/\D/g, '');
      const digitos = (rawDigits.length > 11 && rawDigits.startsWith('55'))
        ? rawDigits.slice(2)
        : rawDigits;
      const isCelular = digitos.length === 11 && digitos[2] === '9';

      // Leads de site precisam de celular (WhatsApp); automação aceita fixo também (email/LinkedIn)
      if (tipoProduto === 'site' && !isCelular) {
        log.info(`  Pulando ${(detalhes.name as string)} — número fixo (${rawTelefone})`);
        continue;
      }

      leads.push({
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
        tipo_produto: tipoProduto,
      });
    }
  } catch (err) {
    log.error(`Places API falhou para ${segmento} em ${cidade}: ${(err as Error).message}`);
  }

  return leads;
}

function mockLeads(config: { cidades_alvo: string[] }): Lead[] {
  const mockSite = [
    { nome: 'Salão da Dona Maria', cat: 'salão de beleza', cidade: config.cidades_alvo[0] },
    { nome: 'Barbearia do Zé', cat: 'barbearia', cidade: config.cidades_alvo[0] },
    { nome: 'Clínica Sorria Mais', cat: 'clínica odontológica', cidade: config.cidades_alvo[1] },
    { nome: 'Pet Shop Amigo Fiel', cat: 'pet shop', cidade: config.cidades_alvo[1] },
    { nome: 'Academia Força Total', cat: 'academia de ginástica', cidade: config.cidades_alvo[2] },
  ];

  const mockAutomacao = [
    { nome: 'Agência Impulso Digital', cat: 'agência de marketing', cidade: config.cidades_alvo[0] },
    { nome: 'Imobiliária Lar Certo', cat: 'imobiliária', cidade: config.cidades_alvo[0] },
    { nome: 'Advocacia & Silva', cat: 'escritório de advocacia', cidade: config.cidades_alvo[1] },
    { nome: 'Contabilidade Precisa', cat: 'contabilidade', cidade: config.cidades_alvo[2] },
    { nome: 'Escola Saber Mais', cat: 'escola particular', cidade: config.cidades_alvo[2] },
  ];

  const leadesSite: Lead[] = mockSite.map((n, i) => ({
    id: generateId(),
    nome: n.nome,
    endereco: `Rua das Flores, ${100 + i * 10} — ${n.cidade}`,
    telefone: `(11) 9${8000 + i}-${1000 + i * 111}`,
    categoria: n.cat,
    website: null,
    cidade: n.cidade,
    avaliacao: 4.2 + i * 0.1,
    total_avaliacoes: 45 + i * 12,
    google_place_id: `mock_site_${i}`,
    score_oportunidade: 75 + i * 4,
    data_prospeccao: today(),
    tipo_produto: 'site',
  }));

  const leadsAutomacao: Lead[] = mockAutomacao.map((n, i) => ({
    id: generateId(),
    nome: n.nome,
    endereco: `Av. Paulista, ${200 + i * 10} — ${n.cidade}`,
    telefone: `(11) 3${5000 + i}-${2000 + i * 111}`,
    categoria: n.cat,
    website: `https://www.${n.nome.toLowerCase().replace(/\s/g, '')}.com.br`,
    cidade: n.cidade,
    avaliacao: 4.3 + i * 0.1,
    total_avaliacoes: 80 + i * 20,
    google_place_id: `mock_auto_${i}`,
    score_oportunidade: 70 + i * 5,
    data_prospeccao: today(),
    tipo_produto: 'automacao',
  }));

  return [...leadesSite, ...leadsAutomacao];
}

export async function runAgent1(): Promise<Lead[]> {
  log.info('Agente 1 — Prospector iniciado (site + automação)');

  const configRaw = fs.readFileSync(path.join(process.cwd(), 'config.json'), 'utf-8');
  const config = JSON.parse(configRaw);
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const prospectados = loadProspectados();

  let allLeads: Lead[] = [];

  if (!apiKey || apiKey === 'sua_chave_aqui' || apiKey === 'nao_configurado') {
    log.warn('GOOGLE_PLACES_API_KEY não configurada — usando dados mock para desenvolvimento');
    allLeads = mockLeads(config);
  } else {
    const tasks: Promise<Lead[]>[] = [];

    // Prospecta leads de SITE
    for (const cidade of config.cidades_alvo) {
      for (const segmento of (config.segmentos_site || [])) {
        tasks.push(searchPlaces(cidade, segmento, apiKey, prospectados, 'site'));
      }
    }

    // Prospecta leads de AUTOMAÇÃO
    for (const cidade of config.cidades_alvo) {
      for (const segmento of (config.segmentos_automacao || [])) {
        tasks.push(searchPlaces(cidade, segmento, apiKey, prospectados, 'automacao'));
      }
    }

    const results = await Promise.all(tasks);
    allLeads = results.flat();
  }

  // Deduplicar por place_id
  const vistos = new Set<string>();
  const leadsUnicos = allLeads.filter((l) => {
    if (prospectados.has(l.google_place_id) || vistos.has(l.google_place_id)) return false;
    vistos.add(l.google_place_id);
    return true;
  });

  // Top N por tipo, ordenados por score
  const topSite = leadsUnicos
    .filter((l) => l.tipo_produto === 'site')
    .sort((a, b) => b.score_oportunidade - a.score_oportunidade)
    .slice(0, config.leads_por_dia_site || 10);

  const topAutomacao = leadsUnicos
    .filter((l) => l.tipo_produto === 'automacao')
    .sort((a, b) => b.score_oportunidade - a.score_oportunidade)
    .slice(0, config.leads_por_dia_automacao || 5);

  const topLeads = [...topSite, ...topAutomacao];

  const leadsFile = dataPath('leads_{data}.json');
  writeJson(leadsFile, topLeads);

  topLeads.forEach((l) => prospectados.add(l.google_place_id));
  saveProspectados(prospectados);

  log.success(`Agente 1 concluído: ${topSite.length} leads de site + ${topAutomacao.length} leads de automação → ${leadsFile}`);
  return topLeads;
}

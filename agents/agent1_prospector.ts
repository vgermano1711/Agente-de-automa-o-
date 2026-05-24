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

    for (const place of results.slice(0, 10)) {
      if (prospectados.has(place.place_id)) continue;
      if ((place.rating || 0) < 4.0) continue;
      if ((place.user_ratings_total || 0) < 20) continue;

      let detalhes: Record<string, unknown> = {};
      try {
        const detailResp = await axios.get(`${PLACES_API}/details/json`, {
          params: {
            place_id: place.place_id,
            fields: 'name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,types',
            key: apiKey,
            language: 'pt-BR',
          },
        });
        detalhes = detailResp.data?.result || {};
      } catch {
        continue;
      }

      const website = (detalhes.website as string) || null;
      const siteStatus = await checkSiteQuality(website || '');
      if (siteStatus === 'site_ok') continue;

      const scoreBase = Math.round(
        ((place.rating - 4) / 1) * 40 +
          (Math.min(place.user_ratings_total, 200) / 200) * 30 +
          (siteStatus === 'sem_site' ? 30 : 15)
      );

      const telefone = (detalhes.formatted_phone_number as string) || '';
      // Filtra fixos: celular BR tem 9 dígitos após DDD e começa com 9
      const digitos = telefone.replace(/\D/g, '');
      const isCelular = digitos.length >= 11 && digitos[2] === '9';
      if (!isCelular) {
        log.info(`  Pulando ${detalhes.name as string} — número fixo (${telefone})`);
        continue;
      }

      const lead: Lead = {
        id: generateId(),
        nome: detalhes.name as string || place.name,
        endereco: detalhes.formatted_address as string || place.formatted_address,
        telefone,
        categoria: segmento,
        website,
        cidade,
        avaliacao: place.rating,
        total_avaliacoes: place.user_ratings_total,
        google_place_id: place.place_id,
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

  let allLeads: Lead[] = [];

  if (!apiKey || apiKey === 'sua_chave_aqui' || apiKey === 'nao_configurado') {
    log.warn('GOOGLE_PLACES_API_KEY não configurada — usando dados mock para desenvolvimento');
    allLeads = mockLeads(config);
  } else {
    const tasks: Promise<Lead[]>[] = [];
    for (const cidade of config.cidades_alvo) {
      for (const segmento of config.segmentos) {
        tasks.push(searchPlaces(cidade, segmento, apiKey, prospectados));
      }
    }
    const results = await Promise.all(tasks);
    allLeads = results.flat();
  }

  // Deduplicar por place_id e filtrar já prospectados
  const vistos = new Set<string>();
  const leadsUnicos = allLeads.filter((l) => {
    if (prospectados.has(l.google_place_id) || vistos.has(l.google_place_id)) return false;
    vistos.add(l.google_place_id);
    return true;
  });

  // Top N por score
  const topLeads = leadsUnicos
    .sort((a, b) => b.score_oportunidade - a.score_oportunidade)
    .slice(0, config.leads_por_dia);

  // Salvar
  const leadsFile = dataPath('leads_{data}.json');
  writeJson(leadsFile, topLeads);

  // Atualizar prospectados
  topLeads.forEach((l) => prospectados.add(l.google_place_id));
  saveProspectados(prospectados);

  log.success(`Agente 1 concluído: ${topLeads.length} leads encontrados → ${leadsFile}`);
  return topLeads;
}

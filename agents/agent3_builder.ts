/**
 * Agente 3 — Builder de Landing Page
 * Usa templates premium por segmento (regenerar-pages.ts) para gerar HTML,
 * salva em /pages/{slug}/index.html, faz deploy no Surge.sh e atualiza diagnosticos.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { Diagnostico } from '../types';
import { log } from '../utils/logger';
import { dataPath, readJson, writeJson } from '../utils/dataHelpers';
import { generateContent, buildHTML } from '../regenerar-pages';

async function generatePageHTML(diag: Diagnostico): Promise<string> {
  const content = await generateContent(diag);
  return buildHTML(diag, content);
}

function deployToSurge(slug: string, sitePath: string): string | null {
  const login = process.env.SURGE_LOGIN;
  const token = process.env.SURGE_TOKEN;
  const prefix = process.env.SURGE_PREFIX || 'sales-bot-';

  if (!token || !login) {
    log.warn('SURGE_LOGIN/SURGE_TOKEN não configurados — pulando deploy');
    return null;
  }

  const subdomain = `${prefix}${slug}`.slice(0, 63);
  const domain = `${subdomain}.surge.sh`;

  try {
    execSync(`npx surge "${sitePath}" ${domain}`, {
      env: { ...process.env, SURGE_LOGIN: login, SURGE_TOKEN: token },
      stdio: 'pipe',
    });
    return `https://${domain}`;
  } catch (err: any) {
    log.error(`Surge deploy falhou para ${slug}: ${err.stderr?.toString() || (err as Error).message}`);
    return null;
  }
}

export async function runAgent3(): Promise<Diagnostico[]> {
  log.info('Agente 3 — Builder de Landing Page iniciado');

  const diagFile = dataPath('diagnosticos_{data}.json');
  const diagnosticos = readJson<Diagnostico[]>(diagFile);
  if (!diagnosticos || diagnosticos.length === 0) {
    log.warn('Nenhum diagnóstico para processar');
    return [];
  }

  const pagesDir = path.join(process.cwd(), 'pages');
  if (!fs.existsSync(pagesDir)) fs.mkdirSync(pagesDir, { recursive: true });

  for (const diag of diagnosticos) {
    const pageDir = path.join(pagesDir, diag.slug);
    const pageFile = path.join(pageDir, 'index.html');

    // Pula só se a página existe E já tem URL válida (não Netlify, não localhost)
    const urlValida = diag.landing_page_url &&
      !diag.landing_page_url.includes('netlify') &&
      !diag.landing_page_url.startsWith('http://localhost');
    if (fs.existsSync(pageFile) && urlValida) {
      log.info(`  ↷ ${diag.nome} — página já existe, pulando`);
      continue;
    }

    if (!fs.existsSync(pageDir)) fs.mkdirSync(pageDir, { recursive: true });

    log.info(`  Gerando landing page para ${diag.nome}...`);

    const html = await generatePageHTML(diag);
    fs.writeFileSync(pageFile, html);
    diag.landing_page_path = pageFile;

    const deployedUrl = deployToSurge(diag.slug, pageDir);
    diag.landing_page_url = deployedUrl || `http://localhost:3000/pages/${diag.slug}`;

    log.info(`  ✓ ${diag.nome} → ${diag.landing_page_url}`);
  }

  writeJson(diagFile, diagnosticos);
  log.success(`Agente 3 concluído: ${diagnosticos.length} landing pages geradas`);
  return diagnosticos;
}

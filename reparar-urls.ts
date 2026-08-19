/**
 * Repara URLs locais/expiradas nas mensagens: faz deploy no Surge.sh e atualiza os JSONs.
 */
import 'dotenv/config';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const TODAY = new Date().toISOString().slice(0, 10);
const DATA_DIR = path.join(process.cwd(), 'data');
const PAGES_DIR = path.join(process.cwd(), 'pages');

function deployToSurge(slug: string): string | null {
  const login = process.env.SURGE_LOGIN;
  const token = process.env.SURGE_TOKEN;
  const prefix = process.env.SURGE_PREFIX || 'sales-bot-';

  if (!token || !login) { console.error('SURGE_LOGIN/SURGE_TOKEN não configurados'); return null; }

  const pageDir = path.join(PAGES_DIR, slug);
  if (!fs.existsSync(path.join(pageDir, 'index.html'))) {
    console.warn(`  Página não encontrada: ${slug}`);
    return null;
  }

  const subdomain = `${prefix}${slug}`.slice(0, 63);
  const domain = `${subdomain}.surge.sh`;

  try {
    execSync(`npx surge "${pageDir}" ${domain}`, {
      env: { ...process.env, SURGE_LOGIN: login, SURGE_TOKEN: token },
      stdio: 'pipe',
    });
    return `https://${domain}`;
  } catch (err: any) {
    console.error(`  Surge falhou para ${slug}: ${err.stderr?.toString() || err.message}`);
    return null;
  }
}

function isDeadUrl(url: string): boolean {
  if (!url) return true;
  if (url.startsWith('http://localhost')) return true;
  if (url.includes('trycloudflare.com')) return true;
  return false;
}

async function main() {
  const msgFile = path.join(DATA_DIR, `mensagens_${TODAY}.json`);
  const diagFile = path.join(DATA_DIR, `diagnosticos_${TODAY}.json`);

  if (!fs.existsSync(msgFile)) { console.error(`Arquivo não encontrado: ${msgFile}`); process.exit(1); }

  const mensagens = JSON.parse(fs.readFileSync(msgFile, 'utf-8'));
  const diagnosticos = fs.existsSync(diagFile) ? JSON.parse(fs.readFileSync(diagFile, 'utf-8')) : [];

  const paraCorrigir = mensagens.filter((m: any) => isDeadUrl(m.landing_page_url));
  console.log(`\n${paraCorrigir.length} mensagens com URL morta para corrigir.\n`);

  for (const msg of paraCorrigir) {
    console.log(`⏳ Deployando: ${msg.nome_negocio}`);
    const url = deployToSurge(msg.slug);
    if (!url) { console.warn(`  ✗ Pulando ${msg.slug}\n`); continue; }

    console.log(`  ✓ ${url}\n`);

    const oldUrl = msg.landing_page_url;
    msg.landing_page_url = url;
    if (oldUrl && msg.corpo) msg.corpo = msg.corpo.split(oldUrl).join(url);

    const diag = diagnosticos.find((d: any) => d.slug === msg.slug);
    if (diag) diag.landing_page_url = url;
  }

  fs.writeFileSync(msgFile, JSON.stringify(mensagens, null, 2));
  if (diagnosticos.length) fs.writeFileSync(diagFile, JSON.stringify(diagnosticos, null, 2));
  console.log('✅ Arquivos atualizados com URLs do Surge.sh.');
}

main();

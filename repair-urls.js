/**
 * repair-urls.js — Corrige URLs Netlify mortas nos arquivos de dados
 * As URLs netlify.app expiram após o plano gratuito esgotar.
 * Substitui por localhost ou null dependendo se a página local existe.
 *
 * Uso: node repair-urls.js
 */

const fs   = require('fs');
const path = require('path');

const DATA_DIR  = path.join(__dirname, 'data');
const PAGES_DIR = path.join(__dirname, 'pages');
const BASE_URL  = 'http://localhost:3000';

if (!fs.existsSync(DATA_DIR)) {
  console.log('Diretório data/ não encontrado — nada a reparar.');
  process.exit(0);
}

function localExists(slug) {
  return fs.existsSync(path.join(PAGES_DIR, slug, 'index.html'));
}

function localUrl(slug) {
  return `${BASE_URL}/pages/${slug}`;
}

function isNetlify(url) {
  return typeof url === 'string' && url.includes('netlify');
}

let totalDiag = 0;
let totalMsg  = 0;

// ── 1. Diagnósticos ───────────────────────────────────────────────────────────
const diagFiles = fs.readdirSync(DATA_DIR)
  .filter(f => /^diagnosticos_\d{4}-\d{2}-\d{2}\.json$/.test(f))
  .sort();

for (const fname of diagFiles) {
  const fpath = path.join(DATA_DIR, fname);
  let diags;
  try { diags = JSON.parse(fs.readFileSync(fpath, 'utf-8')); } catch { continue; }
  if (!Array.isArray(diags)) continue;

  let changed = 0;
  for (const diag of diags) {
    if (!isNetlify(diag.landing_page_url)) continue;
    diag.landing_page_url = localExists(diag.slug) ? localUrl(diag.slug) : null;
    changed++;
  }

  if (changed > 0) {
    fs.writeFileSync(fpath, JSON.stringify(diags, null, 2));
    console.log(`  [diag] ${fname}: ${changed} URL(s) corrigida(s)`);
    totalDiag += changed;
  }
}

// ── 2. Mensagens ──────────────────────────────────────────────────────────────
const msgFiles = fs.readdirSync(DATA_DIR)
  .filter(f => /^mensagens_\d{4}-\d{2}-\d{2}\.json$/.test(f))
  .sort();

for (const fname of msgFiles) {
  const fpath = path.join(DATA_DIR, fname);
  let msgs;
  try { msgs = JSON.parse(fs.readFileSync(fpath, 'utf-8')); } catch { continue; }
  if (!Array.isArray(msgs)) continue;

  let changed = 0;
  for (const msg of msgs) {
    if (!isNetlify(msg.landing_page_url)) continue;

    const oldUrl = msg.landing_page_url;
    const newUrl = localUrl(msg.slug);

    msg.landing_page_url = newUrl;

    // Substitui também dentro do corpo da mensagem
    if (typeof msg.corpo === 'string' && msg.corpo.includes(oldUrl)) {
      msg.corpo = msg.corpo.split(oldUrl).join(newUrl);
    }

    changed++;
  }

  if (changed > 0) {
    fs.writeFileSync(fpath, JSON.stringify(msgs, null, 2));
    console.log(`  [msg]  ${fname}: ${changed} URL(s) corrigida(s)`);
    totalMsg += changed;
  }
}

// ── Relatório ─────────────────────────────────────────────────────────────────
if (totalDiag === 0 && totalMsg === 0) {
  console.log('Nenhuma URL Netlify encontrada — dados já estão corretos.');
} else {
  console.log(`\nReparo concluído: ${totalDiag} diagnóstico(s) e ${totalMsg} mensagem(ns) corrigidos.`);
}

/**
 * tirar-prints.ts
 * Tira prints automáticos do repositório GitHub e do painel local para LinkedIn.
 * Uso: npx ts-node tirar-prints.ts
 */

import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

const OUT_DIR = path.join(process.cwd(), 'prints-linkedin');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

const GITHUB_URL = 'https://github.com/vgermano1711/agente-de-automacao/tree/claude/multi-agent-sales-system-bKKdb';
const LOCAL_PANEL = 'http://localhost:3000';

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('\n📸 Iniciando capturas para LinkedIn...\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1400, height: 900 },
  });

  const page = await browser.newPage();

  // 1. README do GitHub
  console.log('1/5 — Capturando README do GitHub...');
  await page.goto(GITHUB_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(3000);
  await page.screenshot({
    path: path.join(OUT_DIR, '1-readme-github.png'),
    fullPage: false,
    clip: { x: 0, y: 0, width: 1400, height: 900 },
  });
  console.log('   ✅ 1-readme-github.png');

  // 2. README com scroll para ver o diagrama
  console.log('2/5 — Capturando diagrama de arquitetura...');
  await page.evaluate(() => window.scrollBy(0, 600));
  await sleep(500);
  await page.screenshot({
    path: path.join(OUT_DIR, '2-diagrama-arquitetura.png'),
    fullPage: false,
    clip: { x: 0, y: 0, width: 1400, height: 900 },
  });
  console.log('   ✅ 2-diagrama-arquitetura.png');

  // 3. Estrutura de arquivos do repositório
  console.log('3/5 — Capturando estrutura de arquivos...');
  await page.goto(GITHUB_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(2000);
  // rola para o topo para pegar o file tree
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(500);
  await page.screenshot({
    path: path.join(OUT_DIR, '3-estrutura-arquivos.png'),
    fullPage: false,
    clip: { x: 0, y: 0, width: 1400, height: 900 },
  });
  console.log('   ✅ 3-estrutura-arquivos.png');

  // 4. Agents folder no GitHub
  console.log('4/5 — Capturando pasta agents...');
  await page.goto(
    'https://github.com/vgermano1711/agente-de-automacao/tree/claude/multi-agent-sales-system-bKKdb/agents',
    { waitUntil: 'networkidle2', timeout: 30000 }
  );
  await sleep(2000);
  await page.screenshot({
    path: path.join(OUT_DIR, '4-agents-folder.png'),
    fullPage: false,
    clip: { x: 0, y: 0, width: 1400, height: 900 },
  });
  console.log('   ✅ 4-agents-folder.png');

  // 5. Painel de aprovação local
  console.log('5/5 — Capturando painel de aprovação local...');
  try {
    await page.goto(LOCAL_PANEL, { waitUntil: 'networkidle2', timeout: 10000 });
    await sleep(2000);
    await page.screenshot({
      path: path.join(OUT_DIR, '5-painel-aprovacao.png'),
      fullPage: false,
      clip: { x: 0, y: 0, width: 1400, height: 900 },
    });
    console.log('   ✅ 5-painel-aprovacao.png');
  } catch {
    console.log('   ⚠️  Servidor local não está rodando — pulando painel de aprovação');
  }

  await browser.close();

  console.log(`\n✅ Prints salvos em: ${OUT_DIR}\n`);
  console.log('Arquivos gerados:');
  fs.readdirSync(OUT_DIR).forEach((f) => console.log(`  📸 ${f}`));
  console.log('\nDica para LinkedIn: use os prints 1, 2 e 5 para um carrossel de destaque.');
}

main().catch((err) => {
  console.error('Erro:', err.message);
  process.exit(1);
});

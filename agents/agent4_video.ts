/**
 * Agente 4 — Criador de Vídeo de Prévia
 *
 * Estratégia: tira um screenshot full-page da landing page (via Puppeteer) e usa ffmpeg
 * para criar um vídeo de scroll suave de 12s — simula alguém navegando no celular.
 *
 * Fixes críticos vs versão anterior:
 *  - usa pathToFileURL() para URLs file:// corretas no Windows (C:\... → file:///C:/...)
 *  - bloqueia Google Fonts para evitar que networkidle0 congele
 *  - injeta fallback fonts para garantir que o texto seja visível sempre
 *  - ffmpeg sem fontfile hardcoded (cross-platform, sem depender de Arial no Windows)
 *  - screenshot full-page + scroll animation = preview profissional e autêntico
 */

import puppeteer from 'puppeteer';
import { pathToFileURL } from 'url';
import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { Diagnostico } from '../types';
import { log } from '../utils/logger';
import { dataPath, readJson } from '../utils/dataHelpers';

// Viewport mobile padrão (iPhone 14 Pro)
const VIEWPORT_W = 390;
const VIEWPORT_H = 844;
const SCALE      = 2;   // deviceScaleFactor → imagem nativa 780×1688+

async function takeFullPageScreenshot(diag: Diagnostico): Promise<string | null> {
  const pageFile = diag.landing_page_path;
  if (!pageFile || !fs.existsSync(pageFile)) {
    log.warn(`  ⚠ Página não encontrada para ${diag.nome}: ${pageFile}`);
    return null;
  }

  const tmpDir = path.join(process.cwd(), 'videos', 'tmp', diag.slug);
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  // pathToFileURL gera URL correta em qualquer OS:
  //   Windows: C:\Users\... → file:///C:/Users/...
  //   Linux:   /home/...    → file:///home/...
  const fileUrl = pathToFileURL(pageFile).href;
  const outputPng = path.join(tmpDir, 'fullpage.png');

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--ignore-certificate-errors',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: VIEWPORT_W, height: VIEWPORT_H, deviceScaleFactor: SCALE });

    // Bloqueia Google Fonts: sem isso networkidle0 pode travar esperando CDN externa
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(fileUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

    // Deixa CSS e animações terminarem
    await new Promise((r) => setTimeout(r, 2000));

    // Injeta fontes web-safe como fallback (garante que o texto seja visível mesmo sem Google Fonts)
    await page.addStyleTag({
      content: `
        @font-face { font-family: 'Playfair Display'; src: local('Georgia'); }
        @font-face { font-family: 'Cormorant Garamond'; src: local('Georgia'); }
        @font-face { font-family: 'Inter'; src: local('Arial'); }
      `,
    });

    // Aguarda qualquer reflow depois do style inject
    await new Promise((r) => setTimeout(r, 500));

    // Screenshot full-page → imagem alta (tipicamente 780 × 5000-8000 px)
    await page.screenshot({ path: outputPng, fullPage: true });

    log.info(`    Screenshot: ${outputPng}`);
    return outputPng;
  } catch (err) {
    log.error(`Puppeteer falhou para ${diag.nome}: ${(err as Error).message}`);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

function ffmpegAvailable(): boolean {
  try { execSync('ffmpeg -version', { stdio: 'ignore' }); return true; }
  catch { return false; }
}

function getImageHeight(imgPath: string): number {
  try {
    const result = spawnSync('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=height',
      '-of', 'csv=p=0',
      imgPath,
    ], { encoding: 'utf-8', timeout: 10000 });
    return parseInt(result.stdout?.trim() || '0', 10) || 0;
  } catch {
    return 0;
  }
}

function createScrollVideo(diag: Diagnostico, screenshotPath: string): string | null {
  const videosDir = path.join(process.cwd(), 'videos');
  if (!fs.existsSync(videosDir)) fs.mkdirSync(videosDir, { recursive: true });

  const outputPath = path.join(videosDir, `${diag.slug}.mp4`);

  if (!ffmpegAvailable()) {
    log.warn(`ffmpeg não encontrado — instale com: apt install ffmpeg (Linux) ou scoop install ffmpeg (Windows)`);
    return null;
  }

  const imgH    = getImageHeight(screenshotPath);
  const nativeH = VIEWPORT_H * SCALE; // 1688 px
  const nativeW = VIEWPORT_W * SCALE; // 780 px

  const duration  = 12;
  const scrollPx  = Math.max(imgH - nativeH, 0);

  // filtro de scroll: desloca y de 0 → scrollPx durante 'duration' segundos
  // se a página for curta (scrollPx=0) apenas exibe a viewport sem mover
  const scrollExpr = scrollPx > 0
    ? `min(t/${duration}*${scrollPx}\\,${scrollPx})`
    : '0';

  const vf = [
    // 1. Garante largura nativa (no caso de screenshot com escala diferente)
    `scale=${nativeW}:-2`,
    // 2. Janela deslizante — simula scroll
    `crop=${nativeW}:${nativeH}:0:'${scrollExpr}'`,
    // 3. Reduz para tamanho de exibição 390×844
    `scale=${VIEWPORT_W}:${VIEWPORT_H}`,
    // 4. Fade in/out suave
    `fade=t=in:st=0:d=0.8`,
    `fade=t=out:st=${duration - 0.8}:d=0.8`,
  ].join(',');

  const result = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-loop', '1',
      '-framerate', '30',
      '-i', screenshotPath,
      '-vf', vf,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-t', String(duration),
      '-movflags', '+faststart',
      outputPath,
    ],
    { encoding: 'utf-8', timeout: 120000 }
  );

  if (result.status !== 0) {
    log.error(`ffmpeg erro para ${diag.nome}:\n${result.stderr?.slice(-800)}`);
    return null;
  }

  return outputPath;
}

export async function runAgent4(): Promise<void> {
  log.info('Agente 4 — Criador de Vídeo iniciado');

  const diagFile = dataPath('diagnosticos_{data}.json');
  const diagnosticos = readJson<Diagnostico[]>(diagFile);
  if (!diagnosticos || diagnosticos.length === 0) {
    log.warn('Nenhum diagnóstico para processar');
    return;
  }

  for (const diag of diagnosticos) {
    if (!diag.landing_page_path) {
      log.warn(`  ↷ ${diag.nome} — sem landing_page_path, pulando`);
      continue;
    }
    if (!fs.existsSync(diag.landing_page_path)) {
      log.warn(`  ↷ ${diag.nome} — arquivo não encontrado: ${diag.landing_page_path}`);
      continue;
    }

    log.info(`  Gerando vídeo para ${diag.nome}...`);

    const screenshotPath = await takeFullPageScreenshot(diag);
    if (!screenshotPath) continue;

    const videoPath = createScrollVideo(diag, screenshotPath);

    if (videoPath) {
      const sizeMb = (fs.statSync(videoPath).size / 1024 / 1024).toFixed(1);
      log.info(`  ✓ ${diag.nome} → ${videoPath} (${sizeMb} MB)`);
    } else {
      log.warn(`  ⚠ Vídeo não gerado para ${diag.nome}`);
    }
  }

  log.success('Agente 4 concluído');
}

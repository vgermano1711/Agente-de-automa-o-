/**
 * Agente 4 — Criador de Vídeo de Prévia
 * Usa Puppeteer para screenshots mobile, combina com ffmpeg em vídeo vertical de 10s,
 * salva em /videos/{slug}.mp4.
 */

import puppeteer from 'puppeteer';
import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { Diagnostico } from '../types';
import { log } from '../utils/logger';
import { dataPath, readJson } from '../utils/dataHelpers';

async function takeScreenshots(diag: Diagnostico): Promise<string[]> {
  const screenshotsDir = path.join(process.cwd(), 'videos', 'tmp', diag.slug);
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

  const pageFile = diag.landing_page_path;
  if (!pageFile || !fs.existsSync(pageFile)) {
    log.warn(`Página não encontrada para ${diag.nome}, usando screenshot placeholder`);
    return [];
  }

  const fileUrl = `file://${pageFile}`;
  const screenshots: string[] = [];

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 15000 });

    // Screenshot 1: topo (hero)
    const s1 = path.join(screenshotsDir, '01.png');
    await page.screenshot({ path: s1 });
    screenshots.push(s1);

    // Screenshot 2: meio (serviços)
    await page.evaluate(() => { (window as Window).scrollTo(0, 600); });
    await new Promise((r) => setTimeout(r, 300));
    const s2 = path.join(screenshotsDir, '02.png');
    await page.screenshot({ path: s2 });
    screenshots.push(s2);

    // Screenshot 3: CTA final
    await page.evaluate(() => { (window as Window).scrollTo(0, (document as Document).body.scrollHeight); });
    await new Promise((r) => setTimeout(r, 300));
    const s3 = path.join(screenshotsDir, '03.png');
    await page.screenshot({ path: s3 });
    screenshots.push(s3);
  } catch (err) {
    log.error(`Puppeteer falhou para ${diag.nome}: ${(err as Error).message}`);
  } finally {
    if (browser) await browser.close();
  }

  return screenshots;
}

function ffmpegAvailable(): boolean {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function createVideo(diag: Diagnostico, screenshots: string[]): string | null {
  const videosDir = path.join(process.cwd(), 'videos');
  if (!fs.existsSync(videosDir)) fs.mkdirSync(videosDir, { recursive: true });

  const outputPath = path.join(videosDir, `${diag.slug}.mp4`);

  if (screenshots.length === 0 || !ffmpegAvailable()) {
    log.warn(`ffmpeg indisponível ou sem screenshots para ${diag.nome} — vídeo não gerado`);
    return null;
  }

  try {
    // Cria lista de inputs para concat
    const listFile = path.join(process.cwd(), 'videos', 'tmp', diag.slug, 'list.txt');
    const duration = Math.floor(10 / screenshots.length);
    const listContent = screenshots.map((s) => `file '${s}'\nduration ${duration}`).join('\n');
    fs.writeFileSync(listFile, listContent);

    const drawtext = `drawtext=text='Sua empresa pode ter isso':fontcolor=white:fontsize=28:x=(w-text_w)/2:y=h-80:box=1:boxcolor=black@0.6:boxborderw=10`;

    const result = spawnSync(
      'ffmpeg',
      [
        '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', listFile,
        '-vf', `scale=390:844:force_original_aspect_ratio=decrease,pad=390:844:(ow-iw)/2:(oh-ih)/2,${drawtext},fade=t=in:st=0:d=0.5,fade=t=out:st=9:d=0.5`,
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-t', '10',
        outputPath,
      ],
      { encoding: 'utf-8', timeout: 60000 }
    );

    if (result.status !== 0) {
      log.error(`ffmpeg erro: ${result.stderr}`);
      return null;
    }

    return outputPath;
  } catch (err) {
    log.error(`Criação de vídeo falhou: ${(err as Error).message}`);
    return null;
  }
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
    log.info(`  Gerando vídeo para ${diag.nome}...`);
    const screenshots = await takeScreenshots(diag);
    const videoPath = createVideo(diag, screenshots);
    if (videoPath) {
      log.info(`  ✓ ${diag.nome} → ${videoPath}`);
    } else {
      log.warn(`  ⚠ Vídeo não gerado para ${diag.nome}`);
    }
  }

  log.success('Agente 4 concluído');
}

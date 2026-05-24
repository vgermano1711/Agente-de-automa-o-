/**
 * Agente 3 — Builder de Landing Page
 * Gera HTML/CSS responsivo para cada diagnóstico, salva em /pages/{slug}/index.html,
 * faz deploy via Netlify CLI e atualiza landing_page_url nos diagnósticos.
 */

import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Diagnostico } from '../types';
import { log } from '../utils/logger';
import { dataPath, readJson, writeJson, today } from '../utils/dataHelpers';

const client = new Anthropic();

const CATEGORY_COLORS: Record<string, { primary: string; secondary: string }> = {
  'salão de beleza': { primary: '#c06b8a', secondary: '#f9e8f0' },
  barbearia: { primary: '#2c3e50', secondary: '#ecf0f1' },
  'clínica odontológica': { primary: '#2980b9', secondary: '#eaf4fb' },
  construtora: { primary: '#e67e22', secondary: '#fef5e7' },
  'corretor de imóveis': { primary: '#27ae60', secondary: '#eafaf1' },
};

function getColors(categoria: string) {
  return CATEGORY_COLORS[categoria] || { primary: '#3498db', secondary: '#eaf4fb' };
}

async function generateHTML(diag: Diagnostico): Promise<string> {
  const colors = getColors(diag.categoria);

  const prompt = `Você é um desenvolvedor front-end especialista em landing pages de alta conversão para pequenos negócios locais brasileiros.

Gere o HTML completo de uma landing page para:
- Negócio: ${diag.nome}
- Categoria: ${diag.categoria}
- Cidade: ${diag.cidade}
- Proposta de valor: ${diag.proposta_de_valor}
- Problema: ${diag.problema_principal}
- Cor primária: ${colors.primary}
- Cor de fundo: ${colors.secondary}

Requisitos OBRIGATÓRIOS:
1. HTML completo (<!DOCTYPE html> até </html>), CSS inline no <style>, sem JS externo
2. Mobile-first e 100% responsivo (viewport 390px)
3. Seções: Hero com headline, Sobre/Serviços, Diferenciais (3 itens), CTA com WhatsApp
4. Design limpo, profissional, sem cara de template genérico
5. Botão WhatsApp com número placeholder {{TELEFONE}}
6. Textos inferidos da categoria e da proposta de valor — criativos, não genéricos
7. Footer com "© ${new Date().getFullYear()} ${diag.nome} — ${diag.cidade}"
8. NÃO use Bootstrap, Tailwind ou qualquer CDN externo
9. Retorne APENAS o HTML, sem explicações, sem markdown

Gere agora:`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    let html = (response.content[0] as { type: string; text: string }).text.trim();
    // Substituir placeholder de telefone
    html = html.replace(/\{\{TELEFONE\}\}/g, diag.telefone.replace(/\D/g, ''));
    return html;
  } catch (err) {
    log.warn(`Gerando HTML mock para ${diag.nome}: ${(err as Error).message}`);
    return generateMockHTML(diag, colors);
  }
}

function generateMockHTML(
  diag: Diagnostico,
  colors: { primary: string; secondary: string }
): string {
  const phone = diag.telefone.replace(/\D/g, '');
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${diag.nome} — ${diag.cidade}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', sans-serif; color: #333; }
    .hero { background: ${colors.primary}; color: #fff; padding: 60px 20px; text-align: center; }
    .hero h1 { font-size: 2rem; margin-bottom: 16px; line-height: 1.2; }
    .hero p { font-size: 1.1rem; opacity: 0.9; max-width: 500px; margin: 0 auto 30px; }
    .btn-cta { display: inline-block; background: #25d366; color: #fff; padding: 16px 32px; border-radius: 50px; text-decoration: none; font-size: 1.1rem; font-weight: 700; }
    .section { padding: 50px 20px; max-width: 700px; margin: 0 auto; }
    .section h2 { color: ${colors.primary}; font-size: 1.5rem; margin-bottom: 20px; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; }
    .card { background: ${colors.secondary}; border-radius: 12px; padding: 24px 16px; text-align: center; }
    .card .icon { font-size: 2rem; margin-bottom: 10px; }
    .card h3 { font-size: 1rem; color: ${colors.primary}; }
    .cta-section { background: ${colors.secondary}; text-align: center; padding: 50px 20px; }
    .cta-section h2 { font-size: 1.6rem; margin-bottom: 16px; color: ${colors.primary}; }
    footer { background: #222; color: #aaa; text-align: center; padding: 20px; font-size: 0.85rem; }
    @media (max-width: 480px) { .hero h1 { font-size: 1.5rem; } }
  </style>
</head>
<body>
  <section class="hero">
    <h1>${diag.proposta_de_valor}</h1>
    <p>${diag.nome} — referência em ${diag.categoria} em ${diag.cidade}</p>
    <a class="btn-cta" href="https://wa.me/55${phone}?text=Olá, vim pelo site e gostaria de saber mais!">
      📱 Fale Conosco no WhatsApp
    </a>
  </section>

  <div class="section">
    <h2>Por que nos escolher?</h2>
    <div class="cards">
      <div class="card"><div class="icon">⭐</div><h3>Atendimento de excelência</h3></div>
      <div class="card"><div class="icon">📍</div><h3>Localização estratégica em ${diag.cidade}</h3></div>
      <div class="card"><div class="icon">✅</div><h3>Resultados comprovados</h3></div>
    </div>
  </div>

  <section class="cta-section">
    <h2>Agende agora mesmo</h2>
    <p style="margin-bottom:24px; color:#555;">Sem compromisso. Primeira consulta gratuita.</p>
    <a class="btn-cta" href="https://wa.me/55${phone}?text=Quero agendar uma visita!">
      Agendar via WhatsApp
    </a>
  </section>

  <footer>© ${new Date().getFullYear()} ${diag.nome} — ${diag.cidade}</footer>
</body>
</html>`;
}

async function deployToNetlify(slug: string, sitePath: string): Promise<string | null> {
  const netlifyToken = process.env.NETLIFY_AUTH_TOKEN;
  const prefix = process.env.NETLIFY_SITE_PREFIX || 'demo-';
  if (!netlifyToken) {
    log.warn('NETLIFY_AUTH_TOKEN não configurado — pulando deploy');
    return null;
  }

  try {
    const siteName = `${prefix}${slug}`.slice(0, 63);
    const api = axios.create({
      baseURL: 'https://api.netlify.com/api/v1',
      headers: { Authorization: `Bearer ${netlifyToken}` },
    });

    // Find or create site
    let siteId: string;
    const searchResp = await api.get('/sites', { params: { name: siteName } });
    const existing = (searchResp.data as any[]).find((s: any) => s.name === siteName);
    if (existing) {
      siteId = existing.id;
      log.info(`  Site existente: ${siteName}`);
    } else {
      const createResp = await api.post('/sites', { name: siteName });
      siteId = (createResp.data as any).id;
      log.info(`  Novo site criado: ${siteName}`);
    }

    // Compute SHA1 of index.html
    const htmlContent = fs.readFileSync(path.join(sitePath, 'index.html'));
    const sha1 = crypto.createHash('sha1').update(htmlContent).digest('hex');

    // Create deploy with file digest
    const deployResp = await api.post(
      `/sites/${siteId}/deploys`,
      { files: { '/index.html': sha1 } },
      { headers: { 'Content-Type': 'application/json' } }
    );
    const deployId = (deployResp.data as any).id;
    const deployUrl: string = (deployResp.data as any).deploy_ssl_url || (deployResp.data as any).deploy_url || '';

    // Upload file if required
    const required: string[] = (deployResp.data as any).required || [];
    if (required.includes(sha1)) {
      await axios.put(
        `https://api.netlify.com/api/v1/deploys/${deployId}/files/index.html`,
        htmlContent,
        { headers: { Authorization: `Bearer ${netlifyToken}`, 'Content-Type': 'application/octet-stream' } }
      );
    }

    // Poll until ready (max 30s)
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const statusResp = await api.get(`/deploys/${deployId}`);
      const state: string = (statusResp.data as any).state;
      if (state === 'ready' || state === 'current') {
        return (statusResp.data as any).deploy_ssl_url || (statusResp.data as any).deploy_url || deployUrl;
      }
      if (state === 'error') {
        log.error(`Deploy com erro para ${slug}`);
        return null;
      }
    }

    return deployUrl || null;
  } catch (err) {
    log.error(`Netlify API deploy falhou para ${slug}: ${(err as Error).message}`);
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
    if (!fs.existsSync(pageDir)) fs.mkdirSync(pageDir, { recursive: true });

    const htmlPath = path.join(pageDir, 'index.html');
    log.info(`  Gerando landing page para ${diag.nome}...`);

    const html = await generateHTML(diag);
    fs.writeFileSync(htmlPath, html);
    diag.landing_page_path = htmlPath;

    const deployedUrl = await deployToNetlify(diag.slug, pageDir);
    diag.landing_page_url = deployedUrl || `http://localhost:3000/pages/${diag.slug}`;

    log.info(`  ✓ ${diag.nome} → ${diag.landing_page_url}`);
  }

  writeJson(diagFile, diagnosticos);
  log.success(`Agente 3 concluído: ${diagnosticos.length} landing pages geradas`);
  return diagnosticos;
}

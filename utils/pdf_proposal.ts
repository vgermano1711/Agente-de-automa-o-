/**
 * Gerador de Proposta PDF
 * Usa puppeteer (já instalado via whatsapp-web.js) para renderizar HTML → PDF.
 * Salva em data/propostas/{slug}.pdf e devolve o caminho do arquivo.
 */

import fs from 'fs';
import path from 'path';
import { log } from './logger';

const PROPOSTAS_DIR = path.join(process.cwd(), 'data', 'propostas');

export interface DadosProposta {
  nomeNegocio: string;
  segmento: string;
  cidade: string;
  slug: string;
  opcaoRecomendada?: 1 | 2 | 3;
}

function gerarHtml(d: DadosProposta): string {
  const pixKey = process.env.VICTOR_PIX_KEY || '';
  const hoje   = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const propNum = `${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;

  const hl = (n: 1 | 2 | 3) =>
    d.opcaoRecomendada === n
      ? 'border:2px solid #2d6a4f;background:#f0fff4;'
      : 'border:1px solid #e5e7eb;';

  const badge = (n: 1 | 2 | 3) =>
    d.opcaoRecomendada === n
      ? '<span style="background:#2d6a4f;color:#fff;font-size:10px;padding:2px 8px;border-radius:10px;margin-left:8px;vertical-align:middle">Recomendada</span>'
      : '';

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Arial,sans-serif;color:#111;background:#fff;padding:48px 52px;font-size:13px;line-height:1.5}
.hdr{display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:18px;border-bottom:3px solid #2d6a4f;margin-bottom:28px}
.hdr h1{font-size:22px;color:#2d6a4f;font-weight:700;letter-spacing:-.3px}
.hdr .sub{font-size:12px;color:#555;margin-top:3px}
.hdr .meta{text-align:right;font-size:12px;color:#666;line-height:1.7}
.para{background:#f9fafb;border-left:4px solid #2d6a4f;padding:14px 18px;margin-bottom:28px;border-radius:0 6px 6px 0}
.para .lbl{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:4px}
.para .nome{font-size:17px;font-weight:700}
.para .seg{font-size:12px;color:#555;margin-top:2px}
h2.sec{font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#888;margin:24px 0 14px}
.opc{border-radius:8px;padding:18px 20px;margin-bottom:12px}
.opc-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.opc-titulo{font-size:14px;font-weight:700;color:#2d6a4f}
.opc-preco{font-size:20px;font-weight:700}
.opc-preco .mes{font-size:12px;color:#555;font-weight:400}
.opc ul{list-style:none;padding:0}
.opc ul li{padding:2px 0;color:#333}
.opc ul li::before{content:'✓ ';color:#2d6a4f;font-weight:700}
.opc .pgto{margin-top:10px;padding-top:10px;border-top:1px solid #e5e7eb;font-size:11px;color:#666}
.prox{background:#f0fff4;border:1px solid #b7e4c7;border-radius:8px;padding:18px 20px;margin-top:24px}
.prox ol{padding-left:16px}
.prox ol li{padding:3px 0;color:#333}
.ftr{margin-top:28px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;font-size:11px;color:#888}
.ftr strong{color:#2d6a4f}
</style></head><body>
<div class="hdr">
  <div><h1>VICTOR GERMANO</h1><div class="sub">Desenvolvimento Web Profissional</div></div>
  <div class="meta">
    <div style="font-weight:700;font-size:13px;color:#111">PROPOSTA COMERCIAL</div>
    <div>Nº ${propNum}</div><div>${hoje}</div>
  </div>
</div>

<div class="para">
  <div class="lbl">Proposta para</div>
  <div class="nome">${d.nomeNegocio}</div>
  <div class="seg">${d.segmento}${d.cidade ? ' · ' + d.cidade : ''}</div>
</div>

<h2 class="sec">Nossas Soluções</h2>

<div class="opc" style="${hl(1)}">
  <div class="opc-hdr">
    <div class="opc-titulo">Opção 1 — Landing Page Profissional${badge(1)}</div>
    <div class="opc-preco">R$ 597,00</div>
  </div>
  <ul>
    <li>Uma página completa e otimizada para conversão</li>
    <li>Seções: apresentação, serviços, depoimentos e contato</li>
    <li>Botão de WhatsApp em destaque para captar clientes</li>
    <li>Design responsivo — perfeito no celular e no PC</li>
    <li>SEO básico — aparece no Google</li>
    <li>1 ano de hospedagem incluso</li>
  </ul>
  <div class="pgto">Prazo: até 5 dias úteis · Pagamento: R$300 para iniciar + R$297 na entrega</div>
</div>

<div class="opc" style="${hl(2)}">
  <div class="opc-hdr">
    <div class="opc-titulo">Opção 2 — Site Institucional Completo${badge(2)}</div>
    <div class="opc-preco">R$ 897,00</div>
  </div>
  <ul>
    <li>Múltiplas páginas: Home, Serviços, Sobre e Contato</li>
    <li>Design moderno, exclusivo e totalmente responsivo</li>
    <li>Integração com WhatsApp e redes sociais</li>
    <li>Formulário de captação de novos clientes</li>
    <li>SEO completo para ranqueamento no Google</li>
    <li>1 ano de hospedagem incluso</li>
  </ul>
  <div class="pgto">Prazo: até 7 dias úteis · Pagamento: R$450 para iniciar + R$447 na entrega</div>
</div>

<div class="opc" style="${hl(3)}">
  <div class="opc-hdr">
    <div class="opc-titulo">Opção 3 — Site Completo + Manutenção${badge(3)}</div>
    <div class="opc-preco">R$ 797,00 <span class="mes">+ R$149/mês</span></div>
  </div>
  <ul>
    <li>Tudo da Opção 2 incluído</li>
    <li>Atualizações mensais de conteúdo (serviços, preços, fotos)</li>
    <li>Suporte via WhatsApp para dúvidas e ajustes</li>
    <li>Relatório mensal de acessos e desempenho</li>
    <li>Hospedagem inclusa por tempo indeterminado</li>
  </ul>
  <div class="pgto">Prazo: até 7 dias úteis · Pagamento: R$450 para iniciar + R$347 na entrega + R$149/mês</div>
</div>

<div class="prox">
  <h2 class="sec" style="margin-top:0">Próximos Passos</h2>
  <ol>
    <li>Você confirma a opção de sua preferência por WhatsApp</li>
    <li>Victor envia os dados para pagamento da entrada${pixKey ? ` (PIX: ${pixKey})` : ''}</li>
    <li>Após confirmação, desenvolvimento inicia em até 24h</li>
    <li>Você recebe atualizações de progresso durante o projeto</li>
    <li>Aprovação final e entrega com todos os acessos</li>
  </ol>
</div>

<div class="ftr">
  <strong>Victor Germano</strong> · WhatsApp: (11) 95357-0476 · dev.germanoo@gmail.com<br>
  Esta proposta é válida por 15 dias a partir da data de emissão.
</div>
</body></html>`;
}

/** Gera o PDF da proposta e retorna o caminho do arquivo (ou null em caso de falha). */
export async function gerarPropostaPDF(dados: DadosProposta): Promise<string | null> {
  if (!fs.existsSync(PROPOSTAS_DIR)) {
    fs.mkdirSync(PROPOSTAS_DIR, { recursive: true });
  }
  const filePath = path.join(PROPOSTAS_DIR, `${dados.slug}.pdf`);

  try {
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await page.setContent(gerarHtml(dados), { waitUntil: 'domcontentloaded' });
    await page.pdf({
      path:            filePath,
      format:          'A4',
      printBackground: true,
      margin:          { top: '0', bottom: '0', left: '0', right: '0' },
    });
    await browser.close();
    log.success(`PDF de proposta gerado: ${filePath}`);
    return filePath;
  } catch (err) {
    log.warn(`PDF proposal falhou: ${(err as Error).message}`);
    return null;
  }
}

/** URL pública da proposta via ngrok (ou localhost como fallback). */
export function urlProposta(slug: string): string {
  const base = process.env.APPROVAL_PANEL_URL || `http://localhost:${process.env.PORT || 3000}`;
  return `${base}/api/proposta/${slug}`;
}

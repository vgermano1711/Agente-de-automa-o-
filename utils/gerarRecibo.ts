/**
 * Gerador de Recibo PDF (administrativo)
 * Mesmo padrão do utils/pdf_proposal.ts — puppeteer renderiza HTML → PDF.
 * Salva em data/clients/{slug}/recibos/{cobranca-id}.pdf.
 *
 * Escopo deliberadamente limitado: recibo administrativo de pagamento da
 * mensalidade/parcela, NÃO é nota fiscal e NÃO lida com nenhum dado clínico.
 */

import fs from 'fs';
import path from 'path';
import { log } from './logger';

export interface DadosRecibo {
  slug: string;
  cobrancaId: string;
  nomeNegocio: string;
  tipo: 'mensalidade' | 'segunda_parcela';
  valor: number;
  pagoEm: string;
  txid: string;
}

function recibosDir(slug: string): string {
  return path.join(process.cwd(), 'data', 'clients', slug, 'recibos');
}

function gerarHtml(d: DadosRecibo): string {
  const dataFormatada = new Date(d.pagoEm).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const valorFormatado = d.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const tipoLabel = d.tipo === 'mensalidade' ? 'Mensalidade — Automação de WhatsApp' : 'Segunda parcela — Site';

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Arial,sans-serif;color:#111;background:#fff;padding:48px 52px;font-size:13px;line-height:1.6}
.hdr{display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:18px;border-bottom:3px solid #2d6a4f;margin-bottom:28px}
.hdr h1{font-size:20px;color:#2d6a4f;font-weight:700}
.hdr .meta{text-align:right;font-size:12px;color:#666;line-height:1.7}
.linha{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #e5e7eb}
.linha .lbl{color:#666}
.linha .val{font-weight:600}
.valor-total{margin-top:20px;padding:18px 20px;background:#f0fff4;border:1px solid #b7e4c7;border-radius:8px;display:flex;justify-content:space-between;align-items:center}
.valor-total .lbl{font-size:12px;color:#555}
.valor-total .val{font-size:22px;font-weight:700;color:#2d6a4f}
.aviso{margin-top:28px;padding:14px 16px;background:#f9fafb;border-left:4px solid #999;border-radius:0 6px 6px 0;font-size:11px;color:#666}
.ftr{margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;font-size:11px;color:#888}
</style></head><body>
<div class="hdr">
  <div><h1>Recibo de Pagamento</h1></div>
  <div class="meta"><div>Recibo Nº ${d.cobrancaId}</div><div>${dataFormatada}</div></div>
</div>

<div class="linha"><span class="lbl">Recebedor</span><span class="val">${process.env.VICTOR_PIX_NOME || 'Victor Germano'}</span></div>
<div class="linha"><span class="lbl">Pagador</span><span class="val">${d.nomeNegocio}</span></div>
<div class="linha"><span class="lbl">Referente a</span><span class="val">${tipoLabel}</span></div>
<div class="linha"><span class="lbl">Identificador (txid)</span><span class="val">${d.txid}</span></div>
<div class="linha"><span class="lbl">Data do pagamento</span><span class="val">${dataFormatada}</span></div>

<div class="valor-total">
  <span class="lbl">Valor pago</span>
  <span class="val">${valorFormatado}</span>
</div>

<div class="aviso">
  Este é um recibo administrativo de controle interno, referente ao serviço de automação
  contratado. Não constitui nota fiscal nem documento fiscal.
</div>

<div class="ftr">Emitido automaticamente em ${new Date().toLocaleDateString('pt-BR')}</div>
</body></html>`;
}

/** Gera o PDF do recibo e retorna o caminho do arquivo (ou null em caso de falha). */
export async function gerarReciboPDF(dados: DadosRecibo): Promise<string | null> {
  const dir = recibosDir(dados.slug);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${dados.cobrancaId}.pdf`);

  try {
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await page.setContent(gerarHtml(dados), { waitUntil: 'domcontentloaded' });
    await page.pdf({
      path: filePath,
      format: 'A4',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    });
    await browser.close();
    log.success(`Recibo PDF gerado: ${filePath}`);
    return filePath;
  } catch (err) {
    log.warn(`Geração de recibo falhou: ${(err as Error).message}`);
    return null;
  }
}

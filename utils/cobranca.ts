/**
 * utils/cobranca.ts
 * Persistência e geração da cobrança Pix por tenant — compartilhado entre
 * api/server.ts (endpoints do painel) e agents/agent7_handler.ts (lembrete
 * mensal via WhatsApp), pra nunca gerar dois códigos Pix diferentes pro
 * mesmo período de cobrança.
 */

import fs from 'fs';
import path from 'path';
import { CobrancaTenant, CobrancaTenantFile, Projeto } from '../types';
import { gerarPixCopiaECola } from './pixBrCode';

function cobrancaFile(slug: string): string {
  return path.join(process.cwd(), 'data', 'clients', slug, 'cobranca.json');
}

export function readCobrancas(slug: string): CobrancaTenant[] {
  const file = cobrancaFile(slug);
  if (!fs.existsSync(file)) return [];
  try {
    return (JSON.parse(fs.readFileSync(file, 'utf-8')) as CobrancaTenantFile).cobrancas || [];
  } catch {
    return [];
  }
}

export function writeCobrancas(slug: string, cobrancas: CobrancaTenant[]): void {
  const file = cobrancaFile(slug);
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ cobrancas } as CobrancaTenantFile, null, 2));
}

/** Cobrança pendente do mês atual — cria on-demand (e cacheia o copia-e-cola) se não existir. */
export function obterOuCriarCobrancaPendente(projeto: Projeto): CobrancaTenant {
  const cobrancas = readCobrancas(projeto.slug);
  const periodo = new Date().toISOString().slice(0, 7).replace('-', ''); // YYYYMM
  const id = `${projeto.slug}-${periodo}`;

  const existente = cobrancas.find((c) => c.id === id);
  if (existente) return existente;

  const valor = projeto.mensalidade || 0;
  // Recebedor é sempre Victor (dono da plataforma) — o tenant é quem paga a mensalidade,
  // não quem recebe. pix_recebedor_nome/cidade em OnboardingInfo é pra uma camada futura
  // onde o próprio tenant cobra os clientes DELE, não pra esta cobrança.
  const copiaECola = gerarPixCopiaECola({
    chave: process.env.VICTOR_PIX_KEY || '',
    nomeRecebedor: process.env.VICTOR_PIX_NOME || 'Victor Germano',
    cidade: process.env.VICTOR_PIX_CIDADE || 'Sao Paulo',
    valor: valor > 0 ? valor : undefined,
    txid: id,
  });

  const nova: CobrancaTenant = {
    id,
    tipo: 'mensalidade',
    valor,
    txid: id,
    criado_em: new Date().toISOString(),
    copia_e_cola: copiaECola,
  };
  writeCobrancas(projeto.slug, [...cobrancas, nova]);
  return nova;
}

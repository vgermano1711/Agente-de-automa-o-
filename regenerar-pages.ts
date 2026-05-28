/**
 * regenerar-pages.ts
 *
 * Gera uma landing page de vendas premium personalizada para cada lead.
 * A página não é um "site demo" da empresa — é uma proposta comercial
 * personalizada que mostra como o sistema de automação vai funcionar
 * especificamente para aquele negócio, usando a identidade visual da marca.
 *
 * Seções obrigatórias (do prompt de engenharia):
 *   Hero → Diagnóstico → 7 Agentes → Métricas → Mapa APIs → Prova Social → CTAs
 *
 * Recursos de conversão: CTA flutuante, exit-intent modal, inatividade toast,
 *   stagger animation, counter animation, mobile carousel, hierarquia de urgência.
 */

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { Diagnostico, IdentidadeVisual } from './types';

const client = new Anthropic();
const TODAY  = new Date().toISOString().slice(0, 10);
const YEAR   = new Date().getFullYear();
const PAGES_DIR = path.join(process.cwd(), 'pages');
const DATA_DIR  = path.join(process.cwd(), 'data');

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────
function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r},${g},${b}`;
}

function lighten(hex: string, amount = 0.15): string {
  const h = hex.replace('#', '');
  const r = Math.min(255, Math.round(parseInt(h.substring(0, 2), 16) + 255 * amount));
  const g = Math.min(255, Math.round(parseInt(h.substring(2, 4), 16) + 255 * amount));
  const b = Math.min(255, Math.round(parseInt(h.substring(4, 6), 16) + 255 * amount));
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

function waLink(phone: string, msg = 'Olá! Gostaria de saber mais sobre a automação de captação.'): string {
  const n = (phone || '').replace(/\D/g, '');
  if (!n) return '#contato';
  return `https://wa.me/55${n}?text=${encodeURIComponent(msg)}`;
}

function cityShort(cidade: string): string {
  return cidade.split(',')[0].trim();
}

function getFonts(tip: string): string {
  switch (tip) {
    case 'serifada':
      return 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Cormorant+Garamond:ital,wght@0,300;1,300&family=Inter:wght@400;500;600&display=swap';
    case 'display':
      return 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@300;400;500;600;700&display=swap';
    case 'bold-impacto':
      return 'https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=Inter:wght@400;500;600&display=swap';
    default:
      return 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap';
  }
}

function getHeadingFamily(tip: string): string {
  switch (tip) {
    case 'serifada':   return "'Playfair Display', Georgia, serif";
    case 'display':    return "'Bebas Neue', Impact, sans-serif";
    case 'bold-impacto': return "'Oswald', Impact, sans-serif";
    default:           return "'Inter', system-ui, sans-serif";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT GENERATION
// ─────────────────────────────────────────────────────────────────────────────
interface PageContent {
  headline_hero: string;
  sub_hero: string;
  cta_principal: string;
  cta_secundario: string;
  diagnostico_titulo: string;
  diagnostico_itens: Array<{ icone: string; problema: string; impacto: string }>;
  metricas: Array<{ valor: string; sufixo: string; label: string; periodo: string }>;
  prova_social: Array<{ empresa: string; cargo: string; texto: string; resultado: string }>;
  urgencia: string;
  exit_msg: string;
  inatividade_msg: string;
}

async function generateContent(diag: Diagnostico): Promise<PageContent> {
  const segMicro = diag.segmento?.micro?.[0] || diag.categoria;
  const segNivel2 = diag.segmento?.nivel2 || diag.categoria;
  const city = cityShort(diag.cidade);

  const prompt = `Você é um copywriter de alta conversão especializado em propostas comerciais B2B para micro e pequenos negócios brasileiros.

Crie o conteúdo de uma landing page de vendas para apresentar um sistema de automação de captação de clientes para:
- Negócio: ${diag.nome}
- Segmento: ${segNivel2} / ${segMicro}
- Cidade: ${city}
- Problema identificado: ${diag.problema_principal}
- Ângulo de venda: ${diag.angulo_de_venda}
- Tom: ${diag.tom_da_abordagem}

REGRAS:
1. Todo texto deve parecer escrito por um humano que conhece esse negócio
2. Métricas devem ser específicas e críveis para o segmento
3. Prova social deve ser de negócios similares — nunca genérica
4. Urgência deve ser real e específica para região/segmento
5. Nenhuma frase genérica de IA ("transforme seu negócio", "solução inovadora", etc.)
6. headlines curtos e impactantes — max 8 palavras

Retorne APENAS JSON válido:
{
  "headline_hero": "headline de 5-8 palavras específico para ${diag.nome}",
  "sub_hero": "1 frase sobre o problema específico que resolvemos para ${segMicro} em ${city}",
  "cta_principal": "texto de botão de 4-6 palavras ação direta",
  "cta_secundario": "texto de botão de menor comprometimento",
  "diagnostico_titulo": "título para seção 'o que encontramos analisando ${diag.nome}'",
  "diagnostico_itens": [
    {"icone":"🔍","problema":"problema específico 1 para ${segMicro}","impacto":"consequência quantificada em reais ou percentual"},
    {"icone":"⚡","problema":"problema específico 2","impacto":"consequência quantificada"},
    {"icone":"📊","problema":"problema específico 3","impacto":"consequência quantificada"}
  ],
  "metricas": [
    {"valor":"47","sufixo":"+","label":"leads qualificados","periodo":"por mês em média"},
    {"valor":"3.2","sufixo":"x","label":"mais conversões","periodo":"vs. abordagem manual"},
    {"valor":"92","sufixo":"%","label":"menos tempo manual","periodo":"nas vendas"},
    {"valor":"8","sufixo":"min","label":"primeira resposta","periodo":"automática ao lead"}
  ],
  "prova_social": [
    {"empresa":"nome de negócio similar em SP/região","cargo":"Proprietário(a) de ${segMicro}","texto":"depoimento realista 2 frases com resultado específico","resultado":"ex: +R$4.800 em 30 dias"},
    {"empresa":"outro negócio similar","cargo":"Sócio(a), ${segNivel2}","texto":"depoimento sobre tempo economizado 2 frases","resultado":"ex: 23 novos clientes no primeiro mês"},
    {"empresa":"mais um negócio similar","cargo":"Dono(a), ${segMicro}","texto":"depoimento sobre facilidade de uso 2 frases","resultado":"ex: ROI positivo em 3 semanas"}
  ],
  "urgencia": "frase de urgência específica para ${segMicro} em ${city} — vagas, prazo ou dado de mercado real",
  "exit_msg": "pergunta para exit-intent específica para ${diag.nome}",
  "inatividade_msg": "notificação sutil de 1 frase para quem ficou inativo por 45s — mencione ${segMicro}"
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });
    let text = (response.content[0] as any).text.trim();
    text = text.replace(/^```[^\n]*\n?/, '').replace(/\n?```$/, '').trim();
    const m = text.match(/\{[\s\S]*\}/);
    if (m) text = m[0];
    return JSON.parse(text) as PageContent;
  } catch (err) {
    return fallbackContent(diag);
  }
}

function fallbackContent(diag: Diagnostico): PageContent {
  const city = cityShort(diag.cidade);
  const seg = diag.segmento?.nivel2 || diag.categoria;
  return {
    headline_hero: `${diag.nome} capturando clientes automaticamente`,
    sub_hero: `Descobrimos como ${diag.nome} pode atrair 3x mais clientes em ${city} sem esforço manual`,
    cta_principal: 'Quero ver minha automação',
    cta_secundario: 'Como funciona na prática',
    diagnostico_titulo: `O que encontramos analisando ${diag.nome}`,
    diagnostico_itens: [
      { icone: '🔍', problema: 'Sem presença digital rastreável', impacto: '~15 clientes/mês perdidos para concorrentes com site' },
      { icone: '⚡', problema: 'Nenhuma resposta automática a leads', impacto: '70% dos contatos desistem em menos de 1 hora' },
      { icone: '📊', problema: 'Ausência de follow-up estruturado', impacto: 'R$2.000–8.000/mês em oportunidades não aproveitadas' },
    ],
    metricas: [
      { valor: '47', sufixo: '+', label: 'leads qualificados', periodo: 'por mês em média' },
      { valor: '3', sufixo: 'x', label: 'mais conversões', periodo: 'vs. abordagem manual' },
      { valor: '92', sufixo: '%', label: 'menos tempo manual', periodo: 'nas vendas' },
      { valor: '8', sufixo: 'min', label: 'primeira resposta', periodo: 'automática ao lead' },
    ],
    prova_social: [
      { empresa: `${seg} em ${city}`, cargo: 'Proprietário', texto: 'Em 30 dias captei 23 novos clientes sem fazer nada manualmente. O sistema trabalha enquanto eu atendo.', resultado: '+R$4.800 em receita no primeiro mês' },
      { empresa: `Negócio similar em SP`, cargo: `Dono(a), ${seg}`, texto: 'Economizo 3 horas por dia que antes gastava prospectando. Agora foco em atender melhor quem já chegou.', resultado: '23 novos clientes no primeiro mês' },
      { empresa: `Empreendedor em ${city}`, cargo: `Gestor(a), ${seg}`, texto: 'Recebi o primeiro lead automatizado em menos de 24h. ROI positivo na primeira semana.', resultado: 'Retorno em 3 semanas' },
    ],
    urgencia: `Apenas 3 vagas disponíveis para ${seg} em ${city} neste mês`,
    exit_msg: `Antes de sair: quer ver o diagnóstico completo de captação de ${diag.nome}?`,
    inatividade_msg: `Seu concorrente em ${city} pode estar automatizando agora — você ainda está analisando.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML BUILDER — template universal premium
// ─────────────────────────────────────────────────────────────────────────────
function buildHTML(diag: Diagnostico, c: PageContent): string {
  const iv: IdentidadeVisual = diag.identidade_visual || {
    cor_primaria: '#1e293b', cor_secundaria: '#0f172a', cor_texto: '#ffffff',
    cor_fundo: '#0f172a', cor_acento: '#3b82f6', tom: 'técnico', tipografia: 'sans-moderna',
  };

  const tip = iv.tipografia || 'sans-moderna';
  const fontsUrl = getFonts(tip);
  const headingFamily = getHeadingFamily(tip);

  const p   = iv.cor_primaria;
  const s   = iv.cor_secundaria;
  const txt = iv.cor_texto;
  const bg  = iv.cor_fundo;
  const ac  = iv.cor_acento;
  const pLight = lighten(p, 0.12);
  const pRgb = hexToRgb(p);
  const acRgb = hexToRgb(ac);

  const city = cityShort(diag.cidade);
  const segLabel = diag.segmento?.nivel2 || diag.categoria;
  const wa = waLink(diag.telefone, `Olá! Vi a proposta de automação para ${diag.nome} e quero saber mais.`);

  const agentes = [
    { icone: '🔍', nome: 'Prospector', funcao: 'Encontra leads qualificados no Google Maps diariamente' },
    { icone: '🧠', nome: 'Diagnosticador', funcao: 'Analisa cada negócio com IA e define estratégia ideal' },
    { icone: '🎨', nome: 'Builder', funcao: 'Cria landing page premium personalizada em minutos' },
    { icone: '🎥', nome: 'Vídeo', funcao: 'Gera vídeo de apresentação automaticamente' },
    { icone: '💬', nome: 'Canal', funcao: 'Escreve mensagem de abordagem única para cada lead' },
    { icone: '✅', nome: 'Revisor', funcao: 'Garante qualidade máxima antes de qualquer envio' },
    { icone: '📩', nome: 'Handler', funcao: 'Responde leads e agenda reuniões 24 horas por dia' },
  ];

  const apis = [
    { icone: '📍', nome: 'Google Maps', funcao: 'Prospecção de leads' },
    { icone: '🤖', nome: 'Claude AI', funcao: 'Análise e copywriting' },
    { icone: '💬', nome: 'WhatsApp', funcao: 'Envio de mensagens' },
    { icone: '📧', nome: 'Gmail API', funcao: 'Respostas automáticas' },
    { icone: '🌐', nome: 'Surge.sh', funcao: 'Deploy de páginas' },
  ];

  const diagItems = (c.diagnostico_itens || []).map((item, i) => `
    <div class="diag-card" style="animation-delay:${i * 0.12}s">
      <div class="diag-ico">${item.icone}</div>
      <h3 class="diag-problema">${item.problema}</h3>
      <p class="diag-impacto">${item.impacto}</p>
    </div>`).join('');

  const agentCards = agentes.map((a, i) => `
    <div class="agent-card" style="animation-delay:${i * 0.1}s">
      <div class="agent-ico">${a.icone}</div>
      <div class="agent-badge"><span class="badge-dot"></span>ATIVO</div>
      <h3 class="agent-nome">${a.nome}</h3>
      <p class="agent-funcao">${a.funcao}</p>
    </div>`).join('');

  const metricCards = (c.metricas || []).map((m, i) => `
    <div class="metric-card" style="animation-delay:${i * 0.08}s">
      <div class="metric-num">
        <span class="counter" data-target="${m.valor}" data-suffix="${m.sufixo}">0</span>
      </div>
      <div class="metric-label">${m.label}</div>
      <div class="metric-periodo">${m.periodo}</div>
    </div>`).join('');

  const apiNodes = apis.map((a, i) => `
    <div class="api-node api-node-${i}">
      <div class="api-ico">${a.icone}</div>
      <div class="api-nome">${a.nome}</div>
      <div class="api-funcao">${a.funcao}</div>
    </div>`).join('');

  const socialCards = (c.prova_social || []).map((p, i) => `
    <div class="social-card${i === 0 ? ' active' : ''}" data-index="${i}">
      <div class="social-stars">★★★★★</div>
      <p class="social-texto">"${p.texto}"</p>
      <div class="social-resultado">${p.resultado}</div>
      <div class="social-autor">
        <strong>${p.empresa}</strong>
        <span>${p.cargo}</span>
      </div>
    </div>`).join('');

  const WA_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.116 1.524 5.847L.055 23.03a1 1 0 001.213 1.213l5.183-1.469A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.653-.502-5.183-1.38l-.371-.218-3.842 1.089 1.089-3.842-.218-.371A9.953 9.953 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Proposta Exclusiva — ${diag.nome}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="${fontsUrl}" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --p:${p};--p-light:${pLight};--p-rgb:${pRgb};
  --s:${s};--t:${txt};--bg:${bg};--ac:${ac};--ac-rgb:${acRgb};
  --hf:${headingFamily};
  --gap:clamp(48px,8vw,96px);
}
html{scroll-behavior:smooth}
body{font-family:'Inter',system-ui,sans-serif;background:var(--bg);color:var(--t);line-height:1.65;-webkit-font-smoothing:antialiased;overflow-x:hidden}
a{color:inherit;text-decoration:none}
::selection{background:var(--ac);color:var(--bg)}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-thumb{background:var(--p)}
.wrap{max-width:1120px;margin:0 auto;padding:0 clamp(20px,5vw,48px)}
img{display:block;max-width:100%}

/* ─── NAV ─── */
.nav{position:sticky;top:0;z-index:900;background:rgba(${hexToRgb(bg)},.96);backdrop-filter:blur(16px);border-bottom:1px solid rgba(${pRgb},.12)}
.nav-i{display:flex;align-items:center;justify-content:space-between;height:64px}
.nav-logo{font-family:var(--hf);font-size:1rem;font-weight:700;color:var(--t)}
.nav-logo span{color:var(--ac)}
.nav-links a{font-size:.78rem;font-weight:500;color:rgba(${hexToRgb(txt)},.5);margin-left:24px;letter-spacing:.06em;transition:color .2s}
.nav-links a:hover{color:var(--t)}
.nav-cta{display:inline-flex;align-items:center;gap:7px;background:var(--p);color:var(--t);padding:9px 20px;font-size:.78rem;font-weight:600;border-radius:6px;transition:background .2s}
.nav-cta:hover{background:var(--p-light)}
@media(max-width:700px){.nav-links{display:none}}

/* ─── HERO ─── */
.hero{min-height:100svh;display:flex;align-items:center;justify-content:center;flex-direction:column;text-align:center;padding:clamp(80px,12vh,140px) clamp(20px,5vw,48px) clamp(60px,8vh,100px);position:relative;overflow:hidden}
.hero-bg{position:absolute;inset:0;background:linear-gradient(135deg,var(--s) 0%,var(--bg) 50%,rgba(${pRgb},.08) 100%);pointer-events:none}
.hero-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(${pRgb},.04) 1px,transparent 1px),linear-gradient(90deg,rgba(${pRgb},.04) 1px,transparent 1px);background-size:48px 48px;pointer-events:none}
.hero-glow{position:absolute;top:20%;left:50%;transform:translateX(-50%);width:min(700px,90vw);height:400px;background:radial-gradient(ellipse,rgba(${pRgb},.14) 0%,transparent 70%);pointer-events:none}
.hero-content{position:relative;z-index:1;max-width:800px}
.hero-badge{display:inline-flex;align-items:center;gap:8px;background:rgba(${pRgb},.12);border:1px solid rgba(${pRgb},.3);color:var(--ac);padding:6px 18px;font-size:.72rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;border-radius:50px;margin-bottom:clamp(20px,4vh,36px)}
.hero-badge::before{content:'';width:6px;height:6px;background:var(--ac);border-radius:50%;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.7)}}
.hero-h1{font-family:var(--hf);font-size:clamp(2rem,6vw,4.2rem);font-weight:900;line-height:1.05;letter-spacing:-.02em;color:var(--t);margin-bottom:clamp(12px,2vh,20px)}
.hero-h1 .accent{color:var(--ac)}
.hero-sub{font-size:clamp(.95rem,2.2vw,1.15rem);font-weight:300;color:rgba(${hexToRgb(txt)},.65);max-width:580px;margin:0 auto clamp(28px,5vh,44px);line-height:1.75}
.hero-ctas{display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;margin-bottom:clamp(24px,4vh,40px)}
.btn-primary{display:inline-flex;align-items:center;gap:8px;background:var(--p);color:var(--t);padding:14px 30px;font-size:.88rem;font-weight:700;border-radius:8px;transition:background .2s,box-shadow .2s;box-shadow:0 0 0 0 rgba(${pRgb},.4)}
.btn-primary:hover{background:var(--p-light);box-shadow:0 0 24px rgba(${pRgb},.35)}
.btn-secondary{display:inline-flex;align-items:center;gap:8px;border:1.5px solid rgba(${hexToRgb(txt)},.2);color:rgba(${hexToRgb(txt)},.75);padding:13px 26px;font-size:.86rem;font-weight:500;border-radius:8px;transition:border-color .2s,color .2s}
.btn-secondary:hover{border-color:var(--p);color:var(--t)}
.hero-social{display:flex;align-items:center;justify-content:center;gap:24px;flex-wrap:wrap;font-size:.78rem;color:rgba(${hexToRgb(txt)},.4)}
.hero-social .stars{color:var(--ac);letter-spacing:2px}
.hero-divider{display:flex;align-items:center;gap:12px;justify-content:center;margin:0 auto clamp(20px,3vh,32px);max-width:300px}
.hero-divider::before,.hero-divider::after{content:'';flex:1;height:1px;background:rgba(${pRgb},.2)}
.hero-divider-txt{font-size:.68rem;letter-spacing:.2em;text-transform:uppercase;color:rgba(${hexToRgb(txt)},.35)}

/* ─── DIAGNÓSTICO ─── */
.diag-sec{padding:var(--gap) 0;background:rgba(${pRgb},.04);border-top:1px solid rgba(${pRgb},.1);border-bottom:1px solid rgba(${pRgb},.1)}
.sec-label{font-size:.7rem;letter-spacing:.22em;text-transform:uppercase;color:var(--ac);font-weight:700;display:block;margin-bottom:10px}
.sec-title{font-family:var(--hf);font-size:clamp(1.6rem,4vw,2.4rem);font-weight:700;line-height:1.15;margin-bottom:clamp(32px,5vh,52px)}
.diag-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}
.diag-card{background:rgba(${pRgb},.08);border:1px solid rgba(${pRgb},.15);padding:28px 24px;border-radius:12px;opacity:0;transform:translateY(20px);transition:opacity .5s,transform .5s;transition-delay:var(--d,0s)}
.diag-card.visible{opacity:1;transform:none}
.diag-card:hover{background:rgba(${pRgb},.14);border-color:rgba(${pRgb},.3)}
.diag-ico{font-size:1.8rem;margin-bottom:14px}
.diag-problema{font-size:.98rem;font-weight:700;color:var(--t);margin-bottom:8px}
.diag-impacto{font-size:.84rem;color:rgba(${hexToRgb(txt)},.6);line-height:1.6}

/* ─── 7 AGENTES ─── */
.agents-sec{padding:var(--gap) 0}
.agents-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
.agent-card{background:rgba(${pRgb},.06);border:1px solid rgba(${pRgb},.14);padding:28px 22px;border-radius:12px;position:relative;opacity:0;transform:translateY(24px);transition:opacity .45s,transform .45s,background .25s,border-color .25s;transition-delay:var(--d,0s)}
.agent-card.visible{opacity:1;transform:none}
.agent-card:hover{background:rgba(${pRgb},.14);border-color:rgba(${pRgb},.35)}
.agent-ico{font-size:1.8rem;margin-bottom:10px}
.agent-badge{position:absolute;top:14px;right:14px;display:inline-flex;align-items:center;gap:5px;background:rgba(${acRgb},.12);border:1px solid rgba(${acRgb},.25);color:var(--ac);font-size:.6rem;font-weight:700;letter-spacing:.1em;padding:3px 8px;border-radius:50px}
.badge-dot{width:5px;height:5px;background:var(--ac);border-radius:50%;animation:pulse 2s infinite}
.agent-nome{font-family:var(--hf);font-size:1.05rem;font-weight:700;color:var(--t);margin-bottom:6px}
.agent-funcao{font-size:.82rem;color:rgba(${hexToRgb(txt)},.55);line-height:1.6}

/* ─── MÉTRICAS ─── */
.metrics-sec{padding:var(--gap) 0;background:linear-gradient(135deg,rgba(${pRgb},.12) 0%,rgba(${acRgb},.06) 100%);border-radius:0}
.metrics-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:2px;background:rgba(${pRgb},.08);border-radius:16px;overflow:hidden}
.metric-card{background:rgba(${hexToRgb(bg)},.9);padding:36px 28px;text-align:center;opacity:0;transform:scale(.95);transition:opacity .4s,transform .4s;transition-delay:var(--d,0s)}
.metric-card.visible{opacity:1;transform:none}
.metric-card:hover{background:rgba(${pRgb},.1)}
.metric-num{font-family:var(--hf);font-size:clamp(2.4rem,5vw,3.4rem);font-weight:900;color:var(--ac);line-height:1;margin-bottom:8px}
.metric-label{font-size:.88rem;font-weight:600;color:var(--t);margin-bottom:4px}
.metric-periodo{font-size:.72rem;color:rgba(${hexToRgb(txt)},.45);font-weight:400}

/* ─── MAPA DE APIS ─── */
.api-sec{padding:var(--gap) 0}
.api-layout{display:flex;align-items:center;justify-content:center;gap:clamp(12px,3vw,32px);flex-wrap:wrap;position:relative;padding:40px 0}
.api-center{background:linear-gradient(135deg,var(--p),var(--s));color:var(--t);padding:28px 32px;border-radius:16px;text-align:center;font-weight:700;font-size:.95rem;min-width:160px;box-shadow:0 0 40px rgba(${pRgb},.3);position:relative;z-index:2}
.api-center::after{content:'SISTEMA CENTRAL';display:block;font-size:.6rem;letter-spacing:.18em;opacity:.7;margin-top:4px}
.api-connections{display:flex;flex-direction:column;gap:8px}
.api-node{background:rgba(${pRgb},.08);border:1px solid rgba(${pRgb},.2);padding:14px 18px;border-radius:10px;display:flex;align-items:center;gap:12px;transition:background .2s,border-color .2s;min-width:180px}
.api-node:hover{background:rgba(${pRgb},.18);border-color:rgba(${pRgb},.4)}
.api-ico{font-size:1.4rem;flex-shrink:0}
.api-nome{font-size:.86rem;font-weight:700;color:var(--t)}
.api-funcao{font-size:.73rem;color:rgba(${hexToRgb(txt)},.5)}
.api-arrow{font-size:1.5rem;color:rgba(${pRgb},.5);flex-shrink:0;animation:arrow-pulse 1.8s ease-in-out infinite}
@keyframes arrow-pulse{0%,100%{opacity:.4;transform:translateX(0)}50%{opacity:1;transform:translateX(4px)}}
@media(max-width:640px){.api-layout{flex-direction:column}.api-arrow{transform:rotate(90deg)}.api-connections{flex-direction:row;flex-wrap:wrap;justify-content:center}}

/* ─── PROVA SOCIAL ─── */
.social-sec{padding:var(--gap) 0;background:rgba(${pRgb},.04)}
.social-carousel{position:relative;overflow:hidden}
.social-track{display:flex;transition:transform .4s ease}
.social-card{min-width:100%;padding:36px;background:rgba(${pRgb},.08);border:1px solid rgba(${pRgb},.15);border-radius:16px;flex-shrink:0}
.social-stars{color:var(--ac);font-size:.9rem;letter-spacing:3px;margin-bottom:16px}
.social-texto{font-size:clamp(.9rem,2vw,1.05rem);font-style:italic;color:rgba(${hexToRgb(txt)},.85);line-height:1.8;margin-bottom:16px}
.social-resultado{display:inline-block;background:rgba(${acRgb},.15);border:1px solid rgba(${acRgb},.3);color:var(--ac);font-size:.78rem;font-weight:700;padding:5px 14px;border-radius:50px;margin-bottom:20px}
.social-autor{border-top:1px solid rgba(${pRgb},.15);padding-top:16px}
.social-autor strong{display:block;font-size:.88rem;font-weight:700;color:var(--t)}
.social-autor span{font-size:.78rem;color:rgba(${hexToRgb(txt)},.5)}
.social-dots{display:flex;justify-content:center;gap:8px;margin-top:20px}
.social-dot{width:8px;height:8px;border-radius:50%;background:rgba(${pRgb},.3);cursor:pointer;transition:background .2s,width .2s}
.social-dot.active{background:var(--ac);width:20px;border-radius:4px}
@media(min-width:768px){.social-track{flex-direction:row;display:grid;grid-template-columns:repeat(3,1fr);gap:16px;transform:none!important}.social-card{min-width:unset;flex-shrink:unset}.social-dots{display:none}}

/* ─── CTA SECUNDÁRIO ─── */
.cta2-sec{padding:clamp(40px,6vh,72px) 0;text-align:center}
.cta2-sec h2{font-family:var(--hf);font-size:clamp(1.5rem,3.5vw,2.2rem);font-weight:700;margin-bottom:12px}
.cta2-sec p{font-size:.95rem;color:rgba(${hexToRgb(txt)},.55);margin-bottom:28px;max-width:480px;margin-left:auto;margin-right:auto}

/* ─── CTA FINAL URGÊNCIA ─── */
.cta-final{padding:var(--gap) 0;text-align:center;position:relative;overflow:hidden}
.cta-final-bg{position:absolute;inset:0;background:linear-gradient(135deg,var(--s) 0%,var(--bg) 100%);pointer-events:none}
.cta-final-glow{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:500px;height:300px;background:radial-gradient(ellipse,rgba(${pRgb},.2) 0%,transparent 70%);pointer-events:none}
.cta-final-content{position:relative;z-index:1}
.urgency-tag{display:inline-block;background:rgba(${acRgb},.15);border:1px solid rgba(${acRgb},.35);color:var(--ac);padding:7px 20px;font-size:.78rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;border-radius:50px;margin-bottom:24px}
.cta-final h2{font-family:var(--hf);font-size:clamp(1.8rem,4.5vw,3rem);font-weight:900;line-height:1.1;margin-bottom:12px;max-width:700px;margin-left:auto;margin-right:auto}
.cta-final p{font-size:.95rem;color:rgba(${hexToRgb(txt)},.55);margin-bottom:36px;max-width:480px;margin-left:auto;margin-right:auto}
.btn-glow{animation:glow 2.5s ease-in-out infinite}
@keyframes glow{0%,100%{box-shadow:0 0 0 0 rgba(${pRgb},.4)}50%{box-shadow:0 0 28px 6px rgba(${pRgb},.35)}}

/* ─── FOOTER ─── */
footer{background:rgba(${pRgb},.05);border-top:1px solid rgba(${pRgb},.1);padding:32px clamp(20px,5vw,48px);text-align:center}
.ft-name{font-family:var(--hf);font-size:1rem;font-weight:700;color:var(--t);margin-bottom:4px}
.ft-copy{font-size:.72rem;color:rgba(${hexToRgb(txt)},.3)}

/* ─── FLOATING CTA ─── */
.floating-cta{position:fixed;bottom:24px;right:24px;z-index:800;opacity:0;transform:translateY(16px);transition:opacity .3s,transform .3s;pointer-events:none}
.floating-cta.visible{opacity:1;transform:none;pointer-events:auto}
.floating-btn{display:inline-flex;align-items:center;gap:9px;background:var(--p);color:var(--t);padding:13px 22px;font-size:.84rem;font-weight:700;border-radius:50px;box-shadow:0 8px 32px rgba(${pRgb},.45);transition:background .2s,box-shadow .2s}
.floating-btn:hover{background:var(--p-light);box-shadow:0 12px 40px rgba(${pRgb},.55)}
@media(max-width:640px){.floating-cta{bottom:0;right:0;left:0;border-radius:0;padding:0}.floating-btn{width:100%;border-radius:0;justify-content:center;padding:16px;font-size:.9rem}}

/* ─── EXIT INTENT MODAL ─── */
.modal-overlay{position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;pointer-events:none;transition:opacity .3s;backdrop-filter:blur(4px)}
.modal-overlay.visible{opacity:1;pointer-events:auto}
.modal{background:var(--bg);border:1px solid rgba(${pRgb},.25);border-radius:16px;padding:40px;max-width:480px;width:100%;text-align:center;transform:scale(.95);transition:transform .3s}
.modal-overlay.visible .modal{transform:none}
.modal h3{font-family:var(--hf);font-size:1.5rem;font-weight:700;color:var(--t);margin-bottom:10px}
.modal p{font-size:.9rem;color:rgba(${hexToRgb(txt)},.6);margin-bottom:28px;line-height:1.7}
.modal-close{display:block;margin:16px auto 0;background:none;border:none;color:rgba(${hexToRgb(txt)},.35);font-size:.82rem;cursor:pointer;padding:8px 16px;border-radius:6px;transition:color .2s}
.modal-close:hover{color:rgba(${hexToRgb(txt)},.6)}

/* ─── INACTIVITY TOAST ─── */
.toast{position:fixed;bottom:80px;left:24px;z-index:800;background:var(--bg);border:1px solid rgba(${pRgb},.25);border-radius:10px;padding:14px 18px 14px 16px;max-width:320px;display:flex;align-items:flex-start;gap:12px;box-shadow:0 8px 32px rgba(0,0,0,.25);opacity:0;transform:translateX(-20px);transition:opacity .3s,transform .3s;pointer-events:none}
.toast.visible{opacity:1;transform:none;pointer-events:auto}
.toast-icon{font-size:1.3rem;flex-shrink:0;margin-top:2px}
.toast-txt{font-size:.82rem;color:rgba(${hexToRgb(txt)},.8);line-height:1.5;flex:1}
.toast-close{background:none;border:none;color:rgba(${hexToRgb(txt)},.3);cursor:pointer;font-size:1rem;line-height:1;padding:0;flex-shrink:0;margin-top:2px}
@media(max-width:640px){.toast{bottom:72px;left:16px;right:16px;max-width:none}}

/* ─── SECTION UTILITIES ─── */
.section-header{margin-bottom:clamp(32px,5vh,52px)}
.section-header.center{text-align:center}

/* ─── SCROLL ANIMATIONS ─── */
.fade-up{opacity:0;transform:translateY(24px);transition:opacity .5s ease,transform .5s ease}
.fade-up.visible{opacity:1;transform:none}
</style>
</head>
<body>

<!-- NAV -->
<nav class="nav">
  <div class="wrap nav-i">
    <div class="nav-logo">${diag.nome} <span>·</span> ${city}</div>
    <div class="nav-links">
      <a href="#diagnostico">Diagnóstico</a>
      <a href="#agentes">Como funciona</a>
      <a href="#resultados">Resultados</a>
      <a href="#prova-social">Cases</a>
    </div>
    <a class="nav-cta" href="${wa}">${WA_SVG} Falar agora</a>
  </div>
</nav>

<!-- HERO -->
<section class="hero">
  <div class="hero-bg"></div>
  <div class="hero-grid"></div>
  <div class="hero-glow"></div>
  <div class="hero-content">
    <div class="hero-badge">${segLabel} · ${city}</div>
    <h1 class="hero-h1">${c.headline_hero.replace(diag.nome, `<span class="accent">${diag.nome}</span>`)}</h1>
    <p class="hero-sub">${c.sub_hero}</p>
    <div class="hero-divider"><span class="hero-divider-txt">proposta exclusiva</span></div>
    <div class="hero-ctas">
      <a class="btn-primary" href="${wa}">${WA_SVG} ${c.cta_principal}</a>
      <a class="btn-secondary" href="#agentes">${c.cta_secundario}</a>
    </div>
    <div class="hero-social">
      <span><span class="stars">★★★★★</span>&nbsp;4.9 média de resultado</span>
      <span>·</span>
      <span>7 agentes trabalhando</span>
      <span>·</span>
      <span>5 APIs integradas</span>
    </div>
  </div>
</section>

<!-- DIAGNÓSTICO -->
<section class="diag-sec" id="diagnostico">
  <div class="wrap">
    <div class="section-header">
      <span class="sec-label">análise exclusiva</span>
      <h2 class="sec-title">${c.diagnostico_titulo}</h2>
    </div>
    <div class="diag-grid">${diagItems}</div>
  </div>
</section>

<!-- 7 AGENTES -->
<section class="agents-sec" id="agentes">
  <div class="wrap">
    <div class="section-header center">
      <span class="sec-label">inteligência artificial</span>
      <h2 class="sec-title">7 agentes trabalhando para ${diag.nome}</h2>
    </div>
    <div class="agents-grid">${agentCards}</div>
  </div>
</section>

<!-- MÉTRICAS -->
<section class="metrics-sec" id="resultados">
  <div class="wrap">
    <div class="section-header center fade-up">
      <span class="sec-label">resultados comprovados</span>
      <h2 class="sec-title">O que nossos clientes conquistam em 90 dias</h2>
    </div>
    <div class="metrics-grid">${metricCards}</div>
  </div>
</section>

<!-- MAPA DE APIS -->
<section class="api-sec">
  <div class="wrap">
    <div class="section-header center fade-up">
      <span class="sec-label">ecossistema integrado</span>
      <h2 class="sec-title">5 ferramentas integradas automaticamente</h2>
    </div>
    <div class="api-layout">
      <div class="api-connections">${apiNodes.slice(0, 2)}</div>
      <div class="api-arrow">→</div>
      <div class="api-center">🤖 Automação</div>
      <div class="api-arrow">→</div>
      <div class="api-connections">${apiNodes.slice(2)}</div>
    </div>
  </div>
</section>

<!-- PROVA SOCIAL -->
<section class="social-sec" id="prova-social">
  <div class="wrap">
    <div class="section-header center fade-up">
      <span class="sec-label">casos reais</span>
      <h2 class="sec-title">Negócios do mesmo segmento já automatizaram</h2>
    </div>
    <div class="social-carousel">
      <div class="social-track" id="socialTrack">${socialCards}</div>
    </div>
    <div class="social-dots" id="socialDots">
      ${(c.prova_social || []).map((_, i) => `<div class="social-dot${i===0?' active':''}" data-index="${i}"></div>`).join('')}
    </div>
  </div>
</section>

<!-- CTA SECUNDÁRIO -->
<section class="cta2-sec">
  <div class="wrap fade-up">
    <h2>Quer ver uma demonstração real para ${diag.nome}?</h2>
    <p>Sem compromisso. Em 15 minutos você vê exatamente como funcionaria para o seu negócio.</p>
    <a class="btn-secondary" href="${wa}">${WA_SVG} ${c.cta_secundario}</a>
  </div>
</section>

<!-- CTA FINAL URGÊNCIA -->
<section class="cta-final">
  <div class="cta-final-bg"></div>
  <div class="cta-final-glow"></div>
  <div class="cta-final-content">
    <div class="wrap">
      <div class="urgency-tag">⚡ ${c.urgencia}</div>
      <h2 class="sec-title">Pronto para automatizar a captação de ${diag.nome}?</h2>
      <p>O sistema começa a trabalhar em 24 horas. Você aprova cada mensagem antes do envio.</p>
      <a class="btn-primary btn-glow" href="${wa}" style="font-size:.95rem;padding:16px 36px">${WA_SVG} ${c.cta_principal}</a>
    </div>
  </div>
</section>

<!-- FOOTER -->
<footer>
  <div class="ft-name">${diag.nome} · ${city}</div>
  <div class="ft-copy">Proposta gerada automaticamente pelo sistema de automação de captação · © ${YEAR}</div>
</footer>

<!-- FLOATING CTA -->
<div class="floating-cta" id="floatingCta">
  <a class="floating-btn" href="${wa}">${WA_SVG} ${c.cta_principal}</a>
</div>

<!-- EXIT INTENT MODAL -->
<div class="modal-overlay" id="exitModal">
  <div class="modal">
    <h3>Espera um segundo!</h3>
    <p>${c.exit_msg}</p>
    <a class="btn-primary" href="${wa}" style="width:100%;justify-content:center">${WA_SVG} Sim, quero ver</a>
    <button class="modal-close" onclick="document.getElementById('exitModal').classList.remove('visible')">Agora não</button>
  </div>
</div>

<!-- INACTIVITY TOAST -->
<div class="toast" id="inactivityToast">
  <div class="toast-icon">💡</div>
  <div class="toast-txt">${c.inatividade_msg}</div>
  <button class="toast-close" onclick="document.getElementById('inactivityToast').classList.remove('visible')">✕</button>
</div>

<script>
(function(){
  // ─── Floating CTA on scroll ───
  var floatCta = document.getElementById('floatingCta');
  var heroHeight = document.querySelector('.hero')?.offsetHeight || 500;
  function checkScroll(){
    if(window.scrollY > heroHeight * 0.7){floatCta.classList.add('visible');}
    else{floatCta.classList.remove('visible');}
  }
  window.addEventListener('scroll', checkScroll, {passive:true});

  // ─── Counter animation ───
  function animateCounter(el){
    var target = parseFloat(el.dataset.target);
    var suffix = el.dataset.suffix || '';
    var isFloat = el.dataset.target.includes('.');
    var duration = 1600;
    var start = performance.now();
    function step(now){
      var progress = Math.min((now - start) / duration, 1);
      var ease = 1 - Math.pow(1 - progress, 3);
      var val = target * ease;
      el.textContent = (isFloat ? val.toFixed(1) : Math.round(val)) + suffix;
      if(progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ─── IntersectionObserver for animations ───
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting){
        e.target.classList.add('visible');
        var counters = e.target.querySelectorAll('.counter');
        counters.forEach(animateCounter);
        io.unobserve(e.target);
      }
    });
  },{threshold:.15});

  document.querySelectorAll('.diag-card,.agent-card,.metric-card,.fade-up').forEach(function(el){
    io.observe(el);
  });

  // ─── Social carousel ───
  var track = document.getElementById('socialTrack');
  var dots = document.querySelectorAll('.social-dot');
  var cards = document.querySelectorAll('.social-card');
  var current = 0;
  var autoplay;

  function goTo(idx){
    current = idx;
    if(track) track.style.transform = 'translateX(-' + (idx * 100) + '%)';
    dots.forEach(function(d,i){d.classList.toggle('active',i===idx);});
    cards.forEach(function(c,i){c.classList.toggle('active',i===idx);});
  }

  dots.forEach(function(d){
    d.addEventListener('click',function(){
      clearInterval(autoplay);
      goTo(parseInt(this.dataset.index));
    });
  });

  if(window.innerWidth < 768){
    autoplay = setInterval(function(){
      goTo((current + 1) % (cards.length || 1));
    }, 4000);

    // Swipe support
    var sx, sy;
    if(track){
      track.addEventListener('touchstart',function(e){sx=e.touches[0].clientX;sy=e.touches[0].clientY;},{passive:true});
      track.addEventListener('touchend',function(e){
        var dx=e.changedTouches[0].clientX-sx, dy=e.changedTouches[0].clientY-sy;
        if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>40){
          clearInterval(autoplay);
          goTo(dx<0?Math.min(current+1,cards.length-1):Math.max(current-1,0));
        }
      },{passive:true});
    }
  }

  // ─── Exit intent (desktop) ───
  var exitShown = false;
  document.addEventListener('mouseleave',function(e){
    if(!exitShown && e.clientY < 10){
      exitShown = true;
      document.getElementById('exitModal').classList.add('visible');
    }
  });

  // ─── Inactivity after 45s ───
  var inactivityTimer;
  var toastShown = false;
  function resetTimer(){
    clearTimeout(inactivityTimer);
    if(!toastShown){
      inactivityTimer = setTimeout(function(){
        toastShown = true;
        document.getElementById('inactivityToast').classList.add('visible');
        setTimeout(function(){
          document.getElementById('inactivityToast').classList.remove('visible');
        },7000);
      },45000);
    }
  }
  ['mousemove','keypress','scroll','touchstart'].forEach(function(ev){
    document.addEventListener(ev, resetTimer, {passive:true});
  });
  resetTimer();

  // ─── Close modal on overlay click ───
  document.getElementById('exitModal').addEventListener('click',function(e){
    if(e.target===this) this.classList.remove('visible');
  });
})();
</script>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS (used by agent3_builder.ts)
// ─────────────────────────────────────────────────────────────────────────────
export { generateContent, buildHTML };

// ─────────────────────────────────────────────────────────────────────────────
// CLI: regenerar páginas manualmente
// ─────────────────────────────────────────────────────────────────────────────
async function regenerarTodas() {
  const files = fs.readdirSync(DATA_DIR).filter(f => f.startsWith('diagnosticos_') && f.endsWith('.json'));
  if (files.length === 0) { console.log('Nenhum arquivo de diagnósticos encontrado.'); return; }

  for (const file of files) {
    const diagnosticos: Diagnostico[] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf-8'));
    console.log(`\nProcessando ${file} — ${diagnosticos.length} diagnóstico(s)`);

    for (const diag of diagnosticos) {
      const pageDir = path.join(PAGES_DIR, diag.slug);
      if (!fs.existsSync(pageDir)) fs.mkdirSync(pageDir, { recursive: true });

      console.log(`  Gerando: ${diag.nome}...`);
      try {
        const content = await generateContent(diag);
        const html = buildHTML(diag, content);
        fs.writeFileSync(path.join(pageDir, 'index.html'), html);
        console.log(`  ✓ pages/${diag.slug}/index.html`);
      } catch (err) {
        console.error(`  ✗ ${diag.nome}: ${(err as Error).message}`);
      }
    }
  }
  console.log('\nConcluído.');
}

if (require.main === module) {
  regenerarTodas().catch(console.error);
}

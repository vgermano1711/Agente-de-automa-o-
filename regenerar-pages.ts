/**
 * Gerador de landing pages premium por segmento.
 *
 * Referências de design por segmento:
 *  barbearia    → Barbearia Corleone (barbeariacorleone.com.br)
 *  imobiliaria  → Lopes Imobiliária (lopes.com.br) / RE/MAX Brasil
 *  salao        → Jacques Janine (jacquesjanine.com.br)
 *  restaurante  → D.O.M. / Spot SP (dom.com.br)
 *  academia     → Smart Fit + Boutique Gyms SP
 *  clinica      → Clínica Radix / Odontologia premium SP
 *  construtora  → Cyrela / MRV (cyrela.com.br)
 */
import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

const client = new Anthropic();
const TODAY  = new Date().toISOString().slice(0, 10);
const YEAR   = new Date().getFullYear();
const PAGES_DIR = path.join(process.cwd(), 'pages');
const DATA_DIR  = path.join(process.cwd(), 'data');

// ─────────────────────────────────────────────────────────────────────────────
// SEGMENT DETECTION
// ─────────────────────────────────────────────────────────────────────────────
function getSegment(cat: string): string {
  const c = cat.toLowerCase();
  if (c.includes('barbearia') || c.includes('barber'))             return 'barbearia';
  if (c.includes('imobil') || c.includes('corretor') || c.includes('imóvel')) return 'imobiliaria';
  if (c.includes('salão') || c.includes('salon') || c.includes('cabelei') || c.includes('beleza') || c.includes('estética')) return 'salao';
  if (c.includes('restaurante') || c.includes('pizza') || c.includes('hambúrguer') || c.includes('comida') || c.includes('bar e')) return 'restaurante';
  if (c.includes('academia') || c.includes('gym') || c.includes('fitness') || c.includes('personal')) return 'academia';
  if (c.includes('clínica') || c.includes('clinica') || c.includes('dentist') || c.includes('médico') || c.includes('odonto') || c.includes('saúde')) return 'clinica';
  if (c.includes('constru') || c.includes('reforma') || c.includes('incorpor')) return 'construtora';
  return 'default';
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT GENERATION (Claude → JSON)
// ─────────────────────────────────────────────────────────────────────────────
const PROMPTS: Record<string, (d: any) => string> = {

  barbearia: (d) => `Copywriter premium para barbearias brasileiras. Tom: clássico, masculino, artesão.
Negócio: ${d.nome} | Cidade: ${d.cidade} | Proposta: ${d.proposta_de_valor} | Ângulo: ${d.angulo_de_venda}
Retorne APENAS JSON válido:
{"headline_linha1":"3-4 palavras maiúsculas impactantes","headline_linha2":"3-4 palavras maiúsculas complemento","tagline":"1 frase curta elegante","sobre_titulo":"título curto da seção sobre","sobre_texto":"2-3 frases essência do negócio, tom artesão, sem clichês","servicos":[{"simbolo":"✦","nome":"Corte Masculino","descricao":"1 linha elegante","preco":"A partir de R$ 50"},{"simbolo":"✦","nome":"Barba Completa","descricao":"1 linha elegante","preco":"A partir de R$ 40"},{"simbolo":"✦","nome":"Corte & Barba","descricao":"1 linha elegante","preco":"A partir de R$ 80"},{"simbolo":"✦","nome":"Tratamento Capilar","descricao":"1 linha elegante","preco":"A partir de R$ 60"}],"numeros":[{"valor":"500+","label":"Clientes Atendidos"},{"valor":"5★","label":"Avaliação Google"},{"valor":"100%","label":"Satisfação"}],"depoimentos":[{"texto":"depoimento realista 2 frases cliente fiel","nome":"Rafael M.","cargo":"Cliente fiel"},{"texto":"depoimento sobre ambiente ou serviço","nome":"Lucas S.","cargo":"Cliente fiel"},{"texto":"depoimento sobre resultado","nome":"André P.","cargo":"Cliente fiel"}],"faq":[{"pergunta":"É necessário agendar?","resposta":"resposta direta 2 frases"},{"pergunta":"Quais formas de pagamento?","resposta":"resposta direta"},{"pergunta":"Quanto tempo demora?","resposta":"resposta específica"}],"nota_google":"4.9","total_avaliacoes":"mais de 300","horario":"Seg–Sáb: 9h–20h | Dom: 9h–16h","cta_texto":"Agendar Meu Horário"}`,

  imobiliaria: (d) => `Copywriter premium para imobiliárias brasileiras. Tom: consultivo, confiável, profissional.
Negócio: ${d.nome} | Cidade: ${d.cidade} | Proposta: ${d.proposta_de_valor} | Ângulo: ${d.angulo_de_venda}
Retorne APENAS JSON válido:
{"headline":"headline impactante 6-8 palavras sobre encontrar o imóvel ideal","subheadline":"complemento 1 frase sobre a missão","sobre_titulo":"título seção sobre a imobiliária","sobre_texto":"2-3 frases sobre experiência e diferenciais, tom consultivo","servicos":[{"icone":"🏠","nome":"Comprar","descricao":"ajudamos a encontrar o imóvel ideal no seu orçamento"},{"icone":"💰","nome":"Vender","descricao":"avaliação precisa e estratégia para vender mais rápido"},{"icone":"🔑","nome":"Alugar","descricao":"locação segura com assessoria completa"},{"icone":"📋","nome":"Avaliar","descricao":"avaliação profissional gratuita do seu imóvel"}],"numeros":[{"valor":"10+","label":"Anos de Mercado"},{"valor":"500+","label":"Imóveis Negociados"},{"valor":"4.9★","label":"Google"}],"depoimentos":[{"texto":"depoimento compra de imóvel bem-sucedida 2 frases","nome":"Carlos R.","cargo":"Comprou apartamento em ${d.cidade}"},{"texto":"depoimento venda rápida 2 frases","nome":"Fernanda M.","cargo":"Vendeu imóvel em 30 dias"},{"texto":"depoimento locação tranquila 2 frases","nome":"Marcos A.","cargo":"Alugou sala comercial"}],"faq":[{"pergunta":"Como funciona a avaliação gratuita?","resposta":"resposta direta 2 frases"},{"pergunta":"Qual a comissão cobrada?","resposta":"resposta direta transparente"},{"pergunta":"Vocês atendem qual região?","resposta":"resposta específica para ${d.cidade}"}],"nota_google":"4.9","total_avaliacoes":"mais de 400","horario":"Seg–Sex: 8h–18h | Sáb: 9h–14h","cta_texto":"Falar com um Corretor"}`,

  salao: (d) => `Copywriter para salão de beleza premium feminino. Tom: elegante, sofisticado, acolhedor.
Negócio: ${d.nome} | Cidade: ${d.cidade} | Proposta: ${d.proposta_de_valor}
Retorne APENAS JSON válido:
{"headline":"headline elegante 5-7 palavras sobre beleza e autoestima","subheadline":"1 frase sobre experiência única","sobre_titulo":"título da seção sobre","sobre_texto":"2-3 frases sobre cuidado, expertise, ambiente especial","servicos":[{"icone":"✂","nome":"Corte & Styling","descricao":"cortes personalizados por especialistas"},{"icone":"🎨","nome":"Coloração","descricao":"técnicas modernas com produtos premium"},{"icone":"💆","nome":"Tratamentos","descricao":"hidratação, botox capilar e reconstrução"},{"icone":"💅","nome":"Manicure & Pedicure","descricao":"acabamento perfeito com nail art"}],"numeros":[{"valor":"1.000+","label":"Clientes Satisfeitas"},{"valor":"5★","label":"Avaliação Google"},{"valor":"8+","label":"Anos de Expertise"}],"depoimentos":[{"texto":"depoimento sobre transformação e autoestima 2 frases","nome":"Ana P.","cargo":"Cliente fiel há 3 anos"},{"texto":"depoimento sobre ambiente e atendimento 2 frases","nome":"Camila R.","cargo":"Cliente fiel"},{"texto":"depoimento sobre coloração ou tratamento 2 frases","nome":"Juliana M.","cargo":"Cliente fiel"}],"faq":[{"pergunta":"Preciso agendar com antecedência?","resposta":"resposta direta"},{"pergunta":"Usam produtos veganos?","resposta":"resposta direta"},{"pergunta":"Atendem coloração e mechas no mesmo dia?","resposta":"resposta direta"}],"nota_google":"4.9","total_avaliacoes":"mais de 250","horario":"Ter–Sáb: 9h–19h | Dom: 9h–14h","cta_texto":"Agendar pelo WhatsApp"}`,

  restaurante: (d) => `Copywriter para restaurante premium brasileiro. Tom: gastronômico, acolhedor, sofisticado.
Negócio: ${d.nome} | Cidade: ${d.cidade} | Proposta: ${d.proposta_de_valor}
Retorne APENAS JSON válido:
{"headline":"headline gastronômica impactante 4-6 palavras","subheadline":"1 frase sobre a experiência gastronômica","sobre_titulo":"título da seção sobre","sobre_texto":"2-3 frases sobre a cozinha, ingredientes, história do restaurante","categorias":[{"icone":"🍝","nome":"Massas Artesanais","descricao":"receitas tradicionais preparadas diariamente","destaque":"Destaque do chef"},{"icone":"🥩","nome":"Carnes & Grelhados","descricao":"cortes selecionados e preparo na medida certa","destaque":"Mais pedido"},{"icone":"🥗","nome":"Entradas & Saladas","descricao":"ingredientes frescos e temperos especiais","destaque":"Vegetariano"},{"icone":"🍮","nome":"Sobremesas","descricao":"doces artesanais feitos na casa","destaque":"Imperdível"}],"numeros":[{"valor":"5+","label":"Anos de Tradição"},{"valor":"4.9★","label":"Google"},{"valor":"100%","label":"Feito na Casa"}],"depoimentos":[{"texto":"depoimento sobre comida e sabor 2 frases","nome":"Paulo S.","cargo":"Cliente assíduo"},{"texto":"depoimento sobre ambiente e atendimento 2 frases","nome":"Renata M.","cargo":"Celebra aniversários aqui"},{"texto":"depoimento sobre custo-benefício 2 frases","nome":"Fernando C.","cargo":"Almoço semanal"}],"faq":[{"pergunta":"Fazem reservas para grupos?","resposta":"resposta direta"},{"pergunta":"Tem opções vegetarianas?","resposta":"resposta direta"},{"pergunta":"Aceitam quais formas de pagamento?","resposta":"resposta direta"}],"nota_google":"4.8","total_avaliacoes":"mais de 350","horario":"Seg–Sex: 11h–15h, 18h–23h | Sáb–Dom: 11h–23h","cta_texto":"Reservar Mesa pelo WhatsApp"}`,

  academia: (d) => `Copywriter para academia/gym. Tom: motivacional, direto, transformação.
Negócio: ${d.nome} | Cidade: ${d.cidade} | Proposta: ${d.proposta_de_valor}
Retorne APENAS JSON válido:
{"headline":"headline poderosa 4-6 palavras sobre transformação","subheadline":"1 frase sobre resultado e mudança","sobre_titulo":"Nossa Metodologia","sobre_texto":"2-3 frases sobre abordagem, estrutura, profissionais","modalidades":[{"icone":"💪","nome":"Musculação","descricao":"equipamentos modernos e personal trainer disponível"},{"icone":"🥊","nome":"Muay Thai / Luta","descricao":"treinos para todos os níveis com mestres certificados"},{"icone":"🧘","nome":"Yoga & Pilates","descricao":"mobilidade, postura e equilíbrio"},{"icone":"🏃","nome":"Cardio & HIIT","descricao":"queima de gordura e condicionamento físico"}],"planos":[{"nome":"Mensal","preco":"R$ 89/mês","items":["Acesso às modalidades","Armário exclusivo","Avaliação física"]},{"nome":"Semestral","preco":"R$ 69/mês","items":["Tudo do mensal","1 Personal grátis/mês","Desconto na matrícula"],"destaque":true},{"nome":"Anual","preco":"R$ 59/mês","items":["Tudo do semestral","Programa de nutrição","Freeze de 30 dias"]}],"numeros":[{"valor":"500+","label":"Alunos Ativos"},{"valor":"15+","label":"Modalidades"},{"valor":"5★","label":"Google"}],"depoimentos":[{"texto":"depoimento transformação física 2 frases","nome":"Thiago M.","cargo":"Aluno há 1 ano"},{"texto":"depoimento sobre ambiente e profissionais 2 frases","nome":"Bruna S.","cargo":"Aluna fiel"},{"texto":"depoimento sobre resultado específico 2 frases","nome":"Ricardo A.","cargo":"Personal training"}],"faq":[{"pergunta":"Posso experimentar uma aula antes de fechar?","resposta":"resposta direta"},{"pergunta":"Tem avaliação física gratuita?","resposta":"resposta direta"},{"pergunta":"Preciso ter experiência prévia?","resposta":"resposta acolhedora para iniciantes"}],"nota_google":"4.8","total_avaliacoes":"mais de 200","horario":"Seg–Sex: 6h–23h | Sáb: 8h–18h | Dom: 9h–14h","cta_texto":"Quero Começar Agora"}`,

  clinica: (d) => `Copywriter para clínica de saúde premium brasileira. Tom: profissional, acolhedor, confiável.
Negócio: ${d.nome} | Cidade: ${d.cidade} | Proposta: ${d.proposta_de_valor}
Retorne APENAS JSON válido:
{"headline":"headline sobre saúde e bem-estar 5-7 palavras","subheadline":"1 frase sobre cuidado especializado","sobre_titulo":"Nossa Clínica","sobre_texto":"2-3 frases sobre especialidade, equipe, estrutura, tecnologia","tratamentos":[{"icone":"🦷","nome":"Clareamento Dental","descricao":"tecnologia LED para resultado em 1 sessão"},{"icone":"😁","nome":"Alinhamento Invisível","descricao":"aparelho transparente discreto e confortável"},{"icone":"✨","nome":"Lentes de Contato","descricao":"sorriso perfeito em porcelana premium"},{"icone":"🩺","nome":"Consulta & Avaliação","descricao":"diagnóstico completo sem compromisso"}],"numeros":[{"valor":"2.000+","label":"Pacientes Atendidos"},{"valor":"10+","label":"Anos de Experiência"},{"valor":"4.9★","label":"Google"}],"depoimentos":[{"texto":"depoimento sobre resultado estético 2 frases","nome":"Marina C.","cargo":"Paciente há 2 anos"},{"texto":"depoimento sobre atendimento humanizado 2 frases","nome":"Beatriz F.","cargo":"Indicou para toda família"},{"texto":"depoimento sobre transformação do sorriso 2 frases","nome":"Gabriel R.","cargo":"Tratamento completo"}],"faq":[{"pergunta":"A primeira consulta é gratuita?","resposta":"resposta direta"},{"pergunta":"Aceitam planos de saúde?","resposta":"resposta direta"},{"pergunta":"Quanto tempo dura o tratamento?","resposta":"resposta sobre os principais tratamentos"}],"nota_google":"4.9","total_avaliacoes":"mais de 500","horario":"Seg–Sex: 8h–19h | Sáb: 8h–13h","cta_texto":"Agendar Avaliação Gratuita"}`,

  construtora: (d) => `Copywriter para construtora/incorporadora. Tom: sólido, confiável, premium.
Negócio: ${d.nome} | Cidade: ${d.cidade} | Proposta: ${d.proposta_de_valor}
Retorne APENAS JSON válido:
{"headline":"headline sobre construção e qualidade 4-6 palavras","subheadline":"1 frase sobre solidez e experiência","sobre_titulo":"Nossa Empresa","sobre_texto":"2-3 frases sobre anos de mercado, obras entregues, compromisso com qualidade","servicos":[{"icone":"🏗","nome":"Construção Residencial","descricao":"casas e apartamentos do projeto à entrega"},{"icone":"🏢","nome":"Obras Comerciais","descricao":"salas, lojas e galpões com acabamento superior"},{"icone":"🔨","nome":"Reformas","descricao":"renovação completa com gerenciamento total"},{"icone":"📐","nome":"Projetos & Plantas","descricao":"arquitetura e engenharia integradas"}],"numeros":[{"valor":"50+","label":"Obras Entregues"},{"valor":"15+","label":"Anos no Mercado"},{"valor":"4.9★","label":"Google"}],"depoimentos":[{"texto":"depoimento sobre qualidade de entrega 2 frases","nome":"José A.","cargo":"Casa própria entregue"},{"texto":"depoimento sobre prazo e comunicação 2 frases","nome":"Empresa XY","cargo":"Obra comercial"},{"texto":"depoimento sobre pós-obra e suporte 2 frases","nome":"Ricardo N.","cargo":"Cliente fidelizado"}],"faq":[{"pergunta":"Fazem orçamento gratuito?","resposta":"resposta direta"},{"pergunta":"Qual a garantia das obras?","resposta":"resposta com prazos"},{"pergunta":"Trabalham em toda a cidade?","resposta":"resposta específica para ${d.cidade}"}],"nota_google":"4.9","total_avaliacoes":"mais de 150","horario":"Seg–Sex: 8h–18h | Sáb: 8h–12h","cta_texto":"Solicitar Orçamento Gratuito"}`,

  default: (d) => `Copywriter premium para negócio local brasileiro.
Negócio: ${d.nome} | Categoria: ${d.categoria} | Cidade: ${d.cidade} | Proposta: ${d.proposta_de_valor}
Retorne APENAS JSON válido:
{"headline":"headline impactante 5-7 palavras","subheadline":"1 frase complementar","sobre_titulo":"Sobre Nós","sobre_texto":"2-3 frases essência do negócio","servicos":[{"icone":"✦","nome":"Serviço Principal","descricao":"descrição 1 linha"},{"icone":"✦","nome":"Serviço 2","descricao":"descrição 1 linha"},{"icone":"✦","nome":"Serviço 3","descricao":"descrição 1 linha"},{"icone":"✦","nome":"Serviço 4","descricao":"descrição 1 linha"}],"numeros":[{"valor":"500+","label":"Clientes"},{"valor":"5★","label":"Google"},{"valor":"100%","label":"Satisfação"}],"depoimentos":[{"texto":"depoimento 2 frases","nome":"João S.","cargo":"Cliente fiel"},{"texto":"depoimento 2 frases","nome":"Maria R.","cargo":"Cliente fiel"},{"texto":"depoimento 2 frases","nome":"Pedro A.","cargo":"Cliente fiel"}],"faq":[{"pergunta":"Como funciona o atendimento?","resposta":"resposta direta"},{"pergunta":"Quais formas de pagamento?","resposta":"resposta direta"},{"pergunta":"Fazem atendimento no local?","resposta":"resposta direta"}],"nota_google":"4.9","total_avaliacoes":"mais de 200","horario":"Seg–Sex: 9h–18h | Sáb: 9h–13h","cta_texto":"Falar pelo WhatsApp"}`,
};

async function generateContent(diag: any): Promise<any> {
  const segment = getSegment(diag.categoria);
  const promptFn = PROMPTS[segment] || PROMPTS.default;
  const prompt = promptFn(diag);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  let text = (response.content[0] as any).text.trim();
  text = text.replace(/^```[^\n]*\n?/, '').replace(/\n?```$/, '').trim();

  // extract the outermost {...} block in case there's stray text
  const m = text.match(/\{[\s\S]*\}/);
  if (m) text = m[0];

  return JSON.parse(text);
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED UTILS
// ─────────────────────────────────────────────────────────────────────────────
function waLink(phone: string, msg = 'Olá! Gostaria de saber mais.'): string {
  const n = phone.replace(/\D/g, '');
  return `https://wa.me/55${n}?text=${encodeURIComponent(msg)}`;
}
function cityShort(cidade: string): string { return cidade.split(',')[0]; }
function estYear(diag: any): number { return YEAR - 5; }

const WA_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.116 1.524 5.847L.055 23.03a1 1 0 001.213 1.213l5.183-1.469A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.653-.502-5.183-1.38l-.371-.218-3.842 1.089 1.089-3.842-.218-.371A9.953 9.953 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>`;

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE: BARBEARIA — estilo Corleone (escuro, dourado, serif clássico)
// ─────────────────────────────────────────────────────────────────────────────
function buildBarbearia(diag: any, c: any): string {
  const wa = waLink(diag.telefone, 'Olá! Gostaria de agendar um horário.');
  const city = cityShort(diag.cidade);
  const est = estYear(diag);
  const srvHTML = (c.servicos||[]).map((s:any)=>`
        <div class="srv-card"><span class="srv-sym">✦</span><h3 class="srv-name">${s.nome}</h3><div class="srv-ln"></div><p class="srv-desc">${s.descricao}</p><span class="srv-price">${s.preco||''}</span></div>`).join('');
  const numHTML = (c.numeros||[]).map((n:any)=>`<div class="ni"><span class="nv">${n.valor}</span><span class="nl">${n.label}</span></div>`).join('');
  const depHTML = (c.depoimentos||[]).map((d:any)=>`<div class="dep"><div class="dq">"</div><p class="dt">${d.texto}</p><div class="da"><strong>${d.nome}</strong><span>${d.cargo}</span></div></div>`).join('');
  const faqHTML = (c.faq||[]).map((f:any)=>`<div class="fq" onclick="this.classList.toggle('o')"><div class="fp"><span>${f.pergunta}</span><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 6l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></div><div class="fr">${f.resposta}</div></div>`).join('');
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${diag.nome} | ${city}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,400&family=Cormorant+Garamond:ital,wght@0,300;1,300&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--ink:#080705;--ink2:#100e0a;--ink3:#1a1710;--cream:#f2ece2;--gold:#c8a46a;--gold2:#e2ba7a;--gdim:#8a6e3e;--gray:#9a9080;--bd:rgba(200,164,106,.18);--bd2:rgba(200,164,106,.08)}
html{scroll-behavior:smooth}body{font-family:'Inter',sans-serif;background:var(--ink);color:var(--cream);line-height:1.7;-webkit-font-smoothing:antialiased;overflow-x:hidden}
a{color:inherit;text-decoration:none}::selection{background:var(--gold);color:var(--ink)}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:var(--gdim)}
.wrap{max-width:1100px;margin:0 auto;padding:0 28px}
/* NAV */
nav{position:sticky;top:0;z-index:200;background:rgba(8,7,5,.96);backdrop-filter:blur(16px);border-bottom:1px solid var(--bd2)}
.nav-i{display:flex;align-items:center;justify-content:space-between;height:68px}
.nb{display:flex;flex-direction:column;line-height:1}.nb-n{font-family:'Playfair Display',serif;font-size:1.1rem;font-weight:700;color:var(--cream)}.nb-s{font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);margin-top:2px}
.nl a{font-size:.75rem;letter-spacing:.12em;text-transform:uppercase;color:var(--gray);margin-left:28px;transition:color .2s}.nl a:hover{color:var(--cream)}
.nbtn{border:1px solid var(--gold);color:var(--gold);padding:9px 22px;font-size:.75rem;letter-spacing:.1em;text-transform:uppercase;font-weight:600;transition:background .2s,color .2s}.nbtn:hover{background:var(--gold);color:var(--ink)}
@media(max-width:700px){.nl{display:none}}
/* HERO */
.hero{min-height:100svh;display:flex;align-items:center;justify-content:center;text-align:center;padding:80px 28px 60px;position:relative;overflow:hidden;background:var(--ink)}
.htex{position:absolute;inset:0;background-image:repeating-linear-gradient(0deg,transparent,transparent 50px,rgba(200,164,106,.015) 50px,rgba(200,164,106,.015) 51px),repeating-linear-gradient(90deg,transparent,transparent 50px,rgba(200,164,106,.015) 50px,rgba(200,164,106,.015) 51px);pointer-events:none}
.hglow{position:absolute;top:-20%;left:50%;transform:translateX(-50%);width:600px;height:600px;background:radial-gradient(circle,rgba(200,164,106,.07) 0%,transparent 70%);pointer-events:none}
.hframe{border:1px solid var(--bd);padding:56px 48px 48px;position:relative;max-width:700px;width:100%}
.hframe::before,.hframe::after{content:'';position:absolute;width:18px;height:18px;border-color:var(--gold);border-style:solid}
.hframe::before{top:-1px;left:-1px;border-width:2px 0 0 2px}.hframe::after{bottom:-1px;right:-1px;border-width:0 2px 2px 0}
.hcorner::before,.hcorner::after{content:'';position:absolute;width:18px;height:18px;border-color:var(--gold);border-style:solid}
.hcorner::before{top:-1px;right:-1px;border-width:2px 2px 0 0}.hcorner::after{bottom:-1px;left:-1px;border-width:0 0 2px 2px}
.hest{font-size:.65rem;letter-spacing:.3em;text-transform:uppercase;color:var(--gold);font-family:'Cormorant Garamond',serif;font-style:italic;margin-bottom:24px}
.hh1{font-family:'Playfair Display',serif;font-size:clamp(2.4rem,8vw,5rem);font-weight:900;line-height:1;color:var(--cream);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px}.hh1 span{color:var(--gold)}
.htag{font-family:'Cormorant Garamond',serif;font-size:clamp(1rem,2.5vw,1.3rem);font-style:italic;color:var(--gray);margin:20px 0 32px;letter-spacing:.03em}
.hdiv{display:flex;align-items:center;gap:12px;justify-content:center;margin-bottom:32px}.hdiv-l{width:48px;height:1px;background:var(--gdim)}.hdiv-s{color:var(--gold);font-size:.85rem}
.btn{display:inline-flex;align-items:center;gap:8px;background:var(--gold);color:var(--ink);padding:14px 32px;font-size:.8rem;letter-spacing:.14em;text-transform:uppercase;font-weight:700;transition:background .2s}.btn:hover{background:var(--gold2)}
.btn2{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--bd);color:var(--cream);padding:13px 28px;font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;font-weight:500;transition:border-color .2s;margin-left:14px}.btn2:hover{border-color:var(--gold)}
.hrat{display:flex;align-items:center;gap:8px;justify-content:center;margin-top:32px;font-size:.78rem;color:var(--gray);letter-spacing:.06em}.hst{color:var(--gold);letter-spacing:2px}
/* NUMBERS */
.nband{border-top:1px solid var(--bd2);border-bottom:1px solid var(--bd2);background:var(--ink2);padding:48px 28px}
.ngrid{display:flex;justify-content:center;flex-wrap:wrap}
.ni{text-align:center;padding:0 48px;position:relative}.ni+.ni::before{content:'';position:absolute;left:0;top:50%;transform:translateY(-50%);width:1px;height:40px;background:var(--bd)}
.nv{display:block;font-family:'Playfair Display',serif;font-size:2.6rem;font-weight:700;color:var(--gold);line-height:1}.nl{display:block;font-size:.68rem;letter-spacing:.18em;text-transform:uppercase;color:var(--gray);margin-top:6px}
/* SOBRE */
.ssec{padding:100px 28px;background:var(--ink)}
.si{display:grid;grid-template-columns:1fr 1fr;gap:80px;align-items:center;max-width:1100px;margin:0 auto}
.simg{aspect-ratio:3/4;background:linear-gradient(160deg,var(--ink3),var(--ink2));position:relative;overflow:hidden}
.simg::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(45deg,transparent,transparent 40px,rgba(200,164,106,.03) 40px,rgba(200,164,106,.03) 41px)}
.simg-i{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;border:1px solid var(--bd2);margin:20px}
.simg-sym{font-size:3rem;opacity:.3;color:var(--gold)}.simg-t{font-family:'Cormorant Garamond',serif;font-style:italic;font-size:1rem;color:var(--gdim);letter-spacing:.1em}
.stag{font-size:.65rem;letter-spacing:.25em;text-transform:uppercase;color:var(--gold);font-weight:600;margin-bottom:12px;display:block}
.stit{font-family:'Playfair Display',serif;font-size:clamp(1.8rem,4vw,2.6rem);font-weight:700;margin-bottom:12px}
.gline{width:40px;height:2px;background:var(--gold);margin:0 0 28px}
.stxt{font-family:'Cormorant Garamond',serif;font-size:1.15rem;color:rgba(242,236,226,.75);line-height:1.9;margin-bottom:28px}
.sdet{display:flex;align-items:center;gap:12px;font-size:.78rem;letter-spacing:.1em;text-transform:uppercase;color:var(--gray);margin-bottom:10px}.sdot{width:4px;height:4px;background:var(--gold);border-radius:50%}
@media(max-width:800px){.si{grid-template-columns:1fr}.simg{display:none}}
/* SERVIÇOS */
.srvsec{padding:100px 28px;background:var(--ink2)}
.srvsec-h{text-align:center;margin-bottom:64px}
.srvgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:1px;background:var(--bd2)}
.srv-card{background:var(--ink2);padding:44px 28px;text-align:center;transition:background .25s;position:relative;overflow:hidden}
.srv-card::after{content:'';position:absolute;bottom:0;left:0;right:0;height:2px;background:var(--gold);transform:scaleX(0);transition:transform .3s;transform-origin:left}
.srv-card:hover{background:var(--ink3)}.srv-card:hover::after{transform:scaleX(1)}
.srv-sym{display:block;font-size:.85rem;color:var(--gold);letter-spacing:.3em;margin-bottom:20px}
.srv-name{font-family:'Playfair Display',serif;font-size:1.2rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:14px}
.srv-ln{width:28px;height:1px;background:var(--gdim);margin:0 auto 14px}
.srv-desc{font-size:.85rem;color:var(--gray);line-height:1.7;margin-bottom:18px}
.srv-price{font-size:.75rem;letter-spacing:.1em;color:var(--gold);border:1px solid var(--bd);padding:5px 14px;display:inline-block}
/* DEPOIMENTOS */
.depsec{padding:100px 28px;background:var(--ink)}
.depsec-h{text-align:center;margin-bottom:64px}
.depgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1px;background:var(--bd2);max-width:1100px;margin:0 auto}
.dep{background:var(--ink);padding:44px 36px;position:relative}
.dq{font-family:'Playfair Display',serif;font-size:5rem;line-height:.8;color:var(--gold);opacity:.25;position:absolute;top:24px;left:32px;pointer-events:none}
.dt{font-family:'Cormorant Garamond',serif;font-size:1.1rem;font-style:italic;color:rgba(242,236,226,.8);line-height:1.85;margin-bottom:28px;position:relative;z-index:1}
.da{border-top:1px solid var(--bd2);padding-top:20px}.da strong{display:block;font-size:.85rem;letter-spacing:.08em;text-transform:uppercase;color:var(--cream)}.da span{font-size:.75rem;color:var(--gold);display:block;margin-top:2px}
/* FAQ */
.faqsec{padding:100px 28px;background:var(--ink2)}
.faqsec-h{text-align:center;margin-bottom:56px}
.faqlist{max-width:720px;margin:0 auto}
.fq{border-bottom:1px solid var(--bd2);cursor:pointer}
.fp{display:flex;justify-content:space-between;align-items:center;padding:22px 4px;font-size:.9rem;color:var(--cream);transition:color .2s}.fp svg{flex-shrink:0;transition:transform .25s;color:var(--gold);opacity:.7}
.fq.o .fp{color:var(--gold)}.fq.o .fp svg{transform:rotate(180deg)}
.fr{display:none;font-family:'Cormorant Garamond',serif;font-size:1rem;color:var(--gray);padding:0 4px 22px;line-height:1.8}.fq.o .fr{display:block}
/* CONTATO */
.ctsec{padding:80px 28px;background:var(--ink);text-align:center}
.ctgrid{display:flex;justify-content:center;flex-wrap:wrap;max-width:900px;margin:0 auto 48px;border:1px solid var(--bd2)}
.ctcard{flex:1;min-width:190px;padding:40px 24px;border-right:1px solid var(--bd2)}.ctcard:last-child{border-right:none}
.cticon{font-size:1.4rem;margin-bottom:14px;display:block}.ctlbl{font-size:.6rem;letter-spacing:.22em;text-transform:uppercase;color:var(--gold);margin-bottom:8px;font-weight:600}
.ctval{font-family:'Cormorant Garamond',serif;font-size:1.05rem;color:var(--cream);line-height:1.5}
@media(max-width:600px){.ctcard{border-right:none;border-bottom:1px solid var(--bd2)}}
/* CTA FINAL */
.cfinal{padding:120px 28px;background:var(--ink2);text-align:center;position:relative;overflow:hidden}
.cfinal::before{content:'';position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:500px;height:500px;background:radial-gradient(circle,rgba(200,164,106,.06) 0%,transparent 70%);pointer-events:none}
.cfinal-i{position:relative;z-index:1}
.ornament{display:flex;align-items:center;gap:16px;justify-content:center;margin:0 0 28px}
.ornament::before,.ornament::after{content:'';flex:1;max-width:120px;height:1px;background:linear-gradient(90deg,transparent,var(--gdim),transparent)}
.ornament-t{color:var(--gold);font-family:'Cormorant Garamond',serif;font-style:italic;font-size:.9rem;white-space:nowrap}
.cfinal h2{font-family:'Playfair Display',serif;font-size:clamp(2rem,5vw,3.2rem);font-weight:700;color:var(--cream);text-transform:uppercase;letter-spacing:.04em;margin-bottom:14px}
.cfinal p{font-family:'Cormorant Garamond',serif;font-size:1.2rem;font-style:italic;color:var(--gray);margin-bottom:40px}
/* FOOTER */
footer{background:var(--ink);border-top:1px solid var(--bd2);padding:40px 28px;text-align:center}
.fn{font-family:'Playfair Display',serif;font-size:1.2rem;color:var(--gold);margin-bottom:6px}
.fc{font-size:.68rem;letter-spacing:.2em;text-transform:uppercase;color:var(--gray);margin-bottom:12px}
.fcp{font-size:.72rem;color:rgba(154,144,128,.4)}
/* SECTION TITLES */
.sec-tag{font-size:.65rem;letter-spacing:.25em;text-transform:uppercase;color:var(--gold);font-weight:600;margin-bottom:12px;display:block}
.sec-tit{font-family:'Playfair Display',serif;font-size:clamp(1.8rem,4vw,2.6rem);font-weight:700;margin-bottom:12px}
@media(max-width:600px){.hframe{padding:40px 24px 36px}.hh1{font-size:2.8rem}.btn2{display:none}.ni{padding:20px 24px}}
</style></head><body>
<nav><div class="wrap nav-i">
  <div class="nb"><span class="nb-n">${diag.nome}</span><span class="nb-s">${city} · Est. ${est}</span></div>
  <div class="nl"><a href="#servicos">Serviços</a><a href="#sobre">Sobre</a><a href="#contato">Contato</a></div>
  <a class="nbtn" href="${wa}">Agendar</a>
</div></nav>
<section class="hero"><div class="htex"></div><div class="hglow"></div>
  <div class="hframe hcorner">
    <p class="hest">✦ ${city} · Desde ${est} ✦</p>
    <h1 class="hh1">${c.headline_linha1||'TRADIÇÃO E'}<br><span>${c.headline_linha2||'EXCELÊNCIA'}</span></h1>
    <p class="htag">${c.tagline||''}</p>
    <div class="hdiv"><div class="hdiv-l"></div><span class="hdiv-s">✦</span><div class="hdiv-l"></div></div>
    <div><a class="btn" href="${wa}">${WA_SVG} ${c.cta_texto||'Agendar Horário'}</a><a class="btn2" href="#servicos">Ver Serviços</a></div>
    <div class="hrat"><span class="hst">★★★★★</span>&nbsp;${c.nota_google||'4.9'} · ${c.total_avaliacoes||'centenas de'} avaliações no Google</div>
  </div>
</section>
<div class="nband"><div class="ngrid">${numHTML}</div></div>
<section class="ssec" id="sobre"><div class="si">
  <div class="simg"><div class="simg-i"><div class="simg-sym">✦</div><div class="simg-t">${diag.nome}</div></div></div>
  <div><span class="stag">Nossa Essência</span><h2 class="stit">${c.sobre_titulo||'Nossa Tradição'}</h2><div class="gline"></div><p class="stxt">${c.sobre_texto||''}</p>
    <div class="sdet"><div class="sdot"></div>Profissionais certificados</div>
    <div class="sdet"><div class="sdot"></div>Produtos premium selecionados</div>
    <div class="sdet"><div class="sdot"></div>Atendimento por agendamento</div>
    <br><a class="btn" href="${wa}" style="margin-top:12px">Agendar Agora</a></div>
</div></section>
<section class="srvsec" id="servicos"><div class="srvsec-h"><span class="sec-tag">O que oferecemos</span><h2 class="sec-tit">Nossos Serviços</h2><div class="gline" style="margin:14px auto 0"></div></div>
<div class="wrap"><div class="srvgrid">${srvHTML}</div></div></section>
<section class="depsec"><div class="depsec-h"><span class="sec-tag">Quem frequenta</span><h2 class="sec-tit">O Que Dizem</h2><div class="gline" style="margin:14px auto 0"></div></div>
<div class="wrap"><div class="depgrid">${depHTML}</div></div></section>
<section class="faqsec"><div class="faqsec-h"><span class="sec-tag">Tire suas dúvidas</span><h2 class="sec-tit">Perguntas Frequentes</h2><div class="gline" style="margin:14px auto 0"></div></div>
<div class="faqlist">${faqHTML}</div></section>
<section class="ctsec" id="contato"><span class="sec-tag">Venha nos visitar</span><h2 class="sec-tit" style="margin-bottom:36px">Onde Estamos</h2>
<div class="ctgrid">
  <div class="ctcard"><span class="cticon">📞</span><div class="ctlbl">WhatsApp</div><div class="ctval">${diag.telefone}</div></div>
  <div class="ctcard"><span class="cticon">📍</span><div class="ctlbl">Cidade</div><div class="ctval">${diag.cidade}</div></div>
  <div class="ctcard"><span class="cticon">🕐</span><div class="ctlbl">Horário</div><div class="ctval">${c.horario||''}</div></div>
</div>
<a class="btn" href="${wa}">${WA_SVG} Agendar pelo WhatsApp</a></section>
<section class="cfinal"><div class="cfinal-i">
  <div class="ornament"><span class="ornament-t">— A sua melhor versão começa aqui —</span></div>
  <h2>${c.headline_linha1||''} ${c.headline_linha2||''}</h2>
  <p>${c.tagline||''}</p>
  <a class="btn" href="${wa}">Garantir Meu Horário</a>
</div></section>
<footer><div class="fn">${diag.nome}</div><div class="fc">${diag.cidade}</div><div class="fcp">© ${YEAR} ${diag.nome}. Todos os direitos reservados.</div></footer>
</body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE: IMOBILIÁRIA — estilo Union Braz Leme (branco puro, Inter, botões pill verdes)
// ─────────────────────────────────────────────────────────────────────────────
function buildImobiliaria(diag: any, c: any): string {
  const wa = waLink(diag.telefone, 'Olá! Gostaria de falar com um corretor.');
  const city = cityShort(diag.cidade);
  const srvHTML = (c.servicos||[]).map((s:any)=>`<div class="pc"><div class="pc-ico">${s.icone||'🏠'}</div><h3>${s.nome}</h3><p>${s.descricao}</p></div>`).join('');
  const numHTML = (c.numeros||[]).map((n:any)=>`<div class="ni"><span class="nv">${n.valor}</span><span class="nl">${n.label}</span></div>`).join('');
  const depHTML = (c.depoimentos||[]).map((d:any)=>`<div class="dep"><div class="dep-st">★★★★★</div><p>"${d.texto}"</p><strong>${d.nome}</strong><span>${d.cargo}</span></div>`).join('');
  const faqHTML = (c.faq||[]).map((f:any)=>`<div class="fq" onclick="this.classList.toggle('o')"><div class="fp"><span>${f.pergunta}</span><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 6l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></div><div class="fr">${f.resposta}</div></div>`).join('');
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${diag.nome} | Imobiliária em ${city}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--white:#ffffff;--off:#f7f7f5;--off2:#f0f0ec;--border:#e4e4e0;--text:#1a1a1a;--text2:#3c3c3c;--muted:#888;--green:#25d366;--green2:#1da851;--accent:#1a1a1a}
html{scroll-behavior:smooth}body{font-family:'Inter',sans-serif;background:var(--white);color:var(--text);line-height:1.65;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}.wrap{max-width:1120px;margin:0 auto;padding:0 32px}
nav{position:sticky;top:0;z-index:200;background:rgba(255,255,255,.97);backdrop-filter:blur(12px);border-bottom:1px solid var(--border)}
.nav-i{display:flex;align-items:center;justify-content:space-between;height:66px}
.nlogo{font-size:.9rem;font-weight:700;letter-spacing:.04em;color:var(--text)}
.nlinks a{font-size:.78rem;font-weight:500;color:var(--muted);margin-left:28px;transition:color .2s}.nlinks a:hover{color:var(--text)}
.nbtn{display:inline-flex;align-items:center;gap:7px;background:var(--green);color:#fff;padding:9px 20px;font-size:.78rem;font-weight:600;border-radius:50px;transition:background .2s}.nbtn:hover{background:var(--green2)}
@media(max-width:700px){.nlinks{display:none}}
.hero{padding:88px 32px 80px;text-align:center;background:var(--white);border-bottom:1px solid var(--border)}
.hero-tag{display:inline-block;background:var(--off2);color:var(--muted);padding:5px 16px;font-size:.72rem;font-weight:600;letter-spacing:.12em;text-transform:uppercase;border-radius:50px;margin-bottom:32px}
.hero h1{font-size:clamp(2.2rem,5.5vw,4rem);font-weight:800;line-height:1.1;letter-spacing:-.025em;color:var(--text);max-width:760px;margin:0 auto 16px}
.hero-sub{font-size:1.05rem;font-weight:300;color:var(--muted);max-width:500px;margin:0 auto 40px;line-height:1.75}
.hero-btns{display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap}
.btn-g{display:inline-flex;align-items:center;gap:8px;background:var(--green);color:#fff;padding:14px 30px;font-size:.84rem;font-weight:600;border-radius:50px;transition:background .2s}.btn-g:hover{background:var(--green2)}
.btn-o{display:inline-flex;align-items:center;gap:8px;border:1.5px solid var(--border);color:var(--text2);padding:13px 26px;font-size:.82rem;font-weight:500;border-radius:50px;transition:border-color .2s}.btn-o:hover{border-color:var(--text)}
.hero-rat{margin-top:32px;font-size:.8rem;color:var(--muted);display:flex;align-items:center;justify-content:center;gap:8px}.hst{color:#f5a623;letter-spacing:1px}
.nband{background:var(--off);border-top:1px solid var(--border);border-bottom:1px solid var(--border);padding:44px 32px}
.ngrid{display:flex;justify-content:center;flex-wrap:wrap}
.ni{text-align:center;padding:0 52px;position:relative}.ni+.ni::before{content:'';position:absolute;left:0;top:50%;transform:translateY(-50%);width:1px;height:36px;background:var(--border)}
.nv{display:block;font-size:2.4rem;font-weight:800;color:var(--text);line-height:1;letter-spacing:-.02em}.nl{display:block;font-size:.68rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-top:6px;font-weight:500}
@media(max-width:600px){.ni{padding:18px 22px}}
.srv-sec{padding:88px 32px;background:var(--white)}
.sec-h{text-align:center;margin-bottom:52px}
.sec-tag{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:var(--green2);font-weight:600;display:block;margin-bottom:10px}
.sec-tit{font-size:clamp(1.7rem,3.8vw,2.3rem);font-weight:800;color:var(--text);letter-spacing:-.02em}
.sec-sub{font-size:.92rem;color:var(--muted);margin-top:10px;font-weight:300}
.pcards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
.pc{background:var(--off);border:1px solid var(--border);padding:36px 28px;text-align:center;border-radius:12px;transition:all .25s}
.pc:hover{background:var(--white);box-shadow:0 8px 40px rgba(0,0,0,.07);border-color:transparent}
.pc-ico{font-size:2rem;margin-bottom:14px}.pc h3{font-size:.98rem;font-weight:700;margin-bottom:8px}.pc p{font-size:.83rem;color:var(--muted);line-height:1.6}
.ab-sec{padding:88px 32px;background:var(--off)}
.ab-inner{display:grid;grid-template-columns:1fr 1fr;gap:80px;align-items:center;max-width:1100px;margin:0 auto}
.ab-vis{aspect-ratio:4/3;background:var(--white);border:1px solid var(--border);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px}
.ab-sym{font-size:2.5rem;opacity:.15}.ab-vt{font-size:.88rem;font-weight:600;letter-spacing:.08em;color:var(--muted)}
.ab-tit{font-size:clamp(1.5rem,3.5vw,2.1rem);font-weight:800;letter-spacing:-.02em;color:var(--text);margin-bottom:14px;line-height:1.2}
.ab-txt{font-size:.93rem;font-weight:300;color:var(--muted);line-height:1.8;margin-bottom:24px}
.ab-det{display:flex;align-items:center;gap:10px;font-size:.84rem;color:var(--text2);margin-bottom:10px;font-weight:500}
.ab-chk{width:18px;height:18px;min-width:18px;background:var(--green);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:.6rem}
@media(max-width:800px){.ab-inner{grid-template-columns:1fr}.ab-vis{display:none}}
.dep-sec{padding:88px 32px;background:var(--white)}
.depgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;max-width:1100px;margin:0 auto}
.dep{background:var(--off);border:1px solid var(--border);padding:28px 24px;border-radius:12px}
.dep-st{color:#f5a623;font-size:.82rem;letter-spacing:1px;margin-bottom:12px}
.dep p{font-size:.9rem;color:var(--text2);line-height:1.75;margin-bottom:16px;font-style:italic}
.dep strong{display:block;font-size:.83rem;font-weight:700;color:var(--text)}.dep span{font-size:.76rem;color:var(--muted)}
.faq-sec{padding:80px 32px;background:var(--off)}
.faq-list{max-width:700px;margin:0 auto}
.fq{border-bottom:1px solid var(--border);cursor:pointer}
.fp{display:flex;justify-content:space-between;align-items:center;padding:20px 0;font-size:.9rem;color:var(--text);font-weight:500;transition:color .2s}
.fp svg{flex-shrink:0;transition:transform .25s;color:var(--green)}.fq.o .fp{color:var(--green)}.fq.o .fp svg{transform:rotate(180deg)}
.fr{display:none;font-size:.87rem;color:var(--muted);padding:0 0 18px;line-height:1.8}.fq.o .fr{display:block}
.cta-sec{padding:80px 32px;background:var(--white);text-align:center;border-top:1px solid var(--border)}
.cta-sec h2{font-size:clamp(1.7rem,4vw,2.4rem);font-weight:800;letter-spacing:-.02em;margin-bottom:12px}
.cta-sec p{font-size:.93rem;color:var(--muted);margin-bottom:32px;font-weight:300}
.ct-band{background:var(--off);border-top:1px solid var(--border);display:flex;flex-wrap:wrap;justify-content:center}
.ct-item{display:flex;align-items:center;gap:14px;padding:24px 40px;border-right:1px solid var(--border)}.ct-item:last-child{border-right:none}
.ct-icon{font-size:1.2rem;flex-shrink:0}.ct-label{font-size:.6rem;letter-spacing:.18em;text-transform:uppercase;color:var(--green2);font-weight:600;display:block;margin-bottom:3px}
.ct-val{font-size:.87rem;color:var(--text2);font-weight:500}
@media(max-width:600px){.ct-item{border-right:none;border-bottom:1px solid var(--border);width:100%;justify-content:center}}
footer{background:var(--white);border-top:1px solid var(--border);padding:32px;text-align:center}
.ft-name{font-size:.9rem;font-weight:700;color:var(--text);margin-bottom:4px}.ft-copy{font-size:.74rem;color:var(--muted);margin-top:4px}
</style></head><body>
<nav><div class="wrap nav-i">
  <div class="nlogo">${diag.nome}</div>
  <div class="nlinks"><a href="#servicos">Serviços</a><a href="#sobre">Sobre</a><a href="#contato">Contato</a></div>
  <a class="nbtn" href="${wa}">${WA_SVG} Falar com Corretor</a>
</div></nav>
<section class="hero">
  <div class="hero-tag">Imobiliária · ${city}</div>
  <h1>${c.headline||'Encontre o Imóvel Ideal para Você'}</h1>
  <p class="hero-sub">${c.subheadline||''}</p>
  <div class="hero-btns">
    <a class="btn-g" href="${wa}">${WA_SVG} ${c.cta_texto||'Falar com Corretor'}</a>
    <a class="btn-o" href="#servicos">Ver Serviços</a>
  </div>
  <div class="hero-rat"><span class="hst">★★★★★</span>&nbsp;${c.nota_google||'4.9'} no Google · ${c.total_avaliacoes||'centenas de'} avaliações</div>
</section>
<div class="nband"><div class="wrap ngrid">${numHTML}</div></div>
<section class="srv-sec" id="servicos"><div class="wrap">
  <div class="sec-h"><span class="sec-tag">Como podemos ajudar</span><h2 class="sec-tit">Assessoria Completa</h2><p class="sec-sub">Do primeiro contato à assinatura — cuidamos de tudo.</p></div>
  <div class="pcards">${srvHTML}</div>
</div></section>
<section class="ab-sec" id="sobre"><div class="ab-inner">
  <div class="ab-vis"><div class="ab-sym">🏠</div><div class="ab-vt">${diag.nome}</div></div>
  <div>
    <span class="sec-tag" style="text-align:left;display:block;margin-bottom:10px">Quem somos</span>
    <h2 class="ab-tit">${c.sobre_titulo||'Nossa Missão'}</h2>
    <p class="ab-txt">${c.sobre_texto||''}</p>
    <div class="ab-det"><div class="ab-chk">✓</div>Corretores com CRECI ativo e experiência comprovada</div>
    <div class="ab-det"><div class="ab-chk">✓</div>Avaliação gratuita do seu imóvel sem compromisso</div>
    <div class="ab-det"><div class="ab-chk">✓</div>Suporte jurídico e documental completo</div>
    <br><a class="btn-g" href="${wa}" style="margin-top:16px">${WA_SVG} Falar com Corretor</a>
  </div>
</div></section>
<section class="dep-sec"><div class="wrap">
  <div class="sec-h"><span class="sec-tag">Histórias reais</span><h2 class="sec-tit">O Que Dizem Nossos Clientes</h2></div>
  <div class="depgrid">${depHTML}</div>
</div></section>
<section class="faq-sec"><div class="wrap">
  <div class="sec-h" style="margin-bottom:36px"><span class="sec-tag">Dúvidas frequentes</span><h2 class="sec-tit">Perguntas Frequentes</h2></div>
  <div class="faq-list">${faqHTML}</div>
</div></section>
<section class="cta-sec">
  <h2>Pronto para dar o próximo passo?</h2>
  <p>Atendimento personalizado, sem compromisso. Fale agora com um especialista.</p>
  <a class="btn-g" href="${wa}">${WA_SVG} ${c.cta_texto||'Falar com Corretor'}</a>
</section>
<div class="ct-band" id="contato">
  <div class="ct-item"><span class="ct-icon">📱</span><div><span class="ct-label">WhatsApp</span><span class="ct-val">${diag.telefone}</span></div></div>
  <div class="ct-item"><span class="ct-icon">📍</span><div><span class="ct-label">Localização</span><span class="ct-val">${diag.cidade}</span></div></div>
  <div class="ct-item"><span class="ct-icon">🕐</span><div><span class="ct-label">Horário</span><span class="ct-val">${c.horario||'Seg–Sex 8h–18h'}</span></div></div>
</div>
<footer><div class="ft-name">${diag.nome}</div><div class="ft-copy">© ${YEAR} ${diag.nome} · ${diag.cidade}. Todos os direitos reservados.</div></footer>
</body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE: SALÃO DE BELEZA — estilo Jacques Janine (creme, malva, elegância feminina)
// ─────────────────────────────────────────────────────────────────────────────
function buildSalao(diag: any, c: any): string {
  const wa = waLink(diag.telefone, 'Olá! Gostaria de agendar um horário.');
  const city = cityShort(diag.cidade);
  const srvHTML = (c.servicos||[]).map((s:any)=>`
        <div class="srv"><div class="srv-ico">${s.icone||'✦'}</div><h3>${s.nome}</h3><p>${s.descricao}</p></div>`).join('');
  const numHTML = (c.numeros||[]).map((n:any)=>`<div class="ni"><span class="nv">${n.valor}</span><span class="nl">${n.label}</span></div>`).join('');
  const depHTML = (c.depoimentos||[]).map((d:any)=>`<div class="dep"><div class="dep-stars">★★★★★</div><p>"${d.texto}"</p><strong>${d.nome}</strong><span>${d.cargo}</span></div>`).join('');
  const faqHTML = (c.faq||[]).map((f:any)=>`<div class="fq" onclick="this.classList.toggle('o')"><div class="fp"><span>${f.pergunta}</span><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 6l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></div><div class="fr">${f.resposta}</div></div>`).join('');
  return `<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${diag.nome} | ${city}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--cream:#faf6f0;--cream2:#f0e8de;--rose:#7c3d52;--rose2:#9c4d62;--gold:#b89060;--gold2:#d4aa78;--dark:#2a1520;--gray:#8a7070;--bd:#e0d0c0}
html{scroll-behavior:smooth}body{font-family:'Inter',sans-serif;background:var(--cream);color:var(--dark);line-height:1.7;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}.wrap{max-width:1100px;margin:0 auto;padding:0 28px}
/* NAV */
nav{position:sticky;top:0;z-index:200;background:rgba(250,246,240,.97);backdrop-filter:blur(12px);border-bottom:1px solid var(--bd)}
.nav-i{display:flex;align-items:center;justify-content:space-between;height:68px}
.logo{font-family:'Playfair Display',serif;font-size:1.2rem;font-weight:700;font-style:italic;color:var(--rose)}
.nav-links a{font-size:.78rem;font-weight:500;color:var(--gray);margin-left:24px;letter-spacing:.08em;text-transform:uppercase;transition:color .2s}.nav-links a:hover{color:var(--rose)}
.nbtn{background:var(--rose);color:#fff;padding:9px 22px;font-size:.78rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;transition:background .2s}.nbtn:hover{background:var(--rose2)}
@media(max-width:700px){.nav-links{display:none}}
/* HERO */
.hero{background:linear-gradient(150deg,var(--dark) 0%,var(--rose) 60%,#4a2030 100%);color:#fff;padding:100px 28px 90px;text-align:center;position:relative;overflow:hidden}
.hero::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(45deg,transparent,transparent 80px,rgba(255,255,255,.02) 80px,rgba(255,255,255,.02) 81px);pointer-events:none}
.hero-tag{display:inline-block;border:1px solid rgba(200,164,106,.5);color:var(--gold2);padding:5px 18px;font-size:.72rem;letter-spacing:.18em;text-transform:uppercase;font-family:'Cormorant Garamond',serif;font-style:italic;margin-bottom:28px}
.hero h1{font-family:'Playfair Display',serif;font-size:clamp(2rem,5vw,3.5rem);font-weight:700;font-style:italic;line-height:1.2;margin-bottom:16px}
.hero p{font-family:'Cormorant Garamond',serif;font-size:1.2rem;color:rgba(255,255,255,.75);max-width:480px;margin:0 auto 36px;font-style:italic}
.btn-p{display:inline-flex;align-items:center;gap:8px;background:#fff;color:var(--rose);padding:13px 30px;font-size:.82rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;transition:opacity .2s}.btn-p:hover{opacity:.9}
.btn-s{display:inline-flex;align-items:center;gap:8px;border:1px solid rgba(255,255,255,.4);color:#fff;padding:12px 24px;font-size:.78rem;margin-left:12px;transition:border-color .2s}.btn-s:hover{border-color:rgba(255,255,255,.8)}
.hero-rat{margin-top:40px;font-size:.8rem;color:rgba(255,255,255,.55);display:flex;align-items:center;justify-content:center;gap:8px}
.hst{color:var(--gold2)}
/* NUMBERS */
.nband{background:var(--rose);padding:48px 28px}
.ngrid{display:flex;justify-content:center;flex-wrap:wrap}
.ni{text-align:center;padding:0 48px;position:relative}.ni+.ni::before{content:'';position:absolute;left:0;top:50%;transform:translateY(-50%);width:1px;height:40px;background:rgba(255,255,255,.2)}
.nv{display:block;font-family:'Playfair Display',serif;font-size:2.4rem;font-weight:700;color:#fff;line-height:1}.nl{display:block;font-size:.68rem;letter-spacing:.15em;text-transform:uppercase;color:rgba(255,255,255,.6);margin-top:6px}
/* SERVICES */
.srv-sec{padding:90px 28px;background:var(--cream)}
.sec-h{text-align:center;margin-bottom:52px}
.sec-tag{font-size:.68rem;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);font-weight:600;display:block;margin-bottom:10px;font-family:'Cormorant Garamond',serif;font-style:italic;font-size:.9rem;letter-spacing:.15em}
.sec-tit{font-family:'Playfair Display',serif;font-size:clamp(1.6rem,4vw,2.4rem);font-weight:700;font-style:italic;color:var(--rose)}
.srv-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:24px}
.srv{background:#fff;border:1px solid var(--bd);padding:36px 24px;text-align:center;transition:box-shadow .2s}.srv:hover{box-shadow:0 8px 32px rgba(124,61,82,.1)}
.srv-ico{font-size:1.8rem;margin-bottom:14px;color:var(--rose)}.srv h3{font-family:'Playfair Display',serif;font-size:1.05rem;font-weight:700;font-style:italic;color:var(--rose);margin-bottom:10px}.srv p{font-size:.85rem;color:var(--gray);line-height:1.6}
/* ABOUT */
.ab-sec{padding:90px 28px;background:var(--cream2)}
.ab-grid{display:grid;grid-template-columns:1fr 1fr;gap:80px;align-items:center;max-width:1100px;margin:0 auto}
.ab-img{background:var(--rose);aspect-ratio:3/4;position:relative;overflow:hidden}
.ab-img-i{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px;border:1px solid rgba(255,255,255,.15);margin:20px}
.ab-sym{font-size:2.5rem;opacity:.2;color:#fff}.ab-nm{font-family:'Playfair Display',serif;font-style:italic;font-size:1rem;color:rgba(255,255,255,.4);letter-spacing:.1em}
.ab-text{font-family:'Cormorant Garamond',serif;font-size:1.15rem;color:#4a3040;line-height:1.85;margin-bottom:24px}
.ab-det{display:flex;align-items:center;gap:10px;font-size:.82rem;color:var(--gray);margin-bottom:10px}.ab-dot{width:5px;height:5px;background:var(--rose);border-radius:50%;flex-shrink:0}
@media(max-width:800px){.ab-grid{grid-template-columns:1fr}.ab-img{display:none}}
/* TESTIMONIALS */
.dep-sec{padding:90px 28px;background:var(--cream)}
.dep-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px;max-width:1100px;margin:0 auto}
.dep{background:var(--cream2);border:1px solid var(--bd);padding:32px}
.dep-stars{color:var(--gold);font-size:.9rem;letter-spacing:2px;margin-bottom:16px}
.dep p{font-family:'Cormorant Garamond',serif;font-size:1.05rem;font-style:italic;color:#4a3040;line-height:1.75;margin-bottom:18px}
.dep strong{display:block;font-size:.85rem;color:var(--rose);font-weight:700}.dep span{font-size:.78rem;color:var(--gray)}
/* FAQ */
.faq-sec{padding:80px 28px;background:var(--cream2)}
.faq-list{max-width:720px;margin:0 auto}
.fq{border-bottom:1px solid var(--bd);cursor:pointer}.fp{display:flex;justify-content:space-between;align-items:center;padding:20px 0;font-size:.9rem;color:var(--dark);font-weight:500}
.fp svg{color:var(--rose);flex-shrink:0;transition:transform .25s}.fq.o .fp{color:var(--rose)}.fq.o .fp svg{transform:rotate(180deg)}
.fr{display:none;font-size:.88rem;color:var(--gray);padding:0 0 20px;line-height:1.8}.fq.o .fr{display:block}
/* CONTACT */
.ct-sec{padding:80px 28px;background:var(--dark);color:#fff;text-align:center}
.ct-grid{display:flex;justify-content:center;flex-wrap:wrap;max-width:800px;margin:0 auto 48px;border:1px solid rgba(255,255,255,.08)}
.ct-card{flex:1;min-width:180px;padding:36px 20px;border-right:1px solid rgba(255,255,255,.08)}.ct-card:last-child{border-right:none}
.ct-ico{font-size:1.5rem;margin-bottom:12px;display:block}
.ct-lbl{font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;color:var(--gold2);margin-bottom:8px;font-weight:600}
.ct-val{font-family:'Cormorant Garamond',serif;font-size:1.05rem;color:rgba(255,255,255,.8)}
/* CTA FINAL */
.cta-f{padding:90px 28px;background:var(--cream);text-align:center}
.cta-f h2{font-family:'Playfair Display',serif;font-size:clamp(1.8rem,4vw,2.8rem);font-style:italic;color:var(--rose);margin-bottom:12px}
.cta-f p{font-family:'Cormorant Garamond',serif;font-size:1.15rem;font-style:italic;color:var(--gray);margin-bottom:36px}
footer{background:var(--dark);color:rgba(255,255,255,.4);text-align:center;padding:32px 28px;font-size:.78rem}
footer strong{display:block;color:var(--gold2);font-family:'Playfair Display',serif;font-style:italic;font-size:1rem;margin-bottom:6px}
@media(max-width:600px){.ct-card{border-right:none;border-bottom:1px solid rgba(255,255,255,.08)}}
</style></head><body>
<nav><div class="wrap nav-i">
  <div class="logo">${diag.nome}</div>
  <div class="nav-links"><a href="#servicos">Serviços</a><a href="#sobre">Sobre</a><a href="#contato">Contato</a></div>
  <a class="nbtn" href="${wa}">Agendar</a>
</div></nav>
<section class="hero">
  <div class="hero-tag">✦ Salão em ${city} ✦</div>
  <h1>${c.headline||'Beleza & Sofisticação'}</h1>
  <p>${c.subheadline||''}</p>
  <a class="btn-p" href="${wa}">${WA_SVG} ${c.cta_texto||'Agendar'}</a>
  <a class="btn-s" href="#servicos">Ver Serviços</a>
  <div class="hero-rat"><span class="hst">★★★★★</span>&nbsp;${c.nota_google||'4.9'} no Google · ${c.total_avaliacoes||'centenas de'} avaliações</div>
</section>
<div class="nband"><div class="wrap ngrid">${numHTML}</div></div>
<section class="srv-sec" id="servicos"><div class="wrap">
  <div class="sec-h"><span class="sec-tag">O que oferecemos</span><h2 class="sec-tit">Nossos Serviços</h2></div>
  <div class="srv-grid">${srvHTML}</div>
</div></section>
<section class="ab-sec" id="sobre"><div class="ab-grid">
  <div class="ab-img"><div class="ab-img-i"><div class="ab-sym">✦</div><div class="ab-nm">${diag.nome}</div></div></div>
  <div><span class="sec-tag">Sobre nós</span><h2 class="sec-tit" style="margin-bottom:16px">${c.sobre_titulo||'Nossa Essência'}</h2>
    <div style="width:40px;height:2px;background:var(--gold);margin-bottom:24px"></div>
    <p class="ab-text">${c.sobre_texto||''}</p>
    <div class="ab-det"><div class="ab-dot"></div>Profissionais especializados e atualizados</div>
    <div class="ab-det"><div class="ab-dot"></div>Produtos de marcas premium</div>
    <div class="ab-det"><div class="ab-dot"></div>Ambiente aconchegante e exclusivo</div>
    <br><a class="btn-p" href="${wa}" style="margin-top:14px">${WA_SVG} Agendar Horário</a>
  </div>
</div></section>
<section class="dep-sec"><div class="wrap">
  <div class="sec-h"><span class="sec-tag">Quem nos visita</span><h2 class="sec-tit">O Que Dizem</h2></div>
  <div class="dep-grid">${depHTML}</div>
</div></section>
<section class="faq-sec"><div class="wrap">
  <div class="sec-h" style="margin-bottom:36px"><span class="sec-tag">Dúvidas</span><h2 class="sec-tit">Perguntas Frequentes</h2></div>
  <div class="faq-list">${faqHTML}</div>
</div></section>
<section class="ct-sec" id="contato">
  <span class="sec-tag" style="color:var(--gold2)">Entre em contato</span>
  <h2 style="font-family:'Playfair Display',serif;font-style:italic;font-size:2rem;margin-bottom:36px">Agende Seu Horário</h2>
  <div class="ct-grid">
    <div class="ct-card"><span class="ct-ico">📱</span><div class="ct-lbl">WhatsApp</div><div class="ct-val">${diag.telefone}</div></div>
    <div class="ct-card"><span class="ct-ico">📍</span><div class="ct-lbl">Cidade</div><div class="ct-val">${diag.cidade}</div></div>
    <div class="ct-card"><span class="ct-ico">🕐</span><div class="ct-lbl">Horário</div><div class="ct-val">${c.horario||''}</div></div>
  </div>
  <a class="btn-p" href="${wa}" style="background:var(--rose);color:#fff">${WA_SVG} ${c.cta_texto||'Agendar'}</a>
</section>
<footer><strong>${diag.nome}</strong>${diag.cidade} · © ${YEAR}. Todos os direitos reservados.</footer>
</body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE: RESTAURANTE — estilo Coco Bambu (hero escuro-quente, corpo creme, botões pill)
// ─────────────────────────────────────────────────────────────────────────────
function buildRestaurante(diag: any, c: any): string {
  const wa = waLink(diag.telefone, 'Olá! Gostaria de reservar uma mesa.');
  const city = cityShort(diag.cidade);
  const catHTML = (c.categorias||c.servicos||[]).map((s:any)=>`<div class="mc"><div class="mc-ico">${s.icone||'🍽'}</div><h3>${s.nome}</h3><p>${s.descricao||''}</p>${s.destaque?`<span class="mc-tag">${s.destaque}</span>`:''}</div>`).join('');
  const numHTML = (c.numeros||[]).map((n:any)=>`<div class="ni"><span class="nv">${n.valor}</span><span class="nl">${n.label}</span></div>`).join('');
  const depHTML = (c.depoimentos||[]).map((d:any)=>`<div class="dep"><div class="dep-st">★★★★★</div><p>"${d.texto}"</p><strong>${d.nome}</strong><span>${d.cargo}</span></div>`).join('');
  const faqHTML = (c.faq||[]).map((f:any)=>`<div class="fq" onclick="this.classList.toggle('o')"><div class="fp"><span>${f.pergunta}</span><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 6l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></div><div class="fr">${f.resposta}</div></div>`).join('');
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${diag.nome} | ${city}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400;1,700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--hero:#1a0d05;--hero2:#2a1a0a;--cream:#fdf8ef;--warm:#f2e8d8;--warm2:#e8d8c0;--amber:#c87a30;--amber2:#e09040;--dark-text:#2a1a0a;--muted:#8a7060;--border:#e0d0b8}
html{scroll-behavior:smooth}body{font-family:'Inter',sans-serif;background:var(--cream);color:var(--dark-text);line-height:1.65;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}.wrap{max-width:1120px;margin:0 auto;padding:0 32px}
nav{position:sticky;top:0;z-index:200;background:rgba(26,13,5,.97);backdrop-filter:blur(12px)}
.nav-i{display:flex;align-items:center;justify-content:space-between;height:66px}
.nlogo{font-family:'Playfair Display',serif;font-size:1.1rem;font-weight:700;font-style:italic;color:#f5e8d0}
.nlinks a{font-size:.76rem;font-weight:500;color:rgba(245,232,208,.55);margin-left:24px;letter-spacing:.06em;transition:color .2s}.nlinks a:hover{color:#f5e8d0}
.nbtn{display:inline-flex;align-items:center;gap:7px;background:var(--amber);color:#fff;padding:9px 22px;font-size:.78rem;font-weight:600;border-radius:50px;transition:background .2s}.nbtn:hover{background:var(--amber2)}
@media(max-width:700px){.nlinks{display:none}}
.hero{min-height:92vh;display:flex;align-items:center;justify-content:center;flex-direction:column;text-align:center;padding:80px 32px 72px;background:linear-gradient(160deg,var(--hero) 0%,var(--hero2) 60%,#3a2010 100%);position:relative;overflow:hidden}
.hero::after{content:'';position:absolute;bottom:0;left:0;right:0;height:60px;background:var(--cream);clip-path:ellipse(60% 100% at 50% 100%)}
.hero-div{display:flex;align-items:center;gap:16px;justify-content:center;margin-bottom:28px}
.hdl{width:50px;height:1px;background:var(--amber);opacity:.5}.hds{color:var(--amber);font-family:'Playfair Display',serif;font-style:italic;font-size:.9rem;letter-spacing:.2em;opacity:.8}
.hero h1{font-family:'Playfair Display',serif;font-size:clamp(2.4rem,6vw,4.2rem);font-weight:700;font-style:italic;line-height:1.1;color:#f5e8d0;max-width:700px;margin-bottom:14px}
.hero-sub{font-size:1rem;font-weight:300;color:rgba(245,232,208,.62);max-width:440px;margin:0 auto 36px;line-height:1.7}
.btn-a{display:inline-flex;align-items:center;gap:8px;background:var(--amber);color:#fff;padding:14px 32px;font-size:.84rem;font-weight:600;border-radius:50px;transition:background .2s}.btn-a:hover{background:var(--amber2)}
.btn-o{display:inline-flex;align-items:center;gap:8px;border:1.5px solid rgba(245,232,208,.3);color:#f5e8d0;padding:13px 26px;font-size:.82rem;font-weight:500;border-radius:50px;margin-left:10px;transition:border-color .2s}.btn-o:hover{border-color:rgba(245,232,208,.7)}
.hero-rat{margin-top:32px;font-size:.78rem;color:rgba(245,232,208,.42);display:flex;align-items:center;justify-content:center;gap:8px}.hst{color:var(--amber);letter-spacing:1px}
.nband{background:var(--warm);border-top:1px solid var(--border);border-bottom:1px solid var(--border);padding:44px 32px}
.ngrid{display:flex;justify-content:center;flex-wrap:wrap}
.ni{text-align:center;padding:0 48px;position:relative}.ni+.ni::before{content:'';position:absolute;left:0;top:50%;transform:translateY(-50%);width:1px;height:36px;background:var(--border)}
.nv{display:block;font-family:'Playfair Display',serif;font-size:2.4rem;font-weight:700;color:var(--amber);line-height:1}.nl{display:block;font-size:.68rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-top:6px;font-weight:500}
@media(max-width:600px){.ni{padding:18px 22px}}
.menu-sec{padding:88px 32px;background:var(--cream)}
.sec-h{text-align:center;margin-bottom:52px}
.sec-tag{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:var(--amber);font-weight:600;display:block;margin-bottom:10px}
.sec-tit{font-family:'Playfair Display',serif;font-size:clamp(1.7rem,3.8vw,2.4rem);font-weight:700;font-style:italic;color:var(--dark-text)}
.mcards{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:16px}
.mc{background:var(--warm);border:1px solid var(--border);padding:36px 24px;text-align:center;border-radius:12px;transition:all .25s;position:relative}
.mc:hover{box-shadow:0 8px 32px rgba(200,122,48,.12);border-color:var(--amber)}
.mc-ico{font-size:2rem;margin-bottom:14px;display:block}.mc h3{font-family:'Playfair Display',serif;font-size:1.05rem;font-weight:700;font-style:italic;color:var(--dark-text);margin-bottom:8px}.mc p{font-size:.83rem;color:var(--muted);line-height:1.6;margin-bottom:10px}
.mc-tag{display:inline-block;background:var(--amber);color:#fff;font-size:.65rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;padding:3px 10px;border-radius:50px}
.sobre-sec{padding:88px 32px;background:var(--warm)}
.sobre-inner{display:grid;grid-template-columns:1fr 1fr;gap:80px;align-items:center;max-width:1100px;margin:0 auto}
.sobre-vis{aspect-ratio:1;background:var(--hero2);border-radius:8px;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px}
.sv-sym{font-size:3rem;color:var(--amber);opacity:.3}.sv-t{font-family:'Playfair Display',serif;font-style:italic;font-size:1rem;color:rgba(245,232,208,.3);letter-spacing:.1em}
.sobre-tit{font-family:'Playfair Display',serif;font-size:clamp(1.7rem,3.5vw,2.3rem);font-weight:700;font-style:italic;color:var(--dark-text);margin-bottom:14px;line-height:1.2}
.sobre-txt{font-size:.93rem;font-weight:300;color:var(--muted);line-height:1.8;margin-bottom:22px}
.sobre-det{display:flex;align-items:center;gap:10px;font-size:.84rem;color:var(--dark-text);margin-bottom:10px;font-weight:500}
.sobre-dot{width:6px;height:6px;min-width:6px;background:var(--amber);border-radius:50%}
@media(max-width:800px){.sobre-inner{grid-template-columns:1fr}.sobre-vis{display:none}}
.dep-sec{padding:88px 32px;background:var(--cream)}
.depgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:16px;max-width:1100px;margin:0 auto}
.dep{background:var(--warm);border:1px solid var(--border);padding:28px 24px;border-radius:12px}
.dep-st{color:var(--amber);font-size:.82rem;letter-spacing:1px;margin-bottom:12px}
.dep p{font-size:.9rem;color:var(--dark-text);line-height:1.75;margin-bottom:14px;font-style:italic}
.dep strong{display:block;font-size:.83rem;font-weight:700;color:var(--dark-text)}.dep span{font-size:.76rem;color:var(--muted)}
.faq-sec{padding:80px 32px;background:var(--warm)}
.faq-list{max-width:700px;margin:0 auto}
.fq{border-bottom:1px solid var(--border);cursor:pointer}
.fp{display:flex;justify-content:space-between;align-items:center;padding:20px 0;font-size:.9rem;color:var(--dark-text);font-weight:500;transition:color .2s}
.fp svg{flex-shrink:0;transition:transform .25s;color:var(--amber)}.fq.o .fp{color:var(--amber)}.fq.o .fp svg{transform:rotate(180deg)}
.fr{display:none;font-size:.87rem;color:var(--muted);padding:0 0 18px;line-height:1.8}.fq.o .fr{display:block}
.cta-sec{padding:80px 32px;background:var(--hero);text-align:center;position:relative;overflow:hidden}
.cta-sec::before{content:'';position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:600px;height:300px;background:radial-gradient(ellipse,rgba(200,122,48,.1) 0%,transparent 70%);pointer-events:none}
.cta-sec h2{font-family:'Playfair Display',serif;font-size:clamp(1.8rem,4.5vw,3rem);font-weight:700;font-style:italic;color:#f5e8d0;margin-bottom:12px;position:relative;z-index:1}
.cta-sub{font-size:.95rem;font-weight:300;color:rgba(245,232,208,.55);margin-bottom:36px;position:relative;z-index:1}
.ct-band{background:var(--warm);border-top:1px solid var(--border);display:flex;flex-wrap:wrap;justify-content:center}
.ct-item{display:flex;align-items:center;gap:14px;padding:24px 40px;border-right:1px solid var(--border)}.ct-item:last-child{border-right:none}
.ct-icon{font-size:1.2rem;flex-shrink:0}.ct-label{font-size:.6rem;letter-spacing:.18em;text-transform:uppercase;color:var(--amber);font-weight:600;display:block;margin-bottom:3px}
.ct-val{font-size:.87rem;color:var(--dark-text);font-weight:500}
@media(max-width:600px){.ct-item{border-right:none;border-bottom:1px solid var(--border);width:100%;justify-content:center}}
footer{background:var(--hero2);padding:32px;text-align:center}
.ft-name{font-family:'Playfair Display',serif;font-size:1.05rem;font-style:italic;color:var(--amber);margin-bottom:4px}.ft-copy{font-size:.74rem;color:rgba(245,232,208,.3);margin-top:4px}
</style></head><body>
<nav><div class="wrap nav-i">
  <div class="nlogo">${diag.nome}</div>
  <div class="nlinks"><a href="#cardapio">Cardápio</a><a href="#sobre">Sobre</a><a href="#contato">Reservas</a></div>
  <a class="nbtn" href="${wa}">Reservar Mesa</a>
</div></nav>
<section class="hero">
  <div class="hero-div"><div class="hdl"></div><span class="hds">— gastronomia —</span><div class="hdl"></div></div>
  <h1>${c.headline||'Sabor que Fica na Memória'}</h1>
  <p class="hero-sub">${c.subheadline||''}</p>
  <div>
    <a class="btn-a" href="${wa}">${WA_SVG} ${c.cta_texto||'Reservar Mesa'}</a>
    <a class="btn-o" href="#cardapio">Ver Cardápio</a>
  </div>
  <div class="hero-rat"><span class="hst">★★★★★</span>&nbsp;${c.nota_google||'4.8'} no Google · ${c.total_avaliacoes||'centenas de'} avaliações</div>
</section>
<div class="nband"><div class="wrap ngrid">${numHTML}</div></div>
<section class="menu-sec" id="cardapio"><div class="wrap">
  <div class="sec-h"><span class="sec-tag">Nosso Cardápio</span><h2 class="sec-tit">O Melhor da Cozinha</h2></div>
  <div class="mcards">${catHTML}</div>
</div></section>
<section class="sobre-sec" id="sobre"><div class="sobre-inner">
  <div class="sobre-vis"><div class="sv-sym">✦</div><div class="sv-t">${diag.nome}</div></div>
  <div>
    <span class="sec-tag" style="text-align:left;display:block;margin-bottom:10px">Nossa Cozinha</span>
    <h2 class="sobre-tit">${c.sobre_titulo||'Nossa Filosofia'}</h2>
    <p class="sobre-txt">${c.sobre_texto||''}</p>
    <div class="sobre-det"><div class="sobre-dot"></div>Ingredientes frescos selecionados diariamente</div>
    <div class="sobre-det"><div class="sobre-dot"></div>Receitas autorais com técnica e paixão</div>
    <div class="sobre-det"><div class="sobre-dot"></div>Ambiente perfeito para toda ocasião especial</div>
    <br><a class="btn-a" href="${wa}" style="margin-top:16px">${WA_SVG} Reservar Mesa</a>
  </div>
</div></section>
<section class="dep-sec"><div class="wrap">
  <div class="sec-h"><span class="sec-tag">O que dizem</span><h2 class="sec-tit">Nossos Clientes</h2></div>
  <div class="depgrid">${depHTML}</div>
</div></section>
<section class="faq-sec"><div class="wrap">
  <div class="sec-h" style="margin-bottom:36px"><span class="sec-tag">Dúvidas</span><h2 class="sec-tit">Perguntas Frequentes</h2></div>
  <div class="faq-list">${faqHTML}</div>
</div></section>
<section class="cta-sec">
  <h2>${c.headline||'Reserve Sua Mesa'}</h2>
  <p class="cta-sub">Uma experiência inesquecível espera por você e sua família.</p>
  <a class="btn-a" href="${wa}">${WA_SVG} ${c.cta_texto||'Reservar pelo WhatsApp'}</a>
</section>
<div class="ct-band" id="contato">
  <div class="ct-item"><span class="ct-icon">📱</span><div><span class="ct-label">WhatsApp</span><span class="ct-val">${diag.telefone}</span></div></div>
  <div class="ct-item"><span class="ct-icon">📍</span><div><span class="ct-label">Localização</span><span class="ct-val">${diag.cidade}</span></div></div>
  <div class="ct-item"><span class="ct-icon">🕐</span><div><span class="ct-label">Horário</span><span class="ct-val">${c.horario||'Seg–Dom: 11h–23h'}</span></div></div>
</div>
<footer><div class="ft-name">${diag.nome}</div><div class="ft-copy">© ${YEAR} ${diag.nome} · ${diag.cidade}. Todos os direitos reservados.</div></footer>
</body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE: ACADEMIA — estilo AGITS boutique gym (preto, laranja, bold uppercase)
// ─────────────────────────────────────────────────────────────────────────────
function buildAcademia(diag: any, c: any): string {
  const wa = waLink(diag.telefone, 'Olá! Quero saber mais sobre a academia.');
  const city = cityShort(diag.cidade);
  const modHTML = (c.modalidades||c.servicos||[]).map((s:any)=>`<div class="mod"><div class="mod-ico">${s.icone||'💪'}</div><h3>${s.nome}</h3><p>${s.descricao}</p></div>`).join('');
  const planosHTML = (c.planos||[]).map((p:any)=>`<div class="plan${p.destaque?' plan-dest':''}"><div class="plan-name">${p.nome}</div><div class="plan-price">${p.preco}</div><ul class="plan-list">${(p.items||[]).map((i:string)=>`<li>${i}</li>`).join('')}</ul><a class="plan-btn" href="${wa}">${p.destaque?'Começar Agora':'Saiba Mais'}</a></div>`).join('');
  const numHTML = (c.numeros||[]).map((n:any)=>`<div class="ni"><span class="nv">${n.valor}</span><span class="nl">${n.label}</span></div>`).join('');
  const depHTML = (c.depoimentos||[]).map((d:any)=>`<div class="dep"><div class="dep-st">★★★★★</div><p>"${d.texto}"</p><strong>${d.nome}</strong><span>${d.cargo}</span></div>`).join('');
  const faqHTML = (c.faq||[]).map((f:any)=>`<div class="fq" onclick="this.classList.toggle('o')"><div class="fp"><span>${f.pergunta}</span><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 6l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></div><div class="fr">${f.resposta}</div></div>`).join('');
  const hasPlanos = (c.planos||[]).length > 0;
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${diag.nome} | ${city}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--black:#0c0c0c;--dark:#141414;--card:#1c1c1c;--orange:#e05c00;--orange2:#ff6a00;--white:#f5f5f3;--gray:#888;--border:rgba(224,92,0,.18);--border2:rgba(224,92,0,.07)}
html{scroll-behavior:smooth}body{font-family:'Inter',sans-serif;background:var(--black);color:var(--white);line-height:1.6;-webkit-font-smoothing:antialiased;overflow-x:hidden}
a{color:inherit;text-decoration:none}::selection{background:var(--orange);color:#000}.wrap{max-width:1120px;margin:0 auto;padding:0 32px}
nav{position:sticky;top:0;z-index:200;background:rgba(12,12,12,.97);backdrop-filter:blur(12px);border-bottom:1px solid var(--border2)}
.nav-i{display:flex;align-items:center;justify-content:space-between;height:66px}
.nlogo{font-size:1rem;font-weight:900;letter-spacing:.05em;text-transform:uppercase;color:var(--white)}.nlogo span{color:var(--orange)}
.nlinks a{font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(245,245,243,.4);margin-left:24px;transition:color .2s}.nlinks a:hover{color:var(--white)}
.nbtn{background:var(--orange);color:#fff;padding:9px 22px;font-size:.74rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;border-radius:4px;transition:background .2s}.nbtn:hover{background:var(--orange2)}
@media(max-width:700px){.nlinks{display:none}}
.hero{min-height:100svh;display:flex;align-items:center;justify-content:center;flex-direction:column;text-align:center;padding:80px 32px;background:var(--black);position:relative;overflow:hidden}
.hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 70% 50% at 50% 100%,rgba(224,92,0,.08) 0%,transparent 70%);pointer-events:none}
.hero::after{content:'';position:absolute;bottom:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--orange),transparent)}
.hbadge{display:inline-block;background:rgba(224,92,0,.12);border:1px solid var(--border);color:var(--orange);padding:5px 18px;font-size:.7rem;font-weight:800;letter-spacing:.22em;text-transform:uppercase;margin-bottom:28px;position:relative;z-index:1}
.hero h1{font-size:clamp(2.8rem,8vw,6.5rem);font-weight:900;line-height:.92;letter-spacing:-.03em;text-transform:uppercase;color:var(--white);max-width:860px;margin-bottom:14px;position:relative;z-index:1}
.hero h1 span{color:var(--orange);display:block}
.hero-sub{font-size:1rem;color:rgba(245,245,243,.48);max-width:460px;margin:0 auto 36px;font-weight:300;line-height:1.7;position:relative;z-index:1}
.btn{display:inline-flex;align-items:center;gap:8px;background:var(--orange);color:#fff;padding:14px 32px;font-size:.84rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;border-radius:4px;transition:background .2s;position:relative;z-index:1}.btn:hover{background:var(--orange2)}
.btn2{display:inline-flex;align-items:center;gap:8px;border:1.5px solid rgba(245,245,243,.2);color:var(--white);padding:13px 26px;font-size:.8rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;border-radius:4px;margin-left:10px;transition:border-color .2s;position:relative;z-index:1}.btn2:hover{border-color:var(--orange)}
.hero-rat{margin-top:32px;font-size:.76rem;color:rgba(245,245,243,.35);display:flex;align-items:center;justify-content:center;gap:8px;position:relative;z-index:1}.hst{color:var(--orange);letter-spacing:2px}
.nband{background:var(--dark);border-top:1px solid var(--border2);border-bottom:1px solid var(--border2);padding:44px 32px}
.ngrid{display:flex;justify-content:center;flex-wrap:wrap}
.ni{text-align:center;padding:0 48px;position:relative}.ni+.ni::before{content:'';position:absolute;left:0;top:50%;transform:translateY(-50%);width:1px;height:38px;background:var(--border2)}
.nv{display:block;font-size:2.6rem;font-weight:900;color:var(--orange);line-height:1;letter-spacing:-.02em}.nl{display:block;font-size:.67rem;letter-spacing:.18em;text-transform:uppercase;color:rgba(245,245,243,.35);margin-top:6px;font-weight:600}
@media(max-width:600px){.ni{padding:18px 22px}}
.mod-sec{padding:88px 32px;background:var(--black)}
.sec-h{text-align:center;margin-bottom:52px}
.sec-tag{font-size:.68rem;letter-spacing:.24em;text-transform:uppercase;color:var(--orange);font-weight:800;display:block;margin-bottom:10px}
.sec-tit{font-size:clamp(1.8rem,4vw,2.6rem);font-weight:900;letter-spacing:-.02em;text-transform:uppercase}
.gline{width:40px;height:3px;background:var(--orange);margin:14px auto 0}
.mgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:2px;background:var(--border2)}
.mod{background:var(--card);padding:40px 28px;text-align:center;transition:background .25s;position:relative;overflow:hidden}
.mod::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--orange);transform:scaleY(0);transition:transform .3s;transform-origin:bottom}
.mod:hover{background:#222}.mod:hover::before{transform:scaleY(1)}
.mod-ico{font-size:2rem;margin-bottom:14px;display:block}.mod h3{font-size:1rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px;color:var(--white)}.mod p{font-size:.82rem;color:var(--gray);line-height:1.6}
.plan-sec{padding:88px 32px;background:var(--dark)}
.pgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:2px;background:var(--border2);max-width:900px;margin:0 auto}
.plan{background:var(--black);padding:40px 32px;text-align:center;position:relative}
.plan-dest{background:var(--card);border-top:3px solid var(--orange)}
.plan-name{font-size:.68rem;font-weight:800;letter-spacing:.22em;text-transform:uppercase;color:var(--orange);margin-bottom:14px}
.plan-price{font-size:2.4rem;font-weight:900;letter-spacing:-.02em;color:var(--white);margin-bottom:22px;line-height:1}
.plan-list{list-style:none;margin-bottom:28px;text-align:left}
.plan-list li{font-size:.83rem;color:var(--gray);padding:7px 0;border-bottom:1px solid var(--border2);display:flex;align-items:center;gap:8px}
.plan-list li::before{content:'→';color:var(--orange);font-weight:700;flex-shrink:0}
.plan-btn{display:block;background:var(--orange);color:#fff;padding:12px;font-size:.78rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;border-radius:4px;transition:background .2s}.plan-btn:hover{background:var(--orange2)}
.plan:not(.plan-dest) .plan-btn{background:transparent;border:1.5px solid rgba(245,245,243,.15);color:rgba(245,245,243,.7)}.plan:not(.plan-dest) .plan-btn:hover{border-color:var(--orange);color:var(--orange)}
.trial-sec{padding:64px 32px;background:var(--orange);text-align:center}
.trial-sec h2{font-size:clamp(1.6rem,3.5vw,2.2rem);font-weight:900;text-transform:uppercase;letter-spacing:-.01em;color:#fff;margin-bottom:10px}
.trial-sec p{font-size:.95rem;color:rgba(255,255,255,.75);margin-bottom:28px;font-weight:300}
.btn-white{display:inline-flex;align-items:center;gap:8px;background:#fff;color:var(--orange);padding:14px 32px;font-size:.84rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;border-radius:4px;transition:opacity .2s}.btn-white:hover{opacity:.9}
.dep-sec{padding:88px 32px;background:var(--black)}
.depgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:2px;background:var(--border2);max-width:1100px;margin:0 auto}
.dep{background:var(--card);padding:32px 28px}
.dep-st{color:var(--orange);font-size:.8rem;letter-spacing:1px;margin-bottom:12px}
.dep p{font-size:.9rem;color:rgba(245,245,243,.62);line-height:1.72;margin-bottom:16px;font-style:italic}
.dep strong{display:block;font-size:.8rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--white)}.dep span{font-size:.72rem;color:var(--orange);display:block;margin-top:2px}
.faq-sec{padding:80px 32px;background:var(--dark)}
.faq-list{max-width:700px;margin:0 auto}
.fq{border-bottom:1px solid var(--border2);cursor:pointer}
.fp{display:flex;justify-content:space-between;align-items:center;padding:20px 0;font-size:.9rem;color:var(--white);font-weight:500;transition:color .2s}
.fp svg{flex-shrink:0;transition:transform .25s;color:var(--orange)}.fq.o .fp{color:var(--orange)}.fq.o .fp svg{transform:rotate(180deg)}
.fr{display:none;font-size:.87rem;color:var(--gray);padding:0 0 18px;line-height:1.8}.fq.o .fr{display:block}
.cta-sec{padding:88px 32px;background:var(--card);text-align:center}
.cta-sec h2{font-size:clamp(2rem,5vw,3.4rem);font-weight:900;letter-spacing:-.02em;text-transform:uppercase;color:var(--white);margin-bottom:12px}
.cta-sub{font-size:.95rem;color:rgba(245,245,243,.4);margin-bottom:36px;font-weight:300}
.ct-band{background:var(--dark);border-top:1px solid var(--border2);display:flex;flex-wrap:wrap;justify-content:center}
.ct-item{display:flex;align-items:center;gap:14px;padding:24px 40px;border-right:1px solid var(--border2)}.ct-item:last-child{border-right:none}
.ct-icon{font-size:1.2rem;flex-shrink:0}.ct-label{font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;color:var(--orange);font-weight:700;display:block;margin-bottom:3px}
.ct-val{font-size:.87rem;color:rgba(245,245,243,.6)}
@media(max-width:600px){.ct-item{border-right:none;border-bottom:1px solid var(--border2);width:100%;justify-content:center}}
footer{background:var(--black);border-top:1px solid var(--border2);padding:32px;text-align:center}
.ft-name{font-size:1rem;font-weight:900;letter-spacing:.04em;text-transform:uppercase;color:var(--orange);margin-bottom:4px}.ft-copy{font-size:.72rem;color:rgba(245,245,243,.2);margin-top:4px}
</style></head><body>
<nav><div class="wrap nav-i">
  <div class="nlogo">${diag.nome.split(' ').slice(0,2).join(' ')}<span>.</span></div>
  <div class="nlinks"><a href="#modalidades">Modalidades</a><a href="#planos">Planos</a><a href="#contato">Contato</a></div>
  <a class="nbtn" href="${wa}">Quero Começar</a>
</div></nav>
<section class="hero">
  <div class="hbadge">⚡ academia em ${city}</div>
  <h1>${c.headline||'TRANSFORME<span>SEU CORPO</span>AGORA'}</h1>
  <p class="hero-sub">${c.subheadline||''}</p>
  <div>
    <a class="btn" href="${wa}">${WA_SVG} ${c.cta_texto||'Começar Agora'}</a>
    <a class="btn2" href="#modalidades">Ver Modalidades</a>
  </div>
  <div class="hero-rat"><span class="hst">★★★★★</span>&nbsp;${c.nota_google||'4.8'} no Google · ${c.total_avaliacoes||'centenas de'} avaliações</div>
</section>
<div class="nband"><div class="wrap ngrid">${numHTML}</div></div>
<section class="mod-sec" id="modalidades"><div class="wrap">
  <div class="sec-h"><span class="sec-tag">O que oferecemos</span><h2 class="sec-tit">Modalidades</h2><div class="gline"></div></div>
  <div class="mgrid">${modHTML}</div>
</div></section>
${hasPlanos ? `<section class="plan-sec" id="planos"><div class="wrap">
  <div class="sec-h"><span class="sec-tag">Escolha seu plano</span><h2 class="sec-tit">Planos & Valores</h2><div class="gline"></div></div>
  <div class="pgrid">${planosHTML}</div>
</div></section>` : ''}
<section class="trial-sec">
  <h2>AULA EXPERIMENTAL GRÁTIS</h2>
  <p>Venha conhecer a estrutura e treinar sem compromisso. Primeira aula por nossa conta.</p>
  <a class="btn-white" href="${wa}">${WA_SVG} Agendar Minha Aula Grátis</a>
</section>
<section class="dep-sec"><div class="wrap">
  <div class="sec-h"><span class="sec-tag">Resultados reais</span><h2 class="sec-tit">O Que Dizem</h2><div class="gline"></div></div>
  <div class="depgrid">${depHTML}</div>
</div></section>
<section class="faq-sec"><div class="wrap">
  <div class="sec-h" style="margin-bottom:36px"><span class="sec-tag">Dúvidas</span><h2 class="sec-tit">Perguntas Frequentes</h2><div class="gline"></div></div>
  <div class="faq-list">${faqHTML}</div>
</div></section>
<section class="cta-sec">
  <h2>${c.headline||'COMECE HOJE'}</h2>
  <p class="cta-sub">Sem fidelidade para começar. Primeira semana grátis.</p>
  <a class="btn" href="${wa}">${WA_SVG} ${c.cta_texto||'Quero Começar Agora'}</a>
</section>
<div class="ct-band" id="contato">
  <div class="ct-item"><span class="ct-icon">📱</span><div><span class="ct-label">WhatsApp</span><span class="ct-val">${diag.telefone}</span></div></div>
  <div class="ct-item"><span class="ct-icon">📍</span><div><span class="ct-label">Localização</span><span class="ct-val">${diag.cidade}</span></div></div>
  <div class="ct-item"><span class="ct-icon">🕐</span><div><span class="ct-label">Horário</span><span class="ct-val">${c.horario||'Seg–Sex: 6h–23h'}</span></div></div>
</div>
<footer><div class="ft-name">${diag.nome}</div><div class="ft-copy">© ${YEAR} ${diag.nome} · ${diag.cidade}. Todos os direitos reservados.</div></footer>
</body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE: CLÍNICA — estilo Marine Studio (branco, seções numeradas, pricing 3 tiers)
// ─────────────────────────────────────────────────────────────────────────────
function buildClinica(diag: any, c: any): string {
  const wa = waLink(diag.telefone, 'Olá! Gostaria de agendar uma avaliação.');
  const city = cityShort(diag.cidade);
  const tratamentos = c.tratamentos||c.servicos||[];
  const numHTML = (c.numeros||[]).map((n:any)=>`<div class="ni"><span class="nv">${n.valor}</span><span class="nl">${n.label}</span></div>`).join('');
  const depHTML = (c.depoimentos||[]).map((d:any,i:number)=>`<div class="dep"><div class="dep-av">${d.nome.charAt(0)}</div><div class="dep-body"><div class="dep-st">★★★★★</div><p>"${d.texto}"</p><strong>${d.nome}</strong><span>${d.cargo}</span></div></div>`).join('');
  const faqHTML = (c.faq||[]).map((f:any)=>`<div class="fq" onclick="this.classList.toggle('o')"><div class="fp"><span>${f.pergunta}</span><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 6l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></div><div class="fr">${f.resposta}</div></div>`).join('');
  const painItems = [
    {n:'01', t: tratamentos[0]?.nome||'Diagnóstico lento', d: tratamentos[0]?.descricao||'Sem uma avaliação correta, o tratamento demora mais que o necessário.'},
    {n:'02', t: tratamentos[1]?.nome||'Falta de especialização', d: tratamentos[1]?.descricao||'Profissionais sem atualização aplicam técnicas ultrapassadas.'},
    {n:'03', t: tratamentos[2]?.nome||'Atendimento impessoal', d: tratamentos[2]?.descricao||'Cada paciente merece atenção individualizada, não um número de prontuário.'},
    {n:'04', t: tratamentos[3]?.nome||'Resultado incerto', d: tratamentos[3]?.descricao||'Sem tecnologia adequada, os resultados ficam aquém do esperado.'},
  ];
  const painHTML = painItems.map(p=>`<div class="pain"><span class="pain-n">${p.n}</span><div class="pain-body"><h3>${p.t}</h3><p>${p.d}</p></div></div>`).join('');
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${diag.nome} | ${city}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--white:#ffffff;--off:#f6f8f9;--off2:#eef2f5;--blue:#1e5a7e;--blue2:#2470a0;--text:#1a2a38;--muted:#6a7e8a;--border:#d4e2ec;--green:#25d366;--green2:#1da851}
html{scroll-behavior:smooth}body{font-family:'Inter',sans-serif;background:var(--white);color:var(--text);line-height:1.65;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}.wrap{max-width:1120px;margin:0 auto;padding:0 32px}
nav{position:sticky;top:0;z-index:200;background:rgba(255,255,255,.97);backdrop-filter:blur(12px);border-bottom:1px solid var(--border)}
.nav-i{display:flex;align-items:center;justify-content:space-between;height:66px}
.nlogo{font-size:.9rem;font-weight:700;color:var(--blue);letter-spacing:.02em}
.nlinks a{font-size:.78rem;font-weight:500;color:var(--muted);margin-left:24px;letter-spacing:.04em;transition:color .2s}.nlinks a:hover{color:var(--blue)}
.nbtn{display:inline-flex;align-items:center;gap:7px;background:var(--blue);color:#fff;padding:9px 20px;font-size:.78rem;font-weight:600;border-radius:6px;transition:background .2s}.nbtn:hover{background:var(--blue2)}
@media(max-width:700px){.nlinks{display:none}}
.hero{padding:88px 32px 80px;text-align:center;background:linear-gradient(160deg,var(--blue) 0%,#2470a0 100%);position:relative;overflow:hidden}
.hero::after{content:'';position:absolute;bottom:0;left:0;right:0;height:60px;background:var(--white);clip-path:ellipse(55% 100% at 50% 100%)}
.hero-badge{display:inline-flex;align-items:center;gap:7px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);color:rgba(255,255,255,.9);padding:5px 16px;font-size:.72rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;border-radius:50px;margin-bottom:28px}
.hero h1{font-size:clamp(2rem,5vw,3.4rem);font-weight:800;line-height:1.15;letter-spacing:-.02em;color:#fff;max-width:700px;margin:0 auto 14px}
.hero-sub{font-size:1rem;font-weight:300;color:rgba(255,255,255,.7);max-width:480px;margin:0 auto 36px;line-height:1.72}
.btn-w{display:inline-flex;align-items:center;gap:8px;background:#fff;color:var(--blue);padding:14px 30px;font-size:.84rem;font-weight:700;border-radius:50px;transition:opacity .2s}.btn-w:hover{opacity:.9}
.btn-g{display:inline-flex;align-items:center;gap:8px;background:var(--green);color:#fff;padding:14px 30px;font-size:.84rem;font-weight:700;border-radius:50px;margin-left:10px;transition:background .2s}.btn-g:hover{background:var(--green2)}
.hero-trust{display:flex;flex-wrap:wrap;justify-content:center;gap:16px;margin-top:28px}
.htrust{display:inline-flex;align-items:center;gap:7px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);color:rgba(255,255,255,.8);padding:5px 14px;border-radius:50px;font-size:.78rem;font-weight:500}
.nband{background:var(--off);border-top:1px solid var(--border);border-bottom:1px solid var(--border);padding:44px 32px}
.ngrid{display:flex;justify-content:center;flex-wrap:wrap}
.ni{text-align:center;padding:0 48px;position:relative}.ni+.ni::before{content:'';position:absolute;left:0;top:50%;transform:translateY(-50%);width:1px;height:36px;background:var(--border)}
.nv{display:block;font-size:2.4rem;font-weight:800;color:var(--blue);line-height:1;letter-spacing:-.02em}.nl{display:block;font-size:.68rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-top:6px;font-weight:500}
@media(max-width:600px){.ni{padding:18px 22px}}
.pain-sec{padding:88px 32px;background:var(--white)}
.sec-h{text-align:center;margin-bottom:52px}
.sec-tag{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:var(--blue);font-weight:600;display:block;margin-bottom:10px}
.sec-tit{font-size:clamp(1.7rem,3.8vw,2.3rem);font-weight:800;color:var(--text);letter-spacing:-.02em}
.sec-sub{font-size:.93rem;color:var(--muted);margin-top:10px;font-weight:300}
.pain-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px}
.pain{background:var(--off);border:1px solid var(--border);padding:32px 28px;border-radius:10px;display:flex;gap:20px;align-items:flex-start;transition:all .25s}
.pain:hover{border-color:var(--blue);box-shadow:0 6px 28px rgba(30,90,126,.08)}
.pain-n{font-size:2.2rem;font-weight:900;color:var(--blue);opacity:.18;line-height:1;flex-shrink:0;letter-spacing:-.03em}
.pain-body h3{font-size:.98rem;font-weight:700;color:var(--text);margin-bottom:8px}.pain-body p{font-size:.84rem;color:var(--muted);line-height:1.65}
.trat-sec{padding:88px 32px;background:var(--off)}
.tcards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}
.tc{background:var(--white);border:1px solid var(--border);padding:32px 26px;border-radius:10px;text-align:center;transition:all .25s}
.tc:hover{box-shadow:0 8px 32px rgba(30,90,126,.1);border-color:var(--blue)}
.tc-ico{font-size:2rem;margin-bottom:12px;display:block}.tc h3{font-size:.97rem;font-weight:700;color:var(--blue);margin-bottom:8px}.tc p{font-size:.83rem;color:var(--muted);line-height:1.62}
.pricing-sec{padding:88px 32px;background:var(--white)}
.pricing-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:16px;max-width:900px;margin:0 auto}
.pkg{background:var(--off);border:1px solid var(--border);border-radius:12px;padding:36px 28px;text-align:center;transition:all .25s;position:relative}
.pkg-pop{background:var(--blue);border-color:var(--blue);color:#fff}
.pkg-badge{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:var(--green);color:#fff;font-size:.65rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:3px 12px;border-radius:50px}
.pkg-name{font-size:.72rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--blue);margin-bottom:12px}
.pkg-pop .pkg-name{color:rgba(255,255,255,.7)}
.pkg-price{font-size:2.2rem;font-weight:800;color:var(--text);letter-spacing:-.02em;line-height:1;margin-bottom:8px}
.pkg-pop .pkg-price{color:#fff}
.pkg-period{font-size:.78rem;color:var(--muted);margin-bottom:24px}
.pkg-pop .pkg-period{color:rgba(255,255,255,.6)}
.pkg-list{list-style:none;margin-bottom:28px;text-align:left}
.pkg-list li{font-size:.84rem;color:var(--text);padding:7px 0;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px}
.pkg-pop .pkg-list li{color:rgba(255,255,255,.85);border-color:rgba(255,255,255,.15)}
.pkg-list li::before{content:'✓';color:var(--green);font-weight:700;flex-shrink:0}
.pkg-btn{display:block;background:var(--blue);color:#fff;padding:12px;font-size:.8rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;border-radius:50px;transition:background .2s}.pkg-btn:hover{background:var(--blue2)}
.pkg-pop .pkg-btn{background:#fff;color:var(--blue)}.pkg-pop .pkg-btn:hover{background:var(--off2)}
.dep-sec{padding:88px 32px;background:var(--off)}
.depgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;max-width:1100px;margin:0 auto}
.dep{background:var(--white);border:1px solid var(--border);padding:28px 24px;border-radius:10px;display:flex;gap:16px;align-items:flex-start}
.dep-av{width:44px;height:44px;min-width:44px;background:var(--blue);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:1rem;font-weight:700}
.dep-st{color:#f5a623;font-size:.8rem;letter-spacing:1px;margin-bottom:8px}
.dep-body p{font-size:.88rem;color:var(--text);line-height:1.72;margin-bottom:10px;font-style:italic}
.dep-body strong{display:block;font-size:.82rem;font-weight:700;color:var(--blue)}.dep-body span{font-size:.74rem;color:var(--muted)}
.faq-sec{padding:80px 32px;background:var(--white)}
.faq-list{max-width:700px;margin:0 auto}
.fq{border-bottom:1px solid var(--border);cursor:pointer}
.fp{display:flex;justify-content:space-between;align-items:center;padding:20px 0;font-size:.9rem;color:var(--text);font-weight:500;transition:color .2s}
.fp svg{flex-shrink:0;transition:transform .25s;color:var(--blue)}.fq.o .fp{color:var(--blue)}.fq.o .fp svg{transform:rotate(180deg)}
.fr{display:none;font-size:.87rem;color:var(--muted);padding:0 0 18px;line-height:1.8}.fq.o .fr{display:block}
.cta-sec{padding:72px 32px;background:var(--blue);text-align:center}
.cta-sec h2{font-size:clamp(1.6rem,4vw,2.4rem);font-weight:800;letter-spacing:-.02em;color:#fff;margin-bottom:10px}
.cta-sec p{font-size:.95rem;font-weight:300;color:rgba(255,255,255,.65);margin-bottom:32px}
.ct-band{background:var(--off);border-top:1px solid var(--border);display:flex;flex-wrap:wrap;justify-content:center}
.ct-item{display:flex;align-items:center;gap:14px;padding:22px 40px;border-right:1px solid var(--border)}.ct-item:last-child{border-right:none}
.ct-icon{font-size:1.2rem;flex-shrink:0}.ct-label{font-size:.6rem;letter-spacing:.18em;text-transform:uppercase;color:var(--blue);font-weight:600;display:block;margin-bottom:3px}
.ct-val{font-size:.87rem;color:var(--text);font-weight:500}
@media(max-width:600px){.ct-item{border-right:none;border-bottom:1px solid var(--border);width:100%;justify-content:center}}
footer{background:var(--white);border-top:1px solid var(--border);padding:32px;text-align:center}
.ft-name{font-size:.9rem;font-weight:700;color:var(--blue);margin-bottom:4px}.ft-copy{font-size:.74rem;color:var(--muted);margin-top:4px}
</style></head><body>
<nav><div class="wrap nav-i">
  <div class="nlogo">${diag.nome}</div>
  <div class="nlinks"><a href="#problemas">Tratamentos</a><a href="#planos">Planos</a><a href="#contato">Contato</a></div>
  <a class="nbtn" href="${wa}">Agendar Avaliação</a>
</div></nav>
<section class="hero">
  <div class="hero-badge">🏥 Clínica · ${city}</div>
  <h1>${c.headline||'Cuidado Especializado para Sua Saúde'}</h1>
  <p class="hero-sub">${c.subheadline||''}</p>
  <div>
    <a class="btn-g" href="${wa}">${WA_SVG} ${c.cta_texto||'Agendar Avaliação Gratuita'}</a>
  </div>
  <div class="hero-trust">
    <span class="htrust">🎓 Especialistas certificados</span>
    <span class="htrust">⭐ ${c.nota_google||'4.9'} no Google</span>
    <span class="htrust">🤝 1ª consulta gratuita</span>
  </div>
</section>
<div class="nband"><div class="wrap ngrid">${numHTML}</div></div>
<section class="pain-sec" id="problemas"><div class="wrap">
  <div class="sec-h"><span class="sec-tag">Você reconhece este problema?</span><h2 class="sec-tit">Por que pacientes nos escolhem</h2><p class="sec-sub">Identificamos os 4 problemas mais comuns em clínicas convencionais.</p></div>
  <div class="pain-grid">${painHTML}</div>
</div></section>
<section class="trat-sec" id="tratamentos"><div class="wrap">
  <div class="sec-h"><span class="sec-tag">Nossas soluções</span><h2 class="sec-tit">Tratamentos Especializados</h2></div>
  <div class="tcards">${tratamentos.map((s:any)=>`<div class="tc"><div class="tc-ico">${s.icone||'🩺'}</div><h3>${s.nome}</h3><p>${s.descricao}</p></div>`).join('')}</div>
</div></section>
<section class="pricing-sec" id="planos"><div class="wrap">
  <div class="sec-h"><span class="sec-tag">Investimento</span><h2 class="sec-tit">Planos de Tratamento</h2><p class="sec-sub">Opções para cada necessidade, sem surpresas.</p></div>
  <div class="pricing-grid">
    <div class="pkg">
      <div class="pkg-name">Avaliação</div>
      <div class="pkg-price">Grátis</div>
      <div class="pkg-period">sem compromisso</div>
      <ul class="pkg-list"><li>Consulta inicial completa</li><li>Diagnóstico personalizado</li><li>Orientações gerais</li></ul>
      <a class="pkg-btn" href="${wa}">Agendar Agora</a>
    </div>
    <div class="pkg pkg-pop">
      <div class="pkg-badge">Mais Escolhido</div>
      <div class="pkg-name">Tratamento</div>
      <div class="pkg-price">Sob consulta</div>
      <div class="pkg-period">plano personalizado</div>
      <ul class="pkg-list"><li>Protocolo individualizado</li><li>Acompanhamento contínuo</li><li>Retornos incluídos</li><li>Garantia de resultado</li></ul>
      <a class="pkg-btn" href="${wa}">${WA_SVG} Falar com Especialista</a>
    </div>
    <div class="pkg">
      <div class="pkg-name">Premium</div>
      <div class="pkg-price">All-in</div>
      <div class="pkg-period">cuidado completo</div>
      <ul class="pkg-list"><li>Tudo do plano Tratamento</li><li>Prioridade no agendamento</li><li>Suporte direto 7 dias</li></ul>
      <a class="pkg-btn" href="${wa}">Saiba Mais</a>
    </div>
  </div>
</div></section>
<section class="dep-sec"><div class="wrap">
  <div class="sec-h"><span class="sec-tag">Resultados reais</span><h2 class="sec-tit">O Que Dizem Nossos Pacientes</h2></div>
  <div class="depgrid">${depHTML}</div>
</div></section>
<section class="faq-sec"><div class="wrap">
  <div class="sec-h" style="margin-bottom:36px"><span class="sec-tag">Dúvidas frequentes</span><h2 class="sec-tit">Perguntas Frequentes</h2></div>
  <div class="faq-list">${faqHTML}</div>
</div></section>
<section class="cta-sec">
  <h2>Receba seu diagnóstico em 24h</h2>
  <p>Agende agora e fale diretamente com um especialista. Sem filas, sem burocracia.</p>
  <a class="btn-w" href="${wa}">${WA_SVG} ${c.cta_texto||'Agendar Avaliação Gratuita'}</a>
</section>
<div class="ct-band" id="contato">
  <div class="ct-item"><span class="ct-icon">📱</span><div><span class="ct-label">WhatsApp</span><span class="ct-val">${diag.telefone}</span></div></div>
  <div class="ct-item"><span class="ct-icon">📍</span><div><span class="ct-label">Localização</span><span class="ct-val">${diag.cidade}</span></div></div>
  <div class="ct-item"><span class="ct-icon">🕐</span><div><span class="ct-label">Horário</span><span class="ct-val">${c.horario||'Seg–Sex 8h–19h'}</span></div></div>
</div>
<footer><div class="ft-name">${diag.nome}</div><div class="ft-copy">© ${YEAR} ${diag.nome} · ${diag.cidade}. Todos os direitos reservados.</div></footer>
</body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE: CONSTRUTORA — estilo Bueno Brandão 257 (branco puro, areia, luxury minimal)
// ─────────────────────────────────────────────────────────────────────────────
function buildConstrutora(diag: any, c: any): string {
  const wa = waLink(diag.telefone, 'Olá! Gostaria de solicitar um orçamento.');
  const city = cityShort(diag.cidade);
  const srvHTML = (c.servicos||[]).map((s:any)=>`<div class="sc"><div class="sc-ico">${s.icone||'🏗'}</div><h3>${s.nome}</h3><p>${s.descricao}</p></div>`).join('');
  const numHTML = (c.numeros||[]).map((n:any)=>`<div class="ni"><span class="nv">${n.valor}</span><span class="nl">${n.label}</span></div>`).join('');
  const depHTML = (c.depoimentos||[]).map((d:any)=>`<div class="dep"><div class="dep-st">★★★★★</div><p>"${d.texto}"</p><strong>${d.nome}</strong><span>${d.cargo}</span></div>`).join('');
  const faqHTML = (c.faq||[]).map((f:any)=>`<div class="fq" onclick="this.classList.toggle('o')"><div class="fp"><span>${f.pergunta}</span><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 6l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></div><div class="fr">${f.resposta}</div></div>`).join('');
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${diag.nome} | ${city}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,800;1,400&family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--white:#ffffff;--off:#f8f7f2;--sand:#ede8df;--sand2:#e0d8cc;--text:#1a1a18;--text2:#3c3834;--muted:#8a8880;--warm:#8a7850;--warm2:#a89260;--border:#e0ddd8}
html{scroll-behavior:smooth}body{font-family:'Inter',sans-serif;background:var(--white);color:var(--text);line-height:1.65;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}.wrap{max-width:1120px;margin:0 auto;padding:0 32px}
nav{position:sticky;top:0;z-index:200;background:rgba(255,255,255,.97);backdrop-filter:blur(12px);border-bottom:1px solid var(--border)}
.nav-i{display:flex;align-items:center;justify-content:space-between;height:68px}
.nlogo{font-size:.9rem;font-weight:700;letter-spacing:.05em;color:var(--text);text-transform:uppercase}
.nlinks a{font-size:.78rem;font-weight:500;color:var(--muted);margin-left:28px;letter-spacing:.04em;transition:color .2s}.nlinks a:hover{color:var(--text)}
.nbtn{display:inline-flex;align-items:center;gap:7px;border:1.5px solid var(--warm);color:var(--warm);padding:9px 20px;font-size:.78rem;font-weight:600;letter-spacing:.06em;transition:all .2s}.nbtn:hover{background:var(--warm);color:#fff}
@media(max-width:700px){.nlinks{display:none}}
.hero{padding:100px 32px 96px;background:var(--white);border-bottom:1px solid var(--border)}
.hero-inner{max-width:800px}
.hero-tag{display:inline-block;border-left:3px solid var(--warm);padding-left:14px;font-size:.72rem;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--warm);margin-bottom:32px}
.hero h1{font-family:'Playfair Display',serif;font-size:clamp(2.4rem,6vw,4.8rem);font-weight:800;line-height:1.08;letter-spacing:-.02em;color:var(--text);max-width:750px;margin-bottom:20px}
.hero h1 em{font-style:italic;color:var(--warm)}
.hero-sub{font-size:1rem;font-weight:300;color:var(--muted);max-width:500px;margin-bottom:40px;line-height:1.78}
.btn-d{display:inline-flex;align-items:center;gap:8px;background:var(--text);color:#fff;padding:14px 32px;font-size:.84rem;font-weight:600;letter-spacing:.06em;transition:background .2s}.btn-d:hover{background:var(--text2)}
.btn-o{display:inline-flex;align-items:center;gap:8px;border:1.5px solid var(--border);color:var(--text2);padding:13px 26px;font-size:.82rem;font-weight:500;margin-left:10px;transition:border-color .2s}.btn-o:hover{border-color:var(--warm)}
.hero-rat{margin-top:32px;font-size:.8rem;color:var(--muted);display:flex;align-items:center;gap:8px}.hst{color:#c8a860;letter-spacing:1px}
.metrics{display:flex;flex-wrap:wrap;gap:0;border-top:1px solid var(--border);border-bottom:1px solid var(--border);background:var(--off)}
.metric{flex:1;min-width:140px;padding:36px 28px;border-right:1px solid var(--border);text-align:center}.metric:last-child{border-right:none}
.metric-v{display:block;font-family:'Playfair Display',serif;font-size:2.6rem;font-weight:800;color:var(--text);line-height:1;letter-spacing:-.02em}
.metric-l{display:block;font-size:.68rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-top:6px;font-weight:500}
@media(max-width:700px){.metric{min-width:50%;border-bottom:1px solid var(--border)}}
.srv-sec{padding:96px 32px;background:var(--white)}
.sec-h{text-align:center;margin-bottom:56px}
.sec-tag{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:var(--warm);font-weight:600;display:block;margin-bottom:10px}
.sec-tit{font-family:'Playfair Display',serif;font-size:clamp(1.7rem,3.8vw,2.5rem);font-weight:800;color:var(--text);letter-spacing:-.01em}
.scards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:2px;background:var(--border)}
.sc{background:var(--white);padding:40px 32px;text-align:center;transition:background .25s;position:relative;overflow:hidden}
.sc::after{content:'';position:absolute;bottom:0;left:0;right:0;height:2px;background:var(--warm);transform:scaleX(0);transition:transform .3s}
.sc:hover{background:var(--off)}.sc:hover::after{transform:scaleX(1)}
.sc-ico{font-size:2rem;margin-bottom:14px;display:block}.sc h3{font-size:.98rem;font-weight:700;color:var(--text);margin-bottom:8px;letter-spacing:.02em}.sc p{font-size:.83rem;color:var(--muted);line-height:1.65}
.ab-sec{padding:96px 32px;background:var(--off)}
.ab-inner{display:grid;grid-template-columns:1fr 1fr;gap:80px;align-items:center;max-width:1100px;margin:0 auto}
.ab-vis{aspect-ratio:4/3;background:var(--sand);border:1px solid var(--border);position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px}
.av-sym{font-size:2.5rem;color:var(--warm);opacity:.25}.av-t{font-size:.88rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.ab-tit{font-family:'Playfair Display',serif;font-size:clamp(1.6rem,3.5vw,2.3rem);font-weight:800;color:var(--text);letter-spacing:-.01em;margin-bottom:14px;line-height:1.18}
.ab-txt{font-size:.93rem;font-weight:300;color:var(--muted);line-height:1.82;margin-bottom:24px}
.ab-det{display:flex;align-items:flex-start;gap:12px;font-size:.85rem;color:var(--text2);margin-bottom:10px;font-weight:500;line-height:1.5}
.ab-line{width:16px;min-width:16px;height:2px;background:var(--warm);margin-top:9px}
@media(max-width:800px){.ab-inner{grid-template-columns:1fr}.ab-vis{display:none}}
.amenities{padding:96px 32px;background:var(--white)}
.amenities-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
.am{background:var(--off);border:1px solid var(--border);padding:32px 24px;text-align:center;transition:all .25s}
.am:hover{border-color:var(--warm);box-shadow:0 6px 24px rgba(138,120,80,.08)}
.am-ico{font-size:1.8rem;margin-bottom:12px;display:block}.am h3{font-size:.93rem;font-weight:700;color:var(--text);margin-bottom:6px}.am p{font-size:.81rem;color:var(--muted);line-height:1.6}
@media(max-width:700px){.amenities-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:480px){.amenities-grid{grid-template-columns:1fr}}
.dep-sec{padding:88px 32px;background:var(--off)}
.depgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:16px;max-width:1100px;margin:0 auto}
.dep{background:var(--white);border:1px solid var(--border);padding:28px 24px}
.dep-st{color:#c8a860;font-size:.82rem;letter-spacing:1px;margin-bottom:10px}
.dep p{font-size:.9rem;color:var(--text2);line-height:1.75;margin-bottom:14px;font-style:italic}
.dep strong{display:block;font-size:.83rem;font-weight:700;color:var(--text)}.dep span{font-size:.76rem;color:var(--muted)}
.faq-sec{padding:80px 32px;background:var(--sand)}
.faq-list{max-width:700px;margin:0 auto}
.fq{border-bottom:1px solid var(--border);cursor:pointer}
.fp{display:flex;justify-content:space-between;align-items:center;padding:20px 0;font-size:.9rem;color:var(--text);font-weight:500;transition:color .2s}
.fp svg{flex-shrink:0;transition:transform .25s;color:var(--warm)}.fq.o .fp{color:var(--warm)}.fq.o .fp svg{transform:rotate(180deg)}
.fr{display:none;font-size:.87rem;color:var(--muted);padding:0 0 18px;line-height:1.8}.fq.o .fr{display:block}
.cta-sec{padding:88px 32px;background:var(--white);text-align:center;border-top:1px solid var(--border)}
.cta-sec h2{font-family:'Playfair Display',serif;font-size:clamp(1.8rem,4vw,2.8rem);font-weight:800;letter-spacing:-.01em;margin-bottom:12px;color:var(--text)}
.cta-sec p{font-size:.95rem;color:var(--muted);margin-bottom:36px;font-weight:300}
.ct-band{background:var(--off);border-top:1px solid var(--border);display:flex;flex-wrap:wrap;justify-content:center}
.ct-item{display:flex;align-items:center;gap:14px;padding:24px 40px;border-right:1px solid var(--border)}.ct-item:last-child{border-right:none}
.ct-icon{font-size:1.2rem;flex-shrink:0}.ct-label{font-size:.6rem;letter-spacing:.18em;text-transform:uppercase;color:var(--warm);font-weight:600;display:block;margin-bottom:3px}
.ct-val{font-size:.87rem;color:var(--text2);font-weight:500}
@media(max-width:600px){.ct-item{border-right:none;border-bottom:1px solid var(--border);width:100%;justify-content:center}}
footer{background:var(--white);border-top:1px solid var(--border);padding:32px;text-align:center}
.ft-name{font-size:.9rem;font-weight:700;color:var(--text);letter-spacing:.04em;text-transform:uppercase;margin-bottom:4px}.ft-copy{font-size:.74rem;color:var(--muted);margin-top:4px}
</style></head><body>
<nav><div class="wrap nav-i">
  <div class="nlogo">${diag.nome.split(' ').slice(0,2).join(' ')}</div>
  <div class="nlinks"><a href="#servicos">Serviços</a><a href="#sobre">Sobre</a><a href="#contato">Contato</a></div>
  <a class="nbtn" href="${wa}">Solicitar Orçamento</a>
</div></nav>
<section class="hero"><div class="wrap">
  <div class="hero-inner">
    <div class="hero-tag">Construtora · ${city}</div>
    <h1>${c.headline||'Viva no detalhe em <em>um projeto único</em>'}</h1>
    <p class="hero-sub">${c.subheadline||''}</p>
    <div>
      <a class="btn-d" href="${wa}">${WA_SVG} ${c.cta_texto||'Solicitar Orçamento Gratuito'}</a>
      <a class="btn-o" href="#servicos">Nossos Serviços</a>
    </div>
    <div class="hero-rat"><span class="hst">★★★★★</span>&nbsp;${c.nota_google||'4.9'} no Google · ${c.total_avaliacoes||'centenas de'} avaliações</div>
  </div>
</div></section>
<div class="metrics"><div class="wrap" style="display:flex;flex-wrap:wrap;width:100%">${numHTML}</div></div>
<section class="srv-sec" id="servicos"><div class="wrap">
  <div class="sec-h"><span class="sec-tag">O que construímos</span><h2 class="sec-tit">Nossos Serviços</h2></div>
  <div class="scards">${srvHTML}</div>
</div></section>
<section class="ab-sec" id="sobre"><div class="ab-inner">
  <div class="ab-vis"><div class="av-sym">◆</div><div class="av-t">${diag.nome}</div></div>
  <div>
    <span class="sec-tag" style="text-align:left;display:block;margin-bottom:10px">Nossa Empresa</span>
    <h2 class="ab-tit">${c.sobre_titulo||'Solidez e Compromisso'}</h2>
    <p class="ab-txt">${c.sobre_texto||''}</p>
    <div class="ab-det"><div class="ab-line"></div>Engenheiros e arquitetos com registro ativo no CREA/CAU</div>
    <div class="ab-det"><div class="ab-line"></div>Orçamento detalhado, cronograma claro e comunicação transparente</div>
    <div class="ab-det"><div class="ab-line"></div>Garantia de obra e suporte completo pós-entrega</div>
    <br><a class="btn-d" href="${wa}" style="margin-top:16px">${WA_SVG} Solicitar Orçamento Gratuito</a>
  </div>
</div></section>
<section class="amenities"><div class="wrap">
  <div class="sec-h"><span class="sec-tag">Nossos diferenciais</span><h2 class="sec-tit">Por que nos escolher</h2></div>
  <div class="amenities-grid">
    <div class="am"><div class="am-ico">📐</div><h3>Projeto Personalizado</h3><p>Cada obra começa do zero, do briefing ao acabamento.</p></div>
    <div class="am"><div class="am-ico">🏆</div><h3>Qualidade Comprovada</h3><p>Materiais selecionados e execução com padrão premium.</p></div>
    <div class="am"><div class="am-ico">📅</div><h3>Prazo Garantido</h3><p>Cronograma rigoroso e comunicação semanal de andamento.</p></div>
    <div class="am"><div class="am-ico">💬</div><h3>Orçamento Transparente</h3><p>Sem surpresas. Cada item detalhado antes de começar.</p></div>
    <div class="am"><div class="am-ico">🔒</div><h3>Garantia de Obra</h3><p>Cobertura completa pós-entrega e suporte continuado.</p></div>
    <div class="am"><div class="am-ico">🌿</div><h3>Sustentabilidade</h3><p>Práticas e materiais que respeitam o meio ambiente.</p></div>
  </div>
</div></section>
<section class="dep-sec"><div class="wrap">
  <div class="sec-h"><span class="sec-tag">Quem confiou em nós</span><h2 class="sec-tit">Depoimentos de Clientes</h2></div>
  <div class="depgrid">${depHTML}</div>
</div></section>
<section class="faq-sec"><div class="wrap">
  <div class="sec-h" style="margin-bottom:36px"><span class="sec-tag">Dúvidas</span><h2 class="sec-tit">Perguntas Frequentes</h2></div>
  <div class="faq-list">${faqHTML}</div>
</div></section>
<section class="cta-sec">
  <h2>Pronto para construir seu projeto?</h2>
  <p>Orçamento gratuito e detalhado. Sem compromisso, sem pressão.</p>
  <a class="btn-d" href="${wa}">${WA_SVG} ${c.cta_texto||'Solicitar Orçamento'}</a>
</section>
<div class="ct-band" id="contato">
  <div class="ct-item"><span class="ct-icon">📱</span><div><span class="ct-label">WhatsApp</span><span class="ct-val">${diag.telefone}</span></div></div>
  <div class="ct-item"><span class="ct-icon">📍</span><div><span class="ct-label">Localização</span><span class="ct-val">${diag.cidade}</span></div></div>
  <div class="ct-item"><span class="ct-icon">🕐</span><div><span class="ct-label">Horário</span><span class="ct-val">${c.horario||'Seg–Sex 8h–18h'}</span></div></div>
</div>
<footer><div class="ft-name">${diag.nome}</div><div class="ft-copy">© ${YEAR} ${diag.nome} · ${diag.cidade}. Todos os direitos reservados.</div></footer>
</body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE ROUTER
// ─────────────────────────────────────────────────────────────────────────────
function buildHTML(diag: any, c: any): string {
  switch (getSegment(diag.categoria)) {
    case 'barbearia':    return buildBarbearia(diag, c);
    case 'imobiliaria':  return buildImobiliaria(diag, c);
    case 'salao':        return buildSalao(diag, c);
    case 'restaurante':  return buildRestaurante(diag, c);
    case 'academia':     return buildAcademia(diag, c);
    case 'clinica':      return buildClinica(diag, c);
    case 'construtora':  return buildConstrutora(diag, c);
    default:             return buildImobiliaria(diag, c);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const diagFile = path.join(DATA_DIR, `diagnosticos_${TODAY}.json`);
  if (!fs.existsSync(diagFile)) { console.error(`Não encontrado: ${diagFile}`); process.exit(1); }
  const diagnosticos = JSON.parse(fs.readFileSync(diagFile, 'utf-8'));
  console.log(`\nGerando ${diagnosticos.length} landing pages por segmento...\n`);
  for (const diag of diagnosticos) {
    const seg = getSegment(diag.categoria);
    console.log(`⏳ [${seg}] ${diag.nome}`);
    const pageDir = path.join(PAGES_DIR, diag.slug);
    fs.mkdirSync(pageDir, { recursive: true });
    try {
      const content = await generateContent(diag);
      const html = buildHTML(diag, content);
      fs.writeFileSync(path.join(pageDir, 'index.html'), html, 'utf-8');
      console.log(`  ✓ http://localhost:3000/pages/${diag.slug}`);
    } catch (err: any) {
      console.error(`  ✗ ${err.message}`);
    }
  }
  console.log('\n✅ Pronto.');
}

export { generateContent, buildHTML, getSegment };

if (require.main === module) main();

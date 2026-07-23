# Braseiro Pizzaria — site institucional

Site institucional completo para uma pizzaria premium, construído em
Next.js (App Router) + TypeScript + Tailwind CSS. **Sem banco de dados,
sem backend** — todo o conteúdo vive em arquivos locais dentro de `/data`,
prontos pra você editar ou, no futuro, trocar por uma API própria sem
mexer em nenhum componente visual.

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind CSS v4 ·
Framer Motion · React Hook Form + Zod · Embla Carousel · Radix UI
(Accordion, Dialog, Label, Separator, Slot) · Sonner (toasts) · Lucide
Icons · next/font (Playfair Display + Manrope) · ESLint + Prettier.

## Como rodar

```bash
npm install
npm run dev            # http://localhost:3000
```

Outros scripts úteis:

```bash
npm run build            # build de produção
npm run start             # roda o build de produção
npm run lint                # ESLint
npm run typecheck            # tsc --noEmit
npm run format                 # Prettier (escreve)
npm run format:check              # Prettier (só verifica)
npm run placeholders                 # regenera as imagens placeholder em /public/images
```

## Onde editar o conteúdo

**Nada de conteúdo está "hardcoded" dentro dos componentes.** Tudo vem de
`/data`, tipado via `/types` e acessado através de `/lib` (a camada que
vai virar chamadas de API no dia em que você tiver um backend):

| Arquivo                  | O que controla                                                              |
| ------------------------ | ---------------------------------------------------------------------------- |
| `data/settings.ts`       | Nome, telefone, endereço, horários, redes sociais, estatísticas do "Sobre"    |
| `data/pizzas.ts`         | Cardápio de pizzas (tradicionais, especiais, doces)                          |
| `data/drinks.ts`         | Bebidas                                                                     |
| `data/desserts.ts`       | Sobremesas (além das pizzas doces)                                          |
| `data/differentials.ts` | Cards da seção "Diferenciais"                                               |
| `data/how-it-works.ts`  | Passos do "Como funciona"                                                   |
| `data/promotions.ts`    | Banner e cards de promoções (o countdown é só visual)                        |
| `data/gallery.ts`       | Fotos da galeria (o campo `span` controla o tamanho no grid assimétrico)      |
| `data/testimonials.ts`  | Depoimentos do carrossel                                                    |
| `data/faq.ts`           | Perguntas frequentes                                                        |

Basta editar os arrays desses arquivos — adicionar, remover ou reordenar
itens já reflete automaticamente no site (cardápio, galeria e depoimentos
usam `.map()`, então a lista pode ter qualquer tamanho).

## Imagens

Todas as imagens em `public/images/*.svg` são **placeholders gerados
localmente** (veja `scripts/generate-placeholders.mjs`) — não são fotos
reais, são só formas/gradientes na paleta da marca, pra não depender de
nenhuma imagem externa enquanto você não tem fotos profissionais.

Pra trocar por fotos de verdade:

1. Coloque o arquivo (`.jpg`/`.png`/`.webp`) em `public/images/`.
2. Troque o campo `image`/`src`/`avatar` correspondente em `/data` pelo
   novo caminho.
3. Pronto — `next/image` cuida de otimização, lazy loading e do
   dimensionamento (sem _layout shift_).

## Arquitetura

```
app/                     rotas, layout raiz, metadata, robots.ts, sitemap.ts
components/
  ui/                    primitivos reutilizáveis (Button, Card, Dialog, Accordion...)
  sections/              uma seção da landing page por arquivo (Hero, Menu, FAQ...)
  cards/                 cards usados dentro das seções (PizzaCard, GalleryItem...)
hooks/                   lógica isolada e reutilizável (filtro do cardápio, countdown,
                         scroll do header, contador animado, lightbox...)
lib/                     acesso a dados (menu.ts, content.ts) + validação (Zod) + utils
types/                   interfaces TypeScript centralizadas
data/                    conteúdo do site (ver tabela acima)
```

`app/page.tsx` é um Server Component: ele dá `await` em cada função de
`lib/menu.ts`/`lib/content.ts` e passa os dados como props pras seções.
Quando existir uma API própria, essas funções passam a fazer `fetch(...)`
em vez de ler os arrays de `/data` — nenhuma seção precisa mudar.

## Formulário de contato

Validado com **React Hook Form + Zod** (nome, telefone, e-mail e
mensagem). Não há envio real: ao validar com sucesso, aparece o toast
"Mensagem pronta para integração." — é o ponto exato onde, no futuro,
entra uma chamada `fetch`/Server Action pra uma API ou serviço de
formulário (Formspree, Resend, etc.).

## SEO e acessibilidade

- Metadata completa (title template, description, Open Graph, Twitter
  Card, canonical) em `app/layout.tsx`.
- JSON-LD `schema.org/Restaurant` com endereço, telefone e horários.
- `app/robots.ts` e `app/sitemap.ts` (rotas geradas pelo Next.js).
- Testado com `@axe-core` (0 violações no estado padrão, no menu mobile
  aberto, no accordion do FAQ aberto e no lightbox da galeria).
- Navegação por teclado, `aria-label`/`aria-describedby` nos campos do
  formulário, foco visível em todos os elementos interativos, `alt` em
  todas as imagens (decorativas marcadas com `aria-hidden`).

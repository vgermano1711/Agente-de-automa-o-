# Site estático — Braseiro Pizzaria

Um site de página única (`index.html` + `style.css` + `script.js`), 100%
estático, com tema de pizzaria. Não existe servidor, API ou banco de dados
aqui dentro — é só abrir o `index.html` no navegador ou subir os 3 arquivos
em qualquer hospedagem gratuita (GitHub Pages, Netlify, Vercel, Surge...).

O banco de dados fica **separado**, na pasta [`/database`](../database) —
esse site é só o "coringa" visual pra praticar o banco sem se preocupar com
frontend também.

## Arquivos

- `index.html` — todo o conteúdo e a estrutura das seções.
- `style.css` — cores, tipografia e animações. As variáveis no topo do
  arquivo (`:root`) controlam a identidade visual inteira.
- `script.js` — interações (cursor customizado, menu mobile, scroll
  reveal, contador animado, tilt nos cards, slider de depoimentos e o
  formulário de pedido via `mailto:`).

## O que editar primeiro

Procure por `TROQUE AQUI` nos três arquivos — são os pontos que mais
importam:

1. **Nome/marca** — `.logo` no `index.html` e `--accent` / `--accent-2`
   no topo do `style.css` se quiser outras cores.
2. **Textos** — hero, seção "Sobre", cardápio, mais pedidas e depoimentos.
   Duplique os blocos `.service-card`, `.project-card` ou `.testimonial`
   para adicionar mais itens; apague os que não usar.
3. **E-mail/contato** — troque `contato@braseiropizzaria.com.br` no
   `index.html` (link `.contact__email`) e no `script.js` (linha do
   `mailto:`).
4. **Fotos das pizzas** — hoje os cards usam gradientes CSS
   (`.project-card__media--a/b/c/d`). Pra usar fotos reais, troque o
   `background:` dessas classes por
   `background-image: url("assets/sua-imagem.jpg");` — a pasta
   `assets/` já existe para isso.

## Publicar

Qualquer uma dessas opções funciona sem configurar nada além de subir os
arquivos:

- **GitHub Pages**: Settings → Pages → Source: pasta `/site` (ou mova o
  conteúdo pra raiz de um repo próprio).
- **Netlify / Vercel**: arraste a pasta `site/` no painel deles.
- **Local**: só dar duplo clique no `index.html`.

## Formulário de pedido

O botão "Enviar pedido" não fala com nenhum servidor — ele monta um link
`mailto:` com nome, telefone, endereço de entrega e o pedido já preenchidos,
e abre o cliente de e-mail de quem está visitando. Os campos foram
escolhidos de propósito pra bater com as tabelas `pessoa`, `endereco` e
`pedido` do banco em `/database` — dá pra visualizar a ligação entre "o que
a pessoa digita" e "o que vira linha de tabela", mesmo sem o site estar de
fato conectado ao banco.

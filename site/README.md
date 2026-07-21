# Site estático — sem banco de dados

Um site de página única (`index.html` + `style.css` + `script.js`), 100%
estático. Não existe servidor, API ou banco de dados envolvido — é só abrir
o `index.html` no navegador ou subir os 3 arquivos em qualquer hospedagem
gratuita (GitHub Pages, Netlify, Vercel, Surge...).

## Arquivos

- `index.html` — todo o conteúdo e a estrutura das seções.
- `style.css` — cores, tipografia e animações. As variáveis no topo do
  arquivo (`:root`) controlam a identidade visual inteira.
- `script.js` — interações (cursor customizado, menu mobile, scroll
  reveal, contador animado, tilt nos cards, slider de depoimentos e o
  formulário de contato via `mailto:`).

## O que editar primeiro

Procure por `TROQUE AQUI` nos três arquivos — são os pontos que mais
importam:

1. **Nome/marca** — `.logo` no `index.html` e `--accent` / `--accent-2`
   no topo do `style.css` se quiser outras cores.
2. **Textos** — hero, seção "Sobre", serviços, projetos e depoimentos.
   Duplique os blocos `.service-card`, `.project-card` ou `.testimonial`
   para adicionar mais itens; apague os que não usar.
3. **E-mail de contato** — troque `seuemail@exemplo.com` no `index.html`
   (link `.contact__email`) e no `script.js` (linha do `mailto:`).
4. **Imagens dos projetos** — hoje os cards usam gradientes CSS
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

## Formulário de contato

O botão "Enviar mensagem" não fala com nenhum servidor — ele monta um
link `mailto:` com nome, e-mail e mensagem já preenchidos e abre o
cliente de e-mail de quem está visitando. Se no futuro você quiser
receber as mensagens direto numa caixa de entrada sem escrever backend,
serviços como Formspree ou Web3Forms fazem isso por você — mas isso é
opcional, e fica por sua conta integrar quando quiser.

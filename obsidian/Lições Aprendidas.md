---
tags: [licoes, reflexao, aprendizado]
parent: "[[Sales Bot — Sistema Multi-Agente]]"
---

# Lições Aprendidas

## Técnicas

### Mensagens de IA soam como IA
O maior desafio foi fazer as mensagens geradas pelo Claude soarem genuínas. A solução foi criar um **Agente 6 dedicado** só para revisar e reescrever qualquer trecho que soasse como template ou robô.

### Persona > Prompt genérico
Mudar o prompt de "gere uma mensagem de WhatsApp" para "você é o Victor, desenvolvedor que encontrou esse negócio no Google" melhorou drasticamente a qualidade e naturalidade das mensagens.

### Crash Recovery é essencial
O pipeline pode cair no meio (timeout de API, erro de rede). Salvar `pipeline_state.json` após cada agente permite retomar de onde parou sem reprocessar tudo.

### Mock first, real depois
Desenvolver com dados mock (sem Google Places API) acelerou muito o ciclo de iteração. O sistema funciona 100% sem nenhuma API externa para testes.

### Surge.sh > Netlify para escala
O plano free do Netlify limita o número de sites. A solução foi migrar para **Surge.sh** — também gratuito, mas sem limite de projetos. Configurar com `SURGE_LOGIN` e `SURGE_TOKEN` no `.env`.

---

## De Negócio

### WhatsApp tem maior taxa de abertura
Taxa de abertura de WhatsApp no Brasil: ~98%. Email: ~20%. A decisão de focar em WhatsApp como canal principal foi a mais importante do projeto.

### Aprovação manual é um diferencial
Ter um painel de aprovação antes do envio não é um obstáculo — é uma vantagem. Garante qualidade e mantém controle sobre o que é enviado.

### Mensagem curta > mensagem completa
Mensagens longas de WhatsApp não são lidas. 4 linhas com pergunta aberta convertem melhor do que um pitch completo.

---

## Ideias para Próxima Versão
Ver [[Ideias de Melhoria]]

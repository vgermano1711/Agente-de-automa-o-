---
tags: [agente, whatsapp, copywriting, ia]
parent: "[[Sales Bot — Sistema Multi-Agente]]"
---

# Agente 5 — Mensagens

## O que faz
Gera mensagem personalizada para cada lead no canal correto (WhatsApp, email, SMS, Instagram, LinkedIn).

## Arquivo
`agents/agent5_canal.ts`

## Saída
`data/mensagens_{data}.json`

## Persona
As mensagens são escritas na voz do **Victor** — desenvolvedor web que encontrou o negócio no Google e resolveu entrar em contato de forma genuína.

## Estrutura da mensagem WhatsApp

```
1. Saudação natural com nome do negócio
2. Elogio genuíno + observação leve do problema
3. "Montei uma prévia de como ficaria:" + link
4. Pergunta aberta sem pressão
```

## Exemplo gerado

> Oi, tudo bem? Vi a Barbearia do Zé aqui no Google — 372 avaliações com 5 estrelas é impressionante. Só achei que o link no perfil não faz jus a isso.
>
> Por curiosidade resolvi montar uma prévia de como ficaria um site pra vocês:
> https://sales-bot-barbearia-do-ze.surge.sh
>
> O que você acha? Faz sentido pra vocês ter algo assim?

## Regras Anti-IA
- Nunca usar "Espero que este email te encontre bem"
- Nunca usar "Prezado(a)", "Atenciosamente"
- Máximo 1 emoji
- Frases curtas como quem digita no celular

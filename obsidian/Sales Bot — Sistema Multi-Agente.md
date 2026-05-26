---
tags: [projeto, automação, ia, typescript, whatsapp, vendas]
data_criacao: 2026-05-26
status: ativo
github: https://github.com/vgermano1711/agente-de-automacao
painel: https://vgermano1711.github.io/Agente-de-automa-o-/
---

# Sales Bot — Sistema Multi-Agente

> Sistema 100% automatizado que prospecta pequenos negócios locais, cria landing pages personalizadas e envia abordagem por WhatsApp. Você só aprova antes do envio.

## Como funciona

```
Google Maps → Diagnóstico → Landing Page → Vídeo → Mensagem WhatsApp → Revisão → Envio
```

O ciclo roda automaticamente todo dia às **08:00**. Você aprova no painel antes de enviar.

---

## Os 7 Agentes

| Agente | Função |
|--------|--------|
| [[Agente 1 — Prospector]] | Varre Google Maps, filtra negócios sem site com 4+ estrelas |
| [[Agente 2 — Diagnosticador]] | Analisa o lead via Claude e define ângulo de venda |
| [[Agente 3 — Builder]] | Gera landing page HTML personalizada |
| [[Agente 4 — Vídeo]] | Cria vídeo de prévia mobile com Puppeteer + ffmpeg |
| [[Agente 5 — Mensagens]] | Escreve mensagem WhatsApp no tom certo para cada cliente |
| [[Agente 6 — Revisor]] | Remove linguagem de IA, garante tom humano |
| [[Agente 7 — Handler]] | Monitora respostas por email e prepara follow-ups |

---

## Stack Técnica

- **Runtime:** Node.js 18+ · TypeScript
- **IA:** Claude API (Anthropic) — claude-sonnet-4-6
- **Prospecção:** Google Places API
- **WhatsApp:** whatsapp-web.js (gratuito, QR code) ou Z-API (pago)
- **Landing Pages:** HTML/CSS gerado por IA → deploy Surge.sh (gratuito)
- **Vídeo:** Puppeteer (screenshots) + ffmpeg (montagem)
- **Agendamento:** node-cron (`0 8 * * *`)
- **Produção:** PM2
- **Painel:** Express.js + HTML vanilla

---

## Arquitetura

```
orchestrator.ts
├── node-cron → runDailyCycle() todo dia 08:00
├── runWithRetry() → 3 tentativas + backoff exponencial
├── pipeline_state.json → crash recovery (retoma do último agente)
├── Agentes 1→6 sequenciais
└── Agente 7 → loop paralelo 24/7
```

---

## Fluxo de Dados

```
leads_{data}.json
  → diagnosticos_{data}.json
    → pages/{slug}/index.html
      → videos/{slug}.mp4
        → mensagens_{data}.json
          → [aprovação no painel]
            → WhatsApp enviado
```

---

## Links Importantes

- **GitHub:** https://github.com/vgermano1711/agente-de-automacao
- **Painel público:** https://vgermano1711.github.io/Agente-de-automa-o-/
- **Painel local:** http://localhost:3000 (quando rodar `npm run dev:api`)

---

## Notas Relacionadas

- [[Setup e Configuração]]
- [[Lições Aprendidas]]
- [[Ideias de Melhoria]]
- [[Posts LinkedIn e Instagram]]

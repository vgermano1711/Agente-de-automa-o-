---
tags: [agente, prospeccao, google-maps]
parent: "[[Sales Bot — Sistema Multi-Agente]]"
---

# Agente 1 — Prospector

## O que faz
Varre o Google Maps em busca de pequenos negócios locais com:
- Avaliação ≥ 4.0 estrelas
- Mínimo 20 avaliações
- Sem site ou site desatualizado (sem viewport mobile ou copyright antigo)

## Arquivo
`agents/agent1_prospector.ts`

## Saída
`data/leads_{data}.json`

## Critério de Score

```
score = (avaliacao - 4) × 40 + (total_avaliacoes / 200) × 30 + (sem_site ? 30 : 15)
```

## Mock
Sem `GOOGLE_PLACES_API_KEY`, usa 5 negócios fictícios brasileiros para desenvolvimento.

## Deduplicação
Mantém `data/prospectados.json` — nunca prospecta o mesmo negócio duas vezes.

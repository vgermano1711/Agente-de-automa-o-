---
tags: [setup, configuracao, env]
parent: "[[Sales Bot — Sistema Multi-Agente]]"
---

# Setup e Configuração

## Pré-requisitos
- Node.js 18+
- ffmpeg (`apt install ffmpeg` / `brew install ffmpeg`)
- PM2 para produção (`npm install -g pm2`)

## Instalação

```bash
git clone https://github.com/vgermano1711/agente-de-automacao
cd agente-de-automacao
node setup.js        # configura .env interativamente
npm run run-now      # roda pipeline agora + QR WhatsApp
npm run dev:api      # abre painel em localhost:3000
```

## Variáveis de Ambiente (.env)

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `ANTHROPIC_API_KEY` | ✅ Sim | Chave da API do Claude |
| `WHATSAPP_PROVIDER` | ✅ Sim | `wwebjs` (grátis) ou `zapi` (pago) |
| `GOOGLE_PLACES_API_KEY` | Recomendado | Leads reais do Google Maps |
| `SURGE_LOGIN` + `SURGE_TOKEN` | Opcional | Deploy automático das LPs (Surge.sh, grátis) |
| `GMAIL_USER` + `GMAIL_APP_PASSWORD` | Opcional | Monitorar respostas |
| `PUSHOVER_TOKEN` + `PUSHOVER_USER` | Opcional | Notificações no celular |
| `OWNER_WHATSAPP` | Opcional | Número do dono para notificações |

## WhatsApp — Opções

**Gratuito (whatsapp-web.js):**
- `WHATSAPP_PROVIDER=wwebjs`
- QR code aparece no terminal na primeira vez
- Sessão salva em `.wwebjs_auth/`

**Pago (Z-API ~R$97/mês):**
- `WHATSAPP_PROVIDER=zapi`
- Sem celular preso, mais estável para produção

## Produção com PM2

```bash
npm run build
pm2 start ecosystem.config.js
pm2 logs    # ver logs
pm2 monit   # painel
```

## Configuração do Pipeline (config.json)

```json
{
  "cidades_alvo": ["São Paulo, SP", "Campinas, SP"],
  "segmentos": ["salão de beleza", "barbearia"],
  "leads_por_dia": 5,
  "horario_ciclo": "0 8 * * *"
}
```

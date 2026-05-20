# Sales Bot — Sistema Multi-Agente de Prospecção e Venda de Landing Pages

Sistema 100% automatizado que prospecta pequenos negócios locais, cria landing pages personalizadas, gera vídeos de prévia e envia a abordagem por **WhatsApp** — o canal com maior taxa de abertura no Brasil. Você só aprova antes do envio.

## Como funciona

```
Agente 1 → Prospecta negócios via Google Places (sem site ou site antigo)
Agente 2 → Diagnostica cada lead e define ângulo de venda
Agente 3 → Gera landing page HTML personalizada e faz deploy no Netlify
Agente 4 → Cria vídeo de prévia mobile (Puppeteer + ffmpeg)
Agente 5 → Gera mensagem WhatsApp personalizada via Claude
Agente 6 → Revisa e remove linguagem genérica de IA
Agente 7 → Monitora Gmail 24/7 e responde leads (com aprovação sua)
```

O ciclo roda automaticamente todo dia às 08:00. Você só aprova antes do envio.

---

## Setup

### 1. Pré-requisitos

- Node.js 18+
- ffmpeg: `brew install ffmpeg` (Mac) ou `apt install ffmpeg` (Linux)
- PM2 (produção): `npm install -g pm2`
- Conta Netlify free tier (para deploy das landing pages)

### 2. Instalar e configurar

```bash
git clone https://github.com/vgermano1711/agente-de-automa-o-
cd agente-de-automa-o-
node setup.js
```

O script `setup.js` pergunta cada chave, valida e escreve o `.env` automaticamente.

### 3. Configurar WhatsApp (escolha uma opção)

**Opção A — Z-API** (recomendado para produção, a partir de R$97/mês):
1. Crie conta em [app.z-api.io](https://app.z-api.io)
2. Crie uma instância e conecte seu WhatsApp escaneando o QR
3. Copie o `Instance ID` e `Token` para o `.env`

**Opção B — whatsapp-web.js** (gratuito, requer celular conectado):
1. No `.env`, mude `WHATSAPP_PROVIDER=wwebjs`
2. Na primeira execução, um QR code aparece no terminal
3. Escaneie com o WhatsApp do celular que vai enviar as mensagens

### 4. Executar

**Produção (recomendado):**
```bash
npm run build
pm2 start ecosystem.config.js
```

**Rodar agora para testar:**
```bash
npm run run-now
```

**Desenvolvimento com logs ao vivo:**
```bash
npm run dev          # orchestrator
npm run dev:api      # servidor web (outro terminal)
```

---

## Aprovar mensagens

Acesse o painel em: **http://localhost:3000**

Para cada mensagem pendente:
- ✅ **Aprovar e Enviar WhatsApp** — envia imediatamente
- ✏️ **Editar** — edita o texto antes de aprovar
- ❌ **Rejeitar** — descarta

---

## Monitorar com PM2

```bash
pm2 status          # processos rodando
pm2 logs            # logs em tempo real
pm2 monit           # painel interativo
pm2 restart all     # reiniciar
pm2 stop all        # parar tudo
```

---

## Estrutura de pastas

```
├── agents/             # 7 agentes independentes
├── api/server.ts       # Servidor Express + endpoints REST
├── utils/
│   ├── whatsapp.ts     # Envio WhatsApp (Z-API + whatsapp-web.js)
│   ├── logger.ts
│   ├── notifications.ts
│   ├── state.ts
│   └── dataHelpers.ts
├── data/               # JSONs gerados diariamente
├── pages/              # Landing pages geradas
├── logs/               # Logs e relatórios diários
├── aprovacao.html      # Painel web de aprovação
├── orchestrator.ts     # Orquestrador central (cron + retry + state)
├── types.ts            # Tipos TypeScript compartilhados
├── config.json         # Configuração editável
├── ecosystem.config.js # Configuração PM2
├── setup.js            # Setup interativo
└── .env.example        # Template de variáveis de ambiente
```

---

## Variáveis de Ambiente

| Variável | Onde Obter | Obrigatória |
|---|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com/settings/keys) | **Sim** |
| `WHATSAPP_PROVIDER` | `zapi` ou `wwebjs` | **Sim** |
| `ZAPI_INSTANCE_ID` | [app.z-api.io](https://app.z-api.io) | Se usar Z-API |
| `ZAPI_TOKEN` | app.z-api.io | Se usar Z-API |
| `GOOGLE_PLACES_API_KEY` | Google Cloud Console → Places API | Para leads reais |
| `NETLIFY_AUTH_TOKEN` | app.netlify.com → User settings | Para deploy |
| `PUSHOVER_TOKEN` | [pushover.net](https://pushover.net) | Para notificações |
| `OWNER_EMAIL` | Seu email | Sim |

---

## Configuração (config.json)

```json
{
  "cidades_alvo": ["São Paulo, SP", "Campinas, SP"],
  "segmentos": ["salão de beleza", "barbearia"],
  "leads_por_dia": 5,
  "horario_ciclo": "0 8 * * *",
  "canal_padrao": "whatsapp"
}
```

---

## Desenvolvimento sem APIs externas

Sem `GOOGLE_PLACES_API_KEY`, o sistema usa dados mock. Sem `ZAPI_*`, simula o envio no terminal. Ideal para testar o fluxo completo antes de configurar as integrações reais.

# Sales Bot — Sistema Multi-Agente de Prospecção e Venda de Landing Pages

Sistema 100% automatizado que prospecta pequenos negócios locais, cria landing pages personalizadas, gera vídeos de prévia e envia abordagens cirúrgicas pelo canal certo — tudo sem intervenção humana, exceto a aprovação final antes do envio.

## Como funciona

```
Agente 1 → Prospecta negócios via Google Places (sem site ou site antigo)
Agente 2 → Diagnostica cada lead e define canal + ângulo de venda
Agente 3 → Gera landing page HTML personalizada e faz deploy no Netlify
Agente 4 → Cria vídeo de prévia mobile (Puppeteer + ffmpeg)
Agente 5 → Gera mensagem personalizada para o canal certo
Agente 6 → Revisa e remove linguagem genérica de IA
Agente 7 → Monitora Gmail 24/7 e responde leads (com aprovação sua)
```

O ciclo roda automaticamente todo dia às 08:00. Você só aprova antes do envio.

---

## Setup

### 1. Pré-requisitos

- Node.js 18+
- ffmpeg instalado (`brew install ffmpeg` ou `apt install ffmpeg`)
- PM2: `npm install -g pm2`
- Conta Netlify (free tier funciona)

### 2. Instalar dependências

```bash
npm install
```

### 3. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Edite `.env` com suas chaves. Veja a seção [Variáveis de Ambiente](#variáveis-de-ambiente) abaixo.

### 4. Executar

**Produção (recomendado):**
```bash
pm2 start ecosystem.config.js
```

**Rodar o ciclo imediatamente (para testar):**
```bash
npm run run-now
```

**Modo desenvolvimento (com logs em tempo real):**
```bash
npm run dev          # orchestrator
npm run dev:api      # servidor web (em outro terminal)
```

---

## Aprovar mensagens

Acesse o painel em: **http://localhost:3000**

Para cada mensagem pendente você pode:
- ✅ **Aprovar** — envia imediatamente pelo canal configurado
- ✏️ **Editar** — edita o texto antes de aprovar
- ❌ **Rejeitar** — descarta a mensagem

---

## Monitorar com PM2

```bash
pm2 status          # ver processos rodando
pm2 logs            # ver logs em tempo real
pm2 monit           # painel de monitoramento interativo
pm2 restart all     # reiniciar todos os processos
pm2 stop all        # parar tudo
```

---

## Estrutura de pastas

```
├── agents/             # 7 agentes independentes
├── api/server.ts       # Servidor Express + endpoints REST
├── utils/              # Logger, notificações, state, helpers
├── data/               # JSONs gerados diariamente (gitignored)
├── pages/              # Landing pages geradas (gitignored)
├── videos/             # Vídeos de prévia (gitignored)
├── logs/               # Logs e relatórios diários (gitignored)
├── aprovacao.html      # Painel web de aprovação
├── orchestrator.ts     # Orquestrador central com cron + retry
├── types.ts            # Tipos TypeScript compartilhados
├── config.json         # Configuração editável (cidades, segmentos, etc.)
├── ecosystem.config.js # Configuração PM2
└── .env.example        # Template de variáveis de ambiente
```

---

## Variáveis de Ambiente

| Variável | Onde Obter | Obrigatória |
|---|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com/settings/keys) | Sim |
| `GOOGLE_PLACES_API_KEY` | [Google Cloud Console](https://console.cloud.google.com) → Places API | Para produção |
| `GOOGLE_CLIENT_ID` | Google Cloud Console → OAuth 2.0 | Para Gmail/Calendar |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console → OAuth 2.0 | Para Gmail/Calendar |
| `GOOGLE_REFRESH_TOKEN` | Fluxo OAuth2 (ver abaixo) | Para Gmail/Calendar |
| `GMAIL_USER` | Seu email Gmail | Para envio de email |
| `GMAIL_APP_PASSWORD` | Google → Segurança → Senhas de app | Para envio de email |
| `NETLIFY_AUTH_TOKEN` | [app.netlify.com](https://app.netlify.com) → User settings → Access tokens | Para deploy |
| `PUSHOVER_TOKEN` | [pushover.net](https://pushover.net) → Create Application | Para notificações |
| `PUSHOVER_USER` | pushover.net → Your User Key | Para notificações |
| `CALENDLY_LINK` | Seu link do Calendly | Para Agente 7 |
| `OWNER_EMAIL` | Seu email (notificações fallback) | Sim |

### Como obter o Google Refresh Token

```bash
# 1. Instale o googleapis
npm install googleapis

# 2. Crie um script OAuth temporário e siga o fluxo
# Escopos necessários: gmail.readonly, gmail.send, calendar.readonly
```

Documentação completa: [Google OAuth2 para Node.js](https://developers.google.com/identity/protocols/oauth2/web-server)

---

## Configuração do pipeline (config.json)

```json
{
  "cidades_alvo": ["São Paulo, SP", "Campinas, SP"],
  "segmentos": ["salão de beleza", "barbearia"],
  "leads_por_dia": 5,
  "horario_ciclo": "0 8 * * *",
  "intervalo_agent7_minutos": 5,
  "netlify_site_prefix": "demo-",
  "notificacoes_ativas": true
}
```

---

## Desenvolvimento sem APIs externas

O sistema funciona em modo mockado quando `GOOGLE_PLACES_API_KEY` não está configurada — ideal para desenvolvimento e testes. Todos os agentes usam dados mock que simulam o comportamento real.

---

## Resiliência

- **Retry automático**: 3 tentativas com backoff exponencial (2s, 4s, 8s) por agente
- **Pipeline state**: salvo em `pipeline_state.json` — em caso de crash, retoma do último agente bem-sucedido
- **PM2 autorestart**: reinicia automaticamente em caso de falha
- **Log rotation**: logs diários separados por data
- **Deduplicação**: `data/prospectados.json` garante que nunca o mesmo negócio é abordado duas vezes

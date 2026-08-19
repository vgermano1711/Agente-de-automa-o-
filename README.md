# Sales Automation Bot

> **Pipeline multi-agente de IA que prospecta, diagnostica e vende landing pages — do Google Maps ao WhatsApp, sem intervenção humana.**

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white"/>
  <img src="https://img.shields.io/badge/TypeScript-5.4-3178C6?style=for-the-badge&logo=typescript&logoColor=white"/>
  <img src="https://img.shields.io/badge/Claude_AI-Anthropic-D97706?style=for-the-badge&logo=anthropic&logoColor=white"/>
  <img src="https://img.shields.io/badge/WhatsApp-API-25D366?style=for-the-badge&logo=whatsapp&logoColor=white"/>
  <img src="https://img.shields.io/badge/Gmail-OAuth_2.0-EA4335?style=for-the-badge&logo=gmail&logoColor=white"/>
  <img src="https://img.shields.io/badge/PM2-Auto--start-2B037A?style=for-the-badge&logo=pm2&logoColor=white"/>
</p>

---

## Como funciona

O sistema roda automaticamente todos os dias às 08h. O único passo manual é **aprovar ou rejeitar** no painel antes do envio.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SALES AUTOMATION BOT                             │
│              Pipeline de 7 Agentes com Claude AI                    │
└─────────────────────────────────────────────────────────────────────┘

  Google Maps
      │
      ▼
  ╔═══════════╗   Busca empresas por setor e cidade
  ║ AGENTE 1  ║   Filtra por avaliações e potencial de venda
  ║ Prospector║   Score de prioridade com IA
  ╚═════╤═════╝
        │ leads.json
        ▼
  ╔═══════════╗   Analisa o negócio com Claude AI
  ║ AGENTE 2  ║   Identifica pontos fracos e oportunidades
  ║Diagnóstico║   Calcula score de 0–100
  ╚═════╤═════╝
        │ diagnosticos.json
        ▼
  ╔═══════════╗   Gera landing page HTML personalizada
  ║ AGENTE 3  ║   Baseada no diagnóstico do negócio
  ║  Builder  ║   Deploy automático via Surge.sh
  ╚═════╤═════╝
        │ pages/{slug}/index.html
        ▼
  ╔═══════════╗   Cria vídeo de apresentação da página
  ║ AGENTE 4  ║   Captura mobile com Puppeteer
  ║   Vídeo   ║
  ╚═════╤═════╝
        │
        ▼
  ╔═══════════╗   Gera mensagem de prospecção personalizada
  ║ AGENTE 5  ║   Referencia o diagnóstico e a landing page
  ║   Canal   ║   Adapta tom por setor
  ╚═════╤═════╝
        │ mensagens.json
        ▼
  ╔═══════════╗   Revisa a mensagem com IA
  ║ AGENTE 6  ║   Remove frases genéricas de IA
  ║  Revisor  ║   Score de qualidade — reescreve se < 80
  ╚═════╤═════╝
        │ mensagem aprovada
        ▼
  ┌──────────────────────────────────────┐
  │         PAINEL DE APROVAÇÃO          │  ← único passo manual
  │  - Preview da landing page gerada    │
  │  - Telefone e nome do lead           │
  │  - Score de qualidade da mensagem    │
  │  - Histórico de enviados             │
  └─────────────────┬────────────────────┘
                    │ aprovado
                    ▼
  ╔═══════════╗   Envia via WhatsApp ou Gmail
  ║ AGENTE 7  ║   Monitora respostas 24/7
  ║  Handler  ║   Responde leads com IA automaticamente
  ╚═══════════╝
```

---

## Stack

| Camada | Tecnologia |
|---|---|
| Linguagem | TypeScript / Node.js 18+ |
| IA | Anthropic Claude API |
| Prospecção | Google Places API |
| WhatsApp | whatsapp-web.js |
| Email | Gmail API (OAuth 2.0) |
| Landing Pages | HTML gerado por IA + Surge.sh |
| Screenshots | Puppeteer |
| Servidor | Express.js |
| Processos | PM2 (auto-restart + boot) |
| Agendamento | node-cron |

---

## Estrutura

```
sales-automation/
├── agents/
│   ├── agent1_prospector.ts    # Google Maps → leads
│   ├── agent2_diagnostico.ts   # Claude AI → diagnóstico + score
│   ├── agent3_builder.ts       # HTML personalizado + deploy
│   ├── agent4_video.ts         # captura de vídeo mobile
│   ├── agent5_canal.ts         # mensagem de prospecção
│   ├── agent6_revisor.ts       # revisão de qualidade
│   └── agent7_handler.ts       # respostas automáticas
├── api/
│   └── server.ts               # Express API na porta 3000
├── aprovacao.html              # painel de aprovação
├── orchestrator.ts             # coordena os agentes (cron diário)
├── ecosystem.config.js         # configuração PM2
├── gerar-oauth.ts              # setup Gmail OAuth automático
├── start-api.js                # wrapper PM2 para API
└── start-orchestrator.js       # wrapper PM2 para orchestrator
```

---

## Instalação

### 1. Clonar e instalar
```bash
git clone https://github.com/vgermano1711/agente-de-automacao.git
cd agente-de-automacao
npm install
```

### 2. Configurar `.env`
```env
ANTHROPIC_API_KEY=...
GOOGLE_PLACES_API_KEY=...
OWNER_WHATSAPP=5511999999999
WHATSAPP_PROVIDER=wwebjs
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
```

### 3. Configurar Gmail OAuth
```bash
npx ts-node gerar-oauth.ts
```
Abre o browser, você autoriza, o token é salvo automaticamente.

### 4. Iniciar com PM2
```bash
pm2 start ecosystem.config.js
pm2 save
```

### 5. Acessar o painel
```
http://localhost:3000
```

---

## Painel de Aprovação

O painel web permite:

- Pesquisar leads por setor e cidade em tempo real
- Visualizar diagnóstico e score do lead
- Preview da landing page gerada (iframe local)
- Aprovar/rejeitar com um clique
- Campo de telefone com validação
- Histórico de mensagens enviadas
- Auto-redirect para aprovações após prospectar

---

## Monitorar

```bash
pm2 status       # processos rodando
pm2 logs         # logs em tempo real
pm2 monit        # painel interativo
```

---

## Licença

MIT

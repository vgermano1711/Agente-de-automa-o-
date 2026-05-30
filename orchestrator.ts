import 'dotenv/config';
import cron from 'node-cron';
import fs from 'fs';
import path from 'path';

import { runAgent1 } from './agents/agent1_prospector';
import { runAgent2 } from './agents/agent2_diagnostico';
import { runAgent3 } from './agents/agent3_builder';
import { runAgent4 } from './agents/agent4_video';
import { runAgent5 } from './agents/agent5_canal';
import { runAgent6 } from './agents/agent6_revisor';
import { startAgent7Loop } from './agents/agent7_handler';
import { processarCadencias } from './agents/cadencia';
import { initWhatsappWeb } from './utils/whatsapp';

import { log } from './utils/logger';
import { notifyOwner } from './utils/notifications';
import { loadState, saveState, markAgentComplete } from './utils/state';
import { DailyReport, PipelineState, ReportError } from './types';

const LOGS_DIR = path.join(process.cwd(), 'logs');
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

const configRaw = fs.readFileSync(path.join(process.cwd(), 'config.json'), 'utf-8');
const config = JSON.parse(configRaw);

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWithRetry(
  fn: () => Promise<unknown>,
  agentName: string,
  maxAttempts = 3
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await fn();
      return;
    } catch (err) {
      const delay = Math.pow(2, attempt) * 1000;
      log.warn(`${agentName} — tentativa ${attempt}/${maxAttempts} falhou: ${(err as Error).message}`);
      if (attempt < maxAttempts) {
        log.info(`Aguardando ${delay / 1000}s antes de tentar novamente...`);
        await sleep(delay);
      } else {
        log.error(`${agentName} falhou após ${maxAttempts} tentativas`);
        await notifyOwner(
          `❌ ${agentName} falhou após ${maxAttempts} tentativas.\nErro: ${(err as Error).message}`,
          'Erro no pipeline'
        );
        throw err;
      }
    }
  }
}

async function generateDailyReport(
  startTime: number,
  errors: ReportError[]
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const dataSuffix = today.replace(/-/g, '');

  function countFile(pattern: string): number {
    try {
      const filePath = path.join(process.cwd(), 'data', pattern.replace('{data}', today));
      if (!fs.existsSync(filePath)) return 0;
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return Array.isArray(data) ? data.length : 0;
    } catch {
      return 0;
    }
  }

  const report: DailyReport = {
    data: today,
    leads_encontrados: countFile('leads_{data}.json'),
    leads_diagnosticados: countFile('diagnosticos_{data}.json'),
    landing_pages_geradas: countFile('diagnosticos_{data}.json'),
    mensagens_prontas: countFile('mensagens_{data}.json'),
    tempo_total_segundos: Math.round((Date.now() - startTime) / 1000),
    erros: errors,
  };

  const reportPath = path.join(LOGS_DIR, `relatorio_${today}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log.info(`Relatório salvo: ${reportPath}`);

  const resumo = `
📊 Relatório do dia ${today}:
• Leads encontrados: ${report.leads_encontrados}
• Diagnosticados: ${report.leads_diagnosticados}
• Landing pages: ${report.landing_pages_geradas}
• Mensagens prontas: ${report.mensagens_prontas}
• Tempo total: ${Math.round(report.tempo_total_segundos / 60)}min
• Erros: ${errors.length}
`.trim();

  log.info(resumo);
}

interface AgentStep {
  number: number;
  name: string;
  fn: () => Promise<unknown>;
}

async function runDailyCycle(): Promise<void> {
  const startTime = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  const errors: ReportError[] = [];

  // Verificar se já está rodando
  let state = loadState();
  if (state?.em_execucao && state.data === today) {
    log.warn('Pipeline já está em execução. Abortando inicialização duplicada.');
    return;
  }

  // Crash recovery: só retoma se o pipeline anterior travou (em_execucao=true indica crash)
  // Se completou normalmente (em_execucao=false), começa do zero
  const crashedMidRun = state?.data === today && state?.em_execucao === true;
  const ultimoAgente = crashedMidRun ? state!.ultimo_agente_concluido : 0;
  if (ultimoAgente > 0) {
    log.info(`♻️  Retomando do Agente ${ultimoAgente + 1} (crash recovery)`);
  }

  const newState: PipelineState = {
    data: today,
    ultimo_agente_concluido: ultimoAgente,
    leads_ids: [],
    em_execucao: true,
    iniciado_em: new Date().toISOString(),
    concluido_em: null,
  };
  saveState(newState);

  await notifyOwner(`🚀 Pipeline diário iniciado — ${today}`, 'Pipeline Iniciado');
  log.info(`🚀 Ciclo diário iniciado — ${today}`);

  const agents: AgentStep[] = [
    { number: 1, name: 'Agente 1 — Prospector', fn: runAgent1 },
    { number: 2, name: 'Agente 2 — Diagnosticador', fn: runAgent2 },
    { number: 3, name: 'Agente 3 — Builder', fn: runAgent3 },
    { number: 4, name: 'Agente 4 — Vídeo', fn: runAgent4 },
    { number: 5, name: 'Agente 5 — Canal', fn: runAgent5 },
    { number: 6, name: 'Agente 6 — Revisor', fn: runAgent6 },
  ];

  for (const agent of agents) {
    if (agent.number <= ultimoAgente) {
      log.info(`Pulando ${agent.name} (já concluído neste ciclo)`);
      continue;
    }

    try {
      log.info(`\n▶ Iniciando ${agent.name}`);
      await runWithRetry(agent.fn, agent.name);
      markAgentComplete(agent.number);
      log.success(`✓ ${agent.name} concluído`);
      await notifyOwner(`✓ ${agent.name} concluído`, 'Pipeline Progress');
    } catch (err) {
      errors.push({
        agente: agent.name,
        mensagem: (err as Error).message,
        timestamp: new Date().toISOString(),
      });
      log.error(`${agent.name} falhou definitivamente — continuando com próximo lead`);
    }
  }

  // Finalizar estado
  const finalState = loadState();
  if (finalState) {
    finalState.em_execucao = false;
    finalState.concluido_em = new Date().toISOString();
    saveState(finalState);
  }

  await generateDailyReport(startTime, errors);

  const panelUrl = process.env.APPROVAL_PANEL_URL || 'http://localhost:3000';
  await notifyOwner(
    `✅ Pipeline concluído!\n\nMensagens aguardando sua aprovação.\nAcesse: ${panelUrl}`,
    'Pipeline Concluído'
  );

  log.success(`🏁 Ciclo diário concluído em ${Math.round((Date.now() - startTime) / 60000)}min`);
}

// Inicializar WhatsApp Web se for o provedor selecionado
async function initWhatsApp(): Promise<void> {
  const provider = process.env.WHATSAPP_PROVIDER || 'zapi';
  if (provider !== 'wwebjs') return;

  log.info('📱 Iniciando WhatsApp Web...');
  log.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log.info('Abra o WhatsApp no celular → ⋮ Menu → Dispositivos conectados → Conectar dispositivo');
  log.info('Escaneie o QR Code que vai aparecer abaixo:');
  log.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    // initWhatsappWeb fica aguardando o QR ser escaneado antes de resolver
    await initWhatsappWeb();
    log.success('✅ WhatsApp Web conectado! Pronto para enviar mensagens.');
  } catch (err) {
    log.error(`WhatsApp Web falhou ao inicializar: ${(err as Error).message}`);
    log.warn('O sistema vai rodar, mas os envios serão simulados.');
  }
}

// Agendamento automático via cron
const cronSchedule = process.env.CRON_SCHEDULE || config.horario_ciclo || '0 8 * * *';
log.info(`⏰ Pipeline agendado: "${cronSchedule}" (padrão: 08:00 todos os dias)`);

// Cadência de follow-up — processa follow-ups todo dia às 10h
cron.schedule('0 10 * * *', () => {
  processarCadencias().catch((err: Error) => {
    log.error(`Cadência — erro ao processar: ${err.message}`);
  });
});
log.info('⏰ Cadência agendada: 10:00 todos os dias');

// Inicialização principal — WhatsApp primeiro, depois Agent 7 e cron
(async () => {
  // WhatsApp só é inicializado no modo servidor contínuo.
  // Em --run-now o API server (npm run dev:api) já gerencia a sessão WhatsApp —
  // inicializar aqui causaria conflito de sessão (.wwebjs_auth já em uso).
  if (!process.argv.includes('--run-now')) {
    await initWhatsApp();
  }

  // Agente 7 só inicia após o WhatsApp estar pronto para não perder mensagens
  startAgent7Loop({ intervalMinutes: config.intervalo_agent7_minutos || 5 });

  cron.schedule(cronSchedule, () => {
    runDailyCycle().catch((err) => {
      log.error(`Ciclo diário falhou: ${err.message}`);
    });
  });

  if (process.argv.includes('--run-now')) {
    log.info('Executando imediatamente via --run-now');
    runDailyCycle().catch((err) => {
      log.error(`Execução manual falhou: ${err.message}`);
      process.exit(1);
    });
  } else {
    log.info('🤖 Sales Bot iniciado e aguardando próximo ciclo agendado');
  }
})();

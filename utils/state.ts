import fs from 'fs';
import path from 'path';
import { PipelineState } from '../types';
import { log } from './logger';

const STATE_FILE = path.join(process.cwd(), 'pipeline_state.json');

export function loadState(): PipelineState | null {
  if (!fs.existsSync(STATE_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

export function saveState(state: PipelineState): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function clearState(): void {
  if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
}

export function markAgentComplete(agentNumber: number): void {
  let state = loadState();
  if (!state) {
    log.error(`markAgentComplete: estado ausente ao marcar agente ${agentNumber} — recriando`);
    state = {
      data: new Date().toISOString().slice(0, 10),
      ultimo_agente_concluido: 0,
      leads_ids: [],
      em_execucao: true,
      iniciado_em: new Date().toISOString(),
      concluido_em: null,
    };
  }
  state.ultimo_agente_concluido = agentNumber;
  saveState(state);
}

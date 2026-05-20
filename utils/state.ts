import fs from 'fs';
import path from 'path';
import { PipelineState } from '../types';

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
  const state = loadState();
  if (!state) return;
  state.ultimo_agente_concluido = agentNumber;
  saveState(state);
}

/**
 * reset.js — Limpa o estado do pipeline para forçar execução completa
 * Uso: npm run reset
 */
const fs   = require('fs');
const path = require('path');

const today = new Date().toISOString().slice(0, 10);

const targets = [
  path.join(process.cwd(), 'pipeline_state.json'),
  path.join(process.cwd(), 'data', `leads_${today}.json`),
  path.join(process.cwd(), 'data', `diagnosticos_${today}.json`),
  path.join(process.cwd(), 'data', `mensagens_${today}.json`),
];

console.log(`\nReset do pipeline — ${today}\n`);

let deleted = 0;
for (const f of targets) {
  if (fs.existsSync(f)) {
    fs.unlinkSync(f);
    console.log(`  ✓ Removido: ${path.basename(f)}`);
    deleted++;
  }
}

if (deleted > 0) {
  console.log(`\n✅ ${deleted} arquivo(s) removido(s).`);
  console.log('   Agora rode: npm run run-now\n');
} else {
  console.log('   Nenhum arquivo encontrado — pipeline já está limpo.\n');
}

/**
 * fresh.js — Reset completo + pipeline do zero em um único comando
 * Uso: npm run fresh
 */
const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const today = new Date().toISOString().slice(0, 10);

// ── 1. Reset ────────────────────────────────────────────────────────────────
const targets = [
  path.join(process.cwd(), 'pipeline_state.json'),
  path.join(process.cwd(), 'data', `leads_${today}.json`),
  path.join(process.cwd(), 'data', `diagnosticos_${today}.json`),
  path.join(process.cwd(), 'data', `mensagens_${today}.json`),
];

console.log('\n🔄 Limpando estado do pipeline...');
let deleted = 0;
for (const f of targets) {
  if (fs.existsSync(f)) {
    fs.unlinkSync(f);
    console.log(`  ✓ Removido: ${path.basename(f)}`);
    deleted++;
  }
}
console.log(deleted ? `  ${deleted} arquivo(s) removido(s).\n` : '  Nada para remover.\n');

// ── 2. Pipeline completo ─────────────────────────────────────────────────────
console.log('🚀 Iniciando pipeline completo...\n');
try {
  execSync('npx ts-node orchestrator.ts --run-now', {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
} catch (err) {
  console.error('Pipeline falhou:', err.message);
  process.exit(1);
}

// ── 3. Reparar URLs Netlify ───────────────────────────────────────────────────
console.log('\n🔧 Verificando URLs Netlify...');
try {
  execSync('node repair-urls.js', { stdio: 'inherit', cwd: process.cwd() });
} catch (err) {
  console.error('repair-urls falhou (não crítico):', err.message);
}

const path = require('path');
const fs   = require('fs');
const root = __dirname;

// Lê .env para decidir qual tunnel usar
function readEnv() {
  const envFile = path.join(root, '.env');
  if (!fs.existsSync(envFile)) return {};
  return Object.fromEntries(
    fs.readFileSync(envFile, 'utf-8').split('\n')
      .filter(l => l.includes('=') && !l.startsWith('#'))
      .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
  );
}
const env = readEnv();
const useNgrok = !!(env.NGROK_AUTHTOKEN && env.NGROK_DOMAIN);
const tunnelScript = useNgrok ? 'start-ngrok.js' : 'start-tunnel.js';

module.exports = {
  apps: [
    {
      name: 'sales-bot-api',
      script: path.join(root, 'start-api.js'),
      cwd: root,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '800M',
      restart_delay: 5000,
      env: { NODE_ENV: 'production', PORT: '3000' },
      error_file: path.join(root, 'logs', 'api-error.log'),
      out_file: path.join(root, 'logs', 'api-out.log'),
      merge_logs: true,
      time: true,
    },
    {
      name: 'sales-bot-tunnel',
      script: path.join(root, tunnelScript),
      cwd: root,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      restart_delay: 3000,
      env: { NODE_ENV: 'production', PORT: '3000', NGROK_AUTHTOKEN: env.NGROK_AUTHTOKEN, NGROK_DOMAIN: env.NGROK_DOMAIN },
      error_file: path.join(root, 'logs', 'tunnel-error.log'),
      out_file: path.join(root, 'logs', 'tunnel-out.log'),
      merge_logs: true,
      time: true,
    },
    {
      name: 'sales-bot-orchestrator',
      script: path.join(root, 'start-orchestrator.js'),
      cwd: root,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '600M',
      restart_delay: 10000,
      env: { NODE_ENV: 'production' },
      error_file: path.join(root, 'logs', 'orchestrator-error.log'),
      out_file: path.join(root, 'logs', 'orchestrator-out.log'),
      merge_logs: true,
      time: true,
    },
  ],
};

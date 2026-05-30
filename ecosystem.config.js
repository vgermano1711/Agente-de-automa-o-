const path = require('path');
const root = __dirname;

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
      max_memory_restart: '400M',
      restart_delay: 5000,
      env: { NODE_ENV: 'production', PORT: '3000' },
      error_file: path.join(root, 'logs', 'api-error.log'),
      out_file: path.join(root, 'logs', 'api-out.log'),
      merge_logs: true,
      time: true,
    },
    {
      name: 'sales-bot-orchestrator',
      script: path.join(root, 'start-orchestrator.js'),
      cwd: root,
      instances: 1,
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

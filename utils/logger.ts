import fs from 'fs';
import path from 'path';

const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

function getLogFile(): string {
  const date = new Date().toISOString().slice(0, 10);
  return path.join(logsDir, `pipeline_${date}.log`);
}

function timestamp(): string {
  return new Date().toISOString();
}

function write(level: string, message: string): void {
  const line = `[${timestamp()}] [${level}] ${message}`;
  console.log(line);
  fs.appendFileSync(getLogFile(), line + '\n');
}

export const log = {
  info: (msg: string) => write('INFO', msg),
  warn: (msg: string) => write('WARN', msg),
  error: (msg: string) => write('ERROR', msg),
  success: (msg: string) => write('SUCCESS', msg),
};

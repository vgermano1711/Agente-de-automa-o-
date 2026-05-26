/**
 * gerar-oauth.ts
 * Configura Google OAuth para o Gmail (respostas de leads).
 * Uso: npx ts-node gerar-oauth.ts
 *
 * O que faz:
 *   1. Lê GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET do .env
 *   2. Abre o browser para você autorizar o acesso ao Gmail
 *   3. Captura o código de autorização em localhost:3002
 *   4. Troca pelo refresh_token e salva no .env automaticamente
 */

import 'dotenv/config';
import http from 'http';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

const ENV_FILE = path.join(process.cwd(), '.env');
const REDIRECT_URI = 'http://localhost:3002/oauth2callback';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
];

function updateEnv(key: string, value: string): void {
  let content = fs.readFileSync(ENV_FILE, 'utf-8');
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`);
  } else {
    content += `\n${key}=${value}`;
  }
  fs.writeFileSync(ENV_FILE, content);
}

function openBrowser(url: string): void {
  const cmd = process.platform === 'win32' ? `start "" "${url}"` : `open "${url}"`;
  exec(cmd);
}

async function main(): Promise<void> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error(`
❌ GOOGLE_CLIENT_ID e/ou GOOGLE_CLIENT_SECRET não encontrados no .env

Siga estes passos:
  1. Acesse console.cloud.google.com
  2. Selecione seu projeto (o mesmo que tem a Google Places API)
  3. Menu → APIs e serviços → Credenciais
  4. Clique em "Criar Credenciais" → "ID do cliente OAuth 2.0"
  5. Tipo: Aplicativo da web
  6. Nome: Sales Bot
  7. URIs de redirecionamento autorizados: http://localhost:3002/oauth2callback
  8. Copie o Client ID e o Client Secret
  9. Adicione ao .env:
       GOOGLE_CLIENT_ID=seu_client_id
       GOOGLE_CLIENT_SECRET=seu_client_secret
 10. Rode este script novamente: npx ts-node gerar-oauth.ts
`);
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });

  console.log('\n📧 Configurando acesso ao Gmail...');
  console.log('Abrindo o browser para autorização...\n');
  openBrowser(authUrl);

  // Fallback se o browser não abrir
  console.log('Se o browser não abrir, acesse manualmente:');
  console.log(authUrl);
  console.log('\nAguardando autorização em http://localhost:3002...\n');

  await new Promise<void>((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url || '/', `http://localhost:3002`);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h2>Autorização negada. Feche esta aba e tente novamente.</h2>');
        server.close();
        reject(new Error(`Autorização negada: ${error}`));
        return;
      }

      if (!code) {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Aguardando código...');
        return;
      }

      try {
        const { tokens } = await oauth2Client.getToken(code);
        const refreshToken = tokens.refresh_token;

        if (!refreshToken) {
          res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<h2>❌ refresh_token não retornado. Tente revogar o acesso em myaccount.google.com/permissions e rode novamente.</h2>');
          server.close();
          reject(new Error('refresh_token ausente'));
          return;
        }

        updateEnv('GOOGLE_CLIENT_ID', clientId);
        updateEnv('GOOGLE_CLIENT_SECRET', clientSecret);
        updateEnv('GOOGLE_REFRESH_TOKEN', refreshToken);

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <html><body style="font-family:sans-serif;text-align:center;padding:40px">
            <h2>✅ Gmail autorizado com sucesso!</h2>
            <p>refresh_token salvo no .env automaticamente.</p>
            <p>Pode fechar esta aba e reiniciar o servidor.</p>
          </body></html>
        `);

        server.close();
        resolve();
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Erro: ' + (err as Error).message);
        server.close();
        reject(err);
      }
    });

    server.listen(3002, () => {
      console.log('Servidor OAuth escutando em http://localhost:3002');
    });

    server.on('error', reject);
  });

  console.log('\n✅ OAuth configurado com sucesso!');
  console.log('GOOGLE_REFRESH_TOKEN salvo no .env');
  console.log('\nReinicie o servidor para ativar o Agente 7 (respostas de leads):');
  console.log('  pm2 restart sales-bot-api sales-bot-orchestrator\n');
}

main().catch((err) => {
  console.error('Erro:', err.message);
  process.exit(1);
});

import 'dotenv/config';
import { Client, LocalAuth } from 'whatsapp-web.js';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';

// Apaga sessão anterior para forçar novo QR
const sessionDir = path.join(process.cwd(), '.wwebjs_auth', 'session');
if (fs.existsSync(sessionDir)) {
  fs.rmSync(sessionDir, { recursive: true, force: true });
  console.log('Sessão anterior removida — gerando novo QR...');
}

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: path.join(process.cwd(), '.wwebjs_auth') }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

client.on('qr', async (qr) => {
  const dataUrl = await QRCode.toDataURL(qr, { width: 400, margin: 2 });

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="30">
  <title>WhatsApp — Vincular conta</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; min-height: 100vh;
      background: #111b21; font-family: 'Segoe UI', sans-serif; color: #e9edef;
    }
    .card {
      background: #202c33; border-radius: 20px; padding: 40px;
      display: flex; flex-direction: column; align-items: center; gap: 20px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    }
    h1 { font-size: 1.4rem; color: #00a884; }
    img { border-radius: 12px; background: white; padding: 12px; }
    .steps { list-style: none; display: flex; flex-direction: column; gap: 8px; }
    .steps li { font-size: 0.95rem; color: #8696a0; }
    .steps li span { color: #e9edef; font-weight: 600; }
    .tip { font-size: 0.8rem; color: #8696a0; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>📱 Vincular WhatsApp ao sistema</h1>
    <img src="${dataUrl}" width="280" height="280" alt="QR Code WhatsApp" />
    <ol class="steps">
      <li>1. Abra o <span>WhatsApp</span> no seu celular</li>
      <li>2. Toque em <span>Menu ⋮</span> (Android) ou <span>Configurações</span> (iPhone)</li>
      <li>3. Toque em <span>Dispositivos conectados</span></li>
      <li>4. Toque em <span>Conectar dispositivo</span></li>
      <li>5. <span>Aponte a câmera para este QR Code</span></li>
    </ol>
    <p class="tip">Esta página atualiza automaticamente a cada 30 segundos.<br>O QR expira em ~60 segundos — se expirar, salve e reabra o arquivo.</p>
  </div>
</body>
</html>`;

  const outPath = path.join(process.cwd(), 'qr.html');
  fs.writeFileSync(outPath, html);
  console.log('\n✅ QR Code gerado em: qr.html');
  console.log('   Abra o arquivo no VS Code e escaneie com o WhatsApp.\n');
});

client.on('ready', () => {
  console.log('\n🎉 WhatsApp vinculado com sucesso! Pode fechar este terminal.\n');
  // Mantém o processo vivo por 3s para confirmar
  setTimeout(() => process.exit(0), 3000);
});

client.on('auth_failure', () => {
  console.error('Falha na autenticação. Tente novamente.');
  process.exit(1);
});

console.log('Iniciando... aguarde ~10 segundos para o QR aparecer.');
client.initialize();

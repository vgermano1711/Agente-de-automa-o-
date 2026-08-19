/**
 * utils/whatsappConnection.ts
 * Uma conexão isolada de WhatsApp Web (whatsapp-web.js). Cada instância tem seu
 * próprio Client, sessão LocalAuth e handler de mensagens — permite que o
 * vendedor (id='_seller_', clientId=undefined, reaproveita a sessão antiga em
 * .wwebjs_auth/session/) e cada cliente de automação (id=slug, clientId=slug,
 * sessão isolada em .wwebjs_auth/session-<slug>/) rodem em paralelo no mesmo
 * processo sem interferir um no outro.
 */

import { log } from './logger';
import { notifyOwner } from './notifications';

export type ConnStatus = 'idle' | 'initializing' | 'qr' | 'connected' | 'disconnected' | 'failed';

export type MessageHandler = (
  from: string,
  body: string,
  contactPhone?: string,
  isPersonalContact?: boolean,
  isMedia?: boolean
) => Promise<void>;

export interface WhatsAppConnectionOpts {
  onReady?: () => void;
  onDisconnected?: () => void;
}

export class WhatsAppConnection {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any = null;
  private ready = false;
  private hasConnectedOnce = false;
  private latestQr: string | null = null;
  private connected = false;
  private status: ConnStatus = 'idle';
  private messageHandler: MessageHandler | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly id: string, // '_seller_' ou o slug do Projeto — só para log/identificação
    private readonly clientId: string | undefined, // undefined = sessão do vendedor; slug = sessão isolada do cliente
    private readonly opts?: WhatsAppConnectionOpts
  ) {}

  private isSeller(): boolean {
    return this.id === '_seller_';
  }

  getLatestQr(): string | null {
    return this.latestQr;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getStatus(): ConnStatus {
    return this.status;
  }

  setMessageHandler(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  async init(): Promise<void> {
    const { Client, LocalAuth } = await import('whatsapp-web.js');
    const qrcode = await import('qrcode-terminal');

    this.status = 'initializing';

    const authOpts: { dataPath: string; clientId?: string } = { dataPath: '.wwebjs_auth' };
    if (this.clientId) authOpts.clientId = this.clientId;

    this.client = new Client({
      authStrategy: new LocalAuth(authOpts),
      puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        // `protocolTimeout` existe em runtime (repassado ao puppeteer.launch()), mas os
        // tipos que o whatsapp-web.js reexporta não o declaram nessa versão — cast local
        // para preservar a proteção contra "Page.navigate timed out" em máquinas lentas.
        protocolTimeout: 120000,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });

    this.client.on('qr', (qr: string) => {
      this.latestQr = qr;
      this.connected = false;
      this.status = 'qr';
      if (this.isSeller()) {
        log.info('📱 Escaneie o QR Code abaixo com o WhatsApp do seu celular:');
        qrcode.default.generate(qr, { small: true });
        log.info('   Ou acesse http://localhost:3000/qr.html para vincular pelo navegador');
      } else {
        log.info(`📱 QR gerado para cliente "${this.id}" — disponível no painel de ativação`);
      }
    });

    this.client.on('ready', () => {
      const isReconnect = this.hasConnectedOnce && !this.connected;
      this.ready = true;
      this.connected = true;
      this.latestQr = null;
      this.hasConnectedOnce = true;
      this.status = 'connected';
      log.success(`✓ WhatsApp Web conectado (${this.id})`);
      if (isReconnect && this.isSeller()) {
        notifyOwner('✅ WhatsApp reconectou com sucesso.', '✅ WhatsApp online').catch(() => {});
      }
      this.opts?.onReady?.();
    });

    this.client.on('authenticated', () => {
      this.latestQr = null; // sessão restaurada — QR não mais necessário
    });

    this.client.on('disconnected', () => {
      this.ready = false;
      this.connected = false;
      this.status = 'disconnected';
      log.warn(`WhatsApp Web desconectado (${this.id}) — reconexão automática em 2 min`);
      if (this.isSeller()) {
        notifyOwner(
          '📵 WhatsApp desconectou. Reconectando automaticamente em 2 min. Verifique o celular se demorar.',
          '⚠️ WhatsApp offline'
        ).catch(() => {});
      }
      this.opts?.onDisconnected?.();
      this.scheduleReconnect();
    });

    this.client.on('message', async (msg: { from: string; body: string; hasMedia?: boolean; getContact: () => Promise<{ number?: string; isMyContact?: boolean }> }) => {
      log.info(`📨 Mensagem recebida (${this.id}) de ${msg.from}: "${(msg.body || '').slice(0, 60)}"`);
      if (!this.messageHandler) return;

      let contactPhone = '';
      let isPersonalContact = false;
      try {
        const contact = await msg.getContact();
        contactPhone = (contact.number || '').replace(/\D/g, '');
        isPersonalContact = !!contact.isMyContact;
      } catch { /* usa defaults — handler decide o que fazer */ }

      const isMedia = msg.hasMedia || false;
      this.messageHandler(msg.from, msg.body || '', contactPhone, isPersonalContact, isMedia).catch((err: Error) =>
        log.error(`Handler de mensagem WhatsApp falhou (${this.id}): ${err.message}`)
      );
    });

    await this.client.initialize();
  }

  async requestPairingCode(phone: string): Promise<string> {
    if (!this.client) {
      throw new Error(`Cliente WhatsApp (${this.id}) não inicializado.`);
    }
    const digits = phone.replace(/\D/g, '');
    const normalized = digits.startsWith('55') ? digits : '55' + digits;
    const code = await this.client.requestPairingCode(normalized);
    log.info(`Código de vinculação (${this.id}) para ${normalized}: ${code}`);
    return String(code);
  }

  async sendMessage(phone: string, message: string): Promise<boolean> {
    if (!this.client || !this.ready) return false;
    const normalized = phone.includes('@')
      ? phone
      : '55' + phone.replace(/\D/g, '').replace(/^55/, '') + '@c.us';
    try {
      await this.client.sendMessage(normalized, message);
      return true;
    } catch (err) {
      const msg = (err as Error).message || '';
      log.error(`whatsapp-web.js erro (${this.id}): ${msg}`);
      if (msg.includes('No LID') || msg.includes('not registered') || msg.includes('invalid wid')) {
        throw new Error('NUMERO_NAO_REGISTRADO: ' + phone);
      }
      if (
        msg.includes('callFunctionOn') ||
        msg.includes('protocolTimeout') ||
        msg.includes('timed out') ||
        msg.includes('Cannot read properties of null') ||
        msg.includes('Execution context was destroyed') ||
        msg.includes('detached Frame')
      ) {
        this.ready = false;
        this.connected = false;
        this.scheduleReconnect();
        throw new Error('WHATSAPP_SESSION_ERROR: ' + msg.slice(0, 80));
      }
      return false;
    }
  }

  async sendMedia(phone: string, filePath: string, caption = ''): Promise<boolean> {
    if (!this.client || !this.ready) {
      log.warn(`sendMedia (${this.id}): não pronto — vídeo não enviado para ${phone}`);
      return false;
    }
    const normalized = phone.includes('@')
      ? phone
      : '55' + phone.replace(/\D/g, '').replace(/^55/, '') + '@c.us';
    try {
      const { MessageMedia } = await import('whatsapp-web.js');
      const media = MessageMedia.fromFilePath(filePath);
      await this.client.sendMessage(normalized, media, { caption } as object);
      log.success(`Mídia enviada via whatsapp-web.js (${this.id}) → ${phone}`);
      return true;
    } catch (err) {
      log.error(`sendMedia erro (${this.id}): ${(err as Error).message}`);
      return false;
    }
  }

  async addLabelToChat(chatId: string, labelName: string): Promise<void> {
    if (!this.client || !this.ready) return;
    try {
      const labels = await this.client.getLabels();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const label = labels.find((l: any) => l.name.toLowerCase() === labelName.toLowerCase());
      if (!label) {
        log.warn(`Label "${labelName}" não encontrada (${this.id}) — crie-a no WhatsApp Business antes de usar`);
        return;
      }
      await this.client.addOrRemoveLabels([label.id], [chatId]);
      log.success(`Label "${labelName}" adicionada ao chat ${chatId} (${this.id})`);
    } catch (err) {
      log.warn(`addLabelToChat (${this.id}): ${(err as Error).message.slice(0, 80)}`);
    }
  }

  async checkHealth(): Promise<boolean> {
    if (!this.client || !this.ready) return false;
    try {
      const state = await this.client.getState();
      return state === 'CONNECTED';
    } catch {
      return false;
    }
  }

  isConfigured(): boolean {
    return this.ready;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) return; // já agendado
    this.reconnectTimeout = setTimeout(async () => {
      this.reconnectTimeout = null;
      if (this.connected) return; // reconectou sozinho enquanto esperava
      log.warn(`🔄 Auto-reconexão WhatsApp iniciada (${this.id})...`);
      await this.reinit();
    }, 2 * 60 * 1000); // aguarda 2 min antes de reiniciar (evita loops rápidos)
  }

  /**
   * Mata só o processo Chrome desta conexão (via PID do Puppeteer), nunca todo
   * Chrome da máquina — crítico agora que várias conexões (vendedor + clientes)
   * podem coexistir no mesmo processo Node.
   */
  private async killOwnBrowser(): Promise<void> {
    if (!this.client) return;
    let pid: number | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const browser = (this.client as any).pupBrowser;
      pid = browser?.process?.()?.pid;
    } catch { /* ignora */ }

    try {
      await this.client.destroy();
    } catch { /* ignora */ }
    this.client = null;

    if (!pid) return;
    try {
      if (process.platform === 'win32') {
        const { execSync } = await import('child_process');
        execSync(`taskkill /F /PID ${pid} /T`, { stdio: 'ignore' });
      } else {
        process.kill(pid, 'SIGKILL');
      }
    } catch { /* processo já foi encerrado pelo destroy() */ }
  }

  async reinit(): Promise<void> {
    this.ready = false;
    this.connected = false;
    this.status = 'initializing';

    await this.killOwnBrowser();

    // Aguarda o SO liberar o lock do userDataDir desta sessão
    await new Promise((r) => setTimeout(r, 3000));

    try {
      await this.init();
    } catch (err) {
      log.error(`Falha ao reinicializar WhatsApp (${this.id}): ${(err as Error).message}`);
      this.status = 'failed';
      setTimeout(() => this.reinit(), 5 * 60 * 1000);
    }
  }

  /** Encerramento definitivo (ex: cliente cancelou) — sem re-inicialização. */
  async destroy(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    await this.killOwnBrowser();
    this.ready = false;
    this.connected = false;
    this.status = 'idle';
  }
}

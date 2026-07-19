/**
 * utils/whatsappManager.ts
 * Registro central das conexões WhatsApp: a do vendedor (singleton preguiçoso,
 * chave '_seller_') e uma por cliente de automação (chave = slug do Projeto).
 * Limita quantas conexões de cliente podem rodar ao mesmo tempo (cada uma
 * sobe seu próprio Chromium via whatsapp-web.js — ver trade-offs no plano).
 */

import { WhatsAppConnection, WhatsAppConnectionOpts } from './whatsappConnection';

const SELLER_ID = '_seller_';

class WhatsAppManager {
  private connections = new Map<string, WhatsAppConnection>();
  private readonly maxTenants = parseInt(process.env.MAX_TENANT_WHATSAPP || '3', 10);

  /** Conexão do vendedor — clientId=undefined preserva a sessão existente em .wwebjs_auth/session/. */
  getSeller(): WhatsAppConnection {
    let conn = this.connections.get(SELLER_ID);
    if (!conn) {
      conn = new WhatsAppConnection(SELLER_ID, undefined);
      this.connections.set(SELLER_ID, conn);
    }
    return conn;
  }

  getTenant(slug: string): WhatsAppConnection | undefined {
    return this.connections.get(slug);
  }

  countActiveTenants(): number {
    let count = 0;
    for (const id of this.connections.keys()) {
      if (id !== SELLER_ID) count++;
    }
    return count;
  }

  /**
   * Cria (ou devolve a já existente) conexão isolada para um cliente.
   * Lança Error('CAPACITY_FULL') se o teto de conexões simultâneas foi atingido.
   */
  async createTenantConnection(slug: string, opts?: WhatsAppConnectionOpts): Promise<WhatsAppConnection> {
    const existing = this.connections.get(slug);
    if (existing) return existing;

    if (this.countActiveTenants() >= this.maxTenants) {
      throw new Error('CAPACITY_FULL');
    }

    const conn = new WhatsAppConnection(slug, slug, opts);
    this.connections.set(slug, conn);
    await conn.init();
    return conn;
  }

  async destroyTenant(slug: string): Promise<void> {
    const conn = this.connections.get(slug);
    if (!conn) return;
    await conn.destroy();
    this.connections.delete(slug);
  }
}

export const whatsappManager = new WhatsAppManager();

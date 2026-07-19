/**
 * utils/pixBrCode.ts
 * Gera o código "Pix Copia e Cola" (padrão BR Code / EMV QR Code do Bacen),
 * 100% local — sem API, sem custo, sem dependência nova. Usado pra embutir
 * cobrança de verdade no produto em vez de só mandar a chave Pix em texto.
 */

export interface PixBrCodeInput {
  chave: string;
  nomeRecebedor: string;
  cidade: string;
  valor?: number;
  txid: string;
}

function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

/** Remove acentos, mantém só alfanumérico+espaço, maiúsculas, corta no tamanho máximo do campo. */
function sanitizeTexto(texto: string, maxLen: number): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .toUpperCase()
    .trim()
    .slice(0, maxLen);
}

function sanitizeTxid(txid: string): string {
  const limpo = (txid || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 25);
  return limpo || '***';
}

/** CRC16-CCITT-FALSE (polinômio 0x1021, init 0xFFFF) — exigido pelo padrão BR Code. */
function crc16ccitt(payload: string): string {
  let crc = 0xffff;
  const polynomial = 0x1021;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ polynomial) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function gerarPixCopiaECola(input: PixBrCodeInput): string {
  const chave = input.chave.trim();
  if (!chave) throw new Error('gerarPixCopiaECola: chave Pix vazia');

  const nome = sanitizeTexto(input.nomeRecebedor, 25) || 'RECEBEDOR';
  const cidade = sanitizeTexto(input.cidade, 15) || 'BRASIL';
  const txid = sanitizeTxid(input.txid);

  const merchantAccountInfo = tlv('00', 'BR.GOV.BCB.PIX') + tlv('01', chave);
  const additionalData = tlv('05', txid);

  let payload =
    tlv('00', '01') + // Payload Format Indicator
    tlv('26', merchantAccountInfo) + // Merchant Account Info — Pix
    tlv('52', '0000') + // Merchant Category Code
    tlv('53', '986') + // Moeda — BRL
    (input.valor !== undefined ? tlv('54', input.valor.toFixed(2)) : '') +
    tlv('58', 'BR') + // País
    tlv('59', nome) + // Nome do recebedor
    tlv('60', cidade) + // Cidade do recebedor
    tlv('62', additionalData); // Txid

  payload += '6304'; // ID+tamanho do campo CRC — o valor vem a seguir
  return payload + crc16ccitt(payload);
}

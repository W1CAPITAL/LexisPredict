/** BR Code Pix estático (copia e cola) + CRC16. */

function emv(id: string, value: string): string {
  const len = String(value.length).padStart(2, "0");
  return `${id}${len}${value}`;
}

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function gerarPixCopiaCola(opts: {
  chave: string;
  nomeRecebedor: string;
  cidade?: string;
  valor: number;
  txid?: string;
  descricao?: string;
}): string {
  const nome = (opts.nomeRecebedor || "RECEBEDOR").slice(0, 25).toUpperCase();
  const cidade = (opts.cidade || "SAO PAULO").slice(0, 15).toUpperCase();
  const txid = (opts.txid || "LX" + Date.now().toString(36)).replace(/[^a-zA-Z0-9]/g, "").slice(0, 25);
  const chave = String(opts.chave || "").trim();
  if (!chave || !(opts.valor > 0)) return "";

  let mai = emv("00", "br.gov.bcb.pix") + emv("01", chave);
  if (opts.descricao) mai += emv("02", opts.descricao.slice(0, 50));

  let payload = "";
  payload += emv("00", "01");
  payload += emv("26", mai);
  payload += emv("52", "0000");
  payload += emv("53", "986");
  payload += emv("54", opts.valor.toFixed(2));
  payload += emv("58", "BR");
  payload += emv("59", nome);
  payload += emv("60", cidade);
  payload += emv("62", emv("05", txid));
  payload += "6304";
  return payload + crc16(payload);
}

/** URL de QR (API pública) a partir do payload — sem dependência npm. */
export function qrCodeUrl(payload: string, size = 280): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(payload)}`;
}

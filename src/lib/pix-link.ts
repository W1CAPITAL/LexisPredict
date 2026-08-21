/**
 * Pix leve — sem gateway.
 * 1) Link/mensagem com chave estática
 * 2) Payload EMV "copia e cola" básico (chave aleatória/email/telefone/cnpj)
 *
 * Não gera QR dinâmico com valor no Banco Central — para isso precisaria de PSP.
 */

export type PixStaticInput = {
  chave: string;
  nomeRecebedor: string;
  cidade?: string;
  valor?: number;
  txid?: string;
  descricao?: string;
};

function emv(id: string, value: string): string {
  const len = String(value.length).padStart(2, "0");
  return `${id}${len}${value}`;
}

/** CRC16-CCITT (0xFFFF) para payload Pix */
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

/**
 * Gera BR Code estático (copia e cola).
 * Se valor informado, inclui campo 54.
 */
export function gerarPixCopiaCola(input: PixStaticInput): string {
  const nome = (input.nomeRecebedor || "RECEBEDOR").slice(0, 25).toUpperCase();
  const cidade = (input.cidade || "SAO PAULO").slice(0, 15).toUpperCase();
  const txid = (input.txid || "LEXIS" + Date.now().toString(36)).slice(0, 25);
  const chave = String(input.chave || "").trim();
  if (!chave) return "";

  const merchantAccount =
    emv("00", "br.gov.bcb.pix") + emv("01", chave) + (input.descricao ? emv("02", input.descricao.slice(0, 50)) : "");

  let payload = "";
  payload += emv("00", "01"); // payload format
  payload += emv("26", merchantAccount);
  payload += emv("52", "0000");
  payload += emv("53", "986");
  if (input.valor != null && input.valor > 0) {
    payload += emv("54", input.valor.toFixed(2));
  }
  payload += emv("58", "BR");
  payload += emv("59", nome);
  payload += emv("60", cidade);
  payload += emv("62", emv("05", txid));
  payload += "6304";
  const crc = crc16(payload);
  return payload + crc;
}

export function mensagemPixWhatsApp(opts: {
  cliente: string;
  valor: number;
  chave: string;
  copiaCola?: string;
}): string {
  const brl = opts.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const linhas = [
    `Olá ${opts.cliente}, segue dados para pagamento de ${brl}:`,
    `Chave Pix: ${opts.chave}`,
  ];
  if (opts.copiaCola) {
    linhas.push("", "Pix Copia e Cola:", opts.copiaCola);
  }
  return linhas.join("\n");
}

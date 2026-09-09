/** CNJ 20 dígitos com DV válido (Res. 65). Só número. Nada de parte. */

const TR_ESTADUAL = [
  "01","02","03","04","05","06","07","08","09","10",
  "11","12","13","14","15","16","17","18","19","20",
  "21","22","23","24","25","26","27",
];

function pad(n: number, w: number) {
  return String(n).padStart(w, "0");
}

function dvCnj(seq7: string, ano: string, j: string, tr: string, origem: string): string {
  const base = `${seq7}${ano}${j}${tr}${origem}`;
  const resto = BigInt(base) % 97n;
  const dv = 98n - resto;
  return String(dv).padStart(2, "0");
}

export function formatCnj20(d: string): string {
  const x = String(d || "").replace(/\D/g, "").slice(0, 20);
  if (x.length !== 20) return x;
  return `${x.slice(0, 7)}-${x.slice(7, 9)}.${x.slice(9, 13)}.${x.slice(13, 14)}.${x.slice(14, 16)}.${x.slice(16, 20)}`;
}

export function gerarUmCnj(anoMin = 2016, anoMax = 2026): string {
  const ano = pad(anoMin + Math.floor(Math.random() * (anoMax - anoMin + 1)), 4);
  const j = "8";
  const tr = TR_ESTADUAL[Math.floor(Math.random() * TR_ESTADUAL.length)];
  const origem = pad(1 + Math.floor(Math.random() * 900), 4);
  const seq = pad(1 + Math.floor(Math.random() * 9_999_999), 7);
  const dd = dvCnj(seq, ano, j, tr, origem);
  return `${seq}${dd}${ano}${j}${tr}${origem}`;
}

export function gerarLoteCnj(qtd: number, teto = 20000): string[] {
  const n = Math.max(0, Math.min(Math.floor(Number(qtd) || 0), teto));
  const seen = new Set<string>();
  let guard = 0;
  while (seen.size < n && guard < n * 8 + 50) {
    seen.add(gerarUmCnj());
    guard += 1;
  }
  return [...seen];
}


const TJ_TR: Record<string, string> = {
  TJAC: "01", TJAL: "02", TJAP: "03", TJAM: "04", TJBA: "05", TJCE: "06",
  TJDF: "07", TJDFT: "07", TJES: "08", TJGO: "09", TJMA: "10", TJMT: "11",
  TJMS: "12", TJMG: "13", TJPA: "14", TJPB: "15", TJPR: "16", TJPE: "17",
  TJPI: "18", TJRJ: "19", TJRN: "20", TJRS: "21", TJRO: "22", TJRR: "23",
  TJSC: "24", TJSE: "25", TJSP: "26", TJTO: "27",
};

export function trDoTribunal(sigla?: string): string | null {
  const k = String(sigla || "").replace(/\s/g, "").toUpperCase();
  return TJ_TR[k] || null;
}

export function gerarCnjTribunal(sigla?: string, anoMin = 2020, anoMax = 2026): string {
  const ano = pad(anoMin + Math.floor(Math.random() * (anoMax - anoMin + 1)), 4);
  const j = "8";
  const tr = trDoTribunal(sigla) || TR_ESTADUAL[Math.floor(Math.random() * TR_ESTADUAL.length)];
  const origem = pad(1 + Math.floor(Math.random() * 320), 4);
  const seq = pad(1 + Math.floor(Math.random() * 400000), 7);
  const dd = dvCnj(seq, ano, j, tr, origem);
  return `${seq}${dd}${ano}${j}${tr}${origem}`;
}

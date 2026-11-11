/** Pure CNJ J/TR → DataJud public-index mapping. Safe to import from client code. */
export const COURT_ALIASES: Record<string, string> = {
  "8.01": "tjac", "8.02": "tjal", "8.03": "tjap", "8.04": "tjam", "8.05": "tjba",
  "8.06": "tjce", "8.07": "tjdft", "8.08": "tjes", "8.09": "tjgo", "8.10": "tjma",
  "8.11": "tjmt", "8.12": "tjms", "8.13": "tjmg", "8.14": "tjpa", "8.15": "tjpb",
  "8.16": "tjpr", "8.17": "tjpe", "8.18": "tjpi", "8.19": "tjrj", "8.20": "tjrn",
  "8.21": "tjrs", "8.22": "tjro", "8.23": "tjrr", "8.24": "tjsc", "8.25": "tjse",
  "8.26": "tjsp", "8.27": "tjto", "4.01": "trf1", "4.02": "trf2", "4.03": "trf3",
  "4.04": "trf4", "4.05": "trf5", "4.06": "trf6",
  "5.01": "trt1", "5.02": "trt2", "5.03": "trt3", "5.04": "trt4", "5.05": "trt5",
  "5.06": "trt6", "5.07": "trt7", "5.08": "trt8", "5.09": "trt9", "5.10": "trt10",
  "5.11": "trt11", "5.12": "trt12", "5.13": "trt13", "5.14": "trt14", "5.15": "trt15",
  "5.16": "trt16", "5.17": "trt17", "5.18": "trt18", "5.19": "trt19", "5.20": "trt20",
  "5.21": "trt21", "5.22": "trt22", "5.23": "trt23", "5.24": "trt24",
  "3.00": "stj", "5.00": "tst", "6.00": "tse", "7.00": "stm",
  "6.01": "tre-ac",
  "6.02": "tre-al",
  "6.03": "tre-am",
  "6.04": "tre-ap",
  "6.05": "tre-ba",
  "6.06": "tre-ce",
  "6.07": "tre-dft",
  "6.08": "tre-es",
  "6.09": "tre-go",
  "6.10": "tre-ma",
  "6.11": "tre-mt",
  "6.12": "tre-ms",
  "6.13": "tre-mg",
  "6.14": "tre-pa",
  "6.15": "tre-pb",
  "6.16": "tre-pr",
  "6.17": "tre-pe",
  "6.18": "tre-pi",
  "6.19": "tre-rj",
  "6.20": "tre-rn",
  "6.21": "tre-rs",
  "6.22": "tre-ro",
  "6.23": "tre-rr",
  "6.24": "tre-sc",
  "6.25": "tre-se",
  "6.26": "tre-sp",
  "6.27": "tre-to",
  "7.01": "stm",
  "7.02": "stm",
  "7.03": "stm",
  "7.04": "stm",
  "7.05": "stm",
  "7.06": "stm",
  "7.07": "stm",
  "7.08": "stm",
  "7.09": "stm",
  "7.10": "stm",
  "7.11": "stm",
  "7.12": "stm",
  "9.13": "tjmmg", "9.21": "tjmrs", "9.26": "tjmsp"
};

/** Resolve o alias DataJud a partir do CNJ, cobrindo TJ/TRF/TRT/superiores. */
export function resolveDataJudAlias(cnj: string): string | null {
  const digits = String(cnj || "").replace(/\D/g, "");
  if (digits.length !== 20) return null;
  const aliasPart = `${digits[13]}.${digits.substring(14, 16)}`;
  return COURT_ALIASES[aliasPart] || null;
}

/// <reference lib="webworker" />

type SearchField = "nome" | "cpf" | "telefone";
type ColumnMap = Record<SearchField, string>;

const worker = self as unknown as DedicatedWorkerGlobalScope;
const CHUNK_SIZE = 8 * 1024 * 1024;
const RESULT_LIMIT = 500;

let sourceFile: File | undefined;
let delimiter = ";";
let columns: string[] = [];
let encoding = "utf-8";

function post(type: string, payload: Record<string, unknown> = {}) {
  worker.postMessage({ type, ...payload });
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause || "Erro desconhecido");
}

function detectDelimiter(record: string) {
  const candidates = [";", ",", "\t", "|"];
  const counts = new Map(candidates.map((candidate) => [candidate, 0]));
  let quoted = false;
  for (let index = 0; index < record.length; index += 1) {
    const character = record[index];
    if (character === '"') {
      if (quoted && record[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (!quoted && counts.has(character)) {
      counts.set(character, (counts.get(character) || 0) + 1);
    }
  }
  return candidates.sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0))[0];
}

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleUpperCase("pt-BR").replace(/\s+/g, " ").trim();
}

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function matches(value: string, query: string, field: SearchField) {
  if (field === "nome") return normalizeText(value).includes(normalizeText(query));
  const left = digits(value);
  const right = digits(query);
  if (!left || !right) return false;
  if (field === "telefone") return left === right || left.endsWith(right) || right.endsWith(left);
  return left === right;
}

async function parseFile(
  file: File,
  onRow: (row: string[], rowNumber: number) => boolean | void,
  progress = false,
) {
  const decoder = new TextDecoder(encoding);
  let field = "";
  let row: string[] = [];
  let rowNumber = 0;
  let inQuotes = false;
  let quotePending = false;
  let skipLf = false;
  let stopped = false;

  const finishRow = () => {
    row.push(field);
    field = "";
    const shouldStop = onRow(row, rowNumber) === true;
    row = [];
    rowNumber += 1;
    return shouldStop;
  };

  const processOutside = (character: string) => {
    if (skipLf && character === "\n") {
      skipLf = false;
      return false;
    }
    skipLf = false;
    if (character === delimiter) {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r") skipLf = true;
      return finishRow();
    } else if (character === '"' && field.length === 0) {
      inQuotes = true;
    } else {
      field += character;
    }
    return false;
  };

  for (let offset = 0; offset < file.size && !stopped; offset += CHUNK_SIZE) {
    const end = Math.min(file.size, offset + CHUNK_SIZE);
    const text = decoder.decode(await file.slice(offset, end).arrayBuffer(), { stream: end < file.size });
    for (const character of text) {
      if (inQuotes) {
        if (character === '"') {
          inQuotes = false;
          quotePending = true;
        } else {
          field += character;
        }
      } else if (quotePending) {
        if (character === '"') {
          field += '"';
          inQuotes = true;
          quotePending = false;
        } else {
          quotePending = false;
          stopped = processOutside(character);
        }
      } else {
        stopped = processOutside(character);
      }
      if (stopped) break;
    }
    if (progress) post("search-progress", { loaded: end, total: file.size });
  }
  if (!stopped && (field.length > 0 || row.length > 0)) finishRow();
}

async function openFile(file: File, requestedEncoding = "utf-8") {
  sourceFile = file;
  encoding = requestedEncoding === "windows-1252" ? "windows-1252" : "utf-8";
  const sample = new TextDecoder(encoding).decode(await file.slice(0, Math.min(file.size, 1024 * 1024)).arrayBuffer());
  const firstLine = sample.split(/\r?\n/, 1)[0].replace(/^\uFEFF/, "");
  delimiter = detectDelimiter(firstLine);
  columns = [];
  await parseFile(file, (row) => {
    columns = row.map((value, index) => value.replace(/^\uFEFF/, "").trim() || `coluna_${index + 1}`);
    return true;
  });
  if (!columns.length) throw new Error("Não foi possível identificar o cabeçalho do CSV.");
  post("ready", { columns, delimiter, encoding, file: { name: file.name, size: file.size } });
}

async function search(payload: { field: SearchField; query: string; mapping: ColumnMap }) {
  if (!sourceFile) throw new Error("Abra a base Credilink antes de consultar.");
  const selectedColumn = payload.mapping[payload.field];
  const columnIndex = columns.indexOf(selectedColumn);
  if (columnIndex < 0) throw new Error("Selecione a coluna correspondente ao tipo de busca.");
  const query = payload.query.trim();
  if (!query) throw new Error("Digite um nome, CPF ou telefone.");
  const results: string[][] = [];
  let capped = false;

  await parseFile(sourceFile, (row, rowNumber) => {
    if (rowNumber === 0) return false;
    if (matches(row[columnIndex] || "", query, payload.field)) results.push(row);
    if (results.length >= RESULT_LIMIT) {
      capped = true;
      return true;
    }
    return false;
  }, true);
  post("results", { columns, rows: results, capped });
}

worker.onmessage = async (event: MessageEvent) => {
  try {
    const message = event.data;
    if (message.type === "open") await openFile(message.file, message.encoding);
    if (message.type === "search") await search(message);
    if (message.type === "close") {
      sourceFile = undefined;
      columns = [];
      post("closed");
    }
  } catch (cause) {
    post("error", { message: errorMessage(cause) });
  }
};

export {};

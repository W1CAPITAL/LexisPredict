/// <reference lib="webworker" />

type SearchField = "nome" | "cpf" | "telefone";
type ColumnMap = Record<SearchField, string>;

const worker = self as unknown as DedicatedWorkerGlobalScope;
const RESULT_LIMIT = 2000;
const BROWSE_PAGE = 200;
const CHUNK = 2 * 1024 * 1024;

let sourceFile: File | undefined;
let encoding: string = "utf-8";
let delimiter = ";";
let columns: string[] = [];
/** byte offset after header line */
let dataStart = 0;

function post(type: string, payload: Record<string, unknown> = {}) {
  worker.postMessage({ type, ...payload });
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause || "Erro desconhecido");
}

function detectDelimiter(line: string) {
  const counts = { ";": 0, ",": 0, "\t": 0 };
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && c in counts) counts[c as keyof typeof counts]++;
  }
  if (counts[";"] >= counts[","] && counts[";"] >= counts["\t"]) return ";";
  if (counts["\t"] > counts[","]) return "\t";
  return ",";
}

function matches(cell: string, query: string, field: SearchField) {
  if (field === "nome") return cell.toLowerCase().includes(query.toLowerCase());
  const a = cell.replace(/\D/g, "");
  const b = query.replace(/\D/g, "");
  if (!b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

type RowCb = (row: string[], rowNumber: number) => boolean;

async function parseFile(
  file: File,
  onRow: RowCb,
  progress = false,
  startByte = 0
) {
  let offset = startByte;
  let carry = "";
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let quotePending = false;
  let rowNumber = startByte > 0 ? 1 : 0; // if resume, not header
  let stopped = false;

  const finishRow = () => {
    row.push(field);
    field = "";
    const done = onRow(row, rowNumber);
    row = [];
    rowNumber += 1;
    return done;
  };

  const processOutside = (character: string) => {
    if (character === delimiter) {
      row.push(field);
      field = "";
      return false;
    }
    if (character === "\n") {
      return finishRow();
    }
    if (character !== "\r") field += character;
    return false;
  };

  while (offset < file.size && !stopped) {
    const end = Math.min(file.size, offset + CHUNK);
    const text = new TextDecoder(encoding).decode(await file.slice(offset, end).arrayBuffer());
    offset = end;
    const chunk = carry + text;
    carry = "";
    for (let i = 0; i < chunk.length; i++) {
      const character = chunk[i];
      if (inQuotes) {
        if (character === '"') {
          if (i + 1 < chunk.length && chunk[i + 1] === '"') {
            field += '"';
            i += 1;
          } else if (i === chunk.length - 1 && offset < file.size) {
            carry = '"';
            break;
          } else {
            inQuotes = false;
            quotePending = true;
          }
        } else field += character;
      } else if (quotePending) {
        if (character === '"') {
          field += '"';
          inQuotes = true;
          quotePending = false;
        } else {
          quotePending = false;
          stopped = processOutside(character);
        }
      } else if (character === '"' && field.length === 0) {
        inQuotes = true;
      } else {
        stopped = processOutside(character);
      }
      if (stopped) break;
    }
    if (progress) post("search-progress", { loaded: end, total: file.size });
  }
  if (!stopped && (field.length > 0 || row.length > 0)) finishRow();
  return { nextOffset: offset, rowsRead: rowNumber };
}

async function openFile(file: File, requestedEncoding = "utf-8") {
  post("search-progress", { loaded: 0, total: file.size });
  sourceFile = file;
  encoding = requestedEncoding === "windows-1252" ? "windows-1252" : "utf-8";
  const headSize = Math.min(file.size, 1024 * 1024);
  const sample = new TextDecoder(encoding).decode(await file.slice(0, headSize).arrayBuffer());
  const nl = sample.indexOf("\n");
  if (nl < 0) throw new Error("CSV sem quebra de linha no cabeçalho.");
  dataStart = nl + 1;
  const firstLine = sample.slice(0, nl).replace(/^\uFEFF/, "").replace(/\r$/, "");
  delimiter = detectDelimiter(firstLine);
  columns = firstLine.split(delimiter).map((value, index) => value.replace(/^\uFEFF/, "").trim() || `coluna_${index + 1}`);
  if (!columns.length) throw new Error("Não foi possível identificar o cabeçalho do CSV.");
  post("search-progress", { loaded: headSize, total: file.size });
  post("ready", {
    columns,
    delimiter,
    encoding,
    file: { name: file.name, size: file.size },
    dataStart,
  });
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

  await parseFile(
    sourceFile,
    (row, rowNumber) => {
      if (rowNumber === 0) return false;
      if (matches(row[columnIndex] || "", query, payload.field)) results.push(row);
      if (results.length >= RESULT_LIMIT) {
        capped = true;
        return true;
      }
      return false;
    },
    true
  );
  post("results", { columns, rows: results, capped });
}

/** Página de visualização: lê no máximo BROWSE_PAGE linhas a partir de byteOffset. */
async function browse(payload: { byteOffset?: number; limit?: number }) {
  if (!sourceFile) throw new Error("Abra o CSV antes de visualizar.");
  const limit = Math.min(500, Math.max(1, payload.limit || BROWSE_PAGE));
  let start = payload.byteOffset ?? dataStart;
  if (start < dataStart) start = dataStart;
  const rows: string[][] = [];
  let nextOffset = start;
  // Parse from start: need stateful parse from mid-file is hard; scan chunk and split lines carefully
  let offset = start;
  let carry = "";
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let stopped = false;

  const pushRow = () => {
    row.push(field);
    field = "";
    rows.push(row);
    row = [];
    return rows.length >= limit;
  };

  while (offset < sourceFile.size && !stopped) {
    const end = Math.min(sourceFile.size, offset + CHUNK);
    const text = new TextDecoder(encoding).decode(await sourceFile.slice(offset, end).arrayBuffer());
    offset = end;
    const chunk = carry + text;
    carry = "";
    for (let i = 0; i < chunk.length; i++) {
      const c = chunk[i];
      if (inQuotes) {
        if (c === '"') {
          if (i + 1 < chunk.length && chunk[i + 1] === '"') {
            field += '"';
            i++;
          } else inQuotes = false;
        } else field += c;
      } else if (c === '"' && field.length === 0) {
        inQuotes = true;
      } else if (c === delimiter) {
        row.push(field);
        field = "";
      } else if (c === "\n") {
        if (pushRow()) {
          // approximate next offset: remaining in chunk not perfect; store end of this chunk start + i
          nextOffset = end - (chunk.length - i - 1);
          stopped = true;
          break;
        }
      } else if (c !== "\r") field += c;
    }
    if (!stopped && end < sourceFile.size && (inQuotes || field || row.length)) {
      // keep incomplete line in carry — simplified: if incomplete, redo is hard; break carry last line
      carry = field; // incomplete handling simplified
    }
    post("search-progress", { loaded: end, total: sourceFile.size });
  }
  if (!stopped && (field || row.length)) {
    row.push(field);
    rows.push(row);
  }
  post("browse", {
    columns,
    rows,
    byteOffset: start,
    nextByteOffset: Math.min(sourceFile.size, nextOffset || offset),
    done: offset >= sourceFile.size,
    limit,
  });
}

worker.onmessage = async (event: MessageEvent) => {
  try {
    const message = event.data;
    if (message.type === "open") await openFile(message.file, message.encoding);
    if (message.type === "search") await search(message);
    if (message.type === "browse") await browse(message);
    if (message.type === "close") {
      sourceFile = undefined;
      columns = [];
      dataStart = 0;
      post("closed");
    }
  } catch (cause) {
    post("error", { message: errorMessage(cause) });
  }
};

export {};

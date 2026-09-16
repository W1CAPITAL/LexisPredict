import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');
import { pathToFileURL } from 'node:url';

export const nomeKey = v => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
export const cpfKey = v => { let s = String(v ?? '').replace(/\D/g, '');
  if (s.length === 9 || s.length === 10) {
    const padded = s.padStart(11, '0');
    const valid = !/^(\d)\1+$/.test(padded) && [9, 10].every(n => {
      let sum = 0; for (let j = 0; j < n; j++) sum += Number(padded[j]) * (n + 1 - j);
      return (sum * 10 % 11) % 10 === Number(padded[n]);
    });
    if (valid) s = padded;
  }
  return s.length === 11 ? s : ''; };
const hash = s => createHash('sha256').update(s).digest().subarray(0, 16);
const quote = s => '"' + s.replaceAll('"', '""') + '"';
const json = v => JSON.stringify(v, (_, x) => typeof x === 'bigint' ? String(x) : x instanceof Uint8Array ? { tipo: 'blob', base64: Buffer.from(x).toString('base64') } : x);

// Parser incremental: aspas, delimitadores e quebras de linha podem atravessar chunks.
export async function* csvRows(file, options = {}) {
  const decoder = new TextDecoder(options.encoding || 'utf-8', { fatal: true });
  let field = '', row = [], quoted = false, afterQuote = false, skipLF = false, first = true;
  let delimiter = options.delimiter || '', prefix = '';
  function* parse(text) {
    for (const c of text) {
      if (first) { first = false; if (c === '\uFEFF') continue; }
      if (skipLF) { skipLF = false; if (c === '\n') continue; }
      if (quoted) {
        if (c === '"') { quoted = false; afterQuote = true; } else field += c;
        continue;
      }
      if (afterQuote && c === '"') { field += '"'; quoted = true; afterQuote = false; continue; }
      if (c === delimiter) { row.push(field); field = ''; afterQuote = false; }
      else if (c === '\r' || c === '\n') {
        const present = row.length > 0 || field !== '' || afterQuote;
        row.push(field); if (present) yield row;
        row = []; field = ''; afterQuote = false; skipLF = c === '\r';
      } else if (c === '"' && field === '' && !afterQuote) quoted = true;
      else { if (afterQuote) throw new Error('CSV invalido: caractere apos aspas.'); field += c; }
    }
  }
  for await (const chunk of fs.createReadStream(file, { highWaterMark: options.chunkSize || 256 * 1024 })) {
    let text = decoder.decode(chunk, { stream: true });
    if (!delimiter) {
      prefix += text;
      const end = prefix.search(/[\r\n]/);
      if (end < 0) { if (prefix.length > 1048576) throw new Error('Cabecalho CSV muito grande.'); continue; }
      const header = prefix.slice(0, end);
      delimiter = [',', ';', '\t'].sort((a, b) => header.split(b).length - header.split(a).length)[0];
      text = prefix; prefix = '';
    }
    yield* parse(text);
  }
  const tail = decoder.decode();
  if (!delimiter) { delimiter = [',', ';', '\t'].sort((a,b)=>prefix.split(b).length-prefix.split(a).length)[0]; yield* parse(prefix); }
  yield* parse(tail);
  if (quoted) throw new Error('CSV incompleto: aspas abertas no fim.');
  if (field || row.length || afterQuote) { row.push(field); yield row; }
}

export async function build(config, log = console.log) {
  const output = path.resolve(config.output || 'indice-completo.lidx');
  const sources = config.sources || [];
  if (!sources.length) throw new Error('Configure pelo menos uma fonte.');
  if (fs.existsSync(output)) throw new Error('Saida ja existe. Renomeie/remova o indice antigo ou mude output; ele nao sera sobrescrito.');
  const lock = output + '.lock';
  const lockFd = fs.openSync(lock, 'wx');
  fs.writeFileSync(lockFd, String(process.pid)); fs.closeSync(lockFd);
  const temp = output + '.part';
  const tempDb = output + '.work.sqlite';
  let ownTemp = false, ownDb = false;
  let db, fd, offset = 64, count = 0, entries = 0, block = [], blockBytes = 0, lastLog = 0;
  const started = Date.now(), schemas = [];
  const check = () => { if (config.cancelFile && fs.existsSync(config.cancelFile)) throw new Error('Cancelado pelo usuario.'); };
  const write = b => { let n = 0; while (n < b.length) n += fs.writeSync(fd, b, n, b.length-n); offset += b.length; };
  try {
    for (const s of sources) {
      if (!fs.existsSync(s.path) && s.fallback && fs.existsSync(s.fallback)) s.path = s.fallback;
      if (!fs.statSync(s.path).isFile()) throw new Error('Fonte nao e arquivo: ' + s.path);
      if (path.resolve(s.path) === output) throw new Error('Fonte e saida iguais.');
    }
    if (fs.existsSync(temp) || fs.existsSync(tempDb)) throw new Error('Existe processamento interrompido (.part/.work.sqlite). Renomeie os temporarios antes de tentar novamente.');
    fd = fs.openSync(temp, 'wx'); ownTemp = true; fs.writeSync(fd, Buffer.alloc(64));
    db = new DatabaseSync(tempDb); ownDb = true;
    db.exec('PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF; PRAGMA cache_size=-65536; PRAGMA temp_store=FILE; CREATE TABLE idx(k BLOB, off INTEGER, len INTEGER, pos INTEGER); BEGIN;');
    const insert = db.prepare('INSERT INTO idx VALUES(?,?,?,?)');
    function flush() {
      if (!block.length) return;
      check();
      const compressed = gzipSync(Buffer.from(json(block)), { level: 6 });
      const start = offset; write(compressed);
      block.forEach((r, i) => {
        const schema = schemas[r.s];
        const c = cpfKey(r.v[schema.cpf]); const n = nomeKey(r.v[schema.nome]);
        if (c) { insert.run(hash('cpf:' + c), start, compressed.length, i); entries++; }
        if (n) { insert.run(hash('nome:' + n), start, compressed.length, i); entries++; }
      });
      block = []; blockBytes = 0;
      if (Date.now() - lastLog > 2000) { log(`Lendo: ${count} registros | ${Math.round((Date.now()-started)/1000)}s`); lastLog = Date.now(); db.exec('COMMIT; BEGIN;'); }
    }
    function schemaFor(s, headers, table = '') {
      if (new Set(headers).size !== headers.length) throw new Error('Cabecalhos duplicados: ' + path.basename(s.path));
      const upper = headers.map(h => h.trim().toUpperCase());
      const first = names => names.map(n => upper.indexOf(n)).find(i => i >= 0) ?? -1;
      const schema = { fonte: path.basename(s.path), tabela: table, colunas: headers, cpf: first(['CPF_NUMBER', 'CPF']), nome: first(['NAME', 'NOME']), registros: 0 };
      schemas.push(schema); return schemas.length - 1;
    }
    function add(s, values) {
      if (count % 1024 === 0) check(); const schema = schemas[s];
      if (values.length !== schema.colunas.length) throw new Error(`Colunas divergentes em ${schema.fonte}, registro ${schema.registros + 1}: ${values.length}/${schema.colunas.length}`);
      const row = { s, r: ++schema.registros, v: values };
      const size = Buffer.byteLength(json(row));
      if (size > 8 * 1024 * 1024) throw new Error('Registro acima de 8 MiB; nenhuma coluna foi descartada.');
      block.push(row); blockBytes += size; count++;
      if (blockBytes >= 512 * 1024 || block.length >= 1024) flush();
    }
    for (const s of sources) {
      check(); log('Fonte: ' + path.basename(s.path));
      const sourceBefore = fs.statSync(s.path);
      if (/\.(db|sqlite|sqlite3)$/i.test(s.path) || s.type === 'sqlite') {
        const source = new DatabaseSync(s.path, { readOnly: true });
        try {
          const tables = s.table ? [{ name: s.table }] : source.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
          for (const { name } of tables) {
            const headers = source.prepare('PRAGMA table_xinfo(' + quote(name) + ')').all().map(c => c.name);
            if (!headers.length) throw new Error('Tabela ausente: ' + name);
            const id = schemaFor(s, headers, name);
            const statement = source.prepare('SELECT ' + headers.map(quote).join(',') + ' FROM ' + quote(name)); statement.setReadBigInts(true);
            for (const row of statement.iterate()) add(id, headers.map(h => row[h]));
            statement.setReadBigInts(false);
            log(`Tabela ${name}: ${schemas[id].registros} registros`);
          }
        } finally { source.close(); }
      } else {
        let id = -1;
        for await (const row of csvRows(s.path, s)) {
          if (id < 0) id = schemaFor(s, row); else add(id, row);
        }
        if (id < 0) throw new Error('CSV vazio: ' + s.path);
      }
      const sourceAfter = fs.statSync(s.path);
      if (sourceBefore.size !== sourceAfter.size || sourceBefore.mtimeMs !== sourceAfter.mtimeMs) throw new Error('Fonte alterada durante a leitura: ' + path.basename(s.path));
      flush();
    }
    if (!count) throw new Error('Nenhum registro nas fontes.');
    db.exec('COMMIT'); check();
    log(`Ordenando ${entries} chaves em disco. Esta etapa pode demorar; RAM limitada a cache de 64 MiB + blocos.`);
    const indexOffset = offset;
    let buf = Buffer.alloc(32 * 4096), used = 0;
    const sortedStatement = db.prepare('SELECT k,off,len,pos FROM idx ORDER BY k');
    for (const r of sortedStatement.iterate()) {
      check(); Buffer.from(r.k).copy(buf, used); buf.writeBigUInt64LE(BigInt(r.off), used+16); buf.writeUInt32LE(r.len, used+24); buf.writeUInt32LE(r.pos, used+28); used += 32;
      if (used === buf.length) { write(buf); used = 0; }
    }
    sortedStatement.setReadBigInts(false); // Mantem a statement viva ate o fim do iterator no Node 22.14.
    if (used) write(buf.subarray(0, used));
    const metaOffset = offset;
    const metadata = Buffer.from(json({ version: 2, registros: count, schemas, createdAt: new Date().toISOString(), compression: 'gzip', key: 'sha256-128' }));
    write(metadata);
    const h = Buffer.alloc(64); h.write('LIDX2\r\n\0', 0, 'ascii'); h.writeBigUInt64LE(BigInt(indexOffset), 8); h.writeBigUInt64LE(BigInt(entries), 16); h.writeBigUInt64LE(BigInt(metaOffset), 24); h.writeBigUInt64LE(BigInt(metadata.length), 32);
    fs.writeSync(fd, h, 0, 64, 0); fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined;
    db.close(); db = undefined; check(); fs.renameSync(temp, output);
    log(`CONCLUIDO: ${count} registros, ${schemas.length} tabelas/CSV, ${offset} bytes, ${Math.round((Date.now()-started)/1000)}s. Arquivo: ${output}`);
    return { output, count, entries, bytes: offset, schemas };
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    if (db) db.close();
    // Temporarios pertencem exclusivamente a esta execucao (lock adquirido acima).
    for (const f of [...(ownTemp ? [temp] : []), ...(ownDb ? [tempDb, tempDb + '-journal'] : []), lock]) { try { fs.unlinkSync(f); } catch {} }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const configPath = path.resolve(process.argv[2] || 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, ''));
    const base = path.dirname(configPath);
    const resolve = p => path.resolve(base, p.replace(/%USERPROFILE%/gi, process.env.USERPROFILE || process.env.HOME || ''));
    config.output = resolve(config.output || 'indice-completo.lidx');
    config.cancelFile = resolve('cancelar.flag');
    config.sources = config.sources.map(s => ({ ...s, path: resolve(s.path), fallback: s.fallback ? resolve(s.fallback) : undefined }));
    await build(config);
  } catch (e) { console.error('[ERRO] ' + e.message); process.exitCode = 1; }
}

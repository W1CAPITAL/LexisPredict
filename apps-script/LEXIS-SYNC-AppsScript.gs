/**
 * LEXIS GABINETE — Apps Script / Google Sheets adapter
 * =====================================================
 *
 * Uma única implementação de webhook para o LexisPredict.
 * Corrige:
 *  - token aceito no body do POST (compatível com Vercel);
 *  - seed em lotes de 500;
 *  - upsert por Protocolo/CNJ sem duplicar linhas;
 *  - preservação de TODAS as colunas existentes quando a entrada não informa o campo;
 *  - escrita em matriz em vez de setValue célula a célula;
 *  - leitura LIST retornando a linha inteira;
 *  - auditoria de quem editou/atendeu;
 *  - ações auth/login, list, get, write e upsert_batch.
 *
 * DEPLOY:
 * 1) Substitua TODO o código antigo por este arquivo.
 * 2) TOKEN deve ser igual a LEXIS_SHEETS_TOKEN no Vercel.
 * 3) Implantar > Nova implantação > Aplicativo da web.
 * 4) Executar como: Eu.
 * 5) Quem tem acesso: Qualquer pessoa.
 * 6) Use somente a URL /exec.
 * 7) Depois de alterar este arquivo: Gerenciar implantações > editar > Nova versão.
 */

var TOKEN = "";
var USERS_SHEET = "Usuarios";
var PROC_SHEET = "Processos";
var HEADER_ROW = 1;
var SESS_DURATION_MS = 8 * 3600 * 1000;
var SESS_PREFIX = "lex_sess_";
var MAX_WRITE_ROWS = 3600;
var INDEX_SHEET = "__LEXIS_INDEX";

var USER_HEADERS = [
  "login", "nome", "senha", "perfil", "escritorio", "ativo", "email", "auth_user_id", "id"
];

var PROC_HEADERS = [
  "Protocolo", "Cliente", "Status", "Situacao", "UltimoRetorno", "ProximoRetorno",
  "Advogado", "Escritorio", "Tribunal", "Telefone", "CreatedBy", "AtendidoPor",
  "Observacao", "DatajudEncerrado", "EmpresaId", "isBaixaTribunal", "ultimo_movimento",
  "fase", "valor_causa", "updated_at", "Assistente", "Distribuicao", "Produtos",
  "Data_Movimentacao", "Andamento", "Evento_Tipo", "Novo_Andamento", "Busca_Apreensao",
  "Cumprimento", "DJEN_Resumo", "Dias_Sem_Retorno", "Procedente", "Improcedente"
];

var ACCESS = {
  operador: 10,
  assistente: 10,
  atendente: 10,
  responsavel: 10,
  administrador: 20,
  supervisor: 20,
  superadmin: 30
};

function getToken_() {
  try {
    var configured = PropertiesService.getScriptProperties().getProperty("LEXIS_SHEETS_TOKEN");
    if (configured && String(configured).trim()) return String(configured).trim();
  } catch (_) {}
  throw new Error("LEXIS_SHEETS_TOKEN ausente nas Script Properties.");
}

function norm(s) {
  return String(s == null ? "" : s)
    .replace(/[\s._-]+/g, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function digits(s) {
  return String(s == null ? "" : s).replace(/\D/g, "");
}

function hashSenha(s) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(s || ""),
    Utilities.Charset.UTF_8
  );
  return bytes.map(function (b) {
    var v = b < 0 ? b + 256 : b;
    var h = v.toString(16);
    return h.length === 1 ? "0" + h : h;
  }).join("");
}

function roleAccess(perfil) {
  var p = norm(perfil || "operador");
  return ACCESS[p] == null ? 10 : ACCESS[p];
}

function out_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonBody_(e) {
  try {
    return JSON.parse((e && e.postData && e.postData.contents) || "{}");
  } catch (_) {
    return {};
  }
}

function validToken_(body, e) {
  var expected = getToken_();
  var supplied = body && (body.token || body._token);
  if (!supplied && e && e.parameter) supplied = e.parameter.token;
  return String(supplied || "").trim() === expected;
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Léxis")
    .addItem("Garantir abas e cabeçalhos", "ensureSheetsUI")
    .addItem("Criar usuário (login/senha)", "uiCriarUsuario")
    .addItem("Listar usuários", "uiListarUsuarios")
    .addToUi();
}

function ensureSheetsUI() {
  ensureSheets_();
  SpreadsheetApp.getUi().alert("Abas Usuarios e Processos conferidas.");
}

function ensureSheets_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheetWithHeaders_(ss, USERS_SHEET, USER_HEADERS);
  ensureSheetWithHeaders_(ss, PROC_SHEET, PROC_HEADERS);
}

function ensureSheetWithHeaders_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  var currentCols = Math.max(1, sh.getLastColumn(), headers.length);
  var current = sh.getRange(HEADER_ROW, 1, 1, currentCols).getValues()[0].map(function (h) {
    return String(h || "").trim();
  });
  var empty = current.every(function (h) { return !h; });

  if (empty) {
    sh.getRange(HEADER_ROW, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    return;
  }

  headers.forEach(function (h) {
    var exists = current.some(function (c) { return norm(c) === norm(h); });
    if (!exists) {
      sh.getRange(HEADER_ROW, sh.getLastColumn() + 1).setValue(h);
      current.push(h);
    }
  });
}

function getProcSheet_() {
  ensureSheets_();
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PROC_SHEET);
  if (!sh) throw new Error("Aba Processos não encontrada.");
  return sh;
}

function getUsersSheet_() {
  ensureSheets_();
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USERS_SHEET);
  if (!sh) throw new Error("Aba Usuarios não encontrada.");
  return sh;
}

function headers_(sh) {
  var lastCol = Math.max(1, sh.getLastColumn());
  return sh.getRange(HEADER_ROW, 1, 1, lastCol).getValues()[0].map(function (h) {
    return String(h || "").trim();
  });
}

function headerMap_(headers) {
  var map = {};
  headers.forEach(function (h, i) { map[norm(h)] = i; });
  return map;
}

function findCol_(map, aliases) {
  for (var i = 0; i < aliases.length; i++) {
    var idx = map[norm(aliases[i])];
    if (idx != null) return idx;
  }
  return -1;
}

function valueForField_(record, header, dados) {
  var wanted = norm(header);
  var direct = Object.keys(record || {});
  for (var i = 0; i < direct.length; i++) {
    if (norm(direct[i]) === wanted) {
      var v = record[direct[i]];
      if (v !== undefined && v !== null && String(v) !== "") return v;
    }
  }

  // Mapas especiais escritos separadamente para evitar depender do nome exato da coluna.
  var special = {
    protocolo: ["protocolo", "protocolo_ref", "cnj", "processo", "numero"],
    cliente: ["cliente", "nome_cliente"],
    status: ["status", "status_executivo"],
    situacao: ["situacao", "status_interno", "statusManual"],
    ultimoretorno: ["UltimoRetorno", "ultimo_retorno", "ultimoRetorno", "Retorno", "RETORNO", "retorno", "ultimo_atendimento", "ultimoAtendimento", "data_retorno", "dataRetorno"],
    proximoretorno: ["ProximoRetorno", "proximo_retorno", "proximoRetorno", "proximoPrazo", "Prazo", "prazo", "proximo_atendimento", "data_prazo", "dataPrazo"],
    retorno: ["UltimoRetorno", "ultimo_retorno", "ultimoRetorno", "Retorno", "RETORNO", "retorno", "ultimo_atendimento", "data_retorno"],
    prazo: ["ProximoRetorno", "proximo_retorno", "proximoRetorno", "proximoPrazo", "Prazo", "prazo", "data_prazo"],
    advogado: ["advogado"],
    escritorio: ["escritorio"],
    tribunal: ["tribunal"],
    telefone: ["telefone", "phone", "celular", "whatsapp"],
    createdby: ["CreatedBy", "created_by", "createdBy", "criado_por", "Responsavel", "responsavel"],
    responsavel: ["CreatedBy", "created_by", "createdBy", "criado_por", "Responsavel", "responsavel"],
    atendidopor: ["AtendidoPor", "atendido_por", "atendidoPor", "Atendente", "atendente", "quem_atendeu"],
    atendente: ["AtendidoPor", "atendido_por", "atendidoPor", "Atendente", "atendente"],
    observacao: ["Observacao", "observacao", "observacoes"],
    empresaid: ["EmpresaId", "empresa_id", "empresaId"],
    datajudencerrado: ["DatajudEncerrado", "datajud_encerrado_tribunal"],
    isbaixatribunal: ["isBaixaTribunal", "is_baixa_tribunal"],
    ultimomovimento: ["ultimo_movimento", "datajud_ultimo_movimento", "ultimoMovimento"],
    valorcausa: ["valor_causa", "valorCausa"],
    eventotipo: ["evento_tipo", "Evento_Tipo", "eventotipo"],
    andamento: ["andamento", "Andamento", "ultimoAndamento"],
    updatedat: ["updated_at", "updatedAt", "editado_em", "edited_at"],
  };

  var list = special[wanted] || [];
  for (var j = 0; j < list.length; j++) {
    var key = list[j];
    if (record[key] !== undefined && record[key] !== null && String(record[key]) !== "") return record[key];
    var rKeys = Object.keys(record || {});
    for (var k = 0; k < rKeys.length; k++) {
      if (norm(rKeys[k]) === norm(key)) {
        var rv = record[rKeys[k]];
        if (rv !== undefined && rv !== null && String(rv) !== "") return rv;
      }
    }
  }

  var dkeys = Object.keys(dados || {});
  for (var d = 0; d < dkeys.length; d++) {
    if (norm(dkeys[d]) === wanted) {
      var dv = dados[dkeys[d]];
      if (dv !== undefined && dv !== null && String(dv) !== "") return dv;
    }
  }
  for (var s = 0; s < list.length; s++) {
    for (var d2 = 0; d2 < dkeys.length; d2++) {
      if (norm(dkeys[d2]) === norm(list[s])) {
        var sv = dados[dkeys[d2]];
        if (sv !== undefined && sv !== null && String(sv) !== "") return sv;
      }
    }
  }

  // Fallback semântico p/ cabeçalhos livres (ex.: "Data do retorno", "Retorno realizado",
  // "Próximo retorno") sem escrever em colunas de indicador (Dias_Sem_Retorno, status etc.).
  var recKeys2 = Object.keys(record || {});
  var pool = {};
  for (var i2 = 0; i2 < recKeys2.length; i2++) {
    var rv2 = record[recKeys2[i2]];
    if (rv2 !== undefined && rv2 !== null && String(rv2) !== "") pool[recKeys2[i2]] = rv2;
  }
  for (var i3 = 0; i3 < dkeys.length; i3++) {
    var dv3 = dados[dkeys[i3]];
    if (dv3 !== undefined && dv3 !== null && String(dv3) !== "" && pool[dkeys[i3]] == null) pool[dkeys[i3]] = dv3;
  }
  var tryKeys = function (cands) {
    for (var t = 0; t < cands.length; t++) {
      if (pool[cands[t]] !== undefined && pool[cands[t]] !== null && String(pool[cands[t]]) !== "") return pool[cands[t]];
      for (var t2 = 0; t2 < recKeys2.length; t2++) {
        if (norm(recKeys2[t2]) === norm(cands[t])) {
          var cv2 = pool[recKeys2[t2]];
          if (cv2 !== undefined && cv2 !== null && String(cv2) !== "") return cv2;
        }
      }
    }
    return undefined;
  };
  var isIndicator = function (w) {
    return /dias|sem|count|qtd|indicador|status|observ|nota|resumo|motivo|tipo|valor|link|hash|andamento|mov|evento|encerr|baixa|cumpriment/.test(w);
  };
  if (wanted.indexOf("retorno") >= 0 && wanted.indexOf("proximo") < 0 && wanted.indexOf("prazo") < 0 && !isIndicator(wanted)) {
    var vU = tryKeys(special.ultimoretorno || []);
    if (vU !== undefined) return vU;
  }
  if ((wanted.indexOf("prazo") >= 0 || wanted.indexOf("proximo") >= 0) && wanted.indexOf("ultimo") < 0 && !isIndicator(wanted)) {
    var vP = tryKeys(special.proximoretorno || []);
    if (vP !== undefined) return vP;
  }
  if ((wanted.indexOf("atendente") >= 0 || wanted.indexOf("atendido") >= 0) && !isIndicator(wanted)) {
    var vA = tryKeys(special.atendidopor || []);
    if (vA !== undefined) return vA;
  }
  if ((wanted.indexOf("responsavel") >= 0 || wanted.indexOf("criado") >= 0 || wanted.indexOf("created") >= 0 || wanted.indexOf("dono") >= 0) && !isIndicator(wanted)) {
    var vC = tryKeys(special.createdby || []);
    if (vC !== undefined) return vC;
  }

  return undefined;
}

function toCell_(v) {
  if (v === undefined || v === null) return "";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function protocolFromRecord_(r) {
  var d = r && r.dados && typeof r.dados === "object" ? r.dados : {};
  var p = r && (r.Protocolo || r.protocolo || r.protocolo_ref || r.cnj || r.processo);
  if (!p) p = d.Protocolo || d.protocolo || d.protocolo_ref || d.cnj || d.processo;
  return String(p || "").trim();
}

function readRows_(opts) {
  opts = opts || {};
  var sh = getProcSheet_();
  var headers = headers_(sh);
  var data = sh.getDataRange().getValues();
  var map = headerMap_(headers);
  var keyIdx = findCol_(map, ["Protocolo", "protocolo", "cnj", "processo", "numero"]);
  var ownerIdx = findCol_(map, ["Responsavel", "CreatedBy", "created_by", "criado_por"]);
  var user = norm(opts.responsavel || "");
  var isAdmin = !!opts.admin;

  var rows = [];
  for (var r = HEADER_ROW; r < data.length; r++) {
    var values = data[r];
    var has = values.some(function (v) { return String(v == null ? "" : v).trim() !== ""; });
    if (!has) continue;

    var owner = ownerIdx >= 0 ? String(values[ownerIdx] || "").trim() : "";
    if (user && !isAdmin && owner && norm(owner) !== user) continue;

    var obj = {};
    headers.forEach(function (h, i) { obj[h] = values[i]; });
    if (keyIdx >= 0) obj.Protocolo = values[keyIdx];
    rows.push(obj);
    if (opts.limit && rows.length >= Number(opts.limit)) break;
  }
  return { headers: headers, rows: rows };
}

function findRowMap_(sh, headers, data) {
  var map = headerMap_(headers);
  var keyIdx = findCol_(map, ["Protocolo", "protocolo", "cnj", "processo", "numero"]);
  if (keyIdx < 0) throw new Error("Aba Processos sem coluna Protocolo/CNJ.");
  var out = {};
  for (var r = HEADER_ROW; r < data.length; r++) {
    var key = digits(data[r][keyIdx]);
    if (key) out[key] = r + 1;
  }
  return { byProtocol: out, keyIdx: keyIdx };
}

function ensureIndexSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(INDEX_SHEET);
  if (!sh) {
    sh = ss.insertSheet(INDEX_SHEET);
    sh.getRange(1, 1, 1, 3).setValues([["protocolo_key", "sheet_row", "updated_at"]]);
    sh.hideSheet();
  }
  return sh;
}

function rebuildIndex_() {
  var proc = getProcSheet_();
  var idx = ensureIndexSheet_();
  var headers = headers_(proc);
  var hmap = headerMap_(headers);
  var keyIdx = findCol_(hmap, ["Protocolo", "protocolo", "cnj", "processo", "numero"]);
  if (keyIdx < 0) throw new Error("Aba Processos sem coluna Protocolo/CNJ.");
  var lastRow = proc.getLastRow();
  var out = [];
  if (lastRow >= HEADER_ROW + 1) {
    var values = proc.getRange(HEADER_ROW + 1, keyIdx + 1, lastRow - HEADER_ROW, 1).getValues();
    for (var i = 0; i < values.length; i++) {
      var key = digits(values[i][0]);
      if (key) out.push([key, i + HEADER_ROW + 1, new Date().toISOString()]);
    }
  }
  idx.clearContents();
  idx.getRange(1, 1, 1, 3).setValues([["protocolo_key", "sheet_row", "updated_at"]]);
  if (out.length) idx.getRange(2, 1, out.length, 3).setValues(out);
  return idx;
}

function loadIndex_() {
  var idx = ensureIndexSheet_();
  var last = idx.getLastRow();
  if (last < 2) {
    rebuildIndex_();
    last = idx.getLastRow();
  }
  var values = last >= 2 ? idx.getRange(2, 1, last - 1, 2).getValues() : [];
  var map = {};
  for (var i = 0; i < values.length; i++) {
    var key = String(values[i][0] || "").trim();
    var row = Number(values[i][1] || 0);
    if (key && row) map[key] = row;
  }
  return { sheet: idx, map: map };
}

function appendIndexRows_(idx, rows) {
  if (!rows.length) return;
  var start = idx.getLastRow() + 1;
  idx.getRange(start, 1, rows.length, 3).setValues(rows);
}

function writeRecords_(rows, actor, allowInsert) {
  if (!Array.isArray(rows)) rows = [];
  if (rows.length > MAX_WRITE_ROWS) throw new Error("Lote acima do limite de " + MAX_WRITE_ROWS + " linhas.");
  if (!rows.length) return { ok: true, updated: 0, added: 0, written: 0, rejected: [], rejected_count: 0 };

  var lock = LockService.getDocumentLock();
  lock.waitLock(5000);
  try {
    var sh = getProcSheet_();
    var headers = headers_(sh);
    var hmap = headerMap_(headers);
    var protoIdx = findCol_(hmap, ["Protocolo", "protocolo", "cnj", "processo", "numero"]);
    if (protoIdx < 0) throw new Error("coluna-chave (Protocolo/CNJ) não encontrada");

    var ownerIdx = findCol_(hmap, ["Responsavel", "CreatedBy", "created_by", "criado_por"]);
    var empresaIdx = findCol_(hmap, ["EmpresaId", "empresa_id", "empresaId"]);
    var updatedIdx = findCol_(hmap, ["updated_at", "updatedAt"]);
    var editedByIdx = findCol_(hmap, ["edited_by", "editado_por"]);
    var editedNameIdx = findCol_(hmap, ["edited_by_name", "editado_por_nome"]);
    var editedAtIdx = findCol_(hmap, ["edited_at", "editado_em"]);
    var createdIdx = findCol_(hmap, ["CreatedBy", "created_by", "createdBy", "criado_por"]);
    var isAdmin = roleAccess(actor && actor.perfil) >= 20;
    var me = norm(actor && (actor.u || actor.login || actor.nome) || "");
    var meName = norm(actor && actor.nome || "");
    var now = new Date().toISOString();
    var index = loadIndex_();
    var map = index.map;

    var touched = {};
    var appended = [];
    var indexAdds = [];
    var updates = 0;
    var added = 0;
    var rejected = [];

    // Lemos somente as linhas que realmente serão alteradas.
    var existingRows = [];
    rows.forEach(function(record) {
      var protocol = protocolFromRecord_(record || {});
      var key = digits(protocol);
      if (!key) { rejected.push({ protocolo: "", motivo: "sem Protocolo/CNJ" }); return; }
      var target = map[key] || 0;
      if (target) existingRows.push(target);
    });

    var currentByRow = {};
    if (existingRows.length) {
      var wantedRows = Array.from(new Set(existingRows)).sort(function(a, b) { return a - b; });
      var minRow = wantedRows[0];
      var maxRow = wantedRows[wantedRows.length - 1];
      // Uma única leitura quando o conjunto é relativamente compacto; isso é muito mais rápido
      // que dezenas/centenas de getRangeList em lotes de seed.
      if (maxRow - minRow <= 6000) {
        var block = sh.getRange(minRow, 1, maxRow - minRow + 1, headers.length).getValues();
        wantedRows.forEach(function(rowNum) { currentByRow[rowNum] = block[rowNum - minRow]; });
      } else {
        var addresses = wantedRows.map(function(r) { return r + ":" + r; });
        var ranges = sh.getRangeList(addresses).getRanges();
        for (var gr = 0; gr < ranges.length; gr++) currentByRow[wantedRows[gr]] = ranges[gr].getValues()[0];
      }
    }

    var nextRow = Math.max(sh.getLastRow() + 1, HEADER_ROW + 1);
    rows.forEach(function(record) {
      record = record || {};
      var protocol = protocolFromRecord_(record);
      var pkey = digits(protocol);
      if (!pkey) return;

      var targetRow = map[pkey] || 0;
      var current;
      if (targetRow) {
        current = currentByRow[targetRow].slice();
        if (ownerIdx >= 0 && !isAdmin) {
          var owner = norm(current[ownerIdx] || "");
          if (owner && owner !== me && owner !== meName) {
            rejected.push({ protocolo: protocol, motivo: "processo de outro responsável" });
            return;
          }
        }
      } else {
        if (!allowInsert) { rejected.push({ protocolo: protocol, motivo: "processo não encontrado" }); return; }
        targetRow = nextRow++;
        current = new Array(headers.length).fill("");
        if (ownerIdx >= 0 && actor && actor.u) current[ownerIdx] = actor.u;
        map[pkey] = targetRow;
        added++;
      }

      var dados = record.dados && typeof record.dados === "object" ? record.dados : {};
      headers.forEach(function(header, i) {
        var value = valueForField_(record, header, dados);
        // NUNCA apaga valor antigo porque uma coluna não veio no payload.
        if (value === undefined || value === null || String(value) === "") return;
        current[i] = toCell_(value);
      });
      current[protoIdx] = protocol;
      if (createdIdx >= 0 && !current[createdIdx] && actor && actor.u) current[createdIdx] = actor.u;
      if (empresaIdx >= 0 && record.empresa_id) current[empresaIdx] = String(record.empresa_id);
      if (updatedIdx >= 0) current[updatedIdx] = now;
      if (editedByIdx >= 0 && actor && actor.u) current[editedByIdx] = actor.u;
      if (editedNameIdx >= 0 && actor) current[editedNameIdx] = actor.nome || actor.u || "";
      if (editedAtIdx >= 0) current[editedAtIdx] = now;

      touched[targetRow] = current;
      if (!index.sheet) return;
      if (!existingRows.includes(targetRow)) indexAdds.push([pkey, targetRow, now]);
      updates++;
    });

    var rowNums = Object.keys(touched).map(Number).sort(function(a,b){ return a-b; });
    if (rowNums.length) {
      var runStart = rowNums[0], runEnd = rowNums[0];
      for (var x = 1; x < rowNums.length; x++) {
        if (rowNums[x] === runEnd + 1) { runEnd = rowNums[x]; continue; }
        var block = [];
        for (var rr = runStart; rr <= runEnd; rr++) block.push(touched[rr]);
        sh.getRange(runStart, 1, block.length, headers.length).setValues(block);
        runStart = runEnd = rowNums[x];
      }
      var lastBlock = [];
      for (var rr2 = runStart; rr2 <= runEnd; rr2++) lastBlock.push(touched[rr2]);
      sh.getRange(runStart, 1, lastBlock.length, headers.length).setValues(lastBlock);
    }

    appendIndexRows_(index.sheet, indexAdds);
    SpreadsheetApp.flush();
    var written = updates - rejected.length;
    return {
      ok: true,
      updated: updates,
      added: added,
      written: written,
      rejected: rejected,
      rejected_count: rejected.length
    };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function upsertBatch_(body) {
  var input = Array.isArray(body.rows) ? body.rows : [];
  var unique = {};
  var rows = [];
  input.forEach(function (record) {
    var protocol = protocolFromRecord_(record || "");
    var key = digits(protocol) || String(protocol || "").trim();
    if (!key || unique[key]) return;
    unique[key] = true;
    rows.push(record);
  });
  var actor = {
    u: String(body.actor || body.actor_login || body.user || "sync"),
    nome: String(body.actor_name || "LexisPredict"),
    perfil: String(body.perfil || "superadmin")
  };
  return writeRecords_(rows, actor, true);
}

function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    var action = String(p.action || "").trim();
    if (action === "ping" || p.ping === "1" || p.ping === "true") {
      if (p.token && String(p.token).trim() !== getToken_()) return out_({ ok: false, error: "token invalido" });
      return out_({ ok: true, pong: true, v: "7.0", via: "GET" });
    }
    if (action === "list" || action === "get") {
      if (!validToken_(p, e)) return out_({ ok: false, error: "token invalido" });
      var all = readRows_({ limit: p.limit || 8000 });
      if (action === "get") {
        var target = digits(p.protocolo || p.cnj || "");
        var found = all.rows.find(function (r) {
          return digits(r.Protocolo || r.protocolo || r.protocolo_ref || r.CNJ || "") === target;
        });
        return out_({ ok: true, row: found || null, data: found ? [found] : [] });
      }
      return out_({ ok: true, rows: all.rows, headers: all.headers, data: all.rows, count: all.rows.length });
    }
    return out_({ ok: true, app: "lexis-gabinete-sync", v: "7.0", ts: new Date().toISOString() });
  } catch (err) {
    return out_({ ok: false, error: String(err).slice(0, 500) });
  }
}

function doPost(e) {
  try {
    var body = jsonBody_(e);
    if (!validToken_(body, e)) return out_({ ok: false, error: "token invalido" });
    var action = String(body.action || "").trim();

    if (action === "ping") return out_({ ok: true, pong: true, v: "7.0" });
    if (action === "auth" || action === "login") return out_(doAuth_(body));
    if (action === "auto") {
      var vsAuto = validSess_(body.sess);
      if (vsAuto.err) return out_({ ok: false, error: vsAuto.err });
      return out_({ ok: true, user: publicUser_(vsAuto.us) });
    }
    if (action === "list") {
      return out_(listAction_(body));
    }
    if (action === "get") {
      var rows = readRows_({ limit: 8000 }).rows;
      var target = digits(body.protocolo || body.cnj || "");
      var found = rows.find(function (r) { return digits(r.Protocolo || r.protocolo || r.protocolo_ref || "") === target; });
      return out_({ ok: true, row: found || null, data: found ? [found] : [] });
    }
    if (action === "write") {
      var sess = validSess_(body.sess);
      var actor = sess.err ? {
        u: String(body.actor || "api"), nome: String(body.actor_name || "LexisPredict"), perfil: "superadmin"
      } : sess.us;
      if (sess.err && !body.actor) return out_({ ok: false, error: sess.err });
      return out_(writeRecords_(body.rows || [], actor, true));
    }
    if (action === "upsert_batch") {
      return out_(upsertBatch_(body));
    }
    if (action === "users" || action === "list_users") {
      var vu = validSess_(body.sess);
      if (vu.err) return out_({ ok: false, error: vu.err });
      if (roleAccess(vu.us.perfil) < 20) return out_({ ok: false, error: "sem permissao (supervisor+)" });
      return out_(listUsers_());
    }
    if (action === "user_create" || action === "create_user") {
      var vc = validSess_(body.sess);
      if (vc.err) return out_({ ok: false, error: vc.err });
      if (roleAccess(vc.us.perfil) < 20) return out_({ ok: false, error: "sem permissao (supervisor+)" });
      return out_(criarUsuarioServer_(body, roleAccess(vc.us.perfil)));
    }
    if (action === "user_set") {
      var vs = validSess_(body.sess);
      if (vs.err) return out_({ ok: false, error: vs.err });
      if (roleAccess(vs.us.perfil) < 20) return out_({ ok: false, error: "sem permissao (supervisor+)" });
      return out_(setUsuarioServer_(body, vs.us.u, roleAccess(vs.us.perfil)));
    }
    if (action === "hash") return out_({ ok: true, hash: hashSenha(body.senha) });

    return out_({ ok: false, error: "acao desconhecida: " + action });
  } catch (err) {
    return out_({ ok: false, error: String(err).slice(0, 700) });
  }
}

function publicUser_(us) {
  return {
    usuario: us.u,
    nome: us.nome,
    perfil: us.perfil,
    escritorio: us.escritorio,
    access: roleAccess(us.perfil)
  };
}

function listAction_(body) {
  var sh = getProcSheet_();
  var all = readRows_({ limit: Math.min(Number(body.limit || 8000), 8000) });
  var vs = body.sess ? validSess_(body.sess) : { err: null, us: null };
  var isAdmin = !vs.us || roleAccess(vs.us.perfil) >= 20;
  var user = vs.us;
  var rows = all.rows;
  if (body.responsavel && !isAdmin) {
    var owner = norm(body.responsavel);
    rows = rows.filter(function (r) {
      return norm(r.Responsavel || r.CreatedBy || r.created_by || r.responsavel || "") === owner;
    });
  }
  return {
    ok: true,
    rows: rows,
    todas: all.rows,
    minhas: rows,
    headers: all.headers,
    count: rows.length,
    user: user ? publicUser_(user) : null,
    v: "7.0"
  };
}

function uiCriarUsuario() {
  var ui = SpreadsheetApp.getUi();
  var r1 = ui.prompt("Criar usuário", "login", ui.ButtonSet.OK_CANCEL);
  if (r1.getSelectedButton() !== ui.Button.OK) return;
  var login = norm(r1.getResponseText());
  var r2 = ui.prompt("Criar usuário", "nome completo", ui.ButtonSet.OK_CANCEL);
  if (r2.getSelectedButton() !== ui.Button.OK) return;
  var r3 = ui.prompt("Criar usuário", "senha", ui.ButtonSet.OK_CANCEL);
  if (r3.getSelectedButton() !== ui.Button.OK) return;
  var r4 = ui.prompt("Criar usuário", "perfil", ui.ButtonSet.OK_CANCEL);
  if (r4.getSelectedButton() !== ui.Button.OK) return;
  ui.alert(JSON.stringify(criarUsuario_(login, r2.getResponseText(), r3.getResponseText(), r4.getResponseText(), "")));
}

function uiListarUsuarios() {
  var users = listUsers_().users || [];
  SpreadsheetApp.getUi().alert(users.map(function (u) {
    return u.login + " | " + u.nome + " | " + u.perfil + " | " + u.escritorio + " | " + u.ativo;
  }).join("\n") || "(nenhum)");
}

function criarUsuario_(login, nome, senha, perfil, escritorio) {
  var sh = getUsersSheet_();
  var headers = headers_(sh);
  var map = headerMap_(headers);
  var cL = findCol_(map, ["login", "usuario"]);
  var cN = findCol_(map, ["nome"]);
  var cS = findCol_(map, ["senha"]);
  var cP = findCol_(map, ["perfil", "perfilacesso"]);
  var cE = findCol_(map, ["escritorio", "unidade"]);
  var cA = findCol_(map, ["ativo"]);
  if (cL < 0 || cS < 0) return { ok: false, error: "Usuarios precisa de login e senha" };
  var data = sh.getDataRange().getValues();
  for (var i = HEADER_ROW; i < data.length; i++) {
    if (norm(data[i][cL]) === norm(login)) return { ok: false, error: "login ja existe" };
  }
  var row = new Array(headers.length).fill("");
  row[cL] = login;
  if (cN >= 0) row[cN] = nome;
  row[cS] = hashSenha(senha);
  if (cP >= 0) row[cP] = perfil || "operador";
  if (cE >= 0) row[cE] = escritorio || "";
  if (cA >= 0) row[cA] = "sim";
  sh.getRange(sh.getLastRow() + 1, 1, 1, headers.length).setValues([row]);
  return { ok: true, login: login };
}

function doAuth_(body) {
  var login = norm(body.usuario || body.login || body.email);
  var pass = String(body.senha || "");
  if (!login || !pass) return { ok: false, error: "informe usuario e senha" };

  var sh = getUsersSheet_();
  var headers = headers_(sh);
  var map = headerMap_(headers);
  var cL = findCol_(map, ["login", "usuario"]);
  var cEml = findCol_(map, ["email", "e-mail", "mail"]);
  var cN = findCol_(map, ["nome"]);
  var cS = findCol_(map, ["senha"]);
  var cP = findCol_(map, ["perfil", "perfilacesso"]);
  var cE = findCol_(map, ["escritorio", "unidade"]);
  var cA = findCol_(map, ["ativo"]);
  if (cL < 0 || cS < 0) return { ok: false, error: "Usuarios precisa de login e senha" };

  var data = sh.getDataRange().getValues();
  var found = null;
  var emailInput = String(body.usuario || body.login || "").indexOf("@") >= 0;
  for (var i = HEADER_ROW; i < data.length; i++) {
    var v = data[i];
    var match = norm(v[cL]) === login;
    if (!match && emailInput && cEml >= 0) match = String(v[cEml] || "").trim().toLowerCase() === String(body.usuario || body.login || "").trim().toLowerCase();
    if (!match) continue;
    if (cA >= 0) {
      var ativo = norm(v[cA]);
      if (ativo === "nao" || ativo === "false" || ativo === "0" || ativo === "inativo") return { ok: false, error: "usuario inativo" };
    }
    found = v;
    break;
  }
  if (!found) return { ok: false, error: "usuario ou senha invalidos" };
  if (hashSenha(pass) !== String(found[cS] || "")) return { ok: false, error: "usuario ou senha invalidos" };

  var token = Utilities.getUuid() + Utilities.getUuid();
  var sess = {
    u: String(found[cL] || login),
    nome: String(found[cN >= 0 ? cN : 0] || login),
    perfil: String(found[cP >= 0 ? cP : 0] || "operador"),
    escritorio: String(found[cE >= 0 ? cE : 0] || ""),
    exp: Date.now() + SESS_DURATION_MS
  };
  PropertiesService.getScriptProperties().setProperty(SESS_PREFIX + token, JSON.stringify(sess));
  pruneSessions_();
  return { ok: true, token: token, user: publicUser_(sess) };
}

function getSess_(token) {
  if (!token) return null;
  var raw = PropertiesService.getScriptProperties().getProperty(SESS_PREFIX + String(token));
  if (!raw) return null;
  try {
    var s = JSON.parse(raw);
    if (s && s.exp > Date.now()) return s;
  } catch (_) {}
  try { PropertiesService.getScriptProperties().deleteProperty(SESS_PREFIX + String(token)); } catch (_) {}
  return null;
}

function touchSess_(token) {
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty(SESS_PREFIX + String(token));
  if (!raw) return;
  try {
    var s = JSON.parse(raw);
    s.exp = Date.now() + SESS_DURATION_MS;
    props.setProperty(SESS_PREFIX + String(token), JSON.stringify(s));
  } catch (_) {}
}

function pruneSessions_() {
  var props = PropertiesService.getScriptProperties();
  var keys = props.getKeys();
  var now = Date.now();
  keys.forEach(function (k) {
    if (k.indexOf(SESS_PREFIX) !== 0) return;
    try {
      var s = JSON.parse(props.getProperty(k));
      if (!s || s.exp <= now) props.deleteProperty(k);
    } catch (_) {}
  });
}

function validSess_(token) {
  var us = getSess_(token);
  if (!us) return { err: "sessao invalida ou expirada" };
  touchSess_(token);
  return { us: us };
}

function listUsers_() {
  var sh = getUsersSheet_();
  var headers = headers_(sh);
  var map = headerMap_(headers);
  var cL = findCol_(map, ["login", "usuario"]);
  var cN = findCol_(map, ["nome"]);
  var cP = findCol_(map, ["perfil", "perfilacesso"]);
  var cE = findCol_(map, ["escritorio", "unidade"]);
  var cA = findCol_(map, ["ativo"]);
  var data = sh.getDataRange().getValues();
  var users = [];
  for (var i = HEADER_ROW; i < data.length; i++) {
    var v = data[i];
    var login = String(v[cL] || "").trim();
    if (!login) continue;
    users.push({
      login: login,
      nome: String(cN >= 0 ? v[cN] || "" : ""),
      perfil: String(cP >= 0 ? v[cP] || "" : "operador"),
      escritorio: String(cE >= 0 ? v[cE] || "" : ""),
      ativo: String(cA >= 0 ? v[cA] || "sim" : "sim")
    });
  }
  return { ok: true, users: users };
}

function criarUsuarioServer_(body, callerAccess) {
  if (roleAccess(body.perfil || "operador") > callerAccess) return { ok: false, error: "perfil acima da sua permissao" };
  return criarUsuario_(norm(body.login || body.usuario), String(body.nome || ""), String(body.senha || ""), String(body.perfil || "operador"), String(body.escritorio || ""));
}

function setUsuarioServer_(body, callerLogin, callerAccess) {
  var login = norm(body.login || body.usuario);
  if (!login) return { ok: false, error: "login vazio" };
  var sh = getUsersSheet_();
  var headers = headers_(sh);
  var map = headerMap_(headers);
  var cL = findCol_(map, ["login", "usuario"]);
  var cN = findCol_(map, ["nome"]);
  var cP = findCol_(map, ["perfil", "perfilacesso"]);
  var cE = findCol_(map, ["escritorio", "unidade"]);
  var cA = findCol_(map, ["ativo"]);
  var data = sh.getDataRange().getValues();
  var row = -1;
  for (var i = HEADER_ROW; i < data.length; i++) {
    if (norm(data[i][cL]) === login) { row = i + 1; break; }
  }
  if (row < 0) return { ok: false, error: "usuario nao encontrado" };
  if (body.perfil && roleAccess(body.perfil) > callerAccess) return { ok: false, error: "perfil acima da sua permissao" };
  if (body.nome !== undefined && cN >= 0) sh.getRange(row, cN + 1).setValue(String(body.nome));
  if (body.perfil && cP >= 0) sh.getRange(row, cP + 1).setValue(String(body.perfil));
  if (body.escritorio !== undefined && cE >= 0) sh.getRange(row, cE + 1).setValue(String(body.escritorio));
  if (body.ativo === "sim" || body.ativo === "nao") {
    if (login === callerLogin && body.ativo === "nao") return { ok: false, error: "voce nao pode banir a si mesmo" };
    if (cA >= 0) sh.getRange(row, cA + 1).setValue(body.ativo);
  }
  return { ok: true, login: login };
}

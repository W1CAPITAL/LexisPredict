/**
 * LEXIS HÍBRIDO — Apps Script completo (doGet + doPost)
 * Planilha = carteira operacional. Supabase = login/empresa.
 *
 * DEPLOY: Implantar → Web App → Eu → Qualquer pessoa → Nova versão → URL /exec
 * TOKEN deve bater com LEXIS_SHEETS_TOKEN no Vercel.
 */

var TOKEN = "w1-fase1-2026";
var PROC_SHEET = "Processos";
var HEADER_ROW = 1;

var PROC_HEADERS = [
  "Protocolo", "Cliente", "Status", "Situacao", "UltimoRetorno", "ProximoRetorno",
  "Advogado", "Escritorio", "Tribunal", "Telefone", "CreatedBy", "AtendidoPor",
  "Responsavel", "Observacao", "EmpresaId", "ultimo_movimento", "DJEN_Resumo",
  "DatajudEncerrado", "Cumprimento", "updated_at"
];

function doGet(e) {
  return respond_(route_(e && e.parameter ? e.parameter : {}));
}

function doPost(e) {
  var body = {};
  try {
    var raw = (e.postData && e.postData.contents) || "{}";
    body = JSON.parse(raw);
  } catch (err) {
    body = (e && e.parameter) || {};
  }
  // merge query params
  if (e && e.parameter) {
    for (var k in e.parameter) {
      if (body[k] === undefined) body[k] = e.parameter[k];
    }
  }
  return respond_(route_(body));
}

function respond_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function norm_(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

function ensureSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(PROC_SHEET);
  if (!sh) {
    sh = ss.insertSheet(PROC_SHEET);
    sh.getRange(1, 1, 1, PROC_HEADERS.length).setValues([PROC_HEADERS]);
  }
  var lastCol = Math.max(sh.getLastColumn(), PROC_HEADERS.length);
  var headers = sh.getRange(HEADER_ROW, 1, 1, lastCol).getValues()[0];
  if (!headers[0] || String(headers[0]).trim() === "") {
    sh.getRange(1, 1, 1, PROC_HEADERS.length).setValues([PROC_HEADERS]);
    headers = PROC_HEADERS.slice();
  }
  return { sh: sh, headers: headers };
}

function route_(p) {
  if (String(p.token || "") !== TOKEN) {
    return { ok: false, error: "token inválido" };
  }
  var action = String(p.action || "ping").toLowerCase();
  if (action === "ping") {
    return { ok: true, app: "lexis-gabinete-sync", ts: new Date().toISOString() };
  }
  if (action === "list") {
    return list_(p);
  }
  if (action === "write") {
    return write_(p);
  }
  return { ok: false, error: "action desconhecida: " + action };
}

function list_(p) {
  var pack = ensureSheet_();
  var sh = pack.sh;
  var headers = pack.headers;
  var lastRow = sh.getLastRow();
  if (lastRow <= HEADER_ROW) return { ok: true, rows: [], count: 0 };

  var data = sh.getRange(HEADER_ROW + 1, 1, lastRow, headers.length).getValues();
  var respFilter = String(p.responsavel || "").trim().toLowerCase();
  var empFilter = String(p.empresaId || p.empresa_id || "").trim();
  var limit = Math.min(Number(p.limit) || 5000, 10000);
  var rows = [];

  for (var i = 0; i < data.length && rows.length < limit; i++) {
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      obj[headers[c]] = data[i][c];
    }
    var proto = String(obj.Protocolo || obj.protocolo || "").trim();
    if (!proto) continue;
    if (respFilter) {
      var owner = String(obj.Responsavel || obj.CreatedBy || obj.created_by || "").toLowerCase();
      if (owner && owner !== respFilter) continue;
    }
    if (empFilter) {
      var emp = String(obj.EmpresaId || obj.empresa_id || "");
      if (emp && emp !== empFilter) continue;
    }
    rows.push(obj);
  }
  return { ok: true, rows: rows, count: rows.length };
}

function write_(p) {
  var pack = ensureSheet_();
  var sh = pack.sh;
  var headers = pack.headers.map(String);

  var rowsIn = p.rows;
  if (typeof rowsIn === "string") {
    try {
      rowsIn = JSON.parse(rowsIn);
    } catch (e) {
      return { ok: false, error: "rows JSON inválido" };
    }
  }
  if (!Array.isArray(rowsIn)) rowsIn = [p];

  // index protocolo → row number
  var lastRow = sh.getLastRow();
  var map = {};
  var keyIdx = -1;
  for (var h = 0; h < headers.length; h++) {
    if (/protocolo/i.test(norm_(headers[h]))) {
      keyIdx = h;
      break;
    }
  }
  if (keyIdx < 0) keyIdx = 0;

  if (lastRow > HEADER_ROW) {
    var col = sh.getRange(HEADER_ROW + 1, keyIdx + 1, lastRow, keyIdx + 1).getValues();
    for (var r = 0; r < col.length; r++) {
      var dig = String(col[r][0] || "").replace(/\D/g, "");
      if (dig) map[dig] = HEADER_ROW + 1 + r;
    }
  }

  var updated = 0;
  var inserted = 0;

  for (var i = 0; i < rowsIn.length; i++) {
    var rec = rowsIn[i] || {};
    var proto = String(rec.Protocolo || rec.protocolo || "").trim();
    var dig = proto.replace(/\D/g, "");
    if (!dig) continue;

    var rowObj = {};
    for (var k in rec) {
      if (Object.prototype.hasOwnProperty.call(rec, k)) rowObj[k] = rec[k];
    }

    if (map[dig]) {
      var rowNum = map[dig];
      var current = sh.getRange(rowNum, 1, rowNum, headers.length).getValues()[0];
      for (var c = 0; c < headers.length; c++) {
        var hk = headers[c];
        var nk = norm_(hk);
        for (var key in rowObj) {
          if (norm_(key) === nk) {
            var val = rowObj[key];
            if (val !== undefined && val !== null && String(val) !== "") current[c] = val;
          }
        }
      }
      sh.getRange(rowNum, 1, rowNum, headers.length).setValues([current]);
      updated++;
    } else {
      var line = headers.map(function (hk) {
        var nk = norm_(hk);
        for (var key in rowObj) {
          if (norm_(key) === nk) return rowObj[key];
        }
        if (/protocolo/.test(nk)) return proto;
        return "";
      });
      sh.appendRow(line);
      map[dig] = sh.getLastRow();
      inserted++;
    }
  }

  return { ok: true, updated: updated, inserted: inserted, total: rowsIn.length };
}

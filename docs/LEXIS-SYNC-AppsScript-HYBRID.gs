/**
 * LEXIS HÍBRIDO — cabeçalho alinhado ao CSV W1 Processos
 */
var TOKEN = "w1-fase1-2026";
var PROC_SHEET = "Processos";
var HEADER_ROW = 1;
var PROC_HEADERS = [
  "Protocolo","Cliente","Status","Situacao","UltimoRetorno","ProximoRetorno",
  "Advogado","Escritorio","Tribunal","Telefone","CreatedBy","AtendidoPor",
  "Observacao","DatajudEncerrado","EmpresaId","isBaixaTribunal","ultimo_movimento",
  "fase","valor_causa","updated_at","Assistente","Distribuicao","Produtos",
  "Data_Movimentacao","Andamento","Evento_Tipo","Novo_Andamento","Busca_Apreensao",
  "Cumprimento","DJEN_Resumo","Dias_Sem_Retorno","Procedente","Improcedente","Responsavel"
];

function doGet(e) { return respond_(route_(e && e.parameter ? e.parameter : {})); }
function doPost(e) {
  var body = {};
  try { body = JSON.parse((e.postData && e.postData.contents) || "{}"); } catch (err) { body = {}; }
  if (e && e.parameter) for (var k in e.parameter) if (body[k] === undefined) body[k] = e.parameter[k];
  return respond_(route_(body));
}
function respond_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function norm_(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "");
}
function ensureSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(PROC_SHEET);
  if (!sh) {
    sh = ss.insertSheet(PROC_SHEET);
    sh.getRange(1, 1, 1, PROC_HEADERS.length).setValues([PROC_HEADERS]);
  }
  var lastCol = Math.max(sh.getLastColumn(), 1);
  var headers = sh.getRange(HEADER_ROW, 1, 1, lastCol).getValues()[0];
  if (!headers[0] || String(headers[0]).trim() === "") {
    sh.getRange(1, 1, 1, PROC_HEADERS.length).setValues([PROC_HEADERS]);
    headers = PROC_HEADERS.slice();
  }
  return { sh: sh, headers: headers };
}
function route_(p) {
  if (String(p.token || "") !== TOKEN) return { ok: false, error: "token inválido" };
  var action = String(p.action || "ping").toLowerCase();
  if (action === "ping") return { ok: true, app: "lexis-gabinete-sync", ts: new Date().toISOString() };
  if (action === "list") return list_(p);
  if (action === "write") return write_(p);
  return { ok: false, error: "action: " + action };
}
function list_(p) {
  var pack = ensureSheet_();
  var sh = pack.sh, headers = pack.headers;
  var lastRow = sh.getLastRow();
  if (lastRow <= HEADER_ROW) return { ok: true, rows: [], count: 0 };
  var data = sh.getRange(HEADER_ROW + 1, 1, lastRow, headers.length).getValues();
  var respFilter = String(p.responsavel || "").trim().toLowerCase();
  var empFilter = String(p.empresaId || p.empresa_id || "").trim();
  var limit = Math.min(Number(p.limit) || 5000, 10000);
  var rows = [];
  for (var i = 0; i < data.length && rows.length < limit; i++) {
    var obj = {};
    for (var c = 0; c < headers.length; c++) obj[headers[c]] = data[i][c];
    var proto = String(obj.Protocolo || obj.protocolo || "").trim();
    if (!proto) continue;
    if (respFilter) {
      var owner = String(obj.Responsavel || obj.CreatedBy || "").toLowerCase();
      if (owner && owner !== respFilter) continue;
    }
    if (empFilter) {
      var emp = String(obj.EmpresaId || "");
      if (emp && emp !== empFilter) continue;
    }
    rows.push(obj);
  }
  return { ok: true, rows: rows, count: rows.length };
}
function write_(p) {
  var pack = ensureSheet_();
  var sh = pack.sh, headers = pack.headers.map(String);
  var rowsIn = p.rows;
  if (typeof rowsIn === "string") { try { rowsIn = JSON.parse(rowsIn); } catch (e) { return { ok: false, error: "rows JSON" }; } }
  if (!Array.isArray(rowsIn)) rowsIn = [p];
  var lastRow = sh.getLastRow();
  var map = {};
  var keyIdx = 0;
  for (var h = 0; h < headers.length; h++) if (/protocolo/i.test(norm_(headers[h]))) { keyIdx = h; break; }
  if (lastRow > HEADER_ROW) {
    var col = sh.getRange(HEADER_ROW + 1, keyIdx + 1, lastRow, keyIdx + 1).getValues();
    for (var r = 0; r < col.length; r++) {
      var dig = String(col[r][0] || "").replace(/\D/g, "");
      if (dig) map[dig] = HEADER_ROW + 1 + r;
    }
  }
  var updated = 0, inserted = 0;
  for (var i = 0; i < rowsIn.length; i++) {
    var rec = rowsIn[i] || {};
    var proto = String(rec.Protocolo || rec.protocolo || "").trim();
    var dig = proto.replace(/\D/g, "");
    if (!dig) continue;
    if (map[dig]) {
      var rowNum = map[dig];
      var current = sh.getRange(rowNum, 1, rowNum, headers.length).getValues()[0];
      for (var c = 0; c < headers.length; c++) {
        var nk = norm_(headers[c]);
        for (var key in rec) {
          if (norm_(key) === nk && rec[key] !== undefined && rec[key] !== null && String(rec[key]) !== "")
            current[c] = rec[key];
        }
      }
      sh.getRange(rowNum, 1, rowNum, headers.length).setValues([current]);
      updated++;
    } else {
      var line = headers.map(function (hk) {
        var nk = norm_(hk);
        for (var key in rec) if (norm_(key) === nk) return rec[key];
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

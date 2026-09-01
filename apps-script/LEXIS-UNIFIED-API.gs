/**
 * LEXIS UNIFIED API — Apps Script (login + sync 2 vias + leads)
 * ============================================================
 * Deploy: Extensões → Apps Script → colar → Implantar → App da web
 *   Executar como: Eu | Quem tem acesso: Qualquer pessoa → Nova versão
 * URL /exec → colar no Lexis em /setup-planilha
 *
 * Abas: Usuarios | Processos | Leads | Clientes | Config
 * TOKEN abaixo = LEADCHECK/LEXIS token do app
 */

var TOKEN = "w1-fase1-2026";
var USERS_SHEET = "Usuarios";
var PROC_SHEET = "Processos";
var LEADS_SHEET = "Leads";
var CLIENTS_SHEET = "Clientes";
var HEADER_ROW = 1;
var SESSION_HOURS = 12;

var USER_HEADERS = ["login", "nome", "senha", "perfil", "escritorio", "ativo", "email", "auth_user_id", "id"];
var PROC_HEADERS = [
  "Id", "Protocolo", "Cliente", "Status", "Situacao", "UltimoRetorno", "ProximoRetorno",
  "Advogado", "Escritorio", "Tribunal", "Telefone", "CreatedBy", "Responsavel", "AtendidoPor",
  "Observacao", "EmpresaId", "updated_at", "version", "Assistente", "Produtos"
];
var LEAD_HEADERS = [
  "Id", "CriadoEm", "AtualizadoEm", "Fonte", "Status", "Consentimento",
  "Nome", "WhatsApp", "Telefone", "Email", "CPF", "Interesse", "Placa",
  "Parcela", "Score", "Tier", "Responsavel", "Tags"
];
var CLIENT_HEADERS = ["Id", "Nome", "Telefone", "CPF", "Email", "Status", "updated_at", "version"];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Léxis")
    .addItem("Garantir abas e cabeçalhos", "ensureAllSheets")
    .addItem("Criar usuário", "uiCriarUsuario")
    .addItem("Listar usuários", "uiListarUsuarios")
    .addToUi();
}

function ensureAllSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, USERS_SHEET, USER_HEADERS);
  ensureSheet_(ss, PROC_SHEET, PROC_HEADERS);
  ensureSheet_(ss, LEADS_SHEET, LEAD_HEADERS);
  ensureSheet_(ss, CLIENTS_SHEET, CLIENT_HEADERS);
  SpreadsheetApp.getUi().alert("Abas OK: Usuarios, Processos, Leads, Clientes");
}

function ensureSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  var lastCol = Math.max(sh.getLastColumn(), 1);
  var existing = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) {
    return String(h || "").trim();
  });
  if (existing.every(function (h) { return !h; })) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  } else {
    headers.forEach(function (h) {
      if (existing.indexOf(h) < 0) {
        sh.getRange(1, sh.getLastColumn() + 1).setValue(h);
        existing.push(h);
      }
    });
  }
  return sh;
}

function sha256_(text) {
  var raw = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(text || ""),
    Utilities.Charset.UTF_8
  );
  return raw.map(function (b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? "0" + v : v;
  }).join("");
}

function norm(s) {
  return String(s || "")
    .replace(/[\s._-]+/g, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function doGet(e) {
  return out({
    ok: true,
    pong: true,
    app: "lexis-unified-api",
    v: "1.0",
    actions: ["ping", "auth", "list", "write", "health"],
  });
}

function doPost(e) {
  try {
    var body = JSON.parse((e.postData && e.postData.contents) || "{}");
    if (!body || body.token !== TOKEN) return out({ ok: false, error: "token invalido" });

    var action = String(body.action || body.op || "").toLowerCase();
    if (body.ping === true || action === "ping" || action === "health") {
      return out({ ok: true, pong: true, app: "lexis-unified-api", v: "1.0", serverTime: new Date().toISOString() });
    }
    if (action === "auth" || action === "login") return out(doAuth_(body));
    if (action === "list") return out(doList_(body));
    if (action === "write") return out(doWrite_(body));
    return out({ ok: false, error: "acao desconhecida: " + action });
  } catch (err) {
    return out({ ok: false, error: String(err.message || err).slice(0, 400) });
  }
}

function doAuth_(body) {
  var login = String(body.login || body.user || body.email || "").trim();
  var senha = String(body.password || body.senha || "");
  if (!login || !senha) return { ok: false, error: "login/senha obrigatorios" };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ensureSheet_(ss, USERS_SHEET, USER_HEADERS);
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return { ok: false, error: "nenhum usuario — use menu Lexis > Criar usuario" };

  var headers = data[0].map(function (h) { return norm(h); });
  var iLogin = headers.indexOf("login");
  var iNome = headers.indexOf("nome");
  var iSenha = headers.indexOf("senha");
  var iPerfil = headers.indexOf("perfil");
  var iAtivo = headers.indexOf("ativo");
  var iEmail = headers.indexOf("email");
  var iId = headers.indexOf("id");
  if (iLogin < 0 || iSenha < 0) return { ok: false, error: "aba Usuarios incompleta" };

  var hash = sha256_(senha);
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    if (String(row[iLogin] || "").trim().toLowerCase() !== login.toLowerCase()) continue;
    var ativo = iAtivo >= 0 ? String(row[iAtivo] || "sim").toLowerCase() : "sim";
    if (ativo === "nao" || ativo === "false" || ativo === "0") {
      return { ok: false, error: "usuario inativo" };
    }
    var stored = String(row[iSenha] || "");
    // Aceita hash SHA-256 ou texto puro (migração — preferir sempre hash)
    if (stored !== hash && stored !== senha) return { ok: false, error: "senha invalida" };

    var session = Utilities.base64EncodeWebSafe(
      JSON.stringify({
        login: login,
        exp: Date.now() + SESSION_HOURS * 3600 * 1000,
        n: Math.random(),
      })
    );
    return {
      ok: true,
      userId: iId >= 0 && row[iId] ? String(row[iId]) : "u_" + login,
      login: login,
      nome: iNome >= 0 ? String(row[iNome] || login) : login,
      email: iEmail >= 0 ? String(row[iEmail] || "") : "",
      role: iPerfil >= 0 ? String(row[iPerfil] || "operador") : "operador",
      perfil: iPerfil >= 0 ? String(row[iPerfil] || "operador") : "operador",
      empresaId: "sheets",
      companyId: "sheets",
      session: session,
      token: session,
    };
  }
  return { ok: false, error: "usuario nao encontrado" };
}

function parseSession_(body) {
  // Sessões simples: se veio session, ok por enquanto (token global já validado)
  return true;
}

function doList_(body) {
  if (!parseSession_(body)) return { ok: false, error: "sessao invalida" };
  var sheetName = String(body.sheetName || PROC_SHEET);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var headers =
    sheetName === LEADS_SHEET
      ? LEAD_HEADERS
      : sheetName === CLIENTS_SHEET
        ? CLIENT_HEADERS
        : sheetName === USERS_SHEET
          ? USER_HEADERS
          : PROC_HEADERS;
  var sh = ensureSheet_(ss, sheetName, headers);
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return { ok: true, rows: [], cases: [], total: 0, serverTime: new Date().toISOString() };

  var hdrs = values[0].map(String);
  var rows = [];
  var limit = Math.min(values.length - 1, Number(body.limit) || 2000);
  for (var r = 1; r <= limit; r++) {
    var obj = {};
    for (var c = 0; c < hdrs.length; c++) obj[hdrs[c]] = values[r][c];
    // Filtro opcional por responsável (operador)
    if (body.onlyMine && body.login) {
      var resp = String(obj.Responsavel || obj.responsavel || obj.CreatedBy || "").toLowerCase();
      if (resp && resp !== String(body.login).toLowerCase()) continue;
    }
    rows.push(obj);
  }
  return {
    ok: true,
    rows: rows,
    cases: rows,
    total: values.length - 1,
    serverTime: new Date().toISOString(),
  };
}

function doWrite_(body) {
  if (!parseSession_(body)) return { ok: false, error: "sessao invalida" };
  var sheetName = String(body.sheetName || PROC_SHEET);
  var rows = body.rows || [];
  if (!rows.length) return { ok: false, error: "sem rows" };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var defaultHeaders =
    sheetName === LEADS_SHEET
      ? LEAD_HEADERS
      : sheetName === CLIENTS_SHEET
        ? CLIENT_HEADERS
        : PROC_HEADERS;
  var sh = ensureSheet_(ss, sheetName, defaultHeaders);
  var data = sh.getDataRange().getValues();
  var headers = data[0].map(function (h) { return String(h || "").trim(); });
  if (headers.every(function (h) { return !h; })) {
    headers = defaultHeaders.slice();
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  // índice por Id ou Protocolo
  var keyIdx = -1;
  for (var i = 0; i < headers.length; i++) {
    var n = norm(headers[i]);
    if (n === "id") {
      keyIdx = i;
      break;
    }
  }
  if (keyIdx < 0) {
    for (var j = 0; j < headers.length; j++) {
      if (norm(headers[j]) === "protocolo") {
        keyIdx = j;
        break;
      }
    }
  }
  if (keyIdx < 0) keyIdx = 0;

  var index = {};
  for (var r = 1; r < data.length; r++) {
    var k = String(data[r][keyIdx] || "").trim();
    if (k) index[k] = r + 1;
  }

  var updated = 0;
  var added = 0;
  rows.forEach(function (rowObj) {
    if (!rowObj || typeof rowObj !== "object") return;
    var id = String(rowObj.Id || rowObj.id || rowObj.Protocolo || rowObj.protocolo || "").trim();
    var line = headers.map(function (h) {
      var nk = norm(h);
      for (var key in rowObj) {
        if (norm(key) === nk) return rowObj[key];
      }
      return "";
    });
    if (id && index[id]) {
      var rowNum = index[id];
      var cur = sh.getRange(rowNum, 1, rowNum, headers.length).getValues()[0];
      for (var c = 0; c < line.length; c++) {
        if (line[c] !== "" && line[c] != null) cur[c] = line[c];
      }
      sh.getRange(rowNum, 1, rowNum, headers.length).setValues([cur]);
      updated++;
    } else {
      sh.appendRow(line);
      added++;
    }
  });
  return { ok: true, updated: updated, added: added, sheet: sheetName };
}

function uiCriarUsuario() {
  var ui = SpreadsheetApp.getUi();
  var login = ui.prompt("Login").getResponseText();
  if (!login) return;
  var nome = ui.prompt("Nome").getResponseText() || login;
  var senha = ui.prompt("Senha (será salva como SHA-256)").getResponseText();
  if (!senha) return;
  var perfil = ui.prompt("Perfil (operador|supervisor|admin)", "operador", ui.ButtonSet.OK_CANCEL);
  var perfilVal = perfil.getSelectedButton() === ui.Button.OK ? perfil.getResponseText() || "operador" : "operador";

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ensureSheet_(ss, USERS_SHEET, USER_HEADERS);
  sh.appendRow([login, nome, sha256_(senha), perfilVal, "", "sim", "", "", Utilities.getUuid()]);
  ui.alert("Usuário criado: " + login);
}

function uiListarUsuarios() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(USERS_SHEET);
  if (!sh || sh.getLastRow() < 2) {
    SpreadsheetApp.getUi().alert("Nenhum usuário");
    return;
  }
  var data = sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues();
  var msg = data
    .map(function (r) {
      return r[0] + " — " + r[1] + " (" + r[3] + ")";
    })
    .join("\n");
  SpreadsheetApp.getUi().alert(msg || "Vazio");
}

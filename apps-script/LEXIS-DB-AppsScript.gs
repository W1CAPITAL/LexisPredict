/**
 * LEXIS GABINETE — Webhook planilha (Supabase-like)
 * =================================================
 * IMPORTANTE NO DEPLOY (senão dá "HTTP 200 inesperado" / página de login):
 *  1) Extensões → Apps Script → cole ESTE arquivo inteiro (apague o código antigo)
 *  2) TOKEN abaixo = o mesmo do app (Configurações)
 *  3) Implantar → Nova implantação → Tipo: Aplicativo da web
 *     - Executar como: Eu
 *     - Quem tem acesso: QUALQUER PESSOA   ← obrigatório (não "com o link")
 *  4) Autorize a conta Google
 *  5) Copie a URL que TERMINA EM /exec  (não use /dev)
 *  6) No app: cole URL + token → Salvar → Testar webhook
 *  7) Se mudar o código: Implantar → Gerenciar → lápis → Nova versão
 *
 * Menu Léxis: Garantir abas | Criar usuário | Listar usuários
 */

var TOKEN = "w1-fase1-2026";
var USERS_SHEET = "Usuarios";
var PROC_SHEET = "Processos";
var HEADER_ROW = 1;

var USER_HEADERS = ["login", "nome", "senha", "perfil", "escritorio", "ativo", "email", "auth_user_id", "id"];
var PROC_HEADERS = [
  "Protocolo", "Cliente", "Status", "Situacao", "UltimoRetorno", "ProximoRetorno",
  "Advogado", "Escritorio", "Tribunal", "Telefone", "CreatedBy", "AtendidoPor",
  "Observacao", "DatajudEncerrado", "EmpresaId", "isBaixaTribunal", "ultimo_movimento",
  "fase", "valor_causa", "updated_at", "Assistente", "Distribuicao", "Produtos",
  "Data_Movimentacao", "Andamento", "Evento_Tipo", "Novo_Andamento", "Busca_Apreensao",
  "Cumprimento", "DJEN_Resumo", "Dias_Sem_Retorno", "Procedente", "Improcedente"
];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Léxis")
    .addItem("Garantir abas e cabeçalhos", "ensureSheets")
    .addItem("Criar usuário (login/senha)", "uiCriarUsuario")
    .addItem("Listar usuários", "uiListarUsuarios")
    .addToUi();
}

function ensureSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheetWithHeaders_(ss, USERS_SHEET, USER_HEADERS);
  ensureSheetWithHeaders_(ss, PROC_SHEET, PROC_HEADERS);
  SpreadsheetApp.getUi().alert("Abas Usuarios e Processos OK.");
}

function ensureSheetWithHeaders_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  var lastCol = Math.max(sh.getLastColumn(), headers.length);
  var existing = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) {
    return String(h || "").trim();
  });
  var empty = existing.every(function (h) { return !h; });
  if (empty) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    return;
  }
  headers.forEach(function (h) {
    if (existing.indexOf(h) < 0) {
      sh.getRange(1, sh.getLastColumn() + 1).setValue(h);
      existing.push(h);
    }
  });
}

function sha256_(text) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text || ""), Utilities.Charset.UTF_8);
  return raw.map(function (b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? "0" + v : v;
  }).join("");
}
function uuid_() { return Utilities.getUuid(); }
function norm(s) {
  return String(s || "").replace(/[\s._-]+/g, "").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function normPerfil_(p) {
  var s = String(p || "operador").toLowerCase().trim();
  if (/super\s*admin|superadmin/.test(s)) return "superadmin";
  if (/supervis/.test(s)) return "supervisor";
  if (/admin/.test(s)) return "administrador";
  if (/assist/.test(s)) return "assistente";
  return "operador";
}
function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  // GET no /exec deve devolver JSON (teste no navegador)
  try {
    var p = (e && e.parameter) || {};
    if (String(p.action || "") === "ping" || p.ping === "1" || p.ping === "true") {
      if (p.token && String(p.token) !== String(TOKEN)) {
        return out_({ ok: false, error: "token invalido" });
      }
      return out_({ ok: true, pong: true, v: "6.3", via: "GET" });
    }
    // hash: gera SHA-256 de uma senha (para testar)
    if (String(p.action || "") === "hash" && p.senha) {
      if (p.token && String(p.token) !== String(TOKEN)) {
        return out_({ ok: false, error: "token invalido" });
      }
      return out_({ ok: true, senha: p.senha, hash: sha256_(p.senha) });
    }
  } catch (err) {}
  return out_({
    ok: true,
    app: "lexis-gabinete-sync",
    v: "6.3",
    ts: new Date().toISOString(),
    hint: "GET ?action=ping&token=TOKEN | ?action=hash&senha=X&token=TOKEN"
  });
}

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : "{}";
    var body = {};
    try { body = JSON.parse(raw); } catch (err) {
      return out_({ ok: false, error: "JSON inválido" });
    }
    if (!body || body.token !== TOKEN) {
      return out_({ ok: false, error: "token invalido — confira TOKEN no script e no app" });
    }
    // ping (Testar webhook no app)
    if (body.ping) {
      return out_({ ok: true, pong: true, app: "lexis-gabinete-sync", ts: new Date().toISOString() });
    }

    var action = String(body.action || body.op || "").toLowerCase();
    if (action === "ensure_schema") {
      ensureSheets();
      return out_({ ok: true, sheets: [USERS_SHEET, PROC_SHEET] });
    }
    if (action === "login") return out_(authLogin_(body.login || body.email, body.senha || body.password));
    if (action === "list_users") return out_({ ok: true, users: listUsersPublic_() });
    if (action === "create_user") {
      return out_(criarUsuario(body.login, body.nome, body.senha || body.password, body.perfil, body.escritorio, body.email));
    }
    if (action === "set_ativo") return out_(setUserAtivo_(body.login, body.ativo));
    if (action === "set_perfil") return out_(setUserPerfil_(body.login, body.perfil));
    if (action === "set_password") return out_(setUserPassword_(body.login, body.senha || body.password));
    if (action === "hash") return out_({ ok: true, hash: sha256_(body.senha || "") });
    if (action === "upsert_processos" || action === "upsertretornos" || body.rows) {
      return out_(upsertProcessos_(body.rows || []));
    }
    return out_({ ok: false, error: "action desconhecida" });
  } catch (err) {
    return out_({ ok: false, error: String(err.message || err) });
  }
}

/* —— usuários —— */
function getUsersSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheetWithHeaders_(ss, USERS_SHEET, USER_HEADERS);
  return ss.getSheetByName(USERS_SHEET);
}
function headerMap_(sh) {
  var lastCol = Math.max(1, sh.getLastColumn());
  var headers = sh.getRange(HEADER_ROW, 1, 1, lastCol).getValues()[0].map(function (h) {
    return String(h || "").trim();
  });
  var map = {};
  headers.forEach(function (h, i) { if (h) map[h.toLowerCase()] = i; });
  return { headers: headers, map: map };
}
function criarUsuario(login, nome, senha, perfil, escritorio, email) {
  login = norm(login);
  if (!login || !senha) throw new Error("login e senha obrigatórios");
  var sh = getUsersSheet_();
  var hm = headerMap_(sh);
  var data = sh.getDataRange().getValues();
  for (var r = 1; r < data.length; r++) {
    var rowLogin = norm(data[r][hm.map.login]);
    var rowEmail = norm(data[r][hm.map.email]);
    if (rowLogin === login || (email && rowEmail === norm(email))) {
      throw new Error("login/email já existe");
    }
  }
  var id = uuid_();
  var line = hm.headers.map(function (h) {
    var k = h.toLowerCase();
    if (k === "login") return login;
    if (k === "nome") return nome || login;
    if (k === "senha") return sha256_(senha);
    if (k === "perfil") return normPerfil_(perfil);
    if (k === "escritorio") return escritorio || "";
    if (k === "ativo") return "sim";
    if (k === "email") return (email || login).toLowerCase();
    if (k === "auth_user_id" || k === "id") return id;
    return "";
  });
  sh.appendRow(line);
  return { ok: true, login: login, perfil: normPerfil_(perfil), auth_user_id: id };
}
function uiCriarUsuario() {
  var ui = SpreadsheetApp.getUi();
  var a = ui.prompt("Login", "Login:", ui.ButtonSet.OK_CANCEL);
  if (a.getSelectedButton() !== ui.Button.OK) return;
  var b = ui.prompt("Nome", "Nome:", ui.ButtonSet.OK_CANCEL);
  if (b.getSelectedButton() !== ui.Button.OK) return;
  var c = ui.prompt("Senha", "Senha:", ui.ButtonSet.OK_CANCEL);
  if (c.getSelectedButton() !== ui.Button.OK) return;
  var d = ui.prompt("Perfil", "superadmin|supervisor|administrador|operador", ui.ButtonSet.OK_CANCEL);
  if (d.getSelectedButton() !== ui.Button.OK) return;
  try {
    var r = criarUsuario(a.getResponseText(), b.getResponseText(), c.getResponseText(), d.getResponseText(), "", a.getResponseText());
    ui.alert("OK: " + r.login + " (" + r.perfil + ")");
  } catch (e) { ui.alert(String(e.message || e)); }
}
function uiListarUsuarios() {
  var list = listUsersPublic_();
  SpreadsheetApp.getUi().alert(list.length ? list.map(function (u) {
    return u.login + " | " + u.nome + " | " + u.perfil + " | " + u.ativo;
  }).join("\n") : "Nenhum");
}
function listUsersPublic_() {
  var sh = getUsersSheet_();
  var hm = headerMap_(sh);
  var data = sh.getDataRange().getValues();
  var out = [];
  for (var r = 1; r < data.length; r++) {
    var login = String(data[r][hm.map.login] || "").trim();
    if (!login) continue;
    out.push({
      login: login,
      nome: String(data[r][hm.map.nome] || ""),
      perfil: String(data[r][hm.map.perfil] || ""),
      escritorio: String(data[r][hm.map.escritorio] || ""),
      ativo: String(data[r][hm.map.ativo] || "sim"),
      email: String(data[r][hm.map.email] || ""),
      auth_user_id: String(data[r][hm.map.auth_user_id] || data[r][hm.map.id] || ""),
      id: String(data[r][hm.map.id] || "")
    });
  }
  return out;
}
function authLogin_(loginOrEmail, senha) {
  var sh = getUsersSheet_();
  var hm = headerMap_(sh);
  var data = sh.getDataRange().getValues();
  var key = norm(loginOrEmail);
  var hash = sha256_(senha);
  for (var r = 1; r < data.length; r++) {
    var login = norm(data[r][hm.map.login]);
    var email = norm(data[r][hm.map.email]);
    var rawLogin = String(data[r][hm.map.login] || "").trim();
    var rawEmail = String(data[r][hm.map.email] || "").trim();
    var ativo = norm(data[r][hm.map.ativo] || "sim");
    if (ativo === "nao" || ativo === "false") continue;
    if (login === key || email === key) {
      var stored = String(data[r][hm.map.senha] || "").toLowerCase();
      // Aceita: hash bate OU senha ja eh o hash (hash duplo)
      if (stored !== hash && stored !== sha256_(hash)) {
        return { ok: false, error: "senha invalida" };
      }
      return {
        ok: true,
        user: {
          login: rawLogin || login,
          nome: String(data[r][hm.map.nome] || ""),
          perfil: normPerfil_(data[r][hm.map.perfil]),
          escritorio: String(data[r][hm.map.escritorio] || ""),
          email: rawEmail || email,
          auth_user_id: String(data[r][hm.map.auth_user_id] || data[r][hm.map.id] || ""),
          id: String(data[r][hm.map.id] || "")
        }
      };
    }
  }
  return { ok: false, error: "usuário não encontrado" };
}
function setUserAtivo_(login, ativo) {
  login = String(login || "").trim().toLowerCase();
  var sh = getUsersSheet_();
  var hm = headerMap_(sh);
  var data = sh.getDataRange().getValues();
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][hm.map.login] || "").trim().toLowerCase() === login) {
      sh.getRange(r + 1, hm.map.ativo + 1).setValue(ativo ? "sim" : "nao");
      return { ok: true, login: login, ativo: !!ativo };
    }
  }
  return { ok: false, error: "não encontrado" };
}
function setUserPerfil_(login, perfil) {
  login = String(login || "").trim().toLowerCase();
  var sh = getUsersSheet_();
  var hm = headerMap_(sh);
  var data = sh.getDataRange().getValues();
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][hm.map.login] || "").trim().toLowerCase() === login) {
      sh.getRange(r + 1, hm.map.perfil + 1).setValue(normPerfil_(perfil));
      return { ok: true, login: login, perfil: normPerfil_(perfil) };
    }
  }
  return { ok: false, error: "não encontrado" };
}
function setUserPassword_(login, novaSenha) {
  login = norm(login);
  if (!login || !novaSenha) return { ok: false, error: "login e nova senha obrigatórios" };
  if (String(novaSenha).length < 4) return { ok: false, error: "senha precisa de 4+ caracteres" };
  var sh = getUsersSheet_();
  var hm = headerMap_(sh);
  var data = sh.getDataRange().getValues();
  for (var r = 1; r < data.length; r++) {
    if (norm(data[r][hm.map.login]) === login) {
      sh.getRange(r + 1, hm.map.senha + 1).setValue(sha256_(novaSenha));
      return { ok: true, login: login };
    }
  }
  return { ok: false, error: "não encontrado" };
}

/* —— processos (sync 2 vias do desktop) —— */
function upsertProcessos_(rows) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheetWithHeaders_(ss, PROC_SHEET, PROC_HEADERS);
  var sh = ss.getSheetByName(PROC_SHEET) || ss.getSheets()[0];
  var lastCol = Math.max(1, sh.getLastColumn());
  var headers = sh.getRange(HEADER_ROW, 1, 1, lastCol).getValues()[0].map(function (h) {
    return String(h || "").trim();
  });
  var keyIdx = -1;
  for (var ci = 0; ci < headers.length; ci++) {
    if (/protocolo|cnj|processo|numero/.test(norm(headers[ci]))) { keyIdx = ci; break; }
  }
  if (keyIdx < 0) return { ok: false, error: "coluna Protocolo não encontrada — rode Léxis → Garantir abas" };

  var data = sh.getDataRange().getValues();
  var index = {};
  for (var r = 1; r < data.length; r++) {
    var k = String(data[r][keyIdx] || "").replace(/\D/g, "");
    if (k) index[k] = r + 1;
  }

  var updated = 0, inserted = 0;
  (rows || []).forEach(function (rowObj) {
    if (!rowObj || typeof rowObj !== "object") return;
    var proto = String(rowObj.Protocolo || rowObj.protocolo || rowObj.protocolo_ref || "").trim();
    var digits = proto.replace(/\D/g, "");
    if (!digits) return;

    // aliases comuns do app.js
    if (rowObj.ultimo && !rowObj.UltimoRetorno && !rowObj.Retorno) rowObj.UltimoRetorno = rowObj.ultimo;
    if (rowObj.prazo && !rowObj.ProximoRetorno && !rowObj.Proximo_Retorno) rowObj.ProximoRetorno = rowObj.prazo;
    if (rowObj.obs && !rowObj.Observacao && !rowObj.Observacoes) rowObj.Observacao = rowObj.obs;
    if (rowObj.status && !rowObj.Status && !rowObj.Situacao) rowObj.Status = rowObj.status;
    if (rowObj.cliente && !rowObj.Cliente) rowObj.Cliente = rowObj.cliente;

    if (index[digits]) {
      var rowNum = index[digits];
      var current = sh.getRange(rowNum, 1, rowNum, headers.length).getValues()[0];
      headers.forEach(function (h, i) {
        var nk = norm(h);
        for (var key in rowObj) {
          if (!Object.prototype.hasOwnProperty.call(rowObj, key)) continue;
          if (norm(key) === nk) {
            var val = rowObj[key];
            if (val !== undefined && val !== null && val !== "") current[i] = val;
          }
        }
      });
      sh.getRange(rowNum, 1, rowNum, headers.length).setValues([current]);
      updated++;
    } else {
      var line = headers.map(function (h) {
        var nk = norm(h);
        for (var key in rowObj) {
          if (norm(key) === nk) return rowObj[key];
        }
        if (/protocolo/.test(nk)) return proto;
        return "";
      });
      sh.appendRow(line);
      inserted++;
    }
  });
  return { ok: true, updated: updated, inserted: inserted, total: (rows || []).length };
}

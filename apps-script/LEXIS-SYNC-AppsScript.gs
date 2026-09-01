/**
 * LEXIS GABINETE v6.2 — Sincronização 2 vias + LOGIN POR USUÁRIO
 * =================================================================
 * Cada usuário loga com usuário/senha (validados AQUI no servidor).
 * Cada processo tem uma coluna RESPONSAVEL = login (ou nome) do dono.
 * - action=auth  : valida usuário/senha (SHA-256) e devolve token de sessão
 * - action=list  : devolve SÓ os casos do usuário (minhas) + todas (aba empresa)
 * - action=write : grava; RECUSA linhas cujo responsavel não é o solicitante
 * - action=ping  : teste do botão "Testar webhook"
 *
 * DEPLOY (1x):
 *  1. Na planilha: crie uma aba chamada  Usuarios  com cabeçalho:
 *       login | nome | senha | perfil | escritorio | ativo
 *     (senha = hash SHA-256, gere no rodapé/script; ativo=sim/não)
 *  2. Na aba da carteira, crie/renomeie a coluna  Responsavel
 *     (vale o login ou o nome do usuário dono de cada processo).
 *  3. Extensões -> Apps Script -> cole este arquivo -> Implantar ->
 *     "Aplicativo da web" -> Executar como: "Eu" -> Acesso: "Qualquer pessoa".
 *  4. No menu do editor "Léxis" use "Criar usuário" (pede login/nome/senha/perfil).
 *
 * SEGURANÇA: o acesso web fica como "Qualquer pessoa" porque Apps Script
 * gratuito não oferece autenticação própria — mas a validação de usuário/senha,
 * a geração do token de sessão (8h) e o filtro de linhas são feitos AQUI.
 * A planilha em si deve estar compartilhada SOMENTE com você (não "qualquer
 * pessoa com o link"), pois o desktop só passa por este webhook.
 */

var TOKEN = "w1-fase1-2026";                 // <<< troque por um token seu (vai no Config do app)
var SHEET_NAME = "Processos";                // aba principal da carteira
var KEY_COL = "Protocolo";                   // cabeçalho da coluna-chave (CNJ)
var OWNER_FIELD = "Responsavel";             // coluna que identifica o DONO de cada processo
var USERS_SHEET = "Usuarios";                // aba com login/nome/senha/perfil/escritorio/ativo
var HEADER_ROW = 1;                          // linha dos cabeçalhos
var SESS_DURATION_MS = 8 * 3600 * 1000;      // token de sessão dura 8h (renovado a cada list/write)
var SESS_PREFIX = "lex_sess_";

function norm(s) {
  return String(s || "").replace(/\s+/g, "").replace(/[^\w\u00C0-\u017F/]/g, "").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function hashSenha(s) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s || ""), Utilities.Charset.UTF_8);
  var out = "";
  for (var i = 0; i < bytes.length; i++) out += ("0" + ((bytes[i] & 0xFF).toString(16))).slice(-2);
  return out;
}

var ACCESS = { assistente: 10, atendente: 10, responsavel: 10, supervisor: 20, superadmin: 30 };

function roleAccess(perfil) {
  var p = norm(String(perfil || "assistente"));
  if (ACCESS[p] !== undefined) return ACCESS[p];
  for (var k in ACCESS) if (norm(k) === p) return ACCESS[k];
  return 10;
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    if (String(p.action || "") === "ping" || p.ping === "1" || p.ping === "true") {
      if (p.token && String(p.token) !== String(TOKEN)) {
        return out({ ok: false, error: "token invalido" });
      }
      return out({ ok: true, pong: true, v: "6.3", via: "GET" });
    }
  } catch (err) {}
  return out({
    ok: true,
    app: "lexis-gabinete-sync",
    v: "6.3",
    ts: new Date().toISOString(),
    hint: "GET ?action=ping&token=TOKEN"
  });
}

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  if (!ui) return;
  ui.createMenu("Léxis")
    .addItem("Criar usuário (login/senha)", "criarUsuarioUI")
    .addItem("Listar usuários", "listarUsuariosUI")
    .addToUi();
}

function criarUsuarioUI() {
  var ui = SpreadsheetApp.getUi();
  var resp = ui.prompt("Criar usuário", "login (minúsculas, sem espaços)", ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  var login = norm(resp.getResponseText());
  if (!login) return;
  var r2 = ui.prompt("Criar usuário · " + login, "nome completo", ui.ButtonSet.OK_CANCEL);
  if (r2.getSelectedButton() !== ui.Button.OK) return;
  var r3 = ui.prompt("Criar usuário · " + login, "senha", ui.ButtonSet.OK_CANCEL);
  if (r3.getSelectedButton() !== ui.Button.OK) return;
  var r4 = ui.prompt("Criar usuário · " + login, "perfil (assistente / atendente / responsavel)", ui.ButtonSet.OK_CANCEL);
  if (r4.getSelectedButton() !== ui.Button.OK) return;
  criarUsuario(login, r2.getResponseText(), r3.getResponseText(), r4.getResponseText(), "");
  ui.alert("Usuário criado: " + login);
}

function listarUsuariosUI() {
  var ui = SpreadsheetApp.getUi();
  var sh = usuariosSheet();
  if (!sh) { ui.alert("Não achei a aba 'Usuarios'."); return; }
  var vals = sh.getDataRange().getValues();
  var txt = [];
  for (var i = 1; i < vals.length; i++) {
    var v = vals[i];
    if (!String(v[0] || "").trim()) continue;
    txt.push(String(v[0]) + " | " + v[1] + " | " + v[3] + " | " + v[4]);
  }
  ui.alert("Usuários:\n" + (txt.join("\n") || "(nenhum)"));
}

function criarUsuario(login, nome, senha, perfil, escritorio) {
  var sh = usuariosSheet(true);
  if (!sh) return { ok: false, error: "falta aba Usuarios" };
  var lastCol = Math.max(1, sh.getLastColumn());
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return norm(h); });
  function col(aliases) {
    for (var a = 0; a < aliases.length; a++)
      for (var c = 0; c < headers.length; c++)
        if (headers[c] === aliases[a]) return c;
    return -1;
  }
  var cL = col(["login", "usuario"]);
  var cN = col(["nome"]);
  var cS = col(["senha"]);
  var cP = col(["perfil", "perfilacesso"]);
  var cE = col(["escritorio", "unidade"]);
  var cA = col(["ativo"]);
  if (cL < 0 || cN < 0 || cS < 0) return { ok: false, error: "Usuarios precisa de login | nome | senha" };
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (norm(data[i][cL]) === norm(login)) return { ok: false, error: "login ja existe" };
  }
  var row = [""];
  if (cL >= 0) row[cL] = login;
  if (cN >= 0) row[cN] = nome;
  if (cS >= 0) row[cS] = hashSenha(senha);
  if (cP >= 0) row[cP] = perfil;
  if (cE >= 0) row[cE] = escritorio;
  if (cA >= 0) row[cA] = "sim";
  var r = sh.getLastRow() + 1;
  sh.getRange(r, 1, 1, lastCol).setValues([row]);
  return { ok: true };
}

function usuariosSheet(create) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(USERS_SHEET);
  if (!sh && create) {
    sh = ss.insertSheet(USERS_SHEET);
    sh.getRange(1, 1, 1, 6).setValues([["login", "nome", "senha", "perfil", "escritorio", "ativo"]]);
  }
  return sh;
}

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || "{}");
    if (!body || body.token !== TOKEN) return out({ ok: false, error: "token invalido" });
    var action = String(body.action || "");
    if (action === "ping" || body.ping === true) return out({ ok: true, pong: true, v: "6.3" });

    if (action === "auth" || action === "login") {
      return out(doAuth(body));
    }
    if (action === "auto") {
      var vs = validSess(body);
      if (vs.err) return out({ ok: false, error: vs.err });
      return out({ ok: true, user: publicUser(vs.us) });
    }
    if (action === "list") {
      var vs2 = validSess(body);
      if (vs2.err) return out({ ok: false, error: vs2.err });
      return out(readAll(vs2.us));
    }
    if (action === "write") {
      var vs3 = validSess(body);
      if (vs3.err) return out({ ok: false, error: vs3.err });
      return out(writeRows(body.rows || [], vs3.us));
    }
    if (action === "users" || action === "list_users") {
      var vs4 = validSess(body);
      if (vs4.err) return out({ ok: false, error: vs4.err });
      if (roleAccess(vs4.us.perfil) < 20) return out({ ok: false, error: "sem permissao (supervisor+)" });
      return out(listUsers());
    }
    if (action === "user_create" || action === "create_user") {
      var vs5 = validSess(body);
      if (vs5.err) return out({ ok: false, error: vs5.err });
      var ca = roleAccess(vs5.us.perfil);
      if (ca < 20) return out({ ok: false, error: "sem permissao (supervisor+)" });
      var targetA = roleAccess(body.perfil);
      if (targetA > ca) return out({ ok: false, error: "voce nao pode criar perfil maior que o seu" });
      return out(criarUsuarioServer(body, ca));
    }
    if (action === "user_set") {
      var vs6 = validSess(body);
      if (vs6.err) return out({ ok: false, error: vs6.err });
      var ca2 = roleAccess(vs6.us.perfil);
      if (ca2 < 20) return out({ ok: false, error: "sem permissao (supervisor+)" });
      return out(setUsuarioServer(body, vs6.us.u, ca2));
    }
    if (action === "hash") {
      return out({ ok: true, hash: hashSenha(body.senha) });
    }
    if (action === "set_password") {
      var login2 = norm(body.login);
      var nova = String(body.senha || "");
      if (!login2 || !nova) return out({ ok: false, error: "login e senha obrigatorios" });
      var sh2 = usuariosSheet();
      if (!sh2) return out({ ok: false, error: "falta aba Usuarios" });
      var lastCol2 = Math.max(1, sh2.getLastColumn());
      var headers2 = sh2.getRange(HEADER_ROW, 1, 1, lastCol2).getValues()[0].map(function (h) { return norm(h); });
      var cL2 = -1, cS2 = -1;
      for (var i2 = 0; i2 < headers2.length; i2++) {
        if (headers2[i2] === "login" || headers2[i2] === "usuario") cL2 = i2;
        if (headers2[i2] === "senha") cS2 = i2;
      }
      if (cL2 < 0 || cS2 < 0) return out({ ok: false, error: "falta coluna login/senha" });
      var data2 = sh2.getDataRange().getValues();
      for (var r2 = 1; r2 < data2.length; r2++) {
        if (norm(data2[r2][cL2]) === login2) {
          sh2.getRange(r2 + 1, cS2 + 1).setValue(hashSenha(nova));
          return out({ ok: true, login: login2 });
        }
      }
      return out({ ok: false, error: "nao encontrado" });
    }
    return out({ ok: false, error: "acao desconhecida: " + action });
  } catch (err) {
    return out({ ok: false, error: String(err).slice(0, 300) });
  }
}

function publicUser(us) {
  return { usuario: us.u, nome: us.nome, perfil: us.perfil, escritorio: us.escritorio, access: roleAccess(us.perfil) };
}

function doAuth(body) {
  var login = norm(body.usuario);
  var pass = String(body.senha || "");
  if (!login || !pass) return { ok: false, error: "informe usuario e senha" };
  var sh = usuariosSheet();
  if (!sh) return { ok: false, error: "falta a aba 'Usuarios' na planilha (login | nome | senha | perfil | escritorio | ativo)" };
  var lastCol = Math.max(1, sh.getLastColumn());
  var headers = sh.getRange(HEADER_ROW, 1, 1, lastCol).getValues()[0].map(function (h) { return norm(h); });
  function col(aliases) {
    for (var a = 0; a < aliases.length; a++)
      for (var c = 0; c < headers.length; c++)
        if (headers[c] === aliases[a]) return c;
    return -1;
  }
  var cL = col(["login", "usuario"]);
  var cEml = col(["email", "e-mail", "mail"]);
  var cN = col(["nome"]);
  var cS = col(["senha"]);
  var cP = col(["perfil", "perfilacesso"]);
  var cE = col(["escritorio", "unidade"]);
  var cA = col(["ativo"]);
  if (cL < 0 || cS < 0) return { ok: false, error: "Usuarios precisa das colunas login e senha" };
  var data = sh.getDataRange().getValues();
  var found = null;
  var isEmailInput = String(body.usuario || "").indexOf("@") >= 0;
  var rawEmailInput = String(body.usuario || "").trim().toLowerCase();
  for (var i = HEADER_ROW; i < data.length; i++) {
    var v = data[i];
    var u = norm(v[cL]);
    var ativo = norm(v[cA >= 0 ? cA : 0]);
    var match = false;
    if (u && u === login) {
      match = true;
    } else if (isEmailInput && cEml >= 0) {
      var storedEmail = String(v[cEml] || "").trim().toLowerCase();
      if (storedEmail && storedEmail === rawEmailInput) {
        match = true;
      }
    }
    if (match) {
      if (cA >= 0 && (ativo === "nao" || ativo === "false" || ativo === "0" || ativo === "inativo")) {
        return { ok: false, error: "usuario inativo" };
      }
      found = v; break;
    }
  }
  if (!found) return { ok: false, error: "usuario ou senha invalidos" };
  var stored = String(found[cS] || "");
  var passHash = hashSenha(pass);
  if (passHash !== stored && hashSenha(passHash) !== stored) return { ok: false, error: "usuario ou senha invalidos" };
  var token = Utilities.getUuid() + Utilities.getUuid();
  var sessLogin = (cEml >= 0 && isEmailInput) ? String(found[cEml] || "").trim().toLowerCase() : login;
  var sess = {
    u: sessLogin,
    nome: String(found[cN >= 0 ? cN : 0] || login),
    perfil: String(found[cP >= 0 ? cP : 0] || "assistente"),
    escritorio: String(found[cE >= 0 ? cE : 0] || ""),
    exp: Date.now() + SESS_DURATION_MS
  };
  PropertiesService.getScriptProperties().setProperty(SESS_PREFIX + token, JSON.stringify(sess));
  pruneSessions();
  return { ok: true, token: token, user: publicUser(sess) };
}

function pruneSessions() {
  var props = PropertiesService.getScriptProperties();
  var keys = props.getKeys();
  var now = Date.now();
  for (var i = 0; i < keys.length; i++) {
    if (keys[i].indexOf(SESS_PREFIX) === 0) {
      try {
        var s = JSON.parse(props.getProperty(keys[i]));
        if (s && s.exp && s.exp < now) props.deleteProperty(keys[i]);
      } catch (_) {}
    }
  }
}

function getSess(token) {
  if (!token) return null;
  try {
    var props = PropertiesService.getScriptProperties();
    var raw = props.getProperty(SESS_PREFIX + String(token));
    if (!raw) return null;
    var s = JSON.parse(raw);
    if (s && typeof s.exp === "number" && s.exp > Date.now()) return s;
    props.deleteProperty(SESS_PREFIX + String(token));
    return null;
  } catch (_) { return null; }
}

function touchSess(token) {
  try {
    var props = PropertiesService.getScriptProperties();
    var raw = props.getProperty(SESS_PREFIX + String(token));
    if (!raw) return;
    var s = JSON.parse(raw);
    s.exp = Date.now() + SESS_DURATION_MS;
    props.setProperty(SESS_PREFIX + String(token), JSON.stringify(s));
  } catch (_) {}
}

function isAtivo(login) {
  var sh = usuariosSheet();
  if (!sh) return false;
  var lastCol = Math.max(1, sh.getLastColumn());
  var headers = sh.getRange(HEADER_ROW, 1, 1, lastCol).getValues()[0].map(function (h) { return norm(h); });
  var cL = -1, cA = -1;
  for (var i = 0; i < headers.length; i++) {
    if (headers[i] === "login" || headers[i] === "usuario") cL = i;
    if (headers[i] === "ativo") cA = i;
  }
  if (cL < 0) return false;
  var data = sh.getDataRange().getValues();
  for (var r = HEADER_ROW; r < data.length; r++) {
    if (norm(data[r][cL]) === norm(login)) {
      if (cA < 0) return true;
      var v = norm(data[r][cA]);
      return !(v === "nao" || v === "false" || v === "0" || v === "inativo");
    }
  }
  return false;
}

function validSess(body) {
  var us = getSess(body.sess);
  if (!us) return { err: "sessao invalida ou expirada" };
  if (!isAtivo(us.u)) {
    try { PropertiesService.getScriptProperties().deleteProperty(SESS_PREFIX + String(body.sess)); } catch (_) {}
    return { err: "usuario banido" };
  }
  touchSess(body.sess);
  return { us: us };
}

function listUsers() {
  var sh = usuariosSheet();
  if (!sh) return { ok: false, error: "falta aba Usuarios" };
  var lastCol = Math.max(1, sh.getLastColumn());
  var headers = sh.getRange(HEADER_ROW, 1, 1, lastCol).getValues()[0].map(function (h) { return norm(h); });
  function col(aliases) {
    for (var a = 0; a < aliases.length; a++)
      for (var c = 0; c < headers.length; c++)
        if (headers[c] === aliases[a]) return c;
    return -1;
  }
  var cL = col(["login", "usuario"]), cN = col(["nome"]), cP = col(["perfil", "perfilacesso"]),
      cE = col(["escritorio", "unidade"]), cA = col(["ativo"]);
  var data = sh.getDataRange().getValues();
  var users = [];
  for (var i = HEADER_ROW; i < data.length; i++) {
    var v = data[i];
    var login = String(v[cL] || "").trim();
    if (!login) continue;
    users.push({
      login: login,
      nome: String(cN >= 0 ? v[cN] || "" : ""),
      perfil: String(cP >= 0 ? v[cP] || "" : "assistente"),
      escritorio: String(cE >= 0 ? v[cE] || "" : ""),
      ativo: (cA < 0) ? "sim" : String(v[cA] || "sim").trim()
    });
  }
  users.sort(function (a, b) { return String(a.login).localeCompare(String(b.login)); });
  return { ok: true, users: users };
}

function criarUsuarioServer(body, callAccess) {
  var login = norm(body.login);
  var senha = String(body.senha || "");
  var nome = String(body.nome || login);
  var perfil = String(body.perfil || "assistente");
  if (!login) return { ok: false, error: "login vazio" };
  if (senha.length < 4) return { ok: false, error: "senha precisa de 4+ caracteres" };
  if (roleAccess(perfil) > callAccess) return { ok: false, error: "perfil acima da sua permissao" };
  var existe = readUserRow(login);
  if (existe) return { ok: false, error: "login ja existe" };
  var sh = usuariosSheet(true);
  if (!sh) return { ok: false, error: "falta aba Usuarios" };
  var lastCol = Math.max(1, sh.getLastColumn());
  var headers = sh.getRange(HEADER_ROW, 1, 1, lastCol).getValues()[0].map(function (h) { return norm(h); });
  function col(aliases) {
    for (var a = 0; a < aliases.length; a++)
      for (var c = 0; c < headers.length; c++)
        if (headers[c] === aliases[a]) return c;
    return -1;
  }
  var cL = col(["login", "usuario"]), cN = col(["nome"]), cS = col(["senha"]),
      cP = col(["perfil", "perfilacesso"]), cE = col(["escritorio", "unidade"]), cA = col(["ativo"]);
  if (cL < 0 || cS < 0) return { ok: false, error: "Usuarios precisa de login(senha)" };
  var row = [];
  for (var c = 0; c < lastCol; c++) row.push("");
  if (cL >= 0) row[cL] = login;
  if (cN >= 0) row[cN] = nome;
  if (cS >= 0) row[cS] = hashSenha(senha);
  if (cP >= 0) row[cP] = perfil;
  if (cE >= 0) row[cE] = String(body.escritorio || "");
  if (cA >= 0) row[cA] = "sim";
  var r = sh.getLastRow() + 1;
  sh.getRange(r, 1, 1, lastCol).setValues([row]);
  return { ok: true, login: login, perfil: perfil };
}

function setUsuarioServer(body, callerLogin, callAccess) {
  var login = norm(body.login);
  if (!login) return { ok: false, error: "login vazio" };
  var t = readUserRow(login);
  if (!t) return { ok: false, error: "usuario nao encontrado" };
  var sh = t.sh;
  var lastCol = Math.max(1, sh.getLastColumn());
  var headers = sh.getRange(HEADER_ROW, 1, 1, lastCol).getValues()[0].map(function (h) { return norm(h); });
  function col(aliases) {
    for (var a = 0; a < aliases.length; a++)
      for (var c = 0; c < headers.length; c++)
        if (headers[c] === aliases[a]) return c;
    return -1;
  }
  var targetPerfil = "assistente";
  var cP0 = col(["perfil", "perfilacesso"]);
  if (cP0 >= 0) targetPerfil = String(t.data[cP0] || "assistente");
  if (roleAccess(targetPerfil) > callAccess) return { ok: false, error: "esse usuario esta acima da sua permissao" };
  var cA = col(["ativo"]);
  var cN = col(["nome"]), cP = col(["perfil", "perfilacesso"]), cE = col(["escritorio", "unidade"]);
  var ativo = String(body.ativo || "").trim().toLowerCase();
  if (ativo === "nao" && login === callerLogin) return { ok: false, error: "voce nao pode banir a si mesmo" };
  if (body.perfil && String(body.perfil).trim()) {
    if (roleAccess(body.perfil) > callAccess) return { ok: false, error: "perfil acima da sua permissao" };
    if (cP >= 0) sh.getRange(t.row, cP + 1).setValue(String(body.perfil).trim());
  }
  if (body.nome !== undefined && cN >= 0) sh.getRange(t.row, cN + 1).setValue(String(body.nome).trim());
  if (body.escritorio !== undefined && cE >= 0) sh.getRange(t.row, cE + 1).setValue(String(body.escritorio).trim());
  if (ativo === "sim" || ativo === "nao") {
    if (cA < 0) return { ok: false, error: "Usuarios precisa da coluna ativo" };
    sh.getRange(t.row, cA + 1).setValue(ativo === "sim" ? "sim" : "nao");
  }
  return { ok: true, login: login, ativo: ativo || "", perfil: body.perfil || targetPerfil };
}

function readAll(us) {
  var sh = getSheet();
  var lastCol = Math.max(1, sh.getLastColumn());
  var headers = sh.getRange(HEADER_ROW, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h || "").trim(); });
  var data = sh.getDataRange().getValues();
  var minhas = [];
  var todas = [];
  var u = norm(us.u);
  var un = norm(us.nome);
  var respIdx = -1;
  var isAdmin = roleAccess(us.perfil) >= 20;
  for (var c = 0; c < headers.length; c++) if (norm(headers[c]) === norm(OWNER_FIELD)) { respIdx = c; break; }
  for (var i = HEADER_ROW + 1; i < data.length; i++) {
    var line = data[i];
    var has = false;
    for (var q = 0; q < lastCol; q++) if (String(line[q] || "").trim() !== "") { has = true; break; }
    if (!has) continue;
    var cells = line.slice(0, lastCol);
    var owner = (respIdx >= 0) ? String(line[respIdx] || "").trim() : "";
    var ownerN = norm(owner);
    todas.push(cells);
    if (isAdmin || ownerN === "" || ownerN === u || ownerN === un) minhas.push(cells);
  }
  return { ok: true, headers: headers, minhas: minhas, todas: todas, user: publicUser(us), v: "6.2" };
}

function writeRows(rowsIn, us) {
  var sh = getSheet();
  var lastCol = Math.max(1, sh.getLastColumn());
  var headers = sh.getRange(HEADER_ROW, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h || "").trim(); });
  var keyIdx = -1;
  for (var ci = 0; ci < headers.length; ci++) {
    var hn = norm(headers[ci]);
    if (/protocolo|cnj|processo|numero/.test(hn)) { keyIdx = ci; break; }
  }
  if (keyIdx < 0) return { ok: false, error: "coluna-chave (Protocolo/CNJ) nao encontrada" };
  var respIdx = -1;
  for (var c2 = 0; c2 < headers.length; c2++) if (norm(headers[c2]) === norm(OWNER_FIELD)) { respIdx = c2; break; }
  var data = sh.getDataRange().getValues();
  var map = {};
  for (var i = HEADER_ROW + 1; i < data.length; i++) {
    var k = String(data[i][keyIdx] || "").replace(/\D/g, "");
    if (k) map[k] = i + 1;
  }
  var u = norm(us.u);
  var un = norm(us.nome);
  var updated = 0, added = 0; var rejected = [];
  var isAdmin = roleAccess(us.perfil) >= 20;
  for (var r = 0; r < rowsIn.length; r++) {
    var rec = rowsIn[r] || {};
    var key = String(rec[KEY_COL] || rec.protocolo || "").replace(/\D/g, "");
    if (!key) { rejected.push({ protocolo: "", motivo: "sem chave" }); continue; }
    var row = map[key] || null;
    if (!row) {
      row = sh.getLastRow() + 1;
      var blank = [];
      for (var bc = 0; bc < lastCol; bc++) blank.push("");
      sh.getRange(row, 1, 1, lastCol).setValues([blank]);
      map[key] = row;
      if (respIdx >= 0) { // novo caso vira do criador
        sh.getRange(row, respIdx + 1).setValue(us.u);
      }
      added++;
    } else {
      var ownerNow = (respIdx >= 0) ? norm(String(data[row - 1][respIdx] || "")) : "";
      if (!isAdmin && ownerNow !== "" && ownerNow !== u && ownerNow !== un) {
        rejected.push({ protocolo: key, motivo: "processo de outro responsavel" });
        continue;
      }
    }
    sh.getRange(row, keyIdx + 1).setValue(rec[KEY_COL] || key);
    updated++;
    for (var field in rec) {
      if (norm(field) === norm(KEY_COL)) continue;
      if (rec[field] === undefined || rec[field] === null) continue;
      if (String(rec[field]) === "") continue;
      var fNorm = norm(field);
      for (var c = 0; c < headers.length; c++) {
        if (norm(headers[c]) === fNorm) {
          sh.getRange(row, c + 1).setValue(String(rec[field]));
          break;
        }
      }
    }
  }
  return { ok: true, updated: updated, added: added, rejected: rejected };
}
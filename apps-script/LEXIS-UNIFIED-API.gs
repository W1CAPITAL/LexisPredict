/**
 * LEXIS UNIFIED API — cole no Apps Script da planilha (ou acrescente ao LEXIS-SYNC).
 * Implantar como Web App: Executar como Eu / Acesso Qualquer pessoa.
 *
 * Aba obrigatória USUARIOS: id | username | nome | email | password_hash | role | empresa_id | ativo
 * (password_hash: use Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt+pass)))
 *
 * TOKEN: mesmo do desktop/web.
 */
var TOKEN = "troque-este-token";
var USERS_SHEET = "USUARIOS";
var PROCESSOS_SHEET = "Processos";

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || "{}");
    if (body.token !== TOKEN) {
      return json_({ ok: false, error: "token inválido" });
    }
    var action = String(body.action || "");
    if (action === "health") return json_({ ok: true, message: "lexis-unified" });
    if (action === "login") return login_(body);
    if (action === "sync_push") return syncPush_(body);
    if (action === "sync_pull") return syncPull_(body);
    // compat com script antigo de processos
    if (body.rows) return legacyUpsertProcessos_(body);
    return json_({ ok: false, error: "action desconhecida" });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet() {
  return json_({ ok: true, service: "lexis-unified", ts: new Date().toISOString() });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function login_(body) {
  var user = String(body.user || "").trim().toLowerCase();
  var pass = String(body.password || "");
  if (!user || !pass) return json_({ ok: false, error: "credenciais" });
  var sh = SpreadsheetApp.getActive().getSheetByName(USERS_SHEET);
  if (!sh) return json_({ ok: false, error: "aba USUARIOS ausente" });
  var data = sh.getDataRange().getValues();
  var head = data[0].map(function (h) {
    return String(h).toLowerCase().trim();
  });
  var iUser = head.indexOf("username");
  var iHash = head.indexOf("password_hash");
  var iNome = head.indexOf("nome");
  var iId = head.indexOf("id");
  var iRole = head.indexOf("role");
  var iEmp = head.indexOf("empresa_id");
  var iAtivo = head.indexOf("ativo");
  var iEmail = head.indexOf("email");
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    if (String(row[iUser] || "").toLowerCase().trim() !== user) continue;
    if (iAtivo >= 0 && String(row[iAtivo]).toLowerCase() === "false") {
      return json_({ ok: false, error: "usuário inativo" });
    }
    var hash = String(row[iHash] || "");
    var check = hashPassword_(pass, user);
    // aceita hash SHA256(user+pass) ou texto só em DEV (não use em produção)
    if (hash !== check && hash !== pass) {
      return json_({ ok: false, error: "senha inválida" });
    }
    return json_({
      ok: true,
      userId: String(row[iId] || user),
      name: String(row[iNome] || user),
      email: iEmail >= 0 ? String(row[iEmail] || "") : "",
      role: iRole >= 0 ? String(row[iRole] || "operador") : "operador",
      companyId: iEmp >= 0 ? String(row[iEmp] || "") : "",
      session: Utilities.getUuid(),
    });
  }
  return json_({ ok: false, error: "usuário não encontrado" });
}

function hashPassword_(pass, salt) {
  var raw = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + ":" + pass
  );
  return Utilities.base64Encode(raw);
}

function syncPush_(body) {
  // MVP: grava entity=processos na aba Processos por id/protocolo
  var records = body.records || [];
  var accepted = 0;
  var conflicts = [];
  var sh = SpreadsheetApp.getActive().getSheetByName(PROCESSOS_SHEET);
  if (!sh) return json_({ ok: false, error: "aba Processos ausente", accepted: 0, conflicts: [] });
  var data = sh.getDataRange().getValues();
  var head = data[0].map(String);
  var protoIdx = head.findIndex(function (h) {
    return /protocolo/i.test(h);
  });
  for (var i = 0; i < records.length; i++) {
    var rec = records[i];
    if (rec.entity && rec.entity !== "processos") continue;
    var p = rec.payload || {};
    var proto = String(p.protocolo || p.Protocolo || rec.id || "");
    if (!proto) continue;
    var found = -1;
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][protoIdx]) === proto) {
        found = r + 1;
        break;
      }
    }
    if (found < 0) {
      var newRow = head.map(function (h) {
        var k = h;
        return p[k] != null ? p[k] : p[k.toLowerCase()] != null ? p[k.toLowerCase()] : "";
      });
      sh.appendRow(newRow);
      accepted++;
    } else {
      for (var c = 0; c < head.length; c++) {
        var key = head[c];
        var val = p[key] != null ? p[key] : p[String(key).toLowerCase()];
        if (val != null && val !== "") sh.getRange(found, c + 1).setValue(val);
      }
      accepted++;
    }
  }
  return json_({ ok: true, accepted: accepted, conflicts: conflicts });
}

function syncPull_(body) {
  // MVP: devolve linhas da aba Processos como records
  var sh = SpreadsheetApp.getActive().getSheetByName(PROCESSOS_SHEET);
  if (!sh) return json_({ ok: true, records: [] });
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return json_({ ok: true, records: [] });
  var head = data[0].map(String);
  var records = [];
  for (var r = 1; r < data.length; r++) {
    var payload = {};
    for (var c = 0; c < head.length; c++) payload[head[c]] = data[r][c];
    var id = String(payload.Protocolo || payload.protocolo || r);
    records.push({
      id: id,
      entity: "processos",
      op: "upsert",
      payload: payload,
      updated_at: new Date().toISOString(),
      version: 1,
      device_id: "sheets",
    });
  }
  return json_({ ok: true, records: records });
}

function legacyUpsertProcessos_(body) {
  body.records = (body.rows || []).map(function (row) {
    return {
      id: row.Protocolo || row.protocolo,
      entity: "processos",
      op: "upsert",
      payload: row,
      version: 1,
      updated_at: new Date().toISOString(),
      device_id: "legacy",
    };
  });
  return syncPush_(body);
}

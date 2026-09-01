# Híbrido W1 — seus links

## Planilha
https://docs.google.com/spreadsheets/d/1qbuJee6DCv0bh9XGvnBDPltc0Ziphdn2yx11QKOnchc/edit

ID: `1qbuJee6DCv0bh9XGvnBDPltc0Ziphdn2yx11QKOnchc`

## Webhook (já responde ping em GET)
```
https://script.google.com/macros/s/AKfycbxro8UqTJUbFLSOFkpR3unyaBFX_FF-lOVc9_KBcJ8GP-fQmpTzAPRh7a1JLN4ECJMu/exec
```

Teste manual:
```
.../exec?action=ping&token=w1-fase1-2026
→ {"ok":true,"app":"lexis-gabinete-sync",...}
```

POST JSON puro → **HTTP 405** (só tem doGet ou POST bloqueado).  
O cliente Lexis usa **GET** + POST `text/plain` com fallback.

## Env Vercel
```
LEXIS_HYBRID_MODE=sheets_carteira_scan
LEXIS_SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/AKfycbxro8UqTJUbFLSOFkpR3unyaBFX_FF-lOVc9_KBcJ8GP-fQmpTzAPRh7a1JLN4ECJMu/exec
LEXIS_SHEETS_TOKEN=w1-fase1-2026
LEXIS_HYBRID_MIRROR_PG=false
LEXIS_HYBRID_SKIP_SCAN_AUDIT=true
```

## Apps Script — garantir doGet + doPost

No editor da planilha (Extensões → Apps Script), o `doGet` e o `doPost` devem ambos chamar o mesmo router.  
Depois: **Implantar → Gerenciar implantações → lápis → Nova versão → Qualquer pessoa**.

Trecho mínimo:

```javascript
function doGet(e) {
  return route(e && e.parameter ? e.parameter : {});
}
function doPost(e) {
  var body = {};
  try {
    body = JSON.parse((e.postData && e.postData.contents) || "{}");
  } catch (err) {
    body = (e && e.parameter) || {};
  }
  return route(body);
}
function route(p) {
  var token = "w1-fase1-2026";
  if (String(p.token || "") !== token) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "token" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  var action = String(p.action || "ping");
  if (action === "ping") {
    return ContentService.createTextOutput(JSON.stringify({ ok: true, app: "lexis-gabinete-sync", ts: new Date().toISOString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  // list / write — seu código atual
  ...
}
```

## Offline
O Gabinete offline pode usar o **mesmo** URL + token na tela de vínculo com a planilha.

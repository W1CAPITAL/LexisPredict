import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("safety mode is isolated behind a signed HttpOnly server session",()=>{
  const session=fs.readFileSync(new URL("../src/lib/hybrid/safety-session.ts",import.meta.url),"utf8");
  const actions=fs.readFileSync(new URL("../src/app/actions/safety-carteira-actions.ts",import.meta.url),"utf8");
  const middleware=fs.readFileSync(new URL("../middleware.ts",import.meta.url),"utf8");
  assert.match(session,/createHmac/);
  assert.match(session,/httpOnly:true/);
  assert.match(session,/timingSafeEqual/);
  assert.match(actions,/readSafetySession/);
  assert.match(middleware,/path === '\/modo-seguranca'/);
  assert.doesNotMatch(middleware,/lexis_safety/);
  assert.match(middleware,/\/api\/integration\/sheetspredict/);
});

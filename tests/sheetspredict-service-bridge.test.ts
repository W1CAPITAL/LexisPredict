import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('SheetsPredict bridge uses a dedicated service credential and a bounded capability surface',()=>{
  const route=fs.readFileSync(new URL('../src/app/api/integration/sheetspredict/route.ts',import.meta.url),'utf8');
  assert.match(route,/LEXISPREDICT_API_KEY/);
  assert.match(route,/timingSafeEqual/);
  assert.match(route,/capabilities:\['datajud','chat'\]/);
  assert.match(route,/tenantDataExposed:false/);
  assert.doesNotMatch(route,/SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(route,/process\.env\.NEXT_PUBLIC_/);
});

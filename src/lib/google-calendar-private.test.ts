import {describe,it,expect} from 'vitest';
import {encryptCalendarToken,decryptCalendarToken,googleEventId,googleCalendarEventPayload} from './google-calendar-private';

describe('Google Agenda OAuth privado e idempotente',()=>{
 const key=Buffer.alloc(32,17).toString('base64');
 it('criptografa o token e vincula ao usuário/empresa',()=>{
  const aad='empresa-1:usuario-2';
  const secret=encryptCalendarToken('refresh-token-secret',aad,key);
  expect(secret).not.toContain('refresh-token-secret');
  expect(decryptCalendarToken(secret,aad,key)).toBe('refresh-token-secret');
  expect(()=>decryptCalendarToken(secret,'outra-empresa:usuario-2',key)).toThrow();
 });
 it('gera IDs estáveis para não duplicar o mesmo compromisso no Google',()=>{
  const input={title:'Retorno processual',date:'2026-11-20',cnj:'8007617-77.2023.8.05.0154'};
  expect(googleEventId('user-1',input)).toBe(googleEventId('user-1',input));
  expect(googleEventId('user-1',{...input,date:'2026-11-21'})).not.toBe(googleEventId('user-1',input));
  expect(googleEventId('user-1',input)).toMatch(/^[a-v0-9]{5,1024}$/);
 });
 it('preserva o fuso Brasil e não envia detalhes do processo além do que foi confirmado',()=>{
  const e=googleCalendarEventPayload('user-1',{title:'Retorno',date:'2026-11-20',time:'09:30',cnj:'8007617-77.2023.8.05.0154'});
  expect(e.start.dateTime).toBe('2026-11-20T09:30:00');
  expect(e.start.timeZone).toBe('America/Sao_Paulo');
  expect(e).not.toHaveProperty('attendees');
 });
});

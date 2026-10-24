import {describe,expect,it} from 'vitest';
import {
  normalizeWhatsAppPhone,
  buildWhatsAppWebSendLink
} from './whatsapp-links';

describe('WhatsApp Web browser handoff',()=>{
 it('builds a WhatsApp Web URL on the operator own browser session',()=>{
  const raw=buildWhatsAppWebSendLink({phone:'(11) 98888-7777',text:'Olá, sua mensagem está pronta.'});
  const url=new URL(raw);
  expect(url.origin).toBe('https://web.whatsapp.com');
  expect(url.pathname).toBe('/send');
  expect(url.searchParams.get('phone')).toBe('5511988887777');
  expect(url.searchParams.get('text')).toBe('Olá, sua mensagem está pronta.');
 });
 it('keeps valid international phones and never double-prefixes country code',()=>{
  expect(normalizeWhatsAppPhone('5511988887777')).toBe('5511988887777');
  expect(new URL(buildWhatsAppWebSendLink({phone:'5511988887777'})).searchParams.get('phone')).toBe('5511988887777');
 });
 it('rejects malformed or missing targets and avoids implicit send',()=>{
  expect(()=>buildWhatsAppWebSendLink({phone:'abc'})).toThrow(/inválido/);
  const link=buildWhatsAppWebSendLink({phone:'11988887777',text:'revisar'});
  expect(link).not.toContain('auto_send');
  expect(link).not.toContain('dispatch');
 });
});

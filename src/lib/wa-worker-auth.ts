import {createHmac,timingSafeEqual} from 'node:crypto';

type WorkerIdentity={userId:string;empresaId:string;issuedAt:number;expiresAt:number;purpose:'portfolio-notice'};
const PREFIX='lexiswa1';
const signature=(body:string,key:string)=>createHmac('sha256',key).update(PREFIX+'.'+body).digest('base64url');
/** Short lived assertion for the existing Lexis -> WA.Auto auth callback.
 * Never issued by a public endpoint; caller has already verified queue ownership. */
export function signWaWorkerIdentity(userId:string,empresaId:string,key:string,now=Date.now()) {
  if(key.length<16)throw new Error('Credencial de integração indisponível');
  const issuedAt=Math.floor(now/1000);
  const body=Buffer.from(JSON.stringify({userId,empresaId,issuedAt,expiresAt:issuedAt+90,purpose:'portfolio-notice'})).toString('base64url');
  return PREFIX+'.'+body+'.'+signature(body,key);
}
export function verifyWaWorkerIdentity(token:string,key:string,now=Date.now()):WorkerIdentity|null {
  if(key.length<16||token.length>1500)return null;
  const [prefix,body,sig,...extra]=token.split('.');
  if(prefix!==PREFIX||!body||!sig||extra.length)return null;
  const expected=signature(body,key);
  if(expected.length!==sig.length||!timingSafeEqual(Buffer.from(expected),Buffer.from(sig)))return null;
  try {
    const value=JSON.parse(Buffer.from(body,'base64url').toString('utf8')) as WorkerIdentity;
    const seconds=Math.floor(now/1000),uuid=/^[0-9a-f-]{36}$/i;
    if(value.purpose!=='portfolio-notice'||!uuid.test(value.userId)||!uuid.test(value.empresaId)||
      !Number.isInteger(value.issuedAt)||!Number.isInteger(value.expiresAt)||
      value.expiresAt<=seconds||value.issuedAt>seconds+5||value.expiresAt-value.issuedAt!==90)return null;
    return value;
  } catch {return null;}
}

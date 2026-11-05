import {describe,expect,it} from 'vitest';
import {EXPERIENCE_DEFAULT,cleanExperiencePrefs} from './experience-prefs';
import {getCertificateProvider,certificateProviders,recommendedCertificateType} from './oab-certificate-providers';

describe('Certificados OAB via aplicativos locais',()=>{
 it('mantém preferências anteriores sem assumir uma credencial instalada',()=>{
  const previous=cleanExperiencePrefs({oabCertificateType:'a3'});
  expect(previous.oabCertificateProvider).toBe('auto');
  expect(EXPERIENCE_DEFAULT.oabCertificateProvider).toBe('auto');
 });
 it('oferece VIDaaS Connect, PJeOffice Pro, Bird ID e repositório local',()=>{
  const ids=certificateProviders.map(p=>p.id);
  for(const id of ['auto','vidaas','pjeoffice','birdid','windows'])expect(ids).toContain(id);
  expect(getCertificateProvider('vidaas').setupUrl).toMatch(/^https:\/\//);
  expect(getCertificateProvider('pjeoffice').type).toBe('signer');
 });
 it('recusa uma URL ou código malicioso no campo provedor',()=>{
  expect(cleanExperiencePrefs({oabCertificateProvider:'https://evil.example'}).oabCertificateProvider).toBe('auto');
  expect(cleanExperiencePrefs({oabCertificateProvider:'../../cert.pfx'}).oabCertificateProvider).toBe('auto');
 });
 it('salva escolha de provedor legítimo, sem chamar isso de sessão conectada',()=>{
  for(const id of ['vidaas','pjeoffice','birdid','windows'] as const){
   expect(cleanExperiencePrefs({oabCertificateProvider:id}).oabCertificateProvider).toBe(id);
   expect(getCertificateProvider(id).connectionVerified).toBe(false);
  }
 });
 it('pré-seleciona A3 quando o advogado escolhe um certificado em nuvem',()=>{
   expect(recommendedCertificateType('vidaas','none')).toBe('a3');
   expect(recommendedCertificateType('birdid','a1')).toBe('a3');
   expect(recommendedCertificateType('pjeoffice','a1')).toBe('a1');
   expect(recommendedCertificateType('windows','none')).toBe('none');
 });
 it('não inclui endpoints locais ou leitura de chave privada na configuração',()=>{
  for(const provider of certificateProviders){
   expect(provider.setupUrl).toMatch(/^https:\/\//);
   expect(provider).not.toHaveProperty('privateKey');
   expect(provider).not.toHaveProperty('localEndpoint');
  }
 });
});
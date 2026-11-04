import {describe,it,expect} from 'vitest';
import {cleanExperiencePrefs,EXPERIENCE_DEFAULT} from './experience-prefs';
import {resolveOabOfficialPortal} from './oab-user-flow';

describe('Personalização da consulta OAB',()=>{
 it('mantém preferências compatíveis com perfis antigos',()=>{
  const prefs=cleanExperiencePrefs({theme:'minimal-steel'});
  expect(prefs.oabCertificateType).toBe('none');
  expect(prefs.oabPreferredTribunal).toBe('');
  expect(prefs.oabDefaultDocuments).toBe('contestacao');
  expect(prefs.oabShowGuide).toBe(true);
  expect(EXPERIENCE_DEFAULT.oabCertificateType).toBe('none');
 });
 it('não permite arquivo de certificado, senha, URL ou script em campos OAB',()=>{
  const prefs=cleanExperiencePrefs({
    oabCertificateType:'../../pfx',
    oabNumber:'370.898<script>',
    oabUf:'../../',
    oabPreferredTribunal:'https://example.com',
    oabDefaultDocuments:'ambos',
    oabShowGuide:false
  });
  expect(prefs.oabCertificateType).toBe('none');
  expect(prefs.oabNumber).toBe('370898');
  expect(prefs.oabUf).toBe('');
  expect(prefs.oabPreferredTribunal).toBe('');
  expect(prefs.oabDefaultDocuments).toBe('contestacao');
  expect(prefs.oabShowGuide).toBe(false);
 });
 it('preserva sufixo válido de inscrição OAB, como 52996-A',()=>{
   expect(cleanExperiencePrefs({oabNumber:'52996-A'}).oabNumber).toBe('52996A');
 });
 it('direciona o CNJ ao tribunal real e jamais substitui pelo favorito escolhido',()=>{
  const portal=resolveOabOfficialPortal('8007617-77.2023.8.05.0154','8.26');
  expect(portal?.tribunal).toBe('TJBA');
  expect(portal?.isFallback).toBe(false);
  expect(portal?.url.startsWith('https://')).toBe(true);
 });
 it('permite abrir tribunal favorito quando o CNJ ainda não foi informado',()=>{
  const portal=resolveOabOfficialPortal('','8.26');
  expect(portal?.tribunal).toBe('TJSP');
  expect(portal?.isFallback).toBe(true);
  expect(portal?.url.includes('.jus.br')).toBe(true);
 });
 it('nunca presume acesso com certificado a partir de link de consulta pública',()=>{
  const portal=resolveOabOfficialPortal('8007617-77.2023.8.05.0154','8.26');
  expect(portal?.requiresUserAuth).toBe(true);
  expect(portal?.portalIsPublicConsultation).toBe(true);
  expect(portal?.authenticatedUrl).toBe('https://pje.tjba.jus.br/pje/login.seam');
  expect(portal?.secondDegreeAuthenticatedUrl).toBe('https://pje2g.tjba.jus.br/pje/login.seam');
 });
});
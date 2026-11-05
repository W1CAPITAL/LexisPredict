/** Preferências de provedor; não representam conexão, token ou certificado acessível
 * ao navegador. PJeOffice e fornecedores devem ser acionados pelo tribunal
 * autorizado, no dispositivo do advogado.
 */
export type OabCertificateProviderId='auto'|'pjeoffice'|'vidaas'|'birdid'|'windows';
export type OabCertificateProvider={
 id:OabCertificateProviderId;
 label:string;
 type:'automatic'|'signer'|'cloud'|'system';
 description:string;
 setupUrl:string;
 instruction:string;
 connectionVerified:false;
};
export const certificateProviders:readonly OabCertificateProvider[]=[
 {
  id:'auto',label:'Usar o certificado configurado no tribunal',
  type:'automatic',description:'Recomendado para quem já utiliza o PJe com seu assinador habitual.',
  setupUrl:'https://docs.pje.jus.br/servicos-negociais/pjeoffice-pro/',
  instruction:'No portal oficial, escolha “Acessar com certificado”. O PJeOffice ou assinador autorizado seleciona o certificado já configurado.',
  connectionVerified:false,
 },
 {
  id:'pjeoffice',label:'PJeOffice Pro',
  type:'signer',description:'Assinador gratuito do CNJ: utiliza certificados A1, A3 e repositório Windows conforme a configuração local.',
  setupUrl:'https://pjeoffice.trf3.jus.br/pjeoffice-pro/docs/userguide.html',
  instruction:'No PJeOffice Pro, configure seu certificado e ative “Memorizar este certificado como padrão”. Depois entre no PJe pelo botão de certificado.',
  connectionVerified:false,
 },
 {
  id:'vidaas',label:'VIDaaS Connect · Valid',
  type:'cloud',description:'Certificado em nuvem vinculado ao aplicativo VIDaaS/VIDaaS Connect no computador.',
  setupUrl:'https://validcertificadora.com.br/pages/o-que-e-o-vidaas-connect',
  instruction:'Instale e autorize seu certificado no VIDaaS Connect. No tribunal compatível, escolha o certificado disponibilizado pelo sistema e aprove a autenticação no aplicativo.',
  connectionVerified:false,
 },
 {
  id:'birdid',label:'Bird ID Desktop · Soluti',
  type:'cloud',description:'Certificado em nuvem acessado pelo Bird ID Desktop com autorização pelo celular.',
  setupUrl:'https://soluti.com.br/duvidas-e-suporte/suporte-certificado-em-nuvem/',
  instruction:'Configure o Bird ID Desktop. No tribunal compatível, selecione o certificado no assinador e confirme a solicitação no Bird ID do celular.',
  connectionVerified:false,
 },
 {
  id:'windows',label:'Certificado instalado / token A1 ou A3',
  type:'system',description:'Usa o repositório do Windows ou drivers do token/cartão reconhecidos pelo PJeOffice.',
  setupUrl:'https://pjeoffice.trf3.jus.br/pjeoffice-pro/docs/userguide.html',
  instruction:'Instale seu A1 no repositório do sistema ou os drivers do token A3. No PJeOffice, selecione o certificado detectado e marque como padrão.',
  connectionVerified:false,
 },
] as const;

export function getCertificateProvider(value:string):OabCertificateProvider{
 return certificateProviders.find(x=>x.id===value)||certificateProviders[0];
}

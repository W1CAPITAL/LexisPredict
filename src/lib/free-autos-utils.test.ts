import {describe,it,expect} from 'vitest';
import {classifyLocalAutosDocument,selectAutosThroughDefesa,findOfficialAutosPortal,normalizeAutasFilename} from './free-autos-utils';

describe('autos via portal oficial (gratuito; somente navegador)',()=>{
 it('usa URL segura e oficial para o CNJ de tribunal estadual conhecido',()=>{
   const found=findOfficialAutosPortal('8007617-77.2023.8.05.0154');
   expect(found?.url.startsWith('https://')).toBe(true);
   expect(found?.tribunal).toBe('TJBA');
   expect(found?.sistema).toBe('pje');
 });
 it('não cria endereço a partir de CNJ inválido ou não mapeado',()=>{
   expect(findOfficialAutosPortal('123')).toBeNull();
   expect(findOfficialAutosPortal('1234567-89.2026.1.99.9999')).toBeNull();
 });
 it('diferencia contestação da réplica ou impugnação à contestação',()=>{
   expect(classifyLocalAutosDocument('002 - Contestação - Banco.pdf').kind).toBe('contestacao');
   expect(classifyLocalAutosDocument('003 - Réplica à Contestação.pdf').kind).toBe('outro');
   expect(classifyLocalAutosDocument('Impugnação à Contestação.pdf').kind).toBe('outro');
 });
 it('detecta contestação apenas quando o título ou início de peça traz identificação',()=>{
   expect(classifyLocalAutosDocument('002 - documento.pdf','CONTESTAÇÃO\nBanco requerido vem apresentar sua defesa.').kind).toBe('contestacao');
   expect(classifyLocalAutosDocument('documento.pdf','O autor aguardou contestação em março.').kind).toBe('outro');
 });
 it('classifica a inicial e mantém anexos até a contestação em ordem jurídica',()=>{
   const items=['003 Contestação.pdf','002 Contrato.pdf','001 Petição Inicial.pdf','004 Réplica.pdf'].map((filename,index)=>({
     id:String(index),filename,bytes:new Uint8Array([1]),kind:classifyLocalAutosDocument(filename).kind
   }));
   const result=selectAutosThroughDefesa(items);
   expect(result.files.map(item=>item.filename)).toEqual(['001 Petição Inicial.pdf','002 Contrato.pdf','003 Contestação.pdf']);
   expect(result.foundContestacao).toBe(true);
   expect(result.bankDefendantConfirmed).toBe(false);
 });
 it('não afirma haver contestação quando só há autos parciais',()=>{
   const result=selectAutosThroughDefesa([{id:'1',filename:'001 Inicial.pdf',bytes:new Uint8Array([1]),kind:'inicial' as const}]);
   expect(result.foundContestacao).toBe(false);
 });
 it('não interpreta um PDF consolidado como peças individuais completas',()=>{
   const result=classifyLocalAutosDocument('autos-processuais-completos.pdf');
   expect(result.isConsolidated).toBe(true);
 });
 it('não corta peças se os nomes dos arquivos não garantem a cronologia',()=>{
   const docs=['Contestação.pdf','Petição Inicial.pdf','Contrato.pdf'].map((filename,index)=>({
     id:String(index),filename,kind:classifyLocalAutosDocument(filename).kind
   }));
   const picked=selectAutosThroughDefesa(docs);
   expect(picked.limitedByMetadata).toBe(true);
   expect(picked.files).toHaveLength(3);
   expect(picked.cutoffApplied).toBe(false);
 });
 it('higieniza caminhos de ZIP sem confiar nos caminhos enviados',()=>{
   expect(normalizeAutasFilename('../segredo/001-Peticao.pdf')).toBe('001-Peticao.pdf');
   expect(normalizeAutasFilename('..\\segredo\\002 Contestação.pdf')).toBe('002 Contestação.pdf');
 });
});
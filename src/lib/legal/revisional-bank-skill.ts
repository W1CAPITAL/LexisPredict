export type RateUnit='monthly'|'annual';
export type Guarantee='real'|'none'|'unknown';
export type BcbSeriesChoice={code:number|null;unit:RateUnit;label:string;reason:string;requiresOfficialValidation:true};
const POST_SPLIT='2025-11-01';
function norm(v:string){return String(v||'').toLowerCase().normalize('NFD').replace(/\p{M}/gu,' ').replace(/\s+/g,' ').trim()}
export function isBankRevisionalIntent(input:string){
  const q=norm(input);
  const bank=/(contrato banc|emprest|credito pessoal|consign|financ|cet|bacen|taxa de juros|capitaliza|parcela|mora|indebito)/.test(q);
  const review=/(revis|juros abus|juros alt|reduz.*parcela|taxa media|cobranca indevida|reequilibr)/.test(q);
  return bank&&review;
}
export function selectPersonalCreditBcbSeries(opts:{contractDate?:string;unit?:RateUnit;guarantee?:Guarantee;debtComposition?:boolean}):BcbSeriesChoice{
  const unit=opts.unit||'monthly',date=String(opts.contractDate||'').slice(0,10);
  if(opts.debtComposition){
    if(unit==='monthly')return{code:25465,unit,label:'Crédito pessoal não consignado vinculado à composição de dívidas',reason:'Modalidade própria; validar aderência ao contrato.',requiresOfficialValidation:true};
    return{code:null,unit,label:'Composição de dívidas',reason:'Localizar a série anual oficial específica; não aproximar pela série genérica.',requiresOfficialValidation:true};
  }
  if(date&&date>=POST_SPLIT){
    const g=opts.guarantee||'unknown';
    if(g==='unknown')return{code:null,unit,label:'Crédito pessoal não consignado pós-11/2025',reason:'Identificar se há garantia real antes da seleção.',requiresOfficialValidation:true};
    if(g==='real')return{code:unit==='monthly'?29976:29973,unit,label:'Crédito pessoal não consignado com garantias reais',reason:'Taxonomia BACEN pós-11/2025.',requiresOfficialValidation:true};
    return{code:unit==='monthly'?29977:29974,unit,label:'Crédito pessoal não consignado sem garantias reais',reason:'Taxonomia BACEN pós-11/2025.',requiresOfficialValidation:true};
  }
  return{code:unit==='monthly'?25464:20742,unit,label:'Crédito pessoal não consignado (histórico)',reason:'Série histórica pré-divisão; validar período/modalidade.',requiresOfficialValidation:true};
}
export function compareRates(contractRate:number,referenceRate:number){
  if(!Number.isFinite(contractRate)||!Number.isFinite(referenceRate)||referenceRate<=0)return null;
  return{absolutePoints:contractRate-referenceRate,ratio:contractRate/referenceRate,excessPercent:(contractRate/referenceRate-1)*100};
}
export function effectiveAnnualFromMonthly(monthlyPct:number){return (Math.pow(1+monthlyPct/100,12)-1)*100}
export function effectiveMonthlyFromAnnual(annualPct:number){return (Math.pow(1+annualPct/100,1/12)-1)*100}
export function pricePayment(principal:number,monthlyPct:number,periods:number){
  if(!Number.isFinite(principal)||principal<0||!Number.isFinite(periods)||periods<=0)return null;
  const n=Math.floor(periods),i=monthlyPct/100;if(!Number.isFinite(i)||i<0)return null;if(i===0)return principal/n;
  return principal*i/(1-Math.pow(1+i,-n));
}
export function revisionalBankContext(prompt:string){
  if(!isBankRevisionalIntent(prompt))return '';
  return [
    'SKILL REVISÃO BANCÁRIA v2 ATIVA.',
    'Classifique modalidade/data/PF-PJ/consignação/garantia antes de BACEN; pós-11/2025 não escolha série sem saber a garantia.',
    'Para PF não consignado: histórico 25464 a.m./20742 a.a.; desde 11/2025 sem garantia 29977 a.m./29974 a.a.; com garantia 29976 a.m./29973 a.a. Revalide metadados oficiais.',
    'Separe normalidade/mora e taxa nominal/CET. A média BACEN é referencial, não teto. Não conclua abusividade apenas pela diferença.',
    'Confirme jurisprudência atual do STJ e legislação antes de sustentar tese; diferencie fato, cálculo, fonte oficial, inferência e dado faltante.',
    'Conversões devem ser compostas; simulação deve respeitar Price/SAC/outro sistema e explicitar premissas.',
    'Estruture a resposta em diagnóstico, quadro do contrato, BACEN, cálculo, análise jurídica, provas faltantes e próximo artefato.'
  ].join(' ');
}

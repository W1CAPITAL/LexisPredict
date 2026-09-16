import JSZip from "jszip";
import type { ProcessoDjenReal } from "@/lib/revisional-tribunal-filtros";

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const esc = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const text = (v: unknown): string => v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
function col(n: number) { let s=''; for(n++;n>0;n=Math.floor((n-1)/26)) s=String.fromCharCode(65+(n-1)%26)+s; return s; }
const H = ['Processo (CNJ)','Cliente / Autor','Telefone','Email','CPF','Placa','RENAVAM','Sem advogado','Tipo B.A.','Inicio do processo','Flags','Classe','Tribunal','Data DJEN','Situacao','Link DJEN','Teor (resumo)','Base local (match)','Tel. base local','CPF base local','Nome base local','Email base local','Situacao do cruzamento'];

export async function xlsxProcessosDjenReal(lista: ProcessoDjenReal[]): Promise<Blob> {
  const sheets: Array<{name:string;headers:string[];rows:unknown[][]}> = [{name:'BA_DJEN',headers:H,rows:lista.map(p=>[
    p.processo,p.nome_completo,p.telefone,p.email,p.cpf,p.placa,p.renavam,p.sem_advogado||'NAO',p.tipo_ba,p.ba_inicio||'NAO',p.flags,p.classe,p.tribunal,p.data,p.situacao_hint,p.link,p.assunto_ou_teor,
    p.base_local_match,p.base_local_telefone,p.base_local_cpf,p.base_local_nome,p.base_local_email,p.base_local_status
  ])}];
  const records = lista.flatMap(p=>(p.base_local_registros||[]).map(r=>({processo:p.processo,match:p.base_local_match,record:r})));
  if(records.length) {
    const fields=Array.from(new Set(records.flatMap(r=>Object.keys(r.record.campos))));
    sheets.push({name:'BASE_LOCAL',headers:['Processo (CNJ)','Correspondencia','Arquivo de origem','Tabela','Registro na fonte',...fields],rows:records.map(({processo,match,record:r})=>[processo,match,r.fonte,r.tabela,r.linha,...fields.map(h=>r.campos[h])])});
  }
  const longValues:unknown[][]=[];
  function worksheet(sheet:typeof sheets[number], allowLong=true) {
    const {headers,rows}=sheet;
    if(headers.length>16384 || rows.length>1048575) throw new Error('Quantidade de colunas/linhas excede o limite do Excel. Exporte um lote menor.');
    const xml=[headers,...rows].map((values,i)=>`<row r="${i+1}" ht="${i===0?32:48}" customHeight="1">${values.map((v,j)=>{
      let value=text(v);
      if(value.length>30000 && allowLong) {
        const id=`${sheet.name}!${col(j)}${i+1}`;
        for(let start=0,part=1;start<value.length;part++) {
          let end=Math.min(start+30000,value.length);
          if(end<value.length && /[\uD800-\uDBFF]/.test(value[end-1])) end--;
          longValues.push([id,part,value.slice(start,end)]);start=end;
        }
        value=`Conteudo completo em VALORES_LONGOS: ${id}`;
      }
      return `<c r="${col(j)}${i+1}" s="${i===0?1:2}" t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
    }).join('')}</row>`).join('');
    const end=`${col(headers.length-1)}${rows.length+1}`;
    return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${NS}"><dimension ref="A1:${end}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="20"/><cols>${headers.map((h,i)=>`<col min="${i+1}" max="${i+1}" width="${/teor|resumo|email|nome|autor/i.test(h)?36:24}" customWidth="1"/>`).join('')}</cols><sheetData>${xml}</sheetData><autoFilter ref="A1:${end}"/></worksheet>`;
  }
  const xmlSheets=sheets.map(s=>worksheet(s));
  if(longValues.length) { const s={name:'VALORES_LONGOS',headers:['Celula de origem','Parte','Conteudo'],rows:longValues}; sheets.push(s);xmlSheets.push(worksheet(s,false)); }
  const wb=`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${NS}" xmlns:r="${REL}"><sheets>${sheets.map((s,i)=>`<sheet name="${s.name}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`;
  const rels=`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const wbRels=`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="${REL}/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="${REL}/styles" Target="styles.xml"/></Relationships>`;
  const ct=`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
  const styles = `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF173C35"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="49" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const zip=new JSZip();
  zip.file('xl/styles.xml',styles); zip.file('[Content_Types].xml',ct);zip.file('_rels/.rels',rels);
  zip.file('xl/workbook.xml',wb);zip.file('xl/_rels/workbook.xml.rels',wbRels);
  xmlSheets.forEach((s,i)=>zip.file(`xl/worksheets/sheet${i+1}.xml`,s));
  return zip.generateAsync({type:'blob',compression:'DEFLATE',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}

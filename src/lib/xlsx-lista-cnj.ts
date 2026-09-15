import JSZip from "jszip";
import type { ProcessoDjenReal } from "@/lib/revisional-tribunal-filtros";

function esc(s: string) {
  return String(s ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "").slice(0, 32767).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function cell(col: string, row: number, val: string) {
  return `<c r="${col}${row}" s="${row === 1 ? 1 : 2}" t="inlineStr"><is><t xml:space="preserve">${esc(val)}</t></is></c>`;
}

/** Cabeçalhos legíveis para operação */
const H = [
  "Processo (CNJ)",
  "Cliente / Autor",
  "Telefone",
  "Email",
  "CPF",
  "Placa",
  "RENAVAM",
  "Sem advogado",
  "Tipo B.A.",
  "Inicio do processo",
  "Flags",
  "Classe",
  "Tribunal",
  "Data DJEN",
  "Situacao",
  "Link DJEN",
  "Teor (resumo)",
] as const;

const C = "ABCDEFGHIJKLMNOPQ".split("");

export async function xlsxProcessosDjenReal(lista: ProcessoDjenReal[]): Promise<Blob> {
  const header = `<row r="1" ht="32" customHeight="1">${H.map((h,i)=>cell(C[i],1,h)).join("")}</row>`;
  const data = lista.map((p, idx) => {
    const r = idx + 2;
    const vals = [
      p.processo,
      p.nome_completo,
      p.telefone,
      p.email,
      p.cpf,
      p.placa || "",
      p.renavam || "",
      p.sem_advogado || "NAO",
      p.tipo_ba || "",
      p.ba_inicio || "NAO",
      p.flags || "",
      p.classe,
      p.tribunal,
      p.data,
      p.situacao_hint,
      p.link,
      p.assunto_ou_teor,
    ];
    return `<row r="${r}" ht="60" customHeight="1">${vals.map((v,i)=>cell(C[i],r,String(v??""))).join("")}</row>`;
  }).join("");
  const last = Math.max(1, lista.length + 1);
  const widths = [26, 34, 21, 32, 18, 14, 17, 18, 16, 22, 46, 35, 12, 16, 36, 50, 80];
  const cols = widths.map((width, i) => `<col min="${i+1}" max="${i+1}" width="${width}" customWidth="1"/>`).join("");
  const sheet = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:Q${last}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="20"/><cols>${cols}</cols><sheetData>${header}${data}</sheetData><autoFilter ref="A1:Q${last}"/></worksheet>`;
  const wb = `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="BA_DJEN" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const rels = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const wbRels = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const ct = `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
  const styles = `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF173C35"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="49" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const zip = new JSZip();
  zip.file("xl/styles.xml", styles);
  zip.file("[Content_Types].xml", ct);
  zip.folder("_rels")!.file(".rels", rels);
  zip.folder("xl")!.file("workbook.xml", wb);
  zip.folder("xl")!.folder("_rels")!.file("workbook.xml.rels", wbRels);
  zip.folder("xl")!.folder("worksheets")!.file("sheet1.xml", sheet);
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

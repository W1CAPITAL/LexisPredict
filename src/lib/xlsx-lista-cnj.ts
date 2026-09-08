import JSZip from "jszip";
import type { ProcessoDjenReal } from "@/lib/revisional-tribunal-filtros";

function esc(s: string) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function cell(col: string, row: number, val: string) {
  return `<c r="${col}${row}" t="inlineStr"><is><t>${esc(val)}</t></is></c>`;
}
const H = ["processo","nome_completo","telefone","telefone_fonte","classe","tribunal","data","situacao_hint","link","teor"] as const;
const C = ["A","B","C","D","E","F","G","H","I","J"];

export async function xlsxProcessosDjenReal(lista: ProcessoDjenReal[]): Promise<Blob> {
  const header = `<row r="1">${H.map((h,i)=>cell(C[i],1,h)).join("")}</row>`;
  const data = lista.map((p, idx) => {
    const r = idx + 2;
    const vals = [p.processo,p.nome_completo,p.telefone,p.telefone_fonte,p.classe,p.tribunal,p.data,p.situacao_hint,p.link,p.assunto_ou_teor];
    return `<row r="${r}">${vals.map((v,i)=>cell(C[i],r,String(v??""))).join("")}</row>`;
  }).join("");
  const sheet = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${header}${data}</sheetData></worksheet>`;
  const wb = `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="djen" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const rels = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const wbRels = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;
  const ct = `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;
  const zip = new JSZip();
  zip.file("[Content_Types].xml", ct);
  zip.folder("_rels")!.file(".rels", rels);
  zip.folder("xl")!.file("workbook.xml", wb);
  zip.folder("xl")!.folder("_rels")!.file("workbook.xml.rels", wbRels);
  zip.folder("xl")!.folder("worksheets")!.file("sheet1.xml", sheet);
  return zip.generateAsync({ type: "blob" });
}

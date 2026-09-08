/** XLSX mínimo (SheetJS-free) — CNJ + nome completo + classe/assunto/situação */

import JSZip from "jszip";
import type { ProcessoGerado } from "@/lib/revisional-tribunal-filtros";

function esc(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function cell(col: string, row: number, val: string) {
  return `<c r="${col}${row}" t="inlineStr"><is><t>${esc(val)}</t></is></c>`;
}

const HEADERS = [
  "processo",
  "nome_completo",
  "classe",
  "assunto",
  "situacao",
  "filtros",
] as const;

const COLS = ["A", "B", "C", "D", "E", "F"];

/** Só CNJ (compatível com versão antiga) */
export async function xlsxSoCnj(cnjsFmt: string[]): Promise<Blob> {
  const rows = cnjsFmt.map((v) => ({
    processo: v,
    nome_completo: "",
    classe: "",
    assunto: "",
    situacao: "",
    filtros: "",
  }));
  return xlsxProcessosGerados(rows);
}

/** Planilha completa revisional */
export async function xlsxProcessosGerados(lista: ProcessoGerado[]): Promise<Blob> {
  const headerRow =
    `<row r="1">` +
    HEADERS.map((h, i) => cell(COLS[i], 1, h)).join("") +
    `</row>`;

  const dataRows = lista
    .map((p, idx) => {
      const r = idx + 2;
      const vals = [
        p.processo,
        p.nome_completo,
        p.classe,
        p.assunto,
        p.situacao,
        p.filtros || "",
      ];
      return (
        `<row r="${r}">` +
        vals.map((v, i) => cell(COLS[i], r, v)).join("") +
        `</row>`
      );
    })
    .join("");

  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${headerRow}${dataRows}</sheetData>
</worksheet>`;

  const wb = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="revisional" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

  const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

  const zip = new JSZip();
  zip.file("[Content_Types].xml", ct);
  zip.folder("_rels")!.file(".rels", rels);
  zip.folder("xl")!.file("workbook.xml", wb);
  zip.folder("xl")!.folder("_rels")!.file("workbook.xml.rels", wbRels);
  zip.folder("xl")!.folder("worksheets")!.file("sheet1.xml", sheet);
  return zip.generateAsync({ type: "blob" });
}

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');
import JSZip from 'jszip';
import { LidxReader } from './lidx-local';
import { xlsxProcessosDjenReal } from './xlsx-lista-cnj';
import type { ProcessoDjenReal } from './revisional-tribunal-filtros';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lidx-test-'));
const builderPath=path.resolve('tools/lidx-local/build-lidx.mjs');
const {build,csvRows,cpfKey}=await import(builderPath);
let reader:LidxReader;
beforeAll(async()=>{
  const db=new DatabaseSync(path.join(dir,'sample.db'));
  db.exec('CREATE TABLE SPT_USERS (CPF_NUMBER TEXT, NAME TEXT, TELEPHONE_MOBILE TEXT, TELEPHONE TEXT, EMAIL TEXT, EXTRA TEXT, BIG_ID INTEGER, FOTO BLOB, GENERATED TEXT GENERATED ALWAYS AS (NAME || \'!\') VIRTUAL)');
  const insert=db.prepare('INSERT INTO SPT_USERS(CPF_NUMBER,NAME,TELEPHONE_MOBILE,TELEPHONE,EMAIL,EXTRA,BIG_ID,FOTO) VALUES(?,?,?,?,?,?,?,?)');
  insert.run('00000000001','Pessoa Teste Um','','11999990000','um@example.invalid','linha\n"dupla",😀',9007199254740993n,new Uint8Array([1,2,255]));
  insert.run('00000000002','Homônimo Teste','','','','',1,null);
  insert.run('00000000003','Homonimo Teste','','','','',2,null);
  insert.run(null,'Registro Sem CPF','','','','',3,null);
  db.close();
  fs.writeFileSync(path.join(dir,'sample.csv'),'\uFEFFCPF,NOME,EMAIL,OUTRA_COLUNA\r\n00000000001,"Pessoa Teste Um",outro@example.invalid,"texto, com ""aspas""\r\ne acento á"\r\n');
  await build({output:path.join(dir,'index.lidx'),sources:[{path:path.join(dir,'sample.db')},{path:path.join(dir,'sample.csv')}]},()=>{});
  reader=new LidxReader(new Blob([fs.readFileSync(path.join(dir,'index.lidx'))])); await reader.open();
});
afterAll(()=>fs.rmSync(dir,{recursive:true,force:true}));
describe('LIDX local',()=>{
  it('preserva todas as colunas, CPF com zero, inteiros e blobs das duas fontes',async()=>{
    const m=await reader.lookup({cpf:'000.000.000-01'});
    expect(m.status).toBe('CPF'); expect(m.registros).toHaveLength(2);
    const db=m.registros.find(r=>r.tabela==='SPT_USERS')!;
    expect(Object.keys(db.campos)).toHaveLength(9);
    expect(db.campos.BIG_ID).toBe('9007199254740993');
    expect(db.campos.FOTO).toEqual({tipo:'blob',base64:'AQL/'});
    expect(db.campos.GENERATED).toBe('Pessoa Teste Um!');
    expect(db.campos.EXTRA).toBe('linha\n"dupla",😀');
    expect(m.telefone).toBe('11999990000');
    expect(m.registros.find(r=>!r.tabela)?.campos.OUTRA_COLUNA).toBe('texto, com "aspas"\r\ne acento á');
  });
  it('encontra nome unico e inclui fontes com o mesmo CPF',async()=>{
    expect((await reader.lookup({nome:'  Péssoa  teste um '})).registros).toHaveLength(2);
    expect((await reader.lookup({nome:'Registro Sem CPF'})).status).toBe('NOME');
  });
  it('nao mistura homonimos nem substitui CPF divergente pelo nome',async()=>{
    expect((await reader.lookup({nome:'Homonimo Teste'})).status).toBe('AMBIGUO');
    const m=await reader.lookup({cpf:'00000000009',nome:'Pessoa Teste Um'});
    expect(m.status).toBe('NAO_ENCONTRADO'); expect(m.registros).toEqual([]); expect(m.telefone).toBe('');
  });
  it('parser preserva Unicode/aspas/newlines mesmo em chunks de um byte',async()=>{
    const rows=[];for await(const r of csvRows(path.join(dir,'sample.csv'),{chunkSize:1})) rows.push(r);
    expect(rows).toHaveLength(2);expect(rows[1][3]).toBe('texto, com "aspas"\r\ne acento á');
  });
  it('CSV invalido falha sem publicar indice parcial',async()=>{
    fs.writeFileSync(path.join(dir,'bad.csv'),'CPF,NOME\n123,Dois,Extra\n');
    await expect(build({output:path.join(dir,'bad.lidx'),sources:[{path:path.join(dir,'bad.csv')}]},()=>{})).rejects.toThrow('Colunas divergentes');
    expect(fs.existsSync(path.join(dir,'bad.lidx'))).toBe(false);expect(fs.existsSync(path.join(dir,'bad.lidx.lock'))).toBe(false);
  });
  it('nao sobrescreve saida nem remove temporarios preexistentes',async()=>{
    await expect(build({output:path.join(dir,'index.lidx'),sources:[{path:path.join(dir,'sample.csv')}]},()=>{})).rejects.toThrow('Saida ja existe');
    fs.writeFileSync(path.join(dir,'old.lidx.part'),'preservar');
    await expect(build({output:path.join(dir,'old.lidx'),sources:[{path:path.join(dir,'sample.csv')}]},()=>{})).rejects.toThrow('interrompido');
    expect(fs.readFileSync(path.join(dir,'old.lidx.part'),'utf8')).toBe('preservar');
  });
  it('cancela e remove somente os temporarios da execucao',async()=>{
    fs.writeFileSync(path.join(dir,'cancel.flag'),'1');
    await expect(build({output:path.join(dir,'cancel.lidx'),cancelFile:path.join(dir,'cancel.flag'),sources:[{path:path.join(dir,'sample.csv')}]},()=>{})).rejects.toThrow('Cancelado');
    expect(fs.existsSync(path.join(dir,'cancel.lidx'))).toBe(false);
  });
  it('rejeita LIDX v1 e arquivo truncado',async()=>{
    await expect(new LidxReader(new Blob(['LIDX'+ ' '.repeat(60)])).open()).rejects.toThrow('v2');
    await expect(new LidxReader(new Blob(['LIDX2'])).open()).rejects.toThrow('incompleto');
  });
  it('consulta arquivo maior por partes e mantem iterator valido no Node 22',async()=>{
    const rows=['CPF,NAME,EXTRA'];
    for(let i=0;i<12000;i++) rows.push(`${String(70000000000+i)},Pessoa teste ${i},${String(i).repeat(30)}`);
    fs.writeFileSync(path.join(dir,'large.csv'),rows.join('\n'));
    await build({output:path.join(dir,'large.lidx'),sources:[{path:path.join(dir,'large.csv')}]},()=>{});
    const file=new Blob([fs.readFileSync(path.join(dir,'large.lidx'))]);
    const local=new LidxReader(file);await local.open();
    expect((await local.lookup({cpf:'70000011999'})).registros[0].campos.NAME).toBe('Pessoa teste 11999');
    expect(local.bytesRead).toBeLessThan(file.size);
  });
  it('normaliza zeros perdidos apenas quando os verificadores conferem',()=>{
    const padded='01234567890';
    // Mesmo sem usar um CPF real, os verificadores desta sequencia sao validos.
    expect(cpfKey('1234567890')).toBe(padded);
    expect(cpfKey('1234567899')).toBe('');
  });
  it('XLSX mantem todas as colunas e divide conteudo longo sem perder texto',async()=>{
    const m=await reader.lookup({cpf:'00000000001'});
    m.registros[0].campos.LONGO='a'.repeat(60001);
    const p={processo:'TESTE',nome_completo:'Pessoa',base_local_match:m.status,base_local_registros:m.registros,base_local_telefone:m.telefone} as ProcessoDjenReal;
    const zip=await JSZip.loadAsync(await (await xlsxProcessosDjenReal([p])).arrayBuffer());
    expect(await zip.file('xl/workbook.xml')!.async('string')).toContain('BASE_LOCAL');
    expect(await zip.file('xl/worksheets/sheet2.xml')!.async('string')).toContain('OUTRA_COLUNA');
    expect(await zip.file('xl/worksheets/sheet2.xml')!.async('string')).toContain('00000000001');
    const long=await zip.file('xl/worksheets/sheet3.xml')!.async('string');
    expect((long.match(/>a+<\//g)||[]).map(s=>s.slice(1,-2)).join('')).toBe('a'.repeat(60001));
  });
});

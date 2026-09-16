/** LIDX v2: blocos gzip + indice fixo ordenado; nenhuma leitura integral da base. */
export type LocalRecord = { fonte: string; tabela: string; linha: number; campos: Record<string, unknown> };
export type LocalMatch = { status: 'CPF' | 'NOME' | 'NAO_ENCONTRADO' | 'AMBIGUO'; registros: LocalRecord[]; cpf: string; nome: string; telefone: string; email: string };
type Schema = { fonte: string; tabela: string; colunas: string[]; cpf: number; nome: number };
type Row = { s: number; r: number; v: unknown[] };
const norm = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const cpf = (v: unknown) => { let s = String(v ?? '').replace(/\D/g, '');
  if (s.length === 9 || s.length === 10) {
    const padded = s.padStart(11, '0');
    const valid = !/^(\d)\1+$/.test(padded) && [9, 10].every(n => {
      let sum = 0; for (let j = 0; j < n; j++) sum += Number(padded[j]) * (n + 1 - j);
      return (sum * 10 % 11) % 10 === Number(padded[n]);
    });
    if (valid) s = padded;
  }
  return s.length === 11 ? s : ''; };
const empty = (status: LocalMatch['status']): LocalMatch => ({ status, registros: [], cpf: '', nome: '', telefone: '', email: '' });
const compare = (a: Uint8Array, b: Uint8Array) => { for (let i=0; i<16; i++) if(a[i]!==b[i]) return a[i]-b[i]; return 0; };

export class LidxReader {
  private index = 0;
  private count = 0;
  private metaOffset = 0;
  private schemas: Schema[] = [];
  private pages = new Map<number, Uint8Array>();
  private blocks = new Map<number, Row[]>();
  public bytesRead = 0;
  constructor(private file: Blob) {}
  private async read(start: number, length: number) {
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(length) || start<0 || length<0 || start+length>this.file.size) throw new Error('Indice LIDX incompleto ou corrompido.');
    const b = new Uint8Array(await this.file.slice(start, start+length).arrayBuffer());
    this.bytesRead += b.length; return b;
  }
  async open() {
    const h = await this.read(0,64), view = new DataView(h.buffer);
    if(new TextDecoder().decode(h.subarray(0,8)) !== 'LIDX2\r\n\0') throw new Error('Selecione um indice LIDX v2. Para arquivos antigos, execute o novo GERAR-INDICE.bat.');
    const n = (p:number) => { const v=Number(view.getBigUint64(p,true)); if(!Number.isSafeInteger(v)) throw new Error('Indice acima do tamanho suportado.'); return v; };
    this.index=n(8); this.count=n(16); this.metaOffset=n(24); const len=n(32);
    if(this.index<64 || this.index+this.count*32!==this.metaOffset || this.metaOffset+len!==this.file.size || len>32*1024*1024) throw new Error('Estrutura LIDX invalida.');
    const meta=JSON.parse(new TextDecoder().decode(await this.read(this.metaOffset,len)));
    if(meta.version!==2 || !Array.isArray(meta.schemas)) throw new Error('Metadados LIDX invalidos.');
    this.schemas=meta.schemas; return meta as { registros:number; schemas:Schema[] };
  }
  private async entry(i:number) {
    const page = Math.floor(i/2048), start=this.index+page*65536;
    let b=this.pages.get(page);
    if(!b) {
      b=await this.read(start,Math.min(65536,this.metaOffset-start));
      if(this.pages.size>=64) this.pages.delete(this.pages.keys().next().value!);
      this.pages.set(page,b);
    }
    return b.subarray((i%2048)*32,(i%2048)*32+32);
  }
  private async find(key:string):Promise<Row[] | null> {
    const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key))).subarray(0,16);
    let lo=0,hi=this.count;
    while(lo<hi) { const mid=Math.floor((lo+hi)/2); if(compare((await this.entry(mid)).subarray(0,16),digest)<0) lo=mid+1; else hi=mid; }
    const rows:Row[]=[];
    for(let i=lo;i<this.count;i++) {
      const e=await this.entry(i); if(compare(e.subarray(0,16),digest)!==0) break;
      if(i-lo>=1000) return null; // Sem aceitar silenciosamente uma lista incompleta.
      const dv=new DataView(e.buffer,e.byteOffset,e.byteLength), offset=Number(dv.getBigUint64(16,true)), length=dv.getUint32(24,true), pos=dv.getUint32(28,true);
      if(offset<64 || length>16*1024*1024 || offset+length>this.index) throw new Error('Bloco LIDX invalido.');
      let block=this.blocks.get(offset);
      if(!block) {
        const compressed=await this.read(offset,length);
        const stream=new Blob([compressed as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
        const reader=stream.getReader(); const parts:Uint8Array[]=[]; let size=0;
        for(;;) { const {done,value}=await reader.read(); if(done) break; size+=value.length; if(size>16*1024*1024) { await reader.cancel(); throw new Error('Bloco descompactado acima do limite.'); } parts.push(value); }
        block=JSON.parse(await new Blob(parts as BlobPart[]).text()) as Row[];
        // No maximo quatro blocos: memoria limitada mesmo com registros grandes.
        if(this.blocks.size>=4) this.blocks.delete(this.blocks.keys().next().value!);
        this.blocks.set(offset,block);
      }
      const r=block[pos], s=this.schemas[r?.s];
      if(!r || !s || !Array.isArray(r.v) || r.v.length!==s.colunas.length) throw new Error('Registro LIDX invalido.');
      const actual=key.startsWith('cpf:')?'cpf:'+cpf(r.v[s.cpf]):'nome:'+norm(r.v[s.nome]);
      if(actual===key) rows.push(r); // Confirma a chave completa, nao apenas seu hash.
    }
    return rows;
  }
  async lookup(query:{cpf?:string;nome?:string}):Promise<LocalMatch> {
    const c=cpf(query.cpf), n=norm(query.nome);
    // CPF informado e ausente nao pode ser substituido por um homonimo.
    if(!c && !n) return empty('NAO_ENCONTRADO');
    let rows=await this.find(c?'cpf:'+c:'nome:'+n);
    if(rows===null) return empty('AMBIGUO');
    if(!rows.length) return empty('NAO_ENCONTRADO');
    if(!c) {
      const identities=new Set(rows.map(r=>cpf(r.v[this.schemas[r.s].cpf])));
      if(identities.size!==1 || (identities.has('') && rows.length!==1)) return empty('AMBIGUO');
      if(!identities.has('')) {
        const byCpf=await this.find('cpf:'+Array.from(identities)[0]);
        if(byCpf===null) return empty('AMBIGUO');
        rows=byCpf;
      } // Inclui todas as fontes/versoes dessa mesma identidade.
    }
    const records=rows.map(r=>({fonte:this.schemas[r.s].fonte,tabela:this.schemas[r.s].tabela,linha:r.r,campos:Object.fromEntries(this.schemas[r.s].colunas.map((h,i)=>[h,r.v[i]]))}));
    const pick=(names:string[])=>{ for(const name of names) for(const r of records) for(const [k,v] of Object.entries(r.campos)) if(k.trim().toUpperCase()===name && String(v??'').trim()) return String(v).trim(); return ''; };
    return {status:c?'CPF':'NOME',registros:records,cpf:pick(['CPF_NUMBER','CPF']),nome:pick(['NAME','NOME']),telefone:pick(['TELEPHONE_MOBILE','TELEPHONE','TELEPHONE_MOBILE2','TELEPHONE_MOBILE3','TELEFONE','CELULAR']),email:pick(['EMAIL','EMAIL_OPTIONAL'])};
  }
}

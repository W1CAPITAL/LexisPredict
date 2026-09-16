# Cruzamento local no gerador

Patch sobre `6500a823630a67abe25fc5b23bb8852e3f6cef6a`.

O modo **Índice comprimido .lidx** acrescenta consulta local ao gerador. Não usa
Supabase, API de enriquecimento ou upload das bases. O File escolhido fica em um
Web Worker; o leitor acessa somente páginas do índice e blocos correspondentes.
Os modos CSV/DB/OPFS anteriores permanecem disponíveis; a preservação de todas
as colunas e a detecção de homônimos deste patch pertencem ao novo modo LIDX.

## Instalar

Copie o conteúdo de `GITHUB/` para a raiz do repositório e publique pelo fluxo
habitual. Não há nova dependência de produção. O gerador Windows está em
`WINDOWS/`; use o Node portátil indicado no `config.json`. Não copie suas bases
ou o índice para o repositório. O app exige navegador moderno com Web Workers,
Web Crypto e DecompressionStream (Chrome/Edge atual, por exemplo).

## Arquivos

- `next.config.ts`: impede que o bundle de navegador do sql.js tente resolver
  o módulo Node `fs`, corrigindo a compilação das páginas de bases locais.
- `src/lib/lidx-local.ts`: leitor binário por partes, correspondência por CPF e
  nome normalizado, detecção de homônimos, recuperação de todas as colunas.
- `src/workers/lidx-local.worker.ts`: consulta fora da thread da interface.
- `src/app/gerador-processos/page.tsx`: seleção do índice, progresso, cancelamento
  e envio dos registros locais ao exportador; corrige estados CSV/DB ausentes
  que já causavam erros de TypeScript no gerador.
- `src/lib/revisional-tribunal-filtros.ts`: tipos dos campos e registros locais.
- `src/lib/xlsx-lista-cnj.ts`: abas BA_DJEN, BASE_LOCAL e VALORES_LONGOS, com
  filtros, cabeçalhos congelados e CPF/telefone mantidos como texto.
- `src/lib/lidx-local.test.ts`: testes de SQLite/CSV, homônimos, preservação,
  leitura parcial, falhas, cancelamento e XLSX.
- `tools/lidx-local/`: fonte do iniciador e construtor Windows, também entregue
  separadamente na pasta WINDOWS para uso direto.

## Formato

LIDX v2: cabeçalho de 64 bytes; magic `LIDX2\r\n\0`; quatro uint64 LE em offsets
8,16,24,32 (início do índice, quantidade de entradas, início e tamanho dos
metadados). Blocos gzip contêm `{s,r,v}`: schema, número do registro e valores.
Índice ordenado: hash SHA-256 truncado em 16 bytes + offset uint64 + tamanho
comprimido uint32 + posição no bloco uint32 (32 bytes por entrada).
Metadados JSON contêm nomes das fontes/tabelas e cabeçalhos originais.
O hash serve para localizar; o leitor confirma a chave completa no registro.
SQLite INTEGER é serializado como texto decimal sem perda de precisão; BLOB
como objeto `{tipo:"blob",base64:"..."}`. O arquivo é publicado só após concluir.

Para testar: `npm run typecheck` e `npx vitest run src/lib/lidx-local.test.ts`.
O teste do construtor precisa de Node com `node:sqlite` (22.14.0 ou 24).

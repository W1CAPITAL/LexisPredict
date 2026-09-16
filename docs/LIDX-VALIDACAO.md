# Validação deste lote

- Node 22.14.0: 11 testes de integração passaram (construtor, leitor e XLSX).
- `tsc --noEmit`: passou no repositório completo.
- `next build`: passou com os avisos existentes de dependências/lint.
- CSVs enviados: 10.500 registros; 58 e 38 colunas preservadas. Índice com
  1.853.561 bytes. Construção e checagens amostrais levaram cerca de 0,7 segundo
  neste ambiente; isso não estima o tempo da base completa no computador Windows.
- Comparação de 108 registros encontrados com os CSVs: valores de todas as
  colunas conferiram, incluindo chaves com zero inicial. Nenhum dado dessas
  amostras está incluído no ZIP.
- `.bat`: ASCII sem BOM e quebras CRLF verificadas. Launcher PowerShell revisto;
  execução real em Windows não disponível neste ambiente (testes em Linux).
- O teste B.A. já existente `não presume veículo para B.A. genérica ou assunto
  sem B.A.` falha na versão atual do repositório. Os arquivos de classificação
  B.A. não foram alterados neste lote; não se declara a suíte inteira aprovada.
- Nenhum deploy ou alteração de banco de produção foi realizado.

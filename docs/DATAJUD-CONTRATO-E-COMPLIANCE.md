# DataJud: contrato público, limites e uso no LexisPredict

## 1. Consulta por CNJ

O contrato técnico público usado pelo cliente é:

```http
POST https://api-publica.datajud.cnj.jus.br/api_publica_{alias}/_search
Authorization: ApiKey <chave pública vigente do CNJ>
Content-Type: application/json
```

Payload por número único:

```json
{
  "size": 1,
  "query": {
    "match": {
      "numeroProcesso": "00008323520184013202"
    }
  }
}
```

O número deve ser normalizado para 20 dígitos. O alias não pode ser presumido como TJSP: ele é resolvido pelos segmentos J/TR da numeração CNJ e pelo catálogo oficial de endpoints. Códigos sem alias público conhecido retornam `unknown_jurisdiction`, sem disparar uma consulta para outro tribunal.

## 2. Busca por pessoa

A API pública não documenta filtros por CPF, CNPJ ou OAB. A pesquisa por nome de parte também não é oferecida como contrato geral de consulta. O fluxo do produto é:

1. pesquisar CPF/CNPJ/nome nos dados locais da carteira;
2. localizar o número CNJ já cadastrado ou obtido em fonte oficial do tribunal;
3. consultar DataJud pelo CNJ, somente quando o uso estiver autorizado.

A Portaria CNJ 374/2026 prevê a disponibilização de polo ativo/passivo quando as partes forem pessoas jurídicas. Isso não cria filtros de CPF/CNPJ/OAB nem autoriza extrair documentos de pessoas físicas. O cliente normaliza somente nomes de polos empresariais se esses campos vierem na resposta.

## 3. Restrição de uso

A Portaria CNJ 374/2026 estabelece que a API pública se destina a usos legais, autorizados e não comerciais, e veda venda ou exploração comercial dos dados. LexisPredict é um produto comercial; por isso:

- `DATAJUD_USE_AUTHORIZED` fica desativada por padrão;
- nenhuma chamada DataJud é feita em produção enquanto não houver autorização formal aplicável ou alteração normativa que permita esse uso;
- não habilitar essa variável apenas para contornar a restrição;
- Hermes continua usando DJEN e APIs oficiais de tribunal que tenham contrato de acesso compatível.

Referência normativa: https://atos.cnj.jus.br/atos/detalhar/6972

## 4. Chave, alias e resposta

Quando o uso for juridicamente permitido, o cliente:
- normaliza `APIKey` e `Authorization: APIKey` antes de enviar o cabeçalho;
- consulta a Wiki oficial após 401/403 e repete no máximo uma vez com a chave pública rotacionada;
- respeita HTTP 429 sem retry imediato, mantendo o processo pendente para nova janela;
- guarda `dataHoraUltimaAtualizacao` e `@timestamp` do documento;
- distingue resposta 200 sem hit, timeout interno do Elasticsearch, shard failure, 401/403, 429 e erro de rede.

A Portaria 374/2026 prevê remessa diária pelos tribunais, com período de adequação de 180 dias. Isso não significa atualização em tempo real nem autoriza presumir um atraso fixo de 30 dias. A idade do registro deve ser exibida com base nos timestamps efetivamente retornados.

## 5. Auditoria de latência

A auditoria usa o alias verdadeiro do CNJ (por exemplo, `trf1`, `tjpr`, `stj`, `tst`, `tre-sp`), não o segmento sequencial OOOO. Mede sucesso da API separadamente de existência do processo no índice: HTTP 200 com zero hits significa endpoint acessível e processo não localizado no índice, não tribunal offline.

A verificação é server-side e só aceita CNJs já vinculados à empresa autenticada. A chave pública nunca é enviada ao navegador.

## 6. Fontes complementares

- DJEN: publicações nacionais; não equivale ao histórico integral dos autos.
- TJPR SCMPP/MNI: tentativa de consulta pública automatizada para CNJs 8.16, respeitando a Resolução TJPR 532-OE/2026 e sem ler complementos ou processos sigilosos. A resposta HTTP/XML precisa ser validada; 401/403/429 ou XML inválido são fonte não confirmada.
- Outros portais com login, CAPTCHA ou WAF não são automatizados nem têm seus controles contornados. Só entram novas integrações quando houver API oficial e autorização técnica correspondente.

Documentação:
- API pública e endpoints DataJud: https://datajud-wiki.cnj.jus.br/api-publica/
- Acesso e chave pública: https://datajud-wiki.cnj.jus.br/api-publica/acesso/
- Endpoints/aliases: https://datajud-wiki.cnj.jus.br/api-publica/endpoints/
- Resolução TJPR 532-OE/2026: https://portal.tjpr.jus.br/pesquisa_athos/anexo/7150778

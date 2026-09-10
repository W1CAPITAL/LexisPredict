# ICP: consumidor (não vendedor)

Queremos pessoas que **contrataram** ou **devem**:
- financiamento de veículo
- refinanciamento
- empréstimo pessoal
- consignado
- consórcio
- seguro auto
- intenção de revisão de juros

**Não** queremos:
- anúncio “vendo carro” (OLX vendedor)
- loja / concessionária
- cargos B2B estilo Apollo (Head of Sales, VP Sales…)

## Fontes OK
1. Formulário inbound com opt-in (produto + cidade + WhatsApp)
2. CSV legítimo próprio / parceiro com consentimento
3. Sinais públicos de intenção de **devedor/consumidor** (reclamação de parcela, juros) + contato só se público no mesmo contexto

## Fontes NÃO usadas neste módulo
- Scraper OLX / Apollo não autorizado
- Listas frias compradas

## CSV modelo
```
nome,telefone,email,produto,interesse,cidade,consentimento,origem,observacoes
Maria Silva,11999999999,,financiamento_veiculo,parcela alta,São Paulo,sim,parceiro,financiou 2023
```

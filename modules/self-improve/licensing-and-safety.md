# Licenças e segurança

## Política de incorporação

- MIT / Apache-2.0: integração possível, preservando notices/licença aplicável.
- GPL-3.0 / AGPL-3.0: não copiar/incorporar ao LexisPredict comercial sem análise jurídica da licença.
- NOASSERTION / sem licença: referência arquitetural apenas.
- Sempre preferir API, padrão arquitetural, teste ou inspiração visual a copiar código.

## Segurança do LexisPredict

Nunca permitir que o loop de melhoria:
- exponha `service_role` no client;
- enfraqueça RLS;
- converta `pending` em `active` sem fluxo comercial;
- permita Operador/Administrador ver processos alheios;
- transforme edição em atendimento;
- envie PII bruta para observabilidade externa;
- use stealth browser para burlar proteções de tribunal;
- faça prospecção fria de pessoas a partir de CNJ/DJEN.

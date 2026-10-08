# Colibri no LexisPredict W1

O [Colibri](https://github.com/JustVugg/colibri) é motor nativo em C (Apache-2.0), executado em equipamento/servidor próprio. Exige RAM e espaço para modelos (mínimo documentado: 8 GB RAM e 22 GB disco) e não é executável como função serverless Vercel.

## Usar

1. Hospede Colibri externamente seguindo seu README e execute seu servidor API compatível com OpenAI (`/v1`).
2. Proteja o serviço com HTTPS e autenticação; trate documentos como informação confidencial.
3. Configure no projeto W1 Vercel, somente envs server-side: `COLIBRI_BASE_URL=https://seu-servidor.example/v1`, `COLIBRI_MODEL=auto` (ou ID do modelo real), `COLIBRI_API_KEY` se aplicável e `COLIBRI_TIMEOUT_MS=35000` opcional.
4. Faça redeploy e escolha "Colibri próprio" no Assistente. Cascata automática usa Colibri se configurado e faz fallback para provedores externos; se não configurado, pula sem atraso.

`http://127.0.0.1:8000` não serve na Vercel: seria localhost da função, não o computador da empresa. Em produção só HTTPS é aceito. Nenhuma chave ou banco adicional é necessário até que exista um endpoint de inferência real.

Correções independentes: a preferência "omni" era forçada para Claude e erros extensos de crédito do provedor eram expostos na conversa. O modo automático não força um provedor, e as falhas são exibidas como indisponibilidade, não como uma resposta jurídica.

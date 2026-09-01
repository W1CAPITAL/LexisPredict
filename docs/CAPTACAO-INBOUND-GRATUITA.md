# Captação inbound 100% gratuita (sem CNPJ, sem Google/Meta Ads)

## Link público
```
https://SEU-DOMINIO/#captacao
```

Compartilhe no Instagram (bio), WhatsApp Status, site do escritório, Google Meu Negócio (grátis).

**Google Ads não é obrigatório.** Campanhas de app pedem iOS/Android; você não precisa disso — este funil é **web + link**.

## O que faz
1. Formulário com **opt-in LGPD** (obrigatório)
2. Consulta **BACEN SGS** (API pública, sem chave)
3. Grava lead no CRM (Supabase) ou localStorage
4. Botão WhatsApp da equipe (opcional `VITE_OFFICE_WHATSAPP`)

## Variáveis opcionais (Vercel)
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=   # ou ANON + INBOUND_OWNER_ID
INBOUND_OWNER_ID=            # uuid do dono dos leads no CRM
VITE_OFFICE_WHATSAPP=11999999999
```

## APIs
- `GET /api/bacen-sgs?produto=veiculos|pessoal|consignado&data=2024-03`
- `POST /api/inbound-lead` body JSON com name, phone, consent:true

## Ética
Publicidade **passiva** (OAB 205/2021). Não envia mensagem a quem não preencheu o form.

# Sherlock + Vercel

## Seus env atuais
```
SHERLOCK_ENABLED=true
SHERLOCK_API_URL=http://127.0.0.1:8000
```

### Production / Preview no Vercel
`127.0.0.1` = máquina **do servidor Vercel**, não o seu notebook.
A busca em produção vai falhar com “API inacessível”.

### Quando 127.0.0.1 funciona
- `npm run dev` **no seu PC**
- API Sherlock rodando no mesmo PC (`python manage.py runserver 8000`)

### Produção de verdade
- URL pública da API, **ou**
- Deixe `SHERLOCK_ENABLED=false` em Production e use só em local

Sherlock e enrichment são **opcionais**. O gerador DJEN não depende deles.

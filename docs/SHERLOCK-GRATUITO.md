# Sherlock gratuito

```bash
git clone https://github.com/sherlock-project/api.git
cd api && pip install -r requirements.txt
python manage.py migrate && python manage.py runserver 0.0.0.0:8000
```

```env
SHERLOCK_ENABLED=true
SHERLOCK_API_URL=http://127.0.0.1:8000
```

Só perfis públicos por username derivado do nome — não CPF/telefone.

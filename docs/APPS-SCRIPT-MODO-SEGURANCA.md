# Modo segurança — planilha Usuarios

Quando o Supabase estoura cota, o Lexis entra pela aba Usuarios.
Colunas: login nome senha perfil escritorio ativo email auth_user_id id
Senha no script e SHA-256.
Env: LEXIS_SHEETS_WEBHOOK_URL e LEXIS_SHEETS_TOKEN.
Fluxo: login Supabase; se quota/rede, action=auth na planilha; banner; sync quando o banco volta.

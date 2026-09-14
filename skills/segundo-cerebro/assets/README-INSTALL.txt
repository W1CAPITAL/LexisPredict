Segundo Cerebro — instalar no Grok

1. Copie a pasta segundo-cerebro para:
   ~/.grok/skills/segundo-cerebro
   ou /home/workdir/.grok/skills/segundo-cerebro

2. Vault (criado automaticamente):
   ~/documentos/segundo cerebro

3. Teste:
   bash scripts/vault_path.sh
   python3 scripts/recall.py --query "lexis gerador"
   python3 scripts/capture.py --title "teste" --body "ok" --folder inbox --tags vault

A skill dispara sozinha em tarefa nova, notas, vault, harness, memoria.

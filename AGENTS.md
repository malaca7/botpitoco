# Instruções do Workspace Pitoco de Gente

## REGRA MANDATÓRIA DE FINALIZAÇÃO DE TAREFAS
Sempre que terminar completamente de fazer todas as tarefas e modificações solicitadas pelo usuário:
1. Nunca encerre sem fazer o deploy completo se houver alterações de código ou configurações.
2. Execute automaticamente o script de deploy completo:
   ```bash
   node autoDeployAll.mjs -m "tipo(escopo): descricao das modificacoes"
   ```
3. Este script executa ponta a ponta:
   - Build do frontend SPA Vite
   - Git commit e push para todos os remotes (`main`, `source`, `gh-pages`)
   - Commit do bot no Discloud (`pitoco`)
   - Rebuild do bot no Discloud
   - Restart do bot no Discloud
   - Verificação de saúde em `https://pitoco.discloud.app/health`

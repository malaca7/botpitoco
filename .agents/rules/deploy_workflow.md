# Diretriz Obrigatória de Conclusão de Tarefas (Pitoco de Gente)

## REGRA FUNDAMENTAL E INVIOLÁVEL
**Sempre que terminar completamente de fazer todas as tarefas e modificações**, o assistente DEVE OBRIGATORIAMENTE executar de forma automática o fluxo completo de:
1. **Build do Frontend** (produção Vite com rotas SPA e CNAME).
2. **Git Commit & Push** (adicionar todas as alterações de código e sincronizar branches `main`, `source` e `gh-pages` com os remotes).
3. **Commit no Bot na Discloud** (enviar pacote compactado atualizado via API `/v2/app/pitoco/commit`).
4. **Rebuild no Bot na Discloud** (recompilar e reinstalar dependências no container via `/v2/app/pitoco/rebuild`).
5. **Reiniciar o Bot na Discloud** (executar restart do container via `/v2/app/pitoco/restart`).
6. **Verificação de Saúde** (confirmar que `https://pitoco.discloud.app/health` ou status da API está online).

---

## 1. Processamento de Queued Messages
- Antes do deploy final, verifique se há novas **Queued Messages** (mensagens pendentes na fila) enviadas pelo usuário.
- Se houver mensagem pendente na fila, processe-a imediatamente e execute as modificações solicitadas.
- **Assim que NÃO houver mais nenhuma Queued Message pendente e todo o trabalho estiver concluído**, execute AUTOMATICAMENTE o deploy completo antes de encerrar o turno.

---

## 2. Comando Único de Execução
Execute no terminal da workspace:
```bash
node autoDeployAll.mjs -m "tipo(escopo): descricao clara das alteracoes realizadas"
```
*(ou `npm run deploy -- -m "descricao"`)*

Esse comando já orquestra de forma automatizada e segura:
- `npm run build`
- `git add -A` e `git commit -m "..."`
- `git push` para `main`, `source` e `gh-pages` nos remotes configurados (`botpitoco` e `origin`)
- Compactação do pacote do bot (`pitoco.zip`)
- Upload de commit para a Discloud (`PUT /v2/app/pitoco/commit`)
- Rebuild do container (`PUT /v2/app/pitoco/rebuild`)
- Restart do container (`PUT /v2/app/pitoco/restart`)
- Polling de verificação de disponibilidade (`https://pitoco.discloud.app/health`)

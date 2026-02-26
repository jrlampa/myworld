# 🔒 Security Checklist para Desenvolvedores

Este checklist garante que o código do SIS RUA Unified mantém os mais altos padrões de segurança.

---

## 📋 Checklist Pré-Commit

### Código Fonte

- [ ] **Nenhum secret/senha hardcoded no código**
  - Verificar `git diff` antes do commit
  - Usar variáveis de ambiente para secrets
  - Nunca commitar `.env` (apenas `.env.example`)

- [ ] **Nenhum arquivo executável (.exe, .dll) commitado**
  - Executáveis devem ser gerados em build time, não commitados
  - Verificar `.gitignore` está atualizado

- [ ] **Input validation implementada**
  - Todos os endpoints validam entrada com Zod ou similar
  - Coordenadas validadas para ranges corretos
  - Tamanhos de arquivo verificados

- [ ] **Sanitização de output**
  - Dados de usuário escapados antes de exibição
  - SQL injection prevenido (usar ORMs/prepared statements)
  - XSS prevenido (React já faz isso automaticamente)

- [ ] **Error handling não expõe informações sensíveis**
  - Stack traces não visíveis em produção
  - Mensagens de erro genéricas para usuários
  - Logs detalhados apenas em arquivos de log

### Dependências

- [ ] **`npm audit` executado e vulnerabilidades corrigidas**
  ```bash
  npm audit
  npm audit fix
  ```

- [ ] **`pip-audit` executado (se modificou Python)**
  ```bash
  pip install pip-audit
  pip-audit
  ```

- [ ] **Dependências atualizadas regularmente**
  - Verificar versões desatualizadas: `npm outdated`
  - Atualizar com cuidado: `npm update`

- [ ] **Nenhuma dependência de fonte não confiável**
  - Apenas pacotes de npm/PyPI oficiais
  - Verificar mantainers e download stats

### Scripts e Automação

- [ ] **Scripts PowerShell documentados com comentários de segurança**
  - Explicar o que cada script faz
  - Adicionar avisos sobre falsos positivos de antivírus
  - Incluir URL do repositório oficial

- [ ] **Nenhum uso de `eval()` ou `Function()` em JavaScript**
  - Risco de code injection
  - Usar alternativas seguras

- [ ] **Comandos shell sanitizados**
  - Usar `spawn()` com arrays ao invés de `exec()` com strings
  - Validar todos os argumentos

### Comunicação de Rede

- [ ] **HTTPS usado para todas as APIs externas**
  - OSM, GROQ, APIs de elevação

- [ ] **Rate limiting configurado**
  - Previne abuse e DoS

- [ ] **CORS configurado corretamente**
  - Produção: apenas origins específicas
  - Desenvolvimento: localhost apenas

- [ ] **Secrets não logados**
  - API keys mascaradas em logs
  - Usar logger que suporta redação automática

---

## 🔍 Checklist de Code Review

### Segurança

- [ ] Nenhum comentário contém informação sensível (senhas, IPs internos)
- [ ] Autenticação/autorização implementada onde necessário
- [ ] Tokens/sessions têm expiração adequada
- [ ] Uploads de arquivo validam tipo e tamanho
- [ ] Paths de arquivo não permitem directory traversal (`../../../etc/passwd`)

### Performance

- [ ] Queries de banco otimizadas (sem N+1)
- [ ] Cache usado onde apropriado
- [ ] Timeouts configurados para operações longas
- [ ] Recursos liberados adequadamente (conexões, file handles)

### Qualidade de Código

- [ ] Código segue padrões do projeto (ESLint, Prettier)
- [ ] Testes adicionados/atualizados
- [ ] Documentação atualizada
- [ ] Nenhum código morto (dead code)
- [ ] Nenhum console.log() esquecido (usar logger adequado)

---

## 🧪 Checklist Pré-Deploy

### Testes

- [ ] **Todos os testes unitários passando**
  ```bash
  npm run test:backend
  npm run test:frontend
  ```

- [ ] **Testes E2E passando**
  ```bash
  npm run test:e2e
  ```

- [ ] **Testes de segurança executados**
  ```bash
  npm audit
  pip-audit
  ```

### Build

- [ ] **Build de produção funciona sem erros**
  ```bash
  npm run build
  ```

- [ ] **Dockerfile builds sem erros**
  ```bash
  docker build -t sisrua-test .
  ```

- [ ] **Imagem Docker testada localmente**
  ```bash
  docker run -p 8080:8080 sisrua-test
  ```

### Configuração

- [ ] **Variáveis de ambiente documentadas**
  - `.env.example` atualizado
  - README lista todas as variáveis necessárias

- [ ] **Secrets configurados no ambiente de deploy**
  - GitHub Secrets para CI/CD
  - GCP Secret Manager para produção

- [ ] **Health check endpoint funciona**
  ```bash
  curl http://localhost:8080/health
  ```

### Documentação

- [ ] **CHANGELOG atualizado**
- [ ] **README reflete mudanças**
- [ ] **API documentation atualizada (Swagger)**
- [ ] **Comentários de código adequados**

---

## 🚨 Checklist de Resposta a Incidentes

### Detecção

- [ ] Antivírus bloqueou um arquivo?
  - ✅ Verificar se é falso positivo
  - ✅ Consultar SECURITY_ANTIVIRUS_GUIDE.md
  - ✅ Reportar se for ameaça real

- [ ] Comportamento anormal detectado?
  - ✅ Verificar logs em `logs/`
  - ✅ Monitorar uso de CPU/memória
  - ✅ Verificar tráfego de rede

### Análise

- [ ] Identificar arquivo/processo suspeito
- [ ] Calcular hash SHA-256
- [ ] Verificar em VirusTotal
- [ ] Comparar com versão conhecida boa
- [ ] Determinar origem (commit, download, geração)

### Contenção

- [ ] Isolar sistema afetado (desconectar rede se necessário)
- [ ] Parar processos suspeitos
- [ ] Fazer backup de evidências
- [ ] Notificar time de segurança

### Erradicação

- [ ] Remover arquivos maliciosos
- [ ] Atualizar dependências vulneráveis
- [ ] Aplicar patches de segurança
- [ ] Resetar secrets comprometidos

### Recuperação

- [ ] Restaurar de backup se necessário
- [ ] Verificar integridade do sistema
- [ ] Re-executar testes de segurança
- [ ] Monitorar por 24-48h

### Lições Aprendidas

- [ ] Documentar incidente
- [ ] Identificar causa raiz
- [ ] Implementar prevenções
- [ ] Atualizar runbooks
- [ ] Treinar equipe

---

## 📊 Métricas de Segurança

### Diárias

- [ ] Verificar logs de erro
- [ ] Monitorar alerts de segurança
- [ ] Revisar failed login attempts (quando auth implementado)

### Semanais

- [ ] Executar `npm audit`
- [ ] Executar `pip-audit`
- [ ] Revisar dependências desatualizadas
- [ ] Verificar vulnerabilidades conhecidas

### Mensais

- [ ] Scan completo de segurança (Snyk, Trivy)
- [ ] Revisar políticas de segurança
- [ ] Atualizar documentação de segurança
- [ ] Treinar equipe em novas ameaças

### Trimestrais

- [ ] Auditoria de segurança completa
- [ ] Penetration testing (se aplicável)
- [ ] Revisar exclusões de antivírus
- [ ] Atualizar plano de resposta a incidentes

---

## 🎯 Referências Rápidas

### Comandos Úteis

```bash
# Security audit
npm audit
npm audit fix --force  # Cuidado: pode quebrar compatibilidade

pip-audit
pip-audit --fix

# Dependency updates
npm outdated
npm update

pip list --outdated
pip install --upgrade <package>

# Container security
docker scout cves <image>
trivy image <image>

# Code analysis
eslint .
bandit -r py_engine/

# Git security
git secrets --scan
git log --all --full-history -- **/.env  # Verificar se secrets foram commitados
```

### Links Importantes

- **OWASP Top 10**: https://owasp.org/www-project-top-ten/
- **CWE Top 25**: https://cwe.mitre.org/top25/
- **npm Security**: https://docs.npmjs.com/auditing-package-dependencies-for-security-vulnerabilities
- **Python Security**: https://python.readthedocs.io/en/latest/library/security_warnings.html
- **Docker Security**: https://docs.docker.com/engine/security/

---

## ✅ Sign-off

Ao completar este checklist, você confirma que:

- ✅ Todo código foi revisado para vulnerabilidades de segurança
- ✅ Dependências foram auditadas e atualizadas
- ✅ Testes de segurança foram executados com sucesso
- ✅ Documentação de segurança está atualizada
- ✅ Nenhum secret foi exposto
- ✅ Sistema está pronto para deploy seguro

**Desenvolvedor**: _________________  
**Data**: _________________  
**Aprovador**: _________________  
**Data**: _________________

---

**Última Atualização**: 2026-02-18  
**Versão**: 1.0  
**Próxima Revisão**: 2026-03-18

# Plano de escala — vender o Aupipet para 1000 empresas

Documento vivo. Lista os pontos de atenção para a plataforma aguentar 1000 clientes (tenants)
no mesmo app + mesmo banco, com isolamento por `empresa_id` (RLS). Prioridade: 🔴 crítico antes de escalar · 🟡 importante · 🟢 evolutivo.

> Arquitetura hoje: **1 deploy** (Next.js/Vercel) + **1 banco** (Supabase/Postgres+RLS) + Resend + Anthropic + Asaas.
> Toda mudança de código vale para todos os clientes automaticamente. Migrações de banco rodam 1x no Supabase.

---

## 1. Custos de IA descontrolados 🔴
Hoje existem endpoints que chamam a Anthropic sem limite: `/api/analisar-vacinas`, `/api/transporte/analisar-comprovante`, e agora `/api/suporte/chat` e `/api/suporte/escalar`.
Com 1000 empresas, um cliente (ou um abuso) pode gerar custo alto.
- [ ] **Rate limit por empresa/usuário** nesses endpoints (ex.: X chamadas/dia). Usar Upstash Redis ou tabela `uso_ia` com contador.
- [ ] Teto de `max_tokens` (já aplicado) + validar tamanho/qtde de imagens.
- [ ] Métrica de gasto por empresa (para cobrar excedente no futuro ou cortar abuso).
- [ ] Cache de respostas repetidas quando fizer sentido.

## 2. Isolamento entre empresas (RLS) 🔴
É o que impede a empresa A de ver dados da empresa B. Um furo aqui é incidente grave.
- [ ] **Suite de testes de RLS**: logar como empresa A e tentar ler/escrever em B (deve falhar) — para CADA tabela.
- [ ] Auditar todo uso de `SUPABASE_SERVICE_ROLE_KEY` (ela ignora RLS): só em rotas server confiáveis, nunca exposta ao client.
- [ ] Garantir que toda tabela nova nasce com `empresa_id NOT NULL` + policy. Checklist de migração.
- [ ] Garantir `empresa_id` correto em todo INSERT (trigger/default `current_empresa_id()`).

## 3. Deliverability de e-mail 🔴
Com 1000 empresas mandando extratos, relatórios e vacinas, o domínio pode cair em spam ou estourar limite do Resend.
- [ ] SPF, DKIM e DMARC verificados para `aupipet.com.br` no Resend.
- [ ] Tratar bounces/complaints (webhook do Resend) e parar de enviar para inválidos.
- [ ] Monitorar limite de envio do plano Resend e taxa de entrega.
- [ ] Idealmente subdomínio de envio dedicado (ex.: `mail.aupipet.com.br`) e segregar transacional.

## 4. Banco de dados / performance 🔴🟡
- [ ] Usar **connection pooler** do Supabase (pgBouncer) — Vercel serverless abre muitas conexões.
- [ ] **Índices em `empresa_id`** (e compostos `empresa_id + data`) nas tabelas grandes: presencas, transportes, receitas, despesas, agendamentos.
- [ ] Revisar a view `vw_empresas_metricas` — com 1000 empresas pode ficar pesada; materializar ou paginar.
- [ ] Definir política de retenção/arquivamento de dados antigos.

## 5. Cobrança e inadimplência (Asaas) 🔴
- [ ] Checkout self-service dentro do app (hoje a assinatura é criada manualmente).
- [ ] Régua de cobrança automática (lembrete, atraso, suspensão, cancelamento) — webhook já existe, formalizar os estados.
- [ ] Conciliação: relatório de MRR, churn, trials convertidos.
- [ ] Limites por plano realmente aplicados (usuários/unidades — ver `lib/planos.ts`).

## 6. Subdomínio por empresa 🟡
Código pronto (`lib/dominio.ts` + middleware lê `slug.app.aupipet.com.br`). Falta infra:
- [ ] DNS: registro **curinga** `*.app.aupipet.com.br` (CNAME para a Vercel).
- [ ] Vercel: adicionar **domínio curinga** `*.app.aupipet.com.br` ao projeto (SSL é automático).
- [ ] Validar emissão de certificado wildcard e propagação.
- [ ] Cachear a resolução tenant→empresa por slug para não pesar no banco.

## 7. Observabilidade 🔴
Sem isso, com 1000 clientes você fica cego.
- [ ] Error tracking (Sentry) no front e nas rotas API, com `empresa_id` no contexto.
- [ ] Logs estruturados + alertas (falha de cron, falha de e-mail, erro de pagamento).
- [ ] Uptime/health checks e página de status pública.
- [ ] Dashboard interno: nº empresas ativas, MRR, uso de IA, e-mails enviados.

## 8. Segurança 🔴
- [ ] Política de senha forte + opção de 2FA para admins.
- [ ] **Audit log** de ações sensíveis (criar/excluir usuário, mudar permissão, exportar dados).
- [ ] Validar autenticação de TODOS os webhooks (Asaas, Resend) por token/assinatura.
- [ ] Rotação de segredos; nunca commitar `.env`.
- [ ] Rate limit no login (anti brute-force).

## 9. LGPD / privacidade 🔴
Dados de tutores (nome, CPF, endereço, telefone) e de pets.
- [ ] Política de Privacidade e Termos reais (os links no cadastro hoje são placeholders).
- [ ] Consentimento no cadastro público.
- [ ] Exportação e exclusão de dados a pedido (titular e empresa).
- [ ] Contrato de operador de dados entre Aupipet e cada empresa.

## 10. Backup e recuperação 🟡
- [ ] PITR (point-in-time recovery) habilitado no Supabase.
- [ ] Teste de restauração documentado.
- [ ] Export por empresa (offboarding sem reféns).

## 11. Performance do app / middleware 🟡
- [ ] O middleware chama `supabase.auth.getUser()` em quase toda requisição — avaliar custo e cache.
- [ ] `getEmpresa()` faz 2 queries por request — cachear por sessão.
- [ ] Otimização de imagens (fotos de pets/logos) e CDN.

## 12. Suporte em escala 🟡
- [ ] A IA de suporte (já implementada) reduz tickets; medir taxa de resolução.
- [ ] Fila/ticketing para os escalonamentos humanos (hoje vão por e-mail) com SLA de 48h.
- [ ] Base de conhecimento/FAQ alimentando a IA.

## 13. Rollout e migrações seguras 🟡
- [ ] Versionar migrações com ferramenta (supabase CLI / migrations numeradas).
- [ ] Toda migração deve ser **retrocompatível** (deploy de código e banco não são atômicos).
- [ ] Feature flags para liberar novidade gradualmente (ex.: 5% → 100%).
- [ ] Ambiente de staging com domínio próprio antes de produção.

---

### Top 5 para fazer ANTES de passar de ~50 clientes
1. Rate limit + teto de custo nos endpoints de IA (#1).
2. Suite de testes de isolamento RLS (#2).
3. Error tracking + alertas (#7).
4. SPF/DKIM/DMARC e tratamento de bounce (#3).
5. Connection pooler + índices por `empresa_id` (#4).

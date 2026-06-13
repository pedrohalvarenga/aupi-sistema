# Aupi — Sistema de Gestão Pet (White Label)

Plataforma multi-empresa derivada do sistema Play Dog. Cada cliente (creche, hotel, banho & tosa) tem seus dados **totalmente isolados** no banco via Row Level Security, com logo, cores e contatos próprios.

> **Importante:** este é um projeto NOVO e separado. Use um projeto Supabase NOVO e um projeto Vercel NOVO. Nada aqui toca a Play Dog em produção.

---

## 1. Criar o banco (Supabase)

1. Crie um projeto novo em https://supabase.com (região São Paulo).
2. No **SQL Editor**, execute os scripts da pasta `supabase/` **nesta ordem**:
   1. `schema.sql`
   2. `creche_v2.sql`
   3. `banho_tosa.sql`
   4. `hotel.sql`
   5. `financeiro.sql`
   6. `financeiro_parte_b.sql`
   7. `transporte.sql`
   8. `areas_servico_vacinas.sql`
   9. `add_num_diarias_receitas.sql`
   10. `add_pet_tutor_despesas.sql`
   11. `fix-policies.sql`
   12. **`aupi_00_multitenant.sql`** ← transforma em multi-empresa
   13. **`aupi_01_storage.sql`** ← buckets de fotos e logos

   (Não execute `import_lancamentos.sql` — eram dados da Play Dog.)

## 2. Publicar o app (Vercel)

1. Suba o código para um repositório novo no GitHub (ex.: `aupi-sistema`).
2. Importe na Vercel e configure as variáveis de ambiente (modelo em `.env.example`):

| Variável | Onde obter |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (secreta!) |
| `RESEND_API_KEY` | https://resend.com (verifique o domínio aupipet.com.br) |
| `RESEND_FROM` | `Aupi <noreply@aupipet.com.br>` |
| `NEXT_PUBLIC_APP_URL` | URL final, ex. `https://app.aupipet.com.br` |
| `CRON_SECRET` | gere um segredo forte (ex.: `openssl rand -hex 24`) |
| `ASAAS_WEBHOOK_TOKEN` | gere outro segredo forte |
| `GOOGLE_MAPS_API_KEY` | opcional, para rotas de transporte |

3. Os 5 crons já estão configurados em `vercel.json` e rodam para **todas** as empresas automaticamente.
4. Aponte o domínio `app.aupipet.com.br` para o projeto Vercel.

## 3. Criar o seu usuário super-admin (Aupi)

1. Crie sua conta em `/comecar` (pode usar "Aupi" como nome do negócio).
2. No SQL Editor do Supabase, rode:

```sql
UPDATE public.profiles
SET role = 'super_admin', empresa_id = NULL
WHERE email = 'seu@email.com';
```

3. Faça login → você cai direto em `/superadmin` com a lista de clientes, métricas e ações (suspender, reativar, estender trial, cancelar).

## 4. Cobrança (Asaas)

1. Crie a conta no Asaas e cadastre cada cliente como **assinatura recorrente** (R$ 97+/mês conforme o plano).
2. Copie o `customer id` do Asaas (cus_xxxx) para a coluna `asaas_customer_id` da empresa (via SQL ou Supabase Table Editor).
3. No Asaas → Integrações → Webhooks:
   - URL: `https://app.aupipet.com.br/api/asaas/webhook`
   - Token de autenticação: o mesmo valor de `ASAAS_WEBHOOK_TOKEN`
4. A partir daí é automático: pagamento confirmado → conta `ativo`; atraso → `inadimplente`; assinatura cancelada → `cancelado`. Trial vencido ou conta suspensa = tela de bloqueio com botão de WhatsApp.

## 5. Como funciona para o cliente

- **Cadastro:** `https://app.aupipet.com.br/comecar` → cria a empresa + admin em 1 minuto, trial de 14 dias sem cartão.
- **White label:** menu Admin → **Minha empresa** → envia logo, escolhe as 2 cores, preenche contatos. Todo o app e os e-mails (extrato, vacinas, relatório do hotel) saem com a marca dele.
- **Tutores:** cada empresa tem um link próprio de cadastro público: `/cadastro?e=slug-da-empresa` (exibido na tela Minha empresa).
- **Equipe:** o admin cria usuários (recepção, banho & tosa, motorista) e todos ficam restritos à empresa dele — garantido pelo banco, não só pela interface.

## 6. A Play Dog como cliente nº 1

A migration já cria a empresa **Play Dog** (slug `playdog`, status `ativo`, plano `completo`). Se quiser migrar a operação real da Play Dog para a plataforma Aupi no futuro, basta exportar/importar os dados — mas isso é opcional; a Play Dog pode continuar no sistema atual dela sem nenhuma mudança.

## Fora do v1 (próximas fases)

- Subdomínio por cliente (`cliente.aupipet.com.br`) e domínio próprio
- Checkout self-service do Asaas dentro do app (hoje a assinatura é criada por você no painel Asaas)
- Limites por plano (nº de pets/usuários por faixa de preço)

---

**Stack:** Next.js 15 · React 19 · Supabase (Postgres + RLS + Storage) · Resend · Vercel · Asaas
**Validação:** `npx tsc --noEmit` ✓ e `next build` ✓ sem erros.

-- aupi_12_marcos_engajamento.sql
-- Suporte a e-mails de CELEBRAÇÃO (marcos) e de INATIVIDADE comportamental.
-- Colunas de controle para não repetir o mesmo e-mail. Aditiva e idempotente.
-- Aplicação MANUAL no Supabase SQL Editor do projeto aupipet (jmvnqvkxihsdivcjivql).
-- Play Dog (id 00000000-...-001): o cron a ignora; aqui só marcamos flags (inócuo).

alter table public.empresas
  add column if not exists marco_pet boolean not null default false,
  add column if not exists marco_presenca boolean not null default false,
  add column if not exists marco_receita boolean not null default false,
  add column if not exists ultimo_aviso_inatividade date;

-- Inicializa marcos já alcançados, para NÃO comemorar ações antigas no 1º run.
update public.empresas e set marco_pet = true
  where marco_pet = false and exists (select 1 from public.pets p where p.empresa_id = e.id);

update public.empresas e set marco_presenca = true
  where marco_presenca = false and exists (select 1 from public.presencas pr where pr.empresa_id = e.id);

update public.empresas e set marco_receita = true
  where marco_receita = false and exists (select 1 from public.receitas r where r.empresa_id = e.id);

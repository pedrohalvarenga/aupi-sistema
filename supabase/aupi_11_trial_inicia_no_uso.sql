-- aupi_11_trial_inicia_no_uso.sql
-- Objetivo: o relógio de 14 dias do trial passa a começar quando a empresa
-- cadastra o PRIMEIRO PET (vê valor), não no momento do cadastro. Quem cria a
-- conta e some não consome o trial à toa; quem volta no dia 10 e ativa ganha 14
-- dias cheios a partir dali. Nunca encurta um trial — só pode estender.
--
-- Aplicação MANUAL no Supabase SQL Editor do projeto aupipet (ref jmvnqvkxihsdivcjivql).
-- NÃO afeta a Play Dog (id 00000000-...-001): o gatilho a ignora explicitamente.
-- Aditiva e idempotente — pode rodar mais de uma vez sem efeito colateral.

-- 1) Marcador de que o trial já "começou de verdade" (aditivo, default seguro)
alter table public.empresas
  add column if not exists trial_iniciado boolean not null default false;

-- 2) Ao inserir o 1º pet de uma empresa em trial ainda não iniciado,
--    reinicia trial_ate para hoje + 14 dias e marca trial_iniciado = true.
create or replace function public.iniciar_trial_no_primeiro_pet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.empresa_id is null then
    return NEW;
  end if;
  if NEW.empresa_id = '00000000-0000-0000-0000-000000000001' then
    return NEW; -- Play Dog: nunca tocar
  end if;

  update public.empresas e
     set trial_ate = greatest(e.trial_ate, (current_date + interval '14 days')::date),
         trial_iniciado = true
   where e.id = NEW.empresa_id
     and e.status = 'trial'
     and e.trial_iniciado = false;

  return NEW;
end;
$$;

-- 3) Gatilho após inserir pet (uma vez por empresa por causa do flag)
drop trigger if exists trg_iniciar_trial on public.pets;
create trigger trg_iniciar_trial
  after insert on public.pets
  for each row
  execute function public.iniciar_trial_no_primeiro_pet();

-- 4) Empresas em trial que JÁ têm pets contam como já iniciadas (não reabrir)
update public.empresas e
   set trial_iniciado = true
 where e.status = 'trial'
   and e.trial_iniciado = false
   and e.id <> '00000000-0000-0000-0000-000000000001'
   and exists (select 1 from public.pets p where p.empresa_id = e.id);

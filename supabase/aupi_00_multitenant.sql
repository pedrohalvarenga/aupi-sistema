-- ============================================================
-- AUPI — Migration 00: Multi-tenancy
-- Transforma o sistema single-tenant (Play Dog) em plataforma
-- multi-empresa com isolamento total via Row Level Security.
-- Execute APÓS todos os scripts originais (schema.sql, etc.)
-- em um banco NOVO (não rode no banco de produção da Play Dog).
-- ============================================================

-- ============================================================
-- 1. TABELA: empresas (os clientes da Aupi / tenants)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.empresas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{3,40}$'),
  segmento        TEXT NOT NULL DEFAULT 'creche'
                    CHECK (segmento IN ('creche','hotel','banho_tosa','completo')),
  -- Identidade visual (white label)
  logo_url        TEXT,
  cor_primaria    TEXT NOT NULL DEFAULT '#8A05BE',
  cor_secundaria  TEXT NOT NULL DEFAULT '#FF5600',
  -- Contato exibido aos tutores do cliente
  telefone        TEXT,
  whatsapp        TEXT,
  email_contato   TEXT,
  endereco        TEXT,
  cidade          TEXT,
  -- Módulos habilitados
  mod_creche      BOOLEAN NOT NULL DEFAULT true,
  mod_hotel       BOOLEAN NOT NULL DEFAULT true,
  mod_banho_tosa  BOOLEAN NOT NULL DEFAULT true,
  mod_transporte  BOOLEAN NOT NULL DEFAULT false,
  mod_financeiro  BOOLEAN NOT NULL DEFAULT true,
  -- Assinatura da plataforma
  plano           TEXT NOT NULL DEFAULT 'essencial'
                    CHECK (plano IN ('essencial','profissional','completo')),
  status          TEXT NOT NULL DEFAULT 'trial'
                    CHECK (status IN ('trial','ativo','inadimplente','suspenso','cancelado')),
  trial_ate       DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '14 days'),
  asaas_customer_id      TEXT,
  asaas_subscription_id  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. profiles: vínculo com empresa + papel super_admin
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin','admin','recepcao','banho_tosa','motorista'));

-- ============================================================
-- 3. Funções de contexto do tenant
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_empresa_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT empresa_id FROM public.profiles WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT COALESCE((SELECT role = 'super_admin' FROM public.profiles WHERE id = auth.uid()), false) $$;

-- ============================================================
-- 4. empresa_id em TODAS as tabelas de negócio + backfill
--    Os dados existentes são atribuídos à empresa nº 1 (Play Dog)
-- ============================================================
INSERT INTO public.empresas (id, nome, slug, segmento, cidade, status, plano, trial_ate)
VALUES ('00000000-0000-0000-0000-000000000001', 'Play Dog', 'playdog', 'completo',
        'Juiz de Fora/MG', 'ativo', 'completo', CURRENT_DATE)
ON CONFLICT (slug) DO NOTHING;

DO $$
DECLARE
  t TEXT;
  tabelas TEXT[] := ARRAY[
    'tutores','pets','presencas','diaria_saldo','compras_diarias','ajustes_saldo',
    'ocorrencias','config_creche','precos_padrao','envios_extrato',
    'agendamentos_banho_tosa',
    'hospedagens','plantonistas','escala_plantao','config_hotel',
    'contas_financeiras','parcelamentos','receitas','despesas','orcamentos','configuracoes',
    'rotas','transportes','abastecimentos','manutencoes_veiculo','config_transporte'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE', t);
      EXECUTE format(
        'UPDATE public.%I SET empresa_id = ''00000000-0000-0000-0000-000000000001'' WHERE empresa_id IS NULL', t);
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN empresa_id SET NOT NULL', t);
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id()', t);
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS idx_%s_empresa ON public.%I (empresa_id)', t, t);
    END IF;
  END LOOP;

  UPDATE public.profiles SET empresa_id = '00000000-0000-0000-0000-000000000001'
  WHERE empresa_id IS NULL AND role <> 'super_admin';
END $$;

-- ============================================================
-- 5. RLS: derruba políticas antigas e cria isolamento por empresa
--    Regra única: cada usuário só enxerga linhas da sua empresa.
--    super_admin (Aupi) enxerga tudo.
-- ============================================================
DO $$
DECLARE
  t TEXT;
  pol RECORD;
  tabelas TEXT[] := ARRAY[
    'tutores','pets','presencas','diaria_saldo','compras_diarias','ajustes_saldo',
    'ocorrencias','config_creche','precos_padrao','envios_extrato',
    'agendamentos_banho_tosa',
    'hospedagens','plantonistas','escala_plantao','config_hotel',
    'contas_financeiras','parcelamentos','receitas','despesas','orcamentos','configuracoes',
    'rotas','transportes','abastecimentos','manutencoes_veiculo','config_transporte'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
        EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t);
      END LOOP;
      EXECUTE format($pol$
        CREATE POLICY tenant_select ON public.%I FOR SELECT TO authenticated
        USING (empresa_id = public.current_empresa_id() OR public.is_super_admin())
      $pol$, t);
      EXECUTE format($pol$
        CREATE POLICY tenant_insert ON public.%I FOR INSERT TO authenticated
        WITH CHECK (empresa_id = public.current_empresa_id() OR public.is_super_admin())
      $pol$, t);
      EXECUTE format($pol$
        CREATE POLICY tenant_update ON public.%I FOR UPDATE TO authenticated
        USING (empresa_id = public.current_empresa_id() OR public.is_super_admin())
        WITH CHECK (empresa_id = public.current_empresa_id() OR public.is_super_admin())
      $pol$, t);
      EXECUTE format($pol$
        CREATE POLICY tenant_delete ON public.%I FOR DELETE TO authenticated
        USING (empresa_id = public.current_empresa_id() OR public.is_super_admin())
      $pol$, t);
    END IF;
  END LOOP;
END $$;

-- profiles: o usuário vê o próprio perfil e os da sua empresa
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='profiles' LOOP
    EXECUTE format('DROP POLICY %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR empresa_id = public.current_empresa_id() OR public.is_super_admin());
CREATE POLICY profiles_insert ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR (
    empresa_id = public.current_empresa_id()
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'));
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_super_admin() OR (
    empresa_id = public.current_empresa_id()
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'));

-- empresas: cada um vê e edita só a própria; super_admin tudo
CREATE POLICY empresas_select ON public.empresas FOR SELECT TO authenticated
  USING (id = public.current_empresa_id() OR public.is_super_admin());
CREATE POLICY empresas_update ON public.empresas FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR (
    id = public.current_empresa_id()
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'))
  WITH CHECK (id = public.current_empresa_id() OR public.is_super_admin());
CREATE POLICY empresas_insert_super ON public.empresas FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

-- ============================================================
-- 6. Trigger: novo usuário herda a empresa do metadata
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome, role, empresa_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'recepcao'),
    NULLIF(NEW.raw_user_meta_data->>'empresa_id','')::uuid
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 7. Visão de métricas para o painel super-admin
-- ============================================================
CREATE OR REPLACE VIEW public.vw_empresas_metricas AS
SELECT e.id, e.nome, e.slug, e.segmento, e.plano, e.status, e.trial_ate, e.created_at,
  (SELECT COUNT(*) FROM public.pets p WHERE p.empresa_id = e.id)    AS total_pets,
  (SELECT COUNT(*) FROM public.tutores t WHERE t.empresa_id = e.id) AS total_tutores,
  (SELECT COUNT(*) FROM public.profiles u WHERE u.empresa_id = e.id) AS total_usuarios
FROM public.empresas e;

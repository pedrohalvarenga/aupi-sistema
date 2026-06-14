-- ============================================================
-- AUPI — Migration 05: Funcionários + Comissões
-- Cadastro de funcionários (dados pessoais, profissionais,
-- uniformes, foto, vínculo opcional com usuário do sistema) e
-- motor de comissões por área de serviço.
-- Dados de salário são SENSÍVEIS: as 3 tabelas novas são
-- ADMIN-ONLY dentro do tenant (além do super_admin da Aupi).
-- Seguro rodar mais de uma vez. Segue o padrão multi-tenant
-- (empresa_id + current_empresa_id()) da migration 00.
-- Rodar no SQL Editor do Supabase do projeto aupipet-sistema.
-- ============================================================

-- 1. TABELA: funcionarios ------------------------------------
CREATE TABLE IF NOT EXISTS public.funcionarios (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id      UUID NOT NULL DEFAULT public.current_empresa_id()
                    REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome_completo   TEXT NOT NULL,
  cpf             TEXT,
  rg              TEXT,
  data_nascimento DATE,
  foto_url        TEXT,
  email           TEXT,
  telefone        TEXT,
  cargo           TEXT,
  salario         NUMERIC(12,2) NOT NULL DEFAULT 0,
  data_admissao   DATE,
  tam_calca       TEXT,
  tam_camisa      TEXT,
  tam_sapato      TEXT,
  usuario_id      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  recebe_comissao BOOLEAN NOT NULL DEFAULT false,
  ativo           BOOLEAN NOT NULL DEFAULT true,
  observacoes     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_funcionarios_empresa ON public.funcionarios (empresa_id);

DROP TRIGGER IF EXISTS trg_funcionarios_updated_at ON public.funcionarios;
CREATE TRIGGER trg_funcionarios_updated_at
  BEFORE UPDATE ON public.funcionarios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. TABELA: comissao_regras ---------------------------------
--    Percentual de comissão por área de serviço do funcionário.
CREATE TABLE IF NOT EXISTS public.comissao_regras (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id     UUID NOT NULL DEFAULT public.current_empresa_id()
                   REFERENCES public.empresas(id) ON DELETE CASCADE,
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  tipo           TEXT NOT NULL CHECK (tipo IN
                   ('banho_tosa','hotel','creche','transporte','veterinario','geral')),
  percentual     NUMERIC(5,2) NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comissao_regras_empresa     ON public.comissao_regras (empresa_id);
CREATE INDEX IF NOT EXISTS idx_comissao_regras_funcionario ON public.comissao_regras (funcionario_id);

-- 3. TABELA: comissoes_pagas ---------------------------------
--    Registro de pagamento de comissão de um mês/ano. A UNIQUE
--    impede pagar duas vezes a mesma competência.
CREATE TABLE IF NOT EXISTS public.comissoes_pagas (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id       UUID NOT NULL DEFAULT public.current_empresa_id()
                     REFERENCES public.empresas(id) ON DELETE CASCADE,
  funcionario_id   UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  competencia_mes  INT NOT NULL,
  competencia_ano  INT NOT NULL,
  valor_total      NUMERIC(12,2) NOT NULL,
  despesa_id       UUID REFERENCES public.despesas(id) ON DELETE SET NULL,
  criado_por       UUID REFERENCES public.profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (funcionario_id, competencia_mes, competencia_ano)
);

CREATE INDEX IF NOT EXISTS idx_comissoes_pagas_empresa ON public.comissoes_pagas (empresa_id);

-- 4. Atribuição de comissão na fonte -------------------------
--    receitas.funcionario_id é a fonte da verdade de "quem executou".
ALTER TABLE public.receitas
  ADD COLUMN IF NOT EXISTS funcionario_id UUID REFERENCES public.funcionarios(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_receitas_funcionario ON public.receitas (funcionario_id);

--    Banho & Tosa: registra quem fez o serviço, para propagar à receita.
ALTER TABLE public.agendamentos_banho_tosa
  ADD COLUMN IF NOT EXISTS funcionario_id UUID REFERENCES public.funcionarios(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_agendamentos_bt_funcionario ON public.agendamentos_banho_tosa (funcionario_id);

-- 5. RLS: ADMIN-ONLY dentro do tenant (salários são sensíveis)
ALTER TABLE public.funcionarios     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comissao_regras  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comissoes_pagas  ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
  tabelas TEXT[] := ARRAY['funcionarios','comissao_regras','comissoes_pagas'];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    EXECUTE format('DROP POLICY IF EXISTS admin_select ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS admin_insert ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS admin_update ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS admin_delete ON public.%I', t);

    EXECUTE format($pol$
      CREATE POLICY admin_select ON public.%I FOR SELECT TO authenticated
      USING (
        (empresa_id = public.current_empresa_id()
          AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
        OR public.is_super_admin()
      )
    $pol$, t);
    EXECUTE format($pol$
      CREATE POLICY admin_insert ON public.%I FOR INSERT TO authenticated
      WITH CHECK (
        (empresa_id = public.current_empresa_id()
          AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
        OR public.is_super_admin()
      )
    $pol$, t);
    EXECUTE format($pol$
      CREATE POLICY admin_update ON public.%I FOR UPDATE TO authenticated
      USING (
        (empresa_id = public.current_empresa_id()
          AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
        OR public.is_super_admin()
      )
      WITH CHECK (
        (empresa_id = public.current_empresa_id()
          AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
        OR public.is_super_admin()
      )
    $pol$, t);
    EXECUTE format($pol$
      CREATE POLICY admin_delete ON public.%I FOR DELETE TO authenticated
      USING (
        (empresa_id = public.current_empresa_id()
          AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
        OR public.is_super_admin()
      )
    $pol$, t);
  END LOOP;
END $$;

-- ============================================================
-- FIM — Migration 05
-- ============================================================

-- ============================================================
-- AUPI — Migration 06: Fornecedores
-- Cadastro de fornecedores e prestadores de serviço por empresa
-- (quem fornece ração/insumos, medicamentos, aluguel, etc.) para
-- vincular às despesas (favorecido). Visível para admin E recepcao
-- dentro do tenant (além do super_admin da Aupi).
-- Seguro rodar mais de uma vez. Segue o padrão multi-tenant
-- (empresa_id + current_empresa_id()) da migration 00.
-- Rodar no SQL Editor do Supabase do projeto aupipet-sistema.
-- ============================================================

-- 1. TABELA: fornecedores ------------------------------------
CREATE TABLE IF NOT EXISTS public.fornecedores (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id    UUID NOT NULL DEFAULT public.current_empresa_id()
                  REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome          TEXT NOT NULL,
  cnpj          TEXT,
  categoria     TEXT,
  contato_nome  TEXT,
  telefone      TEXT,
  email         TEXT,
  endereco      TEXT,
  observacoes   TEXT,
  ativo         BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fornecedores_empresa ON public.fornecedores (empresa_id);

DROP TRIGGER IF EXISTS trg_fornecedores_updated_at ON public.fornecedores;
CREATE TRIGGER trg_fornecedores_updated_at
  BEFORE UPDATE ON public.fornecedores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. RLS: tenant + papel (admin OU recepcao) dentro da empresa
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_select ON public.fornecedores;
DROP POLICY IF EXISTS tenant_insert ON public.fornecedores;
DROP POLICY IF EXISTS tenant_update ON public.fornecedores;
DROP POLICY IF EXISTS tenant_delete ON public.fornecedores;

CREATE POLICY tenant_select ON public.fornecedores FOR SELECT TO authenticated
  USING (
    (empresa_id = public.current_empresa_id()
      AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin','recepcao'))
    OR public.is_super_admin()
  );
CREATE POLICY tenant_insert ON public.fornecedores FOR INSERT TO authenticated
  WITH CHECK (
    (empresa_id = public.current_empresa_id()
      AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin','recepcao'))
    OR public.is_super_admin()
  );
CREATE POLICY tenant_update ON public.fornecedores FOR UPDATE TO authenticated
  USING (
    (empresa_id = public.current_empresa_id()
      AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin','recepcao'))
    OR public.is_super_admin()
  )
  WITH CHECK (
    (empresa_id = public.current_empresa_id()
      AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin','recepcao'))
    OR public.is_super_admin()
  );
CREATE POLICY tenant_delete ON public.fornecedores FOR DELETE TO authenticated
  USING (
    (empresa_id = public.current_empresa_id()
      AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin','recepcao'))
    OR public.is_super_admin()
  );

-- 3. Vincula despesas a um favorecido (fornecedor OU funcionário)
--    (colunas opcionais; ON DELETE SET NULL para não perder histórico)
ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS fornecedor_id UUID REFERENCES public.fornecedores(id) ON DELETE SET NULL;
ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS funcionario_id UUID REFERENCES public.funcionarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_despesas_fornecedor  ON public.despesas (fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_despesas_funcionario ON public.despesas (funcionario_id);

-- ============================================================
-- FIM — Migration 06
-- ============================================================

-- ============================================================
-- AUPI — Migration 02: Cadastro de veículos (Taxi Dog)
-- Permite cada empresa cadastrar MÚLTIPLOS carros e vincular
-- abastecimento, manutenção e rotas a um veículo específico.
-- Seguro rodar mais de uma vez. Segue o padrão multi-tenant
-- (empresa_id + current_empresa_id()) da migration 00.
-- Rodar no SQL Editor do Supabase do projeto aupipet-sistema.
-- ============================================================

-- 1. TABELA: veiculos -----------------------------------------
CREATE TABLE IF NOT EXISTS public.veiculos (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id   UUID NOT NULL DEFAULT public.current_empresa_id()
                 REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome         TEXT NOT NULL,                 -- apelido: "Fiorino branca"
  placa        TEXT,
  modelo       TEXT,
  ano          INTEGER,
  cor          TEXT,
  km_atual     NUMERIC(10,1) NOT NULL DEFAULT 0,
  capacidade   INTEGER,                       -- nº de pets que cabem
  ativo        BOOLEAN NOT NULL DEFAULT true,
  observacoes  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_veiculos_empresa ON public.veiculos (empresa_id);

-- updated_at automático (a função set_updated_at já existe da migration de transporte)
DROP TRIGGER IF EXISTS trg_veiculos_updated_at ON public.veiculos;
CREATE TRIGGER trg_veiculos_updated_at
  BEFORE UPDATE ON public.veiculos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. RLS: isolamento por empresa (mesmo padrão da migration 00)
ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_select ON public.veiculos;
DROP POLICY IF EXISTS tenant_insert ON public.veiculos;
DROP POLICY IF EXISTS tenant_update ON public.veiculos;
DROP POLICY IF EXISTS tenant_delete ON public.veiculos;

CREATE POLICY tenant_select ON public.veiculos FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.is_super_admin());
CREATE POLICY tenant_insert ON public.veiculos FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.current_empresa_id() OR public.is_super_admin());
CREATE POLICY tenant_update ON public.veiculos FOR UPDATE TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.is_super_admin())
  WITH CHECK (empresa_id = public.current_empresa_id() OR public.is_super_admin());
CREATE POLICY tenant_delete ON public.veiculos FOR DELETE TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.is_super_admin());

-- 3. Vincula registros existentes do transporte a um veículo --
--    (coluna opcional; ON DELETE SET NULL para não perder histórico)
ALTER TABLE public.abastecimentos
  ADD COLUMN IF NOT EXISTS veiculo_id UUID REFERENCES public.veiculos(id) ON DELETE SET NULL;
ALTER TABLE public.manutencoes_veiculo
  ADD COLUMN IF NOT EXISTS veiculo_id UUID REFERENCES public.veiculos(id) ON DELETE SET NULL;
ALTER TABLE public.rotas
  ADD COLUMN IF NOT EXISTS veiculo_id UUID REFERENCES public.veiculos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_abastecimentos_veiculo ON public.abastecimentos (veiculo_id);
CREATE INDEX IF NOT EXISTS idx_manutencoes_veiculo_veiculo ON public.manutencoes_veiculo (veiculo_id);
CREATE INDEX IF NOT EXISTS idx_rotas_veiculo ON public.rotas (veiculo_id);

-- ============================================================
-- FIM — Migration 02
-- ============================================================

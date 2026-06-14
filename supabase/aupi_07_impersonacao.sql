-- ============================================================
-- AUPI — Migration 07: Impersonação (super_admin "entra como" cliente)
-- Permite o super_admin (Aupi) navegar DENTRO do sistema de um
-- cliente para dar suporte, vendo exatamente o que o cliente vê.
--
-- Como funciona: uma coluna profiles.impersonando_empresa_id.
-- Enquanto ela está preenchida, as funções de contexto do RLS
-- passam a tratar o super_admin como um ADMIN daquela empresa:
--   - current_empresa_id() devolve a empresa impersonada
--   - is_super_admin() devolve FALSE (some o "modo deus")
-- Resultado: TODAS as telas existentes passam a mostrar apenas os
-- dados daquele cliente, sem reescrever nenhuma query.
-- Para sair, basta zerar a coluna (volta a enxergar todos).
--
-- Seguro rodar mais de uma vez. Rodar SOMENTE no SQL Editor do
-- Supabase do projeto aupipet-sistema (NUNCA no banco da Play Dog).
-- ============================================================

-- 1. Coluna de impersonação (só super_admin a usa)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS impersonando_empresa_id UUID
    REFERENCES public.empresas(id) ON DELETE SET NULL;

-- 2. current_empresa_id(): honra a impersonação quando for super_admin
CREATE OR REPLACE FUNCTION public.current_empresa_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN role = 'super_admin' AND impersonando_empresa_id IS NOT NULL
      THEN impersonando_empresa_id
    ELSE empresa_id
  END
  FROM public.profiles WHERE id = auth.uid()
$$;

-- 3. is_super_admin(): FALSE enquanto estiver impersonando
--    (assim o RLS escopa o super_admin a uma única empresa)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role = 'super_admin' AND impersonando_empresa_id IS NULL
     FROM public.profiles WHERE id = auth.uid()),
    false)
$$;

-- ============================================================
-- FIM — Migration 07
-- ============================================================

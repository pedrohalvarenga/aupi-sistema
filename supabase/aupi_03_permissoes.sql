-- ============================================================
-- AUPI — Migration 03: Permissões por usuário
-- Permite o admin personalizar, por usuário, quais áreas ele
-- enxerga no app (além do papel/role). NULL = usa o padrão do papel.
-- Seguro rodar mais de uma vez.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS permissoes JSONB;

-- (Opcional) comentário de documentação
COMMENT ON COLUMN public.profiles.permissoes IS
  'Mapa de áreas visíveis no app por usuário (ex.: {"financeiro":false}). NULL = padrão do papel.';

-- A policy profiles_update (migration 00) já permite o admin da empresa
-- atualizar perfis da própria empresa, então nada mais é necessário.
-- ============================================================
-- FIM — Migration 03
-- ============================================================

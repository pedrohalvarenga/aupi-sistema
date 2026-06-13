-- ============================================================
-- Cobranças de assinatura (integração InfinitePay Checkout)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.assinaturas_cobrancas (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  plano          TEXT NOT NULL,
  valor_centavos INTEGER NOT NULL,
  order_nsu      TEXT NOT NULL UNIQUE,
  status         TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','paga','cancelada')),
  receipt_url    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cobrancas_order_nsu ON public.assinaturas_cobrancas(order_nsu);
CREATE INDEX IF NOT EXISTS idx_cobrancas_empresa ON public.assinaturas_cobrancas(empresa_id);

-- RLS: a empresa vê só as próprias cobranças; o service role (webhook/admin) acessa tudo
ALTER TABLE public.assinaturas_cobrancas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cobrancas_select_propria ON public.assinaturas_cobrancas;
CREATE POLICY cobrancas_select_propria ON public.assinaturas_cobrancas
  FOR SELECT USING (empresa_id = public.current_empresa_id() OR public.is_super_admin());

-- ============================================================
-- AUPI — Migration 04: coluna forma_pagamento em empresas
-- Gravada pelo checkout (/api/assinar) e pelos webhooks (asaas/infinitepay),
-- e lida em src/lib/empresa.ts. Sem ela, o UPDATE de ativação após o
-- pagamento FALHA e a empresa nunca é ativada. Seguro rodar mais de uma vez.
-- ============================================================

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS forma_pagamento TEXT
  CHECK (forma_pagamento IN ('cartao', 'pix', 'boleto'));

COMMENT ON COLUMN public.empresas.forma_pagamento IS
  'Método da última cobrança (cartao|pix|boleto). Define a carência de bloqueio.';

-- ============================================================
-- FIM — Migration 04
-- ============================================================

-- Corrige o CHECK de empresas.plano: faltava 'escala' (um dos 3 planos reais
-- vendidos), o que fazia o UPDATE da assinatura falhar silenciosamente ao assinar
-- o plano Escala. Mantém 'completo' (legado) por compatibilidade.
-- Banco: aupipet (jmvnqvkxihsdivcjivql). NÃO afeta a Play Dog.

ALTER TABLE empresas DROP CONSTRAINT IF EXISTS empresas_plano_check;
ALTER TABLE empresas ADD CONSTRAINT empresas_plano_check
  CHECK (plano = ANY (ARRAY['essencial'::text, 'profissional'::text, 'escala'::text, 'completo'::text]));

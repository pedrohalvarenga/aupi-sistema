-- ============================================================
-- AUPI — Migration 01: Storage
-- Buckets de arquivos: fotos de pets e logos das empresas.
-- Execute no SQL Editor do Supabase APÓS a aupi_00_multitenant.sql
-- ============================================================

-- Bucket de fotos de pets (já existia na Play Dog; recriado aqui para o banco novo)
INSERT INTO storage.buckets (id, name, public)
VALUES ('fotos', 'fotos', true)
ON CONFLICT (id) DO NOTHING;

-- Bucket de logos das empresas (white label)
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas: leitura pública (as URLs aparecem em e-mails e páginas públicas);
-- escrita apenas por usuários autenticados, e logos somente na pasta da própria empresa.
DROP POLICY IF EXISTS "fotos_leitura_publica" ON storage.objects;
CREATE POLICY "fotos_leitura_publica" ON storage.objects
  FOR SELECT USING (bucket_id IN ('fotos','logos'));

DROP POLICY IF EXISTS "fotos_upload_autenticado" ON storage.objects;
CREATE POLICY "fotos_upload_autenticado" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fotos');

DROP POLICY IF EXISTS "logos_upload_propria_empresa" ON storage.objects;
CREATE POLICY "logos_upload_propria_empresa" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = public.current_empresa_id()::text
  );

DROP POLICY IF EXISTS "logos_update_propria_empresa" ON storage.objects;
CREATE POLICY "logos_update_propria_empresa" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = public.current_empresa_id()::text
  );

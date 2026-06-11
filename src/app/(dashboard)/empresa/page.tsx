'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card from '@/components/ui/Card'
import type { Empresa } from '@/types'

export default function ConfigEmpresaPage() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles').select('empresa_id').eq('id', user.id).single()
      if (!profile?.empresa_id) { setLoading(false); return }
      const { data } = await supabase
        .from('empresas').select('*').eq('id', profile.empresa_id).single()
      setEmpresa(data)
      setLoading(false)
    }
    load()
  }, [])

  function set<K extends keyof Empresa>(campo: K, valor: Empresa[K]) {
    setEmpresa((e) => (e ? { ...e, [campo]: valor } : e))
  }

  async function handleLogoUpload(file: File) {
    if (!empresa) return
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `${empresa.id}/logo.${ext}`
    const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true })
    if (error) { setMsg('Erro ao enviar a logo: ' + error.message); return }
    const { data } = supabase.storage.from('logos').getPublicUrl(path)
    set('logo_url', `${data.publicUrl}?v=${Date.now()}`)
  }

  async function salvar() {
    if (!empresa) return
    setSalvando(true)
    setMsg('')
    const supabase = createClient()
    const { error } = await supabase
      .from('empresas')
      .update({
        nome: empresa.nome,
        logo_url: empresa.logo_url,
        cor_primaria: empresa.cor_primaria,
        cor_secundaria: empresa.cor_secundaria,
        telefone: empresa.telefone,
        whatsapp: empresa.whatsapp,
        email_contato: empresa.email_contato,
        endereco: empresa.endereco,
        cidade: empresa.cidade,
        updated_at: new Date().toISOString(),
      })
      .eq('id', empresa.id)
    setMsg(error ? 'Erro ao salvar: ' + error.message : 'Salvo! Recarregue a página para ver as novas cores.')
    setSalvando(false)
  }

  if (loading) return <p className="text-gray-400 text-sm py-10 text-center">Carregando...</p>
  if (!empresa) return <p className="text-gray-400 text-sm py-10 text-center">Empresa não encontrada.</p>

  return (
    <div className="flex flex-col gap-4 py-4">
      <h1 className="text-xl font-bold text-gray-900">Minha empresa</h1>

      <Card>
        <h2 className="font-semibold text-gray-900 mb-3">Identidade visual</h2>
        <div className="flex items-center gap-4 mb-4">
          {empresa.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={empresa.logo_url} alt="Logo" className="w-16 h-16 rounded-2xl object-cover border border-gray-100" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
              Sem logo
            </div>
          )}
          <label className="text-sm font-semibold cursor-pointer" style={{ color: 'var(--brand-purple)' }}>
            Enviar logo
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cor principal</label>
            <input
              type="color"
              value={empresa.cor_primaria}
              onChange={(e) => set('cor_primaria', e.target.value)}
              className="w-full h-11 rounded-xl border border-gray-200 cursor-pointer"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cor de destaque</label>
            <input
              type="color"
              value={empresa.cor_secundaria}
              onChange={(e) => set('cor_secundaria', e.target.value)}
              className="w-full h-11 rounded-xl border border-gray-200 cursor-pointer"
            />
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold text-gray-900 mb-3">Dados do negócio</h2>
        <div className="flex flex-col gap-3">
          <Input id="nome" label="Nome" value={empresa.nome} onChange={(e) => set('nome', e.target.value)} />
          <Input id="telefone" label="Telefone" value={empresa.telefone ?? ''} onChange={(e) => set('telefone', e.target.value)} />
          <Input id="whatsapp" label="WhatsApp" value={empresa.whatsapp ?? ''} onChange={(e) => set('whatsapp', e.target.value)} />
          <Input id="email_contato" label="E-mail de contato" value={empresa.email_contato ?? ''} onChange={(e) => set('email_contato', e.target.value)} />
          <Input id="endereco" label="Endereço" value={empresa.endereco ?? ''} onChange={(e) => set('endereco', e.target.value)} />
          <Input id="cidade" label="Cidade/UF" value={empresa.cidade ?? ''} onChange={(e) => set('cidade', e.target.value)} />
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold text-gray-900 mb-1">Cadastro de tutores</h2>
        <p className="text-sm text-gray-500 mb-2">
          Compartilhe este link para os tutores se cadastrarem sozinhos:
        </p>
        <code className="block text-xs bg-gray-50 rounded-xl p-3 break-all text-gray-700">
          {typeof window !== 'undefined' ? window.location.origin : ''}/cadastro?e={empresa.slug}
        </code>
      </Card>

      {msg && <p className="text-sm text-center text-gray-600">{msg}</p>}
      <Button onClick={salvar} disabled={salvando}>
        {salvando ? 'Salvando...' : 'Salvar alterações'}
      </Button>
    </div>
  )
}

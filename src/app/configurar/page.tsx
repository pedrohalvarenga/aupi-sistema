'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { extrairCoresDoArquivo } from '@/lib/cores'
import { hostEmpresa } from '@/lib/dominio'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import type { Empresa } from '@/types'

export default function ConfigurarWizardPage() {
  const router = useRouter()
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [passo, setPasso] = useState(1)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [extraindo, setExtraindo] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase
        .from('profiles').select('empresa_id').eq('id', user.id).single()
      if (!profile?.empresa_id) { setLoading(false); return }
      const { data } = await supabase
        .from('empresas').select('*').eq('id', profile.empresa_id).single()
      setEmpresa(data)
      setLoading(false)
    }
    load()
  }, [router])

  function set<K extends keyof Empresa>(campo: K, valor: Empresa[K]) {
    setEmpresa((e) => (e ? { ...e, [campo]: valor } : e))
  }

  async function handleLogo(file: File) {
    if (!empresa) return
    if (file.size > 5 * 1024 * 1024) { setErro('A imagem deve ter no máximo 5 MB.'); return }
    setErro(''); setExtraindo(true)
    try {
      // 1. extrai cores automaticamente (nunca bloqueia o upload se falhar)
      const cores = await extrairCoresDoArquivo(file).catch(() => null)
      // 2. sobe o logo (extensão derivada do tipo do arquivo)
      const supabase = createClient()
      const ext = (file.type.split('/')[1] || file.name.split('.').pop() || 'png').toLowerCase()
      const path = `${empresa.id}/logo.${ext}`
      const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true })
      if (error) { setErro('Erro ao enviar a logo: ' + error.message); return }
      const { data } = supabase.storage.from('logos').getPublicUrl(path)
      setEmpresa((e) => e ? {
        ...e,
        logo_url: `${data.publicUrl}?v=${Date.now()}`,
        ...(cores ? { cor_primaria: cores.primaria, cor_secundaria: cores.secundaria } : {}),
      } : e)
      if (!cores) setErro('Logo enviado! Não detectamos cores automaticamente — ajuste abaixo se quiser.')
    } catch {
      setErro('Não foi possível enviar a logo. Tente outra imagem.')
    } finally {
      setExtraindo(false)
    }
  }

  async function concluir() {
    if (!empresa) return
    setSalvando(true); setErro('')
    try {
      const supabase = createClient()
      const { error } = await supabase.from('empresas').update({
        nome: empresa.nome,
        logo_url: empresa.logo_url,
        cor_primaria: empresa.cor_primaria,
        cor_secundaria: empresa.cor_secundaria,
        telefone: empresa.telefone,
        whatsapp: empresa.whatsapp,
        cidade: empresa.cidade,
        email_contato: empresa.email_contato,
        updated_at: new Date().toISOString(),
      }).eq('id', empresa.id)
      if (error) { setErro('Erro ao salvar: ' + error.message); return }
      window.location.href = `https://${empresa.slug}.app.aupipet.com.br/tutores/novo`
    } catch {
      setErro('Falha de conexão. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Carregando...</div>
  if (!empresa) return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Empresa não encontrada.</div>

  const cor = empresa.cor_primaria || '#2F9E6E'
  const cor2 = empresa.cor_secundaria || '#D98232'

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FBF5EC] to-white px-6 py-10">
      <div className="w-full max-w-md mx-auto">
        {/* progresso */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-gray-400">Passo {passo} de 3</span>
          <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${(passo / 3) * 100}%`, background: cor }} />
          </div>
        </div>

        {passo === 1 && (
          <div className="flex flex-col gap-4 mt-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Bem-vindo!</h1>
              <p className="text-gray-500 text-sm">Vamos deixar o sistema com a cara do seu negócio.</p>
            </div>
            <Input id="nome" label="Nome do negócio" value={empresa.nome} onChange={(e) => set('nome', e.target.value)} required />
            <Input id="cidade" label="Cidade/UF" value={empresa.cidade ?? ''} onChange={(e) => set('cidade', e.target.value)} placeholder="Juiz de Fora - MG" />
            <Input id="telefone" label="Telefone" value={empresa.telefone ?? ''} onChange={(e) => set('telefone', e.target.value)} />
            <Input id="whatsapp" label="WhatsApp" value={empresa.whatsapp ?? ''} onChange={(e) => set('whatsapp', e.target.value)} placeholder="(32) 99999-9999" />
            <Button onClick={() => setPasso(2)} disabled={!empresa.nome}>Continuar</Button>
          </div>
        )}

        {passo === 2 && (
          <div className="flex flex-col gap-4 mt-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">A cara do seu negócio</h1>
              <p className="text-gray-500 text-sm">Suba seu logo — detectamos suas cores sozinhos.</p>
            </div>

            <label className="border-2 border-dashed border-gray-200 rounded-2xl p-5 text-center bg-white cursor-pointer block">
              {empresa.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={empresa.logo_url} alt="Logo" className="w-16 h-16 rounded-2xl object-cover mx-auto mb-2 border border-gray-100" />
              ) : (
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-2" style={{ background: cor }}>
                  <span className="text-2xl">🐾</span>
                </div>
              )}
              <p className="text-sm font-semibold text-gray-700">{extraindo ? 'Detectando cores...' : empresa.logo_url ? 'Trocar logo' : 'Enviar logo'}</p>
              <p className="text-xs text-gray-400">PNG ou JPG</p>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleLogo(e.target.files[0])} />
            </label>

            <div>
              <p className="text-xs text-gray-500 mb-2">Cores detectadas (toque para ajustar)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <input type="color" value={cor} onChange={(e) => set('cor_primaria', e.target.value)} className="w-full h-11 rounded-xl border border-gray-200 cursor-pointer" />
                  <p className="text-[11px] text-gray-400 text-center mt-1">primária</p>
                </div>
                <div>
                  <input type="color" value={cor2} onChange={(e) => set('cor_secundaria', e.target.value)} className="w-full h-11 rounded-xl border border-gray-200 cursor-pointer" />
                  <p className="text-[11px] text-gray-400 text-center mt-1">destaque</p>
                </div>
              </div>
            </div>

            {/* preview ao vivo */}
            <div>
              <p className="text-xs text-gray-500 mb-2 text-center">Pré-visualização</p>
              <div className="border border-gray-100 rounded-2xl overflow-hidden max-w-[230px] mx-auto bg-white">
                <div className="px-3 py-2.5 flex items-center gap-2" style={{ background: cor }}>
                  {empresa.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={empresa.logo_url} alt="" className="w-6 h-6 rounded-md object-cover" />
                  ) : <div className="w-6 h-6 rounded-md bg-white/20" />}
                  <span className="text-white text-sm font-semibold">{empresa.nome || 'Seu negócio'}</span>
                </div>
                <div className="p-3">
                  <button className="w-full text-white rounded-lg py-2 text-sm font-semibold" style={{ background: cor }}>Fazer chamada</button>
                  <button className="w-full rounded-lg py-2 text-sm mt-2 border" style={{ color: cor2, borderColor: cor2 }}>Nova diária</button>
                </div>
              </div>
            </div>

            {erro && <p className="text-sm text-red-500 text-center">{erro}</p>}
            <div className="flex gap-3">
              <Button variant="ghost" className="flex-1" onClick={() => setPasso(1)}>Voltar</Button>
              <Button className="flex-1" onClick={() => setPasso(3)}>Continuar</Button>
            </div>
          </div>
        )}

        {passo === 3 && (
          <div className="flex flex-col gap-5 mt-6 items-center text-center">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center" style={{ background: cor }}>
              <span className="text-4xl">✓</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Tudo pronto!</h1>
              <p className="text-gray-500 text-sm">O sistema já está com a identidade da {empresa.nome}. Você pode mudar tudo depois em “Minha empresa”.</p>
            </div>
            {empresa.slug && (
              <div className="w-full rounded-2xl border border-dashed border-brand-purple/40 bg-purple-50/60 px-4 py-3">
                <p className="text-[11px] font-semibold text-brand-purple mb-0.5">Seu endereço de acesso</p>
                <p className="text-sm font-bold text-gray-800 break-all">{hostEmpresa(empresa.slug)}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Salve este link — é por aqui que você e sua equipe entram.</p>
              </div>
            )}
            {erro && <p className="text-sm text-red-500">{erro}</p>}
            <div className="flex gap-3 w-full">
              <Button variant="ghost" className="flex-1" onClick={() => setPasso(2)}>Voltar</Button>
              <Button className="flex-1" onClick={concluir} disabled={salvando}>{salvando ? 'Salvando...' : 'Entrar no sistema'}</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

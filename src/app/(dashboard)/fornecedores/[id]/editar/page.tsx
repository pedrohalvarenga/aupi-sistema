'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Truck, Check, Trash2 } from 'lucide-react'
import { CATEGORIAS } from '@/types/fornecedores'
import type { Fornecedor } from '@/types/fornecedores'

const inputCls = 'w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm'
const labelCls = 'text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block'

export default function EditarFornecedorPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [f, setF] = useState<Fornecedor | null>(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [confirmarExcluir, setConfirmarExcluir] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase.from('fornecedores').select('*').eq('id', id).single<Fornecedor>()
      setF(data)
      setLoading(false)
    }
    load()
  }, [id])

  function set<K extends keyof Fornecedor>(campo: K, valor: Fornecedor[K]) {
    setF(prev => prev ? { ...prev, [campo]: valor } : prev)
  }

  async function salvar() {
    if (!f) return
    setErro('')
    if (!f.nome.trim()) { setErro('Informe o nome do fornecedor.'); return }
    setSalvando(true)
    const supabase = createClient()
    const { error } = await supabase.from('fornecedores').update({
      nome: f.nome.trim(),
      cnpj: f.cnpj?.trim() || null,
      categoria: f.categoria || null,
      contato_nome: f.contato_nome?.trim() || null,
      telefone: f.telefone?.trim() || null,
      email: f.email?.trim() || null,
      endereco: f.endereco?.trim() || null,
      observacoes: f.observacoes?.trim() || null,
      ativo: f.ativo,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    setSalvando(false)
    if (error) {
      console.error('Erro ao salvar fornecedor:', error)
      setErro('Não foi possível salvar as alterações. Tente novamente.')
      return
    }
    router.push('/fornecedores')
  }

  async function excluir() {
    setSalvando(true)
    const supabase = createClient()
    const { error } = await supabase.from('fornecedores').delete().eq('id', id)
    setSalvando(false)
    if (error) {
      console.error('Erro ao excluir fornecedor:', error)
      setErro('Não foi possível excluir o fornecedor. Tente novamente.')
      return
    }
    router.push('/fornecedores')
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
    </div>
  )
  if (!f) return (
    <div className="py-20 text-center text-gray-400">Fornecedor não encontrado.</div>
  )

  return (
    <div className="py-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/fornecedores" className="p-2 rounded-xl text-gray-400 hover:text-gray-700">
          <ArrowLeft size={22} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Truck size={22} className="text-brand-purple" /> Editar fornecedor
        </h1>
      </div>

      <div>
        <label className={labelCls}>Nome *</label>
        <input value={f.nome} onChange={e => set('nome', e.target.value)} className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>CNPJ</label>
          <input value={f.cnpj ?? ''} onChange={e => set('cnpj', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Categoria</label>
          <select value={f.categoria ?? ''} onChange={e => set('categoria', e.target.value)} className={`${inputCls} bg-white`}>
            <option value="">Selecione...</option>
            {CATEGORIAS.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Pessoa de contato</label>
          <input value={f.contato_nome ?? ''} onChange={e => set('contato_nome', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Telefone</label>
          <input type="tel" value={f.telefone ?? ''} onChange={e => set('telefone', e.target.value)} className={inputCls} />
        </div>
      </div>
      <div>
        <label className={labelCls}>E-mail</label>
        <input type="email" value={f.email ?? ''} onChange={e => set('email', e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Endereço</label>
        <input value={f.endereco ?? ''} onChange={e => set('endereco', e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Observações</label>
        <textarea value={f.observacoes ?? ''} onChange={e => set('observacoes', e.target.value)} rows={2} className={inputCls} />
      </div>

      <button onClick={() => set('ativo', !f.ativo)}
        className="flex items-center justify-between py-3 px-4 rounded-2xl border border-gray-200 bg-white text-left">
        <div>
          <p className="font-medium text-gray-900 text-sm">Fornecedor ativo</p>
          <p className="text-xs text-gray-400">Inativos não aparecem para escolher como favorecido na despesa</p>
        </div>
        <span className="w-11 h-6 rounded-full flex-shrink-0 relative transition-colors"
          style={{ background: f.ativo ? 'var(--brand-purple)' : '#e5e7eb' }}>
          <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all" style={{ left: f.ativo ? '22px' : '2px' }} />
        </span>
      </button>

      {erro && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{erro}</p>}

      <button onClick={salvar} disabled={salvando}
        className="py-4 rounded-2xl bg-brand-purple text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2">
        {salvando ? 'Salvando...' : <><Check size={20} /> Salvar alterações</>}
      </button>

      {confirmarExcluir ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-col gap-3">
          <p className="text-sm text-red-700 font-medium">Excluir este fornecedor? As despesas vinculadas são mantidas, mas perdem o vínculo com ele.</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setConfirmarExcluir(false)} className="py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm">Cancelar</button>
            <button onClick={excluir} disabled={salvando} className="py-2.5 rounded-xl bg-red-500 text-white font-bold text-sm disabled:opacity-50">Excluir</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setConfirmarExcluir(true)}
          className="flex items-center justify-center gap-2 py-3 rounded-2xl text-red-500 font-semibold text-sm border border-red-200">
          <Trash2 size={16} /> Excluir fornecedor
        </button>
      )}
    </div>
  )
}

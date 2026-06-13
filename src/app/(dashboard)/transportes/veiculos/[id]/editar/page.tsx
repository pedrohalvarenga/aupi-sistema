'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Car, Check, Trash2 } from 'lucide-react'
import type { Veiculo } from '@/types/transporte'

const inputCls = 'w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-orange outline-none text-sm'
const labelCls = 'text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block'

export default function EditarVeiculoPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [v, setV] = useState<Veiculo | null>(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [confirmarExcluir, setConfirmarExcluir] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase.from('veiculos').select('*').eq('id', id).single<Veiculo>()
      setV(data)
      setLoading(false)
    }
    load()
  }, [id])

  function set<K extends keyof Veiculo>(campo: K, valor: Veiculo[K]) {
    setV(prev => prev ? { ...prev, [campo]: valor } : prev)
  }

  async function salvar() {
    if (!v) return
    setErro('')
    if (!v.nome.trim()) { setErro('Dê um nome/apelido ao veículo.'); return }
    setSalvando(true)
    const supabase = createClient()
    const { error } = await supabase.from('veiculos').update({
      nome: v.nome.trim(),
      modelo: v.modelo?.trim() || null,
      placa: v.placa?.trim() || null,
      cor: v.cor?.trim() || null,
      ano: v.ano ? Number(v.ano) : null,
      km_atual: Number(v.km_atual) || 0,
      capacidade: v.capacidade ? Number(v.capacidade) : null,
      ativo: v.ativo,
      observacoes: v.observacoes?.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    setSalvando(false)
    if (error) { setErro(error.message); return }
    router.push('/transportes/veiculos')
  }

  async function excluir() {
    setSalvando(true)
    const supabase = createClient()
    const { error } = await supabase.from('veiculos').delete().eq('id', id)
    setSalvando(false)
    if (error) { setErro(error.message); return }
    router.push('/transportes/veiculos')
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <span className="w-8 h-8 border-2 border-brand-orange/30 border-t-brand-orange rounded-full animate-spin" />
    </div>
  )
  if (!v) return (
    <div className="py-20 text-center text-gray-400">Veículo não encontrado.</div>
  )

  return (
    <div className="py-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/transportes/veiculos" className="p-2 rounded-xl text-gray-400 hover:text-gray-700">
          <ArrowLeft size={22} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Car size={22} className="text-brand-orange" /> Editar veículo
        </h1>
      </div>

      <div>
        <label className={labelCls}>Nome / apelido *</label>
        <input value={v.nome} onChange={e => set('nome', e.target.value)} className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Modelo</label>
          <input value={v.modelo ?? ''} onChange={e => set('modelo', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Placa</label>
          <input value={v.placa ?? ''} onChange={e => set('placa', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Cor</label>
          <input value={v.cor ?? ''} onChange={e => set('cor', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Ano</label>
          <input type="text" inputMode="numeric" value={v.ano ?? ''} onChange={e => set('ano', e.target.value ? Number(e.target.value) : null)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Km atual</label>
          <input type="text" inputMode="decimal" value={v.km_atual ?? 0} onChange={e => set('km_atual', e.target.value ? Number(e.target.value.replace(',', '.')) : 0)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Capacidade (pets)</label>
          <input type="text" inputMode="numeric" value={v.capacidade ?? ''} onChange={e => set('capacidade', e.target.value ? Number(e.target.value) : null)} className={inputCls} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Observações</label>
        <textarea value={v.observacoes ?? ''} onChange={e => set('observacoes', e.target.value)} rows={2} className={inputCls} />
      </div>

      <button onClick={() => set('ativo', !v.ativo)}
        className="flex items-center justify-between py-3 px-4 rounded-2xl border border-gray-200 bg-white text-left">
        <div>
          <p className="font-medium text-gray-900 text-sm">Veículo ativo</p>
          <p className="text-xs text-gray-400">Inativos não aparecem para escolher em abastecimento/rota</p>
        </div>
        <span className="w-11 h-6 rounded-full flex-shrink-0 relative transition-colors"
          style={{ background: v.ativo ? 'var(--brand-orange)' : '#e5e7eb' }}>
          <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all" style={{ left: v.ativo ? '22px' : '2px' }} />
        </span>
      </button>

      {erro && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{erro}</p>}

      <button onClick={salvar} disabled={salvando}
        className="py-4 rounded-2xl bg-brand-orange text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2">
        {salvando ? 'Salvando...' : <><Check size={20} /> Salvar alterações</>}
      </button>

      {confirmarExcluir ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-col gap-3">
          <p className="text-sm text-red-700 font-medium">Excluir este veículo? O histórico de abastecimento/manutenção é mantido, mas perde o vínculo com o carro.</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setConfirmarExcluir(false)} className="py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm">Cancelar</button>
            <button onClick={excluir} disabled={salvando} className="py-2.5 rounded-xl bg-red-500 text-white font-bold text-sm disabled:opacity-50">Excluir</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setConfirmarExcluir(true)}
          className="flex items-center justify-center gap-2 py-3 rounded-2xl text-red-500 font-semibold text-sm border border-red-200">
          <Trash2 size={16} /> Excluir veículo
        </button>
      )}
    </div>
  )
}

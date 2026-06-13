'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Car, Check } from 'lucide-react'

const inputCls = 'w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-orange outline-none text-sm'
const labelCls = 'text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block'

export default function NovoVeiculoPage() {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [modelo, setModelo] = useState('')
  const [placa, setPlaca] = useState('')
  const [cor, setCor] = useState('')
  const [ano, setAno] = useState('')
  const [kmAtual, setKmAtual] = useState('')
  const [capacidade, setCapacidade] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    setErro('')
    if (!nome.trim()) { setErro('Dê um nome/apelido ao veículo.'); return }
    setSalvando(true)
    const supabase = createClient()
    const { error } = await supabase.from('veiculos').insert({
      nome: nome.trim(),
      modelo: modelo.trim() || null,
      placa: placa.trim() || null,
      cor: cor.trim() || null,
      ano: ano.trim() ? parseInt(ano) : null,
      km_atual: kmAtual.trim() ? parseFloat(kmAtual.replace(',', '.')) : 0,
      capacidade: capacidade.trim() ? parseInt(capacidade) : null,
      observacoes: observacoes.trim() || null,
    })
    setSalvando(false)
    if (error) { setErro(error.message); return }
    router.push('/transportes/veiculos')
  }

  return (
    <div className="py-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/transportes/veiculos" className="p-2 rounded-xl text-gray-400 hover:text-gray-700">
          <ArrowLeft size={22} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Car size={22} className="text-brand-orange" /> Novo veículo
        </h1>
      </div>

      <div>
        <label className={labelCls}>Nome / apelido *</label>
        <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Fiorino branca" className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Modelo</label>
          <input value={modelo} onChange={e => setModelo(e.target.value)} placeholder="Fiat Fiorino" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Placa</label>
          <input value={placa} onChange={e => setPlaca(e.target.value)} placeholder="ABC1D23" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Cor</label>
          <input value={cor} onChange={e => setCor(e.target.value)} placeholder="Branca" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Ano</label>
          <input type="text" inputMode="numeric" value={ano} onChange={e => setAno(e.target.value)} placeholder="2022" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Km atual</label>
          <input type="text" inputMode="decimal" value={kmAtual} onChange={e => setKmAtual(e.target.value)} placeholder="0" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Capacidade (pets)</label>
          <input type="text" inputMode="numeric" value={capacidade} onChange={e => setCapacidade(e.target.value)} placeholder="6" className={inputCls} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Observações</label>
        <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2}
          placeholder="Detalhes, seguro, vencimentos..." className={inputCls} />
      </div>

      {erro && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{erro}</p>}

      <button onClick={salvar} disabled={salvando}
        className="py-4 rounded-2xl bg-brand-orange text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2">
        {salvando ? 'Salvando...' : <><Check size={20} /> Cadastrar veículo</>}
      </button>
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Percent, ChevronLeft, ChevronRight, FileText, Check } from 'lucide-react'
import { formatCurrency } from '@/lib/financeiro'
import { MESES_LABELS } from '@/types/funcionarios'
import type { ComissaoMesFuncionario } from '@/types/funcionarios'

function iniciais(nome: string) {
  return nome.trim().split(/\s+/).slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('')
}

export default function ComissoesPage() {
  const hoje = new Date()
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [ano, setAno] = useState(hoje.getFullYear())
  const [lista, setLista] = useState<ComissaoMesFuncionario[]>([])
  const [totalGeral, setTotalGeral] = useState(0)
  const [loading, setLoading] = useState(true)
  const [pagandoId, setPagandoId] = useState<string | null>(null)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true); setErro('')
    const res = await fetch(`/api/funcionarios/comissao/mes?mes=${mes}&ano=${ano}`)
    if (res.ok) {
      const j = await res.json()
      setLista(j.lista ?? [])
      setTotalGeral(j.totalGeral ?? 0)
    } else {
      setLista([]); setTotalGeral(0)
    }
    setLoading(false)
  }, [mes, ano])

  useEffect(() => { carregar() }, [carregar])

  function mudarMes(delta: number) {
    let m = mes + delta, a = ano
    if (m < 1) { m = 12; a-- }
    if (m > 12) { m = 1; a++ }
    setMes(m); setAno(a)
  }

  async function pagar(funcionarioId: string) {
    setPagandoId(funcionarioId); setErro('')
    const res = await fetch('/api/funcionarios/comissao/pagar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ funcionario_id: funcionarioId, mes, ano }),
    })
    setPagandoId(null)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setErro(j.error || 'Não foi possível registrar o pagamento.')
      return
    }
    carregar()
  }

  return (
    <div className="py-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/funcionarios" className="p-2 rounded-xl text-gray-400 hover:text-gray-700">
          <ArrowLeft size={22} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Percent size={22} className="text-brand-purple" /> Comissões
        </h1>
      </div>

      {/* Navegador de mês */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 p-2">
        <button onClick={() => mudarMes(-1)} className="p-2 rounded-xl text-gray-400 hover:text-gray-700">
          <ChevronLeft size={20} />
        </button>
        <p className="font-bold text-gray-800">{MESES_LABELS[mes - 1]} {ano}</p>
        <button onClick={() => mudarMes(1)} className="p-2 rounded-xl text-gray-400 hover:text-gray-700">
          <ChevronRight size={20} />
        </button>
      </div>

      {erro && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{erro}</p>}

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
        </div>
      ) : lista.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Percent size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum funcionário com comissão</p>
          <p className="text-sm text-gray-400 mt-1">Ative &quot;recebe comissão&quot; no cadastro do funcionário.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {lista.map(item => {
              const f = item.funcionario
              return (
                <div key={f.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    {f.foto_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.foto_url} alt={f.nome_completo} className="w-11 h-11 rounded-2xl object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-11 h-11 rounded-2xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                        <span className="font-bold text-brand-purple text-sm">{iniciais(f.nome_completo)}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 truncate">{f.nome_completo}</p>
                      <p className="text-xs text-gray-400 truncate">{f.cargo || 'Sem cargo'}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Comissão</p>
                      <p className="font-bold text-brand-purple">{formatCurrency(item.total)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/funcionarios/${f.id}/extrato?mes=${mes}&ano=${ano}`}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm">
                      <FileText size={15} /> Extrato
                    </Link>
                    {item.pago ? (
                      <span className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-50 text-green-600 font-semibold text-sm">
                        <Check size={15} /> Pago
                      </span>
                    ) : (
                      <button onClick={() => pagar(f.id)} disabled={pagandoId === f.id || item.total <= 0}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-brand-purple text-white font-semibold text-sm disabled:opacity-40">
                        {pagandoId === f.id ? 'Registrando...' : 'Registrar pagamento'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 flex items-center justify-between">
            <p className="font-semibold text-gray-700">Total geral de comissões</p>
            <p className="font-bold text-brand-purple text-lg">{formatCurrency(totalGeral)}</p>
          </div>
        </>
      )}
    </div>
  )
}

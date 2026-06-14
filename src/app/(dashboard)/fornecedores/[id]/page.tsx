'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  ArrowLeft, Truck, Pencil, Phone, Mail, MapPin, User, FileText, Receipt,
} from 'lucide-react'
import { formatCurrency } from '@/lib/financeiro'
import { CATEGORIA_LABELS } from '@/types/fornecedores'
import type { Fornecedor } from '@/types/fornecedores'

interface DespesaLinha {
  id: string
  data: string
  valor: number
  descricao: string | null
}

export default function FornecedorDetalhePage() {
  const params = useParams()
  const id = params.id as string

  const [f, setF] = useState<Fornecedor | null>(null)
  const [despesas, setDespesas] = useState<DespesaLinha[]>([])
  const [totalGasto, setTotalGasto] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: forn }, { data: desp }] = await Promise.all([
        supabase.from('fornecedores').select('*').eq('id', id).single<Fornecedor>(),
        supabase.from('despesas').select('id, data, valor, descricao')
          .eq('fornecedor_id', id).order('data', { ascending: false }),
      ])
      setF(forn)
      const lista = (desp as DespesaLinha[]) ?? []
      setTotalGasto(lista.reduce((s, d) => s + (Number(d.valor) || 0), 0))
      setDespesas(lista.slice(0, 5))
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return (
    <div className="flex justify-center py-20">
      <span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
    </div>
  )
  if (!f) return (
    <div className="py-20 text-center text-gray-400">Fornecedor não encontrado.</div>
  )

  const detalhes: { icon: React.ElementType; label: string; valor: string }[] = [
    { icon: User, label: 'Contato', valor: f.contato_nome ?? '' },
    { icon: Phone, label: 'Telefone', valor: f.telefone ?? '' },
    { icon: Mail, label: 'E-mail', valor: f.email ?? '' },
    { icon: MapPin, label: 'Endereço', valor: f.endereco ?? '' },
    { icon: FileText, label: 'CNPJ', valor: f.cnpj ?? '' },
  ].filter(d => d.valor.trim())

  return (
    <div className="py-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/fornecedores" className="p-2 rounded-xl text-gray-400 hover:text-gray-700">
            <ArrowLeft size={22} />
          </Link>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Truck size={22} className="text-brand-purple" /> Fornecedor
          </h1>
        </div>
        <Link href={`/fornecedores/${id}/editar`}
          className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-brand-purple text-white font-semibold text-sm">
          <Pencil size={16} /> Editar
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <p className="font-bold text-gray-900 text-lg">{f.nome}</p>
          {!f.ativo && <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">Inativo</span>}
        </div>
        {f.categoria && <p className="text-sm text-brand-purple font-medium">{CATEGORIA_LABELS[f.categoria] ?? f.categoria}</p>}
      </div>

      {detalhes.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
          {detalhes.map(d => {
            const Icon = d.icon
            return (
              <div key={d.label} className="flex items-center gap-3">
                <Icon size={16} className="text-gray-300 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{d.label}</p>
                  <p className="text-sm text-gray-800 truncate">{d.valor}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {f.observacoes && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Observações</p>
          <p className="text-sm text-gray-700 whitespace-pre-line">{f.observacoes}</p>
        </div>
      )}

      <div className="bg-purple-50 rounded-2xl border border-purple-100 p-4">
        <p className="text-xs font-semibold text-brand-purple uppercase tracking-wide mb-1">Total gasto com este fornecedor</p>
        <p className="text-2xl font-bold text-brand-purple">{formatCurrency(totalGasto)}</p>
      </div>

      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
          <Receipt size={16} className="text-gray-400" /> Últimas despesas
        </p>
        {despesas.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Nenhuma despesa vinculada ainda.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {despesas.map(d => (
              <div key={d.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-gray-800 truncate">{d.descricao || 'Despesa'}</p>
                  <p className="text-xs text-gray-400">{new Date(d.data + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                </div>
                <p className="text-sm font-bold text-gray-900 flex-shrink-0">{formatCurrency(Number(d.valor) || 0)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

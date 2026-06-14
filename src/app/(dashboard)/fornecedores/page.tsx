'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Truck, ChevronRight, Search,
  Package, Pill, Building, Sparkles, Wrench, Megaphone, Boxes, Store,
} from 'lucide-react'
import { CATEGORIA_LABELS } from '@/types/fornecedores'
import type { Fornecedor } from '@/types/fornecedores'

const CATEGORIA_ICONES: Record<string, React.ElementType> = {
  racao_insumos: Package,
  medicamentos:  Pill,
  aluguel:       Building,
  limpeza:       Sparkles,
  servicos:      Wrench,
  equipamentos:  Boxes,
  marketing:     Megaphone,
  outros:        Store,
}

export default function FornecedoresPage() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase.from('fornecedores').select('*')
        .order('ativo', { ascending: false }).order('nome')
      setFornecedores((data as Fornecedor[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const termo = busca.trim().toLowerCase()
  const filtrados = termo
    ? fornecedores.filter(f =>
        f.nome.toLowerCase().includes(termo) ||
        (f.categoria && CATEGORIA_LABELS[f.categoria]?.toLowerCase().includes(termo)) ||
        (f.contato_nome?.toLowerCase().includes(termo)) ||
        (f.telefone?.toLowerCase().includes(termo)))
    : fornecedores

  return (
    <div className="py-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/financeiro" className="p-2 rounded-xl text-gray-400 hover:text-gray-700">
            <ArrowLeft size={22} />
          </Link>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Truck size={22} className="text-brand-purple" /> Fornecedores
          </h1>
        </div>
        <Link href="/fornecedores/novo"
          className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-brand-purple text-white font-semibold text-sm">
          <Plus size={16} /> Novo
        </Link>
      </div>

      <p className="text-sm text-gray-400">Cadastre quem te fornece produtos e presta serviços para vincular às despesas.</p>

      {fornecedores.length > 0 && (
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar fornecedor..."
            className="w-full pl-10 pr-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm" />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
        </div>
      ) : fornecedores.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Truck size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum fornecedor cadastrado</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">Adicione quem te fornece e presta serviço.</p>
          <Link href="/fornecedores/novo"
            className="inline-flex items-center gap-1.5 px-5 py-3 rounded-2xl bg-brand-purple text-white font-semibold text-sm">
            <Plus size={16} /> Cadastrar primeiro fornecedor
          </Link>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="font-medium">Nenhum fornecedor encontrado</p>
          <p className="text-sm text-gray-400 mt-1">Tente outro termo de busca.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtrados.map(f => {
            const Icon = (f.categoria && CATEGORIA_ICONES[f.categoria]) || Store
            return (
              <Link key={f.id} href={`/fornecedores/${f.id}`}>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <Icon size={22} className="text-brand-purple" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-gray-900 truncate">{f.nome}</p>
                      {!f.ativo && <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">Inativo</span>}
                    </div>
                    <p className="text-xs text-gray-400 truncate">
                      {[f.categoria ? CATEGORIA_LABELS[f.categoria] : null, f.telefone].filter(Boolean).join(' · ') || 'Sem detalhes'}
                    </p>
                  </div>
                  <ChevronRight size={18} className="text-gray-300 flex-shrink-0" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

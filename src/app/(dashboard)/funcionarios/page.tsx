'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Plus, Users, ChevronRight, Percent, Wallet } from 'lucide-react'
import { formatCurrency } from '@/lib/financeiro'
import type { Funcionario } from '@/types/funcionarios'

function iniciais(nome: string) {
  return nome.trim().split(/\s+/).slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('')
}

export default function FuncionariosPage() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase.from('funcionarios').select('*')
        .order('ativo', { ascending: false }).order('nome_completo')
      setFuncionarios((data as Funcionario[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="py-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="p-2 rounded-xl text-gray-400 hover:text-gray-700">
            <ArrowLeft size={22} />
          </Link>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Users size={22} className="text-brand-purple" /> Funcionários
          </h1>
        </div>
        <Link href="/funcionarios/novo"
          className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-brand-purple text-white font-semibold text-sm">
          <Plus size={16} /> Novo
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">Cadastre a equipe, salários, uniformes e comissões por área.</p>
        <Link href="/funcionarios/comissoes"
          className="flex items-center gap-1 text-sm font-semibold text-brand-purple flex-shrink-0">
          <Percent size={15} /> Comissões
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
        </div>
      ) : funcionarios.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Users size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum funcionário cadastrado</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">Adicione o primeiro membro da equipe.</p>
          <Link href="/funcionarios/novo"
            className="inline-flex items-center gap-1.5 px-5 py-3 rounded-2xl bg-brand-purple text-white font-semibold text-sm">
            <Plus size={16} /> Cadastrar funcionário
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {funcionarios.map(f => (
            <Link key={f.id} href={`/funcionarios/${f.id}/editar`}>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                {f.foto_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.foto_url} alt={f.nome_completo}
                    className="w-11 h-11 rounded-2xl object-cover flex-shrink-0" />
                ) : (
                  <div className="w-11 h-11 rounded-2xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-brand-purple text-sm">{iniciais(f.nome_completo)}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-900 truncate">{f.nome_completo}</p>
                    {!f.ativo && <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">Inativo</span>}
                    {f.recebe_comissao && (
                      <span className="text-[10px] font-semibold text-brand-purple bg-purple-100 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <Percent size={9} /> comissão
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 truncate">{f.cargo || 'Sem cargo'}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <Wallet size={11} /> {formatCurrency(Number(f.salario) || 0)}
                  </p>
                </div>
                <ChevronRight size={18} className="text-gray-300 flex-shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

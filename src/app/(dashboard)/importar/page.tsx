'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Users, UserCheck, Truck, DollarSign, ChevronRight, Sparkles } from 'lucide-react'
import ImportTutores from '@/components/importar/ImportTutores'
import ImportEntidade from '@/components/importar/ImportEntidade'
import { type TipoEntidade } from '@/lib/importar-entidades'

type Categoria = 'tutores' | TipoEntidade

const OPCOES: Array<{
  id: Categoria; titulo: string; sub: string
  icon: React.ElementType; cor: string; bg: string
}> = [
  { id: 'tutores',      titulo: 'Tutores & Pets',  sub: 'Donos, cães, raças, portes, vacinas e saldos', icon: Users,     cor: 'text-brand-purple', bg: 'bg-purple-100' },
  { id: 'funcionarios', titulo: 'Funcionários',    sub: 'Equipe, cargos, contato, salário e admissão',  icon: UserCheck,  cor: 'text-green-600',    bg: 'bg-green-100' },
  { id: 'fornecedores', titulo: 'Fornecedores',    sub: 'Quem te fornece e presta serviço',             icon: Truck,      cor: 'text-brand-orange', bg: 'bg-orange-100' },
  { id: 'financeiro',   titulo: 'Financeiro',      sub: 'Receitas e despesas do seu caixa',             icon: DollarSign, cor: 'text-blue-600',     bg: 'bg-blue-100' },
]

export default function ImportarPage() {
  const [cat, setCat] = useState<Categoria | null>(null)

  if (cat === 'tutores') return <ImportTutores onVoltar={() => setCat(null)} />
  if (cat) return <ImportEntidade tipo={cat} onVoltar={() => setCat(null)} />

  return (
    <div className="py-6 flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Link href="/admin" className="text-gray-400"><ArrowLeft size={20} /></Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Importar dados com IA</h1>
          <p className="text-sm text-gray-400">Traga seus dados de qualquer lugar — a Aupipet entende sozinha.</p>
        </div>
      </div>

      <div className="bg-purple-50 border border-brand-purple/20 rounded-3xl p-4 flex gap-3">
        <Sparkles size={20} className="text-brand-purple flex-shrink-0 mt-0.5" />
        <p className="text-sm text-gray-600">
          Está num sistema antigo, numa planilha bagunçada ou só em fichas de papel? Escolha o que quer trazer.
          A IA lê <b>Excel/CSV, PDF ou fotos</b>, organiza e cadastra. Você só revisa e confirma.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {OPCOES.map(o => {
          const Icon = o.icon
          return (
            <button
              key={o.id}
              onClick={() => setCat(o.id)}
              className="flex items-center gap-4 bg-white rounded-3xl border border-gray-100 p-4 text-left active:scale-[.98] transition-transform hover:border-brand-purple/40"
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${o.bg}`}>
                <Icon size={24} className={o.cor} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900">{o.titulo}</p>
                <p className="text-sm text-gray-400">{o.sub}</p>
              </div>
              <ChevronRight size={20} className="text-gray-300 flex-shrink-0" />
            </button>
          )
        })}
      </div>

      <p className="text-center text-xs text-gray-400">100% automático. Seus dados não são compartilhados com ninguém.</p>
    </div>
  )
}

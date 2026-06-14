'use client'

import { useEffect, useState, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Download, PawPrint } from 'lucide-react'
import { formatCurrency } from '@/lib/financeiro'
import { formatDate } from '@/lib/utils'
import { AREA_LABELS } from '@/lib/financeiro'
import { MESES_LABELS } from '@/types/funcionarios'
import type { ComissaoLinha } from '@/types/funcionarios'

interface ExtratoData {
  funcionario: { id: string; nome_completo: string; cargo: string | null; salario: number }
  linhas: ComissaoLinha[]
  total: number
  mes: number
  ano: number
}

function areaLabel(area: string) {
  return (AREA_LABELS as Record<string, string>)[area] ?? area
}

function ExtratoConteudo() {
  const params = useParams()
  const search = useSearchParams()
  const id = params.id as string
  const hoje = new Date()
  const mes = Number(search.get('mes')) || hoje.getMonth() + 1
  const ano = Number(search.get('ano')) || hoje.getFullYear()

  const [dados, setDados] = useState<ExtratoData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/funcionarios/comissao/extrato?funcionario_id=${id}&mes=${mes}&ano=${ano}`)
      if (res.ok) setDados(await res.json())
      setLoading(false)
    }
    load()
  }, [id, mes, ano])

  if (loading) return (
    <div className="flex justify-center py-20">
      <span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
    </div>
  )
  if (!dados) return <div className="py-20 text-center text-gray-400">Extrato não encontrado.</div>

  const salario = Number(dados.funcionario.salario) || 0
  const totalPagar = salario + dados.total

  return (
    <div className="py-6 flex flex-col gap-4">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff; }
          .extrato-folha { box-shadow: none !important; border: none !important; }
        }
      `}</style>

      <div className="flex items-center justify-between no-print">
        <Link href="/funcionarios/comissoes" className="p-2 rounded-xl text-gray-400 hover:text-gray-700">
          <ArrowLeft size={22} />
        </Link>
        <button onClick={() => window.print()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-brand-purple text-white font-semibold text-sm">
          <Download size={16} /> Baixar PDF
        </button>
      </div>

      <div className="extrato-folha bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-5">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b-2 border-brand-purple/20 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-purple-100 flex items-center justify-center">
              <PawPrint size={22} className="text-brand-purple" />
            </div>
            <div>
              <p className="text-xl font-bold text-brand-purple leading-none">Aupipet</p>
              <p className="text-xs text-gray-400">Extrato de comissão</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-gray-800">{MESES_LABELS[dados.mes - 1]} / {dados.ano}</p>
          </div>
        </div>

        {/* Funcionário */}
        <div>
          <p className="font-bold text-gray-900 text-lg">{dados.funcionario.nome_completo}</p>
          {dados.funcionario.cargo && <p className="text-sm text-gray-400">{dados.funcionario.cargo}</p>}
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-200">
                <th className="py-2 pr-2 font-semibold">Data</th>
                <th className="py-2 px-2 font-semibold">Serviço · pet</th>
                <th className="py-2 px-2 font-semibold text-right">Valor</th>
                <th className="py-2 px-2 font-semibold text-right">%</th>
                <th className="py-2 pl-2 font-semibold text-right">Comissão</th>
              </tr>
            </thead>
            <tbody>
              {dados.linhas.length === 0 ? (
                <tr><td colSpan={5} className="py-6 text-center text-gray-400">Nenhum serviço atribuído neste mês.</td></tr>
              ) : dados.linhas.map((l, i) => (
                <tr key={l.receita_id + i} className="border-b border-gray-50">
                  <td className="py-2 pr-2 text-gray-600 whitespace-nowrap">{formatDate(l.data)}</td>
                  <td className="py-2 px-2 text-gray-800">
                    {l.descricao}
                    <span className="block text-[11px] text-gray-400">{areaLabel(l.area)}</span>
                  </td>
                  <td className="py-2 px-2 text-right text-gray-600 whitespace-nowrap">{formatCurrency(l.valor)}</td>
                  <td className="py-2 px-2 text-right text-gray-500 whitespace-nowrap">{l.percentual}%</td>
                  <td className="py-2 pl-2 text-right font-semibold text-gray-800 whitespace-nowrap">{formatCurrency(l.comissao)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Rodapé / totais */}
        <div className="flex flex-col gap-1.5 border-t-2 border-brand-purple/20 pt-4">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Total de comissões</span>
            <span className="font-semibold">{formatCurrency(dados.total)}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Salário base</span>
            <span className="font-semibold">{formatCurrency(salario)}</span>
          </div>
          <div className="flex items-center justify-between text-base border-t border-gray-100 pt-2 mt-1">
            <span className="font-bold text-gray-900">Total a pagar</span>
            <span className="font-bold text-brand-purple text-lg">{formatCurrency(totalPagar)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ExtratoPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-gray-400">Carregando...</div>}>
      <ExtratoConteudo />
    </Suspense>
  )
}

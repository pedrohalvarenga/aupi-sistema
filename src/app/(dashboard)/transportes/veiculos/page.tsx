'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Plus, Car, ChevronRight, Gauge } from 'lucide-react'
import { formatKm } from '@/lib/transporte'
import type { Veiculo } from '@/types/transporte'

export default function VeiculosPage() {
  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase.from('veiculos').select('*').order('ativo', { ascending: false }).order('nome')
      setVeiculos((data as Veiculo[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="py-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/transportes" className="p-2 rounded-xl text-gray-400 hover:text-gray-700">
            <ArrowLeft size={22} />
          </Link>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Car size={22} className="text-brand-orange" /> Veículos
          </h1>
        </div>
        <Link href="/transportes/veiculos/novo"
          className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-brand-orange text-white font-semibold text-sm">
          <Plus size={16} /> Novo
        </Link>
      </div>

      <p className="text-sm text-gray-400">Cadastre os carros da sua empresa para controlar km, abastecimento, manutenção e rotas por veículo.</p>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="w-8 h-8 border-2 border-brand-orange/30 border-t-brand-orange rounded-full animate-spin" />
        </div>
      ) : veiculos.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Car size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum veículo cadastrado</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">Adicione o primeiro carro da frota.</p>
          <Link href="/transportes/veiculos/novo"
            className="inline-flex items-center gap-1.5 px-5 py-3 rounded-2xl bg-brand-orange text-white font-semibold text-sm">
            <Plus size={16} /> Cadastrar veículo
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {veiculos.map(v => (
            <Link key={v.id} href={`/transportes/veiculos/${v.id}/editar`}>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <Car size={22} className="text-brand-orange" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-900 truncate">{v.nome}</p>
                    {!v.ativo && <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">Inativo</span>}
                  </div>
                  <p className="text-xs text-gray-400 truncate">
                    {[v.modelo, v.placa, v.cor].filter(Boolean).join(' · ') || 'Sem detalhes'}
                  </p>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <Gauge size={11} /> {formatKm(Number(v.km_atual) || 0)}
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
